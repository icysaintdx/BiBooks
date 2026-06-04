import { useCallback, useMemo, useState } from 'react';
import { useToast } from '../../../shared/ui';

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
  projectName: string;
  taxRate: number;
  discountRate: number;
  items: PricingItem[];
  notes: string;
}

function createId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function roundMoney(amount: number) {
  return Math.round(amount * 100) / 100;
}

function formatMoney(amount: number) {
  return amount.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

const CATEGORIES = ['设备费', '人工费', '材料费', '管理费', '利润', '税金', '其他'];

function PricingPage() {
  const { showToast } = useToast();
  const [sheet, setSheet] = useState<PricingSheet>({
    id: createId(),
    projectName: '',
    taxRate: 0.13,
    discountRate: 0,
    items: [],
    notes: '',
  });
  const [editingItem, setEditingItem] = useState<PricingItem | null>(null);
  const [showAddDialog, setShowAddDialog] = useState(false);

  const summary = useMemo(() => {
    const subtotal = sheet.items.reduce((sum, item) => sum + item.subtotal, 0);
    const discount = roundMoney(subtotal * sheet.discountRate);
    const afterDiscount = subtotal - discount;
    const tax = roundMoney(afterDiscount * sheet.taxRate);
    const total = roundMoney(afterDiscount + tax);
    return { subtotal: roundMoney(subtotal), discount, afterDiscount, tax, total };
  }, [sheet]);

  const categoryGroups = useMemo(() => {
    const groups: Record<string, PricingItem[]> = {};
    for (const item of sheet.items) {
      const cat = item.category || '未分类';
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(item);
    }
    return groups;
  }, [sheet.items]);

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
    setSheet((prev) => ({
      ...prev,
      items: prev.items.filter((item) => item.id !== id),
    }));
  }, []);

  const handleExportMarkdown = useCallback(() => {
    const lines: string[] = [];
    lines.push('## 报价明细表');
    lines.push('');
    if (sheet.projectName) lines.push(`**项目名称**: ${sheet.projectName}`);
    lines.push('');

    for (const [category, items] of Object.entries(categoryGroups)) {
      lines.push(`### ${category}`);
      lines.push('');
      lines.push('| 序号 | 名称 | 规格型号 | 单位 | 数量 | 单价（元） | 小计（元） |');
      lines.push('|------|------|----------|------|------|------------|------------|');
      items.forEach((item, idx) => {
        lines.push(`| ${idx + 1} | ${item.name} | ${item.specification || '-'} | ${item.unit || '-'} | ${item.quantity} | ${formatMoney(item.unitPrice)} | ${formatMoney(item.subtotal)} |`);
      });
      const catSubtotal = items.reduce((sum, item) => sum + item.subtotal, 0);
      lines.push(`| | | | | | **小计** | **${formatMoney(catSubtotal)}** |`);
      lines.push('');
    }

    lines.push('### 汇总');
    lines.push('');
    lines.push(`- 含税合计: **${formatMoney(summary.total)}** 元`);
    lines.push(`- 税率: ${(sheet.taxRate * 100).toFixed(0)}%`);
    if (sheet.discountRate > 0) lines.push(`- 优惠率: ${(sheet.discountRate * 100).toFixed(1)}%`);
    lines.push('');

    const md = lines.join('\n');
    navigator.clipboard.writeText(md).then(() => {
      showToast('报价表已复制到剪贴板', 'success');
    }).catch(() => {
      showToast('复制失败', 'error');
    });
  }, [sheet, categoryGroups, summary, showToast]);

  return (
    <div style={{ padding: 24, maxWidth: 960, margin: '0 auto' }}>
      <h2 style={{ marginBottom: 16 }}>报价管理</h2>

      {/* 基本信息 */}
      <div style={{ display: 'flex', gap: 16, marginBottom: 24, flexWrap: 'wrap' }}>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: 1, minWidth: 200 }}>
          <span style={{ fontSize: 13, color: '#666' }}>项目名称</span>
          <input
            value={sheet.projectName}
            onChange={(e) => setSheet((prev) => ({ ...prev, projectName: e.target.value }))}
            placeholder="输入项目名称"
            style={{ padding: '8px 12px', border: '1px solid #ddd', borderRadius: 6 }}
          />
        </label>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 4, width: 120 }}>
          <span style={{ fontSize: 13, color: '#666' }}>税率</span>
          <select
            value={sheet.taxRate}
            onChange={(e) => setSheet((prev) => ({ ...prev, taxRate: Number(e.target.value) }))}
            style={{ padding: '8px 12px', border: '1px solid #ddd', borderRadius: 6 }}
          >
            <option value={0}>免税</option>
            <option value={0.03}>3%</option>
            <option value={0.06}>6%</option>
            <option value={0.09}>9%</option>
            <option value={0.13}>13%</option>
          </select>
        </label>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 4, width: 120 }}>
          <span style={{ fontSize: 13, color: '#666' }}>优惠率</span>
          <input
            type="number"
            value={sheet.discountRate * 100}
            onChange={(e) => setSheet((prev) => ({ ...prev, discountRate: Number(e.target.value) / 100 }))}
            min={0}
            max={100}
            step={1}
            style={{ padding: '8px 12px', border: '1px solid #ddd', borderRadius: 6 }}
          />
        </label>
      </div>

      {/* 操作按钮 */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <button
          onClick={() => setShowAddDialog(true)}
          style={{ padding: '8px 16px', background: '#1677ff', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer' }}
        >
          添加报价项
        </button>
        <button
          onClick={handleExportMarkdown}
          disabled={sheet.items.length === 0}
          style={{ padding: '8px 16px', background: '#52c41a', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', opacity: sheet.items.length === 0 ? 0.5 : 1 }}
        >
          导出 Markdown
        </button>
      </div>

      {/* 报价项列表 */}
      {sheet.items.length === 0 ? (
        <div style={{ padding: 40, textAlign: 'center', color: '#999', background: '#fafafa', borderRadius: 8 }}>
          暂无报价项，点击"添加报价项"开始
        </div>
      ) : (
        Object.entries(categoryGroups).map(([category, items]) => (
          <div key={category} style={{ marginBottom: 24 }}>
            <h3 style={{ marginBottom: 8, fontSize: 15 }}>{category}</h3>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
              <thead>
                <tr style={{ background: '#f5f5f5' }}>
                  <th style={{ padding: '8px 12px', textAlign: 'left', borderBottom: '1px solid #eee' }}>名称</th>
                  <th style={{ padding: '8px 12px', textAlign: 'left', borderBottom: '1px solid #eee' }}>规格型号</th>
                  <th style={{ padding: '8px 12px', textAlign: 'center', borderBottom: '1px solid #eee' }}>单位</th>
                  <th style={{ padding: '8px 12px', textAlign: 'right', borderBottom: '1px solid #eee' }}>数量</th>
                  <th style={{ padding: '8px 12px', textAlign: 'right', borderBottom: '1px solid #eee' }}>单价</th>
                  <th style={{ padding: '8px 12px', textAlign: 'right', borderBottom: '1px solid #eee' }}>小计</th>
                  <th style={{ padding: '8px 12px', textAlign: 'center', borderBottom: '1px solid #eee' }}>操作</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id}>
                    <td style={{ padding: '8px 12px', borderBottom: '1px solid #f0f0f0' }}>{item.name}</td>
                    <td style={{ padding: '8px 12px', borderBottom: '1px solid #f0f0f0', color: '#999' }}>{item.specification || '-'}</td>
                    <td style={{ padding: '8px 12px', textAlign: 'center', borderBottom: '1px solid #f0f0f0' }}>{item.unit || '-'}</td>
                    <td style={{ padding: '8px 12px', textAlign: 'right', borderBottom: '1px solid #f0f0f0' }}>{item.quantity}</td>
                    <td style={{ padding: '8px 12px', textAlign: 'right', borderBottom: '1px solid #f0f0f0' }}>{formatMoney(item.unitPrice)}</td>
                    <td style={{ padding: '8px 12px', textAlign: 'right', borderBottom: '1px solid #f0f0f0', fontWeight: 600 }}>{formatMoney(item.subtotal)}</td>
                    <td style={{ padding: '8px 12px', textAlign: 'center', borderBottom: '1px solid #f0f0f0' }}>
                      <button onClick={() => setEditingItem(item)} style={{ color: '#1677ff', background: 'none', border: 'none', cursor: 'pointer', marginRight: 8 }}>编辑</button>
                      <button onClick={() => handleRemoveItem(item.id)} style={{ color: '#ff4d4f', background: 'none', border: 'none', cursor: 'pointer' }}>删除</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))
      )}

      {/* 汇总 */}
      {sheet.items.length > 0 && (
        <div style={{ background: '#f6ffed', border: '1px solid #b7eb8f', borderRadius: 8, padding: 16, marginTop: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <span>含税合计</span>
            <span style={{ fontSize: 20, fontWeight: 700, color: '#52c41a' }}>{formatMoney(summary.total)} 元</span>
          </div>
          {summary.discount > 0 && (
            <div style={{ fontSize: 13, color: '#999' }}>已优惠: {formatMoney(summary.discount)} 元</div>
          )}
          <div style={{ fontSize: 13, color: '#999' }}>税额: {formatMoney(summary.tax)} 元</div>
        </div>
      )}

      {/* 添加/编辑对话框 */}
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

function ItemDialog({
  item,
  onSave,
  onClose,
}: {
  item?: PricingItem | null;
  onSave: (item: any) => void;
  onClose: () => void;
}) {
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
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
      <div style={{ background: '#fff', borderRadius: 12, padding: 24, width: 480, maxHeight: '80vh', overflow: 'auto' }}>
        <h3 style={{ marginBottom: 16 }}>{item ? '编辑报价项' : '添加报价项'}</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={{ fontSize: 13, color: '#666' }}>分类</span>
            <select value={form.category} onChange={(e) => setForm((prev) => ({ ...prev, category: e.target.value }))} style={{ padding: '8px 12px', border: '1px solid #ddd', borderRadius: 6 }}>
              {CATEGORIES.map((cat) => <option key={cat} value={cat}>{cat}</option>)}
            </select>
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={{ fontSize: 13, color: '#666' }}>名称 *</span>
            <input value={form.name} onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))} placeholder="报价项名称" style={{ padding: '8px 12px', border: '1px solid #ddd', borderRadius: 6 }} />
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={{ fontSize: 13, color: '#666' }}>规格型号</span>
            <input value={form.specification} onChange={(e) => setForm((prev) => ({ ...prev, specification: e.target.value }))} placeholder="规格型号" style={{ padding: '8px 12px', border: '1px solid #ddd', borderRadius: 6 }} />
          </label>
          <div style={{ display: 'flex', gap: 12 }}>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: 1 }}>
              <span style={{ fontSize: 13, color: '#666' }}>单位</span>
              <input value={form.unit} onChange={(e) => setForm((prev) => ({ ...prev, unit: e.target.value }))} placeholder="个/台/套" style={{ padding: '8px 12px', border: '1px solid #ddd', borderRadius: 6 }} />
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: 1 }}>
              <span style={{ fontSize: 13, color: '#666' }}>数量</span>
              <input type="number" value={form.quantity} onChange={(e) => setForm((prev) => ({ ...prev, quantity: Number(e.target.value) }))} min={0} step={1} style={{ padding: '8px 12px', border: '1px solid #ddd', borderRadius: 6 }} />
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: 1 }}>
              <span style={{ fontSize: 13, color: '#666' }}>单价（元）</span>
              <input type="number" value={form.unitPrice} onChange={(e) => setForm((prev) => ({ ...prev, unitPrice: Number(e.target.value) }))} min={0} step={0.01} style={{ padding: '8px 12px', border: '1px solid #ddd', borderRadius: 6 }} />
            </label>
          </div>
          <div style={{ fontSize: 14, color: '#1677ff' }}>
            小计: {formatMoney(roundMoney(form.quantity * form.unitPrice))} 元
          </div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 20 }}>
          <button onClick={onClose} style={{ padding: '8px 16px', background: '#f5f5f5', border: '1px solid #ddd', borderRadius: 6, cursor: 'pointer' }}>取消</button>
          <button onClick={handleSubmit} disabled={!form.name.trim()} style={{ padding: '8px 16px', background: '#1677ff', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', opacity: form.name.trim() ? 1 : 0.5 }}>保存</button>
        </div>
      </div>
    </div>
  );
}

export default PricingPage;
