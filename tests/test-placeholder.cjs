/**
 * 占位符服务测试脚本
 */

const {
  createPlaceholderService,
  generatePlaceholderText,
  insertPlaceholder,
  analyzeContentForPlaceholders,
  autoInsertPlaceholders,
  listPlaceholders,
} = require('../client/electron/services/placeholderService.cjs');

console.log('=== 占位符服务测试 ===\n');

// 测试 1: 列出所有占位符
console.log('【测试 1】列出所有占位符');
const placeholders = listPlaceholders();
console.log(`共 ${placeholders.length} 个占位符模板：`);
placeholders.forEach((p) => console.log(`  - ${p.name}: ${p.description}`));
console.log('');

// 测试 2: 生成占位符文本
console.log('【测试 2】生成占位符文本');
const imageText = generatePlaceholderText('image', {
  type: '技术架构图',
  description: '系统总体架构图',
  size: '宽15cm × 高10cm',
});
console.log('图片占位符：');
console.log(imageText);
console.log('');

// 测试 3: 分析内容并建议占位符
console.log('【测试 3】分析内容并建议占位符');
const testContent = `
本项目采用先进的技术架构设计方案，系统设计遵循高可用、高性能原则。
功能模块包括用户管理、数据处理、报表生成等子系统。
项目实施计划分为三个阶段，预计工期6个月。
项目团队配置包括项目经理、开发工程师、测试工程师等岗位。
`;
const suggestions = analyzeContentForPlaceholders(testContent);
console.log(`分析结果：发现 ${suggestions.length} 个建议`);
suggestions.forEach((s) => console.log(`  - ${s.name}: ${s.reason}`));
console.log('');

// 测试 4: 自动插入占位符
console.log('【测试 4】自动插入占位符');
const result = autoInsertPlaceholders(testContent);
console.log(`插入了 ${result.inserted.length} 个占位符`);
console.log('处理后内容长度：', result.content.length);
console.log('');

// 测试 5: 手动插入占位符
console.log('【测试 5】手动插入占位符');
const manualContent = insertPlaceholder('这是测试内容', '项目进度表', 'end');
console.log('插入结果：');
console.log(manualContent.substring(0, 200) + '...');
console.log('');

console.log('=== 占位符服务测试完成 ===');
