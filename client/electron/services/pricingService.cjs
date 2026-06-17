'use strict';

function createPricingSheet({ projectName = '', bidProjectId = '' } = {}) {
  return {
    id: generateId(),
    bidProjectId,
    projectName,
    currency: 'CNY',
    taxRate: 0.13,
    discountRate: 0,
    items: [],
    notes: '',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

function createPricingItem({
  category = '',
  name = '',
  specification = '',
  unit = '',
  quantity = 0,
  unitPrice = 0,
  notes = '',
} = {}) {
  return {
    id: generateId(),
    category,
    name,
    specification,
    unit,
    quantity: Number(quantity) || 0,
    unitPrice: Number(unitPrice) || 0,
    subtotal: 0,
    notes,
  };
}

function calculateItemSubtotal(item) {
  return roundMoney((Number(item.quantity) || 0) * (Number(item.unitPrice) || 0));
}

function calculatePricingSummary(sheet) {
  for (const item of sheet.items || []) {
    item.subtotal = calculateItemSubtotal(item);
  }

  const subtotalBeforeTax = (sheet.items || []).reduce((sum, item) => sum + item.subtotal, 0);
  const discountAmount = roundMoney(subtotalBeforeTax * (sheet.discountRate || 0));
  const afterDiscount = roundMoney(subtotalBeforeTax - discountAmount);
  const taxAmount = roundMoney(afterDiscount * (sheet.taxRate || 0));
  const totalAmount = roundMoney(afterDiscount + taxAmount);

  const categorySummary = {};
  for (const item of sheet.items || []) {
    const category = item.category || '未分类';
    if (!categorySummary[category]) categorySummary[category] = { name: category, subtotal: 0, itemCount: 0 };
    categorySummary[category].subtotal = roundMoney(categorySummary[category].subtotal + item.subtotal);
    categorySummary[category].itemCount += 1;
  }

  sheet.updatedAt = new Date().toISOString();

  return {
    itemCount: (sheet.items || []).length,
    subtotalBeforeTax: roundMoney(subtotalBeforeTax),
    discountRate: sheet.discountRate || 0,
    discountAmount,
    afterDiscount,
    taxRate: sheet.taxRate || 0,
    taxAmount,
    totalAmount,
    categories: Object.values(categorySummary),
    totalAmountChinese: numberToChinese(totalAmount),
  };
}

function addPricingItem(sheet, itemParams) {
  const item = createPricingItem(itemParams);
  item.subtotal = calculateItemSubtotal(item);
  sheet.items.push(item);
  sheet.updatedAt = new Date().toISOString();
  return sheet;
}

function updatePricingItem(sheet, itemId, updates) {
  const item = sheet.items.find((candidate) => candidate.id === itemId);
  if (!item) throw new Error(`报价项不存在: ${itemId}`);
  Object.assign(item, updates);
  item.subtotal = calculateItemSubtotal(item);
  sheet.updatedAt = new Date().toISOString();
  return sheet;
}

function removePricingItem(sheet, itemId) {
  sheet.items = sheet.items.filter((item) => item.id !== itemId);
  sheet.updatedAt = new Date().toISOString();
  return sheet;
}

function generatePricingTableMarkdown(sheet) {
  const summary = calculatePricingSummary(sheet);
  const lines = [];
  lines.push('## 报价明细表');
  lines.push('');
  lines.push(`**项目名称**: ${sheet.projectName || '未填写'}`);
  lines.push('**币种**: 人民币（CNY）');
  lines.push('');

  const grouped = groupByCategory(sheet.items || []);
  for (const [category, items] of Object.entries(grouped)) {
    lines.push(`### ${category}`);
    lines.push('');
    lines.push('| 序号 | 名称 | 规格型号 | 单位 | 数量 | 单价（元） | 小计（元） |');
    lines.push('|------|------|----------|------|------|------------|------------|');
    items.forEach((item, index) => {
      lines.push(`| ${index + 1} | ${item.name} | ${item.specification || '-'} | ${item.unit || '-'} | ${item.quantity} | ${formatMoney(item.unitPrice)} | ${formatMoney(item.subtotal)} |`);
    });
    const categorySubtotal = items.reduce((sum, item) => sum + item.subtotal, 0);
    lines.push(`| | | | | | **小计** | **${formatMoney(categorySubtotal)}** |`);
    lines.push('');
  }

  lines.push('### 汇总');
  lines.push('');
  lines.push(`- 税前小计: **${formatMoney(summary.subtotalBeforeTax)}** 元`);
  if (summary.discountRate > 0) lines.push(`- 优惠率: **${(summary.discountRate * 100).toFixed(1)}%**`);
  if (summary.discountAmount > 0) lines.push(`- 优惠金额: **${formatMoney(summary.discountAmount)}** 元`);
  lines.push(`- 税率: **${(summary.taxRate * 100).toFixed(0)}%**`);
  lines.push(`- 税额: **${formatMoney(summary.taxAmount)}** 元`);
  lines.push(`- 含税合计: **${formatMoney(summary.totalAmount)}** 元`);
  lines.push(`- 大写金额: **${summary.totalAmountChinese}**`);
  lines.push('');

  if (sheet.notes) {
    lines.push('### 备注');
    lines.push('');
    lines.push(sheet.notes);
  }

  return lines.join('\n');
}

function exportPricingForStorage(sheet) {
  return {
    id: sheet.id,
    bidProjectId: sheet.bidProjectId,
    projectName: sheet.projectName,
    currency: sheet.currency,
    taxRate: sheet.taxRate,
    discountRate: sheet.discountRate,
    items: sheet.items.map((item) => ({ ...item })),
    notes: sheet.notes,
    summary: calculatePricingSummary(sheet),
    createdAt: sheet.createdAt,
    updatedAt: sheet.updatedAt,
  };
}

function roundMoney(amount) {
  return Math.round((Number(amount) || 0) * 100) / 100;
}

function formatMoney(amount) {
  return (Number(amount) || 0).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function groupByCategory(items) {
  const groups = {};
  for (const item of items) {
    const category = item.category || '未分类';
    if (!groups[category]) groups[category] = [];
    groups[category].push(item);
  }
  return groups;
}

function numberToChinese(amount) {
  const digits = ['零', '壹', '贰', '叁', '肆', '伍', '陆', '柒', '捌', '玖'];
  const units = ['', '拾', '佰', '仟'];
  const bigUnits = ['', '万', '亿', '兆'];
  const value = Math.round((Number(amount) || 0) * 100);
  if (value === 0) return '零元整';

  const integer = Math.floor(value / 100);
  const decimal = value % 100;
  let result = '';

  if (integer > 0) {
    const groups = [];
    let rest = integer;
    while (rest > 0) {
      groups.unshift(rest % 10000);
      rest = Math.floor(rest / 10000);
    }

    let zeroPending = false;
    groups.forEach((group, groupIndex) => {
      if (group === 0) {
        zeroPending = true;
        return;
      }
      if (zeroPending && !result.endsWith('零')) result += '零';
      result += convertFourDigits(group, digits, units);
      result += bigUnits[groups.length - 1 - groupIndex] || '';
      zeroPending = group < 1000;
    });
    result += '元';
  }

  const jiao = Math.floor(decimal / 10);
  const fen = decimal % 10;
  if (jiao === 0 && fen === 0) {
    result += '整';
  } else {
    if (jiao > 0) result += digits[jiao] + '角';
    if (fen > 0) {
      if (jiao === 0 && integer > 0) result += '零';
      result += digits[fen] + '分';
    }
  }

  return result.replace(/零+/g, '零').replace(/零元/, '元');
}

function convertFourDigits(number, digits, units) {
  const chars = String(number).padStart(4, '0').split('').map(Number);
  let text = '';
  let zeroPending = false;
  chars.forEach((digit, index) => {
    const unitIndex = 3 - index;
    if (digit === 0) {
      zeroPending = text.length > 0;
      return;
    }
    if (zeroPending && !text.endsWith('零')) text += '零';
    text += digits[digit] + units[unitIndex];
    zeroPending = false;
  });
  return text;
}

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

module.exports = {
  createPricingSheet,
  createPricingItem,
  calculateItemSubtotal,
  calculatePricingSummary,
  addPricingItem,
  updatePricingItem,
  removePricingItem,
  generatePricingTableMarkdown,
  exportPricingForStorage,
  formatMoney,
  numberToChinese,
};
