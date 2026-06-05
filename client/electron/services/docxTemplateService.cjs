/**
 * Word 文档模板引擎
 * 支持模板变量替换、条件渲染、循环渲染
 * 参考: python-docx-template Jinja2 模板引擎
 */

const fs = require('node:fs');
const path = require('node:path');

// 模板语法定义
const TEMPLATE_SYNTAX = {
  variable: /\{\{\s*([^}]+)\s*\}\}/g, // {{ variable }}
  comment: /\{#\s*([^#]+)\s*#\}/g, // {# comment #}
  block: /\{%\s*([^%]+)\s*%\}/g, // {% block %}
};

/**
 * 模板变量替换
 * @param {string} template - 模板字符串
 * @param {Object} context - 上下文变量
 * @returns {string} 替换后的字符串
 */
function replaceVariables(template, context) {
  if (!template || typeof template !== 'string') {
    return template;
  }

  return template.replace(TEMPLATE_SYNTAX.variable, (match, key) => {
    const trimmedKey = key.trim();
    const value = getNestedValue(context, trimmedKey);
    return value !== undefined && value !== null ? String(value) : '';
  });
}

/**
 * 获取嵌套对象的值
 * @param {Object} obj - 对象
 * @param {string} path - 属性路径（如 'a.b.c'）
 * @returns {*} 属性值
 */
function getNestedValue(obj, path) {
  if (!obj || !path) return undefined;

  const keys = path.split('.');
  let current = obj;

  for (const key of keys) {
    if (current === null || current === undefined) {
      return undefined;
    }
    current = current[key];
  }

  return current;
}

/**
 * 处理条件语句
 * @param {string} template - 模板字符串
 * @param {Object} context - 上下文变量
 * @returns {string} 处理后的字符串
 */
function processConditionals(template, context) {
  if (!template || typeof template !== 'string') {
    return template;
  }

  // 处理 {% if condition %} ... {% endif %}
  const ifRegex = /\{%\s*if\s+([^%]+)\s*%\}([\s\S]*?)(?:\{%\s*else\s*%\}([\s\S]*?))?\{%\s*endif\s*%\}/g;

  return template.replace(ifRegex, (match, condition, trueBlock, falseBlock) => {
    const trimmedCondition = condition.trim();
    const result = evaluateCondition(trimmedCondition, context);
    return result ? trueBlock : (falseBlock || '');
  });
}

/**
 * 处理循环语句
 * @param {string} template - 模板字符串
 * @param {Object} context - 上下文变量
 * @returns {string} 处理后的字符串
 */
function processLoops(template, context) {
  if (!template || typeof template !== 'string') {
    return template;
  }

  // 处理 {% for item in items %} ... {% endfor %}
  const forRegex = /\{%\s*for\s+(\w+)\s+in\s+(\w+)\s*%\}([\s\S]*?)\{%\s*endfor\s*%\}/g;

  return template.replace(forRegex, (match, itemName, listName, loopBlock) => {
    const list = context[listName];
    if (!Array.isArray(list)) {
      return '';
    }

    return list.map((item, index) => {
      const loopContext = {
        ...context,
        [itemName]: item,
        loop: {
          index: index + 1,
          index0: index,
          first: index === 0,
          last: index === list.length - 1,
          length: list.length,
        },
      };
      return processTemplate(loopBlock, loopContext);
    }).join('');
  });
}

/**
 * 评估条件表达式
 * @param {string} condition - 条件表达式
 * @param {Object} context - 上下文变量
 * @returns {boolean} 条件结果
 */
function evaluateCondition(condition, context) {
  try {
    // 简单的条件评估
    // 支持: variable, !variable, variable == value, variable != value
    if (condition.startsWith('!')) {
      const varName = condition.slice(1).trim();
      return !getNestedValue(context, varName);
    }

    if (condition.includes('==')) {
      const [left, right] = condition.split('==').map((s) => s.trim());
      const leftValue = getNestedValue(context, left);
      const rightValue = right.replace(/['"]/g, '');
      return String(leftValue) === rightValue;
    }

    if (condition.includes('!=')) {
      const [left, right] = condition.split('!=').map((s) => s.trim());
      const leftValue = getNestedValue(context, left);
      const rightValue = right.replace(/['"]/g, '');
      return String(leftValue) !== rightValue;
    }

    // 简单变量检查
    const value = getNestedValue(context, condition.trim());
    return Boolean(value);
  } catch (error) {
    console.error('[docx-template] 条件评估失败:', condition, error);
    return false;
  }
}

/**
 * 处理模板
 * @param {string} template - 模板字符串
 * @param {Object} context - 上下文变量
 * @returns {string} 处理后的字符串
 */
function processTemplate(template, context) {
  if (!template || typeof template !== 'string') {
    return template;
  }

  let result = template;

  // 1. 移除注释
  result = result.replace(TEMPLATE_SYNTAX.comment, '');

  // 2. 处理循环
  result = processLoops(result, context);

  // 3. 处理条件
  result = processConditionals(result, context);

  // 4. 替换变量
  result = replaceVariables(result, context);

  return result;
}

/**
 * 从 Word 文档提取模板变量
 * @param {string} content - 文档内容
 * @returns {Array<string>} 变量列表
 */
function extractTemplateVariables(content) {
  if (!content || typeof content !== 'string') {
    return [];
  }

  const variables = new Set();
  let match;

  // 提取 {{ variable }} 格式的变量
  const variableRegex = /\{\{\s*([^}]+)\s*\}\}/g;
  while ((match = variableRegex.exec(content)) !== null) {
    const varName = match[1].trim();
    // 取第一个部分作为变量名（处理嵌套属性）
    const baseVar = varName.split('.')[0];
    variables.add(baseVar);
  }

  return Array.from(variables);
}

/**
 * 验证模板变量
 * @param {Array<string>} requiredVariables - 必需的变量列表
 * @param {Object} context - 上下文变量
 * @returns {Object} 验证结果
 */
function validateTemplateVariables(requiredVariables, context) {
  const missing = [];
  const provided = [];

  for (const varName of requiredVariables) {
    const value = getNestedValue(context, varName);
    if (value === undefined || value === null) {
      missing.push(varName);
    } else {
      provided.push(varName);
    }
  }

  return {
    valid: missing.length === 0,
    missing,
    provided,
    total: requiredVariables.length,
  };
}

/**
 * 生成模板报告
 * @param {string} template - 模板内容
 * @param {Object} context - 上下文变量
 * @returns {Object} 模板报告
 */
function generateTemplateReport(template, context) {
  const variables = extractTemplateVariables(template);
  const validation = validateTemplateVariables(variables, context);

  return {
    variables,
    validation,
    templateLength: template.length,
    contextKeys: Object.keys(context),
  };
}

/**
 * 创建文档模板服务实例
 */
function createDocxTemplateService() {
  return {
    processTemplate,
    replaceVariables,
    processConditionals,
    processLoops,
    extractTemplateVariables,
    validateTemplateVariables,
    generateTemplateReport,
    TEMPLATE_SYNTAX,
  };
}

module.exports = {
  createDocxTemplateService,
  processTemplate,
  replaceVariables,
  processConditionals,
  processLoops,
  extractTemplateVariables,
  validateTemplateVariables,
  generateTemplateReport,
  TEMPLATE_SYNTAX,
};
