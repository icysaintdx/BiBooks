import { useCallback, useEffect, useState } from 'react';
import { useToast } from '../../../shared/ui';

type BidStep = 'setup' | 'sections' | 'result';

interface SectionDef {
  id: string;
  title: string;
  description: string;
  required: boolean;
}

interface PriceTemplate {
  name: string;
  description: string;
  structure: Array<{ name: string; description: string }>;
}

interface QualType {
  id: string;
  name: string;
  required: boolean;
}

interface CommercialBidResult {
  projectName: string;
  companyName: string;
  sections: Record<string, any>;
  generatedAt: string;
}

const sectionIcons: Record<string, string> = {
  price: '报价',
  terms: '条款',
  qualifications: '资质',
  performance: '业绩',
  financial: '财务',
  service: '售后',
};

function BusinessBidPage() {
  const { showToast } = useToast();
  const [step, setStep] = useState<BidStep>('setup');
  const [projectName, setProjectName] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [priceType, setPriceType] = useState('lumpSum');
  const [sections, setSections] = useState<SectionDef[]>([]);
  const [priceTemplates, setPriceTemplates] = useState<Record<string, PriceTemplate>>({});
  const [qualTypes, setQualTypes] = useState<QualType[]>([]);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<CommercialBidResult | null>(null);
  const [report, setReport] = useState('');
  const [savedBids, setSavedBids] = useState<any[]>([]);

  // 各章节输入数据
  const [priceItems, setPriceItems] = useState<Array<{ name: string; description: string; amount: number; unit: string }>>([]);
  const [totalAmount, setTotalAmount] = useState(0);
  const [qualifications, setQualifications] = useState<Array<{ id: string; name: string; required: boolean; status: string; certificateNo: string; validFrom: string; validTo: string }>>([]);
  const [projects, setProjects] = useState<Array<{ name: string; client: string; contractAmount: number; completionDate: string; description: string }>>([]);
  const [warrantyPeriod, setWarrantyPeriod] = useState('1年');
  const [responseTime, setResponseTime] = useState('24小时');
  const [financialData, setFinancialData] = useState({ revenue: { year1: 0, year2: 0, year3: 0 }, profit: { year1: 0, year2: 0, year3: 0 }, bankCredit: '', creditRating: '' });
  const [kbRecs, setKbRecs] = useState<any[]>([]);
  const [showKbPanel, setShowKbPanel] = useState(false);

  // 加载基础数据
  useEffect(() => {
    const load = async () => {
      try {
        const [sectionsData, templatesData, qualData, listData] = await Promise.all([
          window.yibiao?.commercialBid.getSections(),
          window.yibiao?.commercialBid.getPriceTemplates(),
          window.yibiao?.commercialBid.getQualificationTypes(),
          window.yibiao?.commercialBid.list(),
        ]);
        if (sectionsData) setSections(Object.values(sectionsData as Record<string, SectionDef>));
        if (templatesData) setPriceTemplates(templatesData as Record<string, PriceTemplate>);
        if (qualData) {
          setQualTypes(qualData as QualType[]);
          setQualifications((qualData as QualType[]).map((q) => ({ ...q, status: 'pending', certificateNo: '', validFrom: '', validTo: '' })));
        }
        if (listData) setSavedBids(listData as any[]);
      } catch (error) {
        showToast(`加载数据失败: ${error instanceof Error ? error.message : String(error)}`, 'error');
      }
    };
    load();
  }, [showToast]);

  const handleGenerate = useCallback(async () => {
    if (!projectName.trim() || !companyName.trim()) {
      showToast('请填写项目名称和投标单位', 'error');
      return;
    }
    setLoading(true);
    try {
      const bid = await window.yibiao?.commercialBid.generate({
        projectName,
        companyName,
        priceOptions: { priceType, totalAmount, items: priceItems },
        qualificationOptions: { companyName, qualifications },
        performanceOptions: { companyName, projects },
        serviceOptions: { projectName, warrantyPeriod, responseTime },
        financialOptions: { companyName, financialData },
      }) as CommercialBidResult | undefined;
      if (bid) {
        setResult(bid);
        const rpt = await window.yibiao?.commercialBid.generateReport(bid);
        setReport(rpt || '');
        setStep('result');
        // 持久化保存
        const id = `bid_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
        const saved = await window.yibiao?.commercialBid.save({
          id,
          projectName,
          companyName,
          priceType,
          sections: [],
          result: bid,
          report: rpt || '',
          createdAt: new Date().toISOString(),
        });
        if (saved) setSavedBids((prev) => [saved, ...prev]);
        showToast('商务标已生成并保存', 'success');
      }
    } catch (error) {
      showToast(`生成失败: ${error instanceof Error ? error.message : String(error)}`, 'error');
    } finally {
      setLoading(false);
    }
  }, [projectName, companyName, priceType, showToast]);

  const handleCopyReport = useCallback(() => {
    navigator.clipboard.writeText(report).then(() => {
      showToast('报告已复制到剪贴板', 'success');
    }).catch(() => showToast('复制失败', 'error'));
  }, [report, showToast]);

  const handleReset = useCallback(() => {
    setResult(null);
    setReport('');
    setStep('setup');
  }, []);

  const handleLoadKbRecs = useCallback(async () => {
    if (!projectName.trim()) { showToast('请先填写项目名称', 'error'); return; }
    try {
      const keywords = projectName.split(/\s+/).filter(Boolean);
      const recs = await window.yibiao?.privateKnowledgeBase.getRecommendations({ industry: 'bid', keywords, limit: 10 });
      setKbRecs(recs || []);
      setShowKbPanel(true);
      if (!recs?.length) showToast('暂无匹配的知识库推荐', 'info');
    } catch (error) {
      showToast(`加载推荐失败: ${error instanceof Error ? error.message : String(error)}`, 'error');
    }
  }, [projectName, showToast]);

  const handleDeleteSaved = useCallback(async (id: string) => {
    try {
      await window.yibiao?.commercialBid.delete(id);
      setSavedBids((prev) => prev.filter((b) => b.id !== id));
      showToast('已删除', 'success');
    } catch (error) {
      showToast(`删除失败: ${error instanceof Error ? error.message : String(error)}`, 'error');
    }
  }, [showToast]);

  return (
    <div style={{ padding: 24, display: 'flex', gap: 20, maxWidth: 1200, margin: '0 auto' }}>
      {/* 历史记录侧栏 */}
      {savedBids.length > 0 && (
        <div style={{ width: 220, flexShrink: 0 }}>
          <strong style={{ fontSize: 13, color: '#666', display: 'block', marginBottom: 8 }}>历史记录</strong>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {savedBids.map((b) => (
              <div key={b.id} style={{ padding: 10, border: '1px solid #e8e8e8', borderRadius: 6, background: '#fafafa' }}>
                <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{b.projectName}</div>
                <div style={{ fontSize: 11, color: '#999', marginBottom: 6 }}>{b.updatedAt?.slice(0, 10) || ''}</div>
                <button
                  onClick={() => { setProjectName(b.projectName); setCompanyName(b.companyName || ''); setPriceType(b.priceType || 'lumpSum'); if (b.result) { setResult(b.result); setReport(b.report || ''); setStep('result'); } else { setStep('setup'); } }}
                  style={{ fontSize: 11, padding: '2px 8px', border: '1px solid #1677ff', borderRadius: 4, color: '#1677ff', background: '#fff', cursor: 'pointer', marginRight: 4 }}
                >
                  加载
                </button>
                <button
                  onClick={() => handleDeleteSaved(b.id)}
                  style={{ fontSize: 11, padding: '2px 8px', border: '1px solid #ff4d4f', borderRadius: 4, color: '#ff4d4f', background: '#fff', cursor: 'pointer' }}
                >
                  删除
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={{ flex: 1, minWidth: 0, maxWidth: 960 }}>
      <h2 style={{ marginBottom: 8 }}>商务标</h2>
      <p style={{ color: '#666', marginBottom: 24, fontSize: 14 }}>
        生成商务标内容：报价、条款响应、资质证明、业绩证明、财务状况、售后服务。
      </p>

      {/* 步骤指示 */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
        {(['setup', 'sections', 'result'] as BidStep[]).map((s, i) => (
          <div
            key={s}
            style={{
              padding: '6px 16px',
              borderRadius: 16,
              fontSize: 13,
              background: step === s ? '#1677ff' : '#f0f0f0',
              color: step === s ? '#fff' : '#666',
              cursor: 'pointer',
            }}
            onClick={() => {
              if (s === 'setup') setStep('setup');
              if (s === 'sections' && projectName.trim() && companyName.trim()) setStep('sections');
              if (s === 'result' && result) setStep('result');
            }}
          >
            {['基本信息', '板块配置', '生成结果'][i]}
          </div>
        ))}
      </div>

      {/* STEP 1: 基本信息 */}
      {step === 'setup' && (
        <div>
          <div style={{ display: 'flex', gap: 16, marginBottom: 24, flexWrap: 'wrap' }}>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: 1, minWidth: 240 }}>
              <span style={{ fontSize: 13, color: '#666' }}>项目名称 *</span>
              <input
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                placeholder="输入招标项目名称"
                style={{ padding: '8px 12px', border: '1px solid #ddd', borderRadius: 6 }}
              />
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: 1, minWidth: 240 }}>
              <span style={{ fontSize: 13, color: '#666' }}>投标单位 *</span>
              <input
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                placeholder="输入投标单位名称"
                style={{ padding: '8px 12px', border: '1px solid #ddd', borderRadius: 6 }}
              />
            </label>
          </div>

          <h3 style={{ marginBottom: 12, fontSize: 15 }}>报价模板</h3>
          <div style={{ display: 'flex', gap: 12, marginBottom: 24, flexWrap: 'wrap' }}>
            {Object.entries(priceTemplates).map(([key, tpl]) => (
              <div
                key={key}
                onClick={() => setPriceType(key)}
                style={{
                  padding: '12px 16px',
                  border: `2px solid ${priceType === key ? '#1677ff' : '#e8e8e8'}`,
                  borderRadius: 8,
                  cursor: 'pointer',
                  flex: 1,
                  minWidth: 200,
                  background: priceType === key ? '#f0f5ff' : '#fff',
                }}
              >
                <strong style={{ display: 'block', marginBottom: 4 }}>{tpl.name}</strong>
                <span style={{ fontSize: 13, color: '#666' }}>{tpl.description}</span>
              </div>
            ))}
          </div>

          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={() => {
                if (!projectName.trim() || !companyName.trim()) {
                  showToast('请填写项目名称和投标单位', 'error');
                  return;
                }
                setStep('sections');
              }}
              style={{ padding: '10px 24px', background: '#1677ff', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer' }}
            >
              下一步
            </button>
          </div>
        </div>
      )}

      {/* STEP 2: 板块配置 */}
      {step === 'sections' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

          {/* 知识库推荐 */}
          <div style={{ border: '1px solid #d3adf7', borderRadius: 8, padding: 12, background: '#f9f0ff' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 13, color: '#531dab' }}>💡 从私有知识库引用企业信息（资质、业绩、财务等）</span>
              <button
                onClick={handleLoadKbRecs}
                style={{ fontSize: 12, padding: '4px 12px', border: '1px solid #722ed1', borderRadius: 4, color: '#722ed1', background: '#fff', cursor: 'pointer' }}
              >
                加载知识库推荐
              </button>
            </div>
            {showKbPanel && kbRecs.length > 0 && (
              <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
                {kbRecs.map((item) => (
                  <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 10px', background: '#fff', borderRadius: 4, border: '1px solid #e8e8e8', fontSize: 13 }}>
                    <span><strong>{item.title}</strong><span style={{ color: '#999', marginLeft: 8, fontSize: 11 }}>{item.category}</span></span>
                    <div style={{ display: 'flex', gap: 6 }}>
                      {item.category === 'performance' && (
                        <button
                          onClick={() => setProjects((p) => [...p, { name: item.data.projectName as string || item.title, client: item.data.clientName as string || '', contractAmount: Number(item.data.contractAmount) || 0, completionDate: item.data.completionDate as string || '', description: item.data.description as string || '' }])}
                          style={{ fontSize: 11, padding: '2px 8px', border: '1px solid #52c41a', borderRadius: 3, color: '#52c41a', background: '#fff', cursor: 'pointer' }}
                        >引用到业绩</button>
                      )}
                      {item.category === 'qualification' && (
                        <button
                          onClick={() => setQualifications((p) => p.map((q) => q.name === (item.data.qualName as string) ? { ...q, certificateNo: item.data.certNo as string || q.certificateNo, status: 'completed' } : q))}
                          style={{ fontSize: 11, padding: '2px 8px', border: '1px solid #1677ff', borderRadius: 3, color: '#1677ff', background: '#fff', cursor: 'pointer' }}
                        >引用到资质</button>
                      )}
                      {item.category === 'financial' && (
                        <button
                          onClick={() => {
                            const d = item.data as any;
                            setFinancialData((f) => ({
                              ...f,
                              bankCredit: d.bankCredit || f.bankCredit,
                              creditRating: d.creditRating || f.creditRating,
                              revenue: d.revenue || f.revenue,
                              profit: d.profit || f.profit,
                            }));
                          }}
                          style={{ fontSize: 11, padding: '2px 8px', border: '1px solid #fa8c16', borderRadius: 3, color: '#fa8c16', background: '#fff', cursor: 'pointer' }}
                        >引用到财务</button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div style={{ border: '1px solid #e8e8e8', borderRadius: 8, padding: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <strong>投标报价</strong>
              <button onClick={() => setPriceItems((p) => [...p, { name: '', description: '', amount: 0, unit: '项' }])}
                style={{ fontSize: 12, padding: '3px 10px', border: '1px solid #1677ff', borderRadius: 4, color: '#1677ff', background: '#fff', cursor: 'pointer' }}>
                + 添加费用项
              </button>
            </div>
            <div style={{ display: 'flex', gap: 8, marginBottom: 12, alignItems: 'center' }}>
              <label style={{ fontSize: 13, color: '#666' }}>总金额（元）</label>
              <input type="number" value={totalAmount} onChange={(e) => setTotalAmount(Number(e.target.value))}
                style={{ width: 160, padding: '5px 8px', border: '1px solid #ddd', borderRadius: 4, fontSize: 13 }} />
            </div>
            {priceItems.length > 0 && (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: '#f5f5f5' }}>
                    {['费用项', '说明', '金额（元）', '单位', ''].map((h) => (
                      <th key={h} style={{ padding: '6px 8px', textAlign: 'left', borderBottom: '1px solid #eee', fontWeight: 500 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {priceItems.map((item, i) => (
                    <tr key={i}>
                      <td style={{ padding: '4px 4px' }}><input value={item.name} onChange={(e) => setPriceItems((p) => p.map((x, j) => j === i ? { ...x, name: e.target.value } : x))} placeholder="费用项名称" style={{ width: '100%', padding: '4px 6px', border: '1px solid #eee', borderRadius: 3, fontSize: 12 }} /></td>
                      <td style={{ padding: '4px 4px' }}><input value={item.description} onChange={(e) => setPriceItems((p) => p.map((x, j) => j === i ? { ...x, description: e.target.value } : x))} placeholder="说明" style={{ width: '100%', padding: '4px 6px', border: '1px solid #eee', borderRadius: 3, fontSize: 12 }} /></td>
                      <td style={{ padding: '4px 4px' }}><input type="number" value={item.amount} onChange={(e) => setPriceItems((p) => p.map((x, j) => j === i ? { ...x, amount: Number(e.target.value) } : x))} style={{ width: 100, padding: '4px 6px', border: '1px solid #eee', borderRadius: 3, fontSize: 12 }} /></td>
                      <td style={{ padding: '4px 4px' }}><input value={item.unit} onChange={(e) => setPriceItems((p) => p.map((x, j) => j === i ? { ...x, unit: e.target.value } : x))} style={{ width: 60, padding: '4px 6px', border: '1px solid #eee', borderRadius: 3, fontSize: 12 }} /></td>
                      <td style={{ padding: '4px 4px' }}><button onClick={() => setPriceItems((p) => p.filter((_, j) => j !== i))} style={{ color: '#ff4d4f', background: 'none', border: 'none', cursor: 'pointer', fontSize: 14 }}>×</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* 资质证明 */}
          <div style={{ border: '1px solid #e8e8e8', borderRadius: 8, padding: 16 }}>
            <strong style={{ display: 'block', marginBottom: 12 }}>资质证明清单</strong>
            {qualifications.length === 0 ? (
              <p style={{ color: '#999', fontSize: 13 }}>暂无资质项，将使用默认资质模板</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {qualifications.map((q, i) => (
                  <div key={q.id} style={{ display: 'grid', gridTemplateColumns: '140px 1fr 120px 120px auto', gap: 6, alignItems: 'center', fontSize: 13 }}>
                    <span style={{ fontWeight: 500 }}>{q.name}{q.required && <span style={{ color: '#ff4d4f', marginLeft: 2 }}>*</span>}</span>
                    <input value={q.certificateNo} onChange={(e) => setQualifications((p) => p.map((x, j) => j === i ? { ...x, certificateNo: e.target.value } : x))} placeholder="证书编号" style={{ padding: '4px 6px', border: '1px solid #eee', borderRadius: 3, fontSize: 12 }} />
                    <input type="date" value={q.validFrom} onChange={(e) => setQualifications((p) => p.map((x, j) => j === i ? { ...x, validFrom: e.target.value } : x))} style={{ padding: '4px 6px', border: '1px solid #eee', borderRadius: 3, fontSize: 12 }} />
                    <input type="date" value={q.validTo} onChange={(e) => setQualifications((p) => p.map((x, j) => j === i ? { ...x, validTo: e.target.value } : x))} style={{ padding: '4px 6px', border: '1px solid #eee', borderRadius: 3, fontSize: 12 }} />
                    <select value={q.status} onChange={(e) => setQualifications((p) => p.map((x, j) => j === i ? { ...x, status: e.target.value } : x))} style={{ padding: '4px 6px', border: '1px solid #eee', borderRadius: 3, fontSize: 12 }}>
                      <option value="pending">待准备</option>
                      <option value="completed">已完成</option>
                      <option value="na">不适用</option>
                    </select>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 业绩证明 */}
          <div style={{ border: '1px solid #e8e8e8', borderRadius: 8, padding: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <strong>业绩证明</strong>
              <button onClick={() => setProjects((p) => [...p, { name: '', client: '', contractAmount: 0, completionDate: '', description: '' }])}
                style={{ fontSize: 12, padding: '3px 10px', border: '1px solid #1677ff', borderRadius: 4, color: '#1677ff', background: '#fff', cursor: 'pointer' }}>
                + 添加业绩
              </button>
            </div>
            {projects.map((proj, i) => (
              <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 120px 130px auto', gap: 6, marginBottom: 8, alignItems: 'center', fontSize: 13 }}>
                <input value={proj.name} onChange={(e) => setProjects((p) => p.map((x, j) => j === i ? { ...x, name: e.target.value } : x))} placeholder="项目名称" style={{ padding: '5px 8px', border: '1px solid #eee', borderRadius: 3, fontSize: 12 }} />
                <input value={proj.client} onChange={(e) => setProjects((p) => p.map((x, j) => j === i ? { ...x, client: e.target.value } : x))} placeholder="客户名称" style={{ padding: '5px 8px', border: '1px solid #eee', borderRadius: 3, fontSize: 12 }} />
                <input type="number" value={proj.contractAmount} onChange={(e) => setProjects((p) => p.map((x, j) => j === i ? { ...x, contractAmount: Number(e.target.value) } : x))} placeholder="合同金额" style={{ padding: '5px 8px', border: '1px solid #eee', borderRadius: 3, fontSize: 12 }} />
                <input type="date" value={proj.completionDate} onChange={(e) => setProjects((p) => p.map((x, j) => j === i ? { ...x, completionDate: e.target.value } : x))} style={{ padding: '5px 8px', border: '1px solid #eee', borderRadius: 3, fontSize: 12 }} />
                <button onClick={() => setProjects((p) => p.filter((_, j) => j !== i))} style={{ color: '#ff4d4f', background: 'none', border: 'none', cursor: 'pointer', fontSize: 14 }}>×</button>
              </div>
            ))}
            {projects.length === 0 && <p style={{ color: '#999', fontSize: 13 }}>暂无业绩，将使用示例模板</p>}
          </div>

          {/* 售后服务 */}
          <div style={{ border: '1px solid #e8e8e8', borderRadius: 8, padding: 16 }}>
            <strong style={{ display: 'block', marginBottom: 12 }}>售后服务承诺</strong>
            <div style={{ display: 'flex', gap: 20, fontSize: 13 }}>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span style={{ color: '#666' }}>质保期</span>
                <input value={warrantyPeriod} onChange={(e) => setWarrantyPeriod(e.target.value)} placeholder="如：1年" style={{ padding: '5px 8px', border: '1px solid #ddd', borderRadius: 4, fontSize: 13, width: 120 }} />
              </label>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span style={{ color: '#666' }}>响应时间</span>
                <input value={responseTime} onChange={(e) => setResponseTime(e.target.value)} placeholder="如：24小时" style={{ padding: '5px 8px', border: '1px solid #ddd', borderRadius: 4, fontSize: 13, width: 120 }} />
              </label>
            </div>
          </div>

          {/* 财务状况 */}
          <div style={{ border: '1px solid #e8e8e8', borderRadius: 8, padding: 16 }}>
            <strong style={{ display: 'block', marginBottom: 12 }}>财务状况（近三年，单位：万元）</strong>
            <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr 1fr 1fr', gap: '8px 16px', fontSize: 13, alignItems: 'center' }}>
              <span style={{ color: '#666', fontWeight: 500 }}>年份</span>
              {['第一年', '第二年', '第三年'].map((y) => <span key={y} style={{ color: '#666', textAlign: 'center' }}>{y}</span>)}
              <span style={{ color: '#666' }}>营业收入</span>
              {(['year1', 'year2', 'year3'] as const).map((k) => (
                <input key={k} type="number" value={financialData.revenue[k]} onChange={(e) => setFinancialData((f) => ({ ...f, revenue: { ...f.revenue, [k]: Number(e.target.value) } }))} style={{ padding: '5px 8px', border: '1px solid #ddd', borderRadius: 4, fontSize: 12 }} />
              ))}
              <span style={{ color: '#666' }}>净利润</span>
              {(['year1', 'year2', 'year3'] as const).map((k) => (
                <input key={k} type="number" value={financialData.profit[k]} onChange={(e) => setFinancialData((f) => ({ ...f, profit: { ...f.profit, [k]: Number(e.target.value) } }))} style={{ padding: '5px 8px', border: '1px solid #ddd', borderRadius: 4, fontSize: 12 }} />
              ))}
              <span style={{ color: '#666' }}>银行授信</span>
              <input value={financialData.bankCredit} onChange={(e) => setFinancialData((f) => ({ ...f, bankCredit: e.target.value }))} placeholder="如：1000万元" style={{ gridColumn: 'span 3', padding: '5px 8px', border: '1px solid #ddd', borderRadius: 4, fontSize: 12 }} />
              <span style={{ color: '#666' }}>信用评级</span>
              <input value={financialData.creditRating} onChange={(e) => setFinancialData((f) => ({ ...f, creditRating: e.target.value }))} placeholder="如：AAA" style={{ gridColumn: 'span 3', padding: '5px 8px', border: '1px solid #ddd', borderRadius: 4, fontSize: 12 }} />
            </div>
          </div>

          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => setStep('setup')} style={{ padding: '10px 24px', background: '#f5f5f5', border: '1px solid #ddd', borderRadius: 6, cursor: 'pointer' }}>上一步</button>
            <button onClick={handleGenerate} disabled={loading}
              style={{ padding: '10px 24px', background: loading ? '#ccc' : '#52c41a', color: '#fff', border: 'none', borderRadius: 6, cursor: loading ? 'default' : 'pointer' }}>
              {loading ? '生成中...' : '生成商务标'}
            </button>
          </div>
        </div>
      )}

      {/* STEP 3: 生成结果 */}
      {step === 'result' && result && (
        <div>
          <div style={{ display: 'flex', gap: 12, marginBottom: 24, flexWrap: 'wrap' }}>
            <div style={{ padding: '12px 20px', background: '#f0f5ff', borderRadius: 8, flex: 1, minWidth: 200 }}>
              <span style={{ fontSize: 13, color: '#666' }}>项目</span>
              <strong style={{ display: 'block', fontSize: 16 }}>{result.projectName}</strong>
            </div>
            <div style={{ padding: '12px 20px', background: '#f6ffed', borderRadius: 8, flex: 1, minWidth: 200 }}>
              <span style={{ fontSize: 13, color: '#666' }}>投标单位</span>
              <strong style={{ display: 'block', fontSize: 16 }}>{result.companyName}</strong>
            </div>
            <div style={{ padding: '12px 20px', background: '#fff7e6', borderRadius: 8, flex: 1, minWidth: 200 }}>
              <span style={{ fontSize: 13, color: '#666' }}>生成时间</span>
              <strong style={{ display: 'block', fontSize: 16 }}>{new Date(result.generatedAt).toLocaleString('zh-CN')}</strong>
            </div>
          </div>

          {/* 各板块摘要 */}
          <h3 style={{ marginBottom: 12 }}>板块内容</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12, marginBottom: 24 }}>
            {Object.entries(result.sections).map(([key, section]) => (
              <div key={key} style={{ padding: 16, border: '1px solid #e8e8e8', borderRadius: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  <span style={{
                    padding: '2px 8px',
                    borderRadius: 4,
                    fontSize: 12,
                    background: '#1677ff',
                    color: '#fff',
                  }}>
                    {sectionIcons[key] || key}
                  </span>
                  <strong>{section.title || section.priceType || key}</strong>
                </div>
                {key === 'price' && (
                  <p style={{ fontSize: 13, color: '#666', margin: 0 }}>
                    {section.priceType} | 总额: {section.totalAmount} {section.currency}
                  </p>
                )}
                {key === 'qualifications' && (
                  <p style={{ fontSize: 13, color: '#666', margin: 0 }}>
                    必需 {section.requiredCount} 项 / 已完成 {section.completedCount} 项
                  </p>
                )}
                {key === 'performance' && (
                  <p style={{ fontSize: 13, color: '#666', margin: 0 }}>
                    近 {section.years} 年 {section.totalProjects} 个项目 | 总金额 {section.totalAmount} 元
                  </p>
                )}
                {key === 'service' && (
                  <p style={{ fontSize: 13, color: '#666', margin: 0 }}>
                    质保期 {section.warrantyPeriod} | 响应 {section.responseTime}
                  </p>
                )}
                {key === 'terms' && (
                  <p style={{ fontSize: 13, color: '#666', margin: 0 }}>
                    {section.terms?.length || 0} 个条款 | {section.allCompliant ? '全部合规' : '存在偏离'}
                  </p>
                )}
                {key === 'financial' && (
                  <p style={{ fontSize: 13, color: '#666', margin: 0 }}>
                    近 {section.years} 年财务数据
                  </p>
                )}
              </div>
            ))}
          </div>

          {/* 报告预览 */}
          {report && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <h3 style={{ margin: 0 }}>商务标报告</h3>
                <button
                  onClick={handleCopyReport}
                  style={{ padding: '6px 16px', background: '#52c41a', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer' }}
                >
                  复制报告
                </button>
              </div>
              <pre style={{
                padding: 16,
                background: '#f5f5f5',
                borderRadius: 8,
                fontSize: 13,
                lineHeight: 1.8,
                whiteSpace: 'pre-wrap',
                maxHeight: 400,
                overflow: 'auto',
              }}>
                {report}
              </pre>
            </div>
          )}

          <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
            <button
              onClick={handleReset}
              style={{ padding: '10px 24px', background: '#f5f5f5', border: '1px solid #ddd', borderRadius: 6, cursor: 'pointer' }}
            >
              重新生成
            </button>
            <button
              onClick={() => setStep('sections')}
              style={{ padding: '10px 24px', background: '#1677ff', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer' }}
            >
              修改配置
            </button>
          </div>
        </div>
      )}
      </div>
    </div>
  );
}

export default BusinessBidPage;
