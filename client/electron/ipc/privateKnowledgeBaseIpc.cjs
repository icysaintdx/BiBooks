const { ipcMain } = require('electron');

function registerPrivateKnowledgeBaseIpc({ privateKnowledgeBaseService }) {
  if (!privateKnowledgeBaseService) return;

  // 获取分类定义
  ipcMain.handle('private-kb:get-categories', () => {
    return privateKnowledgeBaseService.getCategories();
  });

  // 创建知识项
  ipcMain.handle('private-kb:create-item', (event, payload) => {
    const { category, title, data, tags } = payload;
    return privateKnowledgeBaseService.createItem(category, title, data, tags);
  });

  // 更新知识项
  ipcMain.handle('private-kb:update-item', (event, payload) => {
    const { id, updates } = payload;
    return privateKnowledgeBaseService.updateItem(id, updates);
  });

  // 删除知识项
  ipcMain.handle('private-kb:delete-item', (event, id) => {
    return privateKnowledgeBaseService.deleteItem(id);
  });

  // 获取单个知识项
  ipcMain.handle('private-kb:get-item', (event, id) => {
    return privateKnowledgeBaseService.getItem(id);
  });

  // 列出知识项
  ipcMain.handle('private-kb:list-items', (event, payload) => {
    const { category, keyword } = payload || {};
    return privateKnowledgeBaseService.listItems(category, keyword);
  });

  // 搜索知识项
  ipcMain.handle('private-kb:search', (event, payload) => {
    const { query, category, limit } = payload || {};
    return privateKnowledgeBaseService.searchItems(query, category, limit);
  });

  // 获取推荐内容
  ipcMain.handle('private-kb:get-recommendations', (event, payload) => {
    const { industry, keywords, limit } = payload || {};
    return privateKnowledgeBaseService.getRecommendations(industry, keywords, limit);
  });

  // 获取统计信息
  ipcMain.handle('private-kb:get-statistics', () => {
    return privateKnowledgeBaseService.getStatistics();
  });

  // 批量导入
  ipcMain.handle('private-kb:import', (event, items) => {
    return privateKnowledgeBaseService.importItems(items);
  });

  // 导出
  ipcMain.handle('private-kb:export', (event, category) => {
    return privateKnowledgeBaseService.exportItems(category);
  });

  // 目录扫描并导入
  ipcMain.handle('private-kb:scan-and-import-directory', (event) => {
    return privateKnowledgeBaseService.scanAndImportDirectory(event.sender);
  });
}

module.exports = { registerPrivateKnowledgeBaseIpc };
