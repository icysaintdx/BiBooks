/**
 * 协同编辑服务
 * 支持多人实时协同编辑技术方案
 */

const crypto = require('node:crypto');
const { logInfo, logError, logWarn } = require('../utils/logger.cjs');

/**
 * 操作类型常量
 */
const OperationType = {
  INSERT: 'insert',
  DELETE: 'delete',
  REPLACE: 'replace',
  MOVE: 'move',
};

/**
 * 创建协同编辑服务
 */
function createCollaborationService({ db, versionManagementStore }) {
  /**
   * 确保协同编辑表存在
   */
  function ensureTables() {
    db.exec(`
      CREATE TABLE IF NOT EXISTS collaboration_sessions (
        id TEXT PRIMARY KEY,
        document_id TEXT NOT NULL,
        document_type TEXT NOT NULL DEFAULT 'technical_plan',
        created_by TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        is_active INTEGER NOT NULL DEFAULT 1,
        metadata_json TEXT
      );

      CREATE TABLE IF NOT EXISTS collaboration_operations (
        id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        user_name TEXT,
        operation_json TEXT NOT NULL,
        base_version INTEGER NOT NULL,
        result_version INTEGER NOT NULL,
        created_at TEXT NOT NULL,
        FOREIGN KEY (session_id) REFERENCES collaboration_sessions(id)
      );

      CREATE TABLE IF NOT EXISTS collaboration_cursors (
        session_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        cursor_json TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        PRIMARY KEY (session_id, user_id),
        FOREIGN KEY (session_id) REFERENCES collaboration_sessions(id)
      );

      CREATE INDEX IF NOT EXISTS idx_operations_session ON collaboration_operations(session_id);
      CREATE INDEX IF NOT EXISTS idx_operations_version ON collaboration_operations(session_id, result_version);
    `);
  }

  ensureTables();

  /**
   * 创建协同会话
   */
  function createSession({ documentId, documentType = 'technical_plan', userId, metadata = {} }) {
    const id = crypto.randomUUID();
    const timestamp = new Date().toISOString();

    db.prepare(`
      INSERT INTO collaboration_sessions (id, document_id, document_type, created_by, created_at, updated_at, metadata_json)
      VALUES (@id, @document_id, @document_type, @created_by, @created_at, @updated_at, @metadata_json)
    `).run({
      id,
      document_id: documentId,
      document_type: documentType,
      created_by: userId,
      created_at: timestamp,
      updated_at: timestamp,
      metadata_json: JSON.stringify(metadata),
    });

    logInfo(`[collab] 创建协同会话: ${id}, 文档: ${documentId}`);

    return {
      id,
      documentId,
      documentType,
      createdBy: userId,
      createdAt: timestamp,
    };
  }

  /**
   * 获取会话信息
   */
  function getSession(sessionId) {
    const row = db.prepare('SELECT * FROM collaboration_sessions WHERE id = ?').get(sessionId);
    if (!row) return null;

    return {
      id: row.id,
      documentId: row.document_id,
      documentType: row.document_type,
      createdBy: row.created_by,
      isActive: Boolean(row.is_active),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      metadata: row.metadata_json ? JSON.parse(row.metadata_json) : {},
    };
  }

  /**
   * 获取文档的活跃会话
   */
  function getActiveSession(documentId, documentType = 'technical_plan') {
    const row = db.prepare(`
      SELECT * FROM collaboration_sessions
      WHERE document_id = ? AND document_type = ? AND is_active = 1
      ORDER BY created_at DESC LIMIT 1
    `).get(documentId, documentType);

    if (!row) return null;

    return {
      id: row.id,
      documentId: row.document_id,
      documentType: row.document_type,
      createdBy: row.created_by,
      isActive: Boolean(row.is_active),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      metadata: row.metadata_json ? JSON.parse(row.metadata_json) : {},
    };
  }

  /**
   * 关闭会话
   */
  function closeSession(sessionId) {
    const timestamp = new Date().toISOString();

    db.prepare(`
      UPDATE collaboration_sessions
      SET is_active = 0, updated_at = @updated_at
      WHERE id = @id
    `).run({
      id: sessionId,
      updated_at: timestamp,
    });

    // 清除会话光标
    db.prepare('DELETE FROM collaboration_cursors WHERE session_id = ?').run(sessionId);

    logInfo(`[collab] 关闭协同会话: ${sessionId}`);
  }

  /**
   * 记录操作
   */
  function recordOperation({ sessionId, userId, userName, operation, baseVersion }) {
    const id = crypto.randomUUID();
    const timestamp = new Date().toISOString();
    const resultVersion = baseVersion + 1;

    db.prepare(`
      INSERT INTO collaboration_operations (id, session_id, user_id, user_name, operation_json, base_version, result_version, created_at)
      VALUES (@id, @session_id, @user_id, @user_name, @operation_json, @base_version, @result_version, @created_at)
    `).run({
      id,
      session_id: sessionId,
      user_id: userId,
      user_name: userName || '匿名用户',
      operation_json: JSON.stringify(operation),
      base_version: baseVersion,
      result_version: resultVersion,
      created_at: timestamp,
    });

    // 更新会话时间
    db.prepare(`
      UPDATE collaboration_sessions SET updated_at = @updated_at WHERE id = @id
    `).run({
      id: sessionId,
      updated_at: timestamp,
    });

    return {
      id,
      sessionId,
      userId,
      operation,
      baseVersion,
      resultVersion,
      createdAt: timestamp,
    };
  }

  /**
   * 获取操作历史
   */
  function getOperations(sessionId, fromVersion = 0, limit = 100) {
    const rows = db.prepare(`
      SELECT * FROM collaboration_operations
      WHERE session_id = ? AND result_version > ?
      ORDER BY result_version ASC
      LIMIT ?
    `).all(sessionId, fromVersion, limit);

    return rows.map(row => ({
      id: row.id,
      userId: row.user_id,
      userName: row.user_name,
      operation: JSON.parse(row.operation_json),
      baseVersion: row.base_version,
      resultVersion: row.result_version,
      createdAt: row.created_at,
    }));
  }

  /**
   * 更新光标位置
   */
  function updateCursor({ sessionId, userId, cursor }) {
    const timestamp = new Date().toISOString();

    db.prepare(`
      INSERT OR REPLACE INTO collaboration_cursors (session_id, user_id, cursor_json, updated_at)
      VALUES (@session_id, @user_id, @cursor_json, @updated_at)
    `).run({
      session_id: sessionId,
      user_id: userId,
      cursor_json: JSON.stringify(cursor),
      updated_at: timestamp,
    });
  }

  /**
   * 获取所有光标位置
   */
  function getCursors(sessionId) {
    const rows = db.prepare(`
      SELECT * FROM collaboration_cursors WHERE session_id = ?
    `).all(sessionId);

    return rows.map(row => ({
      userId: row.user_id,
      cursor: JSON.parse(row.cursor_json),
      updatedAt: row.updated_at,
    }));
  }

  /**
   * 清除用户光标
   */
  function clearCursor(sessionId, userId) {
    db.prepare(`
      DELETE FROM collaboration_cursors WHERE session_id = ? AND user_id = ?
    `).run(sessionId, userId);
  }

  /**
   * 应用操作转换 (OT)
   * 简化版本：处理基本的插入和删除冲突
   */
  function transformOperation(operation, againstOperation) {
    // 如果操作位置不同，不需要转换
    if (operation.path !== againstOperation.path) {
      return operation;
    }

    const transformed = { ...operation };

    // 插入 vs 插入
    if (operation.type === OperationType.INSERT && againstOperation.type === OperationType.INSERT) {
      if (operation.position >= againstOperation.position) {
        transformed.position += againstOperation.content.length;
      }
    }

    // 插入 vs 删除
    if (operation.type === OperationType.INSERT && againstOperation.type === OperationType.DELETE) {
      if (operation.position > againstOperation.position) {
        transformed.position -= againstOperation.length || 1;
      }
    }

    // 删除 vs 插入
    if (operation.type === OperationType.DELETE && againstOperation.type === OperationType.INSERT) {
      if (operation.position >= againstOperation.position) {
        transformed.position += againstOperation.content.length;
      }
    }

    // 删除 vs 删除
    if (operation.type === OperationType.DELETE && againstOperation.type === OperationType.DELETE) {
      if (operation.position > againstOperation.position) {
        transformed.position -= againstOperation.length || 1;
      }
    }

    return transformed;
  }

  /**
   * 合并操作到文档状态
   */
  function applyOperation(document, operation) {
    const result = JSON.parse(JSON.stringify(document));

    switch (operation.type) {
      case OperationType.INSERT: {
        const { path, position, content } = operation;
        const target = getNestedValue(result, path);
        if (typeof target === 'string') {
          setNestedValue(result, path, target.slice(0, position) + content + target.slice(position));
        }
        break;
      }

      case OperationType.DELETE: {
        const { path, position, length = 1 } = operation;
        const target = getNestedValue(result, path);
        if (typeof target === 'string') {
          setNestedValue(result, path, target.slice(0, position) + target.slice(position + length));
        }
        break;
      }

      case OperationType.REPLACE: {
        const { path, position, length, content } = operation;
        const target = getNestedValue(result, path);
        if (typeof target === 'string') {
          setNestedValue(result, path, target.slice(0, position) + content + target.slice(position + length));
        }
        break;
      }

      case OperationType.MOVE: {
        const { fromPath, toPath } = operation;
        const value = getNestedValue(result, fromPath);
        setNestedValue(result, toPath, value);
        // 可以选择是否删除原位置
        break;
      }

      default:
        logWarn(`[collab] 未知操作类型: ${operation.type}`);
    }

    return result;
  }

  /**
   * 获取嵌套对象值
   */
  function getNestedValue(obj, path) {
    const keys = path.split('.');
    let current = obj;
    for (const key of keys) {
      if (current === undefined || current === null) return undefined;
      current = current[key];
    }
    return current;
  }

  /**
   * 设置嵌套对象值
   */
  function setNestedValue(obj, path, value) {
    const keys = path.split('.');
    let current = obj;
    for (let i = 0; i < keys.length - 1; i++) {
      const key = keys[i];
      if (current[key] === undefined || current[key] === null) {
        current[key] = {};
      }
      current = current[key];
    }
    current[keys[keys.length - 1]] = value;
  }

  /**
   * 获取会话统计
   */
  function getSessionStats(sessionId) {
    const operationCount = db.prepare(`
      SELECT COUNT(*) as count FROM collaboration_operations WHERE session_id = ?
    `).get(sessionId)?.count || 0;

    const participantCount = db.prepare(`
      SELECT COUNT(DISTINCT user_id) as count FROM collaboration_operations WHERE session_id = ?
    `).get(sessionId)?.count || 0;

    const latestVersion = db.prepare(`
      SELECT MAX(result_version) as version FROM collaboration_operations WHERE session_id = ?
    `).get(sessionId)?.version || 0;

    return {
      operationCount,
      participantCount,
      latestVersion,
    };
  }

  /**
   * 清理过期会话
   */
  function cleanupInactiveSessions(maxAgeHours = 24) {
    const cutoff = new Date(Date.now() - maxAgeHours * 60 * 60 * 1000).toISOString();

    const result = db.prepare(`
      UPDATE collaboration_sessions
      SET is_active = 0
      WHERE is_active = 1 AND updated_at < @cutoff
    `).run({ cutoff });

    if (result.changes > 0) {
      logInfo(`[collab] 清理了 ${result.changes} 个过期会话`);
    }

    return result.changes;
  }

  return {
    createSession,
    getSession,
    getActiveSession,
    closeSession,
    recordOperation,
    getOperations,
    updateCursor,
    getCursors,
    clearCursor,
    transformOperation,
    applyOperation,
    getSessionStats,
    cleanupInactiveSessions,
    OperationType,
  };
}

module.exports = {
  createCollaborationService,
  OperationType,
};
