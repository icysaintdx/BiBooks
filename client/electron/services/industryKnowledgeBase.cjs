/**
 * 行业知识库服务
 * 管理行业配置、模板知识、评分规则
 * 支持内置行业和用户自定义行业扩展
 */

const fs = require('node:fs');
const path = require('node:path');
const { logInfo, logError } = require('../utils/logger.cjs');
const { detectIndustry, INDUSTRY_CONFIG, getIndustryConfig, getChapterStructure } = require('./industryDetector.cjs');

// 内置行业详细知识（评分权重、常见问题、写作要点）
const INDUSTRY_KNOWLEDGE = {
  it_information: {
    scoringWeights: { techSolution: 40, implementation: 20, qualification: 15, price: 15, service: 10 },
    commonPitfalls: [
      '技术方案过于笼统，缺乏针对性',
      '未说明系统架构的可扩展性',
      '数据安全设计不充分',
      '接口设计缺少异常处理说明',
    ],
    writingTips: [
      '技术方案要结合招标需求逐项响应',
      '架构图、流程图要清晰标注',
      '性能指标要有具体数据支撑',
      '安全设计要符合等保要求',
    ],
    keyMetrics: ['响应时间', '并发用户数', '数据处理量', '系统可用性', '故障恢复时间'],
  },
  construction: {
    scoringWeights: { techSolution: 30, orgDesign: 25, qualitySafety: 20, schedule: 15, qualification: 10 },
    commonPitfalls: [
      '施工方案缺乏针对性，照搬模板',
      '质量措施泛泛而谈',
      '安全措施不完善',
      '进度计划不合理',
    ],
    writingTips: [
      '施工方案要针对工程特点编制',
      '质量措施要具体到工序',
      '安全措施要覆盖所有危险源',
      '进度计划要考虑季节因素',
    ],
    keyMetrics: ['工期', '质量标准', '安全指标', '环保要求'],
  },
  medical: {
    scoringWeights: { techParams: 35, productConfig: 25, afterSales: 20, qualification: 15, price: 5 },
    commonPitfalls: [
      '技术参数响应不完整',
      '售后服务方案不具体',
      '培训计划缺乏可操作性',
      '未说明设备兼容性',
    ],
    writingTips: [
      '技术参数要逐项响应招标要求',
      '产品配置要说明选型理由',
      '售后服务要有响应时间承诺',
      '培训计划要分层次设计',
    ],
    keyMetrics: ['技术参数达标率', '响应时间', '培训课时', '质保期'],
  },
  education: {
    scoringWeights: { techSolution: 35, implementation: 25, service: 20, qualification: 15, price: 5 },
    commonPitfalls: [
      '技术方案与教学需求脱节',
      '实施方案缺乏学校特色',
      '培训计划不考虑教师实际水平',
      '售后服务响应不及时',
    ],
    writingTips: [
      '技术方案要结合教学场景设计',
      '实施方案要配合学校学期安排',
      '培训计划要分批次、分层次',
      '售后服务要有专人对接',
    ],
    keyMetrics: ['功能覆盖率', '系统易用性', '培训满意度', '故障响应时间'],
  },
  manufacturing: {
    scoringWeights: { techParams: 35, production: 25, quality: 20, delivery: 15, price: 5 },
    commonPitfalls: [
      '技术参数不满足招标要求',
      '生产工艺描述不清晰',
      '质量控制措施不具体',
      '交付计划不合理',
    ],
    writingTips: [
      '技术参数要逐项对标响应',
      '生产工艺要附流程图',
      '质量控制要说明检验标准',
      '交付计划要留有余量',
    ],
    keyMetrics: ['技术达标率', '产能', '良品率', '交付周期'],
  },
  logistics: {
    scoringWeights: { servicePlan: 35, resources: 25, safety: 20, emergency: 15, price: 5 },
    commonPitfalls: [
      '服务方案不具体',
      '资源配置不合理',
      '安全管理措施不完善',
      '应急预案缺乏可操作性',
    ],
    writingTips: [
      '服务方案要覆盖全流程',
      '资源配置要说明车辆/人员/仓储',
      '安全管理要符合行业标准',
      '应急预案要定期演练',
    ],
    keyMetrics: ['准时率', '破损率', '投诉率', '响应时间'],
  },
  consulting: {
    scoringWeights: { method: 35, team: 25, plan: 20, deliverable: 15, price: 5 },
    commonPitfalls: [
      '方法论不清晰',
      '团队配置与项目需求不匹配',
      '工作计划不具体',
      '交付物标准不明确',
    ],
    writingTips: [
      '方法论要有理论支撑和实践验证',
      '团队配置要突出核心成员经验',
      '工作计划要明确里程碑',
      '交付物要说明质量标准',
    ],
    keyMetrics: ['项目周期', '交付物数量', '满意度', '后续支持'],
  },
  general: {
    scoringWeights: { techSolution: 35, implementation: 25, qualification: 20, price: 10, service: 10 },
    commonPitfalls: [
      '方案缺乏针对性',
      '响应不完整',
      '格式不规范',
      '报价不合理',
    ],
    writingTips: [
      '逐项响应招标要求',
      '方案要有针对性和可操作性',
      '格式要符合招标文件要求',
      '报价要合理有据',
    ],
    keyMetrics: ['响应完整率', '方案可行性', '价格合理性'],
  },
};

/**
 * 获取行业完整知识（配置 + 扩展知识）
 * @param {string} industryCode - 行业代码
 * @returns {object} 完整行业知识
 */
function getIndustryFullKnowledge(industryCode) {
  const config = getIndustryConfig(industryCode);
  const knowledge = INDUSTRY_KNOWLEDGE[industryCode] || INDUSTRY_KNOWLEDGE.general;

  return {
    code: industryCode,
    name: config.name,
    description: config.description,
    keywords: config.keywords,
    chapterStructure: config.chapter_structure,
    keySections: config.key_sections,
    scoringWeights: knowledge.scoringWeights,
    commonPitfalls: knowledge.commonPitfalls,
    writingTips: knowledge.writingTips,
    keyMetrics: knowledge.keyMetrics,
  };
}

/**
 * 生成行业专属的目录建议
 * @param {string} industryCode - 行业代码
 * @param {object} scoringCriteria - 评分标准（可选）
 * @returns {Array<object>} 目录建议列表
 */
function generateIndustryOutlineSuggestion(industryCode, scoringCriteria = null) {
  const config = getIndustryConfig(industryCode);
  const knowledge = INDUSTRY_KNOWLEDGE[industryCode] || INDUSTRY_KNOWLEDGE.general;
  const chapters = config.chapter_structure || [];

  return chapters.map((title, index) => ({
    id: `chapter_${index + 1}`,
    title,
    weight: getChapterWeight(title, knowledge.scoringWeights),
    keyPoints: config.key_sections?.[title] || [],
    tips: getChapterTips(title, knowledge),
  }));
}

/**
 * 生成行业指南 Markdown 内容
 * @param {string} industryCode - 行业代码
 * @returns {string} Markdown 格式的行业指南
 */
function generateIndustryGuideMarkdown(industryCode) {
  const knowledge = getIndustryFullKnowledge(industryCode);

  const lines = [];
  lines.push(`# ${knowledge.name}行业投标文件编写指南`);
  lines.push('');
  lines.push('## 一、行业特点');
  lines.push('');
  lines.push(`${knowledge.description}行业投标文件具有以下特点：`);
  lines.push('');
  knowledge.writingTips.forEach((tip, i) => {
    lines.push(`${i + 1}. ${tip}`);
  });
  lines.push('');

  lines.push('## 二、章节结构');
  lines.push('');
  knowledge.chapterStructure.forEach((chapter, i) => {
    lines.push(`### 2.${i + 1} ${chapter}`);
    const keyPoints = knowledge.keySections[chapter] || [];
    keyPoints.forEach((point) => {
      lines.push(`- ${point}`);
    });
    lines.push('');
  });

  lines.push('## 三、评分权重参考');
  lines.push('');
  lines.push('| 评分维度 | 权重 |');
  lines.push('|----------|------|');
  for (const [dim, weight] of Object.entries(knowledge.scoringWeights)) {
    const dimName = {
      techSolution: '技术方案', implementation: '实施管理', qualification: '资质业绩',
      price: '报价', service: '售后服务', orgDesign: '组织设计',
      qualitySafety: '质量安全', schedule: '工期进度', techParams: '技术参数',
      productConfig: '产品配置', afterSales: '售后服务', production: '生产制造',
      quality: '质量管理', delivery: '交付', resources: '资源配置',
      safety: '安全管理', emergency: '应急预案', method: '方法论', team: '团队配置',
      plan: '工作计划', deliverable: '交付物',
    }[dim] || dim;
    lines.push(`| ${dimName} | ${weight}% |`);
  }
  lines.push('');

  lines.push('## 四、常见问题');
  lines.push('');
  knowledge.commonPitfalls.forEach((pitfall, i) => {
    lines.push(`${i + 1}. ${pitfall}`);
  });
  lines.push('');

  lines.push('## 五、关键指标');
  lines.push('');
  knowledge.keyMetrics.forEach((metric) => {
    lines.push(`- ${metric}`);
  });
  lines.push('');

  return lines.join('\n');
}

/**
 * 检测行业并返回完整知识
 * @param {string} tenderText - 招标文件文本
 * @returns {object} { industry, knowledge, guideMarkdown }
 */
function detectAndProvideKnowledge(tenderText) {
  const industry = detectIndustry(tenderText);
  const knowledge = getIndustryFullKnowledge(industry.industryCode);
  const guideMarkdown = generateIndustryGuideMarkdown(industry.industryCode);
  const outlineSuggestion = generateIndustryOutlineSuggestion(industry.industryCode);

  return {
    industry,
    knowledge,
    guideMarkdown,
    outlineSuggestion,
  };
}

// ========== 内部工具函数 ==========

function getChapterWeight(chapterTitle, scoringWeights) {
  const titleLower = chapterTitle.toLowerCase();
  if (titleLower.includes('技术') || titleLower.includes('方案')) return scoringWeights.techSolution || 35;
  if (titleLower.includes('实施') || titleLower.includes('管理')) return scoringWeights.implementation || 25;
  if (titleLower.includes('资质') || titleLower.includes('业绩')) return scoringWeights.qualification || 20;
  if (titleLower.includes('售后') || titleLower.includes('服务')) return scoringWeights.service || 10;
  if (titleLower.includes('报价') || titleLower.includes('价格')) return scoringWeights.price || 10;
  return 15;
}

function getChapterTips(chapterTitle, knowledge) {
  const tips = [];
  if (chapterTitle.includes('技术')) {
    tips.push('要结合招标需求逐项响应');
    tips.push('附架构图、流程图说明');
  }
  if (chapterTitle.includes('实施')) {
    tips.push('明确实施计划和里程碑');
    tips.push('说明人员配置和职责');
  }
  if (chapterTitle.includes('售后')) {
    tips.push('承诺响应时间');
    tips.push('说明服务体系');
  }
  return tips;
}

module.exports = {
  getIndustryFullKnowledge,
  generateIndustryOutlineSuggestion,
  generateIndustryGuideMarkdown,
  detectAndProvideKnowledge,
  INDUSTRY_KNOWLEDGE,
};
