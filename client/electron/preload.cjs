const { contextBridge, ipcRenderer } = require('electron');

const bridge = {
  appName: 'BiBooks 自动标书',
  platform: process.platform,
  getVersion: () => ipcRenderer.invoke('app:get-version'),
  getLatestVersion: () => ipcRenderer.invoke('app:get-latest-version'),
  openExternal: (url) => ipcRenderer.invoke('app:open-external', url),
  checkUpdate: () => ipcRenderer.invoke('app:check-update'),
  startUpdate: () => ipcRenderer.invoke('app:start-update'),
  quitAndInstall: () => ipcRenderer.invoke('app:quit-and-install'),
  onUpdateProgress: (callback) => {
    const listener = (_event, payload) => callback(payload);
    ipcRenderer.on('app:update-progress', listener);
    return () => ipcRenderer.removeListener('app:update-progress', listener);
  },
  onUpdateDownloaded: (callback) => {
    const listener = (_event, payload) => callback(payload);
    ipcRenderer.on('app:update-downloaded', listener);
    return () => ipcRenderer.removeListener('app:update-downloaded', listener);
  },
  onUpdateError: (callback) => {
    const listener = (_event, payload) => callback(payload);
    ipcRenderer.on('app:update-error', listener);
    return () => ipcRenderer.removeListener('app:update-error', listener);
  },
  config: {
    load: () => ipcRenderer.invoke('config:load'),
    save: (config) => ipcRenderer.invoke('config:save', config),
    listModels: (config) => ipcRenderer.invoke('config:list-models', config),
    openConfigFolder: () => ipcRenderer.invoke('config:open-config-folder'),
  },
  ai: {
    chat: (request) => ipcRenderer.invoke('ai:chat', request),
    requestJson: (request) => ipcRenderer.invoke('ai:request-json', request),
    testImageModel: (config) => ipcRenderer.invoke('ai:test-image-model', config),
  },
  file: {
    selectDuplicateCheckFiles: (options) => ipcRenderer.invoke('file:select-duplicate-check-files', options),
  },
  knowledgeBase: {
    getMigrationStatus: () => ipcRenderer.invoke('knowledge-base:get-migration-status'),
    migrateLegacy: () => ipcRenderer.invoke('knowledge-base:migrate-legacy'),
    list: () => ipcRenderer.invoke('knowledge-base:list'),
    createFolder: (name) => ipcRenderer.invoke('knowledge-base:create-folder', name),
    renameFolder: (folderId, name) => ipcRenderer.invoke('knowledge-base:rename-folder', folderId, name),
    deleteFolder: (folderId) => ipcRenderer.invoke('knowledge-base:delete-folder', folderId),
    deleteDocument: (documentId) => ipcRenderer.invoke('knowledge-base:delete-document', documentId),
    uploadDocuments: (folderId) => ipcRenderer.invoke('knowledge-base:upload-documents', folderId),
    startMatching: (documentId, batchSize) => ipcRenderer.invoke('knowledge-base:start-matching', documentId, batchSize),
    readMarkdown: (documentId) => ipcRenderer.invoke('knowledge-base:read-markdown', documentId),
    readItems: (documentId) => ipcRenderer.invoke('knowledge-base:read-items', documentId),
    readAnalysis: (documentId) => ipcRenderer.invoke('knowledge-base:read-analysis', documentId),
    onEvent: (callback) => {
      const listener = (_event, payload) => callback(payload);
      ipcRenderer.on('knowledge-base:event', listener);
      return () => ipcRenderer.removeListener('knowledge-base:event', listener);
    },
  },
  technicalPlan: {
    loadState: () => ipcRenderer.invoke('technical-plan:load-state'),
    importTenderDocument: () => ipcRenderer.invoke('technical-plan:import-tender-document'),
    readTenderMarkdown: () => ipcRenderer.invoke('technical-plan:read-tender-markdown'),
    updateStep: (step) => ipcRenderer.invoke('technical-plan:update-step', step),
    saveOutlineConfig: (payload) => ipcRenderer.invoke('technical-plan:save-outline-config', payload),
    saveOutline: (outlineData) => ipcRenderer.invoke('technical-plan:save-outline', outlineData),
    saveGlobalFacts: (globalFacts) => ipcRenderer.invoke('technical-plan:save-global-facts', globalFacts),
    saveContentGenerationOptions: (options) => ipcRenderer.invoke('technical-plan:save-content-generation-options', options),
    saveChapterContent: (payload) => ipcRenderer.invoke('technical-plan:save-chapter-content', payload),
    clear: () => ipcRenderer.invoke('technical-plan:clear'),
  },
  duplicateCheck: {
    loadState: () => ipcRenderer.invoke('duplicate-check:load-state'),
    saveFiles: (payload) => ipcRenderer.invoke('duplicate-check:save-files', payload),
    saveUiState: (payload) => ipcRenderer.invoke('duplicate-check:save-ui-state', payload),
    updateState: (partial) => ipcRenderer.invoke('duplicate-check:update-state', partial),
    clear: () => ipcRenderer.invoke('duplicate-check:clear'),
  },
  rejectionCheck: {
    loadState: () => ipcRenderer.invoke('rejection-check:load-state'),
    importDocument: (role) => ipcRenderer.invoke('rejection-check:import-document', role),
    importTenderFromTechnicalPlan: () => ipcRenderer.invoke('rejection-check:import-tender-from-technical-plan'),
    removeDocument: (role) => ipcRenderer.invoke('rejection-check:remove-document', role),
    saveUiState: (payload) => ipcRenderer.invoke('rejection-check:save-ui-state', payload),
    updateState: (partial) => ipcRenderer.invoke('rejection-check:update-state', partial),
    clear: () => ipcRenderer.invoke('rejection-check:clear'),
  },
  tasks: {
    startBidAnalysis: (payload) => ipcRenderer.invoke('tasks:start-bid-analysis', payload),
    startOutlineGeneration: (payload) => ipcRenderer.invoke('tasks:start-outline-generation', payload),
    startGlobalFactsGeneration: (payload) => ipcRenderer.invoke('tasks:start-global-facts-generation', payload),
    startContentGeneration: (payload) => ipcRenderer.invoke('tasks:start-content-generation', payload),
    startScoringAnalysis: (payload) => ipcRenderer.invoke('tasks:start-scoring-analysis', payload),
    pauseContentGeneration: () => ipcRenderer.invoke('tasks:pause-content-generation'),
    startRejectionItemsExtraction: (payload) => ipcRenderer.invoke('tasks:start-rejection-items-extraction', payload),
    startRejectionCheck: (payload) => ipcRenderer.invoke('tasks:start-rejection-check', payload),
    startDuplicateAnalysis: (payload) => ipcRenderer.invoke('tasks:start-duplicate-analysis', payload),
    getActiveTasks: () => ipcRenderer.invoke('tasks:get-active'),
    onTaskEvent: (callback) => {
      ipcRenderer.send('tasks:subscribe');
      const listener = (_event, payload) => callback(payload);
      ipcRenderer.on('tasks:event', listener);
      return () => ipcRenderer.removeListener('tasks:event', listener);
    },
  },
  versions: {
    list: () => ipcRenderer.invoke('versions:list'),
    save: (payload) => ipcRenderer.invoke('versions:save', payload),
    load: (id) => ipcRenderer.invoke('versions:load', id),
    restore: (id) => ipcRenderer.invoke('versions:restore', id),
    delete: (id) => ipcRenderer.invoke('versions:delete', id),
    update: (payload) => ipcRenderer.invoke('versions:update', payload),
    compare: (payload) => ipcRenderer.invoke('versions:compare', payload),
    count: () => ipcRenderer.invoke('versions:count'),
  },
  competitiveAnalysis: {
    generate: (payload) => ipcRenderer.invoke('competitive-analysis:generate', payload),
  },
  complianceCheck: {
    check: (payload) => ipcRenderer.invoke('compliance-check:check', payload),
    getRules: () => ipcRenderer.invoke('compliance-check:get-rules'),
  },
  privateKnowledgeBase: {
    getCategories: () => ipcRenderer.invoke('private-kb:get-categories'),
    createItem: (payload) => ipcRenderer.invoke('private-kb:create-item', payload),
    updateItem: (payload) => ipcRenderer.invoke('private-kb:update-item', payload),
    deleteItem: (id) => ipcRenderer.invoke('private-kb:delete-item', id),
    getItem: (id) => ipcRenderer.invoke('private-kb:get-item', id),
    listItems: (payload) => ipcRenderer.invoke('private-kb:list-items', payload),
    search: (payload) => ipcRenderer.invoke('private-kb:search', payload),
    getRecommendations: (payload) => ipcRenderer.invoke('private-kb:get-recommendations', payload),
    getStatistics: () => ipcRenderer.invoke('private-kb:get-statistics'),
    importItems: (items) => ipcRenderer.invoke('private-kb:import', items),
    exportItems: (category) => ipcRenderer.invoke('private-kb:export', category),
  },
  apiServer: {
    start: (options) => ipcRenderer.invoke('api-server:start', options),
    stop: () => ipcRenderer.invoke('api-server:stop'),
    getStatus: () => ipcRenderer.invoke('api-server:get-status'),
    setApiKey: (key) => ipcRenderer.invoke('api-server:set-api-key', key),
  },
  collaboration: {
    createSession: (payload) => ipcRenderer.invoke('collaboration:createSession', payload),
    getSession: (payload) => ipcRenderer.invoke('collaboration:getSession', payload),
    getActiveSession: (payload) => ipcRenderer.invoke('collaboration:getActiveSession', payload),
    closeSession: (payload) => ipcRenderer.invoke('collaboration:closeSession', payload),
    recordOperation: (payload) => ipcRenderer.invoke('collaboration:recordOperation', payload),
    getOperations: (payload) => ipcRenderer.invoke('collaboration:getOperations', payload),
    updateCursor: (payload) => ipcRenderer.invoke('collaboration:updateCursor', payload),
    getCursors: (payload) => ipcRenderer.invoke('collaboration:getCursors', payload),
    getSessionStats: (payload) => ipcRenderer.invoke('collaboration:getSessionStats', payload),
    getWsStatus: () => ipcRenderer.invoke('collaboration:getWsStatus'),
  },
  export: {
    exportWord: (payload) => ipcRenderer.invoke('export:word', payload),
    onWordExportProgress: (callback) => {
      const listener = (_event, payload) => callback(payload);
      ipcRenderer.on('export:word-progress', listener);
      return () => ipcRenderer.removeListener('export:word-progress', listener);
    },
  },
  cover: {
    generate: (options) => ipcRenderer.invoke('cover:generate', options),
  },
  toc: {
    generate: (options) => ipcRenderer.invoke('toc:generate', options),
  },
  placeholder: {
    analyze: (content) => ipcRenderer.invoke('placeholder:analyze', content),
    analyzeChapters: (chapters) => ipcRenderer.invoke('placeholder:analyze-chapters', chapters),
    autoInsert: (content) => ipcRenderer.invoke('placeholder:auto-insert', content),
    list: (type) => ipcRenderer.invoke('placeholder:list', type),
    insert: (content, name, position) => ipcRenderer.invoke('placeholder:insert', content, name, position),
  },
  template: {
    listIndustries: () => ipcRenderer.invoke('template:list-industries'),
    getIndustry: (industryCode) => ipcRenderer.invoke('template:get-industry', industryCode),
    getCommon: () => ipcRenderer.invoke('template:get-common'),
    generateOutline: (industryCode) => ipcRenderer.invoke('template:generate-outline', industryCode),
    getReference: (industryCode) => ipcRenderer.invoke('template:get-reference', industryCode),
  },
  documentSplitter: {
    extract: (filePath) => ipcRenderer.invoke('document-splitter:extract', filePath),
    split: (filePath) => ipcRenderer.invoke('document-splitter:split', filePath),
    extractInfo: (sections) => ipcRenderer.invoke('document-splitter:extract-info', sections),
    generateReport: (splitResult) => ipcRenderer.invoke('document-splitter:generate-report', splitResult),
  },
  taskRetry: {
    getQueueStatus: () => ipcRenderer.invoke('task-retry:get-queue-status'),
    cancelAll: () => ipcRenderer.invoke('task-retry:cancel-all'),
    getConfig: () => ipcRenderer.invoke('task-retry:get-config'),
  },
  docxTemplate: {
    process: (template, context) => ipcRenderer.invoke('docx-template:process', template, context),
    extractVariables: (template) => ipcRenderer.invoke('docx-template:extract-variables', template),
    validate: (variables, context) => ipcRenderer.invoke('docx-template:validate', variables, context),
    generateReport: (template, context) => ipcRenderer.invoke('docx-template:generate-report', template, context),
  },
  commercialBid: {
    generate: (options) => ipcRenderer.invoke('commercial-bid:generate', options),
    generatePrice: (options) => ipcRenderer.invoke('commercial-bid:generate-price', options),
    generateTerms: (options) => ipcRenderer.invoke('commercial-bid:generate-terms', options),
    generateQualifications: (options) => ipcRenderer.invoke('commercial-bid:generate-qualifications', options),
    generatePerformance: (options) => ipcRenderer.invoke('commercial-bid:generate-performance', options),
    generateFinancial: (options) => ipcRenderer.invoke('commercial-bid:generate-financial', options),
    generateService: (options) => ipcRenderer.invoke('commercial-bid:generate-service', options),
    generateReport: (commercialBid) => ipcRenderer.invoke('commercial-bid:generate-report', commercialBid),
    getSections: () => ipcRenderer.invoke('commercial-bid:get-sections'),
    getPriceTemplates: () => ipcRenderer.invoke('commercial-bid:get-price-templates'),
    getQualificationTypes: () => ipcRenderer.invoke('commercial-bid:get-qualification-types'),
  },
  bidOpportunity: {
    create: (data) => ipcRenderer.invoke('bid-opportunity:create', data),
    analyze: (opportunity, analysisData) => ipcRenderer.invoke('bid-opportunity:analyze', opportunity, analysisData),
    generateRecommendation: (analysisResult) => ipcRenderer.invoke('bid-opportunity:generate-recommendation', analysisResult),
    updateStatus: (opportunity, newStatus, notes) => ipcRenderer.invoke('bid-opportunity:update-status', opportunity, newStatus, notes),
    generateCalendar: (opportunities) => ipcRenderer.invoke('bid-opportunity:generate-calendar', opportunities),
    analyzeCompetition: (opportunity, competitors) => ipcRenderer.invoke('bid-opportunity:analyze-competition', opportunity, competitors),
    generateReport: (opportunities) => ipcRenderer.invoke('bid-opportunity:generate-report', opportunities),
    getStatuses: () => ipcRenderer.invoke('bid-opportunity:get-statuses'),
    getDecisionFactors: () => ipcRenderer.invoke('bid-opportunity:get-decision-factors'),
    getTenderSources: () => ipcRenderer.invoke('bid-opportunity:get-tender-sources'),
  },
};

contextBridge.exposeInMainWorld('yibiao', bridge);

contextBridge.exposeInMainWorld('yibiaoClient', {
  appName: bridge.appName,
  platform: bridge.platform,
});
