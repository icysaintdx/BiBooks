import { buildInvalidBidAndRejectionItemsPrompt } from '../../../shared/prompts';
import type { BidAnalysisMode } from '../types';

export interface BidAnalysisTaskDefinition {
  id: string;
  label: string;
  description: string;
  required: boolean;
  output: 'markdown' | 'json';
  buildTaskPrompt: () => string;
}

function jsonTask(title: string, goals: string, outputJson: string) {
  return `任务：${title}

目标：${goals}

约束：
1. 输出格式必须为 JSON。
2. 严格按照以下 JSON 格式输出，只修改 value，禁止修改 key 和结构。
3. 原文中没有的字段填充“没有提及”。

JSON 格式：
${outputJson}

仅输出 JSON，不要输出其他内容。`;
}

export const bidAnalysisTasks: BidAnalysisTaskDefinition[] = [
  {
    id: 'projectOverview',
    label: '项目概述',
    description: '提取项目基本信息、背景目的、规模预算、时间安排、实施内容和技术特点。',
    required: true,
    output: 'markdown',
    buildTaskPrompt: () => `任务：提取并总结项目概述信息。

请重点关注：
1. 项目名称和基本信息
2. 项目背景和目的
3. 项目规模和预算
4. 项目时间安排
5. 项目要实施的具体内容
6. 主要技术特点
7. 其他关键要求

工作要求：
1. 保持信息全面准确，尽量使用原文内容，不要自行编写。
2. 只关注与项目实施有关的内容，不提取商务信息。
3. 直接返回整理好的项目概述，除此之外不返回任何其他内容。`,
  },
  {
    id: 'techRequirements',
    label: '技术评分要求',
    description: '提取技术评分项、权重分值、评分标准和原文位置。',
    required: true,
    output: 'markdown',
    buildTaskPrompt: () => `任务：提取技术评分要求。

目标定位：
1. 重点识别与“技术评分”“评标方法”“评分标准”“技术参数”“技术要求”“技术方案”“技术部分”“评审要素”相关的章节。
2. 不要提取商务、价格、资质等与技术类评分项无关的条目。

每一项按以下结构输出，信息缺失时标注“未提及”：
【评分项名称】：<原文描述，保留专业术语>
【权重/分值】：<具体分值或占比>
【评分标准】：<详细规则>
【数据来源】：<章节、条款、页码或表格位置>

处理规则：
1. 若没有明确“技术评分表”，根据上下文判断技术评分相关内容。
2. 若评分项以表格形式呈现，按行提取，并标注“[表格数据]”。
3. 若存在二级评分项，用缩进或编号体现层级关系。
4. 单位尽量统一为“分”或“%”，必要时注明原文单位。

直接返回提取结果，除此之外不输出任何其他内容。`,
  },
  {
    id: 'projectInfo',
    label: '项目信息',
    description: '项目名称、编号、类型、预算和地址。',
    required: true,
    output: 'json',
    buildTaskPrompt: () => jsonTask('提取项目信息', '提取项目名称、项目编号、项目类型、项目预算、项目地址。', `{
  "project_name": "项目名称",
  "project_number": "项目编号",
  "project_type": "项目类型",
  "project_budget": "项目预算",
  "project_address": "项目地址"
}`),
  },
  {
    id: 'partAInfo',
    label: '甲方信息',
    description: '招标人公司、地址、联系人和电话。',
    required: true,
    output: 'json',
    buildTaskPrompt: () => jsonTask('提取甲方信息', '提取公司名称、地址、联系人、联系电话。', `{
  "company_name": "公司名称",
  "address": "地址",
  "contact_person": "联系人",
  "contact_phone": "联系电话"
}`),
  },
  {
    id: 'deliveryAndServiceRequirements',
    label: '交货和服务要求',
    description: '实施周期、交付范围、地点、验收、质保、售后、响应、培训和文档要求。',
    required: true,
    output: 'json',
    buildTaskPrompt: () => jsonTask('提取交货和服务要求', '提取实施周期/工期/交付期限、交付范围、交付/实施地点、验收要求、质保期、售后服务要求、响应时限、培训要求、资料/文档交付要求。', `{
  "implementation_period": "实施周期/工期/交付期限",
  "delivery_scope": "交付范围",
  "delivery_location": "交付/实施地点",
  "acceptance_requirements": "验收要求",
  "warranty_period": "质保期",
  "after_sales_service": "售后服务要求",
  "response_time": "响应时限",
  "training_requirements": "培训要求",
  "documentation_requirements": "资料/文档交付要求"
}`),
  },
  {
    id: 'agentInfo',
    label: '代理机构信息',
    description: '代理机构联系方式和账户信息。',
    required: false,
    output: 'json',
    buildTaskPrompt: () => jsonTask('提取代理机构信息', '提取代理机构名称、地址、联系人、电话、邮箱和银行账户信息。', `{
  "company_name": "公司名称",
  "address": "地址",
  "contact_person": "联系人",
  "contact_phone": "联系电话",
  "email": "联系邮箱",
  "bank_account_name": "银行账户名称",
  "bank_account_number": "银行账户账号",
  "bank_account_address": "银行账户开户行",
  "bank_account_address_detail": "银行账户开户行地址"
}`),
  },
  {
    id: 'keyInfo',
    label: '投标关键节点',
    description: '公告、获取文件、递交、截止和开标信息。',
    required: false,
    output: 'json',
    buildTaskPrompt: () => jsonTask('提取投标关键节点', '提取招标公告发布日期、招标文件获取方式、售价、获取时间、提交地点、截止时间、开标时间、开标地点和其他注意事项。', `{
  "bid_announcement_time": "招标公告发布日期",
  "bid_file_get_way": "招标文件获取方式",
  "bid_file_price": "招标文件售价",
  "get_bid_file_time": "获取招标文件时间",
  "bid_document_submission_location": "投标文件提交地点",
  "bid_submission_deadline": "投标截止时间",
  "bid_opening_time": "开标时间",
  "bid_opening_address": "开标地点",
  "other_notes": "其他注意事项"
}`),
  },
  {
    id: 'marginInfo',
    label: '投标保证金',
    description: '保证金金额、方式、截止和退还条件。',
    required: false,
    output: 'json',
    buildTaskPrompt: () => jsonTask('提取投标保证金信息', '提取投标保证金、缴纳方式、截止日期、退还条件、不予退还情形和其他注意事项。', `{
  "bidding_deposit": "投标保证金",
  "payment_method": "缴纳方式",
  "due_date": "截止日期",
  "refund_conditions": "退还条件",
  "non_refundable_conditions": "不予退还的情形",
  "other_notes": "其他注意事项"
}`),
  },
  {
    id: 'qualificationReview',
    label: '资格性审查',
    description: '投标人资格条件和资格审查要求。',
    required: false,
    output: 'markdown',
    buildTaskPrompt: () => '任务：提取招标文件中关于投标人资格性审查的信息。整理成方便阅读的 Markdown，不要使用表格；如果原文是表格，请转换为列表。仅输出整理结果。',
  },
  {
    id: 'complianceCheck',
    label: '符合性检查',
    description: '文件完整性、有效性、规范和偏差处理要求。',
    required: false,
    output: 'markdown',
    buildTaskPrompt: () => '任务：总结招标文件中关于符合性检查的信息，一般包括文件完整性、文件有效性、文件规范、偏差处理等。整理成 Markdown，不要使用表格；如果原文是表格，请转换为列表。仅输出整理结果。',
  },
  {
    id: 'openBid',
    label: '开标要求',
    description: '开标时间地点、参与要求、无效标和流程。',
    required: false,
    output: 'json',
    buildTaskPrompt: () => jsonTask('提取开标信息', '提取时间地点、参与要求、无效标认定、异议处理、开标流程。开标流程只涉及开标，不涉及评标和定标。', `{
  "time_place": "时间地点",
  "part_req": "参与要求",
  "invalid_bid": "无效标认定",
  "objection": "异议处理",
  "bid_process": "开标流程"
}`),
  },
  {
    id: 'evaluationBid',
    label: '评标要求',
    description: '评标委员会、评分构成、方法和原则。',
    required: false,
    output: 'json',
    buildTaskPrompt: () => jsonTask('提取评标信息', '提取评标委员会组成、职责、评分构成、评标方法类型、评标原则和方法细节、其他评标相关说明。', `{
  "committee": "评标委员会组成",
  "duties": "评标委员会职责",
  "scoring": "评分构成",
  "method": "评标方法类型",
  "principles": "评标原则和方法细节",
  "others": "其他和评标相关的说明"
}`),
  },
  {
    id: 'businessScoring',
    label: '商务评分要求',
    description: '商务评分因素，为商务方案准备。',
    required: false,
    output: 'markdown',
    buildTaskPrompt: () => '任务：提取招标文件中的商务评分因素，为编写投标文件中的商务方案做准备。保持原文准确性，整理成方便阅读的 Markdown，不要使用表格；如果原文是表格，请转换为列表。仅输出整理结果。',
  },
  {
    id: 'discardedBids',
    label: '无效标与废标项',
    description: '投标无效、废标相关风险项。',
    required: false,
    output: 'markdown',
    buildTaskPrompt: buildInvalidBidAndRejectionItemsPrompt,
  },
  {
    id: 'signingProcess',
    label: '合同授予与签订',
    description: '中标公示、合同签订、履约保证金和合同文本。',
    required: false,
    output: 'json',
    buildTaskPrompt: () => jsonTask('提取合同授予和签订流程', '提取中标公示、合同签订、履约保证金、合同文本等信息。', `{
  "bid_notice": "中标公示",
  "contract_sign": "合同签订",
  "performance_bond": "履约保证金",
  "contract_text": "合同文本"
}`),
  },
  {
    id: 'terminationCondition',
    label: '合同解除和终止',
    description: '违约解除、不可抗力、合同终止和争议解决。',
    required: false,
    output: 'json',
    buildTaskPrompt: () => jsonTask('提取合同解除和终止条件', '提取违约解除、不可抗力、合同终止、争议解决等信息。', `{
  "breach_termination": "违约解除",
  "force_majeure": "不可抗力",
  "contract_termination": "合同终止",
  "dispute_resolution": "争议解决"
}`),
  },
  {
    id: 'bidFileStructure',
    label: '投标文件组成与格式',
    description: '提取招标文件规定的投标文件组成清单、编制顺序和格式要求，作为大纲骨架的依据。',
    required: true,
    output: 'markdown',
    buildTaskPrompt: () => `任务：提取招标文件中关于“投标文件组成”“投标文件格式”“投标文件编制”的规定。

重点识别“投标文件组成”“投标文件的组成”“投标文件应包括”“投标文件格式”“投标文件编制”“投标文件应按...格式编写”等章节，提取投标人需要编制的投标文件由哪些部分（章节/卷册/分册）构成，以及它们的先后顺序和格式要求。

工作要求：
1. 严格基于原文，按招标文件给定的顺序逐条列出投标文件的组成部分，保留原文条目名称。
2. 如果原文明确要求“按第X章格式编写”或引用了格式范本，请一并注明对应的格式来源（如“第六章 投标文件格式”）。
3. 区分“技术部分/技术标”“商务部分/商务标”“报价部分/价格标”等大类（若原文有此划分）。
4. 如果原文未规定投标文件组成或格式，写“原文未提及投标文件组成与格式”。
5. 使用 Markdown 有序列表，不要使用表格。仅输出整理结果。`,
  },
  {
    id: 'bidFileStructureSchema',
    label: '投标文件字段结构（机读）',
    description: '把招标对商务标、报价部分的字段要求整理为结构化 JSON，用于动态生成商务标 / 报价表单字段。',
    required: true,
    output: 'json',
    buildTaskPrompt: () => `任务：根据招标文件原文，整理出投标人编制“商务标”和“报价部分”时需要填写或提交的字段要求，输出为结构化 JSON，供系统动态生成表单字段。

工作要求：
1. 严格基于招标文件原文，只整理原文明确要求或规定的字段；原文未规定的字段填字符串“没有提及”。
2. commercial.qualifications 数组：列出招标要求投标人提供的资质 / 证明材料（如营业执照、资质证书、信誉证明等），required 表示是否为强制项，format_ref 注明原文要求的格式来源（如“第六章 格式X”），原文未规定格式来源时填“没有提及”。条目数量按招标实际要求增减，原文未规定任何资质时给空数组 []。
3. commercial.performance：招标对业绩 / 类似项目经验的要求，required 是否强制，min_count 招标要求的最少业绩数量（无明确数量时填 0），note 原文相关要求摘要。
4. commercial.service_fields 数组：招标要求在商务标中承诺或填写的服务类字段（如质保期、响应时间、售后服务方案等），key 用英文小写下划线命名，label 用中文，required 是否强制。原文未规定时给空数组 []。
5. commercial.price_note：招标对投标报价说明部分的要求摘要（原文未提及填“没有提及”）。
6. pricing.currency：招标规定的报价币种（如“CNY”“人民币”，未规定填“没有提及”）。
7. pricing.tax_rate：招标规定的税率，用 0~1 之间的小数表示（如增值税 13% 填 0.13），原文未规定填“没有提及”。
8. pricing.price_type：招标规定的报价方式（如“lumpSum”总价包干 / “unitPrice”单价 / 原文表述），未规定填“没有提及”。
9. pricing.note：招标对报价口径、是否含税、报价范围等要求的摘要（未提及填“没有提及”）。
10. 输出必须是合法 JSON，只输出 JSON，不要输出解释、过程、代码块标记。

JSON 结构示例（按招标实际内容填充，数组条目数量可增减）：
{
  "commercial": {
    "qualifications": [{"name":"营业执照","required":true,"format_ref":"第六章 格式1"}],
    "performance": {"required":true,"min_count":3,"note":"近三年同类项目业绩"},
    "service_fields": [{"key":"warranty_period","label":"质保期","required":true}],
    "price_note": "报价说明部分要求摘要"
  },
  "pricing": {
    "currency": "CNY",
    "tax_rate": 0.13,
    "price_type": "lumpSum",
    "note": "报价口径 / 含税要求摘要"
  }
}`,
  },
  {
    id: 'formatTemplateTables',
    label: '格式范本模板',
    description: '从招标文件中提取"投标文件格式""格式范本"等章节的格式模板内容（表格、清单、填写说明），为后续内容生成提供格式范本参考。',
    required: false,
    output: 'markdown',
    buildTaskPrompt: () => `任务：从招标文件中提取与"投标文件格式""格式范本""投标文件编制格式"相关的格式模板内容。

重点识别以下章节：
1. "第六章 投标文件格式"或类似命名的专门格式章节
2. 各类格式模板：投标函格式、投标报价表格式、商务偏差表格式、技术偏差表格式、资质证明格式、业绩证明格式等
3. 填写说明、格式要求、表格模板

工作要求：
1. 严格基于原文，逐个提取格式模板的完整内容，保留原文表格结构和填写说明
2. 每个模板前用二级标题标注来源（如"## 第六章 格式1：投标函"）
3. 保留原文表格格式（Markdown 表格），保留填写说明和注释
4. 如果原文没有专门的格式范本章节，写"原文未提及投标文件格式范本"
5. 仅输出提取结果，不要输出解释或过程。`,
  },
];

export function getBidAnalysisTasks(mode: BidAnalysisMode) {
  return mode === 'key' ? bidAnalysisTasks.filter((task) => task.required) : bidAnalysisTasks;
}

export function getBidAnalysisTaskById(taskId: string) {
  return bidAnalysisTasks.find((task) => task.id === taskId);
}
