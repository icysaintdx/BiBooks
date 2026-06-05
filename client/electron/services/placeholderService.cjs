/**
 * 占位符生成服务
 * 在标书内容中插入占位符标记（图片/表格/资质）
 * 参考: BiaoShu-SKILL generate_placeholder.py
 */

// 占位符类型定义
const PLACEHOLDER_TYPES = {
  image: {
    prefix: '[图片占位符]',
    fields: ['type', 'description', 'size'],
    template: '[图片占位符]\n类型：{type}\n描述：{description}\n建议尺寸：{size}',
  },
  table: {
    prefix: '[表格占位符]',
    fields: ['type', 'description', 'columns', 'content'],
    template: '[表格占位符]\n类型：{type}\n描述：{description}\n建议列数：{columns}\n建议内容：{content}',
  },
  qualification: {
    prefix: '[资质占位符]',
    fields: ['type', 'description', 'requirement'],
    template: '[资质占位符]\n类型：{type}\n描述：{description}\n要求：{requirement}',
  },
};

// 常用占位符模板
const COMMON_PLACEHOLDERS = {
  '技术架构图': {
    type: 'image',
    data: {
      type: '技术架构图',
      description: '系统总体架构图',
      size: '宽15cm × 高10cm',
    },
  },
  '网络拓扑图': {
    type: 'image',
    data: {
      type: '网络拓扑图',
      description: '系统网络拓扑结构图',
      size: '宽15cm × 高10cm',
    },
  },
  '业务流程图': {
    type: 'image',
    data: {
      type: '业务流程图',
      description: '核心业务流程图',
      size: '宽15cm × 高10cm',
    },
  },
  '功能模块清单': {
    type: 'table',
    data: {
      type: '功能模块清单',
      description: '系统功能模块列表',
      columns: '5列',
      content: '模块名称、功能描述、技术选型、优先级、预计工作量',
    },
  },
  '项目进度表': {
    type: 'table',
    data: {
      type: '项目进度计划表',
      description: '项目实施进度安排',
      columns: '6列',
      content: '阶段名称、开始时间、结束时间、主要任务、交付物、负责人',
    },
  },
  '人员配置表': {
    type: 'table',
    data: {
      type: '人员配置表',
      description: '项目团队人员配置',
      columns: '5列',
      content: '角色、姓名、职责、资质证书、投入时间',
    },
  },
  '项目业绩表': {
    type: 'table',
    data: {
      type: '项目业绩表',
      description: '近3年类似项目清单',
      columns: '6列',
      content: '项目名称、合同金额、完成时间、项目规模、客户名称、验收情况',
    },
  },
  '服务响应时间表': {
    type: 'table',
    data: {
      type: '服务响应时间表',
      description: '售后服务响应时间承诺',
      columns: '4列',
      content: '故障级别、响应时间、解决时间、联系方式',
    },
  },
  '企业营业执照': {
    type: 'qualification',
    data: {
      type: '企业营业执照',
      description: '企业营业执照副本',
      requirement: '有效期内的彩色扫描件',
    },
  },
  '信息系统集成资质': {
    type: 'qualification',
    data: {
      type: '信息系统集成资质',
      description: '信息系统集成及服务资质证书',
      requirement: '有效期内的彩色扫描件',
    },
  },
  'ISO9001认证证书': {
    type: 'qualification',
    data: {
      type: 'ISO9001认证证书',
      description: 'ISO9001质量管理体系认证证书',
      requirement: '有效期内的彩色扫描件',
    },
  },
  '项目经理PMP证书': {
    type: 'qualification',
    data: {
      type: '项目经理PMP证书',
      description: '项目经理PMP认证证书',
      requirement: '有效期内的彩色扫描件',
    },
  },
};

// 关键词到占位符的映射规则
const KEYWORD_RULES = [
  { keywords: ['架构', '系统设计', '技术方案'], placeholder: '技术架构图', reason: '检测到技术架构相关描述，建议插入架构图' },
  { keywords: ['网络', '拓扑', '组网'], placeholder: '网络拓扑图', reason: '检测到网络拓扑描述，建议插入网络拓扑图' },
  { keywords: ['流程', '业务逻辑', '审批'], placeholder: '业务流程图', reason: '检测到业务流程描述，建议插入流程图' },
  { keywords: ['功能', '模块', '子系统'], placeholder: '功能模块清单', reason: '检测到功能模块描述，建议插入功能清单表' },
  { keywords: ['实施', '进度', '计划', '工期'], placeholder: '项目进度表', reason: '检测到实施计划描述，建议插入进度表' },
  { keywords: ['人员', '团队', '配置', '岗位'], placeholder: '人员配置表', reason: '检测到人员配置描述，建议插入人员表' },
  { keywords: ['业绩', '案例', '经验', '同类项目'], placeholder: '项目业绩表', reason: '检测到项目业绩描述，建议插入业绩表' },
  { keywords: ['资质', '证书', '认证', '执照'], placeholder: '企业营业执照', reason: '检测到资质描述，建议插入资质证书' },
  { keywords: ['ISO', '质量体系', '质量管理'], placeholder: 'ISO9001认证证书', reason: '检测到质量体系描述，建议插入ISO证书' },
  { keywords: ['PMP', '项目经理资质'], placeholder: '项目经理PMP证书', reason: '检测到项目经理资质描述，建议插入PMP证书' },
  { keywords: ['售后', '服务响应', '运维'], placeholder: '服务响应时间表', reason: '检测到售后服务描述，建议插入响应时间表' },
];

/**
 * 生成占位符文本
 * @param {string} placeholderType - 占位符类型 (image/table/qualification)
 * @param {Object} data - 占位符数据
 * @returns {string} 占位符文本
 */
function generatePlaceholderText(placeholderType, data) {
  const templateInfo = PLACEHOLDER_TYPES[placeholderType];
  if (!templateInfo) {
    return `[未知占位符类型: ${placeholderType}]`;
  }

  let result = templateInfo.template;
  for (const [key, value] of Object.entries(data)) {
    result = result.replace(new RegExp(`\\{${key}\\}`, 'g'), value || '');
  }
  return result;
}

/**
 * 在内容中插入占位符
 * @param {string} content - 原始内容
 * @param {string} placeholderName - 占位符名称（COMMON_PLACEHOLDERS 中的键）
 * @param {string} position - 插入位置 (end/start)
 * @returns {string} 插入后的内容
 */
function insertPlaceholder(content, placeholderName, position = 'end') {
  const placeholderInfo = COMMON_PLACEHOLDERS[placeholderName];
  if (!placeholderInfo) {
    return content;
  }

  const placeholderText = generatePlaceholderText(placeholderInfo.type, placeholderInfo.data);

  if (position === 'end') {
    return content + '\n\n' + placeholderText;
  } else if (position === 'start') {
    return placeholderText + '\n\n' + content;
  }
  return content;
}

/**
 * 分析内容，建议需要插入的占位符
 * @param {string} content - 待分析内容
 * @returns {Array<Object>} 建议列表 [{name, reason}]
 */
function analyzeContentForPlaceholders(content) {
  if (!content || typeof content !== 'string') {
    return [];
  }

  const suggestions = [];
  const matched = new Set();

  for (const rule of KEYWORD_RULES) {
    if (matched.has(rule.placeholder)) continue;

    const hasKeyword = rule.keywords.some((kw) => content.includes(kw));
    if (hasKeyword) {
      matched.add(rule.placeholder);
      suggestions.push({
        name: rule.placeholder,
        reason: rule.reason,
      });
    }
  }

  return suggestions;
}

/**
 * 批量分析多个章节内容
 * @param {Array<Object>} chapters - [{title, content}]
 * @returns {Array<Object>} 每个章节的建议
 */
function analyzeChapters(chapters) {
  if (!Array.isArray(chapters)) return [];

  return chapters.map((chapter) => ({
    title: chapter.title || '未命名章节',
    suggestions: analyzeContentForPlaceholders(chapter.content || ''),
  }));
}

/**
 * 自动为内容插入占位符
 * @param {string} content - 原始内容
 * @returns {{ content: string, inserted: Array<{name, reason}> }} 处理后的内容和插入记录
 */
function autoInsertPlaceholders(content) {
  const suggestions = analyzeContentForPlaceholders(content);
  let result = content;
  const inserted = [];

  for (const suggestion of suggestions) {
    result = insertPlaceholder(result, suggestion.name);
    inserted.push({ name: suggestion.name, reason: suggestion.reason });
  }

  return { content: result, inserted };
}

/**
 * 获取所有可用占位符列表
 * @returns {Array<Object>} 占位符列表
 */
function listPlaceholders() {
  return Object.entries(COMMON_PLACEHOLDERS).map(([name, info]) => ({
    name,
    type: info.type,
    description: info.data.description,
  }));
}

/**
 * 获取指定类型的占位符列表
 * @param {string} type - 占位符类型
 * @returns {Array<Object>} 过滤后的占位符列表
 */
function listPlaceholdersByType(type) {
  return Object.entries(COMMON_PLACEHOLDERS)
    .filter(([, info]) => info.type === type)
    .map(([name, info]) => ({
      name,
      type: info.type,
      description: info.data.description,
    }));
}

/**
 * 创建占位符服务实例
 */
function createPlaceholderService() {
  return {
    generatePlaceholderText,
    insertPlaceholder,
    analyzeContentForPlaceholders,
    analyzeChapters,
    autoInsertPlaceholders,
    listPlaceholders,
    listPlaceholdersByType,
    PLACEHOLDER_TYPES,
    COMMON_PLACEHOLDERS,
  };
}

module.exports = {
  createPlaceholderService,
  generatePlaceholderText,
  insertPlaceholder,
  analyzeContentForPlaceholders,
  analyzeChapters,
  autoInsertPlaceholders,
  listPlaceholders,
  listPlaceholdersByType,
  PLACEHOLDER_TYPES,
  COMMON_PLACEHOLDERS,
};
