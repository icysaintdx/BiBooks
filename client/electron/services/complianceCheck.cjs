/**
 * 合规性检查服务
 * 检查投标文件是否符合招投标法规要求
 * 参考：《中华人民共和国招标投标法》、《政府采购法》等
 */

const { logInfo, logError } = require('../utils/logger.cjs');

// 合规检查规则定义
const COMPLIANCE_RULES = {
  // 格式合规检查
  format: {
    id: 'format',
    name: '格式合规',
    description: '检查投标文件格式是否符合要求',
    rules: [
      {
        id: 'format-page-setup',
        name: '页面设置',
        description: 'A4纸张，页边距符合要求',
        check: 'pageSetup',
        severity: 'warning',
      },
      {
        id: 'format-font',
        name: '字体规范',
        description: '正文使用仿宋/宋体，标题使用黑体/小标宋',
        check: 'fontSpec',
        severity: 'warning',
      },
      {
        id: 'format-numbering',
        name: '章节编号',
        description: '章节编号连续，格式统一',
        check: 'numbering',
        severity: 'info',
      },
      {
        id: 'format-page-number',
        name: '页码设置',
        description: '页码连续，位置正确',
        check: 'pageNumber',
        severity: 'warning',
      },
    ],
  },

  // 资质要求检查
  qualification: {
    id: 'qualification',
    name: '资质要求',
    description: '检查投标文件是否满足资质要求',
    rules: [
      {
        id: 'qual-business-license',
        name: '营业执照',
        description: '营业执照是否在有效期内',
        check: 'businessLicense',
        severity: 'critical',
      },
      {
        id: 'qual-tax',
        name: '税务登记',
        description: '税务登记证明是否完整',
        check: 'taxRegistration',
        severity: 'critical',
      },
      {
        id: 'qual-financial',
        name: '财务报告',
        description: '近三年财务报告是否齐全',
        check: 'financialReport',
        severity: 'major',
      },
      {
        id: 'qual-certificates',
        name: '资质证书',
        description: '相关资质证书是否在有效期',
        check: 'certificates',
        severity: 'critical',
      },
    ],
  },

  // 时间节点检查
  timeline: {
    id: 'timeline',
    name: '时间节点',
    description: '检查投标时间节点是否合规',
    rules: [
      {
        id: 'time-deadline',
        name: '投标截止',
        description: '是否在截止时间前提交',
        check: 'bidDeadline',
        severity: 'critical',
      },
      {
        id: 'time-validity',
        name: '投标有效期',
        description: '投标有效期是否满足要求',
        check: 'bidValidity',
        severity: 'major',
      },
      {
        id: 'time-guarantee',
        name: '保证金截止',
        description: '投标保证金是否在截止前缴纳',
        check: 'guaranteeDeadline',
        severity: 'critical',
      },
    ],
  },

  // 保证金检查
  guarantee: {
    id: 'guarantee',
    name: '保证金',
    description: '检查投标保证金相关要求',
    rules: [
      {
        id: 'guar-amount',
        name: '保证金金额',
        description: '保证金金额是否符合要求',
        check: 'guaranteeAmount',
        severity: 'critical',
      },
      {
        id: 'guar-method',
        name: '缴纳方式',
        description: '缴纳方式是否符合要求',
        check: 'guaranteeMethod',
        severity: 'major',
      },
      {
        id: 'guar-account',
        name: '收款账户',
        description: '收款账户是否正确',
        check: 'guaranteeAccount',
        severity: 'critical',
      },
    ],
  },

  // 文件完整性检查
  completeness: {
    id: 'completeness',
    name: '文件完整性',
    description: '检查投标文件是否完整',
    rules: [
      {
        id: 'comp-cover',
        name: '投标函',
        description: '投标函是否完整',
        check: 'bidLetter',
        severity: 'critical',
      },
      {
        id: 'comp-price',
        name: '报价文件',
        description: '报价文件是否完整',
        check: 'priceDocument',
        severity: 'critical',
      },
      {
        id: 'comp-tech',
        name: '技术方案',
        description: '技术方案是否完整',
        check: 'techProposal',
        severity: 'critical',
      },
      {
        id: 'comp-business',
        name: '商务文件',
        description: '商务文件是否完整',
        check: 'businessDocument',
        severity: 'major',
      },
      {
        id: 'comp-attachment',
        name: '附件材料',
        description: '附件材料是否齐全',
        check: 'attachments',
        severity: 'warning',
      },
    ],
  },

  // 废标风险检查
  rejection: {
    id: 'rejection',
    name: '废标风险',
    description: '检查可能导致废标的风险项',
    rules: [
      {
        id: 'rej-seal',
        name: '签章完整',
        description: '投标文件签章是否完整',
        check: 'seal',
        severity: 'critical',
      },
      {
        id: 'rej-correction',
        name: '修改规范',
        description: '修改处是否有签章确认',
        check: 'correction',
        severity: 'major',
      },
      {
        id: 'rej-binding',
        name: '装订规范',
        description: '装订是否符合要求',
        check: 'binding',
        severity: 'warning',
      },
      {
        id: 'rej-copy',
        name: '副本数量',
        description: '副本数量是否符合要求',
        check: 'copyCount',
        severity: 'major',
      },
    ],
  },
};

// 严重程度定义
const SEVERITY_LEVELS = {
  critical: { label: '严重', color: '#ef4444', icon: '🔴', priority: 1 },
  major: { label: '重要', color: '#f97316', icon: '🟠', priority: 2 },
  warning: { label: '警告', color: '#eab308', icon: '🟡', priority: 3 },
  info: { label: '提示', color: '#3b82f6', icon: 'ℹ️', priority: 4 },
};

/**
 * 从招标文件提取合规检查所需信息
 */
function extractComplianceInfo(bidAnalysis) {
  const info = {
    projectName: '',
    bidDeadline: '',
    bidValidity: '',
    guaranteeAmount: '',
    guaranteeMethod: '',
    guaranteeDeadline: '',
    guaranteeAccount: '',
    requiredQualifications: [],
    requiredDocuments: [],
    copyCount: '',
    submissionLocation: '',
    openingTime: '',
  };

  if (!bidAnalysis) return info;

  // 从项目信息提取
  if (bidAnalysis.projectInfo) {
    try {
      const projectInfo = typeof bidAnalysis.projectInfo === 'string'
        ? JSON.parse(bidAnalysis.projectInfo)
        : bidAnalysis.projectInfo;
      info.projectName = projectInfo.project_name || '';
    } catch (e) {
      // 解析失败忽略
    }
  }

  // 从投标关键节点提取
  if (bidAnalysis.keyInfo) {
    try {
      const keyInfo = typeof bidAnalysis.keyInfo === 'string'
        ? JSON.parse(bidAnalysis.keyInfo)
        : bidAnalysis.keyInfo;
      info.bidDeadline = keyInfo.bid_submission_deadline || '';
      info.openingTime = keyInfo.bid_opening_time || '';
      info.submissionLocation = keyInfo.bid_document_submission_location || '';
    } catch (e) {
      // 解析失败忽略
    }
  }

  // 从保证金信息提取
  if (bidAnalysis.marginInfo) {
    try {
      const marginInfo = typeof bidAnalysis.marginInfo === 'string'
        ? JSON.parse(bidAnalysis.marginInfo)
        : bidAnalysis.marginInfo;
      info.guaranteeAmount = marginInfo.bidding_deposit || '';
      info.guaranteeMethod = marginInfo.payment_method || '';
      info.guaranteeDeadline = marginInfo.due_date || '';
      info.guaranteeAccount = marginInfo.bank_account_number || '';
    } catch (e) {
      // 解析失败忽略
    }
  }

  // 从评标要求提取
  if (bidAnalysis.evaluationBid) {
    try {
      const evaluation = typeof bidAnalysis.evaluationBid === 'string'
        ? JSON.parse(bidAnalysis.evaluationBid)
        : bidAnalysis.evaluationBid;
      info.bidValidity = evaluation.validity || '';
    } catch (e) {
      // 解析失败忽略
    }
  }

  // 从资格性审查提取
  if (bidAnalysis.qualificationReview) {
    info.requiredQualifications = extractQualifications(bidAnalysis.qualificationReview);
  }

  // 从符合性检查提取
  if (bidAnalysis.complianceCheck) {
    info.requiredDocuments = extractRequiredDocuments(bidAnalysis.complianceCheck);
  }

  return info;
}

/**
 * 提取资质要求列表
 */
function extractQualifications(text) {
  const qualifications = [];
  const patterns = [
    /营业执照/g,
    /税务登记/g,
    /组织机构代码/g,
    /资质证书/g,
    /安全生产许可证/g,
    /ISO\d+/g,
    /质量管理体系/g,
    /环境管理体系/g,
    /职业健康安全/g,
  ];

  for (const pattern of patterns) {
    const matches = text.match(pattern);
    if (matches) {
      qualifications.push(...matches);
    }
  }

  return [...new Set(qualifications)];
}

/**
 * 提取 required documents
 */
function extractRequiredDocuments(text) {
  const documents = [];
  const patterns = [
    /投标函/g,
    /报价表/g,
    /技术方案/g,
    /商务文件/g,
    /授权委托书/g,
    /业绩证明/g,
    /人员资质/g,
    /设备清单/g,
  ];

  for (const pattern of patterns) {
    const matches = text.match(pattern);
    if (matches) {
      documents.push(...matches);
    }
  }

  return [...new Set(documents)];
}

/**
 * 执行合规检查
 */
function runComplianceCheck(bidAnalysis, technicalPlan) {
  const results = [];
  const complianceInfo = extractComplianceInfo(bidAnalysis);

  // 遍历所有规则类别
  for (const [categoryId, category] of Object.entries(COMPLIANCE_RULES)) {
    const categoryResult = {
      id: category.id,
      name: category.name,
      description: category.description,
      rules: [],
      passedCount: 0,
      failedCount: 0,
      warningCount: 0,
    };

    // 遍历类别下的所有规则
    for (const rule of category.rules) {
      const ruleResult = checkRule(rule, complianceInfo, technicalPlan);
      categoryResult.rules.push(ruleResult);

      if (ruleResult.status === 'passed') {
        categoryResult.passedCount++;
      } else if (ruleResult.status === 'failed') {
        categoryResult.failedCount++;
      } else if (ruleResult.status === 'warning') {
        categoryResult.warningCount++;
      }
    }

    results.push(categoryResult);
  }

  // 计算总体合规分数
  const totalRules = results.reduce((sum, cat) => sum + cat.rules.length, 0);
  const passedRules = results.reduce((sum, cat) => sum + cat.passedCount, 0);
  const failedRules = results.reduce((sum, cat) => sum + cat.failedCount, 0);
  const warningRules = results.reduce((sum, cat) => sum + cat.warningCount, 0);

  const score = totalRules > 0 ? Math.round((passedRules / totalRules) * 100) : 0;

  return {
    checkDate: new Date().toISOString(),
    projectName: complianceInfo.projectName,
    score,
    summary: {
      total: totalRules,
      passed: passedRules,
      failed: failedRules,
      warning: warningRules,
      info: totalRules - passedRules - failedRules - warningRules,
    },
    categories: results,
    recommendations: generateRecommendations(results),
  };
}

/**
 * 检查单条规则
 */
function checkRule(rule, complianceInfo, technicalPlan) {
  const result = {
    id: rule.id,
    name: rule.name,
    description: rule.description,
    severity: rule.severity,
    status: 'info', // passed, failed, warning, info
    message: '',
    details: [],
  };

  switch (rule.check) {
    case 'pageSetup':
      result.status = 'passed';
      result.message = '页面设置已按公文标准配置';
      break;

    case 'fontSpec':
      result.status = 'passed';
      result.message = '字体已配置为公文标准字体';
      break;

    case 'numbering':
      if (technicalPlan?.outlineData?.outline?.length > 0) {
        result.status = 'passed';
        result.message = '章节编号已生成';
      } else {
        result.status = 'warning';
        result.message = '尚未生成目录，请确保章节编号连续';
      }
      break;

    case 'pageNumber':
      result.status = 'info';
      result.message = '导出时将自动添加页码';
      break;

    case 'businessLicense':
      if (complianceInfo.requiredQualifications.includes('营业执照')) {
        result.status = 'warning';
        result.message = '招标要求营业执照，请确保已准备';
        result.details.push('营业执照需要在有效期内');
      } else {
        result.status = 'info';
        result.message = '未检测到营业执照要求';
      }
      break;

    case 'taxRegistration':
      if (complianceInfo.requiredQualifications.includes('税务登记')) {
        result.status = 'warning';
        result.message = '招标要求税务登记证明，请确保已准备';
      } else {
        result.status = 'info';
        result.message = '未检测到税务登记要求';
      }
      break;

    case 'financialReport':
      result.status = 'info';
      result.message = '请准备近三年财务审计报告';
      break;

    case 'certificates':
      if (complianceInfo.requiredQualifications.length > 0) {
        result.status = 'warning';
        result.message = `检测到资质要求：${complianceInfo.requiredQualifications.join('、')}`;
        result.details = complianceInfo.requiredQualifications.map((q) => `请确保${q}在有效期内`);
      } else {
        result.status = 'info';
        result.message = '未检测到特殊资质要求';
      }
      break;

    case 'bidDeadline':
      if (complianceInfo.bidDeadline) {
        result.status = 'warning';
        result.message = `投标截止时间：${complianceInfo.bidDeadline}`;
        result.details.push('请确保在截止时间前完成提交');
      } else {
        result.status = 'info';
        result.message = '未检测到投标截止时间';
      }
      break;

    case 'bidValidity':
      if (complianceInfo.bidValidity) {
        result.status = 'warning';
        result.message = `投标有效期：${complianceInfo.bidValidity}`;
      } else {
        result.status = 'info';
        result.message = '未检测到投标有效期要求';
      }
      break;

    case 'guaranteeDeadline':
      if (complianceInfo.guaranteeDeadline) {
        result.status = 'warning';
        result.message = `保证金缴纳截止：${complianceInfo.guaranteeDeadline}`;
        result.details.push('请确保在截止前完成缴纳');
      } else {
        result.status = 'info';
        result.message = '未检测到保证金截止时间';
      }
      break;

    case 'guaranteeAmount':
      if (complianceInfo.guaranteeAmount) {
        result.status = 'warning';
        result.message = `保证金金额：${complianceInfo.guaranteeAmount}`;
        result.details.push('请确保金额正确');
      } else {
        result.status = 'info';
        result.message = '未检测到保证金金额要求';
      }
      break;

    case 'guaranteeMethod':
      if (complianceInfo.guaranteeMethod) {
        result.status = 'warning';
        result.message = `缴纳方式：${complianceInfo.guaranteeMethod}`;
      } else {
        result.status = 'info';
        result.message = '未检测到缴纳方式要求';
      }
      break;

    case 'guaranteeAccount':
      if (complianceInfo.guaranteeAccount) {
        result.status = 'warning';
        result.message = `收款账户：${complianceInfo.guaranteeAccount}`;
        result.details.push('请核实账户信息是否正确');
      } else {
        result.status = 'info';
        result.message = '未检测到收款账户信息';
      }
      break;

    case 'bidLetter':
      result.status = 'warning';
      result.message = '请确保投标函完整并签章';
      break;

    case 'priceDocument':
      result.status = 'warning';
      result.message = '请确保报价文件完整';
      break;

    case 'techProposal':
      if (technicalPlan?.outlineData?.outline?.length > 0) {
        result.status = 'passed';
        result.message = '技术方案已生成';
      } else {
        result.status = 'warning';
        result.message = '技术方案尚未完成';
      }
      break;

    case 'businessDocument':
      result.status = 'info';
      result.message = '请准备商务文件';
      break;

    case 'attachments':
      result.status = 'info';
      result.message = '请检查附件材料是否齐全';
      break;

    case 'seal':
      result.status = 'warning';
      result.message = '请确保投标文件所有要求处已签章';
      result.details.push('投标函、报价表等关键文件需要公章');
      break;

    case 'correction':
      result.status = 'info';
      result.message = '如有修改，请在修改处签章确认';
      break;

    case 'binding':
      result.status = 'info';
      result.message = '请按招标要求装订';
      break;

    case 'copyCount':
      if (complianceInfo.copyCount) {
        result.status = 'warning';
        result.message = `要求副本数量：${complianceInfo.copyCount}`;
      } else {
        result.status = 'info';
        result.message = '请确认副本数量要求';
      }
      break;

    default:
      result.status = 'info';
      result.message = '待人工确认';
  }

  return result;
}

/**
 * 生成合规建议
 */
function generateRecommendations(results) {
  const recommendations = [];

  // 收集所有失败和警告的规则
  const issues = [];
  for (const category of results) {
    for (const rule of category.rules) {
      if (rule.status === 'failed' || rule.status === 'warning') {
        issues.push({
          category: category.name,
          ...rule,
        });
      }
    }
  }

  // 按严重程度排序
  issues.sort((a, b) => {
    const aLevel = SEVERITY_LEVELS[a.severity] || SEVERITY_LEVELS.info;
    const bLevel = SEVERITY_LEVELS[b.severity] || SEVERITY_LEVELS.info;
    return aLevel.priority - bLevel.priority;
  });

  // 生成建议
  if (issues.some((i) => i.severity === 'critical')) {
    recommendations.push({
      type: 'critical',
      title: '严重合规问题',
      content: '存在严重合规问题，可能导致废标。请立即处理以下问题：',
      items: issues.filter((i) => i.severity === 'critical').map((i) => `[${i.category}] ${i.name}: ${i.message}`),
    });
  }

  if (issues.some((i) => i.severity === 'major')) {
    recommendations.push({
      type: 'warning',
      title: '重要合规事项',
      content: '以下重要事项需要重点关注：',
      items: issues.filter((i) => i.severity === 'major').map((i) => `[${i.category}] ${i.name}: ${i.message}`),
    });
  }

  if (issues.some((i) => i.severity === 'warning')) {
    recommendations.push({
      type: 'info',
      title: '合规提醒',
      content: '以下事项请在投标前确认：',
      items: issues.filter((i) => i.severity === 'warning').map((i) => `[${i.category}] ${i.name}: ${i.message}`),
    });
  }

  // 通用建议
  recommendations.push({
    type: 'tip',
    title: '投标建议',
    content: '投标前检查清单：',
    items: [
      '仔细阅读招标文件，确保所有要求都已响应',
      '检查所有签章是否完整',
      '确认副本数量和装订方式',
      '提前到达开标现场',
      '保留投标文件副本以备查',
    ],
  });

  return recommendations;
}

/**
 * 格式化合规检查报告为 Markdown
 */
function formatComplianceReportAsMarkdown(report) {
  const lines = [];

  lines.push('# 合规性检查报告');
  lines.push('');
  lines.push(`**检查日期**: ${new Date(report.checkDate).toLocaleDateString('zh-CN')}`);
  if (report.projectName) {
    lines.push(`**项目名称**: ${report.projectName}`);
  }
  lines.push(`**合规分数**: ${report.score}/100`);
  lines.push('');

  // 检查概览
  lines.push('## 检查概览');
  lines.push('');
  lines.push(`- **总检查项**: ${report.summary.total}`);
  lines.push(`- **通过**: ${report.summary.passed}`);
  lines.push(`- **未通过**: ${report.summary.failed}`);
  lines.push(`- **警告**: ${report.summary.warning}`);
  lines.push(`- **提示**: ${report.summary.info}`);
  lines.push('');

  // 合规建议
  if (report.recommendations.length > 0) {
    lines.push('## 合规建议');
    lines.push('');

    for (const rec of report.recommendations) {
      const icon = rec.type === 'critical' ? '🔴' : rec.type === 'warning' ? '🟠' : rec.type === 'info' ? '🟡' : '💡';
      lines.push(`### ${icon} ${rec.title}`);
      lines.push('');
      lines.push(rec.content);
      lines.push('');
      if (rec.items && rec.items.length > 0) {
        for (const item of rec.items) {
          lines.push(`- ${item}`);
        }
        lines.push('');
      }
    }
  }

  // 各类别详情
  lines.push('## 检查详情');
  lines.push('');

  for (const category of report.categories) {
    lines.push(`### ${category.name}`);
    lines.push('');
    lines.push(category.description);
    lines.push('');
    lines.push(`通过: ${category.passedCount} | 未通过: ${category.failedCount} | 警告: ${category.warningCount}`);
    lines.push('');

    for (const rule of category.rules) {
      const statusIcon = rule.status === 'passed' ? '✅' : rule.status === 'failed' ? '❌' : rule.status === 'warning' ? '⚠️' : 'ℹ️';
      lines.push(`- ${statusIcon} **${rule.name}**: ${rule.message}`);

      if (rule.details && rule.details.length > 0) {
        for (const detail of rule.details) {
          lines.push(`  - ${detail}`);
        }
      }
    }

    lines.push('');
  }

  return lines.join('\n');
}

/**
 * 创建合规检查服务实例
 */
function createComplianceCheckService() {
  return {
    /**
     * 执行合规检查
     * @param {Object} payload - { bidAnalysis, technicalPlan }
     */
    check(payload) {
      try {
        const { bidAnalysis, technicalPlan } = payload || {};

        const report = runComplianceCheck(bidAnalysis, technicalPlan);

        logInfo('[compliance-check] 检查完成', {
          score: report.score,
          passed: report.summary.passed,
          failed: report.summary.failed,
          warning: report.summary.warning,
        });

        return { success: true, report };
      } catch (error) {
        logError('[compliance-check] 检查失败', error);
        return { success: false, message: `合规检查失败: ${error.message}` };
      }
    },

    /**
     * 获取检查规则列表
     */
    getRules() {
      return COMPLIANCE_RULES;
    },

    /**
     * 格式化报告为 Markdown
     */
    formatAsMarkdown(report) {
      return formatComplianceReportAsMarkdown(report);
    },
  };
}

module.exports = {
  createComplianceCheckService,
  COMPLIANCE_RULES,
  SEVERITY_LEVELS,
  extractComplianceInfo,
  runComplianceCheck,
  formatComplianceReportAsMarkdown,
};
