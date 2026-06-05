/**
 * 投标机会服务测试脚本
 */

const {
  createBidOpportunityService,
  createOpportunity,
  analyzeOpportunity,
  generateDecisionRecommendation,
  updateOpportunityStatus,
  generateBidCalendar,
  analyzeCompetition,
  generateOpportunityReport,
  OPPORTUNITY_STATUS,
  DECISION_FACTORS,
  TENDER_SOURCES,
} = require('../client/electron/services/bidOpportunityService.cjs');

console.log('=== 投标机会服务测试 ===\n');

// 测试 1: 查看机会状态
console.log('【测试 1】机会状态定义');
Object.values(OPPORTUNITY_STATUS).forEach((status) => {
  console.log(`  - ${status}`);
});
console.log('');

// 测试 2: 查看决策因素
console.log('【测试 2】决策因素定义');
Object.values(DECISION_FACTORS).forEach((factor) => {
  console.log(`  - ${factor.name}: ${factor.description} (权重: ${factor.weight * 100}%)`);
});
console.log('');

// 测试 3: 创建投标机会
console.log('【测试 3】创建投标机会');
const opportunity = createOpportunity({
  projectName: '智慧城市管理系统项目',
  tenderNo: 'ZB-2026-001',
  clientName: '某市政府',
  budget: 5000000,
  deadline: '2026-07-15',
  source: 'government',
  description: '建设智慧城市管理系统，包含交通、环保、市政等模块',
});
console.log(`  ID: ${opportunity.id}`);
console.log(`  项目: ${opportunity.projectName}`);
console.log(`  编号: ${opportunity.tenderNo}`);
console.log(`  客户: ${opportunity.clientName}`);
console.log(`  预算: ${opportunity.budget} 元`);
console.log(`  状态: ${opportunity.status}`);
console.log('');

// 测试 4: 分析投标机会
console.log('【测试 4】分析投标机会');
const analysisData = {
  projectMatchScore: 85,
  competitionLevelScore: 60,
  profitPotentialScore: 75,
  resourceAvailabilityScore: 80,
  clientRelationshipScore: 70,
  riskLevelScore: 65,
  analysisNotes: '项目匹配度高，但竞争较激烈',
};
const analyzed = analyzeOpportunity(opportunity, analysisData);
console.log(`  决策评分: ${analyzed.decisionScore} 分`);
console.log(`  状态: ${analyzed.status}`);
console.log(`  分析备注: ${analyzed.analysisNotes}`);
console.log('');

// 测试 5: 生成决策建议
console.log('【测试 5】生成决策建议');
const recommendation = generateDecisionRecommendation(analyzed);
console.log(`  建议: ${recommendation.recommendation}`);
console.log(`  置信度: ${recommendation.confidence}%`);
console.log(`  评分: ${recommendation.score} 分`);
console.log('  原因:');
recommendation.reasons.forEach((r) => console.log(`    - ${r}`));
console.log('');

// 测试 6: 更新机会状态
console.log('【测试 6】更新机会状态');
const updated = updateOpportunityStatus(analyzed, 'bidding', '决定参与投标');
console.log(`  原状态: ${analyzed.status}`);
console.log(`  新状态: ${updated.status}`);
console.log(`  状态历史: ${updated.statusHistory.length} 条`);
console.log('');

// 测试 7: 生成投标日历
console.log('【测试 7】生成投标日历');
const opportunities = [
  opportunity,
  createOpportunity({
    projectName: '数据中心建设项目',
    deadline: '2026-07-20',
    clientName: '某银行',
  }),
  createOpportunity({
    projectName: '办公自动化系统',
    deadline: '2026-06-30',
    clientName: '某企业',
  }),
];
const calendar = generateBidCalendar(opportunities);
console.log(`  日历事件: ${calendar.length} 个`);
calendar.forEach((event) => {
  console.log(`    - ${event.date}: ${event.title} (${event.type})`);
});
console.log('');

// 测试 8: 分析竞争对手
console.log('【测试 8】分析竞争对手');
const competitors = [
  { name: '竞争对手A', strengths: ['价格低', '关系好'], winRate: 0.3 },
  { name: '竞争对手B', strengths: ['技术强'], winRate: 0.25 },
  { name: '竞争对手C', strengths: ['经验丰富'], winRate: 0.2 },
];
const competition = analyzeCompetition(opportunity, competitors);
console.log(`  竞争对手数: ${competition.competitorCount}`);
console.log(`  竞争程度: ${competition.competitionLevel}`);
console.log('  竞争对手:');
competition.competitors.forEach((comp) => {
  console.log(`    - ${comp.name}: 中标率 ${(comp.winRate * 100).toFixed(0)}%`);
});
console.log('');

// 测试 9: 生成机会报告
console.log('【测试 9】生成机会报告');
const report = generateOpportunityReport(opportunities);
console.log('报告长度：', report.length, '字符');
console.log('前 300 字符：');
console.log(report.substring(0, 300) + '...');
console.log('');

// 测试 10: 查看招标来源
console.log('【测试 10】招标信息来源');
TENDER_SOURCES.forEach((source) => {
  console.log(`  - ${source.id}: ${source.name}`);
});
console.log('');

console.log('=== 投标机会服务测试完成 ===');
