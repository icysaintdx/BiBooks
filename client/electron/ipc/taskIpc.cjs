const { ipcMain } = require('electron');

function registerTaskIpc({ taskService, competitiveAnalysisService, complianceCheckService }) {
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
      return competitiveAnalysisService.generateReport(payload);
    });
  }

  // 合规性检查（同步调用，基于已有数据生成报告）
  if (complianceCheckService) {
    ipcMain.handle('compliance-check:check', (event, payload) => {
      return complianceCheckService.check(payload);
    });
    ipcMain.handle('compliance-check:get-rules', () => {
      return complianceCheckService.getRules();
    });
  }
}

module.exports = { registerTaskIpc };
