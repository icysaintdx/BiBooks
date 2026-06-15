import { useState } from 'react';
import type { CompetitiveAnalysisReport } from '../../../shared/types';

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

const priorityLabels = { high: { label: '高', color: '#ef4444' }, medium: { label: '中', color: '#eab308' }, low: { label: '低', color: '#6b7280' } };

export default function CompetitiveAnalysisStandalonePage() {
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState<CompetitiveAnalysisReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<number | null>(null);
  const [selectedIndustry, setSelectedIndustry] = useState('general');
  const [projectName, setProjectName] = useState('');
  const [scoringText, setScoringText] = useState('');

  const handleGenerate = async () => {
    setLoading(true);
    setError(null);
    try {
      // 构建最小化评分分析结构（从文本输入解析，或用空对象）
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
    <div style={{ padding: 24, maxWidth: 960, margin: '0 auto' }}>
      <h2 style={{ marginBottom: 8 }}>竞争分析</h2>
      <p style={{ color: '#666', fontSize: 14, marginBottom: 24 }}>基于行业评分权重生成竞争策略与差异化建议</p>

      <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span style={{ fontSize: 13, color: '#666' }}>行业</span>
          <select
            value={selectedIndustry}
            onChange={(e) => setSelectedIndustry(e.target.value)}
            style={{ padding: '7px 12px', border: '1px solid #ddd', borderRadius: 6, fontSize: 13 }}
          >
            {INDUSTRY_OPTIONS.map((o) => <option key={o.code} value={o.code}>{o.name}</option>)}
          </select>
        </label>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: 1, minWidth: 200 }}>
          <span style={{ fontSize: 13, color: '#666' }}>项目名称（可选）</span>
          <input
            value={projectName}
            onChange={(e) => setProjectName(e.target.value)}
            placeholder="输入项目名称"
            style={{ padding: '7px 12px', border: '1px solid #ddd', borderRadius: 6, fontSize: 13 }}
          />
        </label>
        <button
          onClick={handleGenerate}
          disabled={loading}
          style={{ padding: '8px 20px', background: '#1677ff', color: '#fff', border: 'none', borderRadius: 6, cursor: loading ? 'default' : 'pointer', opacity: loading ? 0.6 : 1 }}
        >
          {loading ? '生成中...' : '生成竞争分析'}
        </button>
      </div>

      <label style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 20 }}>
        <span style={{ fontSize: 13, color: '#666' }}>评分项内容（可选，粘贴招标评分表文本）</span>
        <textarea
          value={scoringText}
          onChange={(e) => setScoringText(e.target.value)}
          rows={4}
          placeholder="如有招标文件评分细则，粘贴于此以获得更精准的分析..."
          style={{ padding: '8px 12px', border: '1px solid #ddd', borderRadius: 6, fontSize: 13, resize: 'vertical' }}
        />
      </label>

      {error && <div style={{ padding: 12, background: '#fff1f0', border: '1px solid #ffa39e', borderRadius: 6, color: '#cf1322', marginBottom: 16 }}>{error}</div>}

      {report && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* 核心推荐 */}
          {report.recommendations?.length > 0 && (
            <div style={{ padding: 16, border: '1px solid #e8e8e8', borderRadius: 8 }}>
              <strong style={{ display: 'block', marginBottom: 12 }}>核心推荐</strong>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {report.recommendations.map((rec, i) => {
                  const c = priorityColors[rec.type as keyof typeof priorityColors] || priorityColors.info;
                  return (
                    <div key={i} style={{ padding: '10px 14px', background: c.bg, border: `1px solid ${c.border}`, borderRadius: 6 }}>
                      <div style={{ fontWeight: 600, color: c.text, marginBottom: 4, fontSize: 14 }}>{rec.title}</div>
                      <div style={{ fontSize: 13, color: '#555' }}>{rec.content}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* 竞争策略 */}
          {report.competitiveStrategies?.length > 0 && (
            <div style={{ padding: 16, border: '1px solid #e8e8e8', borderRadius: 8 }}>
              <strong style={{ display: 'block', marginBottom: 12 }}>竞争策略详情</strong>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {report.competitiveStrategies.map((s, i) => {
                  const pl = priorityLabels[s.priority as keyof typeof priorityLabels] || priorityLabels.low;
                  const isOpen = selectedCategory === i;
                  return (
                    <div key={i} style={{ border: '1px solid #e8e8e8', borderRadius: 6, overflow: 'hidden' }}>
                      <button
                        onClick={() => setSelectedCategory(isOpen ? null : i)}
                        style={{ width: '100%', padding: '10px 14px', display: 'flex', justifyContent: 'space-between', background: '#fafafa', border: 'none', cursor: 'pointer', fontSize: 13 }}
                      >
                        <span style={{ fontWeight: 600 }}>{s.category}</span>
                        <span style={{ color: pl.color, fontSize: 12 }}>优先级：{pl.label} {isOpen ? '▲' : '▼'}</span>
                      </button>
                      {isOpen && (
                        <div style={{ padding: '10px 14px', fontSize: 13, display: 'flex', flexDirection: 'column', gap: 8 }}>
                          {s.focusAreas?.length > 0 && <div><strong>关注领域：</strong>{s.focusAreas.join('、')}</div>}
                          {s.differentiators?.length > 0 && <div><strong>差异化：</strong>{s.differentiators.join('、')}</div>}
                          {s.risks?.length > 0 && <div><strong>风险：</strong><span style={{ color: '#ef4444' }}>{s.risks.join('、')}</span></div>}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* 行业洞察 */}
          {report.industryInsights && (
            <div style={{ padding: 16, border: '1px solid #e8e8e8', borderRadius: 8 }}>
              <strong style={{ display: 'block', marginBottom: 12 }}>行业洞察</strong>
              {report.industryInsights.keyMetrics?.length > 0 && (
                <div style={{ marginBottom: 8 }}>
                  <div style={{ fontSize: 13, color: '#666', marginBottom: 4 }}>关键指标</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {report.industryInsights.keyMetrics.map((m, i) => (
                      <span key={i} style={{ padding: '3px 10px', background: '#e6f4ff', border: '1px solid #91caff', borderRadius: 12, fontSize: 12, color: '#1677ff' }}>{m}</span>
                    ))}
                  </div>
                </div>
              )}
              {report.industryInsights.commonPitfalls?.length > 0 && (
                <div>
                  <div style={{ fontSize: 13, color: '#666', marginBottom: 4 }}>常见误区</div>
                  <ul style={{ margin: 0, paddingLeft: 20, fontSize: 13, color: '#555' }}>
                    {report.industryInsights.commonPitfalls.map((p, i) => <li key={i}>{p}</li>)}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
