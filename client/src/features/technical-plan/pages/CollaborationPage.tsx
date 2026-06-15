import React, { useState, useEffect, useRef, useCallback } from 'react';
import type { TechnicalPlanState } from '../types';

interface CollaborationUser {
  userId: string;
  userName: string;
  isLocal: boolean;
  cursor?: {
    path: string;
    position: number;
    selection?: { start: number; end: number };
  };
}

interface CollaborationSession {
  id: string;
  documentId: string;
  documentType: string;
  createdBy: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

interface CollaborationPageProps {
  technicalPlan: Partial<TechnicalPlanState>;
  onSessionCreated?: (session: CollaborationSession) => void;
}

function CollaborationPage({ technicalPlan, onSessionCreated }: CollaborationPageProps) {
  const [session, setSession] = useState<CollaborationSession | null>(null);
  const [users, setUsers] = useState<CollaborationUser[]>([]);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [userName, setUserName] = useState('');
  const [sessionStats, setSessionStats] = useState({
    operationCount: 0,
    participantCount: 0,
    latestVersion: 0,
  });

  // 创建协同会话
  const createSession = useCallback(async () => {
    if (!technicalPlan) {
      setError('没有可协同编辑的技术方案');
      return;
    }

    setIsConnecting(true);
    setError(null);

    try {
      const result = await window.yibiao?.collaboration?.createSession({
        documentId: 'current',
        documentType: 'technical_plan',
        userId: userName || 'local-user',
        metadata: {
          projectName: technicalPlan.outlineData?.project_name || '未命名项目',
        },
      });

      if (result?.success && result.session) {
        setSession(result.session as CollaborationSession);
        setIsConnected(true);
        onSessionCreated?.(result.session as CollaborationSession);
      } else {
        setError(result?.error || '创建会话失败');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '创建会话失败');
    } finally {
      setIsConnecting(false);
    }
  }, [technicalPlan, userName, onSessionCreated]);

  // 加入现有会话
  const joinSession = useCallback(async (sessionId: string) => {
    setIsConnecting(true);
    setError(null);

    try {
      const result = await window.yibiao?.collaboration?.getSession({ sessionId });

      if (result?.success && result.session) {
        setSession(result.session as CollaborationSession);
        setIsConnected(true);
      } else {
        setError(result?.error || '加入会话失败');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '加入会话失败');
    } finally {
      setIsConnecting(false);
    }
  }, []);

  // 关闭会话
  const closeSession = useCallback(async () => {
    if (!session) return;

    try {
      await window.yibiao?.collaboration?.closeSession({ sessionId: session.id });
      setSession(null);
      setUsers([]);
      setIsConnected(false);
    } catch (err) {
      console.error('关闭会话失败:', err);
    }
  }, [session]);

  // 获取会话统计
  useEffect(() => {
    if (!session) return;

    const fetchStats = async () => {
      try {
        const result = await window.yibiao?.collaboration?.getSessionStats({
          sessionId: session.id,
        });

        if (result?.success && result.stats) {
          setSessionStats(result.stats as { operationCount: number; participantCount: number; latestVersion: number });
        }
      } catch (err) {
        console.error('获取统计失败:', err);
      }
    };

    fetchStats();
    const interval = setInterval(fetchStats, 5000);

    return () => clearInterval(interval);
  }, [session]);

  // 获取 WebSocket 状态
  useEffect(() => {
    if (!isConnected) return;

    const checkStatus = async () => {
      try {
        const result = await window.yibiao?.collaboration?.getWsStatus();
        if (result?.success && result.status) {
          // 可以更新连接状态等
        }
      } catch (err) {
        console.error('获取状态失败:', err);
      }
    };

    const interval = setInterval(checkStatus, 10000);

    return () => clearInterval(interval);
  }, [isConnected]);

  return (
    <div className="collaboration-page">
      <div className="collaboration-header">
        <h2>协同编辑</h2>
        <p>多人实时协同编辑技术方案</p>
      </div>

      {!isConnected ? (
        <div className="collaboration-setup">
          <div className="setup-form">
            <div className="form-group">
              <label htmlFor="userName">您的昵称</label>
              <input
                id="userName"
                type="text"
                value={userName}
                onChange={(e) => setUserName(e.target.value)}
                placeholder="请输入昵称（可选）"
                className="form-input"
              />
            </div>

            <div className="setup-actions">
              <button
                type="button"
                onClick={createSession}
                disabled={isConnecting}
                className="primary-action"
              >
                {isConnecting ? '创建中...' : '创建新会话'}
              </button>
            </div>
          </div>

          {error && (
            <div className="error-message">
              <span className="error-icon">⚠️</span>
              {error}
            </div>
          )}

          <div className="session-info">
            <h3>如何使用协同编辑？</h3>
            <ol>
              <li>点击"创建新会话"生成协同编辑链接</li>
              <li>将链接分享给团队成员</li>
              <li>成员加入后即可实时协同编辑</li>
              <li>所有修改会自动同步给所有参与者</li>
            </ol>
          </div>
        </div>
      ) : (
        <div className="collaboration-active">
          <div className="session-status">
            <div className="status-indicator">
              <span className={`status-dot ${isConnected ? 'connected' : 'disconnected'}`} />
              <span className="status-text">
                {isConnected ? '已连接' : '未连接'}
              </span>
            </div>

            <div className="session-meta">
              <span className="session-id">会话 ID: {session?.id.slice(0, 8)}...</span>
              <span className="session-time">
                创建时间: {session ? new Date(session.createdAt).toLocaleString('zh-CN') : '-'}
              </span>
            </div>
          </div>

          <div className="participants-section">
            <h3>参与者 ({users.length})</h3>
            <div className="participants-list">
              {users.map((user) => (
                <div key={user.userId} className="participant-item">
                  <span className="participant-avatar">
                    {user.userName.charAt(0).toUpperCase()}
                  </span>
                  <span className="participant-name">
                    {user.userName}
                    {user.isLocal && <span className="local-badge">（您）</span>}
                  </span>
                  {user.cursor && (
                    <span className="participant-cursor">
                      正在编辑: {user.cursor.path}
                    </span>
                  )}
                </div>
              ))}

              {users.length === 0 && (
                <div className="empty-participants">
                  暂无其他参与者
                </div>
              )}
            </div>
          </div>

          <div className="stats-section">
            <h3>协同统计</h3>
            <div className="stats-grid">
              <div className="stat-item">
                <span className="stat-value">{sessionStats.participantCount}</span>
                <span className="stat-label">参与人数</span>
              </div>
              <div className="stat-item">
                <span className="stat-value">{sessionStats.operationCount}</span>
                <span className="stat-label">操作次数</span>
              </div>
              <div className="stat-item">
                <span className="stat-value">{sessionStats.latestVersion}</span>
                <span className="stat-label">当前版本</span>
              </div>
            </div>
          </div>

          <div className="collaboration-actions">
            <button
              type="button"
              onClick={closeSession}
              className="danger-action"
            >
              结束协同会话
            </button>
          </div>

          <div className="collaboration-guide">
            <h3>协同编辑说明</h3>
            <ul>
              <li>所有参与者的修改会实时同步</li>
              <li>光标位置会显示其他参与者的编辑位置</li>
              <li>操作会自动进行冲突处理</li>
              <li>建议在协同编辑前保存当前版本</li>
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}

export default CollaborationPage;
