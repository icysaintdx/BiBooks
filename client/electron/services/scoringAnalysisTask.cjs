/**
 * 智能评分分析任务
 * 解析技术评分要求为结构化数据，计算权重分布，生成内容编写建议
 */

const { buildEvidenceBoundaryInstruction, buildNoFabricationInstruction } = require('./promptPolicy.cjs');

function scoringAnalysisSystemPrompt() {
  return `你是一个专业的招标评分分析专家。请从技术评分要求中提取结构化的评分信息。

要求：
1. 提取所有评分大类及其分值
2. 识别每个大类下的评分子项
3. 计算各评分维度的权重占比
4. 分析评分重点和优先级
5. 原文没有明确分值时不得推断分值，分值填 0，并在 description 或 analysisSummary 中标记“原文未明确分值，需人工核验”。
6. 只返回 JSON，不要输出其他内容

${buildEvidenceBoundaryInstruction()}
${buildNoFabricationInstruction()}`;
}

function buildScoringAnalysisMessages(requirements) {
  return [
    { role: 'system', content: scoringAnalysisSystemPrompt() },
    { role: 'user', content: `技术评分要求原文：\n${requirements}` },
    {
      role: 'user',
      content: `请从上述技术评分要求中提取结构化的评分信息。

分析要求：
1. 识别所有评分大类（如技术方案、实施能力、售后服务等）
2. 提取每个大类的总分值
3. 列出每个大类下的评分子项及其分值
4. 判断每个大类的优先级（high/medium/low）
5. 生成针对内容编写的建议

返回 JSON 格式：
{
  "scoringItems": [
    {
      "id": "S1",
      "category": "评分大类名称",
      "totalScore": 30,
      "percentage": 30.0,
      "priority": "high",
      "description": "该评分大类的核心关注点",
      "subItems": [
        { "name": "子项名称", "score": 10, "description": "评分标准说明" }
      ]
    }
  ],
  "distribution": {
    "techSolution": 40,
    "implementation": 25,
    "qualification": 15,
    "service": 10,
    "price": 10
  },
  "recommendations": [
    "针对评分重点的内容编写建议"
  ],
  "totalScore": 100,
  "analysisSummary": "评分体系整体分析总结"
}

注意：
- percentage 为该大类占总分的百分比（保留1位小数）
- priority 根据分值占比判断：>=30% 为 high，15-29% 为 medium，<15% 为 low
- distribution 中的维度名称使用英文 key，值为百分比数字
- recommendations 要具体、可操作，指导内容编写重点
- 如果原文没有明确分值，不得根据重要性推断；分值填 0，并明确写入“原文未明确分值，需人工核验”`,
    },
  ];
}

function normalizeScoringAnalysisResponse(payload) {
  if (!payload || typeof payload !== 'object') {
    throw new Error('评分分析结果格式无效：不是对象');
  }

  const items = Array.isArray(payload.scoringItems) ? payload.scoringItems : [];
  const normalizedItems = items.map((item, index) => ({
    id: String(item.id || `S${index + 1}`).trim(),
    category: String(item.category || '未命名类别').trim(),
    totalScore: Number(item.totalScore) || 0,
    percentage: Number(item.percentage) || 0,
    priority: ['high', 'medium', 'low'].includes(item.priority) ? item.priority : 'medium',
    description: String(item.description || '').trim(),
    subItems: Array.isArray(item.subItems)
      ? item.subItems.map((sub) => ({
        name: String(sub.name || '').trim(),
        score: Number(sub.score) || 0,
        description: String(sub.description || '').trim(),
      }))
      : [],
  }));

  const distribution = payload.distribution && typeof payload.distribution === 'object'
    ? payload.distribution
    : {};

  const recommendations = Array.isArray(payload.recommendations)
    ? payload.recommendations.map((r) => String(r).trim()).filter(Boolean)
    : [];

  return {
    scoringItems: normalizedItems,
    distribution,
    recommendations,
    totalScore: Number(payload.totalScore) || normalizedItems.reduce((sum, item) => sum + item.totalScore, 0) || 100,
    analysisSummary: String(payload.analysisSummary || '').trim(),
    analysisDate: new Date().toISOString(),
  };
}

async function runScoringAnalysisTask({ aiService, workspaceStore, updateTask, payload }) {
  const storedPlan = workspaceStore.loadTechnicalPlan() || {};
  const requirements = storedPlan.techRequirements || '';

  if (!String(requirements).trim()) {
    throw new Error('请先完成招标文件解析，获取技术评分要求后再进行评分分析');
  }

  const logs = ['开始智能评分分析。'];
  let technicalPlan = workspaceStore.updateTechnicalPlan({ scoringAnalysisTask: updateTask({ status: 'running', progress: 10, logs }) });
  updateTask({ status: 'running', progress: 10, logs }, technicalPlan);

  const analysis = await aiService.collectJsonResponse({
    messages: buildScoringAnalysisMessages(requirements),
    temperature: 0.3,
    normalizer: normalizeScoringAnalysisResponse,
    progressCallback: (message) => {
      logs.push(message);
      technicalPlan = workspaceStore.updateTechnicalPlan({ scoringAnalysisTask: updateTask({ status: 'running', progress: 50, logs }) });
      updateTask({ status: 'running', progress: 50, logs }, technicalPlan);
    },
    progressLabel: '评分分析',
    failureMessage: '模型返回的评分分析格式无效',
  });

  const summaryLog = `评分分析完成：${analysis.scoringItems.length} 个评分大类，总分 ${analysis.totalScore} 分。`;
  const finalLogs = [...logs, summaryLog];
  const finalTask = updateTask({
    status: 'success',
    progress: 100,
    logs: finalLogs,
    stats: {
      scoringItemCount: analysis.scoringItems.length,
      totalScore: analysis.totalScore,
    },
  });
  technicalPlan = workspaceStore.updateTechnicalPlan({ scoringAnalysis: analysis, scoringAnalysisTask: finalTask });
  updateTask({ status: 'success', progress: 100, logs: finalLogs, stats: finalTask.stats }, technicalPlan);

  return analysis;
}

module.exports = { runScoringAnalysisTask };
