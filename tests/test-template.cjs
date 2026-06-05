/**
 * 模板知识服务测试脚本
 */

const {
  createTemplateKnowledgeService,
  listIndustryTemplates,
  getIndustryTemplate,
  getCommonTemplate,
  generateTemplateOutline,
  generateTemplateReferencePrompt,
} = require('../client/electron/services/templateKnowledgeService.cjs');

console.log('=== 模板知识服务测试 ===\n');

// 测试 1: 列出所有行业模板
console.log('【测试 1】列出所有行业模板');
const templates = listIndustryTemplates();
console.log(`共 ${templates.length} 个行业模板：`);
templates.forEach((t) => console.log(`  - ${t.code}: ${t.name} (${t.outlineCount} 个章节)`));
console.log('');

// 测试 2: 获取制造业模板
console.log('【测试 2】获取制造业模板');
const manufacturing = getIndustryTemplate('manufacturing');
console.log(`模板名称：${manufacturing.name}`);
console.log('行业特点：');
manufacturing.characteristics.forEach((c) => console.log(`  - ${c}`));
console.log('');

// 测试 3: 获取通用模板
console.log('【测试 3】获取通用模板');
const common = getCommonTemplate();
console.log(`模板名称：${common.name}`);
console.log(`章节数量：${common.outline.length}`);
console.log('');

// 测试 4: 生成模板大纲
console.log('【测试 4】生成 IT 行业模板大纲');
const itOutline = generateTemplateOutline('it');
console.log(`大纲包含 ${itOutline.length} 个一级目录：`);
itOutline.forEach((item) => {
  console.log(`  ${item.id}. ${item.title}`);
  if (item.children) {
    item.children.forEach((child) => console.log(`     ${child.id}. ${child.title}`));
  }
});
console.log('');

// 测试 5: 生成模板参考提示词
console.log('【测试 5】生成建筑业模板参考提示词');
const constructionPrompt = generateTemplateReferencePrompt('construction');
console.log('提示词长度：', constructionPrompt.length, '字符');
console.log('前 300 字符：');
console.log(constructionPrompt.substring(0, 300) + '...');
console.log('');

// 测试 6: 未知行业代码
console.log('【测试 6】未知行业代码处理');
const unknownTemplate = getIndustryTemplate('unknown');
console.log('未知行业模板：', unknownTemplate);
const unknownOutline = generateTemplateOutline('unknown');
console.log('回退到通用模板，章节数：', unknownOutline.length);
console.log('');

console.log('=== 模板知识服务测试完成 ===');
