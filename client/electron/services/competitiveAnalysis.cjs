/**
 * 竞品分析服务
 * 基于招标评分要求和行业知识，生成竞争策略分析
 */

const { logInfo, logError } = require('../utils/logger.cjs');
const { getIndustryConfig } = require('./industryDetector.cjs');

/**
 * 分析评分权重分布，识别关键竞争领域
 */
function analyzeScoringWeights(scoringItems) {
  if (!scoringItems || !Array.isArray(scoringItems) || scoringItems.length === 0) {
    return { highPriority: [], mediumPriority: [], lowPriority: [] };
  }

  const highPriority = [];
  const mediumPriority = [];
  const lowPriority = [];

  for (const item of scoringItems) {
    const entry = {
      id: item.id,
      category: item.category,
      totalScore: item.totalScore,
      percentage: item.percentage,
      subItemCount: item.subItems?.length || 0,
    };

    if (item.percentage >= 30 || item.priority === 'high') {
      highPriority.push(entry);
    } else if (item.percentage >= 15 || item.priority === 'medium') {
      mediumPriority.push(entry);
    } else {
      lowPriority.push(entry);
    }
  }

  return { highPriority, mediumPriority, lowPriority };
}

/**
 * 生成竞争策略建议
 */
function generateCompetitiveStrategies(scoringItems, industryKnowledge) {
  const strategies = [];

  if (!scoringItems || !Array.isArray(scoringItems)) {
    return strategies;
  }

  for (const item of scoringItems) {
    const strategy = {
      category: item.category,
      weight: item.percentage,
      priority: item.priority,
      focusAreas: [],
      differentiators: [],
      risks: [],
    };

    // 基于权重生成策略
    if (item.percentage >= 30) {
      strategy.focusAreas.push('必须投入核心资源，确保该项得分率≥90%');
      strategy.differentiators.push('建立明显优势，拉开与竞品差距');
    } else if (item.percentage >= 15) {
      strategy.focusAreas.push('重点准备，确保得分率≥80%');
      strategy.differentiators.push('寻找差异化亮点，形成竞争优势');
    } else {
      strategy.focusAreas.push('标准化响应，确保不丢分');
    }

    // 基于子项生成具体建议
    if (item.subItems && Array.isArray(item.subItems)) {
      for (const sub of item.subItems) {
        if (sub.score >= 10) {
          strategy.focusAreas.push(`"${sub.name}"（${sub.score}分）为重点得分项`);
        }
      }
    }

    // 基于行业知识补充建议
    if (industryKnowledge) {
      if (industryKnowledge.writingTips) {
        strategy.differentiators.push(...industryKnowledge.writingTips.slice(0, 2));
      }
      if (industryKnowledge.commonPitfalls) {
        strategy.risks.push(...industryKnowledge.commonPitfalls.slice(0, 2));
      }
    }

    strategies.push(strategy);
  }

  return strategies;
}

/**
 * 生成竞品分析报告
 */
function generateCompetitiveReport(scoringAnalysis, industryKnowledge, projectInfo) {
  const weights = analyzeScoringWeights(scoringAnalysis?.scoringItems);
  const strategies = generateCompetitiveStrategies(scoringAnalysis?.scoringItems, industryKnowledge);

  const report = {
    projectInfo: projectInfo || {},
    analysisDate: new Date().toISOString(),
    scoringOverview: {
      totalScore: scoringAnalysis?.totalScore || 100,
      itemCount: scoringAnalysis?.scoringItems?.length || 0,
      highPriorityCount: weights.highPriority.length,
      mediumPriorityCount: weights.mediumPriority.length,
      lowPriorityCount: weights.lowPriority.length,
    },
    weightDistribution: weights,
    competitiveStrategies: strategies,
    industryInsights: industryKnowledge ? {
      scoringWeights: industryKnowledge.scoringWeights,
      keyMetrics: industryKnowledge.keyMetrics,
      commonPitfalls: industryKnowledge.commonPitfalls,
    } : null,
    recommendations: generateTopRecommendations(strategies, weights),
  };

  return report;
}

/**
 * 生成核心推荐
 */
function generateTopRecommendations(strategies, weights) {
  const recommendations = [];

  // 高权重领域推荐
  if (weights.highPriority.length > 0) {
    const categories = weights.highPriority.map((h) => h.category).join('、');
    recommendations.push({
      type: 'critical',
      title: '核心竞争领域',
      content: `${categories}为高权重评分项（合计占比${weights.highPriority.reduce((s, h) => s + h.percentage, 0)}%），必须投入最强团队资源，确保得分率≥90%。`,
    });
  }

  // 差异化建议
  const highStrategies = strategies.filter((s) => s.priority === 'high');
  if (highStrategies.length > 0) {
    recommendations.push({
      type: 'strategy',
      title: '差异化策略',
      content: '在高权重领域建立技术壁垒，通过具体数据、案例和创新方案形成与竞品的明显差异。',
    });
  }

  // 风险提醒
  const allRisks = strategies.flatMap((s) => s.risks);
  if (allRisks.length > 0) {
    recommendations.push({
      type: 'warning',
      title: '常见陷阱提醒',
      content: `注意避免以下常见问题：${allRisks.slice(0, 3).join('；')}。`,
    });
  }

  // 通用建议
  recommendations.push({
    type: 'info',
    title: '投标策略建议',
    content: '技术方案要逐项响应招标要求，避免遗漏；使用具体数据和案例支撑论述；注意格式规范，提升专业感。',
  });

  return recommendations;
}

/**
 * 格式化竞品分析报告为 Markdown
 */
function formatReportAsMarkdown(report) {
  const lines = [];

  lines.push('# 竞品分析报告');
  lines.push('');
  lines.push(`**分析日期**: ${new Date(report.analysisDate).toLocaleDateString('zh-CN')}`);
  if (report.projectInfo?.project_name) {
    lines.push(`**项目名称**: ${report.projectInfo.project_name}`);
  }
  lines.push('');

  // 评分概览
  lines.push('## 评分概览');
  lines.push('');
  lines.push(`- **总分**: ${report.scoringOverview.totalScore}分`);
  lines.push(`- **评分项数量**: ${report.scoringOverview.itemCount}项`);
  lines.push(`- **高权重项**: ${report.scoringOverview.highPriorityCount}项`);
  lines.push(`- **中权重项**: ${report.scoringOverview.mediumPriorityCount}项`);
  lines.push(`- **低权重项**: ${report.scoringOverview.lowPriorityCount}项`);
  lines.push('');

  // 核心推荐
  lines.push('## 核心推荐');
  lines.push('');
  for (const rec of report.recommendations) {
    const icon = rec.type === 'critical' ? '🔴' : rec.type === 'strategy' ? '🟡' : rec.type === 'warning' ? '⚠️' : 'ℹ️';
    lines.push(`### ${icon} ${rec.title}`);
    lines.push('');
    lines.push(rec.content);
    lines.push('');
  }

  // 竞争策略
  if (report.competitiveStrategies.length > 0) {
    lines.push('## 竞争策略详情');
    lines.push('');

    for (const strategy of report.competitiveStrategies) {
      lines.push(`### ${strategy.category}（权重${strategy.weight}%）`);
      lines.push('');
      lines.push(`**优先级**: ${strategy.priority === 'high' ? '高' : strategy.priority === 'medium' ? '中' : '低'}`);
      lines.push('');
      if (strategy.focusAreas.length > 0) {
        lines.push('**重点方向**:');
        for (const area of strategy.focusAreas) {
          lines.push(`- ${area}`);
        }
        lines.push('');
      }
      if (strategy.differentiators.length > 0) {
        lines.push('**差异化建议**:');
        for (const diff of strategy.differentiators) {
          lines.push(`- ${diff}`);
        }
        lines.push('');
      }
      if (strategy.risks.length > 0) {
        lines.push('**风险提醒**:');
        for (const risk of strategy.risks) {
          lines.push(`- ${risk}`);
        }
        lines.push('');
      }
    }
  }

  // 行业洞察
  if (report.industryInsights) {
    lines.push('## 行业洞察');
    lines.push('');
    if (report.industryInsights.keyMetrics) {
      lines.push('**关键指标**:');
      for (const metric of report.industryInsights.keyMetrics) {
        lines.push(`- ${metric}`);
      }
      lines.push('');
    }
  }

  return lines.join('\n');
}

/**
 * 创建竞品分析服务实例
 */
function createCompetitiveAnalysisService() {
  return {
    /**
     * 生成竞品分析报告
     * @param {Object} payload - { scoringAnalysis, industryCode, projectInfo }
     */
    generateReport(payload) {
      try {
        const { scoringAnalysis, industryCode, projectInfo } = payload || {};

        if (!scoringAnalysis) {
          return { success: false, message: '缺少评分分析数据，请先完成评分分析' };
        }

        const industryKnowledge = industryCode ? getIndustryConfig(industryCode) : null;
        const report = generateCompetitiveReport(scoringAnalysis, industryKnowledge, projectInfo);

        logInfo('[competitive-analysis] 报告生成完成', {
          itemCount: report.scoringOverview.itemCount,
          highPriority: report.scoringOverview.highPriorityCount,
        });

        return { success: true, report };
      } catch (error) {
        logError('[competitive-analysis] 报告生成失败', error);
        return { success: false, message: `报告生成失败: ${error.message}` };
      }
    },

    /**
     * 将报告格式化为 Markdown
     */
    formatAsMarkdown(report) {
      return formatReportAsMarkdown(report);
    },
  };
}

module.exports = {
  createCompetitiveAnalysisService,
  analyzeScoringWeights,
  generateCompetitiveStrategies,
  generateCompetitiveReport,
  generateTopRecommendations,
  formatReportAsMarkdown,
};
