// 招标解析联动工具
// 从当前项目的技术方案状态（technicalPlan.loadState）中读取招标文件解析项，
// 抽取可用于商务标/报价表单初值的字段。
// 原则（用户硬性要求）：招标文件解析结果优先；解析项无值时由调用方回退硬编码默认；冲突以招标文件为准。
import type { TechnicalPlanState, BidAnalysisTaskState } from '../../features/technical-plan/types';

// 商务标可从招标解析直接带入的初值
export interface CommercialTenderSeed {
  projectName: string;
  projectBudget: string;
  warrantyPeriod: string;
  responseTime: string;
  afterSalesService: string;
  // 资格性审查 / 商务评分原文，作为材料配置阶段的参考说明
  qualificationReview: string;
  businessScoring: string;
}

// 报价可从招标解析直接带入的初值
export interface PricingTenderSeed {
  projectName: string;
  projectBudget: string;
  // 报价要求/口径原文（来自交付与服务要求、评分构成等），作为报价说明参考
  pricingNote: string;
}

function getSuccessContent(state: TechnicalPlanState | null | undefined, taskId: string): string {
  const task: BidAnalysisTaskState | undefined = state?.bidAnalysisTasks?.[taskId];
  if (!task || task.status !== 'success') return '';
  return String(task.content || '').trim();
}

// 解析项为 JSON 输出时，content 是 JSON 字符串
function parseJsonContent(content: string): Record<string, unknown> | null {
  if (!content) return null;
  try {
    const parsed = JSON.parse(content);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

// 过滤掉"没有提及/未提及"这类占位值，避免把空信息当作真实初值
function pickField(data: Record<string, unknown> | null, key: string): string {
  if (!data) return '';
  const value = data[key];
  if (value === null || value === undefined) return '';
  const text = String(value).trim();
  if (!text || /没有提及|未提及|无$/.test(text)) return '';
  return text;
}

// 从技术方案状态抽取商务标初值
export function buildCommercialTenderSeed(state: TechnicalPlanState | null | undefined): CommercialTenderSeed {
  const projectInfo = parseJsonContent(getSuccessContent(state, 'projectInfo'));
  const delivery = parseJsonContent(getSuccessContent(state, 'deliveryAndServiceRequirements'));
  return {
    projectName: pickField(projectInfo, 'project_name'),
    projectBudget: pickField(projectInfo, 'project_budget'),
    warrantyPeriod: pickField(delivery, 'warranty_period'),
    responseTime: pickField(delivery, 'response_time'),
    afterSalesService: pickField(delivery, 'after_sales_service'),
    qualificationReview: getSuccessContent(state, 'qualificationReview'),
    businessScoring: getSuccessContent(state, 'businessScoring'),
  };
}

// 从技术方案状态抽取报价初值
export function buildPricingTenderSeed(state: TechnicalPlanState | null | undefined): PricingTenderSeed {
  const projectInfo = parseJsonContent(getSuccessContent(state, 'projectInfo'));
  const delivery = parseJsonContent(getSuccessContent(state, 'deliveryAndServiceRequirements'));
  const deliveryScope = pickField(delivery, 'delivery_scope');
  const acceptance = pickField(delivery, 'acceptance_requirements');
  const noteParts: string[] = [];
  if (deliveryScope) noteParts.push(`交付范围：${deliveryScope}`);
  if (acceptance) noteParts.push(`验收要求：${acceptance}`);
  return {
    projectName: pickField(projectInfo, 'project_name'),
    projectBudget: pickField(projectInfo, 'project_budget'),
    pricingNote: noteParts.join('\n'),
  };
}

// 安全读取当前项目技术方案状态（招标解析的承载体）。
// 任一异常都不应阻塞商务标/报价主流程，失败时返回 null 由调用方回退硬编码默认。
export async function loadTenderPlanState(): Promise<TechnicalPlanState | null> {
  try {
    const state = await window.yibiao?.technicalPlan?.loadState();
    return (state as TechnicalPlanState) || null;
  } catch {
    return null;
  }
}
