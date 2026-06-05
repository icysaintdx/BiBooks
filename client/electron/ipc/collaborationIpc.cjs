/**
 * 协同编辑 IPC 接口
 * 提供 Electron 主进程与渲染进程的通信
 */

const { ipcMain } = require('electron');
const { logInfo, logError } = require('../utils/logger.cjs');

/**
 * 注册协同编辑 IPC 处理器
 */
function registerCollaborationIpc({ collaborationService, websocketService }) {
  /**
   * 创建协同会话
   */
  ipcMain.handle('collaboration:createSession', async (event, { documentId, documentType, userId, metadata }) => {
    try {
      const session = collaborationService.createSession({
        documentId,
        documentType,
        userId,
        metadata,
      });
      return { success: true, session };
    } catch (error) {
      logError('[collab-ipc] 创建会话失败', error);
      return { success: false, error: error.message };
    }
  });

  /**
   * 获取会话信息
   */
  ipcMain.handle('collaboration:getSession', async (event, { sessionId }) => {
    try {
      const session = collaborationService.getSession(sessionId);
      return { success: true, session };
    } catch (error) {
      logError('[collab-ipc] 获取会话失败', error);
      return { success: false, error: error.message };
    }
  });

  /**
   * 获取文档的活跃会话
   */
  ipcMain.handle('collaboration:getActiveSession', async (event, { documentId, documentType }) => {
    try {
      const session = collaborationService.getActiveSession(documentId, documentType);
      return { success: true, session };
    } catch (error) {
      logError('[collab-ipc] 获取活跃会话失败', error);
      return { success: false, error: error.message };
    }
  });

  /**
   * 关闭会话
   */
  ipcMain.handle('collaboration:closeSession', async (event, { sessionId }) => {
    try {
      collaborationService.closeSession(sessionId);
      return { success: true };
    } catch (error) {
      logError('[collab-ipc] 关闭会话失败', error);
      return { success: false, error: error.message };
    }
  });

  /**
   * 记录操作
   */
  ipcMain.handle('collaboration:recordOperation', async (event, { sessionId, userId, userName, operation, baseVersion }) => {
    try {
      const result = collaborationService.recordOperation({
        sessionId,
        userId,
        userName,
        operation,
        baseVersion,
      });
      return { success: true, operation: result };
    } catch (error) {
      logError('[collab-ipc] 记录操作失败', error);
      return { success: false, error: error.message };
    }
  });

  /**
   * 获取操作历史
   */
  ipcMain.handle('collaboration:getOperations', async (event, { sessionId, fromVersion, limit }) => {
    try {
      const operations = collaborationService.getOperations(sessionId, fromVersion, limit);
      return { success: true, operations };
    } catch (error) {
      logError('[collab-ipc] 获取操作历史失败', error);
      return { success: false, error: error.message };
    }
  });

  /**
   * 更新光标位置
   */
  ipcMain.handle('collaboration:updateCursor', async (event, { sessionId, userId, cursor }) => {
    try {
      collaborationService.updateCursor({ sessionId, userId, cursor });
      return { success: true };
    } catch (error) {
      logError('[collab-ipc] 更新光标失败', error);
      return { success: false, error: error.message };
    }
  });

  /**
   * 获取所有光标位置
   */
  ipcMain.handle('collaboration:getCursors', async (event, { sessionId }) => {
    try {
      const cursors = collaborationService.getCursors(sessionId);
      return { success: true, cursors };
    } catch (error) {
      logError('[collab-ipc] 获取光标失败', error);
      return { success: false, error: error.message };
    }
  });

  /**
   * 获取会话统计
   */
  ipcMain.handle('collaboration:getSessionStats', async (event, { sessionId }) => {
    try {
      const stats = collaborationService.getSessionStats(sessionId);
      return { success: true, stats };
    } catch (error) {
      logError('[collab-ipc] 获取统计失败', error);
      return { success: false, error: error.message };
    }
  });

  /**
   * 获取 WebSocket 状态
   */
  ipcMain.handle('collaboration:getWsStatus', async (event) => {
    try {
      const status = websocketService.getStatus();
      return { success: true, status };
    } catch (error) {
      logError('[collab-ipc] 获取WS状态失败', error);
      return { success: false, error: error.message };
    }
  });

  logInfo('[collab-ipc] 协同编辑 IPC 已注册');
}

module.exports = { registerCollaborationIpc };
