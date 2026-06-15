import { useState } from 'react';
import type { ComplianceCheckReport } from '../../../shared/types';

const severityColors = {
  critical: { bg: 'rgba(239,68,68,0.1)', border: 'rgba(239,68,68,0.3)', text: '#ef4444' },
  major: { bg: 'rgba(249,115,22,0.1)', border: 'rgba(249,115,22,0.3)', text: '#f97316' },
  warning: { bg: 'rgba(234,179,8,0.1)', border: 'rgba(234,179,8,0.3)', text: '#eab308' },
  info: { bg: 'rgba(59,130,246,0.1)', border: 'rgba(59,130,246,0.3)', text: '#3b82f6' },
};

const statusIcons = { passed: '✅', failed: '❌', warning: '⚠️', info: 'ℹ️' };

export default function ComplianceCheckStandalonePage() {
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState<ComplianceCheckReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  // 手动补充合规信息
  const [projectName, setProjectName] = useState('');
  const [deadline, setDeadline] = useState('');
  const [guaranteeAmount, setGuaranteeAmount] = useState('');
  const [hasElectronicSeal, setHasElectronicSeal] = useState(true);
  const [hasPaperSeal, setHasPaperSeal] = useState(true);
  const [copyCount, setCopyCount] = useState('正本1份，副本3份');

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
    <div style={{ padding: 24, maxWidth: 960, margin: '0 auto' }}>
      <h2 style={{ marginBottom: 8 }}>合规检查</h2>
      <p style={{ color: '#666', fontSize: 14, marginBottom: 24 }}>检查投标文件的格式、资质、时间节点、保证金等合规要求</p>

      {/* 手动补充信息表单 */}
      <div style={{ padding: 16, border: '1px solid #e8e8e8', borderRadius: 8, marginBottom: 20 }}>
        <strong style={{ display: 'block', marginBottom: 12, fontSize: 14 }}>投标信息（手动填写，辅助检查）</strong>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px 20px', marginBottom: 12 }}>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={{ fontSize: 13, color: '#666' }}>项目名称</span>
            <input value={projectName} onChange={(e) => setProjectName(e.target.value)} placeholder="招标项目名称" style={{ padding: '7px 10px', border: '1px solid #ddd', borderRadius: 5, fontSize: 13 }} />
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={{ fontSize: 13, color: '#666' }}>投标截止日期</span>
            <input type="datetime-local" value={deadline} onChange={(e) => setDeadline(e.target.value)} style={{ padding: '7px 10px', border: '1px solid #ddd', borderRadius: 5, fontSize: 13 }} />
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={{ fontSize: 13, color: '#666' }}>保证金金额</span>
            <input value={guaranteeAmount} onChange={(e) => setGuaranteeAmount(e.target.value)} placeholder="如：50000元" style={{ padding: '7px 10px', border: '1px solid #ddd', borderRadius: 5, fontSize: 13 }} />
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={{ fontSize: 13, color: '#666' }}>正副本份数</span>
            <input value={copyCount} onChange={(e) => setCopyCount(e.target.value)} placeholder="正本1份，副本3份" style={{ padding: '7px 10px', border: '1px solid #ddd', borderRadius: 5, fontSize: 13 }} />
          </label>
        </div>
        <div style={{ display: 'flex', gap: 20, fontSize: 13 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
            <input type="checkbox" checked={hasElectronicSeal} onChange={(e) => setHasElectronicSeal(e.target.checked)} />
            已加盖电子签章
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
            <input type="checkbox" checked={hasPaperSeal} onChange={(e) => setHasPaperSeal(e.target.checked)} />
            已加盖公章（纸质）
          </label>
        </div>
      </div>

      <button
        onClick={handleCheck}
        disabled={loading}
        style={{ padding: '8px 24px', background: '#1677ff', color: '#fff', border: 'none', borderRadius: 6, cursor: loading ? 'default' : 'pointer', opacity: loading ? 0.6 : 1, marginBottom: 20 }}
      >
        {loading ? '检查中...' : '开始合规检查'}
      </button>

      {error && <div style={{ padding: 12, background: '#fff1f0', border: '1px solid #ffa39e', borderRadius: 6, color: '#cf1322', marginBottom: 16 }}>{error}</div>}

      {report && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* 评分概览 */}
          <div style={{ padding: 16, border: '1px solid #e8e8e8', borderRadius: 8, display: 'flex', alignItems: 'center', gap: 24 }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 48, fontWeight: 700, color: getScoreColor(report.score), lineHeight: 1 }}>{report.score}</div>
              <div style={{ fontSize: 14, color: getScoreColor(report.score), marginTop: 4 }}>{getScoreLabel(report.score)}</div>
            </div>
            <div style={{ display: 'flex', gap: 16, fontSize: 14, flexWrap: 'wrap' }}>
              <span>✅ 通过 <strong>{report.summary.passed}</strong></span>
              <span>❌ 失败 <strong style={{ color: '#ef4444' }}>{report.summary.failed}</strong></span>
              <span>⚠️ 警告 <strong style={{ color: '#eab308' }}>{report.summary.warning}</strong></span>
              <span>ℹ️ 提示 <strong style={{ color: '#3b82f6' }}>{report.summary.info}</strong></span>
            </div>
          </div>

          {/* 合规建议 */}
          {report.recommendations?.length > 0 && (
            <div style={{ padding: 16, border: '1px solid #e8e8e8', borderRadius: 8 }}>
              <strong style={{ display: 'block', marginBottom: 12 }}>合规建议</strong>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {report.recommendations.map((rec, i) => {
                  const c = severityColors[rec.type as keyof typeof severityColors] || severityColors.info;
                  return (
                    <div key={i} style={{ padding: '10px 14px', background: c.bg, border: `1px solid ${c.border}`, borderRadius: 6, fontSize: 13 }}>
                      <div style={{ fontWeight: 600, color: c.text, marginBottom: 4 }}>{rec.title}</div>
                      <div style={{ color: '#555' }}>{rec.content}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* 分类详情 */}
          {report.categories?.length > 0 && (
            <div style={{ padding: 16, border: '1px solid #e8e8e8', borderRadius: 8 }}>
              <strong style={{ display: 'block', marginBottom: 12 }}>检查详情</strong>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {report.categories.map((cat) => {
                  const isOpen = selectedCategory === cat.id;
                  return (
                    <div key={cat.id} style={{ border: '1px solid #e8e8e8', borderRadius: 6, overflow: 'hidden' }}>
                      <button
                        onClick={() => setSelectedCategory(isOpen ? null : cat.id)}
                        style={{ width: '100%', padding: '10px 14px', display: 'flex', justifyContent: 'space-between', background: '#fafafa', border: 'none', cursor: 'pointer', fontSize: 13 }}
                      >
                        <span style={{ fontWeight: 600 }}>{cat.name}</span>
                        <span style={{ fontSize: 12, color: '#666' }}>
                          ✅{cat.passedCount} ❌{cat.failedCount} ⚠️{cat.warningCount} {isOpen ? '▲' : '▼'}
                        </span>
                      </button>
                      {isOpen && (
                        <div style={{ padding: '8px 14px', display: 'flex', flexDirection: 'column', gap: 6 }}>
                          {cat.rules?.map((r, i) => (
                            <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 13, padding: '6px 0', borderBottom: '1px solid #f0f0f0' }}>
                              <span>{statusIcons[r.status as keyof typeof statusIcons] || 'ℹ️'}</span>
                              <div>
                                <div style={{ fontWeight: 500 }}>{r.name}</div>
                                {r.message && <div style={{ color: '#666', marginTop: 2 }}>{r.message}</div>}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
