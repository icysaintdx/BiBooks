import { useState } from 'react';
import type { ComplianceCheckReport, ComplianceCheckResult } from '../../../shared/types';
import type { TechnicalPlanState } from '../types';

interface ComplianceCheckPageProps {
  bidAnalysis?: TechnicalPlanState['bidAnalysisTasks'];
  technicalPlan?: Partial<TechnicalPlanState>;
}

const severityColors = {
  critical: { bg: 'rgba(239, 68, 68, 0.1)', border: 'rgba(239, 68, 68, 0.3)', text: '#ef4444' },
  major: { bg: 'rgba(249, 115, 22, 0.1)', border: 'rgba(249, 115, 22, 0.3)', text: '#f97316' },
  warning: { bg: 'rgba(234, 179, 8, 0.1)', border: 'rgba(234, 179, 8, 0.3)', text: '#eab308' },
  info: { bg: 'rgba(59, 130, 246, 0.1)', border: 'rgba(59, 130, 246, 0.3)', text: '#3b82f6' },
};

const statusIcons = {
  passed: '✅',
  failed: '❌',
  warning: '⚠️',
  info: 'ℹ️',
};

export default function ComplianceCheckPage({ bidAnalysis, technicalPlan }: ComplianceCheckPageProps) {
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState<ComplianceCheckReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  const handleCheck = async () => {
    setLoading(true);
    setError(null);

    try {
      const result = await window.yibiao?.complianceCheck.check({
        bidAnalysis,
        technicalPlan,
      });

      if (result?.success && result.report) {
        setReport(result.report);
      } else {
        setError(result?.message || '合规检查失败');
      }
    } catch (err) {
      setError(`合规检查失败: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setLoading(false);
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 90) return '#22c55e';
    if (score >= 70) return '#eab308';
    if (score >= 50) return '#f97316';
    return '#ef4444';
  };

  const getScoreLabel = (score: number) => {
    if (score >= 90) return '优秀';
    if (score >= 70) return '良好';
    if (score >= 50) return '一般';
    return '需要改进';
  };

  return (
    <div className="compliance-check-page">
      <div className="compliance-check-header">
        <h2>合规性检查</h2>
        <p className="compliance-check-description">
          检查投标文件是否符合招投标法规要求，包括格式合规、资质要求、时间节点、保证金等检查项
        </p>
        <button
          type="button"
          className="primary-action"
          onClick={handleCheck}
          disabled={loading}
        >
          {loading ? '正在检查...' : '开始合规检查'}
        </button>
      </div>

      {error && (
        <div className="compliance-check-error">
          {error}
        </div>
      )}

      {report && (
        <div className="compliance-check-content">
          {/* 合规分数 */}
          <section className="compliance-score-section">
            <div className="score-card">
              <div className="score-circle" style={{ borderColor: getScoreColor(report.score) }}>
                <span className="score-value" style={{ color: getScoreColor(report.score) }}>
                  {report.score}
                </span>
                <span className="score-label">分</span>
              </div>
              <div className="score-info">
                <span className="score-grade" style={{ color: getScoreColor(report.score) }}>
                  {getScoreLabel(report.score)}
                </span>
                <span className="score-summary">
                  共 {report.summary.total} 项检查，
                  通过 {report.summary.passed} 项，
                  未通过 {report.summary.failed} 项，
                  警告 {report.summary.warning} 项
                </span>
              </div>
            </div>
          </section>

          {/* 合规建议 */}
          {report.recommendations.length > 0 && (
            <section className="compliance-section">
              <h3>合规建议</h3>
              <div className="recommendations-list">
                {report.recommendations.map((rec, index) => {
                  const colors = rec.type === 'critical' ? severityColors.critical
                    : rec.type === 'warning' ? severityColors.major
                    : rec.type === 'info' ? severityColors.warning
                    : severityColors.info;
                  const icon = rec.type === 'critical' ? '🔴'
                    : rec.type === 'warning' ? '🟠'
                    : rec.type === 'info' ? '🟡'
                    : '💡';

                  return (
                    <div
                      key={index}
                      className="recommendation-card"
                      style={{
                        backgroundColor: colors.bg,
                        borderColor: colors.border,
                      }}
                    >
                      <div className="recommendation-header">
                        <span className="recommendation-icon">{icon}</span>
                        <span className="recommendation-title" style={{ color: colors.text }}>
                          {rec.title}
                        </span>
                      </div>
                      <p className="recommendation-content">{rec.content}</p>
                      {rec.items.length > 0 && (
                        <ul className="recommendation-items">
                          {rec.items.map((item, i) => (
                            <li key={i}>{item}</li>
                          ))}
                        </ul>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {/* 检查类别 */}
          <section className="compliance-section">
            <h3>检查详情</h3>
            <div className="category-grid">
              {report.categories.map((category) => (
                <div
                  key={category.id}
                  className={`category-card ${selectedCategory === category.id ? 'selected' : ''}`}
                  onClick={() => setSelectedCategory(selectedCategory === category.id ? null : category.id)}
                >
                  <div className="category-header">
                    <span className="category-name">{category.name}</span>
                    <div className="category-stats">
                      <span className="stat passed">{category.passedCount} 通过</span>
                      <span className="stat failed">{category.failedCount} 未通过</span>
                      <span className="stat warning">{category.warningCount} 警告</span>
                    </div>
                  </div>

                  {selectedCategory === category.id && (
                    <div className="category-details">
                      {category.rules.map((rule) => (
                        <div key={rule.id} className="rule-item">
                          <div className="rule-header">
                            <span className="rule-status">{statusIcons[rule.status]}</span>
                            <span className="rule-name">{rule.name}</span>
                            <span
                              className="rule-severity"
                              style={{ color: severityColors[rule.severity].text }}
                            >
                              {rule.severity === 'critical' ? '严重' : rule.severity === 'major' ? '重要' : rule.severity === 'warning' ? '警告' : '提示'}
                            </span>
                          </div>
                          <p className="rule-message">{rule.message}</p>
                          {rule.details.length > 0 && (
                            <ul className="rule-details">
                              {rule.details.map((detail, i) => (
                                <li key={i}>{detail}</li>
                              ))}
                            </ul>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
