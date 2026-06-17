'use strict';

const COMMERCIAL_BID_SECTIONS = {
  price: {
    id: 'price',
    title: '投标报价说明',
    description: '报价方式、报价范围和费用明细引用',
    required: true,
  },
  terms: {
    id: 'terms',
    title: '商务条款响应',
    description: '对付款、交付、质保、违约等商务条款的响应',
    required: true,
  },
  qualifications: {
    id: 'qualifications',
    title: '资质证明材料',
    description: '企业资质证书、许可、体系认证和证明附件',
    required: true,
  },
  performance: {
    id: 'performance',
    title: '业绩证明材料',
    description: '类似项目业绩、合同、验收报告和客户评价',
    required: true,
  },
  financial: {
    id: 'financial',
    title: '财务状况',
    description: '近年营收、利润、授信和信用评级',
    required: false,
  },
  service: {
    id: 'service',
    title: '售后服务承诺',
    description: '质保、响应时间、服务团队和维护承诺',
    required: true,
  },
};

const PRICE_TEMPLATES = {
  lumpSum: {
    name: '总价包干',
    description: '固定总价，包含项目实施范围内全部费用',
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
    description: '按实际工作量和约定单价结算',
    structure: [
      { name: '人工单价', description: '人员日/小时单价' },
      { name: '材料单价', description: '材料单价' },
      { name: '设备租赁单价', description: '设备租赁费用' },
      { name: '管理费率', description: '管理费计取比例' },
    ],
  },
  costPlus: {
    name: '成本加酬金',
    description: '实际成本加固定或浮动酬金',
    structure: [
      { name: '直接成本', description: '人工、材料、设备等直接费用' },
      { name: '间接成本', description: '管理、办公等间接费用' },
      { name: '固定酬金', description: '固定利润金额' },
      { name: '奖励酬金', description: '绩效奖励，如有' },
    ],
  },
};

const QUALIFICATION_TYPES = [
  { id: 'business_license', name: '营业执照', required: true },
  { id: 'tax_registration', name: '纳税证明', required: true },
  { id: 'organization_code', name: '统一社会信用代码证明', required: true },
  { id: 'iso9001', name: 'ISO9001 质量管理体系认证', required: false },
  { id: 'iso14001', name: 'ISO14001 环境管理体系认证', required: false },
  { id: 'iso45001', name: 'ISO45001 职业健康安全管理体系认证', required: false },
  { id: 'industry_qualification', name: '行业特定资质', required: false },
  { id: 'safety_production', name: '安全生产许可', required: false },
  { id: 'credit_certificate', name: '资信证明', required: false },
];

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
  const priceItems = items.length > 0 ? items : template.structure.map((item) => ({
    ...item,
    amount: 0,
    unit: priceType === 'unitPrice' ? '元/单位' : '元',
  }));
  return {
    projectName,
    priceType: template.name,
    priceTypeDescription: template.description,
    totalAmount: Number(totalAmount) || 0,
    currency,
    items: priceItems,
    notes,
    generatedAt: new Date().toISOString(),
  };
}

function generateTermsContent(options = {}) {
  const { projectName = '', terms = [], responses = [] } = options;
  const defaultTerms = [
    { id: 'payment', title: '付款方式', description: '付款节点、比例和条件' },
    { id: 'warranty', title: '质保期', description: '质保期限和服务内容' },
    { id: 'delivery', title: '交付时间', description: '项目交付时间安排' },
    { id: 'penalty', title: '违约责任', description: '违约责任和赔偿约定' },
    { id: 'insurance', title: '保险', description: '项目保险安排' },
    { id: 'confidentiality', title: '保密条款', description: '保密义务和期限' },
    { id: 'dispute', title: '争议解决', description: '争议解决方式' },
    { id: 'force_majeure', title: '不可抗力', description: '不可抗力条款' },
  ];
  const termList = terms.length > 0 ? terms : defaultTerms;
  const termResponses = termList.map((term, index) => {
    const response = responses[index] || {};
    return {
      ...term,
      response: response.content || `响应并遵守${term.title}条款，具体以招标文件及合同约定为准。`,
      compliant: response.compliant !== undefined ? response.compliant : true,
      deviation: response.deviation || '',
    };
  });
  return {
    projectName,
    terms: termResponses,
    allCompliant: termResponses.every((term) => term.compliant),
    generatedAt: new Date().toISOString(),
  };
}

function generateQualificationsContent(options = {}) {
  const { companyName = '', qualifications = [] } = options;
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
    requiredCount: qualificationList.filter((item) => item.required).length,
    completedCount: qualificationList.filter((item) => item.status === 'completed').length,
    generatedAt: new Date().toISOString(),
  };
}

function generatePerformanceContent(options = {}) {
  const { companyName = '', projects = [], years = 3 } = options;
  const projectList = projects.length > 0 ? projects : [];
  return {
    companyName,
    years,
    projects: projectList,
    totalProjects: projectList.length,
    totalAmount: projectList.reduce((sum, project) => sum + (Number(project.contractAmount) || 0), 0),
    generatedAt: new Date().toISOString(),
  };
}

function generateFinancialContent(options = {}) {
  const { companyName = '', years = 3, financialData = {} } = options;
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

function generateServiceContent(options = {}) {
  const {
    projectName = '',
    warrantyPeriod = '1年',
    responseTime = '24小时',
    serviceTeam = [],
    serviceCommitments = [],
  } = options;
  const defaultCommitments = [
    { id: 'warranty', title: '质保承诺', content: `质保期为${warrantyPeriod}，质保期内按招标文件和合同要求提供服务。` },
    { id: 'response', title: '响应时间', content: `故障响应时间不超过${responseTime}。` },
    { id: 'maintenance', title: '定期维护', content: '提供定期巡检、维护和问题跟踪服务。' },
    { id: 'training', title: '培训服务', content: '按项目需要提供操作培训和技术指导。' },
  ];
  return {
    projectName,
    warrantyPeriod,
    responseTime,
    serviceTeam,
    commitments: serviceCommitments.length > 0 ? serviceCommitments : defaultCommitments,
    generatedAt: new Date().toISOString(),
  };
}

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

function generateCommercialBidReport(commercialBid) {
  if (!commercialBid) return '# 商务材料草稿生成失败\n\n无内容。';

  const price = commercialBid.sections.price;
  const quals = commercialBid.sections.qualifications;
  const perf = commercialBid.sections.performance;
  const service = commercialBid.sections.service;
  const financial = commercialBid.sections.financial;

  const lines = [
    '# 商务材料草稿',
    '',
    '> 说明：这是内部结构化中间层，不是最终递交标书。最终 Word/PDF 需由完整标书合成器统一套用版式并插入附件。',
    '',
    '## 项目信息',
    `- 项目名称：${commercialBid.projectName || '未填写'}`,
    `- 投标单位：${commercialBid.companyName || '未填写'}`,
    `- 生成时间：${commercialBid.generatedAt}`,
    '',
    '## 投标报价说明',
    `- 报价方式：${price.priceType}`,
    `- 总报价：${price.totalAmount || 0} ${price.currency}`,
    '- 风险提示：真实报价应以报价管理模块和本地核算结果为准，不由 AI 推断。',
    '',
    '## 资质证明材料',
    `- 必备资质：${quals.requiredCount} 项`,
    `- 已完成：${quals.completedCount} 项`,
    '- 附件提示：证书扫描件需从企业知识库绑定，并在最终合成阶段插入。',
    '',
    '## 业绩证明材料',
    `- 近 ${perf.years} 年业绩：${perf.totalProjects} 个`,
    `- 合同金额汇总：${perf.totalAmount || 0} 元`,
    '- 附件提示：业绩需绑定合同、验收报告或客户评价等证明材料。',
    '',
    '## 财务状况',
    `- 银行授信：${financial.bankCredit || '未填写'}`,
    `- 信用评级：${financial.creditRating || '未填写'}`,
    '',
    '## 售后服务承诺',
    `- 质保期：${service.warrantyPeriod}`,
    `- 响应时间：${service.responseTime}`,
    '',
  ];

  return lines.join('\n');
}

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
