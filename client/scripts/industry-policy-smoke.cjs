const { detectIndustry } = require('../electron/services/industryDetector.cjs');
const { generateTemplateReferencePrompt } = require('../electron/services/templateKnowledgeService.cjs');
const { buildIndustryBoundaryInstruction } = require('../electron/services/industryPromptPolicy.cjs');

const operation = detectIndustry('本项目要求提供驻场运维、巡检维护、故障处理、SLA 服务台和应急响应服务。');
if (operation.industryCode !== 'operation_service') {
  throw new Error(`operation industry mismatch: ${operation.industryCode}`);
}

const government = detectIndustry('本项目为政府采购公开招标，采购人要求逐项响应采购需求和评分办法。');
if (government.industryCode !== 'government_procurement') {
  throw new Error(`government industry mismatch: ${government.industryCode}`);
}

const itTemplate = generateTemplateReferencePrompt('it_information');
if (!itTemplate.includes('信息技术行业投标文件编写参考')) {
  throw new Error('it_information template alias failed');
}

const boundary = buildIndustryBoundaryInstruction('operation_service');
if (!boundary.includes('不得凭行业经验编造当前项目')) {
  throw new Error('industry boundary missing no-fabrication rule');
}

console.log('industry-policy smoke ok');
