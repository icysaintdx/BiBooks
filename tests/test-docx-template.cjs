/**
 * 文档模板服务测试脚本
 */

const {
  createDocxTemplateService,
  processTemplate,
  replaceVariables,
  processConditionals,
  processLoops,
  extractTemplateVariables,
  validateTemplateVariables,
  generateTemplateReport,
  TEMPLATE_SYNTAX,
} = require('../client/electron/services/docxTemplateService.cjs');

console.log('=== 文档模板服务测试 ===\n');

// 测试 1: 查看模板语法
console.log('【测试 1】模板语法定义');
console.log(`  变量: ${TEMPLATE_SYNTAX.variable}`);
console.log(`  注释: ${TEMPLATE_SYNTAX.comment}`);
console.log(`  块: ${TEMPLATE_SYNTAX.block}`);
console.log('');

// 测试 2: 简单变量替换
console.log('【测试 2】简单变量替换');
const simpleTemplate = '项目名称：{{ projectName }}，客户：{{ clientName }}';
const simpleContext = { projectName: '智慧城市项目', clientName: '某市政府' };
const simpleResult = replaceVariables(simpleTemplate, simpleContext);
console.log(`  模板: ${simpleTemplate}`);
console.log(`  结果: ${simpleResult}`);
console.log('');

// 测试 3: 嵌套变量替换
console.log('【测试 3】嵌套变量替换');
const nestedTemplate = '联系人：{{ contact.name }}，电话：{{ contact.phone }}';
const nestedContext = { contact: { name: '张三', phone: '13800138000' } };
const nestedResult = replaceVariables(nestedTemplate, nestedContext);
console.log(`  模板: ${nestedTemplate}`);
console.log(`  结果: ${nestedResult}`);
console.log('');

// 测试 4: 条件渲染
console.log('【测试 4】条件渲染');
const conditionalTemplate = `
{% if hasWarranty %}
质保期：{{ warrantyPeriod }}
{% else %}
无质保
{% endif %}
`;
const conditionalContext1 = { hasWarranty: true, warrantyPeriod: '2年' };
const conditionalContext2 = { hasWarranty: false };
console.log(`  模板: ${conditionalTemplate.trim()}`);
console.log(`  有质保: ${processConditionals(conditionalTemplate, conditionalContext1).trim()}`);
console.log(`  无质保: ${processConditionals(conditionalTemplate, conditionalContext2).trim()}`);
console.log('');

// 测试 5: 循环渲染
console.log('【测试 5】循环渲染');
const loopTemplate = `
团队成员：
{% for member in team %}
{{ loop.index }}. {{ member.name }} - {{ member.role }}
{% endfor %}
`;
const loopContext = {
  team: [
    { name: '张三', role: '项目经理' },
    { name: '李四', role: '开发工程师' },
    { name: '王五', role: '测试工程师' },
  ],
};
console.log(`  模板: ${loopTemplate.trim()}`);
console.log(`  结果:`);
console.log(processLoops(loopTemplate, loopContext));
console.log('');

// 测试 6: 完整模板处理
console.log('【测试 6】完整模板处理');
const fullTemplate = `# {{ projectName }}投标文件

## 项目概述
项目名称：{{ projectName }}
客户名称：{{ clientName }}
预算金额：{{ budget }}元

{% if hasTeam %}
## 项目团队
{% for member in team %}
- {{ member.name }}: {{ member.role }}
{% endfor %}
{% endif %}

## 服务承诺
质保期：{{ warrantyPeriod}}
响应时间：{{ responseTime}}
`;
const fullContext = {
  projectName: '智慧城市管理系统',
  clientName: '某市政府',
  budget: 5000000,
  hasTeam: true,
  team: [
    { name: '张三', role: '项目经理' },
    { name: '李四', role: '技术负责人' },
  ],
  warrantyPeriod: '2年',
  responseTime: '4小时',
};
console.log('  处理结果:');
console.log(processTemplate(fullTemplate, fullContext));
console.log('');

// 测试 7: 提取模板变量
console.log('【测试 7】提取模板变量');
const templateWithVars = '{{ projectName }} - {{ client.name }} - {{ budget }}';
const variables = extractTemplateVariables(templateWithVars);
console.log(`  模板: ${templateWithVars}`);
console.log(`  变量: ${variables.join(', ')}`);
console.log('');

// 测试 8: 验证模板变量
console.log('【测试 8】验证模板变量');
const requiredVars = ['projectName', 'clientName', 'budget', 'deadline'];
const testContext = { projectName: '测试项目', clientName: '测试客户' };
const validation = validateTemplateVariables(requiredVars, testContext);
console.log(`  必需变量: ${requiredVars.join(', ')}`);
console.log(`  验证结果: ${validation.valid ? '通过' : '未通过'}`);
console.log(`  已提供: ${validation.provided.join(', ')}`);
console.log(`  缺失: ${validation.missing.join(', ')}`);
console.log('');

// 测试 9: 生成模板报告
console.log('【测试 9】生成模板报告');
const report = generateTemplateReport(fullTemplate, fullContext);
console.log(`  模板长度: ${report.templateLength} 字符`);
console.log(`  变量数量: ${report.variables.length}`);
console.log(`  上下文键: ${report.contextKeys.join(', ')}`);
console.log(`  验证状态: ${report.validation.valid ? '通过' : '未通过'}`);
console.log('');

// 测试 10: 处理缺失变量
console.log('【测试 10】处理缺失变量');
const missingVarTemplate = '项目：{{ projectName }}，未知：{{ unknownVar }}';
const missingVarContext = { projectName: '测试项目' };
const missingResult = replaceVariables(missingVarTemplate, missingVarContext);
console.log(`  模板: ${missingVarTemplate}`);
console.log(`  结果: ${missingResult}`);
console.log('');

console.log('=== 文档模板服务测试完成 ===');
