/**
 * 模板知识服务
 * 加载和管理标书模板知识，为大纲生成提供参考
 * 参考: BiaoShu-SKILL templates 目录
 */

const fs = require('node:fs');
const path = require('node:path');

// 内置行业模板（精简版，完整版可从外部文件加载）
const BUILTIN_INDUSTRY_TEMPLATES = {
  manufacturing: {
    name: '制造业',
    code: 'manufacturing',
    characteristics: [
      '技术性强：涉及产品设计、材料选型、工艺流程等专业内容',
      '质量要求高：产品质量要求严格，需要符合国家标准',
      '生产能力强：需要具备相应的生产设备、生产场地',
      '供应链管理：需要管理原材料采购、生产计划、库存管理等',
    ],
    outline: [
      { title: '项目理解与需求分析', children: ['项目背景', '需求分析', '项目目标', '项目范围'] },
      { title: '技术方案与产品设计', children: ['产品设计方案', '技术参数说明', '材料选型', '工艺流程'] },
      { title: '生产制造方案', children: ['生产计划', '质量控制', '检验标准', '包装运输'] },
      { title: '质量保证与检验', children: ['质量目标', '质量体系', '质量措施', '质量检验'] },
      { title: '供货与安装方案', children: ['供货计划', '安装方案', '调试方案', '验收方案'] },
      { title: '售后服务与培训', children: ['服务体系', '响应时间', '维修保养', '备品备件'] },
      { title: '企业资质与业绩', children: ['企业资质', '生产能力', '类似项目业绩', '客户评价'] },
    ],
    keyPoints: {
      '技术方案': ['产品设计要合理，满足需求', '技术参数要先进，符合标准', '材料选型要科学，质量可靠', '工艺流程要合理，效率高'],
      '生产制造': ['生产计划要科学，按时交付', '质量控制要严格，确保质量', '检验标准要明确，符合要求', '包装运输要安全，确保完好'],
      '质量保证': ['质量目标要明确，可量化', '质量体系要完善，责任到人', '质量措施要具体，可执行', '质量检验要严格，有记录'],
      '售后服务': ['服务体系要完善，响应及时', '响应时间要明确，承诺兑现', '维修保养要专业，确保设备正常', '备品备件要充足，供应及时'],
    },
  },
  medical: {
    name: '医疗健康',
    code: 'medical',
    characteristics: [
      '法规严格：需要符合医疗行业法规和标准',
      '安全优先：产品安全性是首要考虑因素',
      '专业性强：涉及医疗专业知识和技术',
      '资质要求高：需要相关医疗资质和认证',
    ],
    outline: [
      { title: '项目理解与需求分析', children: ['项目背景', '需求分析', '项目目标', '项目范围'] },
      { title: '技术方案与产品设计', children: ['产品设计方案', '技术参数说明', '安全性设计', '合规性设计'] },
      { title: '质量管理体系', children: ['质量目标', '质量体系', '质量措施', '质量检验'] },
      { title: '生产与供应链', children: ['生产计划', '供应链管理', '库存管理', '物流配送'] },
      { title: '安装与调试方案', children: ['安装方案', '调试方案', '验收方案', '培训方案'] },
      { title: '售后服务与维护', children: ['服务体系', '响应时间', '维修保养', '备品备件'] },
      { title: '企业资质与业绩', children: ['企业资质', '医疗认证', '类似项目业绩', '客户评价'] },
    ],
    keyPoints: {
      '技术方案': ['产品设计要符合医疗标准', '技术参数要先进，安全可靠', '安全性设计要充分考虑', '合规性设计要符合法规要求'],
      '质量管理': ['质量目标要明确，可量化', '质量体系要完善，责任到人', '质量措施要具体，可执行', '质量检验要严格，有记录'],
      '售后服务': ['服务体系要完善，响应及时', '响应时间要明确，承诺兑现', '维修保养要专业，确保设备正常', '备品备件要充足，供应及时'],
    },
  },
  construction: {
    name: '建筑工程',
    code: 'construction',
    characteristics: [
      '项目周期长：涉及设计、施工、验收等多个阶段',
      '安全要求高：施工安全是首要考虑因素',
      '质量控制严：工程质量要求严格',
      '协调复杂：需要多方协调配合',
    ],
    outline: [
      { title: '项目理解与需求分析', children: ['项目背景', '需求分析', '项目目标', '项目范围'] },
      { title: '施工组织设计', children: ['施工方案', '施工进度', '施工组织', '施工安全'] },
      { title: '技术方案', children: ['技术路线', '技术参数', '技术措施', '技术创新'] },
      { title: '质量保证措施', children: ['质量目标', '质量体系', '质量措施', '质量检验'] },
      { title: '安全文明施工', children: ['安全目标', '安全体系', '安全措施', '文明施工'] },
      { title: '环境保护措施', children: ['环保目标', '环保体系', '环保措施', '环保监测'] },
      { title: '售后服务与保修', children: ['服务体系', '响应时间', '维修保养', '保修承诺'] },
      { title: '企业资质与业绩', children: ['企业资质', '施工资质', '类似项目业绩', '客户评价'] },
    ],
    keyPoints: {
      '施工组织': ['施工方案要科学合理', '施工进度要按时完成', '施工组织要高效有序', '施工安全要保障到位'],
      '质量保证': ['质量目标要明确，可量化', '质量体系要完善，责任到人', '质量措施要具体，可执行', '质量检验要严格，有记录'],
      '安全文明': ['安全目标要明确', '安全体系要完善', '安全措施要具体', '文明施工要规范'],
    },
  },
  it: {
    name: '信息技术',
    code: 'it',
    characteristics: [
      '技术更新快：需要采用先进技术方案',
      '集成性强：需要与现有系统集成',
      '安全性高：数据安全和系统安全是关键',
      '可扩展性：系统需要具备良好的扩展性',
    ],
    outline: [
      { title: '项目理解与需求分析', children: ['项目背景', '需求分析', '项目目标', '项目范围'] },
      { title: '系统架构设计', children: ['总体架构', '技术选型', '系统设计', '接口设计'] },
      { title: '功能设计方案', children: ['功能模块', '业务流程', '数据设计', '界面设计'] },
      { title: '技术实现方案', children: ['开发方案', '测试方案', '部署方案', '运维方案'] },
      { title: '安全保障方案', children: ['安全目标', '安全体系', '安全措施', '安全测试'] },
      { title: '项目实施计划', children: ['实施计划', '进度安排', '资源投入', '风险管理'] },
      { title: '培训与售后服务', children: ['培训方案', '服务体系', '响应时间', '技术支持'] },
      { title: '企业资质与业绩', children: ['企业资质', '技术认证', '类似项目业绩', '客户评价'] },
    ],
    keyPoints: {
      '系统架构': ['总体架构要先进合理', '技术选型要成熟可靠', '系统设计要可扩展', '接口设计要标准化'],
      '安全保障': ['安全目标要明确', '安全体系要完善', '安全措施要具体', '安全测试要全面'],
      '项目实施': ['实施计划要科学', '进度安排要合理', '资源投入要充足', '风险管理要到位'],
    },
  },
  service: {
    name: '咨询服务',
    code: 'service',
    characteristics: [
      '专业性强：需要具备专业知识和经验',
      '定制化高：服务方案需要根据客户需求定制',
      '成果导向：服务成果需要可衡量',
      '持续性长：服务周期可能较长',
    ],
    outline: [
      { title: '项目理解与需求分析', children: ['项目背景', '需求分析', '项目目标', '项目范围'] },
      { title: '服务方案设计', children: ['服务目标', '服务内容', '服务流程', '服务标准'] },
      { title: '团队配置与管理', children: ['团队配置', '人员资质', '管理制度', '沟通机制'] },
      { title: '质量保证措施', children: ['质量目标', '质量体系', '质量措施', '质量监控'] },
      { title: '项目实施计划', children: ['实施计划', '进度安排', '里程碑', '交付物'] },
      { title: '风险控制与应对', children: ['风险识别', '风险评估', '风险应对', '应急预案'] },
      { title: '售后服务与支持', children: ['服务体系', '响应时间', '技术支持', '培训服务'] },
      { title: '企业资质与业绩', children: ['企业资质', '专业认证', '类似项目业绩', '客户评价'] },
    ],
    keyPoints: {
      '服务方案': ['服务目标要明确', '服务内容要全面', '服务流程要清晰', '服务标准要可衡量'],
      '团队配置': ['团队配置要合理', '人员资质要符合要求', '管理制度要完善', '沟通机制要畅通'],
      '质量保证': ['质量目标要明确', '质量体系要完善', '质量措施要具体', '质量监控要到位'],
    },
  },
};

// 通用标书模板结构
const COMMON_OUTLINE_TEMPLATE = {
  name: '通用标书模板',
  description: '适用于大多数投标项目的通用模板',
  outline: [
    { title: '项目理解与需求分析', children: ['项目背景', '需求分析', '项目目标', '项目范围'] },
    { title: '技术方案', children: ['技术路线', '技术参数', '技术措施', '技术创新'] },
    { title: '实施方案', children: ['实施计划', '进度安排', '资源投入', '风险管理'] },
    { title: '质量保证', children: ['质量目标', '质量体系', '质量措施', '质量检验'] },
    { title: '售后服务', children: ['服务体系', '响应时间', '维修保养', '技术支持'] },
    { title: '企业资质与业绩', children: ['企业资质', '类似项目业绩', '客户评价', '荣誉证书'] },
  ],
};

/**
 * 获取所有可用行业模板
 * @returns {Array<Object>} 行业模板列表
 */
function listIndustryTemplates() {
  return Object.values(BUILTIN_INDUSTRY_TEMPLATES).map((template) => ({
    code: template.code,
    name: template.name,
    characteristics: template.characteristics,
    outlineCount: template.outline.length,
  }));
}

/**
 * 获取指定行业模板
 * @param {string} industryCode - 行业代码
 * @returns {Object|null} 行业模板
 */
function getIndustryTemplate(industryCode) {
  const aliases = {
    it_information: 'it',
    consulting: 'service',
    logistics: 'service',
    operation_service: 'service',
    government_procurement: 'service',
  };
  const normalizedCode = aliases[industryCode] || industryCode;
  return BUILTIN_INDUSTRY_TEMPLATES[normalizedCode] || null;
}

/**
 * 获取通用模板
 * @returns {Object} 通用模板
 */
function getCommonTemplate() {
  return COMMON_OUTLINE_TEMPLATE;
}

/**
 * 根据行业代码生成模板参考大纲
 * @param {string} industryCode - 行业代码
 * @returns {Array<Object>} 模板大纲
 */
function generateTemplateOutline(industryCode) {
  const template = getIndustryTemplate(industryCode);
  if (!template) {
    return COMMON_OUTLINE_TEMPLATE.outline;
  }

  return template.outline.map((section, index) => ({
    id: String(index + 1),
    title: section.title,
    description: `${template.name}行业 - ${section.title}`,
    children: section.children.map((child, childIndex) => ({
      id: `${index + 1}.${childIndex + 1}`,
      title: child,
      description: `${section.title} - ${child}`,
    })),
  }));
}

/**
 * 生成模板参考提示词
 * @param {string} industryCode - 行业代码
 * @returns {string} 模板参考提示词
 */
function generateTemplateReferencePrompt(industryCode) {
  const template = getIndustryTemplate(industryCode);
  if (!template) {
    return '';
  }

  const outlineText = template.outline.map((section) => {
    const childrenText = section.children.map((child) => `  - ${child}`).join('\n');
    return `### ${section.title}\n${childrenText}`;
  }).join('\n');

  const keyPointsText = Object.entries(template.keyPoints).map(([section, points]) => {
    const pointsText = points.map((point) => `  - ${point}`).join('\n');
    return `### ${section}\n${pointsText}`;
  }).join('\n');

  return `## ${template.name}行业投标文件编写参考

### 行业特点
${template.characteristics.map((char) => `- ${char}`).join('\n')}

### 推荐章节结构
${outlineText}

### 关键内容编写要点
${keyPointsText}`;
}

/**
 * 加载外部模板文件
 * @param {string} templatePath - 模板文件路径
 * @returns {Object|null} 模板内容
 */
function loadExternalTemplate(templatePath) {
  try {
    if (!fs.existsSync(templatePath)) {
      return null;
    }
    const content = fs.readFileSync(templatePath, 'utf-8');
    return parseTemplateContent(content);
  } catch (error) {
    console.error('[template] 加载外部模板失败:', error.message);
    return null;
  }
}

/**
 * 解析模板内容
 * @param {string} content - 模板文件内容
 * @returns {Object} 解析后的模板
 */
function parseTemplateContent(content) {
  const lines = content.split('\n');
  const outline = [];
  let currentSection = null;
  let currentChildren = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('## ')) {
      if (currentSection) {
        outline.push({
          title: currentSection,
          children: currentChildren,
        });
      }
      currentSection = trimmed.replace('## ', '').trim();
      currentChildren = [];
    } else if (trimmed.startsWith('- ') && currentSection) {
      currentChildren.push(trimmed.replace('- ', '').trim());
    }
  }

  if (currentSection) {
    outline.push({
      title: currentSection,
      children: currentChildren,
    });
  }

  return { outline };
}

/**
 * 创建模板知识服务实例
 */
function createTemplateKnowledgeService() {
  return {
    listIndustryTemplates,
    getIndustryTemplate,
    getCommonTemplate,
    generateTemplateOutline,
    generateTemplateReferencePrompt,
    loadExternalTemplate,
    BUILTIN_INDUSTRY_TEMPLATES,
    COMMON_OUTLINE_TEMPLATE,
  };
}

module.exports = {
  createTemplateKnowledgeService,
  listIndustryTemplates,
  getIndustryTemplate,
  getCommonTemplate,
  generateTemplateOutline,
  generateTemplateReferencePrompt,
  loadExternalTemplate,
  BUILTIN_INDUSTRY_TEMPLATES,
  COMMON_OUTLINE_TEMPLATE,
};
