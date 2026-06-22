import * as Dialog from '@radix-ui/react-dialog';
import { useEffect, useState } from 'react';
import DocumentAnalysisPage from './DocumentAnalysisPage';
import BidAnalysisPage from './BidAnalysisPage';
import OutlineEditPage from './OutlineEditPage';
import GlobalFactsPage from './GlobalFactsPage';
import ContentEditPage from './ContentEditPage';
import ExpandPage from './ExpandPage';
import DeliveryCheckPage from './DeliveryCheckPage';
import ExportArchivePage from './ExportArchivePage';
import VersionManagementPage from './VersionManagementPage';
import CompetitiveAnalysisPage from './CompetitiveAnalysisPage';
import ComplianceCheckPage from './ComplianceCheckPage';
import CollaborationPage from './CollaborationPage';
import { useTechnicalPlanWorkflow } from '../hooks/useTechnicalPlanWorkflow';
import { getBidAnalysisTasks } from '../services/bidAnalysisWorkflow';
import { FloatingToolbar, ToolbarArrowLeftIcon, ToolbarArrowRightIcon, useToast } from '../../../shared/ui';
import type { BackgroundTaskState, BidAnalysisTasks, ContentGenerationOptions, GlobalFactGroupState, TechnicalPlanState, TechnicalPlanStep } from '../types';
import type { BidProjectSummary, RepairTask, RepairTaskInput } from '../../../shared/types/ipc';
import type { LayoutTemplateConfig, OutlineData, OutlineItem, WordExportProgressEvent } from '../../../shared/types';
import { markRepairTasksForReview, notifyRepairTasksChanged } from '../../../shared/utils/repairTaskReview';
import { buildFormSchema } from '../../../shared/utils/tenderLinkage';

const steps: TechnicalPlanStep[] = [
  'document-analysis',
  'bid-analysis',
  'outline-generation',
  'global-facts',
  'content-edit',
  'expand',
  'delivery-check',
  'export-archive',
];

const stepLabels: Partial<Record<TechnicalPlanStep, string>> = {
  'document-analysis': '上传招标文件',
  'bid-analysis': '招标文件解析',
  'outline-generation': '目录生成',
  'global-facts': '全局事实设定',
  'content-edit': '生成正文',
  expand: '扩写改写',
};

const resetState = {
  step: 'document-analysis' as TechnicalPlanStep,
  tenderFile: null,
  projectOverview: '',
  techRequirements: '',
  bidAnalysisMode: 'full' as const,
  bidAnalysisTasks: {},
  bidAnalysisProgress: 0,
  outlineMode: 'aligned' as const,
  referenceKnowledgeDocumentIds: [] as string[],
  bidAnalysisTask: undefined,
  outlineGenerationTask: undefined,
  globalFactsTask: undefined,
  globalFacts: [] as GlobalFactGroupState[],
  contentGenerationTask: undefined,
  contentGenerationOptions: undefined,
  contentGenerationSections: {},
  contentGenerationPlans: {},
  contentGenerationRuntime: undefined,
  outlineData: null,
  scoringAnalysis: undefined,
  scoringAnalysisTask: undefined,
};

interface ExportPricingItem {
  category?: string;
  name?: string;
  specification?: string;
  unit?: string;
  quantity?: number;
  unitPrice?: number;
  subtotal?: number;
}

interface ExportPricingSheet {
  projectName?: string;
  taxRate?: number;
  discountRate?: number;
  items?: ExportPricingItem[];
  notes?: string;
  summary?: {
    subtotalBeforeTax?: number;
    discountAmount?: number;
    taxAmount?: number;
    totalAmount?: number;
    totalAmountChinese?: string;
  };
}

interface ExportCommercialTerm {
  title?: string;
  response?: string;
  deviation?: string;
}

interface ExportCommercialQualification {
  name?: string;
  certificateNo?: string;
  validFrom?: string;
  validTo?: string;
  status?: string;
}

interface ExportCommercialProject {
  name?: string;
  client?: string;
  contractAmount?: number;
  completionDate?: string;
  description?: string;
}

interface ExportCommercialCommitment {
  title?: string;
  content?: string;
}

interface ExportCommercialBid {
  projectName?: string;
  companyName?: string;
  priceType?: string;
  result?: ExportCommercialBid;
  sections?: {
    price?: { priceType?: string };
    terms?: { terms?: ExportCommercialTerm[] };
    qualifications?: { qualifications?: ExportCommercialQualification[] };
    performance?: { projects?: ExportCommercialProject[] };
    financial?: { bankCredit?: string; creditRating?: string };
    service?: { commitments?: ExportCommercialCommitment[] };
  };
}

function collectLeafItems(items: OutlineItem[]): OutlineItem[] {
  return items.flatMap((item) => item.children?.length ? collectLeafItems(item.children) : [item]);
}

function countMermaidDiagrams(content: string) {
  const mermaidBlocks = (String(content || '').match(/```mermaid[\s\S]*?```/gi) || []).length;
  const mermaidInkImages = (String(content || '').match(/https:\/\/mermaid\.ink\/img\//gi) || []).length;
  return mermaidBlocks + mermaidInkImages;
}

function countOutlineMermaidDiagrams(items: OutlineItem[]) {
  return collectLeafItems(items).reduce((sum, item) => sum + countMermaidDiagrams(item.content || ''), 0);
}

function cloneOutlineItems(items: OutlineItem[]): OutlineItem[] {
  return items.map((item) => ({
    ...item,
    children: item.children?.length ? cloneOutlineItems(item.children) : undefined,
  }));
}

function outlineToMarkdown(items: OutlineItem[], level = 1): string {
  const lines: string[] = [];
  for (const item of items) {
    const title = `${item.id || ''} ${item.title || '未命名章节'}`.trim();
    const headingLevel = Math.min(Math.max(level, 1), 6);
    lines.push(`${'#'.repeat(headingLevel)} ${title}`);
    if (item.content?.trim()) {
      lines.push('');
      lines.push(item.content.trim());
    }
    if (item.children?.length) {
      lines.push('');
      lines.push(outlineToMarkdown(item.children, level + 1));
    }
    lines.push('');
  }
  return lines.join('\n').replace(/\n{4,}/g, '\n\n\n').trim();
}

function markdownToProjectOutline(markdown: string): OutlineItem[] {
  return [{
    id: '',
    title: '',
    description: '导出前预览编辑层确认后的最终草稿',
    content: markdown,
  }];
}

function formatMoney(value: unknown) {
  return (Number(value) || 0).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function calculatePricingSummary(sheet: ExportPricingSheet) {
  const items = Array.isArray(sheet?.items) ? sheet.items : [];
  const subtotalBeforeTax = items.reduce((sum: number, item: ExportPricingItem) => sum + ((Number(item.quantity) || 0) * (Number(item.unitPrice) || 0)), 0);
  const discountAmount = subtotalBeforeTax * (Number(sheet?.discountRate) || 0);
  const afterDiscount = subtotalBeforeTax - discountAmount;
  const taxAmount = afterDiscount * (Number(sheet?.taxRate) || 0);
  return {
    subtotalBeforeTax,
    discountAmount,
    afterDiscount,
    taxAmount,
    totalAmount: afterDiscount + taxAmount,
  };
}

function buildPricingMarkdown(sheet: ExportPricingSheet) {
  const items = Array.isArray(sheet?.items) ? sheet.items : [];
  const summary = sheet?.summary || calculatePricingSummary(sheet);
  const lines = [
    '# 报价文件',
    '',
    '## 报价明细表',
    '',
    `项目名称：${sheet?.projectName || ''}`,
    '',
  ];

  if (items.length) {
    lines.push('| 序号 | 类别 | 名称 | 规格型号 | 单位 | 数量 | 单价（元） | 小计（元） |');
    lines.push('| --- | --- | --- | --- | --- | ---: | ---: | ---: |');
    items.forEach((item: ExportPricingItem, index: number) => {
      const quantity = Number(item.quantity) || 0;
      const unitPrice = Number(item.unitPrice) || 0;
      const subtotal = Number(item.subtotal) || quantity * unitPrice;
      lines.push(`| ${index + 1} | ${item.category || ''} | ${item.name || ''} | ${item.specification || ''} | ${item.unit || ''} | ${quantity} | ${formatMoney(unitPrice)} | ${formatMoney(subtotal)} |`);
    });
    lines.push('');
  }

  lines.push('## 报价汇总');
  lines.push('');
  lines.push(`- 税前小计：${formatMoney(summary.subtotalBeforeTax)} 元`);
  lines.push(`- 优惠金额：${formatMoney(summary.discountAmount)} 元`);
  lines.push(`- 税额：${formatMoney(summary.taxAmount)} 元`);
  lines.push(`- 含税合计：${formatMoney(summary.totalAmount)} 元`);
  if (sheet?.summary?.totalAmountChinese) {
    lines.push(`- 大写金额：${sheet.summary.totalAmountChinese}`);
  }
  if (sheet?.notes) {
    lines.push('');
    lines.push('## 报价备注');
    lines.push('');
    lines.push(String(sheet.notes));
  }
  return lines.join('\n');
}

function buildCommercialBidMarkdown(record: ExportCommercialBid) {
  const bid = record?.result || record;
  const sections = bid?.sections || {};
  const price = sections.price || {};
  const terms = Array.isArray(sections.terms?.terms) ? sections.terms.terms : [];
  const qualifications = Array.isArray(sections.qualifications?.qualifications) ? sections.qualifications.qualifications : [];
  const projects = Array.isArray(sections.performance?.projects) ? sections.performance.projects : [];
  const commitments = Array.isArray(sections.service?.commitments) ? sections.service.commitments : [];
  const financial = sections.financial || {};
  const lines = [
    '# 商务标',
    '',
    '## 商务响应概述',
    '',
    `项目名称：${bid?.projectName || record?.projectName || ''}`,
    `投标单位：${bid?.companyName || record?.companyName || ''}`,
    '',
    '## 投标报价说明',
    '',
    `报价方式：${price.priceType || record?.priceType || ''}`,
    '具体报价明细以本文件“报价文件”章节及本地报价管理模块最终核算结果为准。',
    '',
  ];

  if (terms.length) {
    lines.push('## 商务条款响应');
    lines.push('');
    lines.push('| 条款 | 响应情况 | 偏离说明 |');
    lines.push('| --- | --- | --- |');
    terms.forEach((term: ExportCommercialTerm) => {
      lines.push(`| ${term.title || ''} | ${term.response || ''} | ${term.deviation || '无'} |`);
    });
    lines.push('');
  }

  if (qualifications.length) {
    lines.push('## 资质证明材料');
    lines.push('');
    lines.push('| 资质名称 | 证书编号 | 有效期开始 | 有效期截止 | 状态 |');
    lines.push('| --- | --- | --- | --- | --- |');
    qualifications.forEach((item: ExportCommercialQualification) => {
      lines.push(`| ${item.name || ''} | ${item.certificateNo || ''} | ${item.validFrom || ''} | ${item.validTo || ''} | ${item.status || ''} |`);
    });
    lines.push('');
  }

  if (projects.length) {
    lines.push('## 业绩证明材料');
    lines.push('');
    lines.push('| 项目名称 | 客户 | 合同金额 | 完成时间 | 说明 |');
    lines.push('| --- | --- | ---: | --- | --- |');
    projects.forEach((project: ExportCommercialProject) => {
      lines.push(`| ${project.name || ''} | ${project.client || ''} | ${formatMoney(project.contractAmount)} | ${project.completionDate || ''} | ${project.description || ''} |`);
    });
    lines.push('');
  }

  if (financial.bankCredit || financial.creditRating) {
    lines.push('## 财务状况');
    lines.push('');
    if (financial.bankCredit) lines.push(`- 银行授信：${financial.bankCredit}`);
    if (financial.creditRating) lines.push(`- 信用评级：${financial.creditRating}`);
    lines.push('');
  }

  if (commitments.length) {
    lines.push('## 售后服务承诺');
    lines.push('');
    commitments.forEach((item: ExportCommercialCommitment, index: number) => {
      lines.push(`${index + 1}. ${item.title || '服务承诺'}：${item.content || ''}`);
    });
    lines.push('');
  }

  return lines.join('\n');
}

// 导出三块一致性硬校验分级：致命=禁止导出正式稿；重大=允许导出但需确认；普通=允许导出，进归档摘要。
type ExportIssueLevel = 'fatal' | 'major' | 'minor';

interface ExportIssue {
  level: ExportIssueLevel;
  message: string;
}

const exportIssueLevelLabel: Record<ExportIssueLevel, string> = {
  fatal: '致命问题（禁止导出正式稿）',
  major: '重大警告（需确认后导出）',
  minor: '普通提醒',
};

async function buildProjectExportOutline(outlineData: OutlineData) {
  const warnings: string[] = [];
  const outline: OutlineItem[] = [
    {
      id: '第一部分',
      title: '技术标',
      description: '当前项目技术方案正文',
      children: cloneOutlineItems(outlineData.outline),
    },
  ];

  const [commercialBids, pricingSheets] = await Promise.all([
    window.yibiao?.commercialBid?.list?.().catch(() => []),
    window.yibiao?.pricing?.list?.().catch(() => []),
  ]);
  const latestCommercialBid = Array.isArray(commercialBids) ? commercialBids[0] : null;
  const latestPricingSheet = Array.isArray(pricingSheets) ? pricingSheets[0] : null;

  if (latestCommercialBid) {
    outline.push({
      id: '第二部分',
      title: '商务标',
      description: '当前项目已保存的商务材料',
      content: buildCommercialBidMarkdown(latestCommercialBid),
    });
  } else {
    warnings.push('当前项目未找到已保存的商务材料，本次完整导出只包含技术标和已保存的报价数据。');
  }

  if (latestPricingSheet && Array.isArray((latestPricingSheet as any).items) && (latestPricingSheet as any).items.length) {
    outline.push({
      id: '第三部分',
      title: '报价文件',
      description: '本地报价管理模块核算结果',
      content: buildPricingMarkdown(latestPricingSheet),
    });
  } else {
    warnings.push('当前项目未找到有效报价明细，本次完整导出不会写入报价表。');
  }

  return { outline, warnings };
}

async function buildProjectExportPreview(outlineData: OutlineData, bidAnalysisTasks?: Record<string, any>) {
  const projectExport = await buildProjectExportOutline(outlineData);
  const [commercialBids, pricingSheets] = await Promise.all([
    window.yibiao?.commercialBid?.list?.().catch(() => []),
    window.yibiao?.pricing?.list?.().catch(() => []),
  ]);
  const latestCommercialBid = (Array.isArray(commercialBids) ? commercialBids[0] : null) as ExportCommercialBid | null;
  const latestPricingSheet = Array.isArray(pricingSheets) ? pricingSheets[0] : null;
  const bid = latestCommercialBid?.result || latestCommercialBid;

  const formSchema = buildFormSchema({ bidAnalysisTasks } as any);
  const projectInfoRaw = bidAnalysisTasks?.projectInfo?.status === 'success' ? String(bidAnalysisTasks.projectInfo.content || '') : '';
  let projectBudget = 0;
  try { projectBudget = Number(JSON.parse(projectInfoRaw)?.project_budget) || 0; } catch {}

  // 三块一致性硬校验：按《完整标书合成与版式模板方案》§8 分三级拦截。
  // 致命：缺技术正文 / 报价明细为空 / 商务标缺失 → 禁止导出正式稿；
  // 重大：报价含税合计<=0 / 商务标无资质或无业绩 / 技术正文章节过少 → 允许导出但需确认；
  // 普通：来源标注、格式提示等 → 允许导出，进归档摘要。
  const issues: ExportIssue[] = [];

  const technicalChapters = Array.isArray(outlineData?.outline) ? outlineData.outline.length : 0;
  if (!technicalChapters) {
    issues.push({ level: 'fatal', message: '缺少技术正文：目录为空或未生成任何技术标章节，无法导出正式稿。' });
  } else if (technicalChapters < 2) {
    issues.push({ level: 'major', message: '技术正文章节过少（不足 2 个一级章节），建议补全后再导出正式稿。' });
  }

  const pricingItems = (latestPricingSheet && Array.isArray((latestPricingSheet as any).items)) ? (latestPricingSheet as any).items : [];
  if (!pricingItems.length) {
    issues.push({ level: 'fatal', message: '报价明细为空：完整投标文件必须包含报价明细，请先到报价模块补齐并保存。' });
  } else if (!(Number((latestPricingSheet as any)?.summary?.totalAmount) > 0)) {
    issues.push({ level: 'major', message: '报价含税合计为 0：已有报价明细但合计金额为 0，请核对单价与数量后再导出。' });
  }

  if (!latestCommercialBid) {
    issues.push({ level: 'fatal', message: '缺少商务标：完整投标文件必须包含商务标，请先到商务标模块生成并保存。' });
  } else {
    const sections = (bid as any)?.sections || {};
    const qualifications = Array.isArray(sections.qualifications?.qualifications) ? sections.qualifications.qualifications : [];
    const projects = Array.isArray(sections.performance?.projects) ? sections.performance.projects : [];
    if (!qualifications.length) {
      issues.push({ level: 'major', message: '商务标未填写资质证明材料，请确认是否需要补充必备资质后再导出。' });
    }
    if (!projects.length) {
      issues.push({ level: 'major', message: '商务标未填写业绩证明材料，请确认是否需要补充业绩后再导出。' });
    }

    // 深度校验：招标要求资质覆盖
    if (formSchema.commercial.qualifications.length) {
      const requiredNames = formSchema.commercial.qualifications.filter((q) => q.required).map((q) => q.name);
      const filledNames = qualifications.map((q: any) => String(q.name || '').trim()).filter(Boolean);
      // 资质名称模糊匹配：仅对长度>=4 的名称做包含判断，避免"资质""证书"等短词产生假阳性覆盖。
      const missing = requiredNames.filter((name) => {
        if (name.length < 4) return !filledNames.includes(name);
        return !filledNames.some((f: string) => (f.length >= 4 && (f.includes(name) || name.includes(f))) || f === name);
      });
      if (missing.length) {
        issues.push({ level: 'major', message: `商务标缺少招标要求的必备资质（${missing.join('、')}），请确认是否需要补充。` });
      }
    }

    // 深度校验：业绩数量达标
    if (formSchema.commercial.performance.minCount > 0 && projects.length < formSchema.commercial.performance.minCount) {
      issues.push({ level: 'major', message: `商务标业绩数量不足：招标要求至少 ${formSchema.commercial.performance.minCount} 项，当前仅 ${projects.length} 项。` });
    }

    // 深度校验：资质关键字段缺失
    if (qualifications.length) {
      const missingFields = qualifications.filter((q: any) => !String(q.certificateNo || '').trim());
      if (missingFields.length) {
        issues.push({ level: 'minor', message: `商务标有 ${missingFields.length} 项资质未填写证书编号，建议补充以提高完整性。` });
      }
    }
  }

  // 深度校验：报价预算偏离
  if (projectBudget > 0 && pricingItems.length) {
    const totalAmount = Number((latestPricingSheet as any)?.summary?.totalAmount) || 0;
    if (totalAmount > 0) {
      const deviation = Math.abs(totalAmount - projectBudget) / projectBudget;
      if (deviation > 0.3) {
        const direction = totalAmount > projectBudget ? '超出' : '低于';
        issues.push({ level: 'minor', message: `报价含税合计 ${direction}招标预算超过 30%（预算 ¥${projectBudget.toLocaleString('zh-CN')}，报价 ¥${totalAmount.toLocaleString('zh-CN')}），请核对。` });
      }
    }
  }

  // 现有软提示（来源/格式类）统一归为普通级，保留原文案。
  projectExport.warnings.forEach((warning) => {
    issues.push({ level: 'minor', message: warning });
  });

  const fatalIssues = issues.filter((issue) => issue.level === 'fatal');
  const canExport = fatalIssues.length === 0;
  return {
    markdown: outlineToMarkdown(projectExport.outline),
    issues,
    // warnings 由 issues 派生，兼容现有 UI 与导出进度弹窗。
    warnings: issues.map((issue) => issue.message),
    bidderName: bid?.companyName || '',
    canExport,
    blockReason: fatalIssues.length ? fatalIssues.map((issue) => issue.message).join(' ') : '',
  };
}

interface ExportProgressState {
  open: boolean;
  running: boolean;
  progress: number;
  message: string;
  warnings: string[];
  mermaidCount: number;
  error?: string;
}

interface TechnicalPlanHomeProps {
  currentProject?: BidProjectSummary | null;
  onNavigateSection?: (section: 'business-bid' | 'pricing' | 'duplicate-check' | 'compliance-check') => void;
}

const initialExportProgress: ExportProgressState = {
  open: false,
  running: false,
  progress: 0,
  message: '',
  warnings: [],
  mermaidCount: 0,
};

const MAX_UI_TASK_LOGS = 80;
const requiredBidAnalysisTasks = getBidAnalysisTasks('full');

function hasOwnField<T extends object>(value: T, field: PropertyKey) {
  return Object.prototype.hasOwnProperty.call(value, field);
}

function trimTaskLogs(task?: BackgroundTaskState): BackgroundTaskState | undefined {
  if (!task?.logs || task.logs.length <= MAX_UI_TASK_LOGS) {
    return task;
  }

  return { ...task, logs: task.logs.slice(-MAX_UI_TASK_LOGS) };
}

function areRequiredBidAnalysisTasksReady(tasks: BidAnalysisTasks) {
  return requiredBidAnalysisTasks.every((task) => {
    const state = tasks[task.id];
    return state?.status === 'success' && state.content.trim();
  });
}

// 统一编排骨架（阶段一）：目录生成完成后作为分水岭，展示"技术正文 / 商务标 / 报价"三块。
// 目录是三块共享的骨架；技术正文留在本页流程，商务标/报价跳转到对应板块。
type OrchestrationBlockStatus = 'active' | 'ready' | 'todo';

interface OrchestrationBlock {
  id: string;
  title: string;
  description: string;
  detail?: string;
  status: OrchestrationBlockStatus;
  statusLabel: string;
  actionLabel: string;
  isCurrent: boolean;
  onClick: () => void;
}

const orchestrationStatusLabel: Record<OrchestrationBlockStatus, string> = {
  active: '进行中',
  ready: '可开始',
  todo: '待处理',
};

function BidOrchestrationBand({ blocks }: { blocks: OrchestrationBlock[] }) {
  return (
    <section className="module-panel bid-orchestration-band">
      <div className="bid-orchestration-head">
        <strong className="module-section-title">投标文件编排（以目录为骨架）</strong>
        <span className="bid-orchestration-hint">目录已生成，可在技术正文、商务标、报价三块之间切换；三块共享同一目录骨架。</span>
      </div>
      <div className="bid-orchestration-grid">
        {blocks.map((block) => (
          <article key={block.id} className={`bid-orchestration-card is-${block.status}${block.isCurrent ? ' is-current' : ''}`}>
            <div className="bid-orchestration-card-head">
              <strong>{block.title}</strong>
              <span className={`bid-orchestration-status is-${block.status}`}>{block.statusLabel}</span>
            </div>
            <p>{block.description}</p>
            {block.detail && <p className="bid-orchestration-detail">{block.detail}</p>}
            <button type="button" className="secondary-action module-action" onClick={block.onClick}>{block.actionLabel}</button>
          </article>
        ))}
      </div>
    </section>
  );
}

function clearOutlineContent(items: OutlineItem[]): OutlineItem[] {
  return items.map((item) => {
    const { content: _content, children, ...rest } = item;
    return children?.length ? { ...rest, children: clearOutlineContent(children) } : rest;
  });
}

function updateOutlineItemContent(items: OutlineItem[], itemId: string, content: string): OutlineItem[] {
  return items.map((item) => {
    if (item.id === itemId) {
      return { ...item, content };
    }

    return item.children?.length
      ? { ...item, children: updateOutlineItemContent(item.children, itemId, content) }
      : item;
  });
}

function findOutlineItem(items: OutlineItem[], itemId: string): OutlineItem | null {
  for (const item of items) {
    if (item.id === itemId) return item;
    if (item.children?.length) {
      const found = findOutlineItem(item.children, itemId);
      if (found) return found;
    }
  }
  return null;
}

function resetGeneratedContent(outlineData: OutlineData): OutlineData {
  return {
    ...outlineData,
    outline: clearOutlineContent(outlineData.outline),
  };
}

function buildTechnicalRepairTask(item: OutlineItem, content: string): RepairTaskInput | null {
  const text = String(content || '').trim();
  if (!text) {
    return {
      id: `tech-content-empty:${item.id}`,
      title: `正文缺失：${item.title}`,
      sourceModule: 'technical_plan',
      sourceRecordId: item.id,
      targetType: 'technical_section',
      targetId: item.id,
      severity: 'major',
      description: '该章节尚未形成有效正文，需要回到正文生成或扩写页面补齐。',
      suggestion: '补充该章节正文后再返回交付检查复核。',
      patch: {
        source: 'technical_plan',
        chapter: item.title,
        sectionId: item.id,
        original: '',
        suggested: '补齐章节正文',
        reason: 'empty_content',
        references: [{ type: 'file', label: '技术方案目录', value: item.id }],
      },
      metadata: { reason: 'empty_content' },
    };
  }

  if (text.length < 80 || /TODO|TBD|待补充|待完善|【待】/i.test(text)) {
    return {
      id: `tech-content-review:${item.id}`,
      title: `正文需复核：${item.title}`,
      sourceModule: 'technical_plan',
      sourceRecordId: item.id,
      targetType: 'technical_section',
      targetId: item.id,
      severity: 'warning',
      description: '章节正文已生成，但长度偏短或含有待补充标记，建议人工复核。',
      suggestion: '结合招标文件、来源标注和历史案例进行补充校准。',
      patch: {
        source: 'technical_plan',
        chapter: item.title,
        sectionId: item.id,
        original: text,
        suggested: text,
        reason: 'review_required',
        references: [{ type: 'file', label: '章节正文', value: item.id }],
        notes: '正文存在待复核标记',
      },
      metadata: { reason: 'review_required', length: text.length },
    };
  }

  return null;
}

function TechnicalPlanHome({ currentProject, onNavigateSection }: TechnicalPlanHomeProps) {
  const { hydrated, state, setState } = useTechnicalPlanWorkflow();
  const { showToast } = useToast();
  const [tenderMarkdown, setTenderMarkdown] = useState('');
  const [exportProgress, setExportProgress] = useState<ExportProgressState>(initialExportProgress);
  const [versionDialogOpen, setVersionDialogOpen] = useState(false);
  const [competitiveDialogOpen, setCompetitiveDialogOpen] = useState(false);
  const [complianceDialogOpen, setComplianceDialogOpen] = useState(false);
  const [collaborationDialogOpen, setCollaborationDialogOpen] = useState(false);
  const [sourceAnnotations, setSourceAnnotations] = useState<any[]>([]);
  const [sourceAnnotationsLoading, setSourceAnnotationsLoading] = useState(false);
  const [repairTasks, setRepairTasks] = useState<RepairTask[]>([]);
  const [repairTasksLoading, setRepairTasksLoading] = useState(false);
  const [projectPreviewMarkdown, setProjectPreviewMarkdown] = useState('');
  const [projectPreviewWarnings, setProjectPreviewWarnings] = useState<string[]>([]);
  const [projectPreviewIssues, setProjectPreviewIssues] = useState<ExportIssue[]>([]);
  const [projectPreviewBidderName, setProjectPreviewBidderName] = useState('');
  const [projectPreviewCanExport, setProjectPreviewCanExport] = useState(false);
  const [projectPreviewBlockReason, setProjectPreviewBlockReason] = useState('');
  const [projectPreviewLoading, setProjectPreviewLoading] = useState(false);
  const [layoutTemplate, setLayoutTemplate] = useState<LayoutTemplateConfig | null>(null);
  // 编排区进度联动：从商务标 / 报价的当前项目记录推导真实完成度，回写编排卡片状态。
  const [commercialBidStatus, setCommercialBidStatus] = useState<OrchestrationBlockStatus>('todo');
  const [pricingStatus, setPricingStatus] = useState<OrchestrationBlockStatus>('todo');
  const [commercialBidDetail, setCommercialBidDetail] = useState('');
  const [pricingDetail, setPricingDetail] = useState('');
  const activeIndex = steps.indexOf(state.step);
  const bidAnalysisReady = areRequiredBidAnalysisTasksReady(state.bidAnalysisTasks);
  const globalFactsReady = state.globalFacts.length > 0 && state.globalFactsTask?.status === 'success';
  const contentTaskStatus = state.contentGenerationTask?.status;
  const isContentGenerating = contentTaskStatus === 'running' || contentTaskStatus === 'pausing';
  const isContentPaused = contentTaskStatus === 'paused';
  const isExporting = exportProgress.running;
  const isNextDisabled = activeIndex >= steps.length - 1
    || (state.step === 'document-analysis' && !state.tenderFile)
    || (state.step === 'bid-analysis' && !bidAnalysisReady)
    || (state.step === 'outline-generation' && !state.outlineData)
    || (state.step === 'global-facts' && !globalFactsReady);
  const nextTooltip = state.step === 'document-analysis' && !state.tenderFile
    ? '上传完招标文件后才能进入下一步'
    : state.step === 'bid-analysis' && !bidAnalysisReady
      ? '招标文件解析完成后才能进入目录生成'
      : state.step === 'outline-generation' && !state.outlineData
        ? '目录生成完成后才能进入全局事实设定'
        : state.step === 'global-facts' && !globalFactsReady
          ? '全局事实设定完成后才能进入正文生成'
          : activeIndex >= steps.length - 1
            ? '当前已经是最后一步'
            : `进入${stepLabels[steps[activeIndex + 1]]}`;

  const switchStep = (step: TechnicalPlanStep) => {
    setState((prev) => ({ ...prev, step }));
    window.yibiao?.technicalPlan.updateStep(step).catch((error) => {
      showToast(error instanceof Error ? error.message : '保存技术方案步骤失败', 'error');
    });
  };

  const goToOffset = (offset: number) => {
    const nextStep = steps[activeIndex + offset];
    if (nextStep) {
      switchStep(nextStep);
    }
  };

  useEffect(() => {
    let mounted = true;
    window.yibiao?.config.load()
      .then((config) => {
        if (mounted) setLayoutTemplate(config?.layout_template || null);
      })
      .catch(() => {
        if (mounted) setLayoutTemplate(null);
      });
    return () => {
      mounted = false;
    };
  }, []);

  // 编排区进度联动：目录就绪后，按当前项目的商务标 / 报价记录推导完成度。
  // 商务标：无记录→待处理；有记录但无 result/report→进行中；任一有 result/report→可开始（已就绪）。
  // 报价：无 items→待处理；有 items 但含税合计<=0→进行中；含税合计>0→可开始（已就绪）。
  useEffect(() => {
    if (!state.outlineData) {
      setCommercialBidStatus('todo');
      setPricingStatus('todo');
      setCommercialBidDetail('');
      setPricingDetail('');
      return;
    }
    let cancelled = false;
    const projectId = currentProject?.id;
    Promise.all([
      window.yibiao?.commercialBid?.list?.().catch(() => []),
      window.yibiao?.pricing?.list?.().catch(() => []),
    ]).then(([commercialBids, pricingSheets]) => {
      if (cancelled) {
        return;
      }
      const scopedBids = (Array.isArray(commercialBids) ? commercialBids : []).filter(
        (item: any) => projectId == null || item?.bidProjectId == null || item?.bidProjectId === projectId,
      );
      const latestBid = scopedBids[0] as any;
      if (!latestBid) {
        setCommercialBidStatus('todo');
        setCommercialBidDetail('');
      } else if (latestBid.result || latestBid.report) {
        setCommercialBidStatus('ready');
      } else {
        setCommercialBidStatus('active');
      }
      if (latestBid) {
        const form = latestBid.sections?.[0]?.form || {};
        const parts: string[] = [];
        const quals = Array.isArray(form.qualifications) ? form.qualifications : [];
        if (quals.length) {
          const filled = quals.filter((q: any) => q.name?.trim()).length;
          parts.push(`资质 ${filled}/${quals.length}`);
        }
        const projs = Array.isArray(form.projects) ? form.projects : [];
        if (projs.length) {
          const filled = projs.filter((p: any) => p.name?.trim()).length;
          parts.push(`业绩 ${filled}/${projs.length}`);
        }
        if (latestBid.result || latestBid.report) {
          parts.push('已生成');
        }
        setCommercialBidDetail(parts.join(' · '));
      }

      const scopedSheets = (Array.isArray(pricingSheets) ? pricingSheets : []).filter(
        (item: any) => projectId == null || item?.bidProjectId == null || item?.bidProjectId === projectId,
      );
      const latestSheet = scopedSheets[0] as any;
      const sheetItems = Array.isArray(latestSheet?.items) ? latestSheet.items : [];
      if (!sheetItems.length) {
        setPricingStatus('todo');
        setPricingDetail('');
      } else if (Number(latestSheet?.summary?.totalAmount) > 0) {
        setPricingStatus('ready');
      } else {
        setPricingStatus('active');
      }
      if (sheetItems.length) {
        const total = Number(latestSheet?.summary?.totalAmount) || 0;
        const filledItems = sheetItems.filter((it: any) => it.name?.trim() && Number(it.unitPrice) > 0).length;
        const parts: string[] = [`报价项 ${filledItems}/${sheetItems.length}`];
        if (total > 0) {
          parts.push(`含税 ¥${total.toLocaleString('zh-CN', { maximumFractionDigits: 2 })}`);
        }
        setPricingDetail(parts.join(' · '));
      }
    });
    return () => {
      cancelled = true;
    };
  }, [currentProject?.id, state.outlineData]);

  useEffect(() => {
    if (!window.yibiao?.tasks) {
      return;
    }

    const unsubscribe = window.yibiao.tasks.onTaskEvent<typeof state>((event) => {
      const taskType = (event.task as { type?: string } | undefined)?.type;
      const latestTask = trimTaskLogs(event.task as BackgroundTaskState | undefined);
      const technicalPlan = event.technicalPlanPatch || event.technicalPlan;

      if (!technicalPlan) {
        return;
      }

      setState((prev) => {
        if (taskType === 'bid-analysis') {
          const outlineDataReset = hasOwnField(technicalPlan, 'outlineData') && technicalPlan.outlineData === null;
          return {
            ...prev,
            bidAnalysisTask: trimTaskLogs(technicalPlan.bidAnalysisTask) || latestTask,
            bidAnalysisTasks: {
              ...prev.bidAnalysisTasks,
              ...(technicalPlan.bidAnalysisTasks || {}),
              ...(event.bidItem ? { [event.bidItem.id]: event.bidItem } : {}),
            },
            bidAnalysisProgress: technicalPlan.bidAnalysisProgress ?? prev.bidAnalysisProgress,
            projectOverview: technicalPlan.projectOverview ?? prev.projectOverview,
            techRequirements: technicalPlan.techRequirements ?? prev.techRequirements,
            outlineGenerationTask: outlineDataReset ? undefined : prev.outlineGenerationTask,
            globalFactsTask: outlineDataReset ? undefined : prev.globalFactsTask,
            globalFacts: outlineDataReset ? [] : prev.globalFacts,
            contentGenerationTask: outlineDataReset ? undefined : prev.contentGenerationTask,
            contentGenerationOptions: outlineDataReset ? undefined : prev.contentGenerationOptions,
            contentGenerationSections: outlineDataReset ? {} : prev.contentGenerationSections,
            contentGenerationPlans: outlineDataReset ? {} : prev.contentGenerationPlans,
            contentGenerationRuntime: outlineDataReset ? undefined : prev.contentGenerationRuntime,
            outlineData: hasOwnField(technicalPlan, 'outlineData') ? (technicalPlan.outlineData || null) : prev.outlineData,
          };
        }

        if (taskType === 'outline-generation') {
          const hasOutlineData = hasOwnField(technicalPlan, 'outlineData');
          const nextOutlineData = technicalPlan.outlineGenerationTask?.status === 'success' && technicalPlan.outlineData
            ? resetGeneratedContent(technicalPlan.outlineData)
            : hasOutlineData
              ? (technicalPlan.outlineData || null)
              : prev.outlineData;
          const outlineDataChanged = nextOutlineData !== prev.outlineData;

          return {
            ...prev,
            outlineGenerationTask: trimTaskLogs(technicalPlan.outlineGenerationTask) || latestTask,
            outlineMode: technicalPlan.outlineMode ?? prev.outlineMode,
            referenceKnowledgeDocumentIds: Array.isArray(technicalPlan.referenceKnowledgeDocumentIds)
              ? technicalPlan.referenceKnowledgeDocumentIds
              : prev.referenceKnowledgeDocumentIds,
            outlineData: nextOutlineData,
            globalFactsTask: outlineDataChanged ? undefined : prev.globalFactsTask,
            globalFacts: outlineDataChanged ? [] : prev.globalFacts,
            contentGenerationTask: outlineDataChanged ? undefined : prev.contentGenerationTask,
            contentGenerationSections: outlineDataChanged ? {} : prev.contentGenerationSections,
            contentGenerationPlans: outlineDataChanged ? {} : prev.contentGenerationPlans,
            contentGenerationRuntime: outlineDataChanged ? undefined : prev.contentGenerationRuntime,
          };
        }

        if (taskType === 'global-facts-generation') {
          const hasGlobalFacts = hasOwnField(technicalPlan, 'globalFacts');
          const globalFactsChanged = hasGlobalFacts && technicalPlan.globalFacts !== prev.globalFacts;
          return {
            ...prev,
            globalFactsTask: trimTaskLogs(technicalPlan.globalFactsTask) || latestTask,
            globalFacts: hasGlobalFacts ? (technicalPlan.globalFacts || []) : prev.globalFacts,
            contentGenerationTask: globalFactsChanged ? undefined : prev.contentGenerationTask,
            contentGenerationSections: globalFactsChanged ? {} : prev.contentGenerationSections,
            contentGenerationPlans: globalFactsChanged ? {} : prev.contentGenerationPlans,
            contentGenerationRuntime: globalFactsChanged ? undefined : prev.contentGenerationRuntime,
          };
        }

        if (taskType === 'content-generation') {
          const hasPatchOutlineData = hasOwnField(technicalPlan, 'outlineData') || hasOwnField(event, 'outlineData');
          const patchOutlineData = hasOwnField(technicalPlan, 'outlineData') ? technicalPlan.outlineData : event.outlineData;
          const contentSection = event.contentSection;
          const nextSections = hasOwnField(technicalPlan, 'contentGenerationSections')
            ? (technicalPlan.contentGenerationSections || {})
            : contentSection
              ? { ...prev.contentGenerationSections, [contentSection.id]: contentSection }
              : prev.contentGenerationSections;
          const nextOutlineData = hasPatchOutlineData
            ? (patchOutlineData || null)
            : contentSection?.content !== undefined && prev.outlineData
              ? { ...prev.outlineData, outline: updateOutlineItemContent(prev.outlineData.outline, contentSection.id, contentSection.content) }
              : prev.outlineData;
          return {
            ...prev,
            contentGenerationTask: latestTask || trimTaskLogs(technicalPlan.contentGenerationTask),
            outlineMode: technicalPlan.outlineMode ?? prev.outlineMode,
            referenceKnowledgeDocumentIds: Array.isArray(technicalPlan.referenceKnowledgeDocumentIds)
              ? technicalPlan.referenceKnowledgeDocumentIds
              : prev.referenceKnowledgeDocumentIds,
            contentGenerationSections: nextSections,
            contentGenerationPlans: hasOwnField(technicalPlan, 'contentGenerationPlans') ? (technicalPlan.contentGenerationPlans || {}) : prev.contentGenerationPlans,
            contentGenerationRuntime: hasOwnField(technicalPlan, 'contentGenerationRuntime') ? technicalPlan.contentGenerationRuntime : prev.contentGenerationRuntime,
            outlineData: nextOutlineData,
          };
        }

        if (taskType === 'scoring-analysis') {
          return {
            ...prev,
            scoringAnalysisTask: trimTaskLogs(technicalPlan.scoringAnalysisTask) || latestTask,
            scoringAnalysis: hasOwnField(technicalPlan, 'scoringAnalysis') ? technicalPlan.scoringAnalysis : prev.scoringAnalysis,
          };
        }

        return prev;
      });
    });
    window.yibiao.tasks.getActiveTasks().catch((error) => {
      console.warn('获取后台任务状态失败', error);
    });

    return unsubscribe;
  }, [setState]);

  useEffect(() => {
    if (state.step !== 'document-analysis') {
      return;
    }
    if (!state.tenderFile) {
      setTenderMarkdown('');
      return;
    }
    let mounted = true;
    window.yibiao?.technicalPlan.readTenderMarkdown().then((markdown) => {
      if (mounted) setTenderMarkdown(markdown || '');
    }).catch((error) => {
      if (mounted) showToast(error instanceof Error ? error.message : '读取招标文件 Markdown 失败', 'error');
    });
    return () => {
      mounted = false;
    };
  }, [showToast, state.step, state.tenderFile]);

  useEffect(() => {
    if (state.step !== 'delivery-check' || !window.yibiao?.technicalPlan.listSourceAnnotations) {
      return;
    }
    setSourceAnnotationsLoading(true);
    window.yibiao.technicalPlan.listSourceAnnotations()
      .then((items) => setSourceAnnotations(items || []))
      .catch((error) => showToast(error instanceof Error ? error.message : '读取来源标注失败', 'error'))
      .finally(() => setSourceAnnotationsLoading(false));
  }, [showToast, state.step]);

  useEffect(() => {
    if (state.step !== 'delivery-check' || !window.yibiao?.repairTasks?.list) {
      return;
    }
    setRepairTasksLoading(true);
    window.yibiao.repairTasks.list()
      .then((items) => setRepairTasks(items || []))
      .catch((error) => showToast(error instanceof Error ? error.message : '读取修复任务失败', 'error'))
      .finally(() => setRepairTasksLoading(false));
  }, [showToast, state.step]);

  useEffect(() => {
    if (state.step !== 'export-archive' || !state.outlineData?.outline?.length) {
      return;
    }
    let mounted = true;
    setProjectPreviewLoading(true);
    buildProjectExportPreview(state.outlineData, state.bidAnalysisTasks)
      .then((result) => {
        if (!mounted) return;
        setProjectPreviewMarkdown(result.markdown);
        setProjectPreviewWarnings(result.warnings);
        setProjectPreviewIssues(result.issues);
        setProjectPreviewBidderName(result.bidderName);
        setProjectPreviewCanExport(result.canExport);
        setProjectPreviewBlockReason(result.blockReason);
      })
      .catch((error) => {
        if (!mounted) return;
        showToast(error instanceof Error ? error.message : '生成合并预览失败', 'error');
      })
      .finally(() => {
        if (mounted) setProjectPreviewLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, [showToast, state.outlineData, state.step]);

  const createRepairTask = async (task: Partial<RepairTask> & Pick<RepairTask, 'title' | 'sourceModule' | 'targetType'>) => {
    const created = await window.yibiao?.repairTasks.save(task);
    if (created) {
      setRepairTasks((prev) => [created, ...prev.filter((item) => item.id !== created.id)]);
      notifyRepairTasksChanged();
    }
  };

  const updateRepairTask = async (taskId: string, patch: Partial<RepairTask>) => {
    const updated = await window.yibiao?.repairTasks.update(taskId, patch);
    if (updated) {
      setRepairTasks((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
      notifyRepairTasksChanged();
    }
  };

  const bulkUpdateRepairTasks = async (taskIds: string[], status: RepairTask['status'], decision?: string) => {
    const api = window.yibiao?.repairTasks;
    if (!api?.bulkUpdateStatus) return;
    const result = await api.bulkUpdateStatus(taskIds, status, decision || '');
    if (result?.success) {
      setRepairTasks((prev) => prev.map((item) => (taskIds.includes(item.id) ? { ...item, status, decision: decision || item.decision } : item)));
      notifyRepairTasksChanged();
    }
  };

  const applyRepairTaskToContent = async (task: RepairTask) => {
    if (!state.outlineData?.outline?.length || task.sourceModule !== 'technical_plan' || task.targetType !== 'technical_section') {
      return;
    }
    const content = task.patch?.suggested?.trim();
    if (!content) {
      showToast('该修订建议没有可应用的建议稿', 'info');
      return;
    }
    const item = findOutlineItem(state.outlineData.outline, task.targetId);
    if (!item) {
      showToast('未找到对应技术章节，无法自动应用', 'error');
      return;
    }

    await saveChapterContent(item, content);
    const updated = await window.yibiao?.repairTasks.update(task.id, {
      status: 'fixed',
      decision: '已自动应用到技术正文',
    });
    if (updated) {
      setRepairTasks((prev) => prev.map((entry) => (entry.id === updated.id ? updated : entry)));
      notifyRepairTasksChanged();
    }
    showToast('修订建议已应用到技术正文', 'success');
  };

  const exportWord = async (scope: 'technical' | 'project' = 'technical', previewMarkdown = '') => {
    if (!state.outlineData?.outline?.length) {
      showToast('请先生成目录', 'info');
      return;
    }

    if (scope === 'project') {
      const [commercialBids, pricingSheets] = await Promise.all([
        window.yibiao?.commercialBid?.list?.().catch(() => []),
        window.yibiao?.pricing?.list?.().catch(() => []),
      ]);
      const hasCommercialBid = Array.isArray(commercialBids) && commercialBids.length > 0;
      const hasPricingSheet = Array.isArray(pricingSheets) && pricingSheets.some((sheet) => Array.isArray((sheet as any)?.items) && (sheet as any).items.length);
      if (!hasCommercialBid || !hasPricingSheet) {
        const missing: string[] = [];
        if (!hasCommercialBid) missing.push('商务标');
        if (!hasPricingSheet) missing.push('报价明细');
        showToast(`完整投标文件必须先补齐 ${missing.join('、')} 后才能导出`, 'error');
        return;
      }
    }

    const requestId = `export-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    let exportOutline = state.outlineData.outline;
    const projectWarnings: string[] = [];
    if (scope === 'project') {
      if (previewMarkdown.trim()) {
        exportOutline = markdownToProjectOutline(previewMarkdown.trim());
        projectWarnings.push(...projectPreviewWarnings);
      } else {
        const projectExport = await buildProjectExportOutline(state.outlineData);
        exportOutline = projectExport.outline;
        projectWarnings.push(...projectExport.warnings);
      }
    }
    const mermaidCount = countOutlineMermaidDiagrams(exportOutline);
    let unsubscribe: (() => void) | undefined;

    try {
      setExportProgress({
        open: true,
        running: true,
        progress: 2,
        message: mermaidCount
          ? `检测到 ${mermaidCount} 张 Mermaid 图，导出时会转换为 Word 图片，可能需要稍等。`
          : scope === 'project'
            ? '正在合成项目级完整标书 Word。'
            : '正在准备导出 Word。',
        warnings: projectWarnings,
        mermaidCount,
      });

      unsubscribe = window.yibiao?.export.onWordExportProgress((event: WordExportProgressEvent) => {
        if (event.requestId && event.requestId !== requestId) {
          return;
        }

        setExportProgress((prev) => ({
          ...prev,
          open: true,
          running: event.phase === 'running',
          progress: event.progress,
          message: event.message,
          warnings: event.warnings || prev.warnings,
          error: event.phase === 'error' ? event.message : undefined,
        }));
      });

      const result = await window.yibiao?.export.exportWord({
        requestId,
        project_name: state.outlineData.project_name,
        doc_type: scope === 'project' ? '完整投标文件' : '技术标',
        outline: exportOutline,
      });
      if (result?.canceled) {
        setExportProgress(initialExportProgress);
        showToast('已取消导出', 'info');
        return;
      }
      setExportProgress((prev) => ({
        ...prev,
        open: true,
        running: false,
        progress: 100,
        message: result?.message || 'Word 已导出，请打开文档核对图片、表格和版式。',
        warnings: [...projectWarnings, ...(result?.warnings || [])],
      }));
      showToast(result?.message || 'Word 已导出', result?.warnings?.length ? 'info' : 'success');
    } catch (error) {
      const message = error instanceof Error ? error.message : '导出 Word 失败';
      setExportProgress((prev) => ({
        ...prev,
        open: true,
        running: false,
        progress: 100,
        message,
        error: message,
      }));
      showToast(message, 'error');
    } finally {
      unsubscribe?.();
    }
  };

  const refreshProjectPreview = async () => {
    if (!state.outlineData?.outline?.length) {
      showToast('请先生成技术正文目录', 'info');
      return;
    }

    setProjectPreviewLoading(true);
    try {
      const result = await buildProjectExportPreview(state.outlineData, state.bidAnalysisTasks);
      setProjectPreviewMarkdown(result.markdown);
      setProjectPreviewWarnings(result.warnings);
      setProjectPreviewIssues(result.issues);
      setProjectPreviewBidderName(result.bidderName);
      setProjectPreviewCanExport(result.canExport);
      setProjectPreviewBlockReason(result.blockReason);
      showToast('合并预览已刷新', 'success');
    } catch (error) {
      showToast(error instanceof Error ? error.message : '刷新合并预览失败', 'error');
    } finally {
      setProjectPreviewLoading(false);
    }
  };

  const saveProjectPreviewDraft = (previewMarkdown: string) => {
    setProjectPreviewMarkdown(previewMarkdown);
  };

  const saveChapterContent = async (item: OutlineItem, content: string) => {
    if (!state.outlineData?.outline?.length) {
      throw new Error('当前没有可保存的目录');
    }

    const updatedOutlineData = {
      ...state.outlineData,
      outline: updateOutlineItemContent(state.outlineData.outline, item.id, content),
    };
    const updatedSections = {
      ...state.contentGenerationSections,
      [item.id]: {
        id: item.id,
        title: item.title || '未命名章节',
        status: content.trim() ? 'success' as const : 'idle' as const,
        content,
        updated_at: new Date().toISOString(),
      },
    };

    setState((prev) => ({
      ...prev,
      outlineData: updatedOutlineData,
      contentGenerationSections: updatedSections,
    }));
    const saved = await window.yibiao?.technicalPlan.saveChapterContent({ nodeId: item.id, content });
    if (saved) setState((prev) => ({ ...prev, ...saved }));
    const repairTask = buildTechnicalRepairTask(item, content);
    if (repairTask && window.yibiao?.repairTasks?.save) {
      await window.yibiao.repairTasks.save(repairTask);
      notifyRepairTasksChanged();
    } else {
      await markRepairTasksForReview({
        sourceModule: 'technical_plan',
        targetType: 'technical_section',
        targetId: item.id,
        decision: '章节正文已保存，等待交付检查复核',
      });
    }
  };

  const resetTechnicalPlan = async () => {
    if (!window.confirm('会清空整个技术方案编写进度，是否确认？')) {
      return;
    }

    try {
      const result = await window.yibiao?.technicalPlan.clear();
      setState(result?.state || resetState);
      setTenderMarkdown('');
      showToast(result?.message || '技术方案已重置', 'success');
    } catch (error) {
      showToast(error instanceof Error ? error.message : '重置技术方案失败', 'error');
    }
  };

  const saveContentGenerationOptions = async (contentGenerationOptions: ContentGenerationOptions) => {
    const saved = await window.yibiao?.technicalPlan.saveContentGenerationOptions(contentGenerationOptions);
    setState((prev) => ({ ...prev, ...(saved || {}), contentGenerationOptions }));
  };

  const saveGlobalFacts = async (globalFacts: GlobalFactGroupState[]) => {
    const saved = await window.yibiao?.technicalPlan.saveGlobalFacts(globalFacts);
    setState((prev) => ({ ...prev, ...(saved || {}), globalFacts }));
  };

  const generatedContentCount = state.outlineData?.outline
    ? collectLeafItems(state.outlineData.outline).filter((item) => item.content?.trim()).length
    : 0;

  const navigationActions = state.step === 'content-edit'
    ? [
      {
        id: 'previous-step',
        label: '上一步',
        icon: <ToolbarArrowLeftIcon />,
        disabled: activeIndex <= 0,
        tooltip: activeIndex <= 0 ? '当前已经是第一步' : `返回${stepLabels[steps[activeIndex - 1]]}`,
        onClick: () => goToOffset(-1),
      },
      {
        id: 'continue-expand',
        label: '继续扩写',
        icon: <ToolbarArrowRightIcon />,
        disabled: !state.outlineData,
        tooltip: '进入扩写改写步骤',
        onClick: () => switchStep('expand'),
      },
    ]
    : [
      {
        id: 'previous-step',
        label: '上一步',
        icon: <ToolbarArrowLeftIcon />,
        disabled: activeIndex <= 0,
        tooltip: activeIndex <= 0 ? '当前已经是第一步' : `返回${stepLabels[steps[activeIndex - 1]]}`,
        onClick: () => goToOffset(-1),
      },
      {
        id: 'next-step',
        label: '下一步',
        icon: <ToolbarArrowRightIcon />,
        variant: 'primary' as const,
        disabled: isNextDisabled,
        tooltip: nextTooltip,
        onClick: () => goToOffset(1),
      },
    ];

  const toolbarGroups = [
    {
      id: 'technical-plan-reset',
      actions: [
        {
          id: 'reset',
          label: '重置',
          variant: 'danger' as const,
          tooltip: '清空当前技术方案流程',
          onClick: resetTechnicalPlan,
        },
        {
          id: 'home',
          label: '首页',
          variant: state.step === 'document-analysis' ? 'primary' as const : 'secondary' as const,
          tooltip: '回到上传招标文件',
          onClick: () => switchStep('document-analysis'),
        },
        {
          id: 'versions',
          label: '版本',
          variant: 'secondary' as const,
          tooltip: '版本管理：保存、查看、恢复历史版本',
          onClick: () => setVersionDialogOpen(true),
        },
        {
          id: 'competitive',
          label: '竞品',
          variant: 'secondary' as const,
          tooltip: '竞品分析：基于评分要求分析竞争策略',
          onClick: () => setCompetitiveDialogOpen(true),
        },
        {
          id: 'compliance',
          label: '合规',
          variant: 'secondary' as const,
          tooltip: '合规检查：检查投标文件是否符合法规要求',
          onClick: () => setComplianceDialogOpen(true),
        },
        {
          id: 'collaboration',
          label: '协同',
          variant: 'secondary' as const,
          tooltip: '协同编辑：多人实时协同编辑技术方案',
          onClick: () => setCollaborationDialogOpen(true),
        },
      ],
    },
    {
      id: 'technical-plan-navigation',
      actions: navigationActions,
    },
  ];

  const orchestrationVisible = Boolean(state.outlineData);
  const technicalBlockStep: TechnicalPlanStep = globalFactsReady ? 'content-edit' : 'global-facts';
  const isTechnicalBlockCurrent = ['global-facts', 'content-edit', 'expand', 'delivery-check', 'export-archive'].includes(state.step);
  const orchestrationBlocks: OrchestrationBlock[] = [
    {
      id: 'technical',
      title: '技术正文',
      description: '基于目录骨架生成技术方案正文、全局事实与扩写改写。',
      status: isTechnicalBlockCurrent ? 'active' : 'ready',
      statusLabel: isTechnicalBlockCurrent ? orchestrationStatusLabel.active : orchestrationStatusLabel.ready,
      actionLabel: isTechnicalBlockCurrent ? '继续技术正文' : '进入技术正文',
      isCurrent: isTechnicalBlockCurrent,
      onClick: () => switchStep(technicalBlockStep),
    },
    {
      id: 'business',
      title: '商务标',
      description: '生成商务材料草稿，资质、业绩、报价说明等结构化中间层。',
      detail: commercialBidDetail,
      status: commercialBidStatus,
      statusLabel: orchestrationStatusLabel[commercialBidStatus],
      actionLabel: '前往商务标',
      isCurrent: false,
      onClick: () => onNavigateSection?.('business-bid'),
    },
    {
      id: 'pricing',
      title: '报价',
      description: '在本地维护报价明细与税费核算，供商务标与最终合成引用。',
      detail: pricingDetail,
      status: pricingStatus,
      statusLabel: orchestrationStatusLabel[pricingStatus],
      actionLabel: '前往报价',
      isCurrent: false,
      onClick: () => onNavigateSection?.('pricing'),
    },
  ];

  return (
    <div className="page-stack technical-workbench">
      {orchestrationVisible && <BidOrchestrationBand blocks={orchestrationBlocks} />}
      {state.step === 'document-analysis' && (
        <DocumentAnalysisPage
          tenderFile={state.tenderFile}
          tenderMarkdown={tenderMarkdown}
          parseQuality={state.tenderParseQuality}
          projectTenderFile={currentProject?.tenderFilePath ? {
            fileName: currentProject.tenderFileName || '',
            filePath: currentProject.tenderFilePath,
          } : null}
          onFileImported={(nextState, markdown) => {
            setState((prev) => ({ ...prev, ...nextState }));
            setTenderMarkdown(markdown);
          }}
        />
      )}

      {state.step === 'bid-analysis' && (
        <BidAnalysisPage
          hasTenderFile={Boolean(state.tenderFile)}
          mode={state.bidAnalysisMode}
          tasks={state.bidAnalysisTasks}
          task={state.bidAnalysisTask}
          progress={state.bidAnalysisProgress}
          techRequirements={state.techRequirements}
          scoringAnalysis={state.scoringAnalysis}
          scoringAnalysisTask={state.scoringAnalysisTask}
          onModeChange={(mode) => setState((prev) => ({ ...prev, bidAnalysisMode: mode }))}
          onTasksChange={(updater) => setState((prev) => ({ ...prev, bidAnalysisTasks: updater(prev.bidAnalysisTasks) }))}
          onProgressChange={(progress) => setState((prev) => ({ ...prev, bidAnalysisProgress: progress }))}
          onRequiredResultChange={(projectOverview, techRequirements) => setState((prev) => ({
            ...prev,
            projectOverview,
            techRequirements,
          }))}
          onScoringAnalysisStart={() => {
            window.yibiao?.tasks.startScoringAnalysis({}).catch((error) => {
              showToast(error instanceof Error ? error.message : '启动评分分析失败', 'error');
            });
          }}
        />
      )}
      {state.step === 'outline-generation' && (
        <OutlineEditPage
          projectOverview={state.projectOverview}
          techRequirements={state.techRequirements}
          outlineMode={state.outlineMode}
          referenceKnowledgeDocumentIds={state.referenceKnowledgeDocumentIds}
          outlineData={state.outlineData}
          task={state.outlineGenerationTask}
          hasTenderFileStructure={state.bidAnalysisTasks?.bidFileStructure?.status === 'success' && Boolean(state.bidAnalysisTasks.bidFileStructure.content?.trim())}
          onOutlineConfigChange={(outlineMode, referenceKnowledgeDocumentIds) => {
            setState((prev) => ({ ...prev, outlineMode, referenceKnowledgeDocumentIds }));
            window.yibiao?.technicalPlan.saveOutlineConfig({ outlineMode, referenceKnowledgeDocumentIds }).then((saved) => {
              setState((prev) => ({ ...prev, ...saved }));
            }).catch((error) => {
              showToast(error instanceof Error ? error.message : '保存目录配置失败', 'error');
            });
          }}
          onOutlineGenerated={(outlineData) => {
            const nextOutlineData = resetGeneratedContent(outlineData);
            setState((prev) => ({
              ...prev,
              outlineData: nextOutlineData,
              globalFactsTask: undefined,
              globalFacts: [],
              contentGenerationTask: undefined,
              contentGenerationSections: {},
              contentGenerationPlans: {},
              contentGenerationRuntime: undefined,
            }));
            window.yibiao?.technicalPlan.saveOutline(nextOutlineData).then((saved) => {
              setState((prev) => ({ ...prev, ...saved }));
            }).catch((error) => {
              showToast(error instanceof Error ? error.message : '保存目录失败', 'error');
            });
          }}
        />
      )}
      {state.step === 'global-facts' && (
        <GlobalFactsPage
          outlineData={state.outlineData}
          globalFacts={state.globalFacts}
          task={state.globalFactsTask}
          onGlobalFactsSaved={saveGlobalFacts}
        />
      )}
      {state.step === 'content-edit' && (
        <ContentEditPage
          outlineData={state.outlineData}
          task={state.contentGenerationTask}
          contentGenerationOptions={state.contentGenerationOptions}
          sections={state.contentGenerationSections}
          onContentGenerationOptionsChange={saveContentGenerationOptions}
          onContentSaved={saveChapterContent}
        />
      )}
      {state.step === 'expand' && (
        <ExpandPage
          outlineData={state.outlineData}
          task={state.contentGenerationTask}
          contentGenerationOptions={state.contentGenerationOptions}
          sections={state.contentGenerationSections}
          onContentSaved={saveChapterContent}
        />
      )}
      {state.step === 'delivery-check' && (
        <DeliveryCheckPage
          outlineData={state.outlineData}
          bidAnalysisTasks={state.bidAnalysisTasks}
          sourceAnnotations={sourceAnnotations}
          sourceAnnotationsLoading={sourceAnnotationsLoading}
          repairTasks={repairTasks}
          repairTasksLoading={repairTasksLoading}
          onGoToContent={() => switchStep('content-edit')}
          onGoToExport={() => switchStep('export-archive')}
          onGoToPricing={() => onNavigateSection?.('pricing')}
          onGoToCommercialBid={() => onNavigateSection?.('business-bid')}
          onGoToDuplicateCheck={() => onNavigateSection?.('duplicate-check')}
          onGoToComplianceCheck={() => onNavigateSection?.('compliance-check')}
          onCreateRepairTask={createRepairTask}
          onUpdateRepairTask={updateRepairTask}
          onApplyRepairTask={applyRepairTaskToContent}
          onBulkUpdateRepairTasks={bulkUpdateRepairTasks}
        />
      )}
      {state.step === 'export-archive' && (
        <ExportArchivePage
          outlineData={state.outlineData}
          exporting={isExporting}
          generatedContentCount={generatedContentCount}
          exportBlocked={!projectPreviewCanExport}
          exportBlockReason={projectPreviewBlockReason}
          bidderName={projectPreviewBidderName}
          previewMarkdown={projectPreviewMarkdown}
          previewWarnings={projectPreviewWarnings}
          previewIssues={projectPreviewIssues}
          previewLoading={projectPreviewLoading}
          layoutTemplate={layoutTemplate}
          onRefreshPreview={refreshProjectPreview}
          onSavePreviewDraft={saveProjectPreviewDraft}
          onExportWord={(previewMarkdown) => void exportWord('project', previewMarkdown)}
          onOpenVersions={() => setVersionDialogOpen(true)}
          onBackToCheck={() => switchStep('delivery-check')}
        />
      )}

      <Dialog.Root
        open={exportProgress.open}
        onOpenChange={(open) => {
          if (!open && !exportProgress.running) {
            setExportProgress(initialExportProgress);
          }
        }}
      >
        <Dialog.Portal>
          <Dialog.Overlay className="content-regenerate-modal" />
          <Dialog.Content className="export-progress-card">
            <div className="content-regenerate-card-head">
              <span className="section-kicker">Word 导出</span>
              <Dialog.Title>{exportProgress.running ? '正在导出 Word' : exportProgress.error ? '导出失败' : '导出完成'}</Dialog.Title>
              <Dialog.Description>
                {exportProgress.mermaidCount > 0
                  ? `本次包含 ${exportProgress.mermaidCount} 张 Mermaid 图，导出时会通过 mermaid.ink 转换成 Word 图片，速度受网络影响。`
                  : '正在将正文、表格和图片写入 Word 文档。'}
              </Dialog.Description>
            </div>
            <div className="export-progress-body">
              <div className="content-generation-progress-track" aria-label={`Word 导出进度 ${exportProgress.progress}%`}>
                <span style={{ width: `${exportProgress.progress}%` }} />
              </div>
              <p>{exportProgress.message || '正在处理导出任务，请稍候。'}</p>
              {exportProgress.warnings.length > 0 && (
                <div className="export-warning-list">
                  <strong>需要核对</strong>
                  {exportProgress.warnings.slice(0, 4).map((warning) => <small key={warning}>{warning}</small>)}
                  {exportProgress.warnings.length > 4 && <small>还有 {exportProgress.warnings.length - 4} 条图片提示，请打开导出的 Word 核对。</small>}
                </div>
              )}
            </div>
            {!exportProgress.running && (
              <div className="content-regenerate-actions">
                <Dialog.Close className="primary-action" type="button">知道了</Dialog.Close>
              </div>
            )}
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      {/* 版本管理对话框 */}
      <Dialog.Root open={versionDialogOpen} onOpenChange={setVersionDialogOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="dialog-overlay" />
          <Dialog.Content className="dialog-content version-management-dialog">
            <Dialog.Title className="dialog-title">版本管理</Dialog.Title>
            <Dialog.Description className="dialog-description">
              保存当前工作进度，查看历史版本，支持版本对比和恢复。
            </Dialog.Description>
            <VersionManagementPage onRestore={() => setVersionDialogOpen(false)} />
            <Dialog.Close asChild>
              <button type="button" className="dialog-close-button" aria-label="关闭">✕</button>
            </Dialog.Close>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      {/* 竞品分析对话框 */}
      <Dialog.Root open={competitiveDialogOpen} onOpenChange={setCompetitiveDialogOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="dialog-overlay" />
          <Dialog.Content className="dialog-content competitive-analysis-dialog">
            <Dialog.Title className="dialog-title">竞品分析</Dialog.Title>
            <Dialog.Description className="dialog-description">
              基于评分要求和行业知识，分析竞争策略和关键得分领域。
            </Dialog.Description>
            <CompetitiveAnalysisPage
              scoringAnalysis={state.scoringAnalysis}
              industryCode={state.industryCode}
              projectInfo={state.bidAnalysisTasks?.projectInfo?.content ? JSON.parse(state.bidAnalysisTasks.projectInfo.content) : undefined}
            />
            <Dialog.Close asChild>
              <button type="button" className="dialog-close-button" aria-label="关闭">✕</button>
            </Dialog.Close>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      {/* 合规检查对话框 */}
      <Dialog.Root open={complianceDialogOpen} onOpenChange={setComplianceDialogOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="dialog-overlay" />
          <Dialog.Content className="dialog-content compliance-check-dialog">
            <Dialog.Title className="dialog-title">合规性检查</Dialog.Title>
            <Dialog.Description className="dialog-description">
              检查投标文件是否符合招投标法规要求，包括格式合规、资质要求、时间节点、保证金等检查项。
            </Dialog.Description>
            <ComplianceCheckPage
              bidAnalysis={state.bidAnalysisTasks}
              technicalPlan={state as Partial<TechnicalPlanState>}
            />
            <Dialog.Close asChild>
              <button type="button" className="dialog-close-button" aria-label="关闭">✕</button>
            </Dialog.Close>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      {/* 协同编辑对话框 */}
      <Dialog.Root open={collaborationDialogOpen} onOpenChange={setCollaborationDialogOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="dialog-overlay" />
          <Dialog.Content className="dialog-content collaboration-dialog">
            <Dialog.Title className="dialog-title">协同编辑</Dialog.Title>
            <Dialog.Description className="dialog-description">
              多人实时协同编辑技术方案，支持多人同时编辑、实时同步、光标显示。
            </Dialog.Description>
            <CollaborationPage
              technicalPlan={state as Partial<TechnicalPlanState>}
              onSessionCreated={(session) => {
                showToast(`协同会话已创建: ${session.id.slice(0, 8)}...`, 'success');
              }}
            />
            <Dialog.Close asChild>
              <button type="button" className="dialog-close-button" aria-label="关闭">✕</button>
            </Dialog.Close>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      {state.step !== 'export-archive' && <FloatingToolbar groups={toolbarGroups} label="技术方案工具条" />}
    </div>
  );
}

export default TechnicalPlanHome;
