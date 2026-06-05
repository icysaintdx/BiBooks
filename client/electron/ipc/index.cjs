const { ipcMain, shell } = require('electron');
const https = require('node:https');
const { registerAiIpc } = require('./aiIpc.cjs');
const { registerConfigIpc } = require('./configIpc.cjs');
const { registerDuplicateCheckIpc } = require('./duplicateCheckIpc.cjs');
const { registerExportIpc } = require('./exportIpc.cjs');
const { registerFileIpc } = require('./fileIpc.cjs');
const { registerKnowledgeBaseIpc } = require('./knowledgeBaseIpc.cjs');
const { registerRejectionCheckIpc } = require('./rejectionCheckIpc.cjs');
const { registerTaskIpc } = require('./taskIpc.cjs');
const { registerTechnicalPlanIpc } = require('./technicalPlanIpc.cjs');
const { registerVersionManagementIpc } = require('./versionManagementIpc.cjs');
const { registerPrivateKnowledgeBaseIpc } = require('./privateKnowledgeBaseIpc.cjs');
const { registerApiServerIpc } = require('./apiServerIpc.cjs');
const { registerCollaborationIpc } = require('./collaborationIpc.cjs');
const { createAiService } = require('../services/aiService.cjs');
const { createConfigStore } = require('../services/configStore.cjs');
const { createDuplicateCheckService } = require('../services/duplicateCheckService.cjs');
const { createDuplicateCheckStore } = require('../services/duplicateCheckStore.cjs');
const { createExportService } = require('../services/exportService.cjs');
const { createFileService } = require('../services/fileService.cjs');
const { createKnowledgeBaseService } = require('../services/knowledgeBaseService.cjs');
const { createKnowledgeBaseStore } = require('../services/knowledgeBaseStore.cjs');
const { createRejectionCheckStore } = require('../services/rejectionCheckStore.cjs');
const { createSqliteDatabase } = require('../services/sqliteDatabase.cjs');
const { createTaskService } = require('../services/taskService.cjs');
const { createTechnicalPlanStore } = require('../services/technicalPlanStore.cjs');
const { createVersionManagementStore } = require('../services/versionManagement.cjs');
const { createCompetitiveAnalysisService } = require('../services/competitiveAnalysis.cjs');
const { createComplianceCheckService } = require('../services/complianceCheck.cjs');
const { createPrivateKnowledgeBaseService } = require('../services/privateKnowledgeBase.cjs');
const { createApiServer } = require('../services/apiServer.cjs');
const { createCollaborationService } = require('../services/collaborationService.cjs');
const { createWebSocketServer } = require('../services/websocketService.cjs');
const coverGenerator = require('../services/coverGenerator.cjs');
const tocGenerator = require('../services/tocGenerator.cjs');
const { createPlaceholderService } = require('../services/placeholderService.cjs');
const { createTemplateKnowledgeService } = require('../services/templateKnowledgeService.cjs');
const { createDocumentSplitterService } = require('../services/documentSplitterService.cjs');
const { createTaskRetryService } = require('../services/taskRetryService.cjs');
const { createDocxTemplateService } = require('../services/docxTemplateService.cjs');
const { createCommercialBidService } = require('../services/commercialBidService.cjs');
const { createBidOpportunityService } = require('../services/bidOpportunityService.cjs');
const { createBidOpportunityService } = require('../services/bidOpportunityService.cjs');

function normalizeExternalUrl(value) {
  const raw = String(value || '').trim();
  if (!raw) return null;
  const candidate = /^www\./i.test(raw) ? `https://${raw}` : raw;

  try {
    const url = new URL(candidate);
    return ['http:', 'https:'].includes(url.protocol) ? url.toString() : null;
  } catch {
    return null;
  }
}

function registerUnavailableTechnicalPlanIpc(error) {
  const message = `工作区数据库初始化失败：${error?.message || String(error)}`;
  const throwUnavailable = () => {
    throw new Error(message);
  };

  console.error('[ipc] 工作区数据库初始化失败', error);
  [
    'technical-plan:load-state',
    'technical-plan:import-tender-document',
    'technical-plan:read-tender-markdown',
    'technical-plan:update-step',
    'technical-plan:save-outline-config',
    'technical-plan:save-outline',
    'technical-plan:save-global-facts',
    'technical-plan:save-content-generation-options',
    'technical-plan:save-chapter-content',
    'technical-plan:clear',
    'duplicate-check:load-state',
    'duplicate-check:save-files',
    'duplicate-check:save-ui-state',
    'duplicate-check:update-state',
    'duplicate-check:clear',
    'rejection-check:load-state',
    'rejection-check:import-document',
    'rejection-check:import-tender-from-technical-plan',
    'rejection-check:remove-document',
    'rejection-check:save-ui-state',
    'rejection-check:update-state',
    'rejection-check:clear',
    'knowledge-base:get-migration-status',
    'knowledge-base:migrate-legacy',
    'knowledge-base:list',
    'knowledge-base:create-folder',
    'knowledge-base:rename-folder',
    'knowledge-base:delete-folder',
    'knowledge-base:delete-document',
    'knowledge-base:upload-documents',
    'knowledge-base:start-matching',
    'knowledge-base:read-markdown',
    'knowledge-base:read-items',
    'knowledge-base:read-analysis',
    'tasks:start-bid-analysis',
    'tasks:start-outline-generation',
    'tasks:start-global-facts-generation',
    'tasks:start-content-generation',
    'tasks:pause-content-generation',
    'tasks:start-rejection-items-extraction',
    'tasks:start-rejection-check',
    'tasks:start-duplicate-analysis',
    'tasks:get-active',
  ].forEach((channel) => ipcMain.handle(channel, throwUnavailable));
  ipcMain.on('tasks:subscribe', () => {});
}

function registerIpcHandlers({ app, mainWindow, checkAndDownloadUpdate, triggerUpdateDownload, quitAndInstall }) {
  const configStore = createConfigStore(app);
  const aiService = createAiService({ app, configStore });
  const fileService = createFileService({ app, configStore });
  const exportService = createExportService({ configStore });

  registerConfigIpc({ configStore, aiService });
  registerAiIpc({ aiService });
  registerFileIpc({ fileService });
  registerExportIpc({ exportService });

  try {
    const sqliteDatabase = createSqliteDatabase(app);
    const knowledgeBaseStore = createKnowledgeBaseStore({ app, db: sqliteDatabase.db });
    const knowledgeBaseService = createKnowledgeBaseService({ app, aiService, configStore, knowledgeBaseStore });
    const technicalPlanStore = createTechnicalPlanStore({ app, db: sqliteDatabase.db, fileService });
    const duplicateCheckStore = createDuplicateCheckStore({ app, db: sqliteDatabase.db });
    const rejectionCheckStore = createRejectionCheckStore({ app, db: sqliteDatabase.db, fileService, technicalPlanStore });
    const duplicateCheckService = createDuplicateCheckService({ app, configStore, workspaceStore: duplicateCheckStore });
    const taskService = createTaskService({ aiService, technicalPlanStore, rejectionCheckStore, duplicateCheckStore, knowledgeBaseService, duplicateCheckService });
    const versionManagementStore = createVersionManagementStore({ db: sqliteDatabase.db });
    const competitiveAnalysisService = createCompetitiveAnalysisService();
    const complianceCheckService = createComplianceCheckService();
    const privateKnowledgeBaseService = createPrivateKnowledgeBaseService({ db: sqliteDatabase.db });
    const apiServer = createApiServer({
      configStore,
      technicalPlanStore,
      knowledgeBaseService,
      privateKnowledgeBaseService,
      taskService,
      aiService,
    });
    const collaborationService = createCollaborationService({ db: sqliteDatabase.db, versionManagementStore });
    const websocketService = createWebSocketServer({ httpServer: null });
    registerKnowledgeBaseIpc({ knowledgeBaseService });
    registerTechnicalPlanIpc({ technicalPlanStore });
    registerVersionManagementIpc({ versionManagementStore, technicalPlanStore });
    registerDuplicateCheckIpc({ duplicateCheckStore });
    registerRejectionCheckIpc({ rejectionCheckStore });
    registerTaskIpc({ taskService, competitiveAnalysisService, complianceCheckService });
    registerPrivateKnowledgeBaseIpc({ privateKnowledgeBaseService });
    registerApiServerIpc({ apiServer });
    registerCollaborationIpc({ collaborationService, websocketService });
  } catch (error) {
    registerUnavailableTechnicalPlanIpc(error);
  }

  ipcMain.handle('app:get-version', () => app.getVersion());

  // 封面生成 IPC
  ipcMain.handle('cover:generate', async (event, options) => {
    try {
      const result = await dialog.showSaveDialog({
        title: '保存封面文档',
        defaultPath: path.join(app.getPath('documents'), '封面.docx'),
        filters: [{ name: 'Word 文档', extensions: ['docx'] }],
      });
      if (result.canceled || !result.filePath) {
        return { success: false, canceled: true };
      }
      await coverGenerator.generateCoverToFile(options, result.filePath);
      return { success: true, path: result.filePath };
    } catch (error) {
      console.error('[cover] 生成封面失败', error);
      return { success: false, error: error.message };
    }
  });

  // 目录生成 IPC
  ipcMain.handle('toc:generate', async (event, options) => {
    try {
      const result = await dialog.showSaveDialog({
        title: '保存目录文档',
        defaultPath: path.join(app.getPath('documents'), '目录.docx'),
        filters: [{ name: 'Word 文档', extensions: ['docx'] }],
      });
      if (result.canceled || !result.filePath) {
        return { success: false, canceled: true };
      }
      await tocGenerator.generateTocToFile(options, result.filePath);
      return { success: true, path: result.filePath };
    } catch (error) {
      console.error('[toc] 生成目录失败', error);
      return { success: false, error: error.message };
    }
  });

  // 占位符服务 IPC
  const placeholderService = createPlaceholderService();
  ipcMain.handle('placeholder:analyze', (_event, content) => {
    return placeholderService.analyzeContentForPlaceholders(content);
  });
  ipcMain.handle('placeholder:analyze-chapters', (_event, chapters) => {
    return placeholderService.analyzeChapters(chapters);
  });
  ipcMain.handle('placeholder:auto-insert', (_event, content) => {
    return placeholderService.autoInsertPlaceholders(content);
  });
  ipcMain.handle('placeholder:list', (_event, type) => {
    if (type) return placeholderService.listPlaceholdersByType(type);
    return placeholderService.listPlaceholders();
  });
  ipcMain.handle('placeholder:insert', (_event, content, name, position) => {
    return placeholderService.insertPlaceholder(content, name, position);
  });

  // 模板知识服务 IPC
  const templateKnowledgeService = createTemplateKnowledgeService();
  ipcMain.handle('template:list-industries', () => {
    return templateKnowledgeService.listIndustryTemplates();
  });
  ipcMain.handle('template:get-industry', (_event, industryCode) => {
    return templateKnowledgeService.getIndustryTemplate(industryCode);
  });
  ipcMain.handle('template:get-common', () => {
    return templateKnowledgeService.getCommonTemplate();
  });
  ipcMain.handle('template:generate-outline', (_event, industryCode) => {
    return templateKnowledgeService.generateTemplateOutline(industryCode);
  });
  ipcMain.handle('template:get-reference', (_event, industryCode) => {
    return templateKnowledgeService.generateTemplateReferencePrompt(industryCode);
  });

  // 文档拆分服务 IPC
  const documentSplitterService = createDocumentSplitterService();
  ipcMain.handle('document-splitter:extract', async (_event, filePath) => {
    return documentSplitterService.extractDocumentBlocks(filePath);
  });
  ipcMain.handle('document-splitter:split', async (_event, filePath) => {
    return documentSplitterService.splitDocumentBySections(filePath);
  });
  ipcMain.handle('document-splitter:extract-info', async (_event, sections) => {
    return documentSplitterService.extractKeyInformation(sections);
  });
  ipcMain.handle('document-splitter:generate-report', async (_event, splitResult) => {
    return documentSplitterService.generateSplitReport(splitResult);
  });

  // 任务重试服务 IPC
  const taskRetryService = createTaskRetryService();
  ipcMain.handle('task-retry:get-queue-status', () => {
    return taskRetryService.taskQueue.getStatus();
  });
  ipcMain.handle('task-retry:cancel-all', () => {
    taskRetryService.taskQueue.cancelAll();
    return { success: true };
  });
  ipcMain.handle('task-retry:get-config', () => {
    return {
      retry: taskRetryService.DEFAULT_RETRY_CONFIG,
      concurrency: taskRetryService.DEFAULT_CONCURRENCY_CONFIG,
    };
  });

  // 文档模板服务 IPC
  const docxTemplateService = createDocxTemplateService();
  ipcMain.handle('docx-template:process', (_event, template, context) => {
    return docxTemplateService.processTemplate(template, context);
  });
  ipcMain.handle('docx-template:extract-variables', (_event, template) => {
    return docxTemplateService.extractTemplateVariables(template);
  });
  ipcMain.handle('docx-template:validate', (_event, variables, context) => {
    return docxTemplateService.validateTemplateVariables(variables, context);
  });
  ipcMain.handle('docx-template:generate-report', (_event, template, context) => {
    return docxTemplateService.generateTemplateReport(template, context);
  });

  // 商务标服务 IPC
  const commercialBidService = createCommercialBidService();
  ipcMain.handle('commercial-bid:generate', (_event, options) => {
    return commercialBidService.generateCommercialBid(options);
  });
  ipcMain.handle('commercial-bid:generate-price', (_event, options) => {
    return commercialBidService.generatePriceContent(options);
  });
  ipcMain.handle('commercial-bid:generate-terms', (_event, options) => {
    return commercialBidService.generateTermsContent(options);
  });
  ipcMain.handle('commercial-bid:generate-qualifications', (_event, options) => {
    return commercialBidService.generateQualificationsContent(options);
  });
  ipcMain.handle('commercial-bid:generate-performance', (_event, options) => {
    return commercialBidService.generatePerformanceContent(options);
  });
  ipcMain.handle('commercial-bid:generate-financial', (_event, options) => {
    return commercialBidService.generateFinancialContent(options);
  });
  ipcMain.handle('commercial-bid:generate-service', (_event, options) => {
    return commercialBidService.generateServiceContent(options);
  });
  ipcMain.handle('commercial-bid:generate-report', (_event, commercialBid) => {
    return commercialBidService.generateCommercialBidReport(commercialBid);
  });
  ipcMain.handle('commercial-bid:get-sections', () => {
    return commercialBidService.COMMERCIAL_BID_SECTIONS;
  });
  ipcMain.handle('commercial-bid:get-price-templates', () => {
    return commercialBidService.PRICE_TEMPLATES;
  });
  ipcMain.handle('commercial-bid:get-qualification-types', () => {
    return commercialBidService.QUALIFICATION_TYPES;
  });

  // 投标机会服务 IPC
  const bidOpportunityService = createBidOpportunityService();
  ipcMain.handle('bid-opportunity:create', (_event, data) => {
    return bidOpportunityService.createOpportunity(data);
  });
  ipcMain.handle('bid-opportunity:analyze', (_event, opportunity, analysisData) => {
    return bidOpportunityService.analyzeOpportunity(opportunity, analysisData);
  });
  ipcMain.handle('bid-opportunity:generate-recommendation', (_event, analysisResult) => {
    return bidOpportunityService.generateDecisionRecommendation(analysisResult);
  });
  ipcMain.handle('bid-opportunity:update-status', (_event, opportunity, newStatus, notes) => {
    return bidOpportunityService.updateOpportunityStatus(opportunity, newStatus, notes);
  });
  ipcMain.handle('bid-opportunity:generate-calendar', (_event, opportunities) => {
    return bidOpportunityService.generateBidCalendar(opportunities);
  });
  ipcMain.handle('bid-opportunity:analyze-competition', (_event, opportunity, competitors) => {
    return bidOpportunityService.analyzeCompetition(opportunity, competitors);
  });
  ipcMain.handle('bid-opportunity:generate-report', (_event, opportunities) => {
    return bidOpportunityService.generateOpportunityReport(opportunities);
  });
  ipcMain.handle('bid-opportunity:get-statuses', () => {
    return bidOpportunityService.OPPORTUNITY_STATUS;
  });
  ipcMain.handle('bid-opportunity:get-decision-factors', () => {
    return bidOpportunityService.DECISION_FACTORS;
  });
  ipcMain.handle('bid-opportunity:get-tender-sources', () => {
    return bidOpportunityService.TENDER_SOURCES;
  });

  ipcMain.handle('app:open-external', async (_event, url) => {
    const externalUrl = normalizeExternalUrl(url);
    if (!externalUrl) {
      return { success: false, message: '不支持的外部链接' };
    }
    try {
      await shell.openExternal(externalUrl);
      return { success: true };
    } catch (error) {
      const preview = externalUrl.length > 300 ? `${externalUrl.slice(0, 300)}...` : externalUrl;
      console.warn('[app] 打开外部链接失败', { url: preview, message: error.message || String(error) });
      return { success: false, message: '外部链接打开失败' };
    }
  });

  ipcMain.handle('app:get-latest-version', () => {
    return new Promise((resolve, reject) => {
      const url = '';
      if (!url) { resolve({ version: '', name: '', notes: '', url: '' }); return; }
      const request = https.get(url, { headers: { 'User-Agent': 'bibooks-client' } }, (response) => {
        let data = '';
        response.on('data', (chunk) => { data += chunk; });
        response.on('end', () => {
          try {
            const release = JSON.parse(data);
            resolve({
              version: release.tag_name?.replace(/^v/, '') || '',
              name: release.name || '',
              body: release.body || '',
              published_at: release.published_at || '',
              html_url: release.html_url || '',
            });
          } catch (error) {
            reject(new Error('解析 GitHub API 响应失败'));
          }
        });
      });
      request.on('error', (error) => reject(error));
      request.setTimeout(10000, () => {
        request.destroy();
        reject(new Error('请求超时'));
      });
    });
  });
  ipcMain.handle('app:quit-and-install', () => {
    quitAndInstall();
  });

  ipcMain.handle('app:check-update', (event) => {
    const webContents = event.sender;
    return checkAndDownloadUpdate({
      app,
      mainWindow,
      onProgress: (percent) => {
        webContents.send('app:update-progress', { percent });
      },
      onDownloaded: (version) => {
        webContents.send('app:update-downloaded', { version });
      },
      onError: (message) => {
        webContents.send('app:update-error', { message });
      },
    });
  });

  ipcMain.handle('app:start-update', (event) => {
    const webContents = event.sender;
    return triggerUpdateDownload({
      app,
      mainWindow,
      onProgress: (percent) => {
        webContents.send('app:update-progress', { percent });
      },
      onDownloaded: (version) => {
        webContents.send('app:update-downloaded', { version });
      },
      onError: (message) => {
        webContents.send('app:update-error', { message });
      },
    });
  });
}

module.exports = {
  registerIpcHandlers,
};
