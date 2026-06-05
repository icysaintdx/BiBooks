/**
 * 商务标服务测试脚本
 */

const {
  createCommercialBidService,
  generatePriceContent,
  generateTermsContent,
  generateQualificationsContent,
  generatePerformanceContent,
  generateFinancialContent,
  generateServiceContent,
  generateCommercialBid,
  generateCommercialBidReport,
  COMMERCIAL_BID_SECTIONS,
  PRICE_TEMPLATES,
  QUALIFICATION_TYPES,
} = require('../client/electron/services/commercialBidService.cjs');

console.log('=== 商务标服务测试 ===\n');

// 测试 1: 查看商务标章节定义
console.log('【测试 1】商务标章节定义');
Object.values(COMMERCIAL_BID_SECTIONS).forEach((section) => {
  console.log(`  - ${section.id}: ${section.title} (必需: ${section.required ? '是' : '否'})`);
});
console.log('');

// 测试 2: 生成投标报价
console.log('【测试 2】生成投标报价');
const price = generatePriceContent({
  projectName: '智慧城市管理系统项目',
  priceType: 'lumpSum',
  totalAmount: 5000000,
  currency: '人民币',
});
console.log(`  项目：${price.projectName}`);
console.log(`  报价方式：${price.priceType}`);
console.log(`  总金额：${price.totalAmount} ${price.currency}`);
console.log(`  费用项：${price.items.length} 项`);
console.log('');

// 测试 3: 生成商务条款响应
console.log('【测试 3】生成商务条款响应');
const terms = generateTermsContent({
  projectName: '智慧城市管理系统项目',
});
console.log(`  项目：${terms.projectName}`);
console.log(`  条款数：${terms.terms.length}`);
console.log(`  全部响应：${terms.allCompliant ? '是' : '否'}`);
terms.terms.slice(0, 3).forEach((t) => {
  console.log(`    - ${t.title}: ${t.response}`);
});
console.log('');

// 测试 4: 生成资质证明
console.log('【测试 4】生成资质证明');
const quals = generateQualificationsContent({
  companyName: '示例科技有限公司',
});
console.log(`  公司：${quals.companyName}`);
console.log(`  资质总数：${quals.qualifications.length}`);
console.log(`  必需资质：${quals.requiredCount} 项`);
console.log('');

// 测试 5: 生成业绩证明
console.log('【测试 5】生成业绩证明');
const perf = generatePerformanceContent({
  companyName: '示例科技有限公司',
  years: 3,
});
console.log(`  公司：${perf.companyName}`);
console.log(`  近 ${perf.years} 年业绩：${perf.totalProjects} 个`);
console.log('');

// 测试 6: 生成售后服务承诺
console.log('【测试 6】生成售后服务承诺');
const service = generateServiceContent({
  projectName: '智慧城市管理系统项目',
  warrantyPeriod: '2年',
  responseTime: '4小时',
});
console.log(`  项目：${service.projectName}`);
console.log(`  质保期：${service.warrantyPeriod}`);
console.log(`  响应时间：${service.responseTime}`);
console.log(`  承诺项：${service.commitments.length} 项`);
console.log('');

// 测试 7: 生成完整商务标
console.log('【测试 7】生成完整商务标');
const commercialBid = generateCommercialBid({
  projectName: '智慧城市管理系统项目',
  companyName: '示例科技有限公司',
  priceOptions: { totalAmount: 5000000 },
  serviceOptions: { warrantyPeriod: '2年' },
});
console.log(`  项目：${commercialBid.projectName}`);
console.log(`  公司：${commercialBid.companyName}`);
console.log(`  包含板块：${Object.keys(commercialBid.sections).join('、')}`);
console.log('');

// 测试 8: 生成报告
console.log('【测试 8】生成商务标报告');
const report = generateCommercialBidReport(commercialBid);
console.log('报告长度：', report.length, '字符');
console.log('前 300 字符：');
console.log(report.substring(0, 300) + '...');
console.log('');

// 测试 9: 查看报价模板
console.log('【测试 9】报价模板');
Object.values(PRICE_TEMPLATES).forEach((template) => {
  console.log(`  - ${template.name}: ${template.description}`);
});
console.log('');

// 测试 10: 查看资质类型
console.log('【测试 10】资质证书类型');
QUALIFICATION_TYPES.forEach((type) => {
  console.log(`  - ${type.name} (必需: ${type.required ? '是' : '否'})`);
});
console.log('');

console.log('=== 商务标服务测试完成 ===');
