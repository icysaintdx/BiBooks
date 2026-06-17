const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { getConfigFilePath } = require('../utils/paths.cjs');

// 内置在线提供商
const BUILTIN_ONLINE_PROVIDERS = [
  { id: 'jinlong', name: '金龙 (GPT代理)', type: 'online' },
  { id: 'volcengine', name: '火山引擎', type: 'online' },
  { id: 'xiaomi', name: '小米 MiMo', type: 'online' },
  { id: 'deepseek', name: 'DeepSeek', type: 'online' },
  { id: 'longcat', name: 'LongCat', type: 'online' },
];

// 内置离线提供商（本地模型）
const BUILTIN_OFFLINE_PROVIDERS = [
  { id: 'ollama', name: 'Ollama', type: 'offline', defaultPort: 11434 },
  { id: 'lmstudio', name: 'LM Studio', type: 'offline', defaultPort: 1234 },
  { id: 'llamacpp', name: 'llama.cpp', type: 'offline', defaultPort: 8080 },
  { id: 'vllm', name: 'vLLM', type: 'offline', defaultPort: 8000 },
];

// 所有内置提供商
const textModelProviders = [...BUILTIN_ONLINE_PROVIDERS.map((p) => p.id), ...BUILTIN_OFFLINE_PROVIDERS.map((p) => p.id), 'custom'];
const imageModelProviders = ['jinlong', 'volcengine', 'google-ai-studio', 'custom'];
const oldXiaomiBaseUrl = 'https://api.xiaomimimo.com/v1';

const textProviderBaseUrls = {
  jinlong: 'https://jlaudeapi.com/v1',
  volcengine: 'https://ark.cn-beijing.volces.com/api/v3',
  xiaomi: 'https://token-plan-cn.xiaomimimo.com/v1',
  deepseek: 'https://api.deepseek.com',
  longcat: 'https://api.longcat.chat/openai/v1',
  ollama: 'http://localhost:11434/v1',
  lmstudio: 'http://localhost:1234/v1',
  llamacpp: 'http://localhost:8080/v1',
  vllm: 'http://localhost:8000/v1',
  custom: '',
};

const defaultTextModelProfiles = {
  jinlong: {
    api_key: '',
    base_url: textProviderBaseUrls.jinlong,
    model_name: 'gpt-3.5-turbo',
    provider_type: 'online',
  },
  volcengine: {
    api_key: '',
    base_url: textProviderBaseUrls.volcengine,
    model_name: '',
    provider_type: 'online',
  },
  xiaomi: {
    api_key: '',
    base_url: textProviderBaseUrls.xiaomi,
    model_name: '',
    provider_type: 'online',
  },
  deepseek: {
    api_key: '',
    base_url: textProviderBaseUrls.deepseek,
    model_name: '',
    provider_type: 'online',
  },
  longcat: {
    api_key: '',
    base_url: textProviderBaseUrls.longcat,
    model_name: '',
    provider_type: 'online',
  },
  ollama: {
    api_key: '',
    base_url: textProviderBaseUrls.ollama,
    model_name: 'llama3',
    provider_type: 'offline',
  },
  lmstudio: {
    api_key: '',
    base_url: textProviderBaseUrls.lmstudio,
    model_name: '',
    provider_type: 'offline',
  },
  llamacpp: {
    api_key: '',
    base_url: textProviderBaseUrls.llamacpp,
    model_name: '',
    provider_type: 'offline',
  },
  vllm: {
    api_key: '',
    base_url: textProviderBaseUrls.vllm,
    model_name: '',
    provider_type: 'offline',
  },
  custom: {
    api_key: '',
    base_url: '',
    model_name: '',
    provider_type: 'online',
  },
};

const defaultImageModelProfiles = {
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

const defaultLayoutTemplate = {
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

const defaultConfig = {
  text_model_provider: 'jinlong',
  text_model_profiles: defaultTextModelProfiles,
  api_key: '',
  base_url: textProviderBaseUrls.jinlong,
  model_name: 'gpt-3.5-turbo',
  image_model: {
    ...defaultImageModelProfiles.jinlong,
  },
  image_model_profiles: defaultImageModelProfiles,
  file_parser: {
    provider: 'local',
    mineru_token: '',
  },
  layout_template: defaultLayoutTemplate,
  layout_templates: [defaultLayoutTemplate],
  developer_mode: false,
  _disabled_analytics_client_id: '',
  _disabled_analytics_created_at: '',
};

function createAnalyticsClientId() {
  return crypto.randomUUID();
}

function createAnalyticsCreatedAt() {
  return new Date().toISOString().slice(0, 10);
}

function isTextModelProvider(value) {
  return textModelProviders.includes(value);
}

function isImageModelProvider(value) {
  return imageModelProviders.includes(value);
}

function normalizeTextModelProfile(provider, profile) {
  const defaults = defaultTextModelProfiles[provider];
  const source = profile || {};
  const sourceBaseUrl = provider === 'custom'
    ? source.base_url !== undefined ? source.base_url : defaults.base_url
    : defaults.base_url;
  return {
    api_key: source.api_key !== undefined ? source.api_key : defaults.api_key,
    base_url: provider === 'xiaomi' && sourceBaseUrl === oldXiaomiBaseUrl ? defaults.base_url : sourceBaseUrl,
    model_name: source.model_name !== undefined ? source.model_name : defaults.model_name,
  };
}

function normalizeTextModelProfiles(sourceProfiles) {
  const profiles = {};
  textModelProviders.forEach((provider) => {
    profiles[provider] = normalizeTextModelProfile(
      provider,
      sourceProfiles && typeof sourceProfiles === 'object' ? sourceProfiles[provider] : null,
    );
  });
  return profiles;
}

function textProfileFromFlatConfig(source, fallback, provider) {
  const sourceBaseUrl = provider === 'custom'
    ? source.base_url !== undefined ? source.base_url : fallback.base_url
    : fallback.base_url;
  return {
    api_key: source.api_key !== undefined ? source.api_key : fallback.api_key,
    base_url: provider === 'xiaomi' && sourceBaseUrl === oldXiaomiBaseUrl ? fallback.base_url : sourceBaseUrl,
    model_name: source.model_name !== undefined ? source.model_name : fallback.model_name,
  };
}

function normalizeImageModelProfile(provider, profile) {
  const defaults = defaultImageModelProfiles[provider];
  const source = profile || {};
  return {
    provider,
    base_url: provider === 'custom'
      ? source.base_url !== undefined ? source.base_url : defaults.base_url
      : defaults.base_url,
    api_key: source.api_key !== undefined ? source.api_key : defaults.api_key,
    model_name: source.model_name !== undefined ? source.model_name : defaults.model_name,
    status: source.status !== undefined ? source.status : defaults.status,
    tested_at: source.tested_at !== undefined ? source.tested_at : defaults.tested_at,
    last_error: source.last_error !== undefined ? source.last_error : defaults.last_error,
  };
}

function normalizeImageModelProfiles(sourceProfiles) {
  const profiles = {};
  imageModelProviders.forEach((provider) => {
    profiles[provider] = normalizeImageModelProfile(
      provider,
      sourceProfiles && typeof sourceProfiles === 'object' ? sourceProfiles[provider] : null,
    );
  });
  return profiles;
}

function numberInRange(value, fallback, min, max) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.min(max, Math.max(min, number));
}

function stringOrDefault(value, fallback = '') {
  return String(value === undefined || value === null ? fallback : value);
}

function normalizeHeadingTemplate(sourceHeading, fallbackHeading) {
  const source = sourceHeading && typeof sourceHeading === 'object' ? sourceHeading : {};
  const fallback = fallbackHeading || {};
  return {
    level: numberInRange(source.level, fallback.level || 1, 1, 6),
    font: stringOrDefault(source.font, fallback.font || '宋体'),
    size_pt: numberInRange(source.size_pt, fallback.size_pt || 12, 8, 42),
    bold: source.bold === undefined ? Boolean(fallback.bold) : Boolean(source.bold),
    alignment: source.alignment === 'center' ? 'center' : 'left',
    numbering: stringOrDefault(source.numbering, fallback.numbering || ''),
  };
}

function normalizeTocLeader(value, fallback = 'dot') {
  return ['dot', 'hyphen', 'underscore', 'middleDot', 'none'].includes(value) ? value : fallback;
}

function normalizeLayoutTemplate(template) {
  const source = template && typeof template === 'object' ? template : {};
  const fallback = defaultLayoutTemplate;
  const headings = Array.isArray(source.headings) && source.headings.length
    ? source.headings
    : fallback.headings;
  return {
    id: stringOrDefault(source.id, fallback.id).trim() || fallback.id,
    name: stringOrDefault(source.name, fallback.name).trim() || fallback.name,
    industry: stringOrDefault(source.industry, fallback.industry).trim() || fallback.industry,
    page: {
      size: source.page?.size === 'A3' ? 'A3' : 'A4',
      margin_top_mm: numberInRange(source.page?.margin_top_mm, fallback.page.margin_top_mm, 5, 60),
      margin_bottom_mm: numberInRange(source.page?.margin_bottom_mm, fallback.page.margin_bottom_mm, 5, 60),
      margin_left_mm: numberInRange(source.page?.margin_left_mm, fallback.page.margin_left_mm, 5, 60),
      margin_right_mm: numberInRange(source.page?.margin_right_mm, fallback.page.margin_right_mm, 5, 60),
      gutter_mm: numberInRange(source.page?.gutter_mm, fallback.page.gutter_mm, 0, 30),
    },
    header: {
      enabled: source.header?.enabled === undefined ? fallback.header.enabled : Boolean(source.header.enabled),
      text: stringOrDefault(source.header?.text, fallback.header.text),
      logo_path: stringOrDefault(source.header?.logo_path, fallback.header.logo_path),
    },
    footer: {
      enabled: source.footer?.enabled === undefined ? fallback.footer.enabled : Boolean(source.footer.enabled),
      text: stringOrDefault(source.footer?.text, fallback.footer.text),
      page_number_format: stringOrDefault(source.footer?.page_number_format, fallback.footer.page_number_format),
    },
    cover: {
      title: stringOrDefault(source.cover?.title, fallback.cover.title),
      subtitle: stringOrDefault(source.cover?.subtitle, fallback.cover.subtitle),
      bidder_label: stringOrDefault(source.cover?.bidder_label, fallback.cover.bidder_label),
      tenderer_label: stringOrDefault(source.cover?.tenderer_label, fallback.cover.tenderer_label),
      date_label: stringOrDefault(source.cover?.date_label, fallback.cover.date_label),
      show_logo_placeholder: source.cover?.show_logo_placeholder === undefined ? fallback.cover.show_logo_placeholder : Boolean(source.cover.show_logo_placeholder),
      logo_path: stringOrDefault(source.cover?.logo_path, fallback.cover.logo_path),
    },
    toc: {
      show_page_numbers: source.toc?.show_page_numbers === undefined ? fallback.toc.show_page_numbers : Boolean(source.toc.show_page_numbers),
      page_number_format: stringOrDefault(source.toc?.page_number_format, fallback.toc.page_number_format),
      leader: normalizeTocLeader(source.toc?.leader, fallback.toc.leader),
      max_level: numberInRange(source.toc?.max_level, fallback.toc.max_level, 1, 6),
    },
    preview: {
      show_guides: source.preview?.show_guides === undefined ? fallback.preview.show_guides : Boolean(source.preview.show_guides),
      show_rulers: source.preview?.show_rulers === undefined ? fallback.preview.show_rulers : Boolean(source.preview.show_rulers),
    },
    typography: {
      body_font: stringOrDefault(source.typography?.body_font, fallback.typography.body_font),
      body_size_pt: numberInRange(source.typography?.body_size_pt, fallback.typography.body_size_pt, 8, 22),
      line_spacing: numberInRange(source.typography?.line_spacing, fallback.typography.line_spacing, 1, 3),
      first_line_indent_chars: numberInRange(source.typography?.first_line_indent_chars, fallback.typography.first_line_indent_chars, 0, 4),
    },
    headings: headings.slice(0, 6).map((heading, index) => normalizeHeadingTemplate(heading, fallback.headings[index] || fallback.headings[fallback.headings.length - 1])),
    tables: {
      header_fill: stringOrDefault(source.tables?.header_fill, fallback.tables.header_fill).replace(/^#/, '').slice(0, 6) || fallback.tables.header_fill,
      border_color: stringOrDefault(source.tables?.border_color, fallback.tables.border_color).replace(/^#/, '').slice(0, 6) || fallback.tables.border_color,
      repeat_header: source.tables?.repeat_header === undefined ? fallback.tables.repeat_header : Boolean(source.tables.repeat_header),
      allow_page_break: source.tables?.allow_page_break === undefined ? fallback.tables.allow_page_break : Boolean(source.tables.allow_page_break),
    },
    images: {
      max_width_percent: numberInRange(source.images?.max_width_percent, fallback.images.max_width_percent, 20, 100),
      align: source.images?.align === 'left' ? 'left' : 'center',
      caption_enabled: source.images?.caption_enabled === undefined ? fallback.images.caption_enabled : Boolean(source.images.caption_enabled),
    },
  };
}

function normalizeLayoutTemplates(sourceTemplates, activeTemplate) {
  const templates = Array.isArray(sourceTemplates) && sourceTemplates.length
    ? sourceTemplates.map(normalizeLayoutTemplate)
    : [normalizeLayoutTemplate(activeTemplate || defaultLayoutTemplate)];
  const seen = new Set();
  const uniqueTemplates = templates.filter((template) => {
    if (seen.has(template.id)) return false;
    seen.add(template.id);
    return true;
  });
  return uniqueTemplates.length ? uniqueTemplates : [defaultLayoutTemplate];
}

function normalizeConfig(config) {
  const source = config || {};
  const fileParser = source.file_parser ? source.file_parser : {};
  const hasTextProvider = Object.prototype.hasOwnProperty.call(source, 'text_model_provider');
  const sourceTextProvider = isTextModelProvider(source.text_model_provider)
    ? source.text_model_provider
    : '';
  const textModelProvider = sourceTextProvider || (hasTextProvider || config ? 'custom' : defaultConfig.text_model_provider);
  const textModelProfiles = normalizeTextModelProfiles(source.text_model_profiles);
  textModelProfiles[textModelProvider] = textProfileFromFlatConfig(source, textModelProfiles[textModelProvider], textModelProvider);
  const activeTextProfile = textModelProfiles[textModelProvider];
  const sourceImageModel = source.image_model && typeof source.image_model === 'object' ? source.image_model : {};
  const imageModelProvider = isImageModelProvider(sourceImageModel.provider) ? sourceImageModel.provider : defaultConfig.image_model.provider;
  const imageModelProfiles = normalizeImageModelProfiles(source.image_model_profiles);
  imageModelProfiles[imageModelProvider] = normalizeImageModelProfile(imageModelProvider, sourceImageModel);
  const activeImageProfile = imageModelProfiles[imageModelProvider];
  const layoutTemplates = normalizeLayoutTemplates(source.layout_templates, source.layout_template);
  const sourceLayoutTemplate = normalizeLayoutTemplate(source.layout_template || layoutTemplates[0]);
  const activeLayoutTemplate = source.layout_template ? sourceLayoutTemplate : layoutTemplates.find((template) => template.id === sourceLayoutTemplate.id) || sourceLayoutTemplate;
  const mergedLayoutTemplates = layoutTemplates.some((template) => template.id === activeLayoutTemplate.id)
    ? layoutTemplates.map((template) => template.id === activeLayoutTemplate.id ? activeLayoutTemplate : template)
    : [activeLayoutTemplate, ...layoutTemplates];

  return {
    ...defaultConfig,
    text_model_provider: textModelProvider,
    text_model_profiles: textModelProfiles,
    api_key: activeTextProfile.api_key,
    base_url: activeTextProfile.base_url,
    model_name: activeTextProfile.model_name,
    image_model: activeImageProfile,
    image_model_profiles: imageModelProfiles,
    file_parser: {
      provider: fileParser.provider || defaultConfig.file_parser.provider,
      mineru_token: fileParser.mineru_token || defaultConfig.file_parser.mineru_token,
    },
    layout_template: activeLayoutTemplate,
    layout_templates: mergedLayoutTemplates,
    developer_mode: source.developer_mode === undefined ? defaultConfig.developer_mode : Boolean(source.developer_mode),
    _disabled_analytics_client_id: source._disabled_analytics_client_id || defaultConfig._disabled_analytics_client_id,
    _disabled_analytics_created_at: source._disabled_analytics_created_at || defaultConfig._disabled_analytics_created_at,
  };
}

function createConfigStore(app) {
  const configFile = getConfigFilePath(app);

  function persist(config) {
    fs.mkdirSync(path.dirname(configFile), { recursive: true });
    fs.writeFileSync(configFile, JSON.stringify(config, null, 2), 'utf-8');
  }

  function withAnalyticsIdentity(config) {
    if (config._disabled_analytics_client_id && config._disabled_analytics_created_at) {
      return config;
    }

    return {
      ...config,
      _disabled_analytics_client_id: config._disabled_analytics_client_id || createAnalyticsClientId(),
      _disabled_analytics_created_at: config._disabled_analytics_created_at || createAnalyticsCreatedAt(),
    };
  }

  return {
    getConfigFilePath() {
      return configFile;
    },

    load() {
      if (!fs.existsSync(configFile)) {
        const config = withAnalyticsIdentity(normalizeConfig());
        persist(config);
        return config;
      }

      try {
        const raw = fs.readFileSync(configFile, 'utf-8');
        const parsedConfig = JSON.parse(raw);
        const config = normalizeConfig(parsedConfig);
        const nextConfig = withAnalyticsIdentity(config);
        if (JSON.stringify(parsedConfig) !== JSON.stringify(nextConfig)) {
          persist(nextConfig);
        }
        return nextConfig;
      } catch (error) {
        throw new Error(`配置文件读取失败：${error.message}`);
      }
    },

    save(config) {
      try {
        const currentConfig = fs.existsSync(configFile)
          ? normalizeConfig(JSON.parse(fs.readFileSync(configFile, 'utf-8')))
          : normalizeConfig();
        const nextConfig = withAnalyticsIdentity(normalizeConfig({
          ...currentConfig,
          ...config,
          text_model_profiles: {
            ...currentConfig.text_model_profiles,
            ...(config && config.text_model_profiles ? config.text_model_profiles : {}),
          },
          image_model_profiles: {
            ...currentConfig.image_model_profiles,
            ...(config && config.image_model_profiles ? config.image_model_profiles : {}),
          },
          layout_templates: config?.layout_templates || currentConfig.layout_templates,
          layout_template: config?.layout_template || currentConfig.layout_template,
          _disabled_analytics_client_id: config?._disabled_analytics_client_id || currentConfig._disabled_analytics_client_id,
          _disabled_analytics_created_at: config?._disabled_analytics_created_at || currentConfig._disabled_analytics_created_at,
        }));
        persist(nextConfig);
        return { success: true, message: '配置已保存', config_path: configFile };
      } catch (error) {
        throw new Error(`配置文件保存失败：${error.message}`);
      }
    },
  };
}

/**
 * 获取提供商信息（包括类型：online/offline）
 */
function getProviderInfo(providerId) {
  const online = BUILTIN_ONLINE_PROVIDERS.find((p) => p.id === providerId);
  if (online) return { ...online, type: 'online' };

  const offline = BUILTIN_OFFLINE_PROVIDERS.find((p) => p.id === providerId);
  if (offline) return { ...offline, type: 'offline' };

  if (providerId === 'custom') return { id: 'custom', name: '自定义', type: 'online' };

  return null;
}

/**
 * 获取所有提供商列表（按类型分组）
 */
function getProvidersByType() {
  return {
    online: BUILTIN_ONLINE_PROVIDERS.map((p) => ({ ...p })),
    offline: BUILTIN_OFFLINE_PROVIDERS.map((p) => ({ ...p })),
    custom: [{ id: 'custom', name: '自定义提供商', type: 'online' }],
  };
}

module.exports = {
  createConfigStore,
  getProviderInfo,
  getProvidersByType,
  BUILTIN_ONLINE_PROVIDERS,
  BUILTIN_OFFLINE_PROVIDERS,
};
