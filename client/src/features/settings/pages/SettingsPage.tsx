import { useEffect, useState, type ReactNode } from 'react';
import { FloatingToolbar, InputWithAction, useToast } from '../../../shared/ui';
import type { FloatingToolbarGroup } from '../../../shared/ui';
import type { ApiServerStatus, ClientConfig, FileParserProvider, FontInfo, ImageModelConfig, ImageModelProfiles, ImageModelProvider, ImageModelStatus, LayoutTemplateConfig, TextModelConfig, TextModelProfiles, TextModelProvider } from '../../../shared/types';
import type { SettingsPageState } from '../types';

type SettingsTab = 'general' | 'layout-template' | 'text-model' | 'image-model' | 'file-parser' | 'api-server' | 'about';
type UpdateStatus = 'idle' | 'checking' | 'downloading' | 'downloaded' | 'error' | 'disabled';

const settingsTabs: Array<{ id: SettingsTab; label: string }> = [
  { id: 'general', label: '通用' },
  { id: 'layout-template', label: '版式模板' },
  { id: 'text-model', label: '文本模型' },
  { id: 'image-model', label: '生图模型' },
  { id: 'file-parser', label: '文件解析' },
  { id: 'api-server', label: 'API 服务' },
  { id: 'about', label: '关于' },
];

const textModelProviders: Array<{ value: TextModelProvider; label: string; type: 'online' | 'offline' }> = [
  // 在线提供商
  { value: 'jinlong', label: '金龙中转站【推荐】', type: 'online' },
  { value: 'volcengine', label: '火山方舟', type: 'online' },
  { value: 'xiaomi', label: '小米 token plan', type: 'online' },
  { value: 'deepseek', label: 'DeepSeek', type: 'online' },
  { value: 'longcat', label: '龙猫', type: 'online' },
  // 离线提供商（本地模型）
  { value: 'ollama', label: 'Ollama（本地）', type: 'offline' },
  { value: 'lmstudio', label: 'LM Studio（本地）', type: 'offline' },
  { value: 'llamacpp', label: 'llama.cpp（本地）', type: 'offline' },
  { value: 'vllm', label: 'vLLM（本地）', type: 'offline' },
  // 自定义
  { value: 'custom', label: '自定义', type: 'online' },
];

const oldXiaomiBaseUrl = 'https://api.xiaomimimo.com/v1';

const textProviderDefaults: TextModelProfiles = {
  jinlong: { api_key: '', base_url: 'https://jlaudeapi.com/v1', model_name: 'gpt-3.5-turbo', provider_type: 'online' },
  volcengine: { api_key: '', base_url: 'https://ark.cn-beijing.volces.com/api/v3', model_name: '', provider_type: 'online' },
  xiaomi: { api_key: '', base_url: 'https://token-plan-cn.xiaomimimo.com/v1', model_name: '', provider_type: 'online' },
  deepseek: { api_key: '', base_url: 'https://api.deepseek.com', model_name: '', provider_type: 'online' },
  longcat: { api_key: '', base_url: 'https://api.longcat.chat/openai/v1', model_name: '', provider_type: 'online' },
  ollama: { api_key: '', base_url: 'http://localhost:11434/v1', model_name: 'llama3', provider_type: 'offline' },
  lmstudio: { api_key: '', base_url: 'http://localhost:1234/v1', model_name: '', provider_type: 'offline' },
  llamacpp: { api_key: '', base_url: 'http://localhost:8080/v1', model_name: '', provider_type: 'offline' },
  vllm: { api_key: '', base_url: 'http://localhost:8000/v1', model_name: '', provider_type: 'offline' },
  custom: { api_key: '', base_url: '', model_name: '', provider_type: 'online' },
};

const textProviderApiKeyUrls: Partial<Record<TextModelProvider, string>> = {
  jinlong: 'https://jlaudeapi.com/keys',
  volcengine: 'https://console.volcengine.com/ark/region:ark+cn-beijing/apiKey',
  xiaomi: 'https://platform.xiaomimimo.com/console/api-keys',
  deepseek: 'https://platform.deepseek.com/api_keys',
  longcat: 'https://longcat.chat/platform/api_keys',
};

function createDefaultTextModelProfiles(): TextModelProfiles {
  return textModelProviders.reduce((profiles, provider) => ({
    ...profiles,
    [provider.value]: { ...textProviderDefaults[provider.value] },
  }), {} as TextModelProfiles);
}

function normalizeTextModelProfile(provider: TextModelProvider, profile?: Partial<TextModelConfig>): TextModelConfig {
  const defaults = textProviderDefaults[provider];
  const baseUrl = provider === 'custom' ? profile?.base_url ?? defaults.base_url : defaults.base_url;
  return {
    api_key: profile?.api_key ?? defaults.api_key,
    base_url: provider === 'xiaomi' && baseUrl === oldXiaomiBaseUrl ? defaults.base_url : baseUrl,
    model_name: profile?.model_name ?? defaults.model_name,
    provider_type: defaults.provider_type,
  };
}

function normalizeTextModelProfiles(profiles?: Partial<TextModelProfiles>): TextModelProfiles {
  return textModelProviders.reduce((nextProfiles, provider) => ({
    ...nextProfiles,
    [provider.value]: normalizeTextModelProfile(provider.value, profiles?.[provider.value]),
  }), {} as TextModelProfiles);
}

function textProfileFromState(textModel: SettingsPageState['textModel']): TextModelConfig {
  return {
    api_key: textModel.api_key,
    base_url: textModel.provider === 'custom' ? textModel.base_url : textProviderDefaults[textModel.provider].base_url,
    model_name: textModel.model_name,
    provider_type: textProviderDefaults[textModel.provider].provider_type,
  };
}

const imageProviders: Array<{ value: ImageModelProvider; label: string }> = [
  { value: 'jinlong', label: '金龙中转站【推荐】' },
  { value: 'volcengine', label: '火山方舟' },
  { value: 'google-ai-studio', label: 'Google AI Studio' },
  { value: 'custom', label: '自定义 OpenAI-like' },
];

const imageProviderDefaults: ImageModelProfiles = {
  jinlong: {
    provider: 'jinlong',
    base_url: 'https://jlaudeapi.com/v1',
    api_key: '',
    model_name: '',
    status: 'untested',
    tested_at: '',
    last_error: '',
  },
  volcengine: {
    provider: 'volcengine',
    base_url: 'https://ark.cn-beijing.volces.com/api/v3',
    api_key: '',
    model_name: '',
    status: 'untested',
    tested_at: '',
    last_error: '',
  },
  'google-ai-studio': {
    provider: 'google-ai-studio',
    base_url: 'https://generativelanguage.googleapis.com/v1beta',
    api_key: '',
    model_name: 'gemini-3.1-flash-image-preview',
    status: 'untested',
    tested_at: '',
    last_error: '',
  },
  custom: {
    provider: 'custom',
    base_url: '',
    api_key: '',
    model_name: '',
    status: 'untested',
    tested_at: '',
    last_error: '',
  },
};

const imageProviderApiKeyUrls: Record<ImageModelProvider, string> = {
  jinlong: 'https://jlaudeapi.com/keys',
  volcengine: 'https://console.volcengine.com/ark/region:ark+cn-beijing/apiKey',
  'google-ai-studio': 'https://aistudio.google.com/api-keys',
  custom: '',
};

const imageProviderLabels: Record<ImageModelProvider, string> = {
  jinlong: '金龙中转站',
  volcengine: '火山方舟',
  'google-ai-studio': 'Google AI Studio',
  custom: '自定义生图服务',
};

function getImageBaseUrlDescription(provider: ImageModelProvider) {
  if (provider === 'jinlong') return '金龙中转站 OpenAI 兼容接口地址';
  if (provider === 'volcengine') return '火山方舟 OpenAI 兼容接口地址';
  if (provider === 'custom') return '填写兼容 OpenAI /images/generations 的接口地址';
  return 'Google Gemini API REST 地址';
}

function getImageApiKeyDescription(provider: ImageModelProvider) {
  if (provider === 'jinlong') return '用于调用金龙中转站图片生成 API';
  if (provider === 'volcengine') return '用于调用火山方舟图片生成 API';
  if (provider === 'custom') return '用于调用自定义 OpenAI-like 生图接口';
  return '用于调用 Google AI Studio Gemini API';
}

function getImageModelDescription(provider: ImageModelProvider) {
  if (provider === 'jinlong') return '填写金龙中转站已开通的生图模型名称';
  if (provider === 'volcengine') return '填写火山方舟控制台中已开通的模型或推理接入点 ID';
  if (provider === 'custom') return '填写自定义接口支持的生图模型名称';
  return '选择或填写支持图片生成的 Gemini 模型';
}

function getImageModelPlaceholder(provider: ImageModelProvider) {
  if (provider === 'jinlong') return '请输入已开通的生图模型名称';
  if (provider === 'volcengine') return '请输入已开通的模型或推理接入点 ID';
  if (provider === 'custom') return '请输入 OpenAI-like 生图模型名称';
  return 'gemini-3.1-flash-image-preview';
}

function createDefaultImageModelProfiles(): ImageModelProfiles {
  return imageProviders.reduce((profiles, provider) => ({
    ...profiles,
    [provider.value]: { ...imageProviderDefaults[provider.value] },
  }), {} as ImageModelProfiles);
}

function normalizeImageModelProfile(provider: ImageModelProvider, profile?: Partial<ImageModelConfig>): ImageModelConfig {
  const defaults = imageProviderDefaults[provider];
  return {
    provider,
    base_url: provider === 'custom' ? profile?.base_url ?? defaults.base_url : defaults.base_url,
    api_key: profile?.api_key ?? defaults.api_key,
    model_name: profile?.model_name ?? defaults.model_name,
    status: profile?.status ?? defaults.status,
    tested_at: profile?.tested_at ?? defaults.tested_at,
    last_error: profile?.last_error ?? defaults.last_error,
  };
}

function normalizeImageModelProfiles(profiles?: Partial<ImageModelProfiles>): ImageModelProfiles {
  return imageProviders.reduce((nextProfiles, provider) => ({
    ...nextProfiles,
    [provider.value]: normalizeImageModelProfile(provider.value, profiles?.[provider.value]),
  }), {} as ImageModelProfiles);
}

function imageProfileFromState(imageModel: ImageModelConfig): ImageModelConfig {
  return {
    provider: imageModel.provider,
    base_url: imageModel.provider === 'custom' ? imageModel.base_url || '' : imageProviderDefaults[imageModel.provider].base_url,
    api_key: imageModel.api_key,
    model_name: imageModel.model_name,
    status: imageModel.status || 'untested',
    tested_at: imageModel.tested_at || '',
    last_error: imageModel.last_error || '',
  };
}

const imageStatusMeta: Record<ImageModelStatus, { label: string; description: string }> = {
  untested: {
    label: '未测试',
    description: '请点击测试确认当前生图模型可用，正文生成时只有可用状态才会自动配图。',
  },
  available: {
    label: '可用',
    description: '当前生图模型已通过测试，正文生成时会按内容需要自动配图。',
  },
  unavailable: {
    label: '不可用',
    description: '当前生图模型测试失败，正文生成会跳过配图。',
  },
};

const defaultLayoutTemplate: LayoutTemplateConfig = {
  id: 'standard-bid-a4',
  name: '标准投标文件 A4',
  industry: '通用',
  page: {
    size: 'A4',
    margin_top_mm: 25,
    margin_bottom_mm: 25,
    margin_left_mm: 28,
    margin_right_mm: 25,
    gutter_mm: 0,
  },
  header: {
    enabled: true,
    text: '{项目名称}',
    logo_path: '',
  },
  footer: {
    enabled: true,
    text: '{投标单位}',
    page_number_format: '第 {page} 页 / 共 {pages} 页',
  },
  cover: {
    title: '{项目名称}',
    subtitle: '投标文件',
    bidder_label: '投标单位',
    tenderer_label: '招标单位',
    date_label: '日期',
    show_logo_placeholder: false,
    logo_path: '',
  },
  toc: {
    show_page_numbers: true,
    page_number_format: '第 {page} 页 / 共 {pages} 页',
    leader: 'dot',
    max_level: 3,
  },
  preview: {
    show_guides: true,
    show_rulers: true,
  },
  typography: {
    body_font: '宋体',
    body_size_pt: 12,
    line_spacing: 1.5,
    first_line_indent_chars: 2,
  },
  headings: [
    { level: 1, font: '黑体', size_pt: 22, bold: true, alignment: 'center', numbering: '一、' },
    { level: 2, font: '黑体', size_pt: 16, bold: true, alignment: 'left', numbering: '（一）' },
    { level: 3, font: '黑体', size_pt: 14, bold: true, alignment: 'left', numbering: '1.' },
    { level: 4, font: '宋体', size_pt: 12, bold: true, alignment: 'left', numbering: '（1）' },
  ],
  tables: {
    header_fill: 'F1F6FF',
    border_color: 'DCDFF6',
    repeat_header: true,
    allow_page_break: true,
  },
  images: {
    max_width_percent: 92,
    align: 'center',
    caption_enabled: true,
  },
};

function normalizeLayoutTemplate(template?: Partial<LayoutTemplateConfig>): LayoutTemplateConfig {
  const source = template || {};
  return {
    ...defaultLayoutTemplate,
    ...source,
    page: { ...defaultLayoutTemplate.page, ...source.page },
    header: { ...defaultLayoutTemplate.header, ...source.header },
    footer: { ...defaultLayoutTemplate.footer, ...source.footer },
    cover: { ...defaultLayoutTemplate.cover, ...source.cover },
    toc: { ...defaultLayoutTemplate.toc, ...source.toc },
    preview: { ...defaultLayoutTemplate.preview, ...source.preview },
    typography: { ...defaultLayoutTemplate.typography, ...source.typography },
    headings: (source.headings?.length ? source.headings : defaultLayoutTemplate.headings).map((heading: LayoutTemplateConfig['headings'][number], index: number) => ({
      ...defaultLayoutTemplate.headings[Math.min(index, defaultLayoutTemplate.headings.length - 1)],
      ...heading,
    })),
    tables: { ...defaultLayoutTemplate.tables, ...source.tables },
    images: { ...defaultLayoutTemplate.images, ...source.images },
  };
}

function createLayoutTemplateId(name = 'layout-template') {
  return `${name || 'layout-template'}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`
    .replace(/[^\w-]+/g, '-')
    .toLowerCase();
}

function LayoutField({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="layout-field">
      <span className="layout-field-label">{label}</span>
      {children}
      {hint && <small>{hint}</small>}
    </label>
  );
}

function LayoutCheckField({ label, checked, onChange }: { label: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return (
    <label className="layout-field layout-check-field">
      <span className="layout-field-label">{label}</span>
      <span className="inline-check">
        <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
        <span>{checked ? '启用' : '关闭'}</span>
      </span>
    </label>
  );
}

function updateLayoutTemplateField<TGroup extends keyof LayoutTemplateConfig>(
  template: LayoutTemplateConfig,
  group: TGroup,
  patch: Partial<LayoutTemplateConfig[TGroup]>,
): LayoutTemplateConfig {
  return {
    ...template,
    [group]: {
      ...(template[group] as Record<string, unknown>),
      ...patch,
    },
  };
}

function resetImageModelStatus(imageModel: ImageModelConfig): ImageModelConfig {
  return {
    ...imageModel,
    status: 'untested',
    tested_at: '',
    last_error: '',
  };
}

function formatImageTestTime(value?: string) {
  if (!value) {
    return '';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '';
  }

  return date.toLocaleString('zh-CN', { hour12: false });
}

const fileParserProviders: Array<{ value: FileParserProvider; label: string }> = [
  { value: 'auto', label: '智能路由【推荐】（PDF→OpenDataLoader，其他→MinerU本地）' },
  { value: 'local', label: '本地解析' },
  { value: 'opendataloader', label: 'OpenDataLoader PDF（本地增强）' },
  { value: 'mineru-local', label: 'MinerU 本地解析' },
  { value: 'mineru-accurate-api', label: 'MinerU-精准解析 API' },
  { value: 'mineru-agent-api', label: 'MinerU-Agent 轻量解析 API' },
];

const parserOptions = [
  {
    title: '智能路由（推荐）',
    badge: '推荐默认',
    tone: 'primary',
    summary: 'PDF 自动用 OpenDataLoader（基准第一），Word/PPT/图片自动用 MinerU 本地，其余回落本地解析。',
    items: [
      ['依赖', 'Java 11+ + Python + opendataloader-pdf + mineru'],
      ['解析速度', 'PDF极快，其他中等'],
      ['支持格式', 'pdf、docx、pptx、xlsx、png、jpg 等'],
      ['大小/页数', '无限制'],
      ['解析质量', '各格式最优'],
      ['扫描件', 'PDF支持，其他需GPU'],
    ],
  },
  {
    title: '本地解析',
    badge: '推荐默认',
    tone: 'primary',
    summary: '覆盖大多数 Word 和带文字层 PDF，速度快、无调用限制。',
    items: [
      ['依赖', '无需额外安装'],
      ['解析速度', '快'],
      ['支持格式', 'pdf、jpeg、png、docx、doc、wps、ofd'],
      ['大小/页数', '无限制'],
      ['解析质量', '高'],
      ['扫描件', '不支持'],
    ],
  },
  {
    title: 'OpenDataLoader PDF（本地）',
    badge: '基准第一',
    tone: 'accent',
    summary: '基准测评第一（0.907），0.015s/页极速，无需 GPU，需要 Java 11+ 和 Python。',
    items: [
      ['依赖', 'Java 11+ + Python + opendataloader-pdf'],
      ['解析速度', '极快（0.015s/页）'],
      ['支持格式', 'pdf、docx、png、jpg'],
      ['大小/页数', '无限制'],
      ['解析质量', '极高（基准第一）'],
      ['扫描件', '支持（需 hybrid 模式）'],
    ],
  },
  {
    title: 'MinerU 本地解析',
    badge: '高精度本地',
    tone: 'accent',
    summary: '高精度本地解析，支持多格式、表格→HTML、公式→LaTeX，需要 Python。',
    items: [
      ['依赖', 'Python + mineru'],
      ['解析速度', '中等'],
      ['支持格式', 'pdf、docx、pptx、xlsx、png、jpg'],
      ['大小/页数', '无限制'],
      ['解析质量', '极高'],
      ['扫描件', '支持（VLM 模式需 GPU）'],
    ],
  },
  {
    title: 'MinerU 精准解析 API',
    badge: '扫描件兜底',
    tone: 'muted',
    summary: '解析质量高，适合本地解析失败或扫描件质量要求高的文档。',
    items: [
      ['依赖', 'MinerU Token'],
      ['解析速度', '慢'],
      ['支持格式', 'pdf、jpeg、png、docx'],
      ['大小/页数', '≤ 200MB / ≤ 200 页'],
      ['解析质量', '高'],
      ['扫描件', '支持'],
    ],
  },
  {
    title: 'MinerU-Agent 轻量解析 API',
    badge: '轻量备用',
    tone: 'muted',
    summary: '无需 Token 但存在 IP 限频，适合轻量文档的备用解析。',
    items: [
      ['依赖', '无需（IP 限频）'],
      ['解析速度', '中等'],
      ['支持格式', 'pdf、jpeg、png、docx'],
      ['大小/页数', '≤ 10MB / ≤ 20 页'],
      ['解析质量', '中'],
      ['扫描件', '质量差'],
    ],
  },
];

const initialState: SettingsPageState = {
  textModel: {
    provider: 'jinlong',
    ...textProviderDefaults.jinlong,
  },
  textModelProfiles: createDefaultTextModelProfiles(),
  imageModel: {
    ...imageProviderDefaults.jinlong,
  },
  imageModelProfiles: createDefaultImageModelProfiles(),
  fileParser: {
    provider: 'local',
    mineru_token: '',
  },
  layoutTemplate: defaultLayoutTemplate,
  layoutTemplates: [defaultLayoutTemplate],
  general: {
    developer_mode: false,
  },
};

interface SettingsPageProps {
  onDeveloperModeChange?: (developerMode: boolean) => void;
}

function SettingsPage({ onDeveloperModeChange }: SettingsPageProps) {
  const [state, setState] = useState<SettingsPageState>(initialState);
  const [activeTab, setActiveTab] = useState<SettingsTab>('general');
  const [savedConfig, setSavedConfig] = useState<ClientConfig | null>(null);
  const [textModels, setTextModels] = useState<string[]>([]);
  const [imageModels, setImageModels] = useState<string[]>([]);
  const [loadingModels, setLoadingModels] = useState<'text' | 'image' | null>(null);
  const [testingTextModel, setTestingTextModel] = useState(false);
  const [testingImageModel, setTestingImageModel] = useState(false);
  const [imageTestPreview, setImageTestPreview] = useState<{ src: string; title: string } | null>(null);
  const [appVersion, setAppVersion] = useState('');
  const [updateStatus, setUpdateStatus] = useState<UpdateStatus>('idle');
  const [updatePercent, setUpdatePercent] = useState(0);
  const [updateVersion, setUpdateVersion] = useState('');
  const [updateError, setUpdateError] = useState('');
  const [apiServerStatus, setApiServerStatus] = useState<ApiServerStatus | null>(null);
  const [apiServerPort, setApiServerPort] = useState('9800');
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [apiServerLoading, setApiServerLoading] = useState(false);
  const [envStatus, setEnvStatus] = useState<{
    python: { available: boolean; cmd: string | null };
    java: { available: boolean; version: number | null };
    packages: { opendataloader_pdf: boolean; mineru: boolean; pdfplumber: boolean };
  } | null>(null);
  const [envChecking, setEnvChecking] = useState(false);
  const [envInstalling, setEnvInstalling] = useState(false);
  const [envInstallLog, setEnvInstallLog] = useState<string[]>([]);
  const [fontInfos, setFontInfos] = useState<FontInfo[]>([]);
  const [fontsDir, setFontsDir] = useState('');
  const [fontBusy, setFontBusy] = useState<'scan' | 'import' | 'install' | null>(null);
  const { showToast } = useToast();

  useEffect(() => {
    void loadTextConfig();
    void loadFonts();
    void loadApiServerStatus();
    void window.yibiao?.getVersion().then(setAppVersion);

    const unsubs: Array<() => void> = [];
    unsubs.push(
      window.yibiao?.onUpdateProgress(({ percent }) => {
        setUpdateStatus('downloading');
        setUpdatePercent(Math.round(percent));
      }) ?? (() => {})
    );
    unsubs.push(
      window.yibiao?.onUpdateDownloaded(({ version }) => {
        if (version) {
          setUpdateVersion(version);
        }
        setUpdateStatus('downloaded');
      }) ?? (() => {})
    );
    unsubs.push(
      window.yibiao?.onUpdateError(({ message }) => {
        setUpdateStatus('error');
        setUpdateError(message);
      }) ?? (() => {})
    );

    return () => { unsubs.forEach((unsub) => unsub()); };
  }, []);

  const loadTextConfig = async () => {
    try {
      const config = await window.yibiao?.config.load();
      if (!config) {
        return;
      }

      const textModelProfiles = normalizeTextModelProfiles(config.text_model_profiles);
      const activeTextProfile = normalizeTextModelProfile(config.text_model_provider, textModelProfiles[config.text_model_provider]);
      const imageModelProfiles = normalizeImageModelProfiles(config.image_model_profiles);
      const activeImageProfile = normalizeImageModelProfile(config.image_model.provider, config.image_model);
      imageModelProfiles[activeImageProfile.provider] = activeImageProfile;
      const layoutTemplates = (config.layout_templates?.length ? config.layout_templates : [config.layout_template]).map(normalizeLayoutTemplate);
      const layoutTemplate = normalizeLayoutTemplate(config.layout_template || layoutTemplates[0]);

      setState((prev) => ({
        ...prev,
        textModel: {
          provider: config.text_model_provider,
          ...activeTextProfile,
        },
        textModelProfiles,
        imageModel: activeImageProfile,
        imageModelProfiles,
        fileParser: {
          provider: config.file_parser.provider,
          mineru_token: config.file_parser.mineru_token || '',
        },
        layoutTemplate,
        layoutTemplates: layoutTemplates.some((template) => template.id === layoutTemplate.id)
          ? layoutTemplates
          : [layoutTemplate, ...layoutTemplates],
        general: {
          developer_mode: Boolean(config.developer_mode),
        },
      }));
      setSavedConfig(config);
      onDeveloperModeChange?.(Boolean(config.developer_mode));
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '加载客户端配置失败';
      showToast(errorMessage, 'error');
    }
  };

  const getCurrentTextModelProfiles = (): TextModelProfiles => ({
    ...state.textModelProfiles,
    [state.textModel.provider]: textProfileFromState(state.textModel),
  });

  const getCurrentImageModelProfiles = (): ImageModelProfiles => ({
    ...state.imageModelProfiles,
    [state.imageModel.provider]: imageProfileFromState(state.imageModel),
  });

  const createClientConfig = (): ClientConfig => {
    const textModelProfiles = getCurrentTextModelProfiles();
    const activeTextProfile = textModelProfiles[state.textModel.provider];
    const imageModelProfiles = getCurrentImageModelProfiles();
    const activeImageProfile = imageModelProfiles[state.imageModel.provider];

    return {
      text_model_provider: state.textModel.provider,
      text_model_profiles: textModelProfiles,
      api_key: activeTextProfile.api_key,
      base_url: activeTextProfile.base_url,
      model_name: activeTextProfile.model_name,
      image_model: activeImageProfile,
      image_model_profiles: imageModelProfiles,
      file_parser: {
        provider: state.fileParser.provider,
        mineru_token: state.fileParser.mineru_token || '',
      },
      layout_template: state.layoutTemplate,
      layout_templates: state.layoutTemplates.some((template) => template.id === state.layoutTemplate.id)
        ? state.layoutTemplates.map((template) => template.id === state.layoutTemplate.id ? state.layoutTemplate : template)
        : [state.layoutTemplate, ...state.layoutTemplates],
      developer_mode: state.general.developer_mode,
    };
  };

  const checkForUpdates = async () => {
    if (updateStatus === 'checking' || updateStatus === 'downloading') {
      return;
    }

    try {
      setUpdateStatus('checking');
      setUpdatePercent(0);
      setUpdateError('');
      const result = await window.yibiao?.checkUpdate();
      if (!result?.enabled) {
        setUpdateStatus('disabled');
        showToast('开发调试模式不执行自动更新', 'info');
        return;
      }
      if (result.failed) {
        const message = result.message || '检查更新失败';
        setUpdateStatus('error');
        setUpdateError(message);
        showToast(message, 'error');
        return;
      }
      if (!result.updateAvailable) {
        setUpdateStatus('idle');
        showToast('已是最新版本', 'success');
        return;
      }

      const version = result.version || updateVersion;
      setUpdateVersion(version);
      if (result.downloaded) {
        setUpdateStatus('downloaded');
        showToast(`新版本 ${version} 已下载完成，重启后生效`, 'success');
        return;
      }

      setUpdateStatus('idle');
      showToast('发现新版本，但更新包尚未下载完成，请稍后重试', 'info');
    } catch (error) {
      const message = error instanceof Error ? error.message : '检查更新失败';
      setUpdateStatus('error');
      setUpdateError(message);
      showToast(message, 'error');
    }
  };

  const updateImageModelConfig = (partial: Partial<Omit<ImageModelConfig, 'provider'>>, options: { clearModels?: boolean } = {}) => {
    if (options.clearModels) {
      setImageModels([]);
    }

    setState((prev) => ({
      ...prev,
      ...(() => {
        const imageModel = resetImageModelStatus({ ...prev.imageModel, ...partial });
        return {
          imageModel,
          imageModelProfiles: {
            ...prev.imageModelProfiles,
            [prev.imageModel.provider]: imageProfileFromState(imageModel),
          },
        };
      })(),
    }));
  };

  const updateImageModelProvider = (provider: ImageModelProvider) => {
    setImageModels([]);
    setImageTestPreview(null);
    setState((prev) => ({
      ...prev,
      imageModelProfiles: {
        ...prev.imageModelProfiles,
        [prev.imageModel.provider]: imageProfileFromState(prev.imageModel),
      },
      imageModel: normalizeImageModelProfile(provider, prev.imageModelProfiles[provider]),
    }));
  };

  const saveClientConfig = async (config: ClientConfig) => {
    try {
      const result = await window.yibiao?.config.save(config);
      showToast(result?.success ? '配置已保存' : result?.message || '配置保存失败', result?.success ? 'success' : 'error');
      if (result?.success) {
        setSavedConfig(config);
        onDeveloperModeChange?.(Boolean(config.developer_mode));
      }
      return Boolean(result?.success);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '配置保存失败';
      showToast(errorMessage, 'error');
      return false;
    }
  };

  const saveTextConfig = async () => {
    await saveClientConfig(createClientConfig());
  };

  const updateDeveloperMode = (developerMode: boolean) => {
    setState((prev) => ({
      ...prev,
      general: { ...prev.general, developer_mode: developerMode },
    }));
    onDeveloperModeChange?.(developerMode);
  };

  const updateLayoutTemplate = (nextTemplate: LayoutTemplateConfig) => {
    const normalized = normalizeLayoutTemplate(nextTemplate);
    setState((prev) => ({
      ...prev,
      layoutTemplate: normalized,
      layoutTemplates: prev.layoutTemplates.some((template) => template.id === normalized.id)
        ? prev.layoutTemplates.map((template) => template.id === normalized.id ? normalized : template)
        : [normalized, ...prev.layoutTemplates],
    }));
  };

  const patchLayoutTemplate = (patch: Partial<LayoutTemplateConfig>) => {
    updateLayoutTemplate({ ...state.layoutTemplate, ...patch });
  };

  const patchLayoutTemplateGroup = <TGroup extends keyof LayoutTemplateConfig>(
    group: TGroup,
    patch: Partial<LayoutTemplateConfig[TGroup]>,
  ) => {
    updateLayoutTemplate(updateLayoutTemplateField(state.layoutTemplate, group, patch));
  };

  const patchHeadingTemplate = (index: number, patch: Partial<LayoutTemplateConfig['headings'][number]>) => {
    updateLayoutTemplate({
      ...state.layoutTemplate,
      headings: state.layoutTemplate.headings.map((heading: LayoutTemplateConfig['headings'][number], headingIndex: number) => (
        headingIndex === index ? { ...heading, ...patch } : heading
      )),
    });
  };

  const selectLayoutTemplate = (templateId: string) => {
    const nextTemplate = state.layoutTemplates.find((template) => template.id === templateId);
    if (nextTemplate) updateLayoutTemplate(nextTemplate);
  };

  const createBlankLayoutTemplate = () => {
    updateLayoutTemplate({
      ...defaultLayoutTemplate,
      id: createLayoutTemplateId('bid-template'),
      name: `新建版式模板 ${state.layoutTemplates.length + 1}`,
    });
  };

  const duplicateLayoutTemplate = () => {
    updateLayoutTemplate({
      ...state.layoutTemplate,
      id: createLayoutTemplateId(state.layoutTemplate.name),
      name: `${state.layoutTemplate.name || '版式模板'} 副本`,
    });
  };

  const deleteLayoutTemplate = () => {
    if (state.layoutTemplates.length <= 1) {
      showToast('至少保留一个版式模板', 'info');
      return;
    }
    if (!window.confirm(`确认删除版式模板“${state.layoutTemplate.name}”？`)) return;
    setState((prev) => {
      const nextTemplates = prev.layoutTemplates.filter((template) => template.id !== prev.layoutTemplate.id);
      const nextActive = normalizeLayoutTemplate(nextTemplates[0] || defaultLayoutTemplate);
      return {
        ...prev,
        layoutTemplate: nextActive,
        layoutTemplates: nextTemplates.length ? nextTemplates : [nextActive],
      };
    });
  };

  const updateTextModelProvider = (provider: TextModelProvider) => {
    setTextModels([]);
    setState((prev) => ({
      ...prev,
      textModelProfiles: {
        ...prev.textModelProfiles,
        [prev.textModel.provider]: textProfileFromState(prev.textModel),
      },
      textModel: {
        provider,
        ...normalizeTextModelProfile(provider, prev.textModelProfiles[provider]),
      },
    }));
  };

  const updateTextModelConfig = (partial: Partial<TextModelConfig>, options: { clearModels?: boolean } = {}) => {
    if (options.clearModels) {
      setTextModels([]);
    }

    setState((prev) => ({
      ...prev,
      ...(() => {
        const textModel = { ...prev.textModel, ...partial };
        return {
          textModel,
          textModelProfiles: {
            ...prev.textModelProfiles,
            [prev.textModel.provider]: textProfileFromState(textModel),
          },
        };
      })(),
    }));
  };

  const openTextProviderApiKeyPage = async () => {
    const url = textProviderApiKeyUrls[state.textModel.provider];
    if (!url) {
      showToast('自定义服务商没有预置 API Key 获取页面', 'info');
      return;
    }

    try {
      const result = await window.yibiao?.openExternal(url);
      if (result && !result.success) {
        showToast(result.message || '打开 API Key 获取页面失败', 'error');
      }
    } catch (error) {
      showToast(error instanceof Error ? error.message : '打开 API Key 获取页面失败', 'error');
    }
  };

  const openImageProviderApiKeyPage = async () => {
    const url = imageProviderApiKeyUrls[state.imageModel.provider];
    if (!url) {
      showToast('自定义生图服务没有预置 API Key 获取页面', 'info');
      return;
    }

    try {
      const result = await window.yibiao?.openExternal(url);
      if (result && !result.success) {
        showToast(result.message || '打开生图服务 API Key 获取页面失败', 'error');
      }
    } catch (error) {
      showToast(error instanceof Error ? error.message : '打开生图服务 API Key 获取页面失败', 'error');
    }
  };

  const testTextConfig = async () => {
    try {
      setTestingTextModel(true);
      const config = createClientConfig();
      const result = await window.yibiao?.config.save(config);
      if (result?.success) {
        setSavedConfig(config);
      }
      const content = await window.yibiao?.ai.chat({
        messages: [{ role: 'user', content: 'hi' }],
        temperature: 0,
        timeout_ms: 30000,
        timeout_message: '文本模型测试超时，请检查 Base URL、API Key 或模型名称',
        logTitle: '文本模型测试',
      });
      const reply = (content || '').trim();
      showToast(reply ? `测试成功：${reply.slice(0, 160)}` : '测试成功', 'success');
    } catch (error) {
      showToast(error instanceof Error ? error.message : '测试失败', 'error');
    } finally {
      setTestingTextModel(false);
    }
  };

  const saveImageConfig = async () => {
    await saveClientConfig(createClientConfig());
  };

  const testImageConfig = async () => {
    try {
      setTestingImageModel(true);
      const config = createClientConfig();
      const result = await window.yibiao?.ai.testImageModel(config);
      if (!result?.success) {
        throw new Error(result?.message || '生图模型测试失败');
      }
      const testedImageModel: ImageModelConfig = {
        ...config.image_model,
        status: 'available',
        tested_at: new Date().toISOString(),
        last_error: '',
      };
      const testedConfig: ClientConfig = {
        ...config,
        image_model: testedImageModel,
        image_model_profiles: {
          ...config.image_model_profiles,
          [testedImageModel.provider]: testedImageModel,
        },
      };
      await window.yibiao?.config.save(testedConfig);
      setState((prev) => ({
        ...prev,
        imageModel: testedConfig.image_model,
        imageModelProfiles: {
          ...prev.imageModelProfiles,
          [testedConfig.image_model.provider]: imageProfileFromState(testedConfig.image_model),
        },
      }));
      setSavedConfig(testedConfig);
      const previewSrc = result?.image_url || (result?.image_data ? `data:${result.mime_type || 'image/png'};base64,${result.image_data}` : '');

      if (previewSrc) {
        setImageTestPreview({ src: previewSrc, title: `${imageProviderLabels[state.imageModel.provider]} 测试图片` });
      }

      showToast(result?.message || '生图模型测试成功', result?.success ? 'success' : 'error');
    } catch (error) {
      const message = error instanceof Error ? error.message : '生图模型测试失败';
      const config = createClientConfig();
      const failedImageModel: ImageModelConfig = {
        ...config.image_model,
        status: 'unavailable',
        tested_at: new Date().toISOString(),
        last_error: message,
      };
      const failedConfig: ClientConfig = {
        ...config,
        image_model: failedImageModel,
        image_model_profiles: {
          ...config.image_model_profiles,
          [failedImageModel.provider]: failedImageModel,
        },
      };
      await window.yibiao?.config.save(failedConfig).catch(() => undefined);
      setState((prev) => ({
        ...prev,
        imageModel: failedConfig.image_model,
        imageModelProfiles: {
          ...prev.imageModelProfiles,
          [failedConfig.image_model.provider]: imageProfileFromState(failedConfig.image_model),
        },
      }));
      setSavedConfig(failedConfig);
      showToast(message, 'error');
    } finally {
      setTestingImageModel(false);
    }
  };

  const saveFileParserConfig = async () => {
    await saveClientConfig(createClientConfig());
  };

  const checkEnv = async () => {
    setEnvChecking(true);
    try {
      const result = await window.yibiao?.env.check();
      if (result) setEnvStatus(result);
    } catch (error) {
      showToast(error instanceof Error ? error.message : '环境检测失败', 'error');
    } finally {
      setEnvChecking(false);
    }
  };

  const installEnv = async () => {
    setEnvInstalling(true);
    setEnvInstallLog([]);
    const unsub = window.yibiao?.env.onInstallProgress(({ message }) => {
      if (message.trim()) setEnvInstallLog((prev) => [...prev.slice(-200), message.trim()]);
    });
    try {
      const result = await window.yibiao?.env.install();
      showToast(result?.message || '安装完成', result?.success ? 'success' : 'error');
      if (result?.success) void checkEnv();
    } catch (error) {
      showToast(error instanceof Error ? error.message : '安装失败', 'error');
    } finally {
      setEnvInstalling(false);
      unsub?.();
    }
  };

  const openConfigFolder = async () => {
    try {
      await window.yibiao?.config.openConfigFolder();
      showToast('已打开配置文件夹', 'success');
    } catch (error) {
      showToast(error instanceof Error ? error.message : '打开配置文件夹失败', 'error');
    }
  };

  const loadFonts = async () => {
    try {
      setFontBusy('scan');
      const result = await window.yibiao?.config.listFonts();
      setFontInfos(result?.fonts || []);
      setFontsDir(result?.fontsDir || '');
    } catch (error) {
      showToast(error instanceof Error ? error.message : '读取字体列表失败', 'error');
    } finally {
      setFontBusy(null);
    }
  };

  const openFontsFolder = async () => {
    try {
      await window.yibiao?.config.openFontsFolder();
      showToast('已打开字体文件夹', 'success');
    } catch (error) {
      showToast(error instanceof Error ? error.message : '打开字体文件夹失败', 'error');
    }
  };

  const importFonts = async () => {
    try {
      setFontBusy('import');
      const result = await window.yibiao?.config.importFonts();
      setFontInfos(result?.fonts || []);
      setFontsDir(result?.fontsDir || '');
      if (!result?.canceled) {
        showToast(`已导入 ${result?.imported?.length || 0} 个字体文件`, 'success');
      }
    } catch (error) {
      showToast(error instanceof Error ? error.message : '导入字体失败', 'error');
    } finally {
      setFontBusy(null);
    }
  };

  const installFonts = async () => {
    try {
      setFontBusy('install');
      const result = await window.yibiao?.config.installFonts();
      setFontInfos(result?.fonts || []);
      setFontsDir(result?.fontsDir || '');
      showToast(result?.message || '字体安装完成', result?.success ? 'success' : 'info');
    } catch (error) {
      showToast(error instanceof Error ? error.message : '安装字体失败', 'error');
    } finally {
      setFontBusy(null);
    }
  };

  const loadApiServerStatus = async () => {
    try {
      const status = await window.yibiao?.apiServer.getStatus();
      if (status) {
        setApiServerStatus(status);
        setApiServerPort(String(status.port));
      }
    } catch (error) {
      console.error('加载 API 服务器状态失败:', error);
    }
  };

  const handleStartApiServer = async () => {
    setApiServerLoading(true);
    try {
      const result = await window.yibiao?.apiServer.start({ port: parseInt(apiServerPort) || 9800 });
      if (result?.success) {
        setApiServerStatus(result.status || null);
        showToast('API 服务器已启动', 'success');
      } else {
        showToast(result?.error || '启动失败', 'error');
      }
    } catch (error) {
      showToast(error instanceof Error ? error.message : '启动 API 服务器失败', 'error');
    } finally {
      setApiServerLoading(false);
    }
  };

  const handleStopApiServer = async () => {
    setApiServerLoading(true);
    try {
      const result = await window.yibiao?.apiServer.stop();
      if (result?.success) {
        setApiServerStatus(result.status || null);
        showToast('API 服务器已停止', 'success');
      } else {
        showToast(result?.error || '停止失败', 'error');
      }
    } catch (error) {
      showToast(error instanceof Error ? error.message : '停止 API 服务器失败', 'error');
    } finally {
      setApiServerLoading(false);
    }
  };

  const handleSetApiKey = async () => {
    try {
      const result = await window.yibiao?.apiServer.setApiKey(apiKeyInput);
      if (result?.success) {
        showToast('API 密钥已更新', 'success');
        await loadApiServerStatus();
      } else {
        showToast(result?.error || '设置失败', 'error');
      }
    } catch (error) {
      showToast(error instanceof Error ? error.message : '设置 API 密钥失败', 'error');
    }
  };

  const fetchTextModels = async () => {
    try {
      setLoadingModels('text');
      const result = await window.yibiao?.config.listModels(createClientConfig());
      const models = result?.models || [];
      setTextModels(models);
      if (result?.success && models.length > 0) {
        setState((prev) => ({
          ...prev,
          ...(() => {
            const textModel = models.includes(prev.textModel.model_name)
              ? prev.textModel
              : { ...prev.textModel, model_name: models[0] };
            return {
              textModel,
              textModelProfiles: {
                ...prev.textModelProfiles,
                [prev.textModel.provider]: textProfileFromState(textModel),
              },
            };
          })(),
        }));
      }
      showToast(result?.message || `获取到 ${result?.models.length || 0} 个文本模型`, result?.success ? 'success' : 'info');
    } catch (error) {
      showToast(error instanceof Error ? error.message : '获取文本模型失败', 'error');
    } finally {
      setLoadingModels(null);
    }
  };

  const fetchImageModels = async () => {
    try {
      setLoadingModels('image');
      if (state.imageModel.provider === 'jinlong' || state.imageModel.provider === 'custom') {
        const providerLabel = imageProviderLabels[state.imageModel.provider];
        const baseUrl = state.imageModel.provider === 'custom'
          ? state.imageModel.base_url || ''
          : state.imageModel.base_url || imageProviderDefaults[state.imageModel.provider].base_url || '';

        if (!state.imageModel.api_key.trim()) {
          setImageModels([]);
          showToast(`请先填写${providerLabel} API Key`, 'info');
          return;
        }

        if (!baseUrl.trim()) {
          setImageModels([]);
          showToast(`请先填写${providerLabel} Base URL`, 'info');
          return;
        }

        const config = createClientConfig();
        const result = await window.yibiao?.config.listModels({
          ...config,
          api_key: state.imageModel.api_key,
          base_url: baseUrl,
          model_name: state.imageModel.model_name,
        });
        const models = result?.models || [];
        setImageModels(models);
        if (result?.success && models.length > 0) {
          setState((prev) => ({
            ...prev,
            ...(() => {
              const imageModel = models.includes(prev.imageModel.model_name)
                ? prev.imageModel
                : resetImageModelStatus({ ...prev.imageModel, model_name: models[0] });
              return {
                imageModel,
                imageModelProfiles: {
                  ...prev.imageModelProfiles,
                  [prev.imageModel.provider]: imageProfileFromState(imageModel),
                },
              };
            })(),
          }));
        }
        showToast(result?.message || `获取到 ${models.length} 个${providerLabel}模型`, result?.success ? 'success' : 'info');
        return;
      }

      if (state.imageModel.provider === 'volcengine') {
        setImageModels([]);
        showToast('火山方舟请填写控制台中已开通的模型或推理接入点 ID。');
        return;
      }

      if (state.imageModel.provider === 'google-ai-studio') {
        const models = [
          'gemini-3.1-flash-image-preview',
          'gemini-3-pro-image-preview',
          'gemini-2.5-flash-image',
        ];
        setImageModels(models);
        setState((prev) => ({
          ...prev,
          ...(() => {
            const imageModel = models.includes(prev.imageModel.model_name)
              ? prev.imageModel
              : resetImageModelStatus({ ...prev.imageModel, model_name: models[0] });
            return {
              imageModel,
              imageModelProfiles: {
                ...prev.imageModelProfiles,
                [prev.imageModel.provider]: imageProfileFromState(imageModel),
              },
            };
          })(),
        }));
        showToast('已载入 Google AI Studio 生图模型', 'success');
        return;
      }

      setImageModels([]);
      showToast('该服务商模型列表接口暂未接入。');
    } finally {
      setLoadingModels(null);
    }
  };

  const isActiveTabDirty = () => {
    if (!savedConfig) {
      return false;
    }

    if (activeTab === 'text-model') {
      return JSON.stringify({
        provider: state.textModel.provider,
        profiles: getCurrentTextModelProfiles(),
      }) !== JSON.stringify({
        provider: savedConfig.text_model_provider,
        profiles: normalizeTextModelProfiles(savedConfig.text_model_profiles),
      });
    }

    if (activeTab === 'general') {
      return Boolean(state.general.developer_mode) !== Boolean(savedConfig.developer_mode);
    }

    if (activeTab === 'layout-template') {
      return JSON.stringify(state.layoutTemplate) !== JSON.stringify(normalizeLayoutTemplate(savedConfig.layout_template));
    }

    if (activeTab === 'image-model') {
      return JSON.stringify({
        provider: state.imageModel.provider,
        profiles: getCurrentImageModelProfiles(),
      }) !== JSON.stringify({
        provider: savedConfig.image_model.provider,
        profiles: normalizeImageModelProfiles(savedConfig.image_model_profiles),
      });
    }

    if (activeTab === 'file-parser') {
      return JSON.stringify(state.fileParser) !== JSON.stringify(savedConfig.file_parser);
    }

    return false;
  };

  const saveActiveTabConfig = async () => {
    if (activeTab === 'general') {
      await saveClientConfig(createClientConfig());
      return;
    }
    if (activeTab === 'text-model') {
      await saveTextConfig();
      return;
    }
    if (activeTab === 'layout-template') {
      await saveClientConfig(createClientConfig());
      return;
    }
    if (activeTab === 'image-model') {
      await saveImageConfig();
      return;
    }
    if (activeTab === 'file-parser') {
      await saveFileParserConfig();
    }
  };

  const canSaveActiveTab = activeTab === 'general' || activeTab === 'layout-template' || activeTab === 'text-model' || activeTab === 'image-model' || activeTab === 'file-parser';
  const activeTabDirty = isActiveTabDirty();
  const currentTextProviderDefault = textProviderDefaults[state.textModel.provider];
  const imageModelStatus: ImageModelStatus = state.imageModel.status || 'untested';
  const currentImageStatus = imageStatusMeta[imageModelStatus];
  const imageTestTime = formatImageTestTime(state.imageModel.tested_at);
  const settingsToolbarGroups: FloatingToolbarGroup[] = canSaveActiveTab
    ? [
        {
          id: 'settings-save-state',
          actions: [
            {
              id: 'save-state',
              label: activeTabDirty ? '未保存' : '已保存',
              variant: 'ghost',
              disabled: true,
              onClick: () => undefined,
            },
          ],
        },
        {
          id: 'settings-save-action',
          actions: [
            {
              id: 'save',
              label: '保存',
              variant: 'primary',
              disabled: !activeTabDirty,
              tooltip: activeTabDirty ? '保存当前设置' : '当前设置已保存',
              onClick: saveActiveTabConfig,
            },
          ],
        },
      ]
    : [];

  const updateBusy = updateStatus === 'checking' || updateStatus === 'downloading';
  const updateStatusText = (() => {
    if (updateStatus === 'checking') return '正在检查更新...';
    if (updateStatus === 'downloading') return `正在下载 ${updatePercent}%`;
    if (updateStatus === 'downloaded') return updateVersion ? `新版本 ${updateVersion} 已准备好` : '更新已准备好';
    if (updateStatus === 'error') return `更新失败：${updateError || '未知错误'}`;
    if (updateStatus === 'disabled') return '开发调试模式不执行自动更新';
    return '启动后自动检查，每 30 分钟轮询';
  })();

  return (
    <div className="settings-page">
      <div className="settings-page-scroll">
        <div className="settings-tab-shell" role="tablist" aria-label="设置分类">
          {settingsTabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              className={`settings-tab ${activeTab === tab.id ? 'is-active' : ''}`}
              onClick={() => setActiveTab(tab.id)}
              role="tab"
              aria-selected={activeTab === tab.id}
            >
              {tab.label}
            </button>
          ))}
        </div>

      {activeTab === 'general' && (
        <section className="settings-page-section">
          <div className="settings-section-title">
            <span />
            <strong>通用</strong>
          </div>
          <div className="settings-list">
            <div className="settings-row">
              <div className="settings-row-copy">
                <strong>显示语言</strong>
                <span>选择界面的显示语言</span>
              </div>
              <select value="zh-CN" disabled>
                <option value="zh-CN">简体中文</option>
              </select>
            </div>
            <div className="settings-row">
              <div className="settings-row-copy">
                <strong>应用主题</strong>
                <span>切换深色或浅色模式</span>
              </div>
              <select value="system" disabled>
                <option value="system">跟随系统</option>
              </select>
            </div>
            <div className="settings-row">
              <div className="settings-row-copy">
                <strong>侧边栏布局</strong>
                <span>保持当前经典布局，后续可扩展为紧凑布局</span>
              </div>
              <select value="classic" disabled>
                <option value="classic">经典布局</option>
              </select>
            </div>
            <label className="settings-row">
              <div className="settings-row-copy">
                <strong>开发者模式</strong>
                <span>会打乱既有工作流，生成大量日志占用磁盘空间，<strong>非专业人士请勿开启</strong></span>
              </div>
              <span className="settings-switch-control">
                <input
                  type="checkbox"
                  checked={state.general.developer_mode}
                  onChange={(event) => updateDeveloperMode(event.target.checked)}
                />
                <span className="settings-switch-track" aria-hidden="true">
                  <span className="settings-switch-thumb" />
                </span>
              </span>
            </label>
            {state.general.developer_mode && (
              <div className="settings-row">
                <div className="settings-row-copy">
                  <strong>配置文件夹</strong>
                  <span>打开本机配置、工作区缓存和开发者日志所在目录</span>
                </div>
                <div className="settings-action-cell">
                  <button type="button" className="inline-action" onClick={openConfigFolder}>
                    打开配置文件夹
                  </button>
                </div>
              </div>
            )}
          </div>
        </section>
      )}

      {activeTab === 'layout-template' && (
        <section className="settings-page-section">
          <div className="settings-section-title">
            <span />
            <strong>版式模板</strong>
          </div>
          <div className="settings-list">
            <div className="settings-row">
              <div className="settings-row-copy">
                <strong>模板库</strong>
                <span>可以保存多套配置文件。新建项目或导出时选择模板后，页面、标题、正文、表格和图片规则会统一套用。</span>
              </div>
              <div className="settings-control-with-action layout-template-toolbar">
                <select value={state.layoutTemplate.id} onChange={(event) => selectLayoutTemplate(event.target.value)}>
                  {state.layoutTemplates.map((template) => (
                    <option value={template.id} key={template.id}>{template.name}（{template.industry || '通用'}）</option>
                  ))}
                </select>
                <button type="button" className="inline-action" onClick={createBlankLayoutTemplate}>新建</button>
                <button type="button" className="inline-action" onClick={duplicateLayoutTemplate}>复制</button>
                <button type="button" className="inline-action" onClick={deleteLayoutTemplate} disabled={state.layoutTemplates.length <= 1}>删除</button>
              </div>
            </div>
            <div className="module-note-banner">
              字体说明：常用字体可直接填写系统字体名称，例如宋体、仿宋、黑体、楷体。项目也支持自带字体文件夹：<code>client/electron/fonts</code>，可放入 <code>.ttf</code>、<code>.otf</code>、<code>.woff</code>、<code>.woff2</code> 文件；后续导出会优先按模板中填写的字体名称应用。
            </div>
            <div className="settings-row">
              <div className="settings-row-copy">
                <strong>字体文件夹</strong>
                <span>这里管理软件自带字体。导入后可在正文、标题字体输入框中使用字体文件名或字体族名称；安装到系统后，Word/WPS 打开导出文件时显示更稳定。</span>
              </div>
              <div className="layout-font-manager">
                <div className="layout-font-actions">
                  <button type="button" className="inline-action" onClick={() => void loadFonts()} disabled={fontBusy !== null}>
                    {fontBusy === 'scan' ? '扫描中' : '刷新字体'}
                  </button>
                  <button type="button" className="inline-action" onClick={openFontsFolder}>打开文件夹</button>
                  <button type="button" className="inline-action" onClick={importFonts} disabled={fontBusy !== null}>
                    {fontBusy === 'import' ? '导入中' : '导入字体'}
                  </button>
                  <button type="button" className="inline-action primary" onClick={installFonts} disabled={fontBusy !== null || fontInfos.length === 0}>
                    {fontBusy === 'install' ? '安装中' : '安装到系统'}
                  </button>
                </div>
                <small>{fontsDir || '字体目录未读取'}</small>
                <div className="layout-font-list">
                  {fontInfos.length ? fontInfos.map((font) => (
                    <span key={font.filePath} title={font.filePath}>
                      {font.family}
                      <em>{font.installed ? '已安装' : font.extension}</em>
                    </span>
                  )) : <span>未发现字体文件</span>}
                </div>
              </div>
            </div>
            <div className="settings-row">
              <div className="settings-row-copy">
                <strong>公文格式参考</strong>
                <span>用于辅助设置模板，不强制写入正式文件。不同招标文件有专门格式要求时，应优先按招标文件执行。</span>
              </div>
              <div className="official-format-guide">
                <div><strong>A4 页面</strong><span>常见公文参考：上 37mm、下 35mm、左 28mm、右 26mm。</span></div>
                <div><strong>标题</strong><span>常用二号小标宋或等效标题字体，居中。</span></div>
                <div><strong>正文</strong><span>常用三号仿宋，首行缩进 2 字符，固定行距或 1.5 倍行距。</span></div>
                <div><strong>层级</strong><span>常用“一、”“（一）”“1.”“（1）”作为章节编号。</span></div>
              </div>
            </div>
            <label className="settings-row">
              <div className="settings-row-copy">
                <strong>模板名称</strong>
                <span>这套配置文件的名称，例如“政府采购 A4 标准版”“工程施工技术标”。</span>
              </div>
              <input
                type="text"
                value={state.layoutTemplate.name}
                onChange={(event) => patchLayoutTemplate({ name: event.target.value })}
                placeholder="标准投标文件 A4"
              />
            </label>
            <label className="settings-row">
              <div className="settings-row-copy">
                <strong>适用行业</strong>
                <span>用于区分工程、服务、采购、信息化、运维等不同项目类型。</span>
              </div>
              <input
                type="text"
                value={state.layoutTemplate.industry}
                onChange={(event) => patchLayoutTemplate({ industry: event.target.value })}
                placeholder="通用"
              />
            </label>
            <div className="settings-row">
              <div className="settings-row-copy">
                <strong>页面设置</strong>
                <span>控制 Word 页面大小、上下左右页边距和装订线；单位是毫米。</span>
              </div>
              <div className="layout-field-grid">
                <LayoutField label="纸张尺寸">
                  <select value={state.layoutTemplate.page.size} onChange={(event) => patchLayoutTemplateGroup('page', { size: event.target.value as 'A4' | 'A3' })}>
                    <option value="A4">A4</option>
                    <option value="A3">A3</option>
                  </select>
                </LayoutField>
                <LayoutField label="上边距（mm）">
                  <input type="number" value={state.layoutTemplate.page.margin_top_mm} onChange={(event) => patchLayoutTemplateGroup('page', { margin_top_mm: Number(event.target.value) || 0 })} />
                </LayoutField>
                <LayoutField label="下边距（mm）">
                  <input type="number" value={state.layoutTemplate.page.margin_bottom_mm} onChange={(event) => patchLayoutTemplateGroup('page', { margin_bottom_mm: Number(event.target.value) || 0 })} />
                </LayoutField>
                <LayoutField label="左边距（mm）">
                  <input type="number" value={state.layoutTemplate.page.margin_left_mm} onChange={(event) => patchLayoutTemplateGroup('page', { margin_left_mm: Number(event.target.value) || 0 })} />
                </LayoutField>
                <LayoutField label="右边距（mm）">
                  <input type="number" value={state.layoutTemplate.page.margin_right_mm} onChange={(event) => patchLayoutTemplateGroup('page', { margin_right_mm: Number(event.target.value) || 0 })} />
                </LayoutField>
                <LayoutField label="装订线（mm）">
                  <input type="number" value={state.layoutTemplate.page.gutter_mm} onChange={(event) => patchLayoutTemplateGroup('page', { gutter_mm: Number(event.target.value) || 0 })} />
                </LayoutField>
              </div>
            </div>
            <div className="settings-row">
              <div className="settings-row-copy">
                <strong>封面设计</strong>
                <span>控制合并导出的封面标题、字段名称和 Logo 占位。可使用变量：{'{项目名称}'}、{'{投标单位}'}、{'{日期}'}。</span>
              </div>
              <div className="layout-field-grid">
                <LayoutField label="封面主标题" hint="一般使用 {项目名称}">
                  <input type="text" value={state.layoutTemplate.cover.title} onChange={(event) => patchLayoutTemplateGroup('cover', { title: event.target.value })} placeholder="{项目名称}" />
                </LayoutField>
                <LayoutField label="封面副标题" hint="例如 投标文件、技术标、商务标">
                  <input type="text" value={state.layoutTemplate.cover.subtitle} onChange={(event) => patchLayoutTemplateGroup('cover', { subtitle: event.target.value })} placeholder="投标文件" />
                </LayoutField>
                <LayoutField label="投标单位字段名">
                  <input type="text" value={state.layoutTemplate.cover.bidder_label} onChange={(event) => patchLayoutTemplateGroup('cover', { bidder_label: event.target.value })} placeholder="投标单位" />
                </LayoutField>
                <LayoutField label="招标单位字段名">
                  <input type="text" value={state.layoutTemplate.cover.tenderer_label} onChange={(event) => patchLayoutTemplateGroup('cover', { tenderer_label: event.target.value })} placeholder="招标单位" />
                </LayoutField>
                <LayoutField label="日期字段名">
                  <input type="text" value={state.layoutTemplate.cover.date_label} onChange={(event) => patchLayoutTemplateGroup('cover', { date_label: event.target.value })} placeholder="日期" />
                </LayoutField>
                <LayoutField label="封面 Logo 路径" hint="本地图片文件路径，可暂时留空">
                  <input type="text" value={state.layoutTemplate.cover.logo_path} onChange={(event) => patchLayoutTemplateGroup('cover', { logo_path: event.target.value })} placeholder="例如 D:/logo.png" />
                </LayoutField>
                <LayoutCheckField label="显示 Logo 占位" checked={state.layoutTemplate.cover.show_logo_placeholder} onChange={(checked) => patchLayoutTemplateGroup('cover', { show_logo_placeholder: checked })} />
              </div>
            </div>
            <div className="settings-row">
              <div className="settings-row-copy">
                <strong>目录样式</strong>
                <span>控制目录页是否显示页码、Word 原生连接符和目录展示层级。连接符会自动延展到页码位置，不是手工输入点线。</span>
              </div>
              <div className="layout-field-grid">
                <LayoutCheckField label="目录页显示页码" checked={state.layoutTemplate.toc.show_page_numbers} onChange={(checked) => patchLayoutTemplateGroup('toc', { show_page_numbers: checked })} />
                <LayoutField label="目录页码格式" hint="支持 {page} 当前页、{pages} 总页数">
                  <input type="text" value={state.layoutTemplate.toc.page_number_format} onChange={(event) => patchLayoutTemplateGroup('toc', { page_number_format: event.target.value })} placeholder="第 {page} 页 / 共 {pages} 页" />
                </LayoutField>
                <LayoutField label="目录连接符">
                  <select value={state.layoutTemplate.toc.leader} onChange={(event) => patchLayoutTemplateGroup('toc', { leader: event.target.value as LayoutTemplateConfig['toc']['leader'] })}>
                    <option value="dot">点线 ......</option>
                    <option value="hyphen">横线 ------</option>
                    <option value="underscore">下划线 ____</option>
                    <option value="middleDot">中点 ······</option>
                    <option value="none">不显示</option>
                  </select>
                </LayoutField>
                <LayoutField label="目录最大层级">
                  <input type="number" min="1" max="6" value={state.layoutTemplate.toc.max_level} onChange={(event) => patchLayoutTemplateGroup('toc', { max_level: Number(event.target.value) || 3 })} />
                </LayoutField>
                <LayoutCheckField label="预览显示标尺" checked={state.layoutTemplate.preview.show_rulers} onChange={(checked) => patchLayoutTemplateGroup('preview', { show_rulers: checked })} />
                <LayoutCheckField label="预览显示页边距线" checked={state.layoutTemplate.preview.show_guides} onChange={(checked) => patchLayoutTemplateGroup('preview', { show_guides: checked })} />
              </div>
            </div>
            <div className="settings-row">
              <div className="settings-row-copy">
                <strong>页眉</strong>
                <span>控制每页顶部显示内容。可使用变量：{'{项目名称}'}、{'{投标单位}'}。Logo 路径用于后续插入页眉图片。</span>
              </div>
              <div className="layout-field-grid">
                <LayoutCheckField label="显示页眉" checked={state.layoutTemplate.header.enabled} onChange={(checked) => patchLayoutTemplateGroup('header', { enabled: checked })} />
                <LayoutField label="页眉文字" hint="可填 {项目名称}、{投标单位}">
                  <input type="text" value={state.layoutTemplate.header.text} onChange={(event) => patchLayoutTemplateGroup('header', { text: event.target.value })} placeholder="{项目名称}" />
                </LayoutField>
                <LayoutField label="页眉 Logo 路径" hint="本地图片文件路径，可暂时留空">
                  <input type="text" value={state.layoutTemplate.header.logo_path} onChange={(event) => patchLayoutTemplateGroup('header', { logo_path: event.target.value })} placeholder="例如 D:/logo.png" />
                </LayoutField>
              </div>
            </div>
            <div className="settings-row">
              <div className="settings-row-copy">
                <strong>页脚</strong>
                <span>控制每页底部显示内容和页码格式。页码变量：{'{page}'} 当前页，{'{pages}'} 总页数。</span>
              </div>
              <div className="layout-field-grid">
                <LayoutCheckField label="显示页脚" checked={state.layoutTemplate.footer.enabled} onChange={(checked) => patchLayoutTemplateGroup('footer', { enabled: checked })} />
                <LayoutField label="页脚文字" hint="可填 {投标单位} 或项目备注">
                  <input type="text" value={state.layoutTemplate.footer.text} onChange={(event) => patchLayoutTemplateGroup('footer', { text: event.target.value })} placeholder="{投标单位}" />
                </LayoutField>
                <LayoutField label="页码格式" hint="支持 {page} 当前页、{pages} 总页数">
                  <input type="text" value={state.layoutTemplate.footer.page_number_format} onChange={(event) => patchLayoutTemplateGroup('footer', { page_number_format: event.target.value })} placeholder="第 {page} 页 / 共 {pages} 页" />
                </LayoutField>
              </div>
            </div>
            <div className="settings-row">
              <div className="settings-row-copy">
                <strong>正文样式</strong>
                <span>控制普通段落，不影响标题、表格和图片题注。首行缩进按中文字符数计算。</span>
              </div>
              <div className="layout-field-grid">
                <LayoutField label="正文字体" hint="系统字体名或 fonts 文件夹中的字体名">
                  <input type="text" value={state.layoutTemplate.typography.body_font} onChange={(event) => patchLayoutTemplateGroup('typography', { body_font: event.target.value })} placeholder="宋体" />
                </LayoutField>
                <LayoutField label="正文字号（pt）">
                  <input type="number" value={state.layoutTemplate.typography.body_size_pt} onChange={(event) => patchLayoutTemplateGroup('typography', { body_size_pt: Number(event.target.value) || 0 })} />
                </LayoutField>
                <LayoutField label="行距倍数">
                  <input type="number" step="0.1" value={state.layoutTemplate.typography.line_spacing} onChange={(event) => patchLayoutTemplateGroup('typography', { line_spacing: Number(event.target.value) || 0 })} />
                </LayoutField>
                <LayoutField label="首行缩进（字符）">
                  <input type="number" value={state.layoutTemplate.typography.first_line_indent_chars} onChange={(event) => patchLayoutTemplateGroup('typography', { first_line_indent_chars: Number(event.target.value) || 0 })} />
                </LayoutField>
              </div>
            </div>
            <div className="settings-row">
              <div className="settings-row-copy">
                <strong>标题层级</strong>
                <span>控制一级到四级标题。编号用于导出时保持“一、（一）、1.、（1）”这类标书目录格式。</span>
              </div>
              <div className="layout-heading-list">
                {state.layoutTemplate.headings.map((heading: LayoutTemplateConfig['headings'][number], index: number) => (
                  <div className="layout-heading-row" key={heading.level}>
                    <LayoutField label="标题级别">
                      <input type="number" value={heading.level} onChange={(event) => patchHeadingTemplate(index, { level: Number(event.target.value) || 1 })} />
                    </LayoutField>
                    <LayoutField label="标题字体">
                      <input type="text" value={heading.font} onChange={(event) => patchHeadingTemplate(index, { font: event.target.value })} placeholder="黑体" />
                    </LayoutField>
                    <LayoutField label="字号（pt）">
                      <input type="number" value={heading.size_pt} onChange={(event) => patchHeadingTemplate(index, { size_pt: Number(event.target.value) || 0 })} />
                    </LayoutField>
                    <LayoutField label="对齐方式">
                      <select value={heading.alignment} onChange={(event) => patchHeadingTemplate(index, { alignment: event.target.value as 'left' | 'center' })}>
                        <option value="left">左对齐</option>
                        <option value="center">居中</option>
                      </select>
                    </LayoutField>
                    <LayoutField label="编号样式">
                      <input type="text" value={heading.numbering} onChange={(event) => patchHeadingTemplate(index, { numbering: event.target.value })} placeholder="一、" />
                    </LayoutField>
                    <LayoutCheckField label="标题加粗" checked={heading.bold} onChange={(checked) => patchHeadingTemplate(index, { bold: checked })} />
                  </div>
                ))}
              </div>
            </div>
            <div className="settings-row">
              <div className="settings-row-copy">
                <strong>表格与图片</strong>
                <span>控制报价表、资质清单、业绩表和附件图片在 Word 中的统一排版。</span>
              </div>
              <div className="layout-field-grid">
                <LayoutField label="表头底色" hint="6 位十六进制颜色值">
                  <input type="text" value={state.layoutTemplate.tables.header_fill} onChange={(event) => patchLayoutTemplateGroup('tables', { header_fill: event.target.value })} placeholder="F1F6FF" />
                </LayoutField>
                <LayoutField label="表格边框颜色" hint="6 位十六进制颜色值">
                  <input type="text" value={state.layoutTemplate.tables.border_color} onChange={(event) => patchLayoutTemplateGroup('tables', { border_color: event.target.value })} placeholder="DCDFF6" />
                </LayoutField>
                <LayoutCheckField label="跨页重复表头" checked={state.layoutTemplate.tables.repeat_header} onChange={(checked) => patchLayoutTemplateGroup('tables', { repeat_header: checked })} />
                <LayoutCheckField label="允许表格跨页" checked={state.layoutTemplate.tables.allow_page_break} onChange={(checked) => patchLayoutTemplateGroup('tables', { allow_page_break: checked })} />
                <LayoutField label="图片最大宽度（%）" hint="相对页面可用宽度">
                  <input type="number" value={state.layoutTemplate.images.max_width_percent} onChange={(event) => patchLayoutTemplateGroup('images', { max_width_percent: Number(event.target.value) || 0 })} />
                </LayoutField>
                <LayoutField label="图片对齐方式">
                  <select value={state.layoutTemplate.images.align} onChange={(event) => patchLayoutTemplateGroup('images', { align: event.target.value as 'left' | 'center' })}>
                    <option value="center">居中</option>
                    <option value="left">左对齐</option>
                  </select>
                </LayoutField>
                <LayoutCheckField label="显示图片题注" checked={state.layoutTemplate.images.caption_enabled} onChange={(checked) => patchLayoutTemplateGroup('images', { caption_enabled: checked })} />
              </div>
            </div>
          </div>
        </section>
      )}

      {activeTab === 'text-model' && (
        <section className="settings-page-section">
          <div className="settings-section-title">
            <span />
            <strong>文本模型配置</strong>
          </div>
          <div className="settings-list">
            <label className="settings-row">
              <div className="settings-row-copy">
                <strong>服务提供商</strong>
                <span>选择服务商会自动使用预置 Base URL；只有自定义服务商允许修改</span>
              </div>
              <select
                value={state.textModel.provider}
                onChange={(event) => updateTextModelProvider(event.target.value as TextModelProvider)}
              >
                <optgroup label="在线提供商">
                  {textModelProviders.filter((p) => p.type === 'online').map((provider) => (
                    <option value={provider.value} key={provider.value}>{provider.label}</option>
                  ))}
                </optgroup>
                <optgroup label="离线提供商（本地模型）">
                  {textModelProviders.filter((p) => p.type === 'offline').map((provider) => (
                    <option value={provider.value} key={provider.value}>{provider.label}</option>
                  ))}
                </optgroup>
              </select>
            </label>
            <label className="settings-row">
              <div className="settings-row-copy">
                <strong>Base URL</strong>
                <span>OpenAI Like 接口地址，用于文本生成和分析任务</span>
              </div>
              <input
                type="text"
                value={state.textModel.base_url}
                placeholder={currentTextProviderDefault.base_url || '例如 https://api.openai.com/v1'}
                onChange={(event) => updateTextModelConfig({ base_url: event.target.value }, { clearModels: true })}
                disabled={state.textModel.provider !== 'custom'}
              />
            </label>
            <label className="settings-row">
              <div className="settings-row-copy">
                <strong>API Key</strong>
                <span>仅保存在本机配置文件中，不暴露给 Renderer 以外的原始能力</span>
              </div>
              <InputWithAction
                type="password"
                value={state.textModel.api_key}
                placeholder="请输入文本模型 API Key"
                onChange={(event) => updateTextModelConfig({ api_key: event.target.value }, { clearModels: true })}
                actionLabel="获取"
                actionTitle="打开当前服务商的 API Key 获取页面"
                actionDisabled={!textProviderApiKeyUrls[state.textModel.provider]}
                onAction={() => { void openTextProviderApiKeyPage(); }}
              />
            </label>
            <label className="settings-row">
              <div className="settings-row-copy">
                <strong>模型名称</strong>
                <span>可手动录入，也可从当前 Base URL 拉取可用模型</span>
              </div>
              <div className="settings-control-with-action">
                {textModels.length > 0 ? (
                  <select
                    value={state.textModel.model_name}
                    onChange={(event) => updateTextModelConfig({ model_name: event.target.value })}
                  >
                    {textModels.map((model) => <option value={model} key={model}>{model}</option>)}
                  </select>
                ) : (
                  <input
                    type="text"
                    value={state.textModel.model_name}
                    placeholder="例如 deepseek-chat"
                    onChange={(event) => updateTextModelConfig({ model_name: event.target.value })}
                  />
                )}
                <button
                  type="button"
                  className="inline-action"
                  onClick={fetchTextModels}
                  disabled={loadingModels === 'text'}
                >
                  {loadingModels === 'text' && <span className="inline-spinner" aria-hidden="true" />}
                  {loadingModels === 'text' ? '获取中' : '获取'}
                </button>
                <button type="button" className="inline-action" onClick={testTextConfig} disabled={testingTextModel}>
                  {testingTextModel && <span className="inline-spinner" aria-hidden="true" />}
                  {testingTextModel ? '测试中' : '测试'}
                </button>
              </div>
            </label>
          </div>
        </section>
      )}

      {activeTab === 'image-model' && (
        <section className="settings-page-section">
          <div className="settings-section-title">
            <span />
            <strong>生图模型配置</strong>
          </div>
          <div className={`image-model-status is-${imageModelStatus}`}>
            <div>
              <strong>接口状态：{currentImageStatus.label}</strong>
              <span>{currentImageStatus.description}</span>
              {imageTestTime && <small>最近测试：{imageTestTime}</small>}
              {imageModelStatus === 'unavailable' && state.imageModel.last_error && <small>失败原因：{state.imageModel.last_error}</small>}
            </div>
            <em>{currentImageStatus.label}</em>
          </div>
          <div className="settings-list">
            <label className="settings-row">
              <div className="settings-row-copy">
                <strong>服务提供商</strong>
                <span>各家生图接口不统一，先选择服务商再配置模型</span>
              </div>
              <select
                value={state.imageModel.provider}
                onChange={(event) => {
                  const provider = event.target.value as ImageModelProvider;
                  updateImageModelProvider(provider);
                }}
              >
                {imageProviders.map((provider) => (
                  <option value={provider.value} key={provider.value}>{provider.label}</option>
                ))}
              </select>
            </label>
            <label className="settings-row">
              <div className="settings-row-copy">
                <strong>Base URL</strong>
                <span>{getImageBaseUrlDescription(state.imageModel.provider)}</span>
              </div>
              <input
                type="text"
                value={state.imageModel.base_url || ''}
                placeholder={state.imageModel.provider === 'custom' ? 'https://api.example.com/v1' : imageProviderDefaults[state.imageModel.provider].base_url}
                onChange={(event) => updateImageModelConfig({ base_url: event.target.value }, { clearModels: true })}
                disabled={state.imageModel.provider !== 'custom'}
              />
            </label>
            <label className="settings-row">
              <div className="settings-row-copy">
                <strong>API Key</strong>
                <span>{getImageApiKeyDescription(state.imageModel.provider)}</span>
              </div>
              <InputWithAction
                type="password"
                value={state.imageModel.api_key}
                placeholder="请输入生图服务 API Key"
                onChange={(event) => updateImageModelConfig({ api_key: event.target.value }, { clearModels: true })}
                actionLabel="获取"
                actionTitle="打开当前生图服务商的 API Key 获取页面"
                onAction={() => { void openImageProviderApiKeyPage(); }}
              />
            </label>
            <label className="settings-row">
              <div className="settings-row-copy">
                <strong>模型名称</strong>
                <span>{getImageModelDescription(state.imageModel.provider)}</span>
              </div>
              <div className="settings-control-with-action">
                {imageModels.length > 0 ? (
                  <select
                    value={state.imageModel.model_name}
                    onChange={(event) => updateImageModelConfig({ model_name: event.target.value })}
                  >
                    {imageModels.map((model) => <option value={model} key={model}>{model}</option>)}
                  </select>
                ) : (
                  <input
                    type="text"
                    value={state.imageModel.model_name}
                    placeholder={getImageModelPlaceholder(state.imageModel.provider)}
                    onChange={(event) => updateImageModelConfig({ model_name: event.target.value })}
                  />
                )}
                <button
                  type="button"
                  className="inline-action"
                  onClick={fetchImageModels}
                  disabled={loadingModels === 'image'}
                >
                  {loadingModels === 'image' && <span className="inline-spinner" aria-hidden="true" />}
                  {loadingModels === 'image' ? '获取中' : '获取'}
                </button>
                <button type="button" className="inline-action" onClick={testImageConfig} disabled={testingImageModel}>
                  {testingImageModel && <span className="inline-spinner" aria-hidden="true" />}
                  {testingImageModel ? '测试中' : '测试'}
                </button>
              </div>
            </label>
          </div>
          {imageTestPreview && (
            <div className="image-test-preview">
              <div>
                <strong>{imageTestPreview.title}</strong>
                <span>用于确认当前生图配置可用</span>
              </div>
              <img src={imageTestPreview.src} alt="生图模型测试结果" />
            </div>
          )}
        </section>
      )}

      {activeTab === 'file-parser' && (
        <section className="settings-page-section">
          <div className="settings-section-title">
            <span />
            <strong>文件解析配置</strong>
          </div>
          <div className="settings-list">
            <label className="settings-row">
              <div className="settings-row-copy">
                <strong>文件解析方式</strong>
                <span>优先使用本地解析，复杂扫描件可尝试 MinerU 精准解析 API</span>
              </div>
              <select
                value={state.fileParser.provider}
                onChange={(event) => setState((prev) => ({
                ...prev,
                fileParser: { ...prev.fileParser, provider: event.target.value as FileParserProvider },
              }))}
            >
              {fileParserProviders.map((provider) => (
                  <option value={provider.value} key={provider.value}>{provider.label}</option>
                ))}
              </select>
            </label>
            {state.fileParser.provider === 'mineru-accurate-api' && (
              <label className="settings-row">
                <div className="settings-row-copy">
                  <strong>MinerU Token</strong>
                  <span>仅精准解析 API 需要 Token；轻量解析和本地解析无需填写</span>
                </div>
                <input
                  type="password"
                  value={state.fileParser.mineru_token || ''}
                  placeholder="请输入 MinerU Token"
                  onChange={(event) => setState((prev) => ({
                    ...prev,
                    fileParser: { ...prev.fileParser, mineru_token: event.target.value },
                  }))}
                />
              </label>
            )}
          </div>

          <div className="parser-compare">
            {parserOptions.map((option) => (
              <article className={`parser-card parser-card-${option.tone}`} key={option.title}>
                <div className="parser-card-head">
                  <div>
                    <strong>{option.title}</strong>
                    <p>{option.summary}</p>
                  </div>
                  <span>{option.badge}</span>
                </div>
                <dl className="parser-metrics">
                  {option.items.map(([label, value]) => (
                    <div key={`${option.title}-${label}`}>
                      <dt>{label}</dt>
                      <dd>{value}</dd>
                    </div>
                  ))}
                </dl>
              </article>
            ))}
          </div>
          <div className="parser-note">
            招标文件大多数是 Word 或 Word 导出的带文字层 PDF，本地解析可以适应 95% 以上的情况；如果解析失败，再尝试 MinerU 精准解析 API。
          </div>

          <div className="settings-section-title" style={{ marginTop: 24 }}>
            <span />
            <strong>本地增强解析环境</strong>
          </div>
          <div className="settings-list">
            <div className="settings-row">
              <div className="settings-row-copy">
                <strong>环境检测</strong>
                <span>检测 Python、Java 和本地解析依赖包的安装状态</span>
              </div>
              <div className="settings-action-cell">
                <button type="button" className="inline-action" onClick={checkEnv} disabled={envChecking}>
                  {envChecking && <span className="inline-spinner" aria-hidden="true" />}
                  {envChecking ? '检测中' : '检测环境'}
                </button>
              </div>
            </div>
            {envStatus && (
              <div className="settings-row" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 8 }}>
                <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', fontSize: 13 }}>
                  <span style={{ color: envStatus.python.available ? '#52c41a' : '#ff4d4f' }}>
                    Python: {envStatus.python.available ? `✓ ${envStatus.python.cmd}` : '✗ 未检测到'}
                  </span>
                  <span style={{ color: envStatus.java.available ? '#52c41a' : '#faad14' }}>
                    Java: {envStatus.java.available ? `✓ ${envStatus.java.version}` : `✗ ${envStatus.java.version ? `${envStatus.java.version}（需要 11+）` : '未检测到'}`}
                  </span>
                  <span style={{ color: envStatus.packages.opendataloader_pdf ? '#52c41a' : '#ff4d4f' }}>
                    opendataloader-pdf: {envStatus.packages.opendataloader_pdf ? '✓ 已安装' : '✗ 未安装'}
                  </span>
                  <span style={{ color: envStatus.packages.mineru ? '#52c41a' : '#ff4d4f' }}>
                    MinerU: {envStatus.packages.mineru ? '✓ 已安装' : '✗ 未安装'}
                  </span>
                  <span style={{ color: envStatus.packages.pdfplumber ? '#52c41a' : '#faad14' }}>
                    pdfplumber: {envStatus.packages.pdfplumber ? '✓ 已安装' : '✗ 未安装'}
                  </span>
                </div>
              </div>
            )}
            <div className="settings-row">
              <div className="settings-row-copy">
                <strong>一键安装依赖</strong>
                <span>执行 pip install -r requirements.txt，安装 opendataloader-pdf 和 MinerU</span>
              </div>
              <div className="settings-action-cell">
                <button
                  type="button"
                  className="inline-action"
                  onClick={installEnv}
                  disabled={envInstalling || !envStatus?.python.available}
                >
                  {envInstalling && <span className="inline-spinner" aria-hidden="true" />}
                  {envInstalling ? '安装中...' : '安装依赖'}
                </button>
              </div>
            </div>
            {envInstallLog.length > 0 && (
              <div className="settings-row" style={{ flexDirection: 'column', alignItems: 'flex-start' }}>
                <pre style={{
                  width: '100%',
                  maxHeight: 200,
                  overflow: 'auto',
                  background: '#1a1a1a',
                  color: '#e0e0e0',
                  fontSize: 12,
                  padding: 12,
                  borderRadius: 6,
                  margin: 0,
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-all',
                }}>
                  {envInstallLog.join('\n')}
                </pre>
              </div>
            )}
          </div>
        </section>
      )}

      {activeTab === 'api-server' && (
        <section className="settings-page-section">
          <div className="settings-section-title">
            <span />
            <strong>API 服务器</strong>
          </div>
          <div className="settings-list">
            <div className="settings-row">
              <div className="settings-row-copy">
                <strong>服务器状态</strong>
                <span>REST API 服务器，支持外部系统集成调用</span>
              </div>
              <div className="api-server-status">
                <span className={`status-indicator ${apiServerStatus?.isRunning ? 'is-running' : 'is-stopped'}`}>
                  {apiServerStatus?.isRunning ? '运行中' : '已停止'}
                </span>
                {apiServerStatus?.isRunning && (
                  <span className="status-port">端口: {apiServerStatus.port}</span>
                )}
              </div>
            </div>
            <div className="settings-row">
              <div className="settings-row-copy">
                <strong>端口号</strong>
                <span>API 服务器监听端口，默认 9800</span>
              </div>
              <input
                type="text"
                value={apiServerPort}
                onChange={(e) => setApiServerPort(e.target.value)}
                placeholder="9800"
                disabled={apiServerStatus?.isRunning}
              />
            </div>
            <div className="settings-row">
              <div className="settings-row-copy">
                <strong>API 密钥</strong>
                <span>设置后所有 API 请求需携带此密钥（留空则不验证）</span>
              </div>
              <div className="settings-control-with-action">
                <input
                  type="password"
                  value={apiKeyInput}
                  onChange={(e) => setApiKeyInput(e.target.value)}
                  placeholder="留空则不验证密钥"
                />
                <button
                  type="button"
                  className="inline-action"
                  onClick={handleSetApiKey}
                >
                  设置
                </button>
              </div>
            </div>
            <div className="settings-row">
              <div className="settings-row-copy">
                <strong>控制</strong>
                <span>启动或停止 API 服务器</span>
              </div>
              <div className="api-server-controls">
                {apiServerStatus?.isRunning ? (
                  <button
                    type="button"
                    className="inline-action danger"
                    onClick={handleStopApiServer}
                    disabled={apiServerLoading}
                  >
                    {apiServerLoading ? '停止中...' : '停止服务器'}
                  </button>
                ) : (
                  <button
                    type="button"
                    className="inline-action primary"
                    onClick={handleStartApiServer}
                    disabled={apiServerLoading}
                  >
                    {apiServerLoading ? '启动中...' : '启动服务器'}
                  </button>
                )}
                <button
                  type="button"
                  className="inline-action"
                  onClick={loadApiServerStatus}
                >
                  刷新状态
                </button>
              </div>
            </div>
          </div>
          {apiServerStatus?.isRunning && (
            <div className="api-server-info">
              <div className="api-info-header">
                <strong>API 端点</strong>
              </div>
              <div className="api-endpoints">
                <div className="api-endpoint">
                  <span className="method get">GET</span>
                  <code>/api/v1/health</code>
                  <span className="desc">健康检查</span>
                </div>
                <div className="api-endpoint">
                  <span className="method get">GET</span>
                  <code>/api/v1/status</code>
                  <span className="desc">服务器状态</span>
                </div>
                <div className="api-endpoint">
                  <span className="method post">POST</span>
                  <code>/api/v1/analysis/bid</code>
                  <span className="desc">启动招标分析</span>
                </div>
                <div className="api-endpoint">
                  <span className="method post">POST</span>
                  <code>/api/v1/technical-plan/outline</code>
                  <span className="desc">生成目录大纲</span>
                </div>
                <div className="api-endpoint">
                  <span className="method post">POST</span>
                  <code>/api/v1/technical-plan/content</code>
                  <span className="desc">生成内容</span>
                </div>
                <div className="api-endpoint">
                  <span className="method get">GET</span>
                  <code>/api/v1/knowledge-base/list</code>
                  <span className="desc">知识库列表</span>
                </div>
                <div className="api-endpoint">
                  <span className="method get">GET</span>
                  <code>/api/v1/private-kb/items</code>
                  <span className="desc">私有知识库</span>
                </div>
                <div className="api-endpoint">
                  <span className="method post">POST</span>
                  <code>/api/v1/ai/chat</code>
                  <span className="desc">AI 对话</span>
                </div>
              </div>
              <div className="api-usage-tip">
                <strong>使用提示：</strong>
                <p>1. 外部系统可通过 HTTP 请求调用上述 API 端点</p>
                <p>2. 如设置了 API 密钥，请求头需包含 <code>X-API-Key: your-key</code> 或 <code>Authorization: Bearer your-key</code></p>
                <p>3. 所有请求和响应均为 JSON 格式</p>
              </div>
            </div>
          )}
        </section>
      )}

      {activeTab === 'about' && (
        <section className="settings-page-section about-section">
          <div className="settings-section-title">
            <span />
            <strong>关于</strong>
          </div>
          <div className="about-grid">
            <div><span>当前版本</span><strong>{appVersion || '...'}</strong></div>
            <div><span>基于</span><span>OpenBidKit 二次开发</span></div>
            <div>
              <span>自动更新</span>
              <strong>{updateStatusText}</strong>
              <button
                type="button"
                className="update-button"
                disabled={updateBusy}
                onClick={() => {
                  if (updateStatus === 'downloaded') {
                    void window.yibiao?.quitAndInstall();
                    return;
                  }
                  void checkForUpdates();
                }}
              >
                {updateStatus === 'downloaded' ? '安装并重启' : updateBusy ? '检查中...' : '检查更新'}
              </button>
            </div>
            <div><span>运行模式</span><strong>独立 Electron 客户端</strong></div>
          </div>
          <div className="privacy-statement">
            <div className="privacy-statement-head">
              <span>Privacy</span>
              <strong>隐私声明</strong>
              <p>本工具尽量把数据处理留在本机和你自行选择的服务商之间，只保留运行所必需的最少信息。</p>
            </div>
            <div className="privacy-list">
              <article className="privacy-item">
                <span>01</span>
                <strong>你的业务数据不会被我收集</strong>
                <p>应用不会上传、收集或保存你配置的 API Key、导入的招标文件、解析后的文档内容、生成的方案正文、导出文件或其他业务结果。</p>
              </article>
              <article className="privacy-item">
                <span>02</span>
                <strong>线上 AI 请求只发送给你配置的服务商</strong>
                <p>当你使用 OpenAI 兼容接口、MinerU 或其他线上 API 时，应用会把完成任务所需的内容发送给你自行配置的服务商。这是实现文档解析、内容生成、模型测试等功能的必要步骤；这些请求不经过我的服务器，我也不会额外留存任何请求内容或生成结果。</p>
              </article>
              <article className="privacy-item">
                <span>03</span>
                <strong>匿名埋点只用于了解功能使用情况</strong>
                <p>为了判断开源项目是否有人使用、哪些功能更常用，应用会把匿名页面访问和功能使用次数上报到 Cloudflare。统计不包含文档内容、文件名、本地路径、API Key、用户输入、生成结果或任何可还原业务内容的信息。</p>
              </article>
            </div>
          </div>
        </section>
      )}
      </div>
      <FloatingToolbar groups={settingsToolbarGroups} label="设置保存工具条" />
    </div>
  );
}

export default SettingsPage;
