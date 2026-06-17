import { useEffect, useState } from 'react';
import type { ComplianceCheckReport, ProjectAnalysisRecord } from '../../../shared/types';
import type { RepairTaskInput } from '../../../shared/types/ipc';
import { markRepairTasksForReview, notifyRepairTasksChanged } from '../../../shared/utils/repairTaskReview';

const severityColors = {
  critical: { bg: 'rgba(239,68,68,0.1)', border: 'rgba(239,68,68,0.3)', text: '#ef4444' },
  major: { bg: 'rgba(249,115,22,0.1)', border: 'rgba(249,115,22,0.3)', text: '#f97316' },
  warning: { bg: 'rgba(234,179,8,0.1)', border: 'rgba(234,179,8,0.3)', text: '#eab308' },
  info: { bg: 'rgba(59,130,246,0.1)', border: 'rgba(59,130,246,0.3)', text: '#3b82f6' },
};

const statusIcons = { passed: '通过', failed: '失败', warning: '警告', info: '提示' };

function buildComplianceRepairTasks(report: ComplianceCheckReport): RepairTaskInput[] {
  const tasks: RepairTaskInput[] = [];
  for (const category of report.categories || []) {
    for (const rule of category.rules || []) {
      if (rule.status === 'passed') continue;
      tasks.push({
        title: `${category.name} - ${rule.name}`,
        sourceModule: 'compliance',
        targetType: 'document',
        severity: rule.severity === 'critical' ? 'critical' : rule.severity === 'major' ? 'major' : 'warning',
        description: rule.message || rule.description || '合规检查存在需要处理的项。',
        suggestion: rule.details?.join('；') || '回到原始文档或相关页面修复该项。',
        patch: {
          source: 'compliance',
          field: `${category.id}.${rule.id}`,
          original: rule.message || rule.description || '',
          suggested: rule.details?.join('；') || '',
          reason: 'rule_failed',
          references: [{ type: 'file', label: '合规检查结果', value: `${category.id}:${rule.id}` }],
        },
        metadata: { categoryId: category.id, ruleId: rule.id, status: rule.status },
      });
    }
  }
  return tasks;
}

export default function ComplianceCheckStandalonePage() {
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState<ComplianceCheckReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [projectName, setProjectName] = useState('');
  const [deadline, setDeadline] = useState('');
  const [guaranteeAmount, setGuaranteeAmount] = useState('');
  const [hasElectronicSeal, setHasElectronicSeal] = useState(true);
  const [hasPaperSeal, setHasPaperSeal] = useState(true);
  const [copyCount, setCopyCount] = useState('正本1份，副本3份');

  useEffect(() => {
    void window.yibiao?.projectWorkspace.list()
      .then((state) => {
        const currentProject = (state.projects || []).find((project) => project.id === state.currentProjectId);
        if (currentProject?.name) setProjectName((value) => value || currentProject.name);
      })
      .catch(() => undefined);

    void window.yibiao?.complianceCheck.getLatest()
      .then((record: ProjectAnalysisRecord<ComplianceCheckReport> | null) => {
        if (!record?.result) return;
        const input = (record.input || {}) as {
          bidAnalysis?: {
            projectInfo?: { projectName?: string };
            keyInfo?: { bidDeadline?: string | null };
            marginInfo?: { amount?: string | number };
            complianceCheck?: {
              hasElectronicSeal?: boolean;
              hasPaperSeal?: boolean;
              copyCount?: string;
            };
          };
        };
        const bidAnalysis = input.bidAnalysis || {};
        setReport(record.result);
        if (bidAnalysis.projectInfo?.projectName) setProjectName(bidAnalysis.projectInfo.projectName);
        if (bidAnalysis.keyInfo?.bidDeadline) setDeadline(bidAnalysis.keyInfo.bidDeadline);
        if (bidAnalysis.marginInfo?.amount != null) setGuaranteeAmount(String(bidAnalysis.marginInfo.amount));
        if (typeof bidAnalysis.complianceCheck?.hasElectronicSeal === 'boolean') setHasElectronicSeal(bidAnalysis.complianceCheck.hasElectronicSeal);
        if (typeof bidAnalysis.complianceCheck?.hasPaperSeal === 'boolean') setHasPaperSeal(bidAnalysis.complianceCheck.hasPaperSeal);
        if (bidAnalysis.complianceCheck?.copyCount) setCopyCount(bidAnalysis.complianceCheck.copyCount);
      })
      .catch(() => undefined);
  }, []);

  const handleCheck = async () => {
    setLoading(true);
    setError(null);
    try {
      const manualInfo = {
        projectInfo: projectName ? { projectName } : undefined,
        keyInfo: {
          bidDeadline: deadline || null,
          bidValidity: null,
          guaranteeDeadline: null,
        },
        marginInfo: guaranteeAmount ? { amount: guaranteeAmount } : undefined,
        complianceCheck: {
          hasSeal: hasElectronicSeal || hasPaperSeal,
          hasElectronicSeal,
          hasPaperSeal,
          copyCount,
        },
      };

      const result = await window.yibiao?.complianceCheck.check({ bidAnalysis: manualInfo });
      if (result?.success && result.report) {
        setReport(result.report as ComplianceCheckReport);
        const repairTasks = buildComplianceRepairTasks(result.report as ComplianceCheckReport);
        const repairTaskApi = window.yibiao?.repairTasks;
        if (repairTasks.length > 0 && repairTaskApi?.save) {
          await Promise.all(repairTasks.map((task) => repairTaskApi.save(task)));
          notifyRepairTasksChanged();
        } else {
          await markRepairTasksForReview({
            sourceModule: 'compliance',
            targetType: 'document',
            decision: '合规检查已更新，等待交付检查复核',
          });
        }
      } else {
        setError(result?.message || '合规检查失败');
      }
    } catch (err) {
      setError(`合规检查失败: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setLoading(false);
    }
  };

  const getScoreColor = (score: number) => score >= 90 ? '#22c55e' : score >= 70 ? '#eab308' : score >= 50 ? '#f97316' : '#ef4444';
  const getScoreLabel = (score: number) => score >= 90 ? '优秀' : score >= 70 ? '良好' : score >= 50 ? '一般' : '需改善';

  return (
    <div className="module-page compliance-check-page">
      <header className="module-page-header">
        <div>
          <span className="section-kicker">COMPLIANCE</span>
          <h2>合规检查</h2>
          <p>检查投标文件的格式、资质、时间节点、保证金等合规要求，并把问题回写到交付检查。</p>
        </div>
      </header>

      <section className="module-panel module-form-panel">
        <strong className="module-section-title">投标信息（手动填写，辅助检查）</strong>
        <div className="module-form-grid">
          <label className="module-field">
            <span>项目名称</span>
            <input value={projectName} onChange={(e) => setProjectName(e.target.value)} placeholder="招标项目名称" />
          </label>
          <label className="module-field">
            <span>投标截止日期</span>
            <input type="datetime-local" value={deadline} onChange={(e) => setDeadline(e.target.value)} />
          </label>
          <label className="module-field">
            <span>保证金金额</span>
            <input value={guaranteeAmount} onChange={(e) => setGuaranteeAmount(e.target.value)} placeholder="如：50000元" />
          </label>
          <label className="module-field">
            <span>正副本份数</span>
            <input value={copyCount} onChange={(e) => setCopyCount(e.target.value)} placeholder="正本1份，副本3份" />
          </label>
        </div>
        <div className="module-checkbox-row">
          <label>
            <input type="checkbox" checked={hasElectronicSeal} onChange={(e) => setHasElectronicSeal(e.target.checked)} />
            已加盖电子签章
          </label>
          <label>
            <input type="checkbox" checked={hasPaperSeal} onChange={(e) => setHasPaperSeal(e.target.checked)} />
            已加盖公章（纸质）
          </label>
        </div>
        <div>
          <button type="button" className="primary-action module-action" onClick={handleCheck} disabled={loading}>
            {loading ? '检查中...' : '开始合规检查'}
          </button>
        </div>
      </section>

      {error && <div className="module-error-banner">{error}</div>}

      {report && (
        <div className="module-stack">
          <section className="module-panel module-score-overview">
            <div className="module-score-value">
              <strong style={{ color: getScoreColor(report.score) }}>{report.score}</strong>
              <span style={{ color: getScoreColor(report.score) }}>{getScoreLabel(report.score)}</span>
            </div>
            <div className="module-score-stats">
              <span>通过 <strong>{report.summary.passed}</strong></span>
              <span>失败 <strong style={{ color: '#ef4444' }}>{report.summary.failed}</strong></span>
              <span>警告 <strong style={{ color: '#eab308' }}>{report.summary.warning}</strong></span>
              <span>提示 <strong style={{ color: '#3b82f6' }}>{report.summary.info}</strong></span>
            </div>
          </section>

          {report.recommendations?.length > 0 && (
            <section className="module-panel">
              <strong className="module-section-title">合规建议</strong>
              <div className="module-card-list">
                {report.recommendations.map((rec, i) => {
                  const color = severityColors[rec.type as keyof typeof severityColors] || severityColors.info;
                  return (
                    <article className="module-soft-card" key={i} style={{ background: color.bg, borderColor: color.border }}>
                      <strong style={{ color: color.text }}>{rec.title}</strong>
                      <p>{rec.content}</p>
                    </article>
                  );
                })}
              </div>
            </section>
          )}

          {report.categories?.length > 0 && (
            <section className="module-panel">
              <strong className="module-section-title">检查详情</strong>
              <div className="module-card-list">
                {report.categories.map((category) => {
                  const isOpen = selectedCategory === category.id;
                  return (
                    <article className="module-accordion" key={category.id}>
                      <button type="button" className="module-accordion-trigger" onClick={() => setSelectedCategory(isOpen ? null : category.id)}>
                        <strong>{category.name}</strong>
                        <span>通过 {category.passedCount} / 失败 {category.failedCount} / 警告 {category.warningCount} {isOpen ? '▲' : '▼'}</span>
                      </button>
                      {isOpen && (
                        <div className="module-accordion-content">
                          {category.rules?.map((rule, index) => (
                            <div className="module-soft-card" key={index}>
                              <strong>{statusIcons[rule.status as keyof typeof statusIcons] || '提示'}：{rule.name}</strong>
                              {rule.message && <p>{rule.message}</p>}
                            </div>
                          ))}
                        </div>
                      )}
                    </article>
                  );
                })}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
