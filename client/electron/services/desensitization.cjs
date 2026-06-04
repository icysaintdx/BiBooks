/**
 * 报价脱敏中间件
 * 在调用 AI 之前将报价/金额等敏感数据替换为占位符
 * 确保企业报价数据永远不会泄露到云端 AI
 */

const { logInfo, logError } = require('../utils/logger.cjs');

// 金额匹配模式（按优先级排序）
const MONEY_PATTERNS = [
  // 带货币符号的金额：¥123,456.78 / ￥123456
  { pattern: /[¥￥]\s*[\d,]+\.?\d*/g, type: 'currency_symbol' },
  // 带"元/万元"的金额：123,456.78元 / 100万元
  { pattern: /[\d,]+\.?\d*\s*(?:万元|元|万元整|元整)/g, type: 'currency_unit' },
  // "金额/报价/价格/预算/限价"后的数字：金额：123,456.78
  { pattern: /(?:金额|报价|价格|预算|限价|总价|合计|单价|小计|费用|成本|税额)[：:]\s*[\d,]+\.?\d*/g, type: 'keyword_amount' },
  // 百分比：13%（税率相关）
  { pattern: /\d+\.?\d*\s*%/g, type: 'percentage' },
  // 独立的大额数字（5位以上，可能是金额）：123,456 或 123456
  { pattern: /(?<!\d)[\d]{1,3}(?:,\d{3})+(?:\.\d+)?(?!\d)/g, type: 'comma_number' },
];

// 需要保护的上下文关键词（这些词附近的数字更可能是敏感数据）
const SENSITIVE_CONTEXT_KEYWORDS = [
  '报价', '价格', '金额', '预算', '限价', '总价', '合计',
  '单价', '小计', '费用', '成本', '税额', '优惠', '折扣',
  '投标', '中标', '合同', '付款', '结算', '发票',
];

// 占位符前缀
const PLACEHOLDER_PREFIX = '{{BIBOOKS_';
const PLACEHOLDER_SUFFIX = '}}';

/**
 * 对文本进行脱敏处理
 * 将金额、报价等敏感数据替换为占位符
 *
 * @param {string} text - 原始文本
 * @returns {{ text: string, mapping: object }} - 脱敏后的文本和还原映射
 */
function desensitize(text) {
  if (!text) return { text: '', mapping: {} };

  const mapping = {};
  let counter = 0;
  let result = text;

  // 按优先级匹配并替换
  for (const { pattern, type } of MONEY_PATTERNS) {
    // 每次都需要重新创建 RegExp（因为 lastIndex 问题）
    const regex = new RegExp(pattern.source, pattern.flags);

    let match;
    while ((match = regex.exec(result)) !== null) {
      const matched = match[0];

      // 跳过已经替换的占位符
      if (matched.includes(PLACEHOLDER_PREFIX)) continue;

      // 跳过过短的数字（可能是普通数字，不是金额）
      const digitsOnly = matched.replace(/[^\d]/g, '');
      if (digitsOnly.length < 3) continue;

      counter++;
      const placeholder = `${PLACEHOLDER_PREFIX}${type.toUpperCase()}_${counter}${PLACEHOLDER_SUFFIX}`;
      mapping[placeholder] = matched;

      // 替换第一个匹配（避免重复替换）
      result = result.replace(matched, placeholder);
    }
  }

  return { text: result, mapping };
}

/**
 * 将脱敏文本中的占位符还原为原始值
 *
 * @param {string} text - 脱敏后的文本（可能包含占位符）
 * @param {object} mapping - 脱敏时生成的映射
 * @returns {string} - 还原后的文本
 */
function resensitize(text, mapping) {
  if (!text || !mapping || Object.keys(mapping).length === 0) return text;

  let result = text;

  for (const [placeholder, original] of Object.entries(mapping)) {
    result = result.replaceAll(placeholder, original);
  }

  return result;
}

/**
 * 检查文本中是否包含敏感数据
 *
 * @param {string} text
 * @returns {{ hasSensitive: boolean, count: number, types: string[] }}
 */
function detectSensitiveData(text) {
  if (!text) return { hasSensitive: false, count: 0, types: [] };

  const types = new Set();
  let count = 0;

  for (const { pattern, type } of MONEY_PATTERNS) {
    const regex = new RegExp(pattern.source, pattern.flags);
    let match;
    while ((match = regex.exec(text)) !== null) {
      const digitsOnly = match[0].replace(/[^\d]/g, '');
      if (digitsOnly.length >= 3) {
        count++;
        types.add(type);
      }
    }
  }

  return {
    hasSensitive: count > 0,
    count,
    types: Array.from(types),
  };
}

/**
 * 包装 AI 调用的脱敏中间件
 * 自动脱敏输入 → 调用 AI → 还原输出
 *
 * @param {string} inputText - 原始输入文本
 * @param {Function} aiCallFn - AI 调用函数，接收脱敏后的文本，返回 AI 生成的文本
 * @returns {Promise<string>} - 还原后的 AI 输出
 */
async function withDesensitization(inputText, aiCallFn) {
  // 1. 脱敏
  const { text: desensitizedText, mapping } = desensitize(inputText);

  const sensitiveCount = Object.keys(mapping).length;
  if (sensitiveCount > 0) {
    logInfo(`[脱敏] 已替换 ${sensitiveCount} 处敏感数据`);
  }

  // 2. 调用 AI
  const aiResult = await aiCallFn(desensitizedText);

  // 3. 还原
  const restored = resensitize(aiResult, mapping);

  if (sensitiveCount > 0) {
    logInfo(`[脱敏] 已还原 ${sensitiveCount} 处敏感数据`);
  }

  return restored;
}

module.exports = {
  desensitize,
  resensitize,
  detectSensitiveData,
  withDesensitization,
  MONEY_PATTERNS,
  PLACEHOLDER_PREFIX,
  PLACEHOLDER_SUFFIX,
};
