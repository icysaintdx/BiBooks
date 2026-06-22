import { useCallback, useEffect, useMemo, useState } from 'react';
import { useToast } from '../../../shared/ui';
import type { BidProjectSummary, RepairTaskInput } from '../../../shared/types/ipc';
import { markRepairTasksForReview, notifyRepairTasksChanged } from '../../../shared/utils/repairTaskReview';
import { buildPricingTenderSeed, loadTenderPlanState } from '../../../shared/utils/tenderLinkage';

interface PricingItem {
  id: string;
  category: string;
  name: string;
  specification: string;
  unit: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
  notes: string;
}

interface PricingSheet {
  id: string;
  bidProjectId?: string;
  projectName: string;
  taxRate: number;
  discountRate: number;
  items: PricingItem[];
  notes: string;
}

interface PricingSheetRecord extends PricingSheet {
  createdAt?: string;
  updatedAt?: string;
  summary?: {
    subtotalBeforeTax?: number;
    discountAmount?: number;
    afterDiscount?: number;
    taxAmount?: number;
    totalAmount?: number;
    totalAmountChinese?: string;
  };
}

const CATEGORIES = ['设备费', '人工费', '材料费', '管理费', '利润', '税金', '其他'];

function createId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function roundMoney(amount: number) {
  return Math.round(amount * 100) / 100;
}

function formatMoney(amount: number) {
  return amount.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatPricingError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  if (/No handler registered for 'pricing:list'|pricing:list/i.test(message)) {
    return '报价模块没有连接到主进程。请完全退出并重新启动 BiBooks；如果仍然出现，说明当前运行的桌面端不是最新构建。';
  }
  if (/工作区数据库初始化失败/.test(message)) {
    return message;
  }
  return `加载报价单失败：${message}`;
}

function emptySheet(projectName = ''): PricingSheet {
  return {
    id: createId(),
    projectName,
    taxRate: 0.13,
    discountRate: 0,
    items: [],
    notes: '',
  };
}

function normalizeRecord(record: Partial<PricingSheetRecord>): PricingSheetRecord {
  return {
    id: record.id || createId(),
    bidProjectId: record.bidProjectId || '',
    projectName: record.projectName || '',
    taxRate: Number(record.taxRate ?? 0.13),
    discountRate: Number(record.discountRate ?? 0),
    items: Array.isArray(record.items) ? record.items.map((item) => ({
      id: item.id || createId(),
      category: item.category || CATEGORIES[0],
      name: item.name || '',
      specification: item.specification || '',
      unit: item.unit || '',
      quantity: Number(item.quantity) || 0,
      unitPrice: Number(item.unitPrice) || 0,
      subtotal: Number(item.subtotal) || 0,
      notes: item.notes || '',
    })) : [],
    notes: record.notes || '',
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    summary: record.summary,
  };
}

function computeSummary(sheet: PricingSheet) {
  const subtotalBeforeTax = roundMoney(sheet.items.reduce((sum, item) => sum + roundMoney(item.quantity * item.unitPrice), 0));
  const discountAmount = roundMoney(subtotalBeforeTax * (sheet.discountRate || 0));
  const afterDiscount = roundMoney(subtotalBeforeTax - discountAmount);
  const taxAmount = roundMoney(afterDiscount * (sheet.taxRate || 0));
  const totalAmount = roundMoney(afterDiscount + taxAmount);
  return { subtotalBeforeTax, discountAmount, afterDiscount, taxAmount, totalAmount };
}

function buildPricingRepairTasks(sheet: PricingSheet): RepairTaskInput[] {
  const tasks: RepairTaskInput[] = [];
  if (!sheet.projectName.trim()) {
    tasks.push({
      title: '报价单缺少项目名称',
      sourceModule: 'pricing',
      sourceRecordId: sheet.id,
      targetType: 'pricing_sheet',
      targetId: sheet.id,
      severity: 'major',
      description: '当前报价单没有项目名称，最终合成和商务标引用时无法稳定匹配项目。',
      suggestion: '在报价管理页补齐项目名称，优先从当前投标项目自动带入。',
      patch: {
        source: 'pricing',
        field: 'projectName',
        original: sheet.projectName,
        suggested: '从当前项目带入或人工填写项目名称',
        reason: 'missing_project_name',
        references: [{ type: 'database', label: '报价单', value: sheet.id }],
      },
    });
  }
  if (sheet.items.length === 0) {
    tasks.push({
      title: '报价单没有明细项',
      sourceModule: 'pricing',
      sourceRecordId: sheet.id,
      targetType: 'pricing_sheet',
      targetId: sheet.id,
      severity: 'critical',
      description: '报价单没有任何明细项，商务标或最终导出无法形成有效报价表。',
      suggestion: '至少补充一个报价明细项，并由本地脚本重新计算税费、优惠和合计。',
      patch: {
        source: 'pricing',
        field: 'items',
        original: '[]',
        suggested: '补充报价明细项并由本地脚本重新计算',
        reason: 'empty_items',
        references: [{ type: 'database', label: '报价单', value: sheet.id }],
      },
    });
  }
  for (const item of sheet.items) {
    if (!item.name.trim() || item.quantity <= 0 || item.unitPrice < 0) {
      tasks.push({
        title: `报价明细需要复核：${item.name || '未命名明细'}`,
        sourceModule: 'pricing',
        sourceRecordId: sheet.id,
        targetType: 'pricing_sheet',
        targetId: sheet.id,
        severity: item.quantity <= 0 ? 'major' : 'warning',
        description: '明细名称、数量或单价存在缺失/异常，不能交给 AI 猜测或自动补价。',
        suggestion: '回到报价页由人工确认真实数量、单价和规格。',
        patch: {
          source: 'pricing',
          field: `items.${item.id}`,
          original: JSON.stringify({ name: item.name, quantity: item.quantity, unitPrice: item.unitPrice }),
          suggested: '人工确认名称、数量、单价后由本地脚本重新计算',
          reason: 'invalid_price_item',
          references: [{ type: 'database', label: '报价明细', value: item.id }],
        },
        metadata: { itemId: item.id },
      });
    }
  }
  return tasks;
}

interface PricingPageProps {
  currentProject: BidProjectSummary | null;
}

function PricingPage({ currentProject }: PricingPageProps) {
  const { showToast } = useToast();
  const [sheets, setSheets] = useState<PricingSheetRecord[]>([]);
  const [currentId, setCurrentId] = useState('');
  const [currentProjectName, setCurrentProjectName] = useState('');
  const [tenderPricingNote, setTenderPricingNote] = useState('');
  const [sheet, setSheet] = useState<PricingSheet>(emptySheet());
  const [editingItem, setEditingItem] = useState<PricingItem | null>(null);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [loading, setLoading] = useState(true);

  const summary = useMemo(() => computeSummary(sheet), [sheet]);
  const categoryGroups = useMemo(() => {
    const groups: Record<string, PricingItem[]> = {};
    for (const item of sheet.items) {
      const category = item.category || '未分类';
      if (!groups[category]) groups[category] = [];
      groups[category].push(item);
    }
    return groups;
  }, [sheet.items]);

  const loadSheets = useCallback(async () => {
    setLoading(true);
    try {
      const [records, tenderState] = await Promise.all([
        window.yibiao?.pricing?.list(),
        loadTenderPlanState(),
      ]);
      // 项目名优先用当前项目 prop，缺失再回退招标解析的项目信息
      const tenderSeed = buildPricingTenderSeed(tenderState);
      const fallbackName = currentProject?.name || tenderSeed.projectName || '';
      setCurrentProjectName(fallbackName);
      setTenderPricingNote(tenderSeed.pricingNote);

      const normalized = Array.isArray(records) ? records.map((record) => normalizeRecord(record as Partial<PricingSheetRecord>)) : [];
      setSheets(normalized);
      const first = normalized[0] || emptySheet(fallbackName);
      setCurrentId(first.id);
      setSheet({
        id: first.id,
        bidProjectId: first.bidProjectId || currentProject?.id || '',
        projectName: first.projectName || fallbackName,
        taxRate: first.taxRate,
        discountRate: first.discountRate,
        items: first.items,
        notes: first.notes,
      });
    } catch (error) {
      console.error(error);
      showToast(formatPricingError(error), 'error');
      setSheet((prev) => prev.id ? prev : emptySheet());
    } finally {
      setLoading(false);
    }
  }, [currentProject, showToast]);

  useEffect(() => {
    void loadSheets();
  }, [loadSheets]);

  const handleSelectSheet = useCallback((id: string) => {
    const record = sheets.find((item) => item.id === id);
    if (!record) return;
    setCurrentId(record.id);
    setSheet({
      id: record.id,
      bidProjectId: record.bidProjectId || '',
      projectName: record.projectName,
      taxRate: record.taxRate,
      discountRate: record.discountRate,
      items: record.items,
      notes: record.notes,
    });
  }, [sheets]);

  const handleNewSheet = useCallback(() => {
    const fresh = { ...emptySheet(currentProjectName), bidProjectId: currentProject?.id || '' };
    setCurrentId(fresh.id);
    setSheet(fresh);
    setEditingItem(null);
    setShowAddDialog(false);
  }, [currentProject, currentProjectName]);

  const handleSaveSheet = useCallback(async () => {
    try {
      const result = await window.yibiao?.pricing?.save(sheet);
      if (result) {
        const repairTasks = buildPricingRepairTasks(sheet);
        if (repairTasks.length > 0 && window.yibiao?.repairTasks?.save) {
          await Promise.all(repairTasks.map((task) => window.yibiao?.repairTasks?.save(task)));
          notifyRepairTasksChanged();
        } else {
          await markRepairTasksForReview({
            sourceModule: 'pricing',
            targetType: 'pricing_sheet',
            targetId: sheet.id,
            decision: '报价单已保存，等待交付检查复核',
          });
        }
        showToast('报价单已保存', 'success');
        await loadSheets();
      }
    } catch (error) {
      showToast(`保存报价单失败: ${error instanceof Error ? error.message : String(error)}`, 'error');
    }
  }, [loadSheets, sheet, showToast]);

  const handleDeleteSheet = useCallback(async () => {
    if (!currentId || !window.confirm('确认删除当前报价单？')) return;
    try {
      await window.yibiao?.pricing?.delete(currentId);
      showToast('报价单已删除', 'success');
      await loadSheets();
    } catch (error) {
      showToast(`删除报价单失败: ${error instanceof Error ? error.message : String(error)}`, 'error');
    }
  }, [currentId, loadSheets, showToast]);

  const handleAddItem = useCallback((item: Omit<PricingItem, 'id' | 'subtotal'>) => {
    const subtotal = roundMoney(item.quantity * item.unitPrice);
    setSheet((prev) => ({
      ...prev,
      items: [...prev.items, { ...item, id: createId(), subtotal }],
    }));
    setShowAddDialog(false);
  }, []);

  const handleUpdateItem = useCallback((id: string, updates: Partial<PricingItem>) => {
    setSheet((prev) => ({
      ...prev,
      items: prev.items.map((item) => {
        if (item.id !== id) return item;
        const updated = { ...item, ...updates };
        updated.subtotal = roundMoney(updated.quantity * updated.unitPrice);
        return updated;
      }),
    }));
    setEditingItem(null);
  }, []);

  const handleRemoveItem = useCallback((id: string) => {
    setSheet((prev) => ({ ...prev, items: prev.items.filter((item) => item.id !== id) }));
  }, []);

  const handleExportMarkdown = useCallback(async () => {
    try {
      const md = await window.yibiao?.pricing?.exportMarkdown(sheet);
      await navigator.clipboard.writeText(md || '');
      showToast('报价表 Markdown 已复制到剪贴板。注意：这是中间层，不是最终递交文件。', 'success');
    } catch (error) {
      showToast(`导出 Markdown 失败: ${error instanceof Error ? error.message : String(error)}`, 'error');
    }
  }, [sheet, showToast]);

  return (
    <div className="module-page module-page-wide pricing-page">
      <header className="module-page-header">
        <div>
          <span className="section-kicker">PRICING</span>
          <h2>报价管理</h2>
          <p>报价只在本地计算和保存，不发送给 AI。最终导出时由本地脚本注入完整标书。</p>
        </div>
        <div className="module-page-actions">
          <button type="button" className="secondary-action module-action" onClick={handleNewSheet}>新建报价单</button>
          <button type="button" className="primary-action module-action" onClick={handleSaveSheet}>保存报价单</button>
        </div>
      </header>

      {tenderPricingNote && (
        <details className="module-panel pricing-tender-reference">
          <summary className="module-section-title">招标文件报价口径参考</summary>
          <pre className="module-previewer">{tenderPricingNote}</pre>
        </details>
      )}

      {loading ? (
        <div className="module-empty-state">正在加载报价单...</div>
      ) : (
        <>
          {sheets.length > 0 && (
            <label className="module-field module-selector">
              <span>报价单</span>
              <select value={currentId} onChange={(event) => handleSelectSheet(event.target.value)}>
                {sheets.map((record) => (
                  <option key={record.id} value={record.id}>{record.projectName || `未命名报价单 ${record.id.slice(-6)}`}</option>
                ))}
              </select>
            </label>
          )}

          <div className="pricing-layout">
            <main className="module-panel pricing-main-panel">
              <div className="pricing-form-grid">
                <label className="module-field">
                  <span>项目名称</span>
                  <input
                    value={sheet.projectName}
                    onChange={(event) => setSheet((prev) => ({ ...prev, projectName: event.target.value }))}
                    placeholder="输入或从当前项目带入"
                  />
                </label>
                <label className="module-field">
                  <span>税率</span>
                  <select value={sheet.taxRate} onChange={(event) => setSheet((prev) => ({ ...prev, taxRate: Number(event.target.value) }))}>
                    <option value={0}>免税</option>
                    <option value={0.03}>3%</option>
                    <option value={0.06}>6%</option>
                    <option value={0.09}>9%</option>
                    <option value={0.13}>13%</option>
                  </select>
                </label>
                <label className="module-field">
                  <span>优惠率</span>
                  <input
                    type="number"
                    value={sheet.discountRate * 100}
                    onChange={(event) => setSheet((prev) => ({ ...prev, discountRate: Number(event.target.value) / 100 }))}
                    min={0}
                    max={100}
                    step={1}
                  />
                </label>
              </div>

              <div className="module-button-row">
                <button type="button" className="primary-action module-action" onClick={() => setShowAddDialog(true)}>添加报价项</button>
                <button type="button" className="secondary-action module-action" onClick={handleExportMarkdown} disabled={sheet.items.length === 0}>复制 Markdown 中间层</button>
                <button type="button" className="danger-action module-action" onClick={handleDeleteSheet} disabled={!currentId}>删除报价单</button>
              </div>

              {sheet.items.length === 0 ? (
                <div className="module-empty-state">暂无报价项。报价金额不能由 AI 猜测，需要人工录入或后续从 Excel 导入。</div>
              ) : (
                Object.entries(categoryGroups).map(([category, items]) => (
                  <section className="pricing-category" key={category}>
                    <h3>{category}</h3>
                    <div className="module-table-wrap">
                      <table className="module-data-table">
                        <thead>
                          <tr>
                            {['名称', '规格型号', '单位', '数量', '单价', '小计', '操作'].map((title) => (
                              <th key={title} className={title === '操作' ? 'is-center' : undefined}>{title}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {items.map((item) => (
                            <tr key={item.id}>
                              <td>{item.name}</td>
                              <td>{item.specification || '-'}</td>
                              <td>{item.unit || '-'}</td>
                              <td className="is-number">{item.quantity}</td>
                              <td className="is-number">{formatMoney(item.unitPrice)}</td>
                              <td className="is-number is-strong">{formatMoney(roundMoney(item.quantity * item.unitPrice))}</td>
                              <td className="is-center is-nowrap">
                                <button type="button" className="module-link-button" onClick={() => setEditingItem(item)}>编辑</button>
                                <button type="button" className="module-link-button is-danger" onClick={() => handleRemoveItem(item.id)}>删除</button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </section>
                ))
              )}
            </main>

            <aside className="module-panel pricing-summary-panel">
              <h3>本地计算汇总</h3>
              <SummaryRow label="税前小计" value={`${formatMoney(summary.subtotalBeforeTax)} 元`} />
              <SummaryRow label="优惠金额" value={`${formatMoney(summary.discountAmount)} 元`} />
              <SummaryRow label="税额" value={`${formatMoney(summary.taxAmount)} 元`} />
              <div className="pricing-total">
                <span>含税合计</span>
                <strong>{formatMoney(summary.totalAmount)} 元</strong>
              </div>
              <p>用途：生成报价表、商务标引用、最终完整标书合成。边界：不传 AI，不进入提示词，只在本机数据库和导出阶段使用。</p>
            </aside>
          </div>
        </>
      )}

      {(showAddDialog || editingItem) && (
        <ItemDialog
          item={editingItem}
          onSave={editingItem ? (updates) => handleUpdateItem(editingItem.id, updates) : handleAddItem}
          onClose={() => { setShowAddDialog(false); setEditingItem(null); }}
        />
      )}
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="pricing-summary-row">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function ItemDialog({ item, onSave, onClose }: { item?: PricingItem | null; onSave: (item: Omit<PricingItem, 'id' | 'subtotal'>) => void; onClose: () => void }) {
  const [form, setForm] = useState({
    category: item?.category || CATEGORIES[0],
    name: item?.name || '',
    specification: item?.specification || '',
    unit: item?.unit || '',
    quantity: item?.quantity || 0,
    unitPrice: item?.unitPrice || 0,
    notes: item?.notes || '',
  });

  const handleSubmit = () => {
    if (!form.name.trim()) return;
    onSave(form);
  };

  return (
    <div className="module-modal-backdrop">
      <div className="module-modal" role="dialog" aria-modal="true" aria-label={item ? '编辑报价项' : '添加报价项'}>
        <h3>{item ? '编辑报价项' : '添加报价项'}</h3>
        <div className="module-dialog-form">
          <label className="module-field">
            <span>分类</span>
            <select value={form.category} onChange={(event) => setForm((prev) => ({ ...prev, category: event.target.value }))}>
              {CATEGORIES.map((cat) => <option key={cat} value={cat}>{cat}</option>)}
            </select>
          </label>
          <label className="module-field">
            <span>名称 *</span>
            <input value={form.name} onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))} placeholder="报价项名称" />
          </label>
          <label className="module-field">
            <span>规格型号</span>
            <input value={form.specification} onChange={(event) => setForm((prev) => ({ ...prev, specification: event.target.value }))} placeholder="规格型号" />
          </label>
          <div className="pricing-dialog-grid">
            <label className="module-field">
              <span>单位</span>
              <input value={form.unit} onChange={(event) => setForm((prev) => ({ ...prev, unit: event.target.value }))} placeholder="个/台/套" />
            </label>
            <label className="module-field">
              <span>数量</span>
              <input type="number" value={form.quantity} onChange={(event) => setForm((prev) => ({ ...prev, quantity: Number(event.target.value) }))} min={0} step={1} />
            </label>
            <label className="module-field">
              <span>单价（元）</span>
              <input type="number" value={form.unitPrice} onChange={(event) => setForm((prev) => ({ ...prev, unitPrice: Number(event.target.value) }))} min={0} step={0.01} />
            </label>
          </div>
          <div className="pricing-dialog-subtotal">小计：{formatMoney(roundMoney(form.quantity * form.unitPrice))} 元</div>
        </div>
        <div className="module-modal-actions">
          <button type="button" className="secondary-action module-action" onClick={onClose}>取消</button>
          <button type="button" className="primary-action module-action" onClick={handleSubmit} disabled={!form.name.trim()}>保存</button>
        </div>
      </div>
    </div>
  );
}

export default PricingPage;
