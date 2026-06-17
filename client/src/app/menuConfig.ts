import type { AppMenuItem, SectionId } from '../shared/types/navigation';

export const appMenuItems: AppMenuItem[] = [
  {
    id: 'project-management',
    label: '项目管理',
    description: '选择、新建和维护投标项目',
  },
  {
    id: 'technical-plan',
    label: '技术方案',
    description: '招标解析、目录、正文与导出',
  },
  {
    id: 'business-bid',
    label: '商务标',
    description: '商务响应、资质、业绩与承诺',
  },
  {
    id: 'pricing',
    label: '报价管理',
    description: '报价明细、税率计算与本地校验',
  },
  {
    id: 'knowledge-base',
    label: '知识库',
    description: '通用素材、模板和案例资产',
  },
  {
    id: 'private-knowledge-base',
    label: '企业知识库',
    description: '企业专属资质、业绩和标书知识',
  },
  {
    id: 'duplicate-check',
    label: '标书查重',
    description: '相似度、重复表达与图片复用检查',
  },
  {
    id: 'rejection-check',
    label: '废标项检查',
    description: '硬性条款与响应完整性检查',
  },
  {
    id: 'bid-opportunity',
    label: '投标机会',
    description: '售前线索、参投评估与机会日程',
  },
  {
    id: 'competitive-analysis',
    label: '竞争分析',
    description: '评分权重、竞品策略和胜率判断',
  },
  {
    id: 'compliance-check',
    label: '合规检查',
    description: '投标文件合规性验证',
  },
];

const developerMenuItems: AppMenuItem[] = [
  {
    id: 'developer-test',
    label: '测试页',
    description: '开发者问题复现入口',
  },
];

export function getAppMenuItems(developerMode: boolean): AppMenuItem[] {
  return developerMode ? [...appMenuItems, ...developerMenuItems] : appMenuItems;
}

export function getSectionOrder(developerMode: boolean): SectionId[] {
  return getAppMenuItems(developerMode).map((item) => item.id);
}
