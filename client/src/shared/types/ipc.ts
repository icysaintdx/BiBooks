import type { ChatCompletionRequest, JsonCompletionRequest } from './ai';
import type { DuplicateCheckWorkspaceState, FileSelectionResult } from './bid';
import type { ClientConfig, ConfigSaveResult, FontImportResult, FontInfo, FontInstallResult, ImageModelTestResult, ModelListResult } from './config';
import type { KnowledgeAnalysisSnapshot, KnowledgeBaseEvent, KnowledgeBaseIndex, KnowledgeBaseMigrationResult, KnowledgeBaseMigrationStatus, KnowledgeBaseMutationResult, KnowledgeBaseStartMatchingResult, KnowledgeBaseUploadResult, KnowledgeDocument, KnowledgeFolder, KnowledgeItem } from '../../features/knowledge-base/types';
import type { RejectionCheckWorkspaceState, RejectionDocumentRole } from '../../features/rejection-check/types';
import type { BidAnalysisTaskState, ContentGenerationOptions, ContentGenerationPlanState, ContentGenerationRuntimeState, ContentGenerationSectionState, GlobalFactGroupState, SourceAnnotation, SourceAnnotationFilter, SourceAnnotationInput, TechnicalPlanState, TechnicalPlanStep } from '../../features/technical-plan/types';
import type { OutlineData, OutlineMode } from './outline';
import type { SectionId } from './navigation';

export interface TaskEvent<TState = unknown, TRejectionCheckState = unknown, TDuplicateCheckState = unknown> {
  task: unknown;
  technicalPlan?: TState;
  technicalPlanPatch?: Partial<TechnicalPlanState>;
  bidItem?: BidAnalysisTaskState;
  outlineData?: OutlineData | null;
  contentSection?: ContentGenerationSectionState;
  contentPlan?: { nodeId: string; value: ContentGenerationPlanState | null };
  contentRuntime?: ContentGenerationRuntimeState;
  rejectionCheck?: TRejectionCheckState;
  duplicateCheck?: TDuplicateCheckState;
}

export interface WordExportProgressEvent {
  requestId?: string;
  phase: 'running' | 'success' | 'error' | 'canceled';
  progress: number;
  message: string;
  warnings?: string[];
}

export interface WordExportResult {
  success: boolean;
  canceled?: boolean;
  path?: string;
  message?: string;
  warnings?: string[];
}

export interface CompetitiveAnalysisReport {
  projectInfo: Record<string, unknown>;
  analysisDate: string;
  scoringOverview: {
    totalScore: number;
    itemCount: number;
    highPriorityCount: number;
    mediumPriorityCount: number;
    lowPriorityCount: number;
  };
  weightDistribution: {
    highPriority: Array<{ id: string; category: string; totalScore: number; percentage: number; subItemCount: number }>;
    mediumPriority: Array<{ id: string; category: string; totalScore: number; percentage: number; subItemCount: number }>;
    lowPriority: Array<{ id: string; category: string; totalScore: number; percentage: number; subItemCount: number }>;
  };
  competitiveStrategies: Array<{
    category: string;
    weight: number;
    priority: 'high' | 'medium' | 'low';
    focusAreas: string[];
    differentiators: string[];
    risks: string[];
  }>;
  industryInsights: {
    scoringWeights: Record<string, number>;
    keyMetrics: string[];
    commonPitfalls: string[];
  } | null;
  recommendations: Array<{
    type: 'critical' | 'strategy' | 'warning' | 'info';
    title: string;
    content: string;
  }>;
}

export interface ComplianceRuleCategory {
  id: string;
  name: string;
  description: string;
  rules: Array<{
    id: string;
    name: string;
    description: string;
    check: string;
    severity: 'critical' | 'major' | 'warning' | 'info';
  }>;
}

export interface ComplianceCheckResult {
  id: string;
  name: string;
  description: string;
  severity: 'critical' | 'major' | 'warning' | 'info';
  status: 'passed' | 'failed' | 'warning' | 'info';
  message: string;
  details: string[];
}

export interface ComplianceCheckCategory {
  id: string;
  name: string;
  description: string;
  rules: ComplianceCheckResult[];
  passedCount: number;
  failedCount: number;
  warningCount: number;
}

export interface ComplianceCheckReport {
  checkDate: string;
  projectName: string;
  score: number;
  summary: {
    total: number;
    passed: number;
    failed: number;
    warning: number;
    info: number;
  };
  categories: ComplianceCheckCategory[];
  recommendations: Array<{
    type: 'critical' | 'warning' | 'info' | 'tip';
    title: string;
    content: string;
    items: string[];
  }>;
}

export interface ProjectAnalysisRecord<TResult = unknown, TInput = unknown> {
  id: string;
  bidProjectId: string;
  type: 'competitive' | 'compliance';
  title: string;
  input: TInput;
  result: TResult;
  createdAt: string;
  updatedAt: string;
}

export interface PrivateKnowledgeCategory {
  id: string;
  name: string;
  description: string;
  icon: string;
  fields: Array<{
    id: string;
    name: string;
    type: string;
    required?: boolean;
    options?: string[];
  }>;
}

export interface PrivateKnowledgeItem {
  id: string;
  category: string;
  title: string;
  data: Record<string, unknown>;
  tags: string[];
  usage_count: number;
  created_at: string;
  updated_at: string;
}

export interface ApiServerStatus {
  isRunning: boolean;
  port: number;
  apiKey: string;
}

export interface LatestReleaseInfo {
  version: string;
  name: string;
  body: string;
  published_at: string;
  html_url: string;
}

export interface UpdateCheckResult {
  enabled: boolean;
  updateAvailable: boolean;
  version?: string;
  downloaded?: boolean;
  failed?: boolean;
  message?: string;
}

export interface BidProjectSummary {
  id: string;
  name: string;
  tenderFileName: string;
  tenderFilePath: string;
  projectDir: string;
  status: string;
  lastSection: SectionId;
  notes: string;
  hasPassword: boolean;
  isUnlocked: boolean;
  deletedAt: string;
  purgeAfter: string;
  createdAt: string;
  updatedAt: string;
  lastOpenedAt: string;
}

export interface ProjectWorkspaceState {
  currentProjectId: string;
  projects: BidProjectSummary[];
  project?: BidProjectSummary;
}

export type RepairTaskStatus = 'open' | 'in_progress' | 'fixed' | 'ignored' | 'needs_review';
export type RepairTaskSeverity = 'critical' | 'major' | 'warning' | 'info';
export type RepairTaskSourceModule = 'delivery_check' | 'pricing' | 'duplicate_check' | 'rejection_check' | 'compliance' | 'commercial_bid' | 'competitive_analysis' | 'manual';
export type RepairTaskTargetType = 'technical_section' | 'pricing_sheet' | 'commercial_section' | 'qualification' | 'project' | 'document';

export interface RepairTaskPatch {
  source?: string;
  chapter?: string;
  sectionId?: string;
  paragraphId?: string;
  field?: string;
  original?: string;
  suggested?: string;
  reason?: string;
  references?: Array<{
    type: 'database' | 'knowledge_base' | 'history_case' | 'file' | 'internet' | 'manual';
    label: string;
    value?: string;
  }>;
  diffs?: Array<{
    type: 'add' | 'remove' | 'modify' | 'move';
    path?: string;
    original?: string;
    suggested?: string;
  }>;
  notes?: string;
}

export interface RepairTask {
  id: string;
  bidProjectId: string;
  sourceModule: RepairTaskSourceModule | string;
  sourceRecordId: string;
  targetType: RepairTaskTargetType | string;
  targetId: string;
  severity: RepairTaskSeverity;
  title: string;
  description: string;
  suggestion: string;
  patch: RepairTaskPatch;
  status: RepairTaskStatus;
  decision: string;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  resolvedAt?: string | null;
}

export type RepairTaskInput = Partial<RepairTask> & {
  title: string;
  sourceModule: RepairTaskSourceModule | string;
  targetType: RepairTaskTargetType | string;
  patch?: RepairTaskPatch;
};

export interface RepairTaskFilter {
  bidProjectId?: string;
  status?: RepairTaskStatus;
  sourceModule?: RepairTaskSourceModule | string;
  targetType?: RepairTaskTargetType | string;
  targetId?: string;
}

export interface TenderFileSelectionResult {
  success: boolean;
  canceled?: boolean;
  filePath?: string;
  fileName?: string;
  suggestedProjectName?: string;
}

export interface VersionSummary {
  id: string;
  name: string;
  description: string;
  step: string;
  outlineNodeCount: number;
  contentWordCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface VersionSaveResult {
  id: string;
  name: string;
  outlineNodeCount: number;
  contentWordCount: number;
  createdAt: string;
}

export interface VersionDetail {
  id: string;
  name: string;
  description: string;
  snapshot: unknown;
  createdAt: string;
}

export interface VersionChangeItem {
  type: 'added' | 'modified' | 'removed';
  id: string;
  title: string;
  fields?: Array<{ field: string; old?: string; new?: string; oldLength?: number; newLength?: number }>;
}

export interface VersionComparison {
  version1: { id: string; name: string; date: string };
  version2: { id: string; name: string; date: string };
  outlineChanges: VersionChangeItem[];
  totalChanges: number;
  addedCount: number;
  modifiedCount: number;
  removedCount: number;
}

export interface YibiaoBridge {
  appName: string;
  platform: string;
  getVersion: () => Promise<string>;
  getLatestVersion: () => Promise<LatestReleaseInfo>;
  openExternal: (url: string) => Promise<{ success: boolean; message?: string }>;
  checkUpdate: () => Promise<UpdateCheckResult>;
  startUpdate: () => Promise<UpdateCheckResult>;
  quitAndInstall: () => Promise<void>;
  onUpdateProgress: (callback: (event: { percent: number }) => void) => () => void;
  onUpdateDownloaded: (callback: (event: { version: string }) => void) => () => void;
  onUpdateError: (callback: (event: { message: string }) => void) => () => void;
  projectWorkspace: {
    list: (options?: { includeDeleted?: boolean }) => Promise<ProjectWorkspaceState>;
    create: (input: Partial<Pick<BidProjectSummary, 'name' | 'tenderFileName' | 'status' | 'lastSection' | 'notes'>> & { tenderSourcePath?: string; password?: string }) => Promise<ProjectWorkspaceState>;
    update: (projectId: string, patch: Partial<Pick<BidProjectSummary, 'name' | 'tenderFileName' | 'status' | 'lastSection' | 'notes'>> & { tenderSourcePath?: string; password?: string }) => Promise<ProjectWorkspaceState>;
    select: (projectId: string, options?: { password?: string }) => Promise<ProjectWorkspaceState>;
    delete: (projectId: string) => Promise<ProjectWorkspaceState>;
    restore: (projectId: string) => Promise<ProjectWorkspaceState>;
    destroy: (projectId: string) => Promise<ProjectWorkspaceState>;
    clearCurrent: () => Promise<ProjectWorkspaceState>;
    selectTenderFile: () => Promise<TenderFileSelectionResult>;
    saveLastSection: (section: SectionId) => Promise<ProjectWorkspaceState>;
  };
  repairTasks: {
    list: (filter?: RepairTaskFilter) => Promise<RepairTask[]>;
    save: (input: RepairTaskInput) => Promise<RepairTask>;
    update: (taskId: string, patch: Partial<RepairTask>) => Promise<RepairTask | null>;
    bulkUpdateStatus: (taskIds: string[], status: RepairTaskStatus, decision?: string) => Promise<{ success: boolean; updated: number }>;
    delete: (taskId: string) => Promise<{ success: boolean }>;
  };
  config: {
    load: () => Promise<ClientConfig>;
    save: (config: ClientConfig) => Promise<ConfigSaveResult>;
    listModels: (config?: ClientConfig) => Promise<ModelListResult>;
    openConfigFolder: () => Promise<{ success: boolean; path: string }>;
    listFonts: () => Promise<{ success: boolean; fontsDir: string; fonts: FontInfo[] }>;
    openFontsFolder: () => Promise<{ success: boolean; path: string }>;
    importFonts: () => Promise<FontImportResult>;
    installFonts: () => Promise<FontInstallResult>;
  };
  ai: {
    chat: (request: ChatCompletionRequest) => Promise<string>;
    requestJson: <TResult = unknown>(request: JsonCompletionRequest) => Promise<TResult>;
    testImageModel: (config: ClientConfig) => Promise<ImageModelTestResult>;
  };
  file: {
    selectDuplicateCheckFiles: (options?: { multiple?: boolean }) => Promise<FileSelectionResult>;
  };
  knowledgeBase: {
    getMigrationStatus: () => Promise<KnowledgeBaseMigrationStatus>;
    migrateLegacy: () => Promise<KnowledgeBaseMigrationResult>;
    list: () => Promise<KnowledgeBaseIndex>;
    createFolder: (name: string) => Promise<KnowledgeFolder>;
    renameFolder: (folderId: string, name: string) => Promise<KnowledgeFolder>;
    deleteFolder: (folderId: string) => Promise<KnowledgeBaseMutationResult>;
    deleteDocument: (documentId: string) => Promise<KnowledgeBaseMutationResult>;
    uploadDocuments: (folderId: string) => Promise<KnowledgeBaseUploadResult>;
    startMatching: (documentId: string, batchSize: number) => Promise<KnowledgeBaseStartMatchingResult>;
    readMarkdown: (documentId: string) => Promise<string>;
    readItems: (documentId: string) => Promise<KnowledgeItem[]>;
    readAnalysis: (documentId: string) => Promise<KnowledgeAnalysisSnapshot>;
    onEvent: (callback: (event: KnowledgeBaseEvent) => void) => () => void;
  };
  technicalPlan: {
    loadState: () => Promise<TechnicalPlanState>;
    importTenderDocument: () => Promise<{ success: boolean; message?: string; state: TechnicalPlanState; markdown: string }>;
    readTenderMarkdown: () => Promise<string>;
    updateStep: (step: TechnicalPlanStep) => Promise<TechnicalPlanState>;
    saveOutlineConfig: (payload: { outlineMode: OutlineMode; referenceKnowledgeDocumentIds: string[] }) => Promise<TechnicalPlanState>;
    saveOutline: (outlineData: OutlineData) => Promise<TechnicalPlanState>;
    saveGlobalFacts: (globalFacts: GlobalFactGroupState[]) => Promise<TechnicalPlanState>;
    saveContentGenerationOptions: (options: ContentGenerationOptions) => Promise<TechnicalPlanState>;
    saveChapterContent: (payload: { nodeId: string; content: string }) => Promise<TechnicalPlanState>;
    listSourceAnnotations: (filter?: SourceAnnotationFilter) => Promise<SourceAnnotation[]>;
    saveSourceAnnotation: (annotation: SourceAnnotationInput) => Promise<SourceAnnotation>;
    approveSourceAnnotation: (annotationId: string, approvedBy?: string) => Promise<SourceAnnotation | null>;
    rejectSourceAnnotation: (annotationId: string, approvedBy?: string) => Promise<SourceAnnotation | null>;
    deleteSourceAnnotation: (annotationId: string) => Promise<{ success: boolean }>;
    clear: () => Promise<{ success: boolean; message?: string; state: TechnicalPlanState }>;
  };
  duplicateCheck: {
    loadState: () => Promise<DuplicateCheckWorkspaceState>;
    saveFiles: (payload: Pick<DuplicateCheckWorkspaceState, 'tenderFile' | 'bidFiles'> & Partial<Pick<DuplicateCheckWorkspaceState, 'step' | 'activeAnalysisTab'>>) => Promise<DuplicateCheckWorkspaceState>;
    saveUiState: (payload: Partial<Pick<DuplicateCheckWorkspaceState, 'step' | 'activeAnalysisTab'>>) => Promise<DuplicateCheckWorkspaceState>;
    updateState: (partial: Partial<DuplicateCheckWorkspaceState>) => Promise<DuplicateCheckWorkspaceState>;
    clear: () => Promise<{ success: boolean; message?: string; state: DuplicateCheckWorkspaceState }>;
  };
  rejectionCheck: {
    loadState: () => Promise<RejectionCheckWorkspaceState>;
    importDocument: (role: RejectionDocumentRole) => Promise<{ success: boolean; message?: string; state: RejectionCheckWorkspaceState }>;
    importTenderFromTechnicalPlan: () => Promise<{ success: boolean; message?: string; state: RejectionCheckWorkspaceState }>;
    removeDocument: (role: RejectionDocumentRole) => Promise<RejectionCheckWorkspaceState>;
    saveUiState: (payload: Partial<Pick<RejectionCheckWorkspaceState, 'step' | 'activeDocumentTab' | 'activeResultTab' | 'activeCheckResultTab' | 'customCheckItems' | 'checkOptions'>>) => Promise<RejectionCheckWorkspaceState>;
    updateState: (partial: Partial<RejectionCheckWorkspaceState>) => Promise<RejectionCheckWorkspaceState>;
    clear: () => Promise<{ success: boolean; message?: string; state: RejectionCheckWorkspaceState }>;
  };
  tasks: {
    startBidAnalysis: (payload: unknown) => Promise<unknown>;
    startOutlineGeneration: (payload: unknown) => Promise<unknown>;
    startGlobalFactsGeneration: (payload: unknown) => Promise<unknown>;
    startContentGeneration: (payload: unknown) => Promise<unknown>;
    startScoringAnalysis: (payload: unknown) => Promise<unknown>;
    pauseContentGeneration: () => Promise<unknown>;
    startRejectionItemsExtraction: (payload: unknown) => Promise<unknown>;
    startRejectionCheck: (payload: unknown) => Promise<unknown>;
    startDuplicateAnalysis: (payload: unknown) => Promise<unknown>;
    getActiveTasks: () => Promise<unknown[]>;
    onTaskEvent: <TState = unknown, TRejectionCheckState = unknown, TDuplicateCheckState = unknown>(callback: (event: TaskEvent<TState, TRejectionCheckState, TDuplicateCheckState>) => void) => () => void;
  };
  versions: {
    list: () => Promise<VersionSummary[]>;
    save: (payload: { name?: string; description?: string }) => Promise<VersionSaveResult>;
    load: (id: string) => Promise<VersionDetail | null>;
    restore: (id: string) => Promise<{ success: boolean; name: string }>;
    delete: (id: string) => Promise<boolean>;
    update: (payload: { id: string; name?: string; description?: string }) => Promise<boolean>;
    compare: (payload: { versionId1: string; versionId2: string }) => Promise<VersionComparison>;
    count: () => Promise<number>;
  };
  competitiveAnalysis: {
    generate: (payload: { scoringAnalysis?: unknown; industryCode?: string; projectInfo?: unknown }) => Promise<{ success: boolean; report?: CompetitiveAnalysisReport; message?: string }>;
    list: () => Promise<Array<ProjectAnalysisRecord<CompetitiveAnalysisReport>>>;
    getLatest: () => Promise<ProjectAnalysisRecord<CompetitiveAnalysisReport> | null>;
    delete: (id: string) => Promise<{ success: boolean }>;
  };
  complianceCheck: {
    check: (payload: { bidAnalysis?: unknown; technicalPlan?: unknown }) => Promise<{ success: boolean; report?: ComplianceCheckReport; message?: string }>;
    list: () => Promise<Array<ProjectAnalysisRecord<ComplianceCheckReport>>>;
    getLatest: () => Promise<ProjectAnalysisRecord<ComplianceCheckReport> | null>;
    delete: (id: string) => Promise<{ success: boolean }>;
    getRules: () => Promise<Record<string, ComplianceRuleCategory>>;
  };
  privateKnowledgeBase: {
    getCategories: () => Promise<Record<string, PrivateKnowledgeCategory>>;
    createItem: (payload: { category: string; title: string; data: Record<string, unknown>; tags?: string[] }) => Promise<PrivateKnowledgeItem>;
    updateItem: (payload: { id: string; updates: { title?: string; data?: Record<string, unknown>; tags?: string[] } }) => Promise<PrivateKnowledgeItem>;
    deleteItem: (id: string) => Promise<boolean>;
    getItem: (id: string) => Promise<PrivateKnowledgeItem | null>;
    listItems: (payload?: { category?: string; keyword?: string }) => Promise<PrivateKnowledgeItem[]>;
    search: (payload: { query: string; category?: string; limit?: number }) => Promise<PrivateKnowledgeItem[]>;
    getRecommendations: (payload: { industry: string; keywords?: string[]; limit?: number }) => Promise<PrivateKnowledgeItem[]>;
    getStatistics: () => Promise<Record<string, { count: number; total_usage: number }>>;
    importItems: (items: Array<{ category: string; title: string; data: Record<string, unknown>; tags?: string[] }>) => Promise<{ success: number; failed: number; errors: Array<{ item: unknown; error: string }> }>;
    exportItems: (category?: string) => Promise<PrivateKnowledgeItem[]>;
  };
  pricing: {
    list: () => Promise<unknown[]>;
    get: (id: string) => Promise<unknown | null>;
    save: (sheet: unknown) => Promise<any>;
    delete: (id: string) => Promise<{ success: boolean }>;
    calculate: (sheet: unknown) => Promise<unknown>;
    exportMarkdown: (sheet: unknown) => Promise<string>;
  };
  apiServer: {
    start: (options?: { port?: number }) => Promise<{ success: boolean; status?: ApiServerStatus; error?: string }>;
    stop: () => Promise<{ success: boolean; status?: ApiServerStatus; error?: string }>;
    getStatus: () => Promise<ApiServerStatus>;
    setApiKey: (key: string) => Promise<{ success: boolean; error?: string }>;
  };
  export: {
    exportWord: (payload: unknown) => Promise<WordExportResult>;
    onWordExportProgress: (callback: (event: WordExportProgressEvent) => void) => () => void;
  };
  commercialBid: {
    list: () => Promise<unknown[]>;
    save: (bid: unknown) => Promise<unknown>;
    delete: (id: string) => Promise<{ success: boolean }>;
    generate: (options: unknown) => Promise<unknown>;
    generatePrice: (options: unknown) => Promise<unknown>;
    generateTerms: (options: unknown) => Promise<unknown>;
    generateQualifications: (options: unknown) => Promise<unknown>;
    generatePerformance: (options: unknown) => Promise<unknown>;
    generateFinancial: (options: unknown) => Promise<unknown>;
    generateService: (options: unknown) => Promise<unknown>;
    generateReport: (commercialBid: unknown) => Promise<string>;
    getSections: () => Promise<unknown>;
    getPriceTemplates: () => Promise<unknown>;
    getQualificationTypes: () => Promise<unknown>;
  };
  bidOpportunity: {
    list: () => Promise<unknown[]>;
    create: (data: unknown) => Promise<unknown>;
    analyze: (opportunity: unknown, analysisData: unknown) => Promise<unknown>;
    generateRecommendation: (analysisResult: unknown) => Promise<unknown>;
    updateStatus: (opportunity: unknown, newStatus: string, notes: string) => Promise<unknown>;
    generateCalendar: (opportunities: unknown[]) => Promise<unknown>;
    analyzeCompetition: (opportunity: unknown, competitors: unknown[]) => Promise<unknown>;
    generateReport: (opportunities: unknown[]) => Promise<string>;
    getStatuses: () => Promise<unknown>;
    getDecisionFactors: () => Promise<unknown>;
    getTenderSources: () => Promise<unknown>;
    delete: (id: string) => Promise<{ success: boolean }>;
  };
  collaboration: {
    createSession: (payload: unknown) => Promise<{ success?: boolean; session?: unknown; error?: string }>;
    joinSession: (payload: unknown) => Promise<{ success?: boolean; session?: unknown; error?: string }>;
    leaveSession: (payload: unknown) => Promise<unknown>;
    getSession: (payload: unknown) => Promise<{ success?: boolean; session?: unknown; error?: string }>;
    closeSession: (payload: unknown) => Promise<unknown>;
    getSessionStats: (payload: unknown) => Promise<{ success?: boolean; stats?: unknown; error?: string }>;
    getWsStatus: () => Promise<{ success?: boolean; status?: unknown; error?: string }>;
    listSessions: () => Promise<unknown[]>;
  };
  env: {
    check: () => Promise<{
      python: { available: boolean; cmd: string | null };
      java: { available: boolean; version: number | null };
      packages: { opendataloader_pdf: boolean; mineru: boolean; pdfplumber: boolean };
    }>;
    install: () => Promise<{ success: boolean; message: string }>;
    onInstallProgress: (callback: (event: { message: string }) => void) => () => void;
  };
  readRuntimeLog: () => Promise<string>;
  getLogPath: () => Promise<string>;
}
