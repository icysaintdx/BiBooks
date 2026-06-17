import type { FileParserConfig, ImageModelConfig, ImageModelProfiles, LayoutTemplateConfig, TextModelConfig, TextModelProfiles, TextModelProvider } from '../../shared/types';

export interface SettingsPageState {
  textModel: TextModelConfig & {
    provider: TextModelProvider;
  };
  textModelProfiles: TextModelProfiles;
  imageModel: ImageModelConfig;
  imageModelProfiles: ImageModelProfiles;
  fileParser: FileParserConfig;
  layoutTemplate: LayoutTemplateConfig;
  layoutTemplates: LayoutTemplateConfig[];
  general: {
    developer_mode: boolean;
  };
}
