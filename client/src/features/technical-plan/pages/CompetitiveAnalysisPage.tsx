import { useState } from 'react';
import type { CompetitiveAnalysisReport } from '../../../shared/types';
import type { ScoringAnalysisResult } from '../types';

interface CompetitiveAnalysisPageProps {
  scoringAnalysis?: ScoringAnalysisResult;
  industryCode?: string;
  projectInfo?: Record<string, unknown>;
}

const INDUSTRY_OPTIONS = [
  { code: 'it_information', name: 'IT/信息化' },
  { code: 'construction', name: '建筑工程' },
  { code: 'medical', name: '医疗健康' },
  { code: 'education', name: '教育服务' },
  { code: 'manufacturing', name: '制造业' },
  { code: 'logistics', name: '物流运输' },
  { code: 'consulting', name: '咨询服务' },
  { code: 'general', name: '通用行业' },
];

const priorityColors = {
  critical: { bg: 'rgba(239, 68, 68, 0.1)', border: 'rgba(239, 68, 68, 0.3)', text: '#ef4444' },
  strategy: { bg: 'rgba(234, 179, 8, 0.1)', border: 'rgba(234, 179, 8, 0.3)', text: '#eab308' },
  warning: { bg: 'rgba(249, 115, 22, 0.1)', border: 'rgba(249, 115, 22, 0.3)', text: '#f97316' },
  info: { bg: 'rgba(59, 130, 246, 0.1)', border: 'rgba(59, 130, 246, 0.3)', text: '#3b82f6' },
};

const priorityLabels = {
  high: { label: '高', color: '#ef4444' },
  medium: { label: '中', color: '#eab308' },
  low: { label: '低', color: '#6b7280' },
};

export default function CompetitiveAnalysisPage({ scoringAnalysis, industryCode, projectInfo }: CompetitiveAnalysisPageProps) {
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState<CompetitiveAnalysisReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<number | null>(null);
  const [selectedIndustry, setSelectedIndustry] = useState(industryCode || 'general');

  const handleGenerate = async () => {
    if (!scoringAnalysis) {
      setError('请先完成评分分析');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const result = await window.yibiao?.competitiveAnalysis.generate({
        scoringAnalysis,
        industryCode: selectedIndustry,
        projectInfo,
      });

      if (result?.success && result.report) {
        setReport(result.report);
      } else {
        setError(result?.message || '生成报告失败');
      }
    } catch (err) {
      setError(`生成报告失败: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setLoading(false);
    }
  };

  if (!scoringAnalysis) {
    return (
      <div className="competitive-analysis-empty">
        <p>请先完成智能评分分析，然后再生成竞品分析报告。</p>
      </div>
    );
  }

  return (
    <div className="competitive-analysis-page">
      <div className="competitive-analysis-header">
        <h2>竞品分析</h2>
        <p className="competitive-analysis-description">
          基于评分要求和行业知识，分析竞争策略和关键得分领域
        </p>
        <div className="industry-selector">
          <label htmlFor="industry-select">行业类型：</label>
          <select
            id="industry-select"
            value={selectedIndustry}
            onChange={(e) => setSelectedIndustry(e.target.value)}
          >
            {INDUSTRY_OPTIONS.map((option) => (
              <option key={option.code} value={option.code}>
                {option.name}
              </option>
            ))}
          </select>
        </div>
        <button
          type="button"
          className="primary-action"
          onClick={handleGenerate}
          disabled={loading}
        >
          {loading ? '正在生成...' : '生成竞品分析报告'}
        </button>
      </div>

      {error && (
        <div className="competitive-analysis-error">
          {error}
        </div>
      )}

      {report && (
        <div className="competitive-analysis-content">
          {/* 评分概览 */}
          <section className="analysis-section">
            <h3>评分概览</h3>
            <div className="scoring-overview-grid">
              <div className="overview-card">
                <span className="overview-value">{report.scoringOverview.totalScore}</span>
                <span className="overview-label">总分</span>
              </div>
              <div className="overview-card">
                <span className="overview-value">{report.scoringOverview.itemCount}</span>
                <span className="overview-label">评分项</span>
              </div>
              <div className="overview-card high">
                <span className="overview-value">{report.scoringOverview.highPriorityCount}</span>
                <span className="overview-label">高权重项</span>
              </div>
              <div className="overview-card medium">
                <span className="overview-value">{report.scoringOverview.mediumPriorityCount}</span>
                <span className="overview-label">中权重项</span>
              </div>
              <div className="overview-card low">
                <span className="overview-value">{report.scoringOverview.lowPriorityCount}</span>
                <span className="overview-label">低权重项</span>
              </div>
            </div>
          </section>

          {/* 核心推荐 */}
          <section className="analysis-section">
            <h3>核心推荐</h3>
            <div className="recommendations-grid">
              {report.recommendations.map((rec, index) => {
                const colors = priorityColors[rec.type];
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
                      <span className="recommendation-icon" style={{ color: colors.text }}>
                        {rec.type === 'critical' ? '🔴' : rec.type === 'strategy' ? '🟡' : rec.type === 'warning' ? '⚠️' : 'ℹ️'}
                      </span>
                      <span className="recommendation-title" style={{ color: colors.text }}>
                        {rec.title}
                      </span>
                    </div>
                    <p className="recommendation-content">{rec.content}</p>
                  </div>
                );
              })}
            </div>
          </section>

          {/* 竞争策略详情 */}
          <section className="analysis-section">
            <h3>竞争策略详情</h3>
            <div className="strategy-grid">
              {report.competitiveStrategies.map((strategy, index) => (
                <div
                  key={index}
                  className={`strategy-card ${selectedCategory === index ? 'selected' : ''}`}
                  onClick={() => setSelectedCategory(selectedCategory === index ? null : index)}
                >
                  <div className="strategy-header">
                    <span className="strategy-category">{strategy.category}</span>
                    <span className="strategy-weight">权重 {strategy.weight}%</span>
                    <span
                      className="strategy-priority"
                      style={{ color: priorityLabels[strategy.priority].color }}
                    >
                      {priorityLabels[strategy.priority].label}
                    </span>
                  </div>

                  {selectedCategory === index && (
                    <div className="strategy-details">
                      {strategy.focusAreas.length > 0 && (
                        <div className="strategy-detail-section">
                          <h4>重点方向</h4>
                          <ul>
                            {strategy.focusAreas.map((area, i) => (
                              <li key={i}>{area}</li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {strategy.differentiators.length > 0 && (
                        <div className="strategy-detail-section">
                          <h4>差异化建议</h4>
                          <ul>
                            {strategy.differentiators.map((diff, i) => (
                              <li key={i}>{diff}</li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {strategy.risks.length > 0 && (
                        <div className="strategy-detail-section">
                          <h4>风险提醒</h4>
                          <ul>
                            {strategy.risks.map((risk, i) => (
                              <li key={i}>{risk}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </section>

          {/* 行业洞察 */}
          {report.industryInsights && (
            <section className="analysis-section">
              <h3>行业洞察</h3>
              <div className="industry-insights">
                {report.industryInsights.keyMetrics && (
                  <div className="insight-group">
                    <h4>关键指标</h4>
                    <div className="metrics-list">
                      {report.industryInsights.keyMetrics.map((metric, i) => (
                        <span key={i} className="metric-tag">{metric}</span>
                      ))}
                    </div>
                  </div>
                )}

                {report.industryInsights.commonPitfalls && (
                  <div className="insight-group">
                    <h4>常见陷阱</h4>
                    <ul>
                      {report.industryInsights.commonPitfalls.map((pitfall, i) => (
                        <li key={i}>{pitfall}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
