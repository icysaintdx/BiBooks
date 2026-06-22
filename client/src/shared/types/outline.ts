export interface OutlineItem {
  id: string;
  title: string;
  description: string;
  source_requirement_id?: string;
  source_requirement_title?: string;
  knowledge_item_ids?: string[];
  children?: OutlineItem[];
  content?: string;
  /** 招标文件对该章节的格式来源引用（如"按第六章格式1编写"），由 bidFileStructure 解析提取 */
  format_ref?: string;
}

export type OutlineMode = 'free' | 'aligned';

export interface OutlineData {
  outline: OutlineItem[];
  project_name?: string;
  project_overview?: string;
}

export interface TechnicalRequirementGroup {
  requirement_id: string;
  title: string;
  description: string;
  detail_points: string[];
}
