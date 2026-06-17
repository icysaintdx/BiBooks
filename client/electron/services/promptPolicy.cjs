function buildEvidenceBoundaryInstruction({ allowWeb = false, finalDocument = false } = {}) {
  const webRule = allowWeb
    ? '允许使用网络检索内容作为补充，但所有来自互联网的事实、数据、推断、案例和结论都必须在内部标注为“互联网来源”，记录链接或可追溯来源，并在人工批准前不得写入正式正文。'
    : '当前任务不得自行引入互联网信息、行业传闻或未提供的外部资料。';
  const finalRule = finalDocument
    ? '正式导出的标书正文不得包含内部来源标注、审批提示、风险标签或“来自知识库/互联网”等说明。'
    : '可以在内部结构化结果中保留 source_notes、assumptions、warnings 等字段或说明，用于项目内审查；这些内部标注不得进入正式标书正文。';

  return `证据边界与来源规则（必须遵守）：
1. 只能基于用户上传的招标文件、项目数据库、企业资料库、知识库、历史案例、全局事实变量和用户明确提供的内容进行分析或编写。
2. 不得编造项目名称、业主信息、资质证书、人员经历、业绩案例、金额、工期、地点、标准编号、设备参数、服务承诺或评分结论。
3. 资料不足时，必须表达为“需人工补充”“原文未提及”“需核验”或在内部备注中标记不确定性，不得用看似合理的内容补齐。
4. ${webRule}
5. 使用知识库、历史案例或企业数据库内容时，只能吸收与当前项目真实匹配的部分；不得把历史项目的特定名称、金额、地点、人员、业主或承诺直接迁移到当前项目。
6. 报价、预算、税费、汇总、统计、数量计算和金额一致性不得交给 AI 推断，必须由本地确定性计算或用户确认结果提供。
7. ${finalRule}`;
}

function buildSourceLabelInstruction() {
  return `内部来源标注要求：
- tender_file：来自当前招标文件原文或解析结果。
- database：来自本项目数据库或企业资料。
- knowledge_base：来自通用知识库文档。
- private_kb：来自企业私有知识库。
- case_history：来自历史案例。
- web：来自互联网，必须 requires_approval=true 且 approval_status=pending，人工批准前不得进入正式正文。
- manual：来自用户人工输入或确认。
请尽量保留关键摘录、来源标题、来源链接/文件/条目 ID、目标章节和风险等级，供项目内部审查。`;
}

function buildNoFabricationInstruction() {
  return '严禁无依据猜测、扩写或替用户承诺；凡是没有可靠来源支撑的内容，只能作为待核验建议或人工补充项。';
}

module.exports = {
  buildEvidenceBoundaryInstruction,
  buildSourceLabelInstruction,
  buildNoFabricationInstruction,
};
