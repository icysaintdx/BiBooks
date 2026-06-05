/**
 * WebSocket 服务模块
 * 提供实时双向通信，支持协同编辑
 */

const crypto = require('node:crypto');
const { logInfo, logError, logWarn } = require('../utils/logger.cjs');

/**
 * 创建 WebSocket 服务器
 * 基于 HTTP 升级实现，无需额外依赖
 */
function createWebSocketServer({ httpServer }) {
  const clients = new Map(); // clientId -> { ws, userId, userName, rooms }
  const rooms = new Map(); // roomId -> Set<clientId>

  /**
   * 生成唯一 ID
   */
  function generateId() {
    return crypto.randomUUID();
  }

  /**
   * 解析 WebSocket 帧
   */
  function parseFrame(buffer) {
    if (buffer.length < 2) return null;

    const firstByte = buffer[0];
    const secondByte = buffer[1];
    const opcode = firstByte & 0x0F;
    const isMasked = (secondByte & 0x80) !== 0;
    let payloadLength = secondByte & 0x7F;
    let offset = 2;

    if (payloadLength === 126) {
      if (buffer.length < 4) return null;
      payloadLength = buffer.readUInt16BE(2);
      offset = 4;
    } else if (payloadLength === 127) {
      if (buffer.length < 10) return null;
      payloadLength = Number(buffer.readBigUInt64BE(2));
      offset = 10;
    }

    let maskingKey = null;
    if (isMasked) {
      if (buffer.length < offset + 4) return null;
      maskingKey = buffer.slice(offset, offset + 4);
      offset += 4;
    }

    if (buffer.length < offset + payloadLength) return null;

    let payload = buffer.slice(offset, offset + payloadLength);
    if (isMasked && maskingKey) {
      for (let i = 0; i < payload.length; i++) {
        payload[i] ^= maskingKey[i % 4];
      }
    }

    return {
      opcode,
      payload: payload.toString('utf-8'),
      totalLength: offset + payloadLength,
    };
  }

  /**
   * 创建 WebSocket 帧
   */
  function createFrame(payload, opcode = 0x01) {
    const data = Buffer.from(payload, 'utf-8');
    let header;

    if (data.length < 126) {
      header = Buffer.alloc(2);
      header[0] = 0x80 | opcode;
      header[1] = data.length;
    } else if (data.length < 65536) {
      header = Buffer.alloc(4);
      header[0] = 0x80 | opcode;
      header[1] = 126;
      header.writeUInt16BE(data.length, 2);
    } else {
      header = Buffer.alloc(10);
      header[0] = 0x80 | opcode;
      header[1] = 127;
      header.writeBigUInt64BE(BigInt(data.length), 2);
    }

    return Buffer.concat([header, data]);
  }

  /**
   * 发送消息给客户端
   */
  function sendToClient(clientId, message) {
    const client = clients.get(clientId);
    if (!client || client.ws.destroyed) return;

    try {
      const frame = createFrame(JSON.stringify(message));
      client.ws.write(frame);
    } catch (error) {
      logError(`[ws] 发送消息失败: ${clientId}`, error);
    }
  }

  /**
   * 广播消息给房间内所有客户端
   */
  function broadcastToRoom(roomId, message, excludeClientId = null) {
    const room = rooms.get(roomId);
    if (!room) return;

    for (const clientId of room) {
      if (clientId !== excludeClientId) {
        sendToClient(clientId, message);
      }
    }
  }

  /**
   * 处理 WebSocket 握手
   */
  function handleUpgrade(req, socket, head) {
    const key = req.headers['sec-websocket-key'];
    if (!key) {
      socket.destroy();
      return;
    }

    const acceptKey = crypto
      .createHash('sha1')
      .update(key + '258EAFA5-E914-47DA-95CA-5AB5DC65C740')
      .digest('base64');

    const response = [
      'HTTP/1.1 101 Switching Protocols',
      'Upgrade: websocket',
      'Connection: Upgrade',
      `Sec-WebSocket-Accept: ${acceptKey}`,
      '',
      '',
    ].join('\r\n');

    socket.write(response);

    const clientId = generateId();
    const client = {
      ws: socket,
      userId: null,
      userName: null,
      rooms: new Set(),
      buffer: Buffer.alloc(0),
    };

    clients.set(clientId, client);
    logInfo(`[ws] 客户端连接: ${clientId}`);

    socket.on('data', (data) => {
      handleData(clientId, data);
    });

    socket.on('close', () => {
      handleDisconnect(clientId);
    });

    socket.on('error', (error) => {
      logError(`[ws] 客户端错误: ${clientId}`, error);
      handleDisconnect(clientId);
    });

    // 发送连接成功消息
    sendToClient(clientId, {
      type: 'connected',
      clientId,
      timestamp: Date.now(),
    });
  }

  /**
   * 处理数据接收
   */
  function handleData(clientId, data) {
    const client = clients.get(clientId);
    if (!client) return;

    client.buffer = Buffer.concat([client.buffer, data]);

    while (client.buffer.length > 0) {
      const frame = parseFrame(client.buffer);
      if (!frame) break;

      client.buffer = client.buffer.slice(frame.totalLength);

      // 处理控制帧
      if (frame.opcode === 0x08) {
        // 关闭帧
        sendToClient(clientId, { type: 'closing' });
        client.ws.destroy();
        return;
      }

      if (frame.opcode === 0x09) {
        // Ping
        const pongFrame = createFrame(frame.payload, 0x0A);
        client.ws.write(pongFrame);
        continue;
      }

      // 处理文本消息
      if (frame.opcode === 0x01) {
        try {
          const message = JSON.parse(frame.payload);
          handleMessage(clientId, message);
        } catch (error) {
          logError(`[ws] 解析消息失败: ${clientId}`, error);
        }
      }
    }
  }

  /**
   * 处理消息
   */
  function handleMessage(clientId, message) {
    const client = clients.get(clientId);
    if (!client) return;

    switch (message.type) {
      case 'join':
        handleJoin(clientId, message);
        break;

      case 'leave':
        handleLeave(clientId, message);
        break;

      case 'operation':
        handleOperation(clientId, message);
        break;

      case 'cursor':
        handleCursor(clientId, message);
        break;

      case 'sync':
        handleSync(clientId, message);
        break;

      default:
        logWarn(`[ws] 未知消息类型: ${message.type}`);
    }
  }

  /**
   * 处理加入房间
   */
  function handleJoin(clientId, message) {
    const { roomId, userId, userName } = message;
    const client = clients.get(clientId);
    if (!client) return;

    // 设置用户信息
    client.userId = userId || clientId;
    client.userName = userName || '匿名用户';

    // 加入房间
    if (!rooms.has(roomId)) {
      rooms.set(roomId, new Set());
    }
    rooms.get(roomId).add(clientId);
    client.rooms.add(roomId);

    logInfo(`[ws] 用户加入房间: ${client.userName} -> ${roomId}`);

    // 通知房间内其他用户
    broadcastToRoom(roomId, {
      type: 'user_joined',
      userId: client.userId,
      userName: client.userName,
      timestamp: Date.now(),
    }, clientId);

    // 发送当前房间用户列表
    const roomUsers = [];
    for (const cid of rooms.get(roomId)) {
      const c = clients.get(cid);
      if (c) {
        roomUsers.push({
          userId: c.userId,
          userName: c.userName,
          isLocal: cid === clientId,
        });
      }
    }

    sendToClient(clientId, {
      type: 'room_state',
      roomId,
      users: roomUsers,
      timestamp: Date.now(),
    });
  }

  /**
   * 处理离开房间
   */
  function handleLeave(clientId, message) {
    const { roomId } = message;
    const client = clients.get(clientId);
    if (!client) return;

    leaveRoom(clientId, roomId);
  }

  /**
   * 离开房间
   */
  function leaveRoom(clientId, roomId) {
    const client = clients.get(clientId);
    if (!client) return;

    const room = rooms.get(roomId);
    if (room) {
      room.delete(clientId);
      if (room.size === 0) {
        rooms.delete(roomId);
      }
    }
    client.rooms.delete(roomId);

    logInfo(`[ws] 用户离开房间: ${client.userName} <- ${roomId}`);

    // 通知房间内其他用户
    broadcastToRoom(roomId, {
      type: 'user_left',
      userId: client.userId,
      userName: client.userName,
      timestamp: Date.now(),
    });
  }

  /**
   * 处理协同操作
   */
  function handleOperation(clientId, message) {
    const client = clients.get(clientId);
    if (!client) return;

    const { roomId, operation } = message;

    // 广播操作给房间内其他用户
    broadcastToRoom(roomId, {
      type: 'operation',
      userId: client.userId,
      userName: client.userName,
      operation,
      timestamp: Date.now(),
    }, clientId);
  }

  /**
   * 处理光标位置同步
   */
  function handleCursor(clientId, message) {
    const client = clients.get(clientId);
    if (!client) return;

    const { roomId, cursor } = message;

    // 广播光标位置给房间内其他用户
    broadcastToRoom(roomId, {
      type: 'cursor',
      userId: client.userId,
      userName: client.userName,
      cursor,
      timestamp: Date.now(),
    }, clientId);
  }

  /**
   * 处理同步请求
   */
  function handleSync(clientId, message) {
    const client = clients.get(clientId);
    if (!client) return;

    const { roomId } = message;

    // 通知房间内其他用户发送当前状态
    broadcastToRoom(roomId, {
      type: 'sync_request',
      userId: client.userId,
      userName: client.userName,
      timestamp: Date.now(),
    }, clientId);
  }

  /**
   * 处理客户端断开
   */
  function handleDisconnect(clientId) {
    const client = clients.get(clientId);
    if (!client) return;

    logInfo(`[ws] 客户端断开: ${client.userName || clientId}`);

    // 离开所有房间
    for (const roomId of client.rooms) {
      leaveRoom(clientId, roomId);
    }

    clients.delete(clientId);
  }

  /**
   * 获取服务器状态
   */
  function getStatus() {
    return {
      clientCount: clients.size,
      roomCount: rooms.size,
      rooms: Array.from(rooms.entries()).map(([roomId, members]) => ({
        roomId,
        memberCount: members.size,
      })),
    };
  }

  /**
   * 关闭服务器
   */
  function close() {
    for (const [clientId, client] of clients) {
      try {
        client.ws.destroy();
      } catch (error) {
        // 忽略关闭错误
      }
    }
    clients.clear();
    rooms.clear();
    logInfo('[ws] WebSocket 服务器已关闭');
  }

  return {
    handleUpgrade,
    getStatus,
    close,
  };
}

module.exports = {
  createWebSocketServer,
};
