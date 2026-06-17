const { ipcMain } = require('electron');

function registerTaskIpc({ taskService, competitiveAnalysisService, complianceCheckService, projectAnalysisStore }) {
  ipcMain.handle('tasks:start-bid-analysis', (event, payload) => {
    taskService.subscribe(event.sender);
    return taskService.startBidAnalysis(payload);
  });
  ipcMain.handle('tasks:start-outline-generation', (event, payload) => {
    taskService.subscribe(event.sender);
    return taskService.startOutlineGeneration(payload);
  });
  ipcMain.handle('tasks:start-global-facts-generation', (event, payload) => {
    taskService.subscribe(event.sender);
    return taskService.startGlobalFactsGeneration(payload);
  });
  ipcMain.handle('tasks:start-content-generation', (event, payload) => {
    taskService.subscribe(event.sender);
    return taskService.startContentGeneration(payload);
  });
  ipcMain.handle('tasks:start-scoring-analysis', (event, payload) => {
    taskService.subscribe(event.sender);
    return taskService.startScoringAnalysis(payload);
  });
  ipcMain.handle('tasks:pause-content-generation', (event) => {
    taskService.subscribe(event.sender);
    return taskService.pauseContentGeneration();
  });
  ipcMain.handle('tasks:start-rejection-items-extraction', (event, payload) => {
    taskService.subscribe(event.sender);
    return taskService.startRejectionItemsExtraction(payload);
  });
  ipcMain.handle('tasks:start-rejection-check', (event, payload) => {
    taskService.subscribe(event.sender);
    return taskService.startRejectionCheck(payload);
  });
  ipcMain.handle('tasks:start-duplicate-analysis', (event, payload) => {
    taskService.subscribe(event.sender);
    return taskService.startDuplicateAnalysis(payload);
  });
  ipcMain.handle('tasks:get-active', (event) => {
    taskService.subscribe(event.sender);
    return taskService.getActiveTasks();
  });
  ipcMain.on('tasks:subscribe', (event) => {
    taskService.subscribe(event.sender);
  });

  // 竞品分析（同步调用，基于已有数据生成报告）
  if (competitiveAnalysisService) {
    ipcMain.handle('competitive-analysis:generate', (event, payload) => {
      const result = competitiveAnalysisService.generateReport(payload);
      if (result?.success && result.report && projectAnalysisStore) {
        projectAnalysisStore.save({
          type: 'competitive',
          title: payload?.projectInfo?.projectName || result.report.projectInfo?.projectName || '',
          input: payload || {},
          result: result.report,
        });
      }
      return result;
    });
    ipcMain.handle('competitive-analysis:list', () => projectAnalysisStore?.list('competitive') || []);
    ipcMain.handle('competitive-analysis:get-latest', () => projectAnalysisStore?.getLatest('competitive') || null);
    ipcMain.handle('competitive-analysis:delete', (_event, id) => projectAnalysisStore?.remove(id) || { success: false });
  }

  // 合规性检查（同步调用，基于已有数据生成报告）
  if (complianceCheckService) {
    ipcMain.handle('compliance-check:check', (event, payload) => {
      const result = complianceCheckService.check(payload);
      if (result?.success && result.report && projectAnalysisStore) {
        projectAnalysisStore.save({
          type: 'compliance',
          title: result.report.projectName || payload?.bidAnalysis?.projectInfo?.projectName || '',
          input: payload || {},
          result: result.report,
        });
      }
      return result;
    });
    ipcMain.handle('compliance-check:list', () => projectAnalysisStore?.list('compliance') || []);
    ipcMain.handle('compliance-check:get-latest', () => projectAnalysisStore?.getLatest('compliance') || null);
    ipcMain.handle('compliance-check:delete', (_event, id) => projectAnalysisStore?.remove(id) || { success: false });
    ipcMain.handle('compliance-check:get-rules', () => {
      return complianceCheckService.getRules();
    });
  }
}

module.exports = { registerTaskIpc };
