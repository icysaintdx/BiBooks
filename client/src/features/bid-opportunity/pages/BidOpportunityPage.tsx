import { useCallback, useEffect, useState, type Dispatch, type SetStateAction } from 'react';
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
  const [currentProjectName, setCurrentProjectName] = useState('');
  const [competitors, setCompetitors] = useState<Array<{ name: string; strengths: string; weaknesses: string; winRate: number }>>([]);
  const [competitionResult, setCompetitionResult] = useState<any>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const [factorsData, sourcesData, oppsData, projectState] = await Promise.all([
          window.yibiao?.bidOpportunity.getDecisionFactors(),
          window.yibiao?.bidOpportunity.getTenderSources(),
          window.yibiao?.bidOpportunity.list(),
          window.yibiao?.projectWorkspace.list(),
        ]);
        if (factorsData) setFactors(factorsData as Record<string, DecisionFactor>);
        if (sourcesData) setSources(sourcesData as TenderSource[]);
        if (oppsData) setOpportunities(oppsData as Opportunity[]);
        const currentProject = (projectState?.projects || []).find((project) => project.id === projectState?.currentProjectId);
        if (currentProject?.name) setCurrentProjectName(currentProject.name);
      } catch (error) {
        showToast(`加载配置失败: ${error instanceof Error ? error.message : String(error)}`, 'error');
      }
    };
    void load();
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
        competitors.map((c) => ({
          name: c.name,
          strengths: c.strengths.split('，').filter(Boolean),
          weaknesses: c.weaknesses.split('，').filter(Boolean),
          winRate: c.winRate,
        })),
      );
      setCompetitionResult(result);
      showToast('竞争分析完成', 'success');
    } catch (error) {
      showToast(`竞争分析失败: ${error instanceof Error ? error.message : String(error)}`, 'error');
    }
  }, [selected, competitors, showToast]);

  return (
    <div className="module-page module-page-wide bid-opportunity-page">
      <header className="module-page-header">
        <div>
          <span className="section-kicker">OPPORTUNITY</span>
          <h2>投标机会</h2>
          <p>售前线索和投标决策工作区。用于判断“要不要投这个标”，确认参与后再到项目管理中新建正式投标项目。</p>
        </div>
        <div className="module-page-actions">
          <div className="opportunity-view-switch">
            {(['list', 'kanban', 'calendar'] as ViewMode[]).map((mode) => (
              <button
                key={mode}
                type="button"
                className={viewMode === mode ? 'is-active' : ''}
                onClick={() => { setViewMode(mode); if (mode === 'calendar') void handleLoadCalendar(); }}
              >
                {{ list: '列表', kanban: '看板', calendar: '日历' }[mode]}
              </button>
            ))}
          </div>
          <button type="button" className="primary-action module-action" onClick={() => setShowCreate(true)}>新增机会</button>
        </div>
      </header>

      {viewMode === 'kanban' && (
        <div className="opportunity-kanban">
          {Object.entries(statusLabels).map(([status, label]) => {
            const columnOpportunities = opportunities.filter((item) => item.status === status);
            return (
              <section className="opportunity-kanban-column" key={status}>
                <div className="opportunity-kanban-head">
                  <span style={{ background: statusColors[status] }} />
                  <strong>{label}</strong>
                  <small>{columnOpportunities.length}</small>
                </div>
                <div className="opportunity-card-list">
                  {columnOpportunities.map((opportunity) => (
                    <button
                      type="button"
                      className="opportunity-card"
                      key={opportunity.id}
                      onClick={() => { setSelected(opportunity); setRecommendation(null); setViewMode('list'); }}
                    >
                      <strong>{opportunity.projectName}</strong>
                      <span>{opportunity.clientName || '未知客户'}</span>
                      {opportunity.budget > 0 && <small>{formatMoney(opportunity.budget)}</small>}
                      {opportunity.deadline && <small>截止 {opportunity.deadline}</small>}
                    </button>
                  ))}
                  {columnOpportunities.length === 0 && <div className="opportunity-empty-column">无</div>}
                </div>
              </section>
            );
          })}
        </div>
      )}

      {viewMode === 'calendar' && (
        <section className="module-panel">
          {!calendarData ? (
            <div className="module-empty-state">正在生成机会日历...</div>
          ) : (!calendarData.months?.length && !calendarData.upcomingDeadlines?.length) ? (
            <div className="module-empty-state">暂无可显示的日程。新建投标机会并填写截止日期后，这里会显示报名、投标或开标相关节点。</div>
          ) : (
            <div className="module-stack">
              {calendarData.months?.map((month: any, monthIndex: number) => (
                <section key={monthIndex}>
                  <strong className="module-section-title">{month.month}</strong>
                  <div className="module-card-list">
                    {month.events?.map((event: any, eventIndex: number) => (
                      <div className="opportunity-calendar-event" key={eventIndex}>
                        <span>{event.date}</span>
                        <b style={{ background: statusColors[event.status] || '#8c8c8c' }}>{statusLabels[event.status] || event.type}</b>
                        <strong>{event.projectName}</strong>
                        {event.description && <small>{event.description}</small>}
                      </div>
                    ))}
                    {(!month.events || month.events.length === 0) && <div className="module-empty-state">无事件</div>}
                  </div>
                </section>
              ))}
              {calendarData.upcomingDeadlines?.length > 0 && (
                <section className="module-note-banner">
                  <strong>即将截止（7天内）</strong>
                  <div className="opportunity-deadline-list">
                    {calendarData.upcomingDeadlines.map((deadline: any, index: number) => (
                      <div key={index}>
                        <span>{deadline.deadline}</span>
                        <strong>{deadline.projectName}</strong>
                        <small>剩余 {deadline.daysLeft} 天</small>
                      </div>
                    ))}
                  </div>
                </section>
              )}
            </div>
          )}
        </section>
      )}

      {viewMode === 'list' && (
        <div className="opportunity-list-layout">
          <aside className="opportunity-list-panel">
            {opportunities.length === 0 ? (
              <div className="module-empty-state">暂无投标机会，点击“新增机会”创建。</div>
            ) : (
              <div className="opportunity-list">
                {opportunities.map((opportunity) => (
                  <button
                    type="button"
                    className={`opportunity-list-item ${selected?.id === opportunity.id ? 'is-selected' : ''}`}
                    key={opportunity.id}
                    onClick={() => { setSelected(opportunity); setRecommendation(null); }}
                  >
                    <div>
                      <strong>{opportunity.projectName}</strong>
                      <span style={{ background: statusColors[opportunity.status] || '#8c8c8c' }}>{statusLabels[opportunity.status] || opportunity.status}</span>
                    </div>
                    <small>
                      {opportunity.clientName || '未知客户'}
                      {opportunity.budget > 0 ? ` · ${formatMoney(opportunity.budget)}` : ''}
                      {opportunity.decisionScore > 0 ? ` · ${opportunity.decisionScore}分` : ''}
                    </small>
                  </button>
                ))}
              </div>
            )}
          </aside>

          <main className="opportunity-detail-panel">
            {!selected ? (
              <div className="module-empty-state">选择左侧机会查看详情，或新增投标机会。</div>
            ) : (
              <OpportunityDetail
                selected={selected}
                factors={factors}
                sources={sources}
                recommendation={recommendation}
                analysisScores={analysisScores}
                competitors={competitors}
                competitionResult={competitionResult}
                onAnalyze={handleAnalyze}
                onDelete={handleDelete}
                onStatusChange={handleStatusChange}
                onScoresChange={setAnalysisScores}
                onCompetitorsChange={setCompetitors}
                onAnalyzeCompetition={handleAnalyzeCompetition}
              />
            )}
          </main>
        </div>
      )}

      {showCreate && (
        <CreateDialog
          defaultProjectName={currentProjectName}
          sources={sources}
          onSave={handleCreate}
          onClose={() => setShowCreate(false)}
        />
      )}
    </div>
  );
}

function OpportunityDetail({
  selected,
  factors,
  sources,
  recommendation,
  analysisScores,
  competitors,
  competitionResult,
  onAnalyze,
  onDelete,
  onStatusChange,
  onScoresChange,
  onCompetitorsChange,
  onAnalyzeCompetition,
}: {
  selected: Opportunity;
  factors: Record<string, DecisionFactor>;
  sources: TenderSource[];
  recommendation: Recommendation | null;
  analysisScores: Record<string, number>;
  competitors: Array<{ name: string; strengths: string; weaknesses: string; winRate: number }>;
  competitionResult: any;
  onAnalyze: () => void;
  onDelete: () => void;
  onStatusChange: (status: string) => void;
  onScoresChange: Dispatch<SetStateAction<Record<string, number>>>;
  onCompetitorsChange: Dispatch<SetStateAction<Array<{ name: string; strengths: string; weaknesses: string; winRate: number }>>>;
  onAnalyzeCompetition: () => void;
}) {
  return (
    <div className="module-stack">
      <section className="module-panel">
        <div className="opportunity-detail-head">
          <h3>{selected.projectName}</h3>
          <button type="button" className="danger-action module-action" onClick={onDelete}>删除</button>
        </div>
        <div className="opportunity-meta-grid">
          <span><strong>招标编号：</strong>{selected.tenderNo || '无'}</span>
          <span><strong>客户：</strong>{selected.clientName || '无'}</span>
          <span><strong>预算：</strong>{selected.budget > 0 ? formatMoney(selected.budget) : '未知'}</span>
          <span><strong>截止日期：</strong>{selected.deadline || '无'}</span>
          <span><strong>来源：</strong>{sources.find((source) => source.id === selected.source)?.name || selected.source}</span>
          <span><strong>状态：</strong>{statusLabels[selected.status] || selected.status}</span>
        </div>
        {selected.description && <p>{selected.description}</p>}
      </section>

      <section className="module-panel">
        <strong className="module-section-title">状态流转</strong>
        <div className="opportunity-status-actions">
          {Object.entries(statusLabels).map(([key, label]) => (
            <button
              type="button"
              key={key}
              onClick={() => onStatusChange(key)}
              disabled={selected.status === key}
              className={selected.status === key ? 'is-active' : ''}
              style={selected.status === key ? { background: statusColors[key], borderColor: statusColors[key] } : undefined}
            >
              {label}
            </button>
          ))}
        </div>
      </section>

      <section className="module-panel">
        <strong className="module-section-title">决策因素评分</strong>
        <div className="opportunity-score-list">
          {Object.values(factors).map((factor) => (
            <label key={factor.id}>
              <span>{factor.name}</span>
              <input
                type="range"
                min={0}
                max={100}
                value={analysisScores[factor.id] ?? (selected.decisionFactors[factor.id]?.score || 50)}
                onChange={(event) => onScoresChange((prev) => ({ ...prev, [factor.id]: Number(event.target.value) }))}
              />
              <strong>{analysisScores[factor.id] ?? (selected.decisionFactors[factor.id]?.score || 50)}</strong>
              <small>权重{(factor.weight * 100).toFixed(0)}%</small>
            </label>
          ))}
        </div>
        <button type="button" className="primary-action module-action" onClick={onAnalyze}>分析并生成建议</button>
      </section>

      {(recommendation || selected.decisionScore > 0) && (
        <section className="module-panel opportunity-recommendation">
          <strong className="module-section-title">决策建议</strong>
          {recommendation ? (
            <>
              <div className="opportunity-recommendation-head">
                <strong>{recommendation.score}分</strong>
                <span>{recommendation.recommendation}</span>
                <small>置信度 {recommendation.confidence}%</small>
              </div>
              <ul className="quiet-list">
                {recommendation.reasons.map((reason, index) => <li key={index}>{reason}</li>)}
              </ul>
            </>
          ) : (
            <p>综合评分：{selected.decisionScore}分</p>
          )}
        </section>
      )}

      <section className="module-panel">
        <div className="opportunity-detail-head">
          <strong className="module-section-title">竞争对手分析</strong>
          <button
            type="button"
            className="secondary-action module-action"
            onClick={() => onCompetitorsChange((prev) => [...prev, { name: '', strengths: '', weaknesses: '', winRate: 30 }])}
          >
            添加对手
          </button>
        </div>
        {competitors.length === 0 ? (
          <p>点击“添加对手”录入竞争对手信息。</p>
        ) : (
          <div className="opportunity-competitor-list">
            {competitors.map((competitor, index) => (
              <div className="opportunity-competitor-row" key={index}>
                <input placeholder="对手名称" value={competitor.name} onChange={(event) => onCompetitorsChange((prev) => prev.map((item, itemIndex) => itemIndex === index ? { ...item, name: event.target.value } : item))} />
                <input placeholder="优势（逗号分隔）" value={competitor.strengths} onChange={(event) => onCompetitorsChange((prev) => prev.map((item, itemIndex) => itemIndex === index ? { ...item, strengths: event.target.value } : item))} />
                <input placeholder="劣势（逗号分隔）" value={competitor.weaknesses} onChange={(event) => onCompetitorsChange((prev) => prev.map((item, itemIndex) => itemIndex === index ? { ...item, weaknesses: event.target.value } : item))} />
                <input type="number" min={0} max={100} value={competitor.winRate} onChange={(event) => onCompetitorsChange((prev) => prev.map((item, itemIndex) => itemIndex === index ? { ...item, winRate: Number(event.target.value) } : item))} />
                <button type="button" className="module-link-button is-danger" onClick={() => onCompetitorsChange((prev) => prev.filter((_, itemIndex) => itemIndex !== index))}>删除</button>
              </div>
            ))}
          </div>
        )}
        {competitors.length > 0 && (
          <button type="button" className="primary-action module-action" onClick={onAnalyzeCompetition}>开始竞争分析</button>
        )}
        {competitionResult && (
          <div className="module-note-banner opportunity-competition-result">
            <strong>竞争烈度：{competitionResult.competitionLevel}</strong>
            {competitionResult.ourAdvantages?.length > 0 && (
              <div>
                <strong>我方优势：</strong>
                <ul>{competitionResult.ourAdvantages.map((advantage: string, index: number) => <li key={index}>{advantage}</li>)}</ul>
              </div>
            )}
            {competitionResult.strategies?.length > 0 && (
              <div>
                <strong>建议策略：</strong>
                <ul>{competitionResult.strategies.map((strategy: string, index: number) => <li key={index}>{strategy}</li>)}</ul>
              </div>
            )}
          </div>
        )}
      </section>
    </div>
  );
}

function CreateDialog({ defaultProjectName, sources, onSave, onClose }: {
  defaultProjectName: string;
  sources: TenderSource[];
  onSave: (data: any) => void;
  onClose: () => void;
}) {
  const [form, setForm] = useState({
    projectName: defaultProjectName,
    tenderNo: '',
    clientName: '',
    budget: 0,
    deadline: '',
    source: 'other',
    description: '',
  });

  return (
    <div className="module-modal-backdrop">
      <div className="module-modal" role="dialog" aria-modal="true" aria-label="新增投标机会">
        <h3>新增投标机会</h3>
        <div className="module-dialog-form">
          <label className="module-field">
            <span>项目名称 *</span>
            <input value={form.projectName} onChange={(event) => setForm((prev) => ({ ...prev, projectName: event.target.value }))} placeholder="招标项目名称" />
          </label>
          <div className="module-form-grid">
            <label className="module-field">
              <span>招标编号</span>
              <input value={form.tenderNo} onChange={(event) => setForm((prev) => ({ ...prev, tenderNo: event.target.value }))} placeholder="可选" />
            </label>
            <label className="module-field">
              <span>客户名称</span>
              <input value={form.clientName} onChange={(event) => setForm((prev) => ({ ...prev, clientName: event.target.value }))} placeholder="招标方" />
            </label>
            <label className="module-field">
              <span>预算（元）</span>
              <input type="number" value={form.budget} onChange={(event) => setForm((prev) => ({ ...prev, budget: Number(event.target.value) }))} min={0} />
            </label>
            <label className="module-field">
              <span>截止日期</span>
              <input type="date" value={form.deadline} onChange={(event) => setForm((prev) => ({ ...prev, deadline: event.target.value }))} />
            </label>
          </div>
          <label className="module-field">
            <span>信息来源</span>
            <select value={form.source} onChange={(event) => setForm((prev) => ({ ...prev, source: event.target.value }))}>
              {sources.map((source) => <option key={source.id} value={source.id}>{source.name}</option>)}
            </select>
          </label>
          <label className="module-field">
            <span>描述</span>
            <textarea value={form.description} onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))} rows={3} placeholder="项目简要描述" />
          </label>
        </div>
        <div className="module-modal-actions">
          <button type="button" className="secondary-action module-action" onClick={onClose}>取消</button>
          <button
            type="button"
            className="primary-action module-action"
            onClick={() => { if (form.projectName.trim()) onSave(form); }}
            disabled={!form.projectName.trim()}
          >
            创建
          </button>
        </div>
      </div>
    </div>
  );
}

export default BidOpportunityPage;
