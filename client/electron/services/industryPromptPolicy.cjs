const { getIndustryFullKnowledge } = require('./industryKnowledgeBase.cjs');

function formatList(items) {
  return (Array.isArray(items) ? items : [])
    .map((item) => `- ${String(item || '').trim()}`)
    .filter((line) => line !== '- ')
    .join('\n');
}

function buildIndustryBoundaryInstruction(industryCode) {
  if (!industryCode) return '';
  const knowledge = getIndustryFullKnowledge(industryCode);
  if (!knowledge) return '';

  return `项目行业参考边界：
行业识别：${knowledge.name || industryCode}
行业说明：${knowledge.description || '无'}

行业参考只允许用于以下目的：
- 帮助判断目录结构、章节重点、常见风险和表达角度。
- 帮助识别当前项目可能需要人工核验的资料缺口。
- 帮助选择更贴近行业的术语，但术语必须与招标文件和用户资料不冲突。

行业参考禁止用于以下目的：
- 不得凭行业经验编造当前项目的业主、地点、金额、工期、人员、资质、设备型号、技术参数、验收标准、服务承诺或案例。
- 不得把行业通用指标写成当前项目已承诺指标。
- 不得把历史案例、模板案例或行业案例的专有信息迁移到当前项目。

行业常见风险（仅作为内部核验提醒）：
${formatList(knowledge.commonPitfalls)}

行业写作要点（必须受招标文件和项目事实约束）：
${formatList(knowledge.writingTips)}

行业关键指标（只有在招标文件、企业资料或人工确认中出现时才可写入具体数值）：
${formatList(knowledge.keyMetrics)}`;
}

module.exports = {
  buildIndustryBoundaryInstruction,
};
