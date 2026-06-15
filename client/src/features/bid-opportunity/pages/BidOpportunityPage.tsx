import { useCallback, useEffect, useState } from 'react';
import { useToast } from '../../../shared/ui';

interface Opportunity {
  id: string;
  projectName: string;
  tenderNo: string;
  clientName: string;
  budget: number;
  deadline: string;
  source: string;
  description: string;
  status: string;
  decisionScore: number;
  decisionFactors: Record<string, { score: number; weight: number }>;
  notes: string[];
  createdAt: string;
  updatedAt: string;
}

interface DecisionFactor {
  id: string;
  name: string;
  description: string;
  weight: number;
}

interface TenderSource {
  id: string;
  name: string;
  url: string;
}

interface Recommendation {
  recommendation: string;
  confidence: number;
  reasons: string[];
  score: number;
}

const statusLabels: Record<string, string> = {
  discovered: '已发现',
  analyzing: '分析中',
  deciding: '决策中',
  bidding: '投标中',
  won: '中标',
  lost: '未中标',
  cancelled: '已取消',
  abandoned: '已放弃',
};

const statusColors: Record<string, string> = {
  discovered: '#1677ff',
  analyzing: '#722ed1',
  deciding: '#fa8c16',
  bidding: '#13c2c2',
  won: '#52c41a',
  lost: '#ff4d4f',
  cancelled: '#8c8c8c',
  abandoned: '#8c8c8c',
};

function formatMoney(amount: number) {
  if (amount >= 10000) return `${(amount / 10000).toFixed(1)}万`;
  return `${amount}元`;
}

type ViewMode = 'list' | 'kanban' | 'calendar';

function BidOpportunityPage() {
  const { showToast } = useToast();
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [selected, setSelected] = useState<Opportunity | null>(null);
  const [factors, setFactors] = useState<Record<string, DecisionFactor>>({});
  const [sources, setSources] = useState<TenderSource[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [recommendation, setRecommendation] = useState<Recommendation | null>(null);
  const [analysisScores, setAnalysisScores] = useState<Record<string, number>>({});
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [calendarData, setCalendarData] = useState<any>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const [factorsData, sourcesData, oppsData] = await Promise.all([
          window.yibiao?.bidOpportunity.getDecisionFactors(),
          window.yibiao?.bidOpportunity.getTenderSources(),
          window.yibiao?.bidOpportunity.list(),
        ]);
        if (factorsData) setFactors(factorsData as Record<string, DecisionFactor>);
        if (sourcesData) setSources(sourcesData as TenderSource[]);
        if (oppsData) setOpportunities(oppsData as Opportunity[]);
      } catch (error) {
        showToast(`加载配置失败: ${error instanceof Error ? error.message : String(error)}`, 'error');
      }
    };
    load();
  }, [showToast]);

  const handleCreate = useCallback(async (data: { projectName: string; tenderNo: string; clientName: string; budget: number; deadline: string; source: string; description: string }) => {
    try {
      const opp = await window.yibiao?.bidOpportunity.create(data) as Opportunity | undefined;
      if (opp) {
        setOpportunities((prev) => [opp, ...prev]);
        setSelected(opp);
        setShowCreate(false);
        showToast('投标机会已创建', 'success');
      }
    } catch (error) {
      showToast(`创建失败: ${error instanceof Error ? error.message : String(error)}`, 'error');
    }
  }, [showToast]);

  const handleAnalyze = useCallback(async () => {
    if (!selected) return;
    try {
      const result = await window.yibiao?.bidOpportunity.analyze(selected, {
        projectMatchScore: analysisScores.projectMatch ?? 50,
        competitionLevelScore: analysisScores.competitionLevel ?? 50,
        profitPotentialScore: analysisScores.profitPotential ?? 50,
        resourceAvailabilityScore: analysisScores.resourceAvailability ?? 50,
        clientRelationshipScore: analysisScores.clientRelationship ?? 50,
        riskLevelScore: analysisScores.riskLevel ?? 50,
      }) as Opportunity | undefined;
      if (result) {
        setSelected(result);
        setOpportunities((prev) => prev.map((o) => o.id === result.id ? result : o));
        const rec = await window.yibiao?.bidOpportunity.generateRecommendation(result) as Recommendation | undefined;
        if (rec) setRecommendation(rec);
        showToast('分析完成', 'success');
      }
    } catch (error) {
      showToast(`分析失败: ${error instanceof Error ? error.message : String(error)}`, 'error');
    }
  }, [selected, analysisScores, showToast]);

  const handleStatusChange = useCallback(async (newStatus: string) => {
    if (!selected) return;
    try {
      const updated = await window.yibiao?.bidOpportunity.updateStatus(selected, newStatus, '') as Opportunity | undefined;
      if (updated) {
        setSelected(updated);
        setOpportunities((prev) => prev.map((o) => o.id === updated.id ? updated : o));
        showToast(`状态已更新为「${statusLabels[newStatus] || newStatus}」`, 'success');
      }
    } catch (error) {
      showToast(`状态更新失败: ${error instanceof Error ? error.message : String(error)}`, 'error');
    }
  }, [selected, showToast]);

  const handleDelete = useCallback(async () => {
    if (!selected) return;
    if (!window.confirm(`确认删除「${selected.projectName}」？`)) return;
    try {
      await window.yibiao?.bidOpportunity.delete(selected.id);
      setOpportunities((prev) => prev.filter((o) => o.id !== selected.id));
      setSelected(null);
      showToast('已删除', 'success');
    } catch (error) {
      showToast(`删除失败: ${error instanceof Error ? error.message : String(error)}`, 'error');
    }
  }, [selected, showToast]);

  const [competitors, setCompetitors] = useState<Array<{ name: string; strengths: string; weaknesses: string; winRate: number }>>([]);
  const [competitionResult, setCompetitionResult] = useState<any>(null);

  const handleLoadCalendar = useCallback(async () => {
    try {
      const data = await window.yibiao?.bidOpportunity.generateCalendar(opportunities);
      setCalendarData(data);
    } catch (error) {
      showToast(`日历生成失败: ${error instanceof Error ? error.message : String(error)}`, 'error');
    }
  }, [opportunities, showToast]);

  const handleAnalyzeCompetition = useCallback(async () => {
    if (!selected) return;
    try {
      const result = await window.yibiao?.bidOpportunity.analyzeCompetition(
        selected,
        competitors.map((c) => ({ name: c.name, strengths: c.strengths.split('，').filter(Boolean), weaknesses: c.weaknesses.split('，').filter(Boolean), winRate: c.winRate }))
      );
      setCompetitionResult(result);
      showToast('竞争分析完成', 'success');
    } catch (error) {
      showToast(`竞争分析失败: ${error instanceof Error ? error.message : String(error)}`, 'error');
    }
  }, [selected, competitors, showToast]);

  return (
    <div style={{ padding: 24, maxWidth: 1100, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h2 style={{ margin: 0 }}>投标机会</h2>
          <p style={{ color: '#666', fontSize: 14, margin: '4px 0 0' }}>管理投标线索、评估决策因素、跟踪投标状态</p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {/* 视图切换 */}
          {(['list', 'kanban', 'calendar'] as ViewMode[]).map((m) => (
            <button
              key={m}
              onClick={() => { setViewMode(m); if (m === 'calendar') handleLoadCalendar(); }}
              style={{ padding: '6px 14px', fontSize: 13, border: `1px solid ${viewMode === m ? '#1677ff' : '#ddd'}`, borderRadius: 4, background: viewMode === m ? '#e6f4ff' : '#fff', color: viewMode === m ? '#1677ff' : '#666', cursor: 'pointer' }}
            >
              {{ list: '列表', kanban: '看板', calendar: '日历' }[m]}
            </button>
          ))}
          <button
            onClick={() => setShowCreate(true)}
            style={{ padding: '8px 16px', background: '#1677ff', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', marginLeft: 8 }}
          >
            新增机会
          </button>
        </div>
      </div>

      {/* 看板视图 */}
      {viewMode === 'kanban' && (
        <div style={{ display: 'flex', gap: 12, overflowX: 'auto', paddingBottom: 8 }}>
          {Object.entries(statusLabels).map(([status, label]) => {
            const colOpps = opportunities.filter((o) => o.status === status);
            return (
              <div key={status} style={{ minWidth: 200, flexShrink: 0, background: '#fafafa', borderRadius: 8, padding: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: statusColors[status], display: 'inline-block' }} />
                  <strong style={{ fontSize: 13 }}>{label}</strong>
                  <span style={{ fontSize: 11, color: '#999', marginLeft: 'auto' }}>{colOpps.length}</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {colOpps.map((opp) => (
                    <div
                      key={opp.id}
                      onClick={() => { setSelected(opp); setRecommendation(null); setViewMode('list'); }}
                      style={{ padding: 10, background: '#fff', borderRadius: 6, border: '1px solid #e8e8e8', cursor: 'pointer', fontSize: 13 }}
                    >
                      <div style={{ fontWeight: 600, marginBottom: 4 }}>{opp.projectName}</div>
                      <div style={{ color: '#666', fontSize: 11 }}>{opp.clientName || '未知客户'}</div>
                      {opp.budget > 0 && <div style={{ color: '#1677ff', fontSize: 11, marginTop: 2 }}>{formatMoney(opp.budget)}</div>}
                      {opp.deadline && <div style={{ color: '#fa8c16', fontSize: 11, marginTop: 2 }}>截止 {opp.deadline}</div>}
                    </div>
                  ))}
                  {colOpps.length === 0 && <div style={{ padding: '20px 0', textAlign: 'center', color: '#ccc', fontSize: 12 }}>无</div>}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 日历视图 */}
      {viewMode === 'calendar' && (
        <div>
          {!calendarData ? (
            <div style={{ padding: 40, textAlign: 'center', color: '#999' }}>日历加载中...</div>
          ) : (
            <div>
              {calendarData.months?.map((month: any, mi: number) => (
                <div key={mi} style={{ marginBottom: 20 }}>
                  <h4 style={{ marginBottom: 8, color: '#333' }}>{month.month}</h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {month.events?.map((ev: any, ei: number) => (
                      <div key={ei} style={{ display: 'flex', gap: 12, padding: '8px 12px', background: '#fafafa', borderRadius: 6, border: '1px solid #e8e8e8', fontSize: 13, alignItems: 'center' }}>
                        <span style={{ minWidth: 80, color: '#666' }}>{ev.date}</span>
                        <span style={{ padding: '2px 8px', borderRadius: 4, fontSize: 11, background: statusColors[ev.status] || '#8c8c8c', color: '#fff' }}>{statusLabels[ev.status] || ev.type}</span>
                        <span style={{ fontWeight: 500 }}>{ev.projectName}</span>
                        {ev.description && <span style={{ color: '#999', fontSize: 12 }}>{ev.description}</span>}
                      </div>
                    ))}
                    {(!month.events || month.events.length === 0) && <div style={{ color: '#ccc', fontSize: 13, padding: '4px 0' }}>无事件</div>}
                  </div>
                </div>
              ))}
              {calendarData.upcomingDeadlines?.length > 0 && (
                <div style={{ padding: 12, background: '#fff7e6', borderRadius: 8, border: '1px solid #ffd591' }}>
                  <strong style={{ fontSize: 13 }}>即将截止（7天内）</strong>
                  <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {calendarData.upcomingDeadlines.map((d: any, i: number) => (
                      <div key={i} style={{ fontSize: 13, display: 'flex', gap: 12 }}>
                        <span style={{ color: '#fa8c16' }}>{d.deadline}</span>
                        <span>{d.projectName}</span>
                        <span style={{ color: '#666' }}>剩余 {d.daysLeft} 天</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* 列表视图 */}
      {viewMode === 'list' && <div style={{ display: 'flex', gap: 20 }}>
        {/* 左侧列表 */}
        <div style={{ width: 320, flexShrink: 0 }}>
          {opportunities.length === 0 ? (
            <div style={{ padding: 40, textAlign: 'center', color: '#999', background: '#fafafa', borderRadius: 8 }}>
              暂无投标机会，点击"新增机会"创建
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {opportunities.map((opp) => (
                <div
                  key={opp.id}
                  onClick={() => { setSelected(opp); setRecommendation(null); }}
                  style={{
                    padding: 14,
                    border: `2px solid ${selected?.id === opp.id ? '#1677ff' : '#e8e8e8'}`,
                    borderRadius: 8,
                    cursor: 'pointer',
                    background: selected?.id === opp.id ? '#f0f5ff' : '#fff',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                    <strong style={{ fontSize: 14 }}>{opp.projectName}</strong>
                    <span style={{
                      padding: '2px 8px', borderRadius: 4, fontSize: 11,
                      background: statusColors[opp.status] || '#8c8c8c', color: '#fff',
                    }}>
                      {statusLabels[opp.status] || opp.status}
                    </span>
                  </div>
                  <div style={{ fontSize: 12, color: '#666', display: 'flex', gap: 12 }}>
                    <span>{opp.clientName || '未知客户'}</span>
                    {opp.budget > 0 && <span>{formatMoney(opp.budget)}</span>}
                    {opp.decisionScore > 0 && <span style={{ color: '#1677ff', fontWeight: 600 }}>{opp.decisionScore}分</span>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 右侧详情 */}
        <div style={{ flex: 1, minWidth: 0 }}>
          {!selected ? (
            <div style={{ padding: 60, textAlign: 'center', color: '#999', background: '#fafafa', borderRadius: 8 }}>
              选择左侧机会查看详情，或新增投标机会
            </div>
          ) : (
            <div>
              {/* 基本信息 */}
              <div style={{ padding: 16, border: '1px solid #e8e8e8', borderRadius: 8, marginBottom: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                  <h3 style={{ margin: 0 }}>{selected.projectName}</h3>
                  <button
                    onClick={handleDelete}
                    style={{ padding: '4px 12px', fontSize: 12, border: '1px solid #ff4d4f', borderRadius: 4, color: '#ff4d4f', background: '#fff', cursor: 'pointer' }}
                  >
                    删除
                  </button>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 24px', fontSize: 14 }}>
                  <span><strong>招标编号：</strong>{selected.tenderNo || '无'}</span>
                  <span><strong>客户：</strong>{selected.clientName || '无'}</span>
                  <span><strong>预算：</strong>{selected.budget > 0 ? formatMoney(selected.budget) : '未知'}</span>
                  <span><strong>截止日期：</strong>{selected.deadline || '无'}</span>
                  <span><strong>来源：</strong>{sources.find((s) => s.id === selected.source)?.name || selected.source}</span>
                  <span><strong>状态：</strong>{statusLabels[selected.status] || selected.status}</span>
                </div>
                {selected.description && (
                  <p style={{ marginTop: 12, fontSize: 13, color: '#666' }}>{selected.description}</p>
                )}
              </div>

              {/* 状态切换 */}
              <div style={{ marginBottom: 16, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {Object.entries(statusLabels).map(([key, label]) => (
                  <button
                    key={key}
                    onClick={() => handleStatusChange(key)}
                    disabled={selected.status === key}
                    style={{
                      padding: '4px 12px',
                      fontSize: 12,
                      border: '1px solid #ddd',
                      borderRadius: 4,
                      cursor: selected.status === key ? 'default' : 'pointer',
                      background: selected.status === key ? statusColors[key] : '#fff',
                      color: selected.status === key ? '#fff' : '#333',
                      opacity: selected.status === key ? 1 : 0.8,
                    }}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {/* 决策分析 */}
              <div style={{ padding: 16, border: '1px solid #e8e8e8', borderRadius: 8, marginBottom: 16 }}>
                <h4 style={{ marginBottom: 12 }}>决策因素评分</h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {Object.values(factors).map((factor) => (
                    <div key={factor.id} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <span style={{ width: 100, fontSize: 13, flexShrink: 0 }}>{factor.name}</span>
                      <input
                        type="range"
                        min={0}
                        max={100}
                        value={analysisScores[factor.id] ?? (selected.decisionFactors[factor.id]?.score || 50)}
                        onChange={(e) => setAnalysisScores((prev) => ({ ...prev, [factor.id]: Number(e.target.value) }))}
                        style={{ flex: 1 }}
                      />
                      <span style={{ width: 36, textAlign: 'right', fontSize: 13, fontWeight: 600 }}>
                        {analysisScores[factor.id] ?? (selected.decisionFactors[factor.id]?.score || 50)}
                      </span>
                      <span style={{ width: 50, fontSize: 11, color: '#999' }}>权重{(factor.weight * 100).toFixed(0)}%</span>
                    </div>
                  ))}
                </div>
                <button
                  onClick={handleAnalyze}
                  style={{ marginTop: 12, padding: '8px 20px', background: '#722ed1', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer' }}
                >
                  分析并生成建议
                </button>
              </div>

              {/* 决策建议 */}
              {(recommendation || selected.decisionScore > 0) && (
                <div style={{
                  padding: 16,
                  border: '1px solid #e8e8e8',
                  borderRadius: 8,
                  background: recommendation ? '#f9f0ff' : '#fafafa',
                }}>
                  <h4 style={{ marginBottom: 8 }}>决策建议</h4>
                  {recommendation ? (
                    <div>
                      <div style={{ display: 'flex', gap: 16, marginBottom: 8 }}>
                        <span style={{ fontSize: 20, fontWeight: 700, color: '#722ed1' }}>{recommendation.score}分</span>
                        <span style={{ fontSize: 16, fontWeight: 600, alignSelf: 'center' }}>{recommendation.recommendation}</span>
                        <span style={{ fontSize: 13, color: '#666', alignSelf: 'center' }}>置信度 {recommendation.confidence}%</span>
                      </div>
                      <ul style={{ margin: 0, paddingLeft: 20, fontSize: 13, color: '#666' }}>
                        {recommendation.reasons.map((r, i) => <li key={i}>{r}</li>)}
                      </ul>
                    </div>
                  ) : (
                    <p style={{ fontSize: 14, color: '#666', margin: 0 }}>综合评分: {selected.decisionScore}分</p>
                  )}
                </div>
              )}

              {/* 竞争对手分析 */}
              <div style={{ padding: 16, border: '1px solid #e8e8e8', borderRadius: 8, marginTop: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <h4 style={{ margin: 0 }}>竞争对手分析</h4>
                  <button
                    onClick={() => setCompetitors((prev) => [...prev, { name: '', strengths: '', weaknesses: '', winRate: 30 }])}
                    style={{ padding: '4px 12px', fontSize: 12, border: '1px solid #1677ff', borderRadius: 4, color: '#1677ff', background: '#fff', cursor: 'pointer' }}
                  >
                    + 添加对手
                  </button>
                </div>
                {competitors.length === 0 ? (
                  <p style={{ fontSize: 13, color: '#999', margin: 0 }}>点击"添加对手"录入竞争对手信息</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 }}>
                    {competitors.map((c, i) => (
                      <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 80px 28px', gap: 6, alignItems: 'center' }}>
                        <input
                          placeholder="对手名称"
                          value={c.name}
                          onChange={(e) => setCompetitors((prev) => prev.map((x, j) => j === i ? { ...x, name: e.target.value } : x))}
                          style={{ padding: '5px 8px', border: '1px solid #ddd', borderRadius: 4, fontSize: 13 }}
                        />
                        <input
                          placeholder="优势（逗号分隔）"
                          value={c.strengths}
                          onChange={(e) => setCompetitors((prev) => prev.map((x, j) => j === i ? { ...x, strengths: e.target.value } : x))}
                          style={{ padding: '5px 8px', border: '1px solid #ddd', borderRadius: 4, fontSize: 13 }}
                        />
                        <input
                          placeholder="劣势（逗号分隔）"
                          value={c.weaknesses}
                          onChange={(e) => setCompetitors((prev) => prev.map((x, j) => j === i ? { ...x, weaknesses: e.target.value } : x))}
                          style={{ padding: '5px 8px', border: '1px solid #ddd', borderRadius: 4, fontSize: 13 }}
                        />
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          <input
                            type="number"
                            min={0}
                            max={100}
                            value={c.winRate}
                            onChange={(e) => setCompetitors((prev) => prev.map((x, j) => j === i ? { ...x, winRate: Number(e.target.value) } : x))}
                            style={{ width: '100%', padding: '5px 6px', border: '1px solid #ddd', borderRadius: 4, fontSize: 13 }}
                          />
                          <span style={{ fontSize: 11, color: '#999' }}>%</span>
                        </div>
                        <button
                          onClick={() => setCompetitors((prev) => prev.filter((_, j) => j !== i))}
                          style={{ padding: '4px', border: 'none', background: 'none', cursor: 'pointer', color: '#ff4d4f', fontSize: 16, lineHeight: 1 }}
                        >×</button>
                      </div>
                    ))}
                  </div>
                )}
                {competitors.length > 0 && (
                  <button
                    onClick={handleAnalyzeCompetition}
                    style={{ padding: '7px 18px', background: '#13c2c2', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 13 }}
                  >
                    开始竞争分析
                  </button>
                )}
                {competitionResult && (
                  <div style={{ marginTop: 12, padding: 12, background: '#e6fffb', borderRadius: 6, fontSize: 13 }}>
                    <strong>竞争烈度：</strong>{competitionResult.competitionLevel}
                    {competitionResult.ourAdvantages?.length > 0 && (
                      <div style={{ marginTop: 6 }}>
                        <strong>我方优势：</strong>
                        <ul style={{ margin: '4px 0 0', paddingLeft: 18 }}>
                          {competitionResult.ourAdvantages.map((a: string, i: number) => <li key={i}>{a}</li>)}
                        </ul>
                      </div>
                    )}
                    {competitionResult.strategies?.length > 0 && (
                      <div style={{ marginTop: 6 }}>
                        <strong>建议策略：</strong>
                        <ul style={{ margin: '4px 0 0', paddingLeft: 18 }}>
                          {competitionResult.strategies.map((s: string, i: number) => <li key={i}>{s}</li>)}
                        </ul>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>}

      {/* 新增机会弹窗 */}
      {showCreate && (
        <CreateDialog
          sources={sources}
          onSave={handleCreate}
          onClose={() => setShowCreate(false)}
        />
      )}
    </div>
  );
}

function CreateDialog({ sources, onSave, onClose }: {
  sources: TenderSource[];
  onSave: (data: any) => void;
  onClose: () => void;
}) {
  const [form, setForm] = useState({
    projectName: '',
    tenderNo: '',
    clientName: '',
    budget: 0,
    deadline: '',
    source: 'other',
    description: '',
  });

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
      <div style={{ background: '#fff', borderRadius: 12, padding: 24, width: 520, maxHeight: '80vh', overflow: 'auto' }}>
        <h3 style={{ marginBottom: 16 }}>新增投标机会</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={{ fontSize: 13, color: '#666' }}>项目名称 *</span>
            <input value={form.projectName} onChange={(e) => setForm((p) => ({ ...p, projectName: e.target.value }))} placeholder="招标项目名称" style={{ padding: '8px 12px', border: '1px solid #ddd', borderRadius: 6 }} />
          </label>
          <div style={{ display: 'flex', gap: 12 }}>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: 1 }}>
              <span style={{ fontSize: 13, color: '#666' }}>招标编号</span>
              <input value={form.tenderNo} onChange={(e) => setForm((p) => ({ ...p, tenderNo: e.target.value }))} placeholder="可选" style={{ padding: '8px 12px', border: '1px solid #ddd', borderRadius: 6 }} />
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: 1 }}>
              <span style={{ fontSize: 13, color: '#666' }}>客户名称</span>
              <input value={form.clientName} onChange={(e) => setForm((p) => ({ ...p, clientName: e.target.value }))} placeholder="招标方" style={{ padding: '8px 12px', border: '1px solid #ddd', borderRadius: 6 }} />
            </label>
          </div>
          <div style={{ display: 'flex', gap: 12 }}>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: 1 }}>
              <span style={{ fontSize: 13, color: '#666' }}>预算（元）</span>
              <input type="number" value={form.budget} onChange={(e) => setForm((p) => ({ ...p, budget: Number(e.target.value) }))} min={0} style={{ padding: '8px 12px', border: '1px solid #ddd', borderRadius: 6 }} />
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: 1 }}>
              <span style={{ fontSize: 13, color: '#666' }}>截止日期</span>
              <input type="date" value={form.deadline} onChange={(e) => setForm((p) => ({ ...p, deadline: e.target.value }))} style={{ padding: '8px 12px', border: '1px solid #ddd', borderRadius: 6 }} />
            </label>
          </div>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={{ fontSize: 13, color: '#666' }}>信息来源</span>
            <select value={form.source} onChange={(e) => setForm((p) => ({ ...p, source: e.target.value }))} style={{ padding: '8px 12px', border: '1px solid #ddd', borderRadius: 6 }}>
              {sources.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={{ fontSize: 13, color: '#666' }}>描述</span>
            <textarea value={form.description} onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))} rows={3} placeholder="项目简要描述" style={{ padding: '8px 12px', border: '1px solid #ddd', borderRadius: 6, resize: 'vertical' }} />
          </label>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 20 }}>
          <button onClick={onClose} style={{ padding: '8px 16px', background: '#f5f5f5', border: '1px solid #ddd', borderRadius: 6, cursor: 'pointer' }}>取消</button>
          <button
            onClick={() => { if (form.projectName.trim()) onSave(form); }}
            disabled={!form.projectName.trim()}
            style={{ padding: '8px 16px', background: '#1677ff', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', opacity: form.projectName.trim() ? 1 : 0.5 }}
          >
            创建
          </button>
        </div>
      </div>
    </div>
  );
}

export default BidOpportunityPage;
