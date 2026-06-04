/**
 * 报价计算模块
 * 管理投标报价明细、计算汇总、生成报价表格
 * 数据纯本地存储，不经过任何外部服务
 */

const { logInfo, logError } = require('../utils/logger.cjs');

/**
 * 创建新的报价单
 * @param {object} params
 * @param {string} params.projectName - 项目名称
 * @param {string} params.bidProjectId - 关联的标书项目ID
 * @returns {object} 报价单基础结构
 */
function createPricingSheet({ projectName = '', bidProjectId = '' } = {}) {
  return {
    id: generateId(),
    bidProjectId,
    projectName,
    currency: 'CNY',
    taxRate: 0.13, // 默认增值税率 13%
    discountRate: 0,
    items: [],
    notes: '',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

/**
 * 创建报价明细项
 * @param {object} params
 * @returns {object} 报价项
 */
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
    category, // 分类（如：设备费、人工费、材料费）
    name, // 名称
    specification, // 规格型号
    unit, // 单位
    quantity: Number(quantity) || 0, // 数量
    unitPrice: Number(unitPrice) || 0, // 单价
    subtotal: 0, // 小计（自动计算）
    notes,
  };
}

/**
 * 计算单个小计
 * @param {object} item - 报价项
 * @returns {number} 小计金额
 */
function calculateItemSubtotal(item) {
  return roundMoney(item.quantity * item.unitPrice);
}

/**
 * 计算报价单汇总
 * @param {object} sheet - 报价单
 * @returns {object} 汇总信息
 */
function calculatePricingSummary(sheet) {
  // 更新每个项的小计
  for (const item of sheet.items) {
    item.subtotal = calculateItemSubtotal(item);
  }

  const subtotalBeforeTax = sheet.items.reduce((sum, item) => sum + item.subtotal, 0);
  const discountAmount = roundMoney(subtotalBeforeTax * (sheet.discountRate || 0));
  const afterDiscount = subtotalBeforeTax - discountAmount;
  const taxAmount = roundMoney(afterDiscount * (sheet.taxRate || 0));
  const totalAmount = roundMoney(afterDiscount + taxAmount);

  // 按分类汇总
  const categorySummary = {};
  for (const item of sheet.items) {
    const cat = item.category || '未分类';
    if (!categorySummary[cat]) {
      categorySummary[cat] = { name: cat, subtotal: 0, itemCount: 0 };
    }
    categorySummary[cat].subtotal += item.subtotal;
    categorySummary[cat].itemCount++;
  }

  sheet.updatedAt = new Date().toISOString();

  return {
    itemCount: sheet.items.length,
    subtotalBeforeTax: roundMoney(subtotalBeforeTax),
    discountRate: sheet.discountRate || 0,
    discountAmount,
    afterDiscount,
    taxRate: sheet.taxRate || 0,
    taxAmount,
    totalAmount,
    categories: Object.values(categorySummary),
    // 大写金额
    totalAmountChinese: numberToChinese(totalAmount),
  };
}

/**
 * 添加报价项到报价单
 * @param {object} sheet - 报价单
 * @param {object} itemParams - 报价项参数
 * @returns {object} 更新后的报价单
 */
function addPricingItem(sheet, itemParams) {
  const item = createPricingItem(itemParams);
  item.subtotal = calculateItemSubtotal(item);
  sheet.items.push(item);
  sheet.updatedAt = new Date().toISOString();
  return sheet;
}

/**
 * 更新报价项
 * @param {object} sheet - 报价单
 * @param {string} itemId - 报价项ID
 * @param {object} updates - 更新内容
 * @returns {object} 更新后的报价单
 */
function updatePricingItem(sheet, itemId, updates) {
  const item = sheet.items.find((i) => i.id === itemId);
  if (!item) throw new Error(`报价项不存在: ${itemId}`);

  Object.assign(item, updates);
  item.subtotal = calculateItemSubtotal(item);
  sheet.updatedAt = new Date().toISOString();
  return sheet;
}

/**
 * 删除报价项
 * @param {object} sheet - 报价单
 * @param {string} itemId - 报价项ID
 * @returns {object} 更新后的报价单
 */
function removePricingItem(sheet, itemId) {
  sheet.items = sheet.items.filter((i) => i.id !== itemId);
  sheet.updatedAt = new Date().toISOString();
  return sheet;
}

/**
 * 生成 Markdown 格式的报价表格
 * @param {object} sheet - 报价单
 * @returns {string} Markdown 表格文本
 */
function generatePricingTableMarkdown(sheet) {
  const summary = calculatePricingSummary(sheet);

  const lines = [];
  lines.push(`## 报价明细表`);
  lines.push('');
  lines.push(`**项目名称**: ${sheet.projectName}`);
  lines.push(`**币种**: 人民币（CNY）`);
  lines.push('');

  // 按分类分组输出
  const grouped = groupByCategory(sheet.items);

  for (const [category, items] of Object.entries(grouped)) {
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
  lines.push(`- 含税合计: **${formatMoney(summary.totalAmount)}** 元`);
  lines.push(`- 大写金额: **${summary.totalAmountChinese}**`);
  lines.push(`- 税率: ${(summary.taxRate * 100).toFixed(0)}%`);
  if (summary.discountRate > 0) {
    lines.push(`- 优惠率: ${(summary.discountRate * 100).toFixed(1)}%`);
  }
  lines.push('');

  if (sheet.notes) {
    lines.push('### 备注');
    lines.push('');
    lines.push(sheet.notes);
  }

  return lines.join('\n');
}

/**
 * 将报价单导出为可存储的 JSON 对象（不含敏感字段的脱敏版本）
 * @param {object} sheet - 报价单
 * @returns {object} 脱敏后的报价单
 */
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

// ========== 内部工具函数 ==========

/**
 * 金额四舍五入到分
 * @param {number} amount
 * @returns {number}
 */
function roundMoney(amount) {
  return Math.round(amount * 100) / 100;
}

/**
 * 格式化金额显示
 * @param {number} amount
 * @returns {string}
 */
function formatMoney(amount) {
  return amount.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/**
 * 按分类分组
 * @param {Array} items
 * @returns {object}
 */
function groupByCategory(items) {
  const groups = {};
  for (const item of items) {
    const cat = item.category || '未分类';
    if (!groups[cat]) groups[cat] = [];
    groups[cat].push(item);
  }
  return groups;
}

/**
 * 金额数字转中文大写
 * @param {number} amount
 * @returns {string}
 */
function numberToChinese(amount) {
  const digits = ['零', '壹', '贰', '叁', '肆', '伍', '陆', '柒', '捌', '玖'];
  const units = ['', '拾', '佰', '仟'];
  const bigUnits = ['', '万', '亿'];

  if (amount === 0) return '零元整';

  const intPart = Math.floor(amount);
  const decPart = Math.round((amount - intPart) * 100);
  const jiao = Math.floor(decPart / 10);
  const fen = decPart % 10;

  let result = '';

  if (intPart > 0) {
    const intStr = String(intPart);
    const groups = [];
    for (let i = intStr.length; i > 0; i -= 4) {
      groups.unshift(intStr.slice(Math.max(0, i - 4), i));
    }

    for (let g = 0; g < groups.length; g++) {
      const group = groups[g];
      let groupStr = '';
      let hasNonZero = false;

      for (let i = 0; i < group.length; i++) {
        const d = Number(group[i]);
        const unitIdx = group.length - 1 - i;

        if (d === 0) {
          if (hasNonZero) groupStr += '零';
        } else {
          groupStr += digits[d] + units[unitIdx];
          hasNonZero = true;
        }
      }

      if (groupStr) {
        result += groupStr + bigUnits[groups.length - 1 - g];
      }
    }

    result += '元';
  }

  if (jiao === 0 && fen === 0) {
    result += '整';
  } else {
    if (jiao > 0) result += digits[jiao] + '角';
    if (fen > 0) result += digits[fen] + '分';
  }

  return result;
}

/**
 * 生成简单唯一ID
 * @returns {string}
 */
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
