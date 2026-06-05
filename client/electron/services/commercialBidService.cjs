/**
 * 商务标服务
 * 生成商务标内容，包括报价、资质、业绩、财务等
 */

const fs = require('node:fs');
const path = require('node:path');

// 商务标章节定义
const COMMERCIAL_BID_SECTIONS = {
  price: {
    id: 'price',
    title: '投标报价',
    description: '项目报价及费用明细',
    required: true,
  },
  terms: {
    id: 'terms',
    title: '商务条款响应',
    description: '对招标文件商务条款的响应',
    required: true,
  },
  qualifications: {
    id: 'qualifications',
    title: '资质证明',
    description: '企业资质证书及相关证明',
    required: true,
  },
  performance: {
    id: 'performance',
    title: '业绩证明',
    description: '类似项目业绩及客户评价',
    required: true,
  },
  financial: {
    id: 'financial',
    title: '财务状况',
    description: '企业财务报表及资信证明',
    required: false,
  },
  service: {
    id: 'service',
    title: '售后服务承诺',
    description: '售后服务方案及承诺',
    required: true,
  },
};

// 报价模板
const PRICE_TEMPLATES = {
  lumpSum: {
    name: '总价包干',
    description: '固定总价，包含所有费用',
    structure: [
      { name: '人工费', description: '项目实施人员费用' },
      { name: '材料费', description: '项目所需材料费用' },
      { name: '设备费', description: '项目所需设备费用' },
      { name: '管理费', description: '项目管理及协调费用' },
      { name: '利润', description: '合理利润' },
      { name: '税金', description: '增值税及其他税费' },
    ],
  },
  unitPrice: {
    name: '单价合同',
    description: '按实际工作量结算',
    structure: [
      { name: '人工单价', description: '每人每天/每小时费用' },
      { name: '材料单价', description: '各类材料单价' },
      { name: '设备租赁单价', description: '设备租赁费用' },
      { name: '管理费率', description: '管理费占直接费比例' },
    ],
  },
  costPlus: {
    name: '成本加酬金',
    description: '实际成本加固定酬金',
    structure: [
      { name: '直接成本', description: '人工、材料、设备等直接费用' },
      { name: '间接成本', description: '管理、办公等间接费用' },
      { name: '固定酬金', description: '固定利润金额' },
      { name: '奖励酬金', description: '绩效奖励（如有）' },
    ],
  },
};

// 资质证书类型
const QUALIFICATION_TYPES = [
  { id: 'business_license', name: '营业执照', required: true },
  { id: 'tax_registration', name: '税务登记证', required: true },
  { id: 'organization_code', name: '组织机构代码证', required: true },
  { id: 'iso9001', name: 'ISO9001质量管理体系认证', required: false },
  { id: 'iso14001', name: 'ISO14001环境管理体系认证', required: false },
  { id: 'iso45001', name: 'ISO45001职业健康安全管理体系认证', required: false },
  { id: 'industry_qualification', name: '行业特定资质', required: false },
  { id: 'safety_production', name: '安全生产许可证', required: false },
  { id: 'credit_certificate', name: '资信证明', required: false },
];

/**
 * 生成投标报价内容
 * @param {Object} options - 报价选项
 * @returns {Object} 报价内容
 */
function generatePriceContent(options = {}) {
  const {
    projectName = '',
    priceType = 'lumpSum',
    totalAmount = 0,
    currency = '人民币',
    items = [],
    notes = [],
  } = options;

  const template = PRICE_TEMPLATES[priceType] || PRICE_TEMPLATES.lumpSum;

  // 如果提供了具体报价项，使用提供的数据
  const priceItems = items.length > 0 ? items : template.structure.map((item) => ({
    ...item,
    amount: 0,
    unit: priceType === 'unitPrice' ? '元/单位' : '元',
  }));

  return {
    projectName,
    priceType: template.name,
    priceTypeDescription: template.description,
    totalAmount,
    currency,
    items: priceItems,
    notes,
    generatedAt: new Date().toISOString(),
  };
}

/**
 * 生成商务条款响应内容
 * @param {Object} options - 选项
 * @returns {Object} 商务条款响应
 */
function generateTermsContent(options = {}) {
  const {
    projectName = '',
    terms = [],
    responses = [],
  } = options;

  // 默认商务条款
  const defaultTerms = [
    { id: 'payment', title: '付款方式', description: '项目付款方式及条件' },
    { id: 'warranty', title: '质保期', description: '项目质保期限及服务' },
    { id: 'delivery', title: '交付时间', description: '项目交付时间安排' },
    { id: 'penalty', title: '违约责任', description: '违约责任及赔偿' },
    { id: 'insurance', title: '保险', description: '项目保险安排' },
    { id: 'confidentiality', title: '保密条款', description: '保密义务及期限' },
    { id: 'dispute', title: '争议解决', description: '争议解决方式' },
    { id: 'force_majeure', title: '不可抗力', description: '不可抗力条款' },
  ];

  const termList = terms.length > 0 ? terms : defaultTerms;

  // 生成响应
  const termResponses = termList.map((term, index) => {
    const response = responses[index] || {};
    return {
      ...term,
      response: response.content || `同意${term.title}条款`,
      compliant: response.compliant !== undefined ? response.compliant : true,
      deviation: response.deviation || '',
    };
  });

  return {
    projectName,
    terms: termResponses,
    allCompliant: termResponses.every((t) => t.compliant),
    generatedAt: new Date().toISOString(),
  };
}

/**
 * 生成资质证明内容
 * @param {Object} options - 选项
 * @returns {Object} 资质证明
 */
function generateQualificationsContent(options = {}) {
  const {
    companyName = '',
    qualifications = [],
  } = options;

  // 使用提供的资质或默认模板
  const qualificationList = qualifications.length > 0 ? qualifications : QUALIFICATION_TYPES.map((type) => ({
    ...type,
    status: 'pending',
    certificateNo: '',
    validFrom: '',
    validTo: '',
    issuingAuthority: '',
  }));

  return {
    companyName,
    qualifications: qualificationList,
    requiredCount: qualificationList.filter((q) => q.required).length,
    completedCount: qualificationList.filter((q) => q.status === 'completed').length,
    generatedAt: new Date().toISOString(),
  };
}

/**
 * 生成业绩证明内容
 * @param {Object} options - 选项
 * @returns {Object} 业绩证明
 */
function generatePerformanceContent(options = {}) {
  const {
    companyName = '',
    projects = [],
    years = 3,
  } = options;

  // 业绩项目模板
  const projectTemplate = {
    name: '',
    client: '',
    contractAmount: 0,
    completionDate: '',
    projectScale: '',
    description: '',
    clientContact: '',
    clientPhone: '',
    status: 'completed',
  };

  const projectList = projects.length > 0 ? projects : [
    { ...projectTemplate, name: '示例项目1' },
    { ...projectTemplate, name: '示例项目2' },
    { ...projectTemplate, name: '示例项目3' },
  ];

  return {
    companyName,
    years,
    projects: projectList,
    totalProjects: projectList.length,
    totalAmount: projectList.reduce((sum, p) => sum + (p.contractAmount || 0), 0),
    generatedAt: new Date().toISOString(),
  };
}

/**
 * 生成财务状况内容
 * @param {Object} options - 选项
 * @returns {Object} 财务状况
 */
function generateFinancialContent(options = {}) {
  const {
    companyName = '',
    years = 3,
    financialData = {},
  } = options;

  const defaultData = {
    revenue: { year1: 0, year2: 0, year3: 0 },
    profit: { year1: 0, year2: 0, year3: 0 },
    assets: { year1: 0, year2: 0, year3: 0 },
    liabilities: { year1: 0, year2: 0, year3: 0 },
    bankCredit: '',
    creditRating: '',
  };

  const data = { ...defaultData, ...financialData };

  return {
    companyName,
    years,
    financialData: data,
    bankCredit: data.bankCredit,
    creditRating: data.creditRating,
    generatedAt: new Date().toISOString(),
  };
}

/**
 * 生成售后服务承诺内容
 * @param {Object} options - 选项
 * @returns {Object} 售后服务承诺
 */
function generateServiceContent(options = {}) {
  const {
    projectName = '',
    warrantyPeriod = '1年',
    responseTime = '24小时',
    serviceTeam = [],
    serviceCommitments = [],
  } = options;

  const defaultCommitments = [
    { id: 'warranty', title: '质保承诺', content: `质保期为${warrantyPeriod}，质保期内免费维修` },
    { id: 'response', title: '响应时间', content: `故障响应时间不超过${responseTime}` },
    { id: 'maintenance', title: '定期维护', content: '提供定期巡检和维护服务' },
    { id: 'training', title: '培训服务', content: '提供免费操作培训和技术指导' },
    { id: 'spare_parts', title: '备品备件', content: '提供充足的备品备件供应' },
    { id: 'upgrade', title: '升级服务', content: '提供软件升级和技术支持' },
  ];

  const commitments = serviceCommitments.length > 0 ? serviceCommitments : defaultCommitments;

  return {
    projectName,
    warrantyPeriod,
    responseTime,
    serviceTeam,
    commitments,
    generatedAt: new Date().toISOString(),
  };
}

/**
 * 生成完整的商务标内容
 * @param {Object} options - 选项
 * @returns {Object} 商务标内容
 */
function generateCommercialBid(options = {}) {
  const {
    projectName = '',
    companyName = '',
    priceOptions = {},
    termsOptions = {},
    qualificationOptions = {},
    performanceOptions = {},
    financialOptions = {},
    serviceOptions = {},
  } = options;

  return {
    projectName,
    companyName,
    sections: {
      price: generatePriceContent({ projectName, ...priceOptions }),
      terms: generateTermsContent({ projectName, ...termsOptions }),
      qualifications: generateQualificationsContent({ companyName, ...qualificationOptions }),
      performance: generatePerformanceContent({ companyName, ...performanceOptions }),
      financial: generateFinancialContent({ companyName, ...financialOptions }),
      service: generateServiceContent({ projectName, ...serviceOptions }),
    },
    generatedAt: new Date().toISOString(),
  };
}

/**
 * 生成商务标报告
 * @param {Object} commercialBid - 商务标内容
 * @returns {string} Markdown 格式报告
 */
function generateCommercialBidReport(commercialBid) {
  if (!commercialBid) {
    return '# 商务标生成失败\n\n无内容';
  }

  const lines = [
    `# 商务标报告`,
    '',
    `## 项目信息`,
    `- 项目名称：${commercialBid.projectName}`,
    `- 投标单位：${commercialBid.companyName}`,
    `- 生成时间：${commercialBid.generatedAt}`,
    '',
  ];

  // 报价部分
  const price = commercialBid.sections.price;
  lines.push('## 投标报价');
  lines.push(`- 报价方式：${price.priceType}`);
  lines.push(`- 总报价：${price.totalAmount} ${price.currency}`);
  lines.push('');

  // 资质部分
  const quals = commercialBid.sections.qualifications;
  lines.push('## 资质证明');
  lines.push(`- 必需资质：${quals.requiredCount} 项`);
  lines.push(`- 已完成：${quals.completedCount} 项`);
  lines.push('');

  // 业绩部分
  const perf = commercialBid.sections.performance;
  lines.push('## 业绩证明');
  lines.push(`- 近 ${perf.years} 年业绩：${perf.totalProjects} 个`);
  lines.push(`- 合同总金额：${perf.totalAmount} 元`);
  lines.push('');

  // 售后服务
  const service = commercialBid.sections.service;
  lines.push('## 售后服务承诺');
  lines.push(`- 质保期：${service.warrantyPeriod}`);
  lines.push(`- 响应时间：${service.responseTime}`);
  lines.push('');

  return lines.join('\n');
}

/**
 * 创建商务标服务实例
 */
function createCommercialBidService() {
  return {
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
  };
}

module.exports = {
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
};
