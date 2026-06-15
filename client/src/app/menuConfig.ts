import type { AppMenuItem, SectionId } from '../shared/types/navigation';

export const appMenuItems: AppMenuItem[] = [
  {
    id: 'technical-plan',
    label: '技术方案',
    description: '方案生成与正文编排',
  },
  {
    id: 'business-bid',
    label: '商务标',
    description: '商务响应与报价材料',
  },
  {
    id: 'pricing',
    label: '报价管理',
    description: '报价明细、税率计算与导出',
  },
  {
    id: 'knowledge-base',
    label: '知识库',
    description: '素材、模板和案例资产',
  },
  {
    id: 'private-knowledge-base',
    label: '企业知识库',
    description: '企业专属标书知识管理',
  },
  {
    id: 'duplicate-check',
    label: '标书查重',
    description: '相似度与重复表达检测',
  },
  {
    id: 'rejection-check',
    label: '废标项检查',
    description: '硬性条款与响应完整性',
  },
  {
    id: 'bid-opportunity',
    label: '投标机会',
    description: '机会发现与线索跟踪',
  },
  {
    id: 'competitive-analysis',
    label: '竞争分析',
    description: '评分权重与竞争策略',
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
