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
  // 招标规定的报价配置（来自机读解析项 bidFileStructureSchema），缺失时为空由调用方回退硬编码默认
  currency: string;
  taxRate: number | null;
  priceType: string;
}

// 商务标资质字段 schema（单项）
export interface CommercialQualificationSchema {
  name: string;
  required: boolean;
  formRef: string;
}

// 商务标服务字段 schema（单项）
export interface CommercialServiceFieldSchema {
  key: string;
  label: string;
  required: boolean;
}

// 商务标业绩要求 schema
export interface CommercialPerformanceSchema {
  required: boolean;
  minCount: number;
  note: string;
}

// 招标驱动的商务标 / 报价表单字段 schema（招标值优先，缺失回退硬编码默认）
export interface BidFormSchema {
  // 是否来自招标解析（false 表示全部走硬编码兜底）
  fromTender: boolean;
  commercial: {
    qualifications: CommercialQualificationSchema[];
    performance: CommercialPerformanceSchema;
    serviceFields: CommercialServiceFieldSchema[];
    priceNote: string;
  };
  pricing: {
    currency: string;
    taxRate: number | null;
    priceType: string;
    note: string;
  };
}

// 硬编码兜底 schema：招标未规定字段结构时使用，保持与现有表单行为一致。
// 资质列表留空（由商务标页面回退后端 getQualificationTypes）；服务字段对应现有固定字段。
const DEFAULT_FORM_SCHEMA: BidFormSchema = {
  fromTender: false,
  commercial: {
    qualifications: [],
    performance: { required: false, minCount: 0, note: '' },
    serviceFields: [
      { key: 'warranty_period', label: '质保期', required: false },
      { key: 'response_time', label: '响应时间', required: false },
    ],
    priceNote: '',
  },
  pricing: {
    currency: 'CNY',
    taxRate: null,
    priceType: 'lumpSum',
    note: '',
  },
};

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
  // 报价配置（币种 / 税率 / 报价方式）来自机读解析项，缺失回退硬编码默认
  const formSchema = buildFormSchema(state);
  if (formSchema.pricing.note) noteParts.push(`报价口径：${formSchema.pricing.note}`);
  return {
    projectName: pickField(projectInfo, 'project_name'),
    projectBudget: pickField(projectInfo, 'project_budget'),
    pricingNote: noteParts.join('\n'),
    currency: formSchema.pricing.currency,
    taxRate: formSchema.pricing.taxRate,
    priceType: formSchema.pricing.priceType,
  };
}

// 把"没有提及/未提及"等占位文本归一化为空字符串
function cleanText(value: unknown): string {
  if (value === null || value === undefined) return '';
  const text = String(value).trim();
  if (!text || /没有提及|未提及|^无$/.test(text)) return '';
  return text;
}

// 把招标税率归一化为 0~1 小数：接受 0.13 / "0.13" / "13%" / "13" 等表述
function normalizeTaxRate(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number') {
    if (!Number.isFinite(value) || value < 0) return null;
    return value > 1 ? value / 100 : value;
  }
  const text = cleanText(value);
  if (!text) return null;
  const match = text.match(/[\d.]+/);
  if (!match) return null;
  const num = Number(match[0]);
  if (!Number.isFinite(num) || num < 0) return null;
  // 含百分号或 >1 的数值视为百分数
  return text.includes('%') || num > 1 ? num / 100 : num;
}

// 读取机读解析项 bidFileStructureSchema 的 JSON 内容。
// bid analysis 流程对 JSON 零校验，故此处 status 守卫 + try/catch，解析失败返回 null 回退兜底。
function parseBidFileStructureSchema(state: TechnicalPlanState | null | undefined): Record<string, unknown> | null {
  const content = getSuccessContent(state, 'bidFileStructureSchema');
  if (!content) return null;
  try {
    const parsed = JSON.parse(content);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

function asObject(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function asBool(value: unknown): boolean {
  if (typeof value === 'boolean') return value;
  const text = cleanText(value);
  return /^(true|是|必须|强制|required|y|yes|1)$/i.test(text);
}

// 把招标解析的商务标资质数组归一化
function parseQualifications(value: unknown): CommercialQualificationSchema[] {
  if (!Array.isArray(value)) return [];
  const result: CommercialQualificationSchema[] = [];
  for (const raw of value) {
    const item = asObject(raw);
    if (!item) continue;
    const name = cleanText(item.name);
    if (!name) continue;
    result.push({ name, required: asBool(item.required), formRef: cleanText(item.format_ref) });
  }
  return result;
}

// 把招标解析的商务标服务字段数组归一化
function parseServiceFields(value: unknown): CommercialServiceFieldSchema[] {
  if (!Array.isArray(value)) return [];
  const result: CommercialServiceFieldSchema[] = [];
  for (const raw of value) {
    const item = asObject(raw);
    if (!item) continue;
    const label = cleanText(item.label);
    const key = cleanText(item.key) || label;
    if (!label || !key) continue;
    result.push({ key, label, required: asBool(item.required) });
  }
  return result;
}

// 构建招标驱动的表单字段 schema：招标值优先，缺失回退硬编码默认 DEFAULT_FORM_SCHEMA。
// 全程容错——解析失败 / 字段缺失均回退兜底，保证不阻塞商务标 / 报价表单。
export function buildFormSchema(state: TechnicalPlanState | null | undefined): BidFormSchema {
  const root = parseBidFileStructureSchema(state);
  if (!root) return DEFAULT_FORM_SCHEMA;

  const commercial = asObject(root.commercial);
  const pricing = asObject(root.pricing);

  const qualifications = parseQualifications(commercial?.qualifications);
  const serviceFields = parseServiceFields(commercial?.service_fields);
  const performanceRaw = asObject(commercial?.performance);
  const minCount = performanceRaw ? Number(performanceRaw.min_count) : 0;

  const tenderTaxRate = normalizeTaxRate(pricing?.tax_rate);
  const tenderCurrency = cleanText(pricing?.currency);
  const tenderPriceType = cleanText(pricing?.price_type);

  return {
    fromTender: true,
    commercial: {
      // 招标规定资质时用招标清单，否则回退（空数组，由页面回退后端默认资质类型）
      qualifications: qualifications.length ? qualifications : DEFAULT_FORM_SCHEMA.commercial.qualifications,
      performance: {
        required: performanceRaw ? asBool(performanceRaw.required) : false,
        minCount: Number.isFinite(minCount) && minCount > 0 ? Math.floor(minCount) : 0,
        note: cleanText(performanceRaw?.note),
      },
      // 招标规定服务字段时用招标清单，否则回退现有固定字段集
      serviceFields: serviceFields.length ? serviceFields : DEFAULT_FORM_SCHEMA.commercial.serviceFields,
      priceNote: cleanText(commercial?.price_note),
    },
    pricing: {
      currency: tenderCurrency || DEFAULT_FORM_SCHEMA.pricing.currency,
      taxRate: tenderTaxRate !== null ? tenderTaxRate : DEFAULT_FORM_SCHEMA.pricing.taxRate,
      priceType: tenderPriceType || DEFAULT_FORM_SCHEMA.pricing.priceType,
      note: cleanText(pricing?.note),
    },
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
