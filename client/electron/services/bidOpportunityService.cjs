/**
 * 投标机会服务
 * 管理招标信息、项目跟踪、投标决策分析
 */

const fs = require('node:fs');
const path = require('node:path');

// 投标机会状态
const OPPORTUNITY_STATUS = {
  DISCOVERED: 'discovered', // 已发现
  ANALYZING: 'analyzing', // 分析中
  DECIDING: 'deciding', // 决策中
  BIDDING: 'bidding', // 投标中
  WON: 'won', // 中标
  LOST: 'lost', // 未中标
  CANCELLED: 'cancelled', // 已取消
  ABANDONED: 'abandoned', // 已放弃
};

// 投标决策因素
const DECISION_FACTORS = {
  projectMatch: {
    id: 'projectMatch',
    name: '项目匹配度',
    description: '项目与公司业务的匹配程度',
    weight: 0.25,
  },
  competitionLevel: {
    id: 'competitionLevel',
    name: '竞争程度',
    description: '项目竞争激烈程度',
    weight: 0.20,
  },
  profitPotential: {
    id: 'profitPotential',
    name: '利润潜力',
    description: '项目预期利润空间',
    weight: 0.20,
  },
  resourceAvailability: {
    id: 'resourceAvailability',
    name: '资源可用性',
    description: '公司资源是否充足',
    weight: 0.15,
  },
  clientRelationship: {
    id: 'clientRelationship',
    name: '客户关系',
    description: '与客户的关系基础',
    weight: 0.10,
  },
  riskLevel: {
    id: 'riskLevel',
    name: '风险等级',
    description: '项目风险评估',
    weight: 0.10,
  },
};

// 招标信息来源
const TENDER_SOURCES = [
  { id: 'government', name: '政府采购网', url: 'http://www.ccgp.gov.cn/' },
  { id: 'centralized', name: '中央政府采购', url: 'http://www.zycg.gov.cn/' },
  { id: 'local', name: '地方采购网', url: '' },
  { id: 'industry', name: '行业招标网', url: '' },
  { id: 'enterprise', name: '企业招标平台', url: '' },
  { id: 'other', name: '其他来源', url: '' },
];

/**
 * 创建投标机会
 * @param {Object} opportunityData - 机会数据
 * @returns {Object} 投标机会
 */
function createOpportunity(opportunityData = {}) {
  const {
    projectName = '',
    tenderNo = '',
    clientName = '',
    budget = 0,
    deadline = '',
    source = 'other',
    description = '',
    requirements = [],
    attachments = [],
  } = opportunityData;

  return {
    id: generateId(),
    projectName,
    tenderNo,
    clientName,
    budget,
    deadline,
    source,
    description,
    requirements,
    attachments,
    status: OPPORTUNITY_STATUS.DISCOVERED,
    decisionScore: 0,
    decisionFactors: {},
    notes: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

/**
 * 生成唯一ID
 * @returns {string} 唯一ID
 */
function generateId() {
  return `opp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * 分析投标机会
 * @param {Object} opportunity - 投标机会
 * @param {Object} analysisData - 分析数据
 * @returns {Object} 分析结果
 */
function analyzeOpportunity(opportunity, analysisData = {}) {
  const {
    projectMatchScore = 50,
    competitionLevelScore = 50,
    profitPotentialScore = 50,
    resourceAvailabilityScore = 50,
    clientRelationshipScore = 50,
    riskLevelScore = 50,
    analysisNotes = '',
  } = analysisData;

  // 计算各因素得分
  const factors = {
    projectMatch: { score: projectMatchScore, weight: DECISION_FACTORS.projectMatch.weight },
    competitionLevel: { score: competitionLevelScore, weight: DECISION_FACTORS.competitionLevel.weight },
    profitPotential: { score: profitPotentialScore, weight: DECISION_FACTORS.profitPotential.weight },
    resourceAvailability: { score: resourceAvailabilityScore, weight: DECISION_FACTORS.resourceAvailability.weight },
    clientRelationship: { score: clientRelationshipScore, weight: DECISION_FACTORS.clientRelationship.weight },
    riskLevel: { score: riskLevelScore, weight: DECISION_FACTORS.riskLevel.weight },
  };

  // 计算加权总分
  const totalScore = Object.values(factors).reduce((sum, factor) => {
    return sum + (factor.score * factor.weight);
  }, 0);

  return {
    ...opportunity,
    status: OPPORTUNITY_STATUS.ANALYZING,
    decisionScore: Math.round(totalScore),
    decisionFactors: factors,
    analysisNotes,
    analyzedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

/**
 * 生成投标决策建议
 * @param {Object} analysisResult - 分析结果
 * @returns {Object} 决策建议
 */
function generateDecisionRecommendation(analysisResult) {
  const { decisionScore, decisionFactors } = analysisResult;

  let recommendation = '';
  let confidence = 0;
  let reasons = [];

  if (decisionScore >= 80) {
    recommendation = '强烈建议投标';
    confidence = 90;
    reasons.push('项目匹配度高，利润潜力大');
  } else if (decisionScore >= 60) {
    recommendation = '建议投标';
    confidence = 70;
    reasons.push('项目整体条件良好，值得参与');
  } else if (decisionScore >= 40) {
    recommendation = '谨慎考虑';
    confidence = 50;
    reasons.push('项目存在一定风险，需谨慎评估');
  } else {
    recommendation = '不建议投标';
    confidence = 30;
    reasons.push('项目条件不理想，建议放弃');
  }

  // 分析各因素
  const weakFactors = [];
  const strongFactors = [];

  for (const [factorId, factor] of Object.entries(decisionFactors)) {
    const factorInfo = DECISION_FACTORS[factorId];
    if (factor.score >= 70) {
      strongFactors.push(factorInfo.name);
    } else if (factor.score < 40) {
      weakFactors.push(factorInfo.name);
    }
  }

  if (strongFactors.length > 0) {
    reasons.push(`优势因素：${strongFactors.join('、')}`);
  }
  if (weakFactors.length > 0) {
    reasons.push(`风险因素：${weakFactors.join('、')}`);
  }

  return {
    recommendation,
    confidence,
    reasons,
    score: decisionScore,
    generatedAt: new Date().toISOString(),
  };
}

/**
 * 跟踪投标机会状态
 * @param {Object} opportunity - 投标机会
 * @param {string} newStatus - 新状态
 * @param {string} notes - 备注
 * @returns {Object} 更新后的机会
 */
function updateOpportunityStatus(opportunity, newStatus, notes = '') {
  const validStatuses = Object.values(OPPORTUNITY_STATUS);
  if (!validStatuses.includes(newStatus)) {
    throw new Error(`无效的状态：${newStatus}`);
  }

  const statusHistory = opportunity.statusHistory || [];
  statusHistory.push({
    from: opportunity.status,
    to: newStatus,
    notes,
    timestamp: new Date().toISOString(),
  });

  return {
    ...opportunity,
    status: newStatus,
    statusHistory,
    notes: [...(opportunity.notes || []), notes].filter(Boolean),
    updatedAt: new Date().toISOString(),
  };
}

/**
 * 生成投标日历
 * @param {Array<Object>} opportunities - 投标机会列表
 * @returns {Array<Object>} 日历事件
 */
function generateBidCalendar(opportunities) {
  const events = [];

  for (const opp of opportunities) {
    if (opp.deadline) {
      events.push({
        id: opp.id,
        title: opp.projectName,
        date: opp.deadline,
        type: 'deadline',
        status: opp.status,
        client: opp.clientName,
        budget: opp.budget,
      });
    }

    // 添加其他重要日期
    if (opp.bidDate) {
      events.push({
        id: `${opp.id}_bid`,
        title: `投标：${opp.projectName}`,
        date: opp.bidDate,
        type: 'bid',
        status: opp.status,
      });
    }

    if (opp.openingDate) {
      events.push({
        id: `${opp.id}_opening`,
        title: `开标：${opp.projectName}`,
        date: opp.openingDate,
        type: 'opening',
        status: opp.status,
      });
    }
  }

  // 按日期排序
  events.sort((a, b) => new Date(a.date) - new Date(b.date));

  return events;
}

/**
 * 生成竞争对手分析
 * @param {Object} opportunity - 投标机会
 * @param {Array<Object>} competitors - 竞争对手列表
 * @returns {Object} 竞争分析
 */
function analyzeCompetition(opportunity, competitors = []) {
  const competitorAnalysis = competitors.map((comp) => ({
    name: comp.name,
    strengths: comp.strengths || [],
    weaknesses: comp.weaknesses || [],
    winRate: comp.winRate || 0,
    relationship: comp.relationship || 'unknown',
  }));

  // 计算竞争激烈程度
  let competitionLevel = 'low';
  if (competitors.length >= 5) {
    competitionLevel = 'high';
  } else if (competitors.length >= 3) {
    competitionLevel = 'medium';
  }

  return {
    projectName: opportunity.projectName,
    competitorCount: competitors.length,
    competitionLevel,
    competitors: competitorAnalysis,
    analysisDate: new Date().toISOString(),
  };
}

/**
 * 生成投标机会报告
 * @param {Array<Object>} opportunities - 投标机会列表
 * @returns {string} Markdown 格式报告
 */
function generateOpportunityReport(opportunities) {
  if (!opportunities || opportunities.length === 0) {
    return '# 投标机会报告\n\n暂无投标机会';
  }

  const lines = [
    '# 投标机会报告',
    '',
    `## 概览`,
    `- 总机会数：${opportunities.length}`,
    `- 分析中：${opportunities.filter((o) => o.status === OPPORTUNITY_STATUS.ANALYZING).length}`,
    `- 投标中：${opportunities.filter((o) => o.status === OPPORTUNITY_STATUS.BIDDING).length}`,
    `- 已中标：${opportunities.filter((o) => o.status === OPPORTUNITY_STATUS.WON).length}`,
    '',
    '## 机会列表',
    '',
  ];

  for (const opp of opportunities) {
    lines.push(`### ${opp.projectName}`);
    lines.push(`- 招标编号：${opp.tenderNo || '无'}`);
    lines.push(`- 客户：${opp.clientName}`);
    lines.push(`- 预算：${opp.budget} 元`);
    lines.push(`- 截止日期：${opp.deadline || '无'}`);
    lines.push(`- 状态：${opp.status}`);
    if (opp.decisionScore) {
      lines.push(`- 决策评分：${opp.decisionScore} 分`);
    }
    lines.push('');
  }

  return lines.join('\n');
}

/**
 * 创建投标机会服务实例
 */
function createBidOpportunityService() {
  return {
    createOpportunity,
    analyzeOpportunity,
    generateDecisionRecommendation,
    updateOpportunityStatus,
    generateBidCalendar,
    analyzeCompetition,
    generateOpportunityReport,
    OPPORTUNITY_STATUS,
    DECISION_FACTORS,
    TENDER_SOURCES,
  };
}

module.exports = {
  createBidOpportunityService,
  createOpportunity,
  analyzeOpportunity,
  generateDecisionRecommendation,
  updateOpportunityStatus,
  generateBidCalendar,
  analyzeCompetition,
  generateOpportunityReport,
  OPPORTUNITY_STATUS,
  DECISION_FACTORS,
  TENDER_SOURCES,
};
