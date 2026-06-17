import { useMemo, useState } from 'react';
import type { OutlineData, OutlineItem } from '../../../shared/types';
import type { RepairTask, RepairTaskSeverity, RepairTaskStatus } from '../../../shared/types/ipc';
import type { BidAnalysisTasks, SourceAnnotation } from '../types';

interface DeliveryCheckPageProps {
  outlineData: OutlineData | null;
  bidAnalysisTasks: BidAnalysisTasks;
  sourceAnnotations?: SourceAnnotation[];
  sourceAnnotationsLoading?: boolean;
  repairTasks: RepairTask[];
  repairTasksLoading: boolean;
  onGoToExport: () => void;
  onGoToContent: () => void;
  onGoToPricing: () => void;
  onGoToCommercialBid: () => void;
  onGoToDuplicateCheck: () => void;
  onGoToComplianceCheck: () => void;
  onCreateRepairTask: (task: Partial<RepairTask> & Pick<RepairTask, 'title' | 'sourceModule' | 'targetType'>) => Promise<void> | void;
  onUpdateRepairTask: (taskId: string, patch: Partial<RepairTask>) => Promise<void> | void;
  onApplyRepairTask?: (task: RepairTask) => Promise<void> | void;
  onBulkUpdateRepairTasks?: (taskIds: string[], status: RepairTaskStatus, decision?: string) => Promise<void> | void;
}

function collectLeafItems(items: OutlineItem[]): OutlineItem[] {
  return items.flatMap((item) => item.children?.length ? collectLeafItems(item.children) : [item]);
}

const statusLabel: Record<string, string> = {
  open: '待处理',
  in_progress: '处理中',
  needs_review: '待复核',
  fixed: '已接受',
  ignored: '已忽略',
};

const severityLabel: Record<string, string> = {
  critical: '严重',
  major: '主要',
  warning: '警告',
  info: '提示',
};

const moduleLabel: Record<string, string> = {
  delivery_check: '交付检查',
  technical_plan: '技术方案',
  pricing: '报价',
  duplicate_check: '查重',
  rejection_check: '废标检查',
  compliance: '合规',
  commercial_bid: '商务标',
  competitive_analysis: '竞争分析',
  manual: '人工录入',
};

const targetLabel: Record<string, string> = {
  technical_section: '技术章节',
  pricing_sheet: '报价单',
  commercial_section: '商务章节',
  qualification: '资质',
  project: '项目',
  document: '文档',
};

const reasonLabel: Record<string, string> = {
  missing_basic_info: '基本信息不完整',
  missing_total_amount: '缺少有效报价',
  missing_required_qualification: '必备资质还没有补齐',
  missing_performance: '缺少业绩证明材料',
  missing_project_name: '报价单缺少项目名称',
  empty_items: '报价单没有明细',
  invalid_price_item: '报价明细存在异常',
  empty_content: '章节正文为空',
  review_required: '内容需要人工复核',
};

function isOpenStatus(status: string) {
  return status === 'open' || status === 'in_progress' || status === 'needs_review';
}

function formatPatchReferences(references?: RepairTask['patch']['references']) {
  if (!references?.length) return '无';
  return references.map((item) => {
    const typeText = {
      database: '数据库记录',
      knowledge_base: '知识库',
      history_case: '历史案例',
      file: '文件',
      internet: '互联网来源',
      manual: '人工录入',
    }[item.type] || '来源';
    return `${typeText}：${item.label}${item.value ? `（${formatFriendlyToken(item.value)}）` : ''}`;
  }).join('；');
}

function formatFriendlyToken(value?: string) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  const mapped: Record<string, string> = {
    organization_code: '组织机构代码证',
    business_license: '营业执照',
    tax_registration: '税务登记证',
    safety_license: '安全生产许可证',
    iso9001: '质量管理体系认证',
    iso14001: '环境管理体系认证',
    iso45001: '职业健康安全管理体系认证',
    commercial_bid: '商务标',
    pricing: '报价',
    technical_plan: '技术方案',
    duplicate_check: '查重',
    rejection_check: '废标检查',
    compliance: '合规检查',
    competitive_analysis: '竞争分析',
  };
  if (mapped[raw]) return mapped[raw];
  return raw
    .replace(/_/g, ' ')
    .replace(/\b[a-z]/g, (letter) => letter.toUpperCase());
}

function tryParseJsonObject(value?: string) {
  const raw = String(value || '').trim();
  if (!raw || (!raw.startsWith('{') && !raw.startsWith('['))) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function formatOriginalText(value?: string) {
  const parsed = tryParseJsonObject(value);
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return value || '当前没有记录原始内容。';
  }

  const parts: string[] = [];
  const item = parsed as Record<string, unknown>;
  if (item.name) parts.push(`资料名称：${String(item.name)}`);
  if (item.required === true) parts.push('要求状态：必备资料');
  if (item.status) {
    const statusText = { pending: '待准备', completed: '已完成', na: '不适用' }[String(item.status)] || String(item.status);
    parts.push(`当前状态：${statusText}`);
  }
  if (item.certificateNo !== undefined) parts.push(`证书编号：${String(item.certificateNo) || '未填写'}`);
  if (item.validFrom !== undefined || item.validTo !== undefined) {
    parts.push(`有效期：${String(item.validFrom || '未填写')} 至 ${String(item.validTo || '未填写')}`);
  }
  if (item.name === undefined && item.quantity !== undefined) {
    parts.push(`数量：${String(item.quantity || '未填写')}`);
  }
  if (item.unitPrice !== undefined) parts.push(`单价：${String(item.unitPrice || '未填写')}`);
  return parts.length ? parts.join('；') : '当前记录包含内部结构化数据，请回到对应页面查看。';
}

function formatReasonText(task: RepairTask) {
  const reason = task.patch?.reason || '';
  if (reasonLabel[reason]) return reasonLabel[reason];
  if (task.description) return task.description;
  return '需要人工复核。';
}

function buildRepairTaskDetails(task: RepairTask) {
  return [
    {
      label: '涉及位置',
      value: `${moduleLabel[task.sourceModule] || formatFriendlyToken(task.sourceModule)} · ${targetLabel[task.targetType] || formatFriendlyToken(task.targetType)}${task.targetId ? ` · ${formatFriendlyToken(task.targetId)}` : ''}`,
    },
    { label: '当前情况', value: formatOriginalText(task.patch?.original) },
    { label: '建议处理', value: task.patch?.suggested || task.suggestion || '请回到对应页面补充或确认。' },
    { label: '原因', value: formatReasonText(task) },
    { label: '来源依据', value: formatPatchReferences(task.patch?.references) },
    ...(task.patch?.notes ? [{ label: '备注', value: task.patch.notes }] : []),
    ...(task.decision ? [{ label: '处理记录', value: task.decision }] : []),
  ];
}

function normalizeRepairTaskText(value: string) {
  return String(value || '')
    .replace(/[\u0000-\u001f]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function getModuleNavigator(sourceModule: string, handlers: {
  onGoToContent: () => void;
  onGoToPricing: () => void;
  onGoToCommercialBid: () => void;
  onGoToDuplicateCheck: () => void;
  onGoToComplianceCheck: () => void;
}) {
  if (sourceModule === 'technical_plan' || sourceModule === 'delivery_check') return handlers.onGoToContent;
  if (sourceModule === 'pricing') return handlers.onGoToPricing;
  if (sourceModule === 'commercial_bid') return handlers.onGoToCommercialBid;
  if (sourceModule === 'duplicate_check') return handlers.onGoToDuplicateCheck;
  if (sourceModule === 'compliance') return handlers.onGoToComplianceCheck;
  return null;
}

function canAutoApplyTask(task: RepairTask) {
  return task.sourceModule === 'technical_plan'
    && task.targetType === 'technical_section'
    && Boolean(task.targetId)
    && Boolean(task.patch?.suggested?.trim())
    && task.status !== 'fixed'
    && task.status !== 'ignored';
}

function DeliveryCheckPage({
  outlineData,
  bidAnalysisTasks,
  sourceAnnotations = [],
  sourceAnnotationsLoading,
  repairTasks,
  repairTasksLoading,
  onGoToExport,
  onGoToContent,
  onGoToPricing,
  onGoToCommercialBid,
  onGoToDuplicateCheck,
  onGoToComplianceCheck,
  onCreateRepairTask,
  onUpdateRepairTask,
  onApplyRepairTask,
  onBulkUpdateRepairTasks,
}: DeliveryCheckPageProps) {
  const [statusFilter, setStatusFilter] = useState<'all' | RepairTaskStatus>('all');
  const [moduleFilter, setModuleFilter] = useState('all');
  const [severityFilter, setSeverityFilter] = useState<'all' | RepairTaskSeverity>('all');
  const [selectedTaskIds, setSelectedTaskIds] = useState<Set<string>>(new Set());
  const [expandedTaskIds, setExpandedTaskIds] = useState<Set<string>>(new Set());

  const leaves = outlineData?.outline ? collectLeafItems(outlineData.outline) : [];
  const generatedLeaves = leaves.filter((item) => item.content?.trim());
  const emptyLeaves = leaves.filter((item) => !item.content?.trim());
  const requiredBidTasks = ['projectOverview', 'techRequirements', 'projectInfo', 'partAInfo', 'deliveryAndServiceRequirements'];
  const missingBidTasks = requiredBidTasks.filter((id) => bidAnalysisTasks[id]?.status !== 'success' || !bidAnalysisTasks[id]?.content?.trim());
  const pendingSources = sourceAnnotations.filter((item) => item.requiresApproval && item.approvalStatus === 'pending');
  const rejectedSources = sourceAnnotations.filter((item) => item.approvalStatus === 'rejected');
  const openRepairTasks = repairTasks.filter((task) => isOpenStatus(task.status));
  const blockingCount = emptyLeaves.length + missingBidTasks.length + rejectedSources.length + openRepairTasks.filter((task) => task.severity === 'critical' || task.severity === 'major').length;
  const warningCount = pendingSources.length + repairTasks.filter((task) => task.status === 'open' && task.severity === 'warning').length;

  const moduleOptions = useMemo(() => {
    const values = Array.from(new Set(repairTasks.map((task) => task.sourceModule).filter(Boolean)));
    return values.sort();
  }, [repairTasks]);

  const filteredTasks = useMemo(() => repairTasks.filter((task) => {
    if (statusFilter !== 'all' && task.status !== statusFilter) return false;
    if (moduleFilter !== 'all' && task.sourceModule !== moduleFilter) return false;
    if (severityFilter !== 'all' && task.severity !== severityFilter) return false;
    return true;
  }), [moduleFilter, repairTasks, severityFilter, statusFilter]);

  const selectedVisibleIds = filteredTasks.map((task) => task.id).filter((id) => selectedTaskIds.has(id));

  const toggleTask = (taskId: string) => {
    setSelectedTaskIds((prev) => {
      const next = new Set(prev);
      if (next.has(taskId)) next.delete(taskId);
      else next.add(taskId);
      return next;
    });
  };

  const selectVisible = () => {
    setSelectedTaskIds(new Set(filteredTasks.map((task) => task.id)));
  };

  const clearSelected = () => setSelectedTaskIds(new Set());

  const toggleExpanded = (taskId: string) => {
    setExpandedTaskIds((prev) => {
      const next = new Set(prev);
      if (next.has(taskId)) next.delete(taskId);
      else next.add(taskId);
      return next;
    });
  };

  const bulkUpdate = async (status: RepairTaskStatus, decision: string) => {
    if (!selectedVisibleIds.length || !onBulkUpdateRepairTasks) return;
    await onBulkUpdateRepairTasks(selectedVisibleIds, status, decision);
    clearSelected();
  };

  const navigatorHandlers = {
    onGoToContent,
    onGoToPricing,
    onGoToCommercialBid,
    onGoToDuplicateCheck,
    onGoToComplianceCheck,
  };

  const goHandleTask = async (task: RepairTask) => {
    const navigate = getModuleNavigator(String(task.sourceModule), navigatorHandlers);
    if (!navigate) return;
    if (task.status === 'open') {
      await onUpdateRepairTask(task.id, { status: 'in_progress', decision: '已进入源页面处理' });
    }
    navigate();
  };

  return (
    <div className="plan-step-body delivery-check-page">
      <section className="delivery-check-hero">
        <div>
          <span className="section-kicker">STEP 07</span>
          <strong>交付检查</strong>
          <p>这里是项目内变更审阅层。报价、商务标、查重、合规和技术正文产生的问题会汇总到这里；处理完成后再进入完整标书导出。</p>
        </div>
        <div className="delivery-check-score">
          <span>{blockingCount ? '存在阻断项' : warningCount ? '可导出，有提醒' : '可直接导出'}</span>
          <strong>{blockingCount}</strong>
          <small>阻断项</small>
        </div>
      </section>

      <section className="delivery-check-grid">
        <article className={`delivery-check-card ${emptyLeaves.length ? 'is-blocking' : 'is-ok'}`}>
          <span>正文完整性</span>
          <strong>{generatedLeaves.length}/{leaves.length || 0}</strong>
          <p>{emptyLeaves.length ? `还有 ${emptyLeaves.length} 个章节缺少正文，需要回到正文生成或扩写改写处理。` : '所有叶子章节都有正文。'}</p>
          {emptyLeaves.length > 0 && <button type="button" className="secondary-action" onClick={onGoToContent}>去修正文</button>}
        </article>

        <article className={`delivery-check-card ${missingBidTasks.length ? 'is-blocking' : 'is-ok'}`}>
          <span>招标关键项</span>
          <strong>{requiredBidTasks.length - missingBidTasks.length}/{requiredBidTasks.length}</strong>
          <p>{missingBidTasks.length ? '项目概况、技术要求、项目信息、甲方信息或交付要求仍有缺项。' : '招标关键项已齐备。'}</p>
        </article>

        <article className={`delivery-check-card ${rejectedSources.length ? 'is-blocking' : pendingSources.length ? 'is-warning' : 'is-ok'}`}>
          <span>来源确认</span>
          <strong>{sourceAnnotationsLoading ? '加载中' : sourceAnnotations.length}</strong>
          <p>{rejectedSources.length ? `${rejectedSources.length} 条来源已被拒绝。` : pendingSources.length ? `${pendingSources.length} 条外部或高风险来源待确认。` : '来源标注没有阻断风险。'}</p>
        </article>

        <article className={`delivery-check-card ${openRepairTasks.length ? 'is-warning' : 'is-ok'}`}>
          <span>修订建议</span>
          <strong>{repairTasksLoading ? '加载中' : openRepairTasks.length}</strong>
          <p>接受、忽略、回源处理只影响内部审阅状态。正式导出的 Word/PDF 不带这些内部标记。</p>
        </article>
      </section>

      <section className="delivery-check-panel">
        <div className="delivery-check-panel-head">
          <div>
            <span className="section-kicker">修订建议层</span>
            <h3>当前项目变更审阅</h3>
          </div>
          <button
            type="button"
            className="secondary-action"
            onClick={() => onCreateRepairTask({
              title: '新增人工修订建议',
              sourceModule: 'manual',
              targetType: 'project',
              severity: 'warning',
              description: '用于人工补录发现的问题或修订建议。',
              suggestion: '补充来源、原因和处理建议。',
            })}
          >
            新建建议
          </button>
        </div>

        <div className="repair-task-filterbar">
          <label>
            <span>状态</span>
            <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as 'all' | RepairTaskStatus)}>
              <option value="all">全部</option>
              {Object.entries(statusLabel).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </label>
          <label>
            <span>来源</span>
            <select value={moduleFilter} onChange={(event) => setModuleFilter(event.target.value)}>
              <option value="all">全部</option>
              {moduleOptions.map((value) => <option key={value} value={value}>{moduleLabel[value] || value}</option>)}
            </select>
          </label>
          <label>
            <span>级别</span>
            <select value={severityFilter} onChange={(event) => setSeverityFilter(event.target.value as 'all' | RepairTaskSeverity)}>
              <option value="all">全部</option>
              {Object.entries(severityLabel).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </label>
          <div className="repair-task-bulk-actions">
            <button type="button" className="secondary-action" onClick={selectVisible} disabled={!filteredTasks.length}>选择当前</button>
            <button type="button" className="secondary-action" onClick={clearSelected} disabled={!selectedTaskIds.size}>清空选择</button>
            <button type="button" className="primary-action" onClick={() => bulkUpdate('fixed', '批量接受修订建议')} disabled={!selectedVisibleIds.length || !onBulkUpdateRepairTasks}>接受选中</button>
            <button type="button" className="secondary-action" onClick={() => bulkUpdate('ignored', '批量忽略修订建议')} disabled={!selectedVisibleIds.length || !onBulkUpdateRepairTasks}>忽略选中</button>
          </div>
        </div>

        {repairTasksLoading ? (
          <div className="delivery-check-empty">正在加载修订建议...</div>
        ) : filteredTasks.length === 0 ? (
          <div className="delivery-check-empty">当前筛选条件下没有修订建议。</div>
        ) : (
          <div className="repair-task-list">
            {filteredTasks.map((task) => (
              <article key={task.id} className={`repair-task-card is-${task.status} severity-${task.severity}`}>
                <header>
                  <label className="repair-task-select">
                    <input type="checkbox" checked={selectedTaskIds.has(task.id)} onChange={() => toggleTask(task.id)} />
                    <span />
                  </label>
                  <div>
                    <strong>{task.title}</strong>
                    <p>{task.description || task.suggestion || '无说明'}</p>
                  </div>
                  <div className="repair-task-badges">
                    <span>{moduleLabel[task.sourceModule] || task.sourceModule}</span>
                    <span>{severityLabel[task.severity] || task.severity}</span>
                    <span>{statusLabel[task.status] || task.status}</span>
                  </div>
                </header>
                <div className="repair-task-meta">
                  <span>目标：{targetLabel[task.targetType] || task.targetType}{task.targetId ? ` / ${task.targetId}` : ''}</span>
                  {task.sourceRecordId && <span>来源记录：{task.sourceRecordId}</span>}
                  <span>更新时间：{new Date(task.updatedAt).toLocaleString('zh-CN', { hour12: false })}</span>
                </div>
                <button type="button" className="secondary-action" onClick={() => toggleExpanded(task.id)}>
                  {expandedTaskIds.has(task.id) ? '收起详情' : '展开详情'}
                </button>
                {expandedTaskIds.has(task.id) && (
                  <div className="repair-task-detail">
                    {buildRepairTaskDetails(task).map((item) => (
                      <p key={item.label}><strong>{item.label}：</strong>{normalizeRepairTaskText(item.value)}</p>
                    ))}
                  </div>
                )}
                <footer>
                  {canAutoApplyTask(task) && onApplyRepairTask && (
                    <button type="button" className="primary-action" onClick={() => void onApplyRepairTask(task)}>应用到正文</button>
                  )}
                  {getModuleNavigator(String(task.sourceModule), navigatorHandlers) && (
                    <button type="button" className="secondary-action" onClick={() => void goHandleTask(task)}>前往处理</button>
                  )}
                  <button type="button" className="secondary-action" onClick={() => onUpdateRepairTask(task.id, { status: 'in_progress', decision: '已进入处理' })}>处理中</button>
                  <button type="button" className="secondary-action" onClick={() => onUpdateRepairTask(task.id, { status: 'needs_review', decision: '等待复核' })}>待复核</button>
                  <button type="button" className="primary-action" onClick={() => onUpdateRepairTask(task.id, { status: 'fixed', decision: '已接受修订建议' })}>接受</button>
                  <button type="button" className="secondary-action" onClick={() => onUpdateRepairTask(task.id, { status: 'ignored', decision: '已忽略修订建议' })}>忽略</button>
                </footer>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="delivery-check-actions">
        <button type="button" className="secondary-action" onClick={onGoToContent}>返回正文校准</button>
        <button type="button" className="primary-action" onClick={onGoToExport} disabled={blockingCount > 0}>
          {blockingCount > 0 ? '先处理阻断项' : '进入导出归档'}
        </button>
      </section>
    </div>
  );
}

export default DeliveryCheckPage;
