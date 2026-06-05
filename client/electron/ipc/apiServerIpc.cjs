/**
 * API 服务器 IPC 处理器
 * 提供 API 服务器的启动、停止、状态查询等控制接口
 */

const { ipcMain } = require('electron');

/**
 * 注册 API 服务器 IPC 处理器
 */
function registerApiServerIpc({ apiServer }) {
  // 启动 API 服务器
  ipcMain.handle('api-server:start', async (_event, options) => {
    try {
      apiServer.start(options);
      return { success: true, status: apiServer.getStatus() };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  // 停止 API 服务器
  ipcMain.handle('api-server:stop', async () => {
    try {
      apiServer.stop();
      return { success: true, status: apiServer.getStatus() };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  // 获取服务器状态
  ipcMain.handle('api-server:get-status', () => {
    return apiServer.getStatus();
  });

  // 设置 API 密钥
  ipcMain.handle('api-server:set-api-key', (_event, key) => {
    try {
      apiServer.setApiKey(key);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });
}

module.exports = { registerApiServerIpc };
