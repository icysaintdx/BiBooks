import { useEffect, useState } from 'react';
import type { CompetitiveAnalysisReport, ProjectAnalysisRecord } from '../../../shared/types';

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
  critical: { bg: 'rgba(239,68,68,0.1)', border: 'rgba(239,68,68,0.3)', text: '#ef4444' },
  strategy: { bg: 'rgba(234,179,8,0.1)', border: 'rgba(234,179,8,0.3)', text: '#eab308' },
  warning: { bg: 'rgba(249,115,22,0.1)', border: 'rgba(249,115,22,0.3)', text: '#f97316' },
  info: { bg: 'rgba(59,130,246,0.1)', border: 'rgba(59,130,246,0.3)', text: '#3b82f6' },
};

const priorityLabels = {
  high: { label: '高', color: '#ef4444' },
  medium: { label: '中', color: '#eab308' },
  low: { label: '低', color: '#6b7280' },
};

export default function CompetitiveAnalysisStandalonePage() {
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState<CompetitiveAnalysisReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<number | null>(null);
  const [selectedIndustry, setSelectedIndustry] = useState('general');
  const [projectName, setProjectName] = useState('');
  const [scoringText, setScoringText] = useState('');

  useEffect(() => {
    void window.yibiao?.projectWorkspace.list()
      .then((state) => {
        const currentProject = (state.projects || []).find((project) => project.id === state.currentProjectId);
        if (currentProject?.name) setProjectName((value) => value || currentProject.name);
      })
      .catch(() => undefined);

    void window.yibiao?.competitiveAnalysis.getLatest()
      .then((record: ProjectAnalysisRecord<CompetitiveAnalysisReport> | null) => {
        if (!record?.result) return;
        const input = (record.input || {}) as {
          industryCode?: string;
          projectInfo?: { projectName?: string };
          scoringAnalysis?: { rawText?: string };
        };
        setReport(record.result);
        if (input.industryCode) setSelectedIndustry(input.industryCode);
        if (input.projectInfo?.projectName) setProjectName(input.projectInfo.projectName);
        if (input.scoringAnalysis?.rawText) setScoringText(input.scoringAnalysis.rawText);
      })
      .catch(() => undefined);
  }, []);

  const handleGenerate = async () => {
    setLoading(true);
    setError(null);
    try {
      const scoringAnalysis = scoringText.trim()
        ? { rawText: scoringText, items: [], totalScore: 100, analysisDate: new Date().toISOString() }
        : null;

      const result = await window.yibiao?.competitiveAnalysis.generate({
        scoringAnalysis,
        industryCode: selectedIndustry,
        projectInfo: { projectName },
      });

      if (result?.success && result.report) {
        setReport(result.report as CompetitiveAnalysisReport);
      } else {
        setError(result?.message || '竞争分析生成失败');
      }
    } catch (err) {
      setError(`生成失败: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="module-page competitive-analysis-page">
      <header className="module-page-header">
        <div>
          <span className="section-kicker">COMPETITION</span>
          <h2>竞争分析</h2>
          <p>基于行业评分权重、项目特点和评分细则，生成竞争策略与差异化建议。</p>
        </div>
      </header>

      <section className="module-panel module-form-panel">
        <div className="module-form-row">
          <label className="module-field">
            <span>行业</span>
            <select value={selectedIndustry} onChange={(e) => setSelectedIndustry(e.target.value)}>
              {INDUSTRY_OPTIONS.map((o) => <option key={o.code} value={o.code}>{o.name}</option>)}
            </select>
          </label>
          <label className="module-field" style={{ flex: 1 }}>
            <span>项目名称（可选）</span>
            <input value={projectName} onChange={(e) => setProjectName(e.target.value)} placeholder="输入项目名称" />
          </label>
          <button type="button" className="primary-action module-action" onClick={handleGenerate} disabled={loading}>
            {loading ? '生成中...' : '生成竞争分析'}
          </button>
        </div>
        <label className="module-field">
          <span>评分项内容（可选，粘贴招标评分表文本）</span>
          <textarea
            value={scoringText}
            onChange={(e) => setScoringText(e.target.value)}
            rows={4}
            placeholder="如有招标文件评分细则，粘贴于此以获得更精准的分析..."
          />
        </label>
      </section>

      {error && <div className="module-error-banner">{error}</div>}

      {report && (
        <div className="module-stack">
          {report.recommendations?.length > 0 && (
            <section className="module-panel">
              <strong className="module-section-title">核心推荐</strong>
              <div className="module-card-list">
                {report.recommendations.map((rec, i) => {
                  const c = priorityColors[rec.type as keyof typeof priorityColors] || priorityColors.info;
                  return (
                    <article className="module-soft-card" key={i} style={{ background: c.bg, borderColor: c.border }}>
                      <strong style={{ color: c.text }}>{rec.title}</strong>
                      <p>{rec.content}</p>
                    </article>
                  );
                })}
              </div>
            </section>
          )}

          {report.competitiveStrategies?.length > 0 && (
            <section className="module-panel">
              <strong className="module-section-title">竞争策略详情</strong>
              <div className="module-card-list">
                {report.competitiveStrategies.map((strategy, i) => {
                  const priority = priorityLabels[strategy.priority as keyof typeof priorityLabels] || priorityLabels.low;
                  const isOpen = selectedCategory === i;
                  return (
                    <article className="module-accordion" key={i}>
                      <button type="button" className="module-accordion-trigger" onClick={() => setSelectedCategory(isOpen ? null : i)}>
                        <strong>{strategy.category}</strong>
                        <span style={{ color: priority.color }}>优先级：{priority.label} {isOpen ? '▲' : '▼'}</span>
                      </button>
                      {isOpen && (
                        <div className="module-accordion-content">
                          {strategy.focusAreas?.length > 0 && <div><strong>关注领域：</strong>{strategy.focusAreas.join('、')}</div>}
                          {strategy.differentiators?.length > 0 && <div><strong>差异化：</strong>{strategy.differentiators.join('、')}</div>}
                          {strategy.risks?.length > 0 && <div><strong>风险：</strong><span style={{ color: '#ef4444' }}>{strategy.risks.join('、')}</span></div>}
                        </div>
                      )}
                    </article>
                  );
                })}
              </div>
            </section>
          )}

          {report.industryInsights && (
            <section className="module-panel">
              <strong className="module-section-title">行业洞察</strong>
              {report.industryInsights.keyMetrics?.length > 0 && (
                <div>
                  <div className="module-field"><span>关键指标</span></div>
                  <div className="module-tag-list">
                    {report.industryInsights.keyMetrics.map((metric, i) => <span className="module-tag" key={i}>{metric}</span>)}
                  </div>
                </div>
              )}
              {report.industryInsights.commonPitfalls?.length > 0 && (
                <div>
                  <div className="module-field" style={{ marginTop: 12 }}><span>常见误区</span></div>
                  <ul className="quiet-list" style={{ marginTop: 8 }}>
                    {report.industryInsights.commonPitfalls.map((pitfall, i) => <li key={i}>{pitfall}</li>)}
                  </ul>
                </div>
              )}
            </section>
          )}
        </div>
      )}
    </div>
  );
}
