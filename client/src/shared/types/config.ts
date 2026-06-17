// 在线提供商
export type OnlineTextModelProvider = 'jinlong' | 'volcengine' | 'xiaomi' | 'deepseek' | 'longcat';
// 离线提供商（本地模型）
export type OfflineTextModelProvider = 'ollama' | 'lmstudio' | 'llamacpp' | 'vllm';
// 所有文本模型提供商
export type TextModelProvider = OnlineTextModelProvider | OfflineTextModelProvider | 'custom';

// 提供商类型
export type ProviderType = 'online' | 'offline';

export interface TextModelConfig {
  api_key: string;
  base_url: string;
  model_name: string;
  provider_type?: ProviderType;
}

export type TextModelProfiles = Record<TextModelProvider, TextModelConfig>;

export interface AiConfig extends TextModelConfig {
  text_model_provider: TextModelProvider;
  text_model_profiles: TextModelProfiles;
}

export interface ConfigSaveResult {
  success: boolean;
  message: string;
  config_path?: string;
}

export interface FontInfo {
  fileName: string;
  filePath: string;
  family: string;
  name: string;
  extension: string;
  size: number;
  installed?: boolean;
}

export interface FontImportResult {
  success: boolean;
  canceled?: boolean;
  fontsDir: string;
  imported: Array<{ fileName: string; filePath: string; family: string }>;
  skipped: Array<{ sourcePath: string; reason: string }>;
  fonts: FontInfo[];
}

export interface FontInstallResult {
  success: boolean;
  message: string;
  fontsDir: string;
  installed: FontInfo[];
  failed: Array<FontInfo & { error: string }>;
  fonts: FontInfo[];
}

export interface ModelListResult {
  success: boolean;
  message: string;
  models: string[];
}

export interface ImageModelTestResult {
  success: boolean;
  message: string;
  image_url?: string;
  image_data?: string;
  mime_type?: string;
}

export type ImageModelProvider = 'jinlong' | 'volcengine' | 'google-ai-studio' | 'custom';
export type ImageModelStatus = 'untested' | 'available' | 'unavailable';

export interface ImageModelConfig {
  provider: ImageModelProvider;
  base_url?: string;
  api_key: string;
  model_name: string;
  status?: ImageModelStatus;
  tested_at?: string;
  last_error?: string;
}

export type ImageModelProfiles = Record<ImageModelProvider, ImageModelConfig>;

export type FileParserProvider = 'local' | 'mineru-accurate-api' | 'mineru-agent-api' | 'opendataloader' | 'mineru-local' | 'auto';

export interface FileParserConfig {
  provider: FileParserProvider;
  mineru_token?: string;
}

export interface LayoutTemplateConfig {
  id: string;
  name: string;
  industry: string;
  page: {
    size: 'A4' | 'A3';
    margin_top_mm: number;
    margin_bottom_mm: number;
    margin_left_mm: number;
    margin_right_mm: number;
    gutter_mm: number;
  };
  header: {
    enabled: boolean;
    text: string;
    logo_path: string;
  };
  footer: {
    enabled: boolean;
    text: string;
    page_number_format: string;
  };
  cover: {
    title: string;
    subtitle: string;
    bidder_label: string;
    tenderer_label: string;
    date_label: string;
    show_logo_placeholder: boolean;
    logo_path: string;
  };
  toc: {
    show_page_numbers: boolean;
    page_number_format: string;
    leader: 'dot' | 'hyphen' | 'underscore' | 'middleDot' | 'none';
    max_level: number;
  };
  preview: {
    show_guides: boolean;
    show_rulers: boolean;
  };
  typography: {
    body_font: string;
    body_size_pt: number;
    line_spacing: number;
    first_line_indent_chars: number;
  };
  headings: Array<{
    level: number;
    font: string;
    size_pt: number;
    bold: boolean;
    alignment: 'left' | 'center';
    numbering: string;
  }>;
  tables: {
    header_fill: string;
    border_color: string;
    repeat_header: boolean;
    allow_page_break: boolean;
  };
  images: {
    max_width_percent: number;
    align: 'left' | 'center';
    caption_enabled: boolean;
  };
}

export interface ClientConfig extends AiConfig {
  image_model: ImageModelConfig;
  image_model_profiles: ImageModelProfiles;
  file_parser: FileParserConfig;
  layout_template: LayoutTemplateConfig;
  layout_templates: LayoutTemplateConfig[];
  developer_mode?: boolean;
}
