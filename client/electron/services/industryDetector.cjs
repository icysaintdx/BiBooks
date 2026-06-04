/**
 * 行业检测模块
 * 基于关键词匹配自动识别招标文件所属行业
 * 移植自 BiaoShu-SKILL industry_detector.py
 */

const path = require('node:path');

// 行业配置（内联，避免文件读取依赖）
const INDUSTRY_CONFIG = {
  it_information: {
    name: 'IT/信息化',
    description: '信息技术、软件开发、系统集成、数据中心等',
    keywords: ['信息化', '软件', '系统集成', '数据中心', '云计算', '大数据', '人工智能', '数字化'],
    chapter_structure: [
      '项目理解与需求分析',
      '技术方案',
      '项目实施与管理',
      '项目业绩与案例',
      '售后服务与培训',
      '附件',
    ],
    key_sections: {
      '技术方案': ['总体架构', '功能设计', '数据设计', '安全设计', '性能设计', '接口设计'],
      '项目实施': ['实施计划', '人员配置', '质量保证', '风险控制', '沟通管理'],
      '售后服务': ['服务体系', '响应时间', '培训计划', '备品备件'],
    },
  },
  construction: {
    name: '建筑工程',
    description: '建筑施工、工程总承包、装饰装修、市政工程等',
    keywords: ['建筑', '施工', '工程', '装修', '市政', '道路', '桥梁', '隧道'],
    chapter_structure: [
      '工程概况与理解',
      '施工组织设计',
      '技术方案与措施',
      '质量保证措施',
      '安全文明施工',
      '工期保证措施',
      '项目管理机构',
      '类似工程业绩',
      '附件',
    ],
    key_sections: {
      '施工组织设计': ['施工部署', '施工方案', '施工进度', '施工平面布置'],
      '技术方案': ['基础工程', '主体工程', '装饰工程', '安装工程'],
      '质量保证': ['质量目标', '质量体系', '质量措施', '质量检验'],
      '安全文明': ['安全目标', '安全体系', '安全措施', '文明施工'],
    },
  },
  medical: {
    name: '医疗健康',
    description: '医疗设备、医疗服务、健康管理、医药等',
    keywords: ['医疗', '健康', '医院', '设备', '药品', '诊断', '治疗', '康复'],
    chapter_structure: [
      '项目理解与需求分析',
      '技术方案与产品配置',
      '供货与实施方案',
      '质量保证与售后服务',
      '培训计划',
      '企业资质与业绩',
      '附件',
    ],
    key_sections: {
      '技术方案': ['产品配置', '技术参数', '功能说明', '兼容性'],
      '供货方案': ['供货计划', '物流方案', '安装调试', '验收方案'],
      '售后服务': ['服务体系', '响应时间', '维修保养', '备品备件'],
      '培训计划': ['操作培训', '维护培训', '安全培训'],
    },
  },
  education: {
    name: '教育服务',
    description: '教育信息化、教学设备、培训服务、校园建设等',
    keywords: ['教育', '学校', '教学', '培训', '校园', '课程', '实验室', '图书馆'],
    chapter_structure: [
      '项目理解与需求分析',
      '技术方案与产品配置',
      '实施方案与进度计划',
      '质量保证与售后服务',
      '培训计划与技术支持',
      '企业资质与业绩',
      '附件',
    ],
    key_sections: {
      '技术方案': ['系统架构', '功能模块', '技术参数', '兼容性'],
      '实施方案': ['实施计划', '人员配置', '进度安排', '验收方案'],
      '售后服务': ['服务体系', '响应时间', '技术支持', '升级维护'],
      '培训计划': ['教师培训', '学生培训', '管理员培训'],
    },
  },
  manufacturing: {
    name: '制造业',
    description: '设备制造、工业自动化、智能制造、供应链等',
    keywords: ['制造', '设备', '自动化', '智能制造', '工业', '生产线', '供应链', '质量'],
    chapter_structure: [
      '项目理解与需求分析',
      '技术方案与产品设计',
      '生产制造方案',
      '质量保证与检验',
      '供货与安装方案',
      '售后服务与培训',
      '企业资质与业绩',
      '附件',
    ],
    key_sections: {
      '技术方案': ['产品设计', '技术参数', '材料选型', '工艺流程'],
      '生产制造': ['生产计划', '质量控制', '检验标准', '包装运输'],
      '供货安装': ['供货计划', '安装方案', '调试方案', '验收方案'],
      '售后服务': ['服务体系', '响应时间', '维修保养', '备品备件'],
    },
  },
  logistics: {
    name: '物流运输',
    description: '物流服务、运输服务、仓储服务、供应链管理等',
    keywords: ['物流', '运输', '仓储', '配送', '供应链', '快递', '货运', '冷链'],
    chapter_structure: [
      '项目理解与需求分析',
      '服务方案与运营计划',
      '资源配置与能力',
      '质量保证与安全管理',
      '应急预案与风险控制',
      '服务承诺与价格',
      '企业资质与业绩',
      '附件',
    ],
    key_sections: {
      '服务方案': ['服务内容', '运营计划', '服务标准', '服务流程'],
      '资源配置': ['车辆配置', '人员配置', '仓储设施', '信息系统'],
      '质量保证': ['质量目标', '质量体系', '质量措施', '质量检验'],
      '安全管理': ['安全目标', '安全体系', '安全措施', '应急预案'],
    },
  },
  consulting: {
    name: '咨询服务',
    description: '管理咨询、技术咨询、审计服务、法律服务等',
    keywords: ['咨询', '管理', '审计', '法律', '评估', '规划', '研究', '策划'],
    chapter_structure: [
      '项目理解与需求分析',
      '服务方案与方法论',
      '项目团队与资源配置',
      '工作计划与进度安排',
      '质量保证与成果交付',
      '服务承诺与报价',
      '企业资质与业绩',
      '附件',
    ],
    key_sections: {
      '服务方案': ['服务内容', '方法论', '工具技术', '创新点'],
      '项目团队': ['团队配置', '人员资质', '职责分工', '沟通机制'],
      '工作计划': ['工作阶段', '里程碑', '交付物', '进度安排'],
      '质量保证': ['质量目标', '质量体系', '质量措施', '成果验收'],
    },
  },
  general: {
    name: '通用行业',
    description: '适用于未指定行业的通用模板',
    keywords: [],
    chapter_structure: [
      '项目理解与需求分析',
      '技术方案与服务方案',
      '项目实施与管理',
      '质量保证与售后服务',
      '企业资质与业绩',
      '附件',
    ],
    key_sections: {
      '技术方案': ['总体方案', '详细设计', '技术参数', '创新点'],
      '项目实施': ['实施计划', '人员配置', '进度安排', '风险控制'],
      '售后服务': ['服务体系', '响应时间', '培训计划', '备品备件'],
    },
  },
};

const DETECTION_CONFIG = {
  confidence_threshold: 0.3,
  fallback_industry: 'general',
};

/**
 * 计算关键词匹配分数
 * @param {string} text - 待检测文本
 * @param {string[]} keywords - 关键词列表
 * @returns {number} 匹配分数 (0-1)
 */
function calculateKeywordScore(text, keywords) {
  if (!text || !keywords || keywords.length === 0) return 0;

  const textLower = text.toLowerCase();
  let matchedCount = 0;

  for (const keyword of keywords) {
    if (textLower.includes(keyword.toLowerCase())) {
      matchedCount++;
    }
  }

  return matchedCount / keywords.length;
}

/**
 * 检测文本所属行业
 * @param {string} text - 招标文件文本内容
 * @returns {{ industryCode: string, confidence: number, config: object }}
 */
function detectIndustry(text) {
  if (!text) {
    return { industryCode: 'general', confidence: 0, config: INDUSTRY_CONFIG.general };
  }

  const scores = {};

  for (const [code, config] of Object.entries(INDUSTRY_CONFIG)) {
    const keywords = config.keywords || [];
    if (keywords.length === 0) continue;
    scores[code] = calculateKeywordScore(text, keywords);
  }

  // 找最高分
  let bestCode = DETECTION_CONFIG.fallback_industry;
  let bestScore = 0;

  for (const [code, score] of Object.entries(scores)) {
    if (score > bestScore) {
      bestScore = score;
      bestCode = code;
    }
  }

  if (bestScore >= DETECTION_CONFIG.confidence_threshold) {
    return {
      industryCode: bestCode,
      confidence: bestScore,
      config: INDUSTRY_CONFIG[bestCode],
    };
  }

  return {
    industryCode: DETECTION_CONFIG.fallback_industry,
    confidence: 0,
    config: INDUSTRY_CONFIG[DETECTION_CONFIG.fallback_industry],
  };
}

/**
 * 获取行业配置
 * @param {string} industryCode - 行业代码
 * @returns {object} 行业配置
 */
function getIndustryConfig(industryCode) {
  return INDUSTRY_CONFIG[industryCode] || INDUSTRY_CONFIG.general;
}

/**
 * 获取行业章节结构
 * @param {string} industryCode - 行业代码
 * @returns {string[]} 章节列表
 */
function getChapterStructure(industryCode) {
  const config = getIndustryConfig(industryCode);
  return config.chapter_structure || [];
}

/**
 * 列出所有支持的行业
 * @returns {Array<{code: string, name: string, description: string}>}
 */
function listIndustries() {
  return Object.entries(INDUSTRY_CONFIG).map(([code, config]) => ({
    code,
    name: config.name,
    description: config.description,
  }));
}

module.exports = {
  detectIndustry,
  getIndustryConfig,
  getChapterStructure,
  listIndustries,
  INDUSTRY_CONFIG,
};
