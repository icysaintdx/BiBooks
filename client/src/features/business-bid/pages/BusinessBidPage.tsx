import { useCallback, useEffect, useState } from 'react';
import { useToast } from '../../../shared/ui';
import type { RepairTaskInput } from '../../../shared/types/ipc';
import { markRepairTasksForReview, notifyRepairTasksChanged } from '../../../shared/utils/repairTaskReview';

type BidStep = 'setup' | 'sections' | 'result';

interface PriceTemplate {
  name: string;
  description: string;
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

interface PriceItem {
  name: string;
  description: string;
  amount: number;
  unit: string;
}

interface QualificationItem {
  id: string;
  name: string;
  required: boolean;
  status: string;
  certificateNo: string;
  validFrom: string;
  validTo: string;
}

interface PerformanceItem {
  name: string;
  client: string;
  contractAmount: number;
  completionDate: string;
  description: string;
}

const sectionLabels: Record<string, string> = {
  price: '报价',
  terms: '条款',
  qualifications: '资质',
  performance: '业绩',
  financial: '财务',
  service: '售后',
};

function buildCommercialBidRepairTasks({
  bidId,
  projectName,
  companyName,
  totalAmount,
  priceItems,
  qualifications,
  projects,
}: {
  bidId: string;
  projectName: string;
  companyName: string;
  totalAmount: number;
  priceItems: PriceItem[];
  qualifications: QualificationItem[];
  projects: PerformanceItem[];
}): RepairTaskInput[] {
  const tasks: RepairTaskInput[] = [];
  if (!projectName.trim() || !companyName.trim()) {
    tasks.push({
      id: `commercial-required:${bidId}`,
      title: '商务材料基本信息不完整',
      sourceModule: 'commercial_bid',
      sourceRecordId: bidId,
      targetType: 'commercial_section',
      targetId: bidId,
      severity: 'major',
      description: '项目名称或投标单位为空，商务材料草稿需要人工复核。',
      suggestion: '回到商务标页面补齐项目名称和投标单位。',
      patch: {
        source: 'commercial_bid',
        field: 'projectName/companyName',
        original: `${projectName} / ${companyName}`,
        suggested: '补齐项目名称与投标单位',
        reason: 'missing_basic_info',
        references: [{ type: 'database', label: '商务材料草稿', value: bidId }],
      },
    });
  }
  if (totalAmount <= 0 && priceItems.every((item) => Number(item.amount) <= 0)) {
    tasks.push({
      id: `commercial-price:${bidId}`,
      title: '商务材料缺少有效报价引用',
      sourceModule: 'commercial_bid',
      sourceRecordId: bidId,
      targetType: 'commercial_section',
      targetId: bidId,
      severity: 'critical',
      description: '商务材料没有有效总价或费用明细，最终合成时无法形成商务报价说明。',
      suggestion: '先在报价管理页确认真实报价，再回到商务标页面引用或填写报价说明。',
      patch: {
        source: 'commercial_bid',
        field: 'totalAmount',
        original: String(totalAmount),
        suggested: '由报价管理页补齐后再生成商务材料草稿',
        reason: 'missing_total_amount',
        references: [{ type: 'database', label: '商务报价引用', value: bidId }],
      },
    });
  }
  for (const qual of qualifications.filter((item) => item.required && item.status !== 'completed')) {
    tasks.push({
      id: `commercial-qualification:${bidId}:${qual.id}`,
      title: `必备资质待补齐：${qual.name}`,
      sourceModule: 'commercial_bid',
      sourceRecordId: bidId,
      targetType: 'qualification',
      targetId: qual.id,
      severity: 'major',
      description: '该资质为商务材料必备项，但尚未标记完成。',
      suggestion: '补充证书编号、有效期、附件，或明确标记不适用原因。',
      patch: {
        source: 'commercial_bid',
        field: `qualifications.${qual.id}`,
        original: JSON.stringify(qual),
        suggested: '补齐资质证书编号、有效期、附件和完成状态',
        reason: 'missing_required_qualification',
        references: [{ type: 'database', label: '资质项', value: qual.id }],
      },
    });
  }
  if (projects.length === 0) {
    tasks.push({
      id: `commercial-performance:${bidId}`,
      title: '商务材料缺少业绩证明',
      sourceModule: 'commercial_bid',
      sourceRecordId: bidId,
      targetType: 'commercial_section',
      targetId: bidId,
      severity: 'major',
      description: '当前商务材料没有业绩记录。多数标书不能只写说明，需要合同、验收报告等证明附件。',
      suggestion: '从企业知识库选择业绩，或新增项目业绩并绑定证明材料。',
      patch: {
        source: 'commercial_bid',
        field: 'performance',
        original: '[]',
        suggested: '补充业绩列表及证明附件',
        reason: 'missing_performance',
        references: [{ type: 'database', label: '商务材料草稿', value: bidId }],
      },
    });
  }
  return tasks;
}

function BusinessBidPage() {
  const { showToast } = useToast();
  const [step, setStep] = useState<BidStep>('setup');
  const [projectName, setProjectName] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [priceType, setPriceType] = useState('lumpSum');
  const [priceTemplates, setPriceTemplates] = useState<Record<string, PriceTemplate>>({});
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<CommercialBidResult | null>(null);
  const [report, setReport] = useState('');
  const [savedBids, setSavedBids] = useState<any[]>([]);

  const [priceItems, setPriceItems] = useState<PriceItem[]>([]);
  const [totalAmount, setTotalAmount] = useState(0);
  const [qualifications, setQualifications] = useState<QualificationItem[]>([]);
  const [projects, setProjects] = useState<PerformanceItem[]>([]);
  const [warrantyPeriod, setWarrantyPeriod] = useState('1年');
  const [responseTime, setResponseTime] = useState('24小时');
  const [financialData, setFinancialData] = useState({
    revenue: { year1: 0, year2: 0, year3: 0 },
    profit: { year1: 0, year2: 0, year3: 0 },
    bankCredit: '',
    creditRating: '',
  });

  useEffect(() => {
    const load = async () => {
      try {
        const [templatesData, qualData, listData, projectState] = await Promise.all([
          window.yibiao?.commercialBid.getPriceTemplates(),
          window.yibiao?.commercialBid.getQualificationTypes(),
          window.yibiao?.commercialBid.list(),
          window.yibiao?.projectWorkspace.list(),
        ]);
        const currentProject = (projectState?.projects || []).find((project) => project.id === projectState?.currentProjectId);
        if (currentProject?.name) setProjectName((value) => value || currentProject.name);
        if (templatesData) setPriceTemplates(templatesData as Record<string, PriceTemplate>);
        if (qualData) {
          setQualifications((qualData as QualType[]).map((item) => ({
            ...item,
            status: 'pending',
            certificateNo: '',
            validFrom: '',
            validTo: '',
          })));
        }
        if (listData) setSavedBids(listData as any[]);
      } catch (error) {
        showToast(`加载商务材料数据失败: ${error instanceof Error ? error.message : String(error)}`, 'error');
      }
    };
    void load();
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
      if (!bid) return;

      const rpt = await window.yibiao?.commercialBid.generateReport(bid);
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

      const repairTasks = buildCommercialBidRepairTasks({ bidId: id, projectName, companyName, totalAmount, priceItems, qualifications, projects });
      if (repairTasks.length > 0 && window.yibiao?.repairTasks?.save) {
        await Promise.all(repairTasks.map((task) => window.yibiao?.repairTasks?.save(task)));
        notifyRepairTasksChanged();
      } else {
        await markRepairTasksForReview({
          sourceModule: 'commercial_bid',
          targetType: 'commercial_section',
          targetId: id,
          decision: '商务材料草稿已重新生成，等待交付检查复核',
        });
      }

      setResult(bid);
      setReport(rpt || '');
      setStep('result');
      if (saved) setSavedBids((prev) => [saved, ...prev]);
      showToast('商务材料草稿已生成并保存', 'success');
    } catch (error) {
      showToast(`生成商务材料失败: ${error instanceof Error ? error.message : String(error)}`, 'error');
    } finally {
      setLoading(false);
    }
  }, [companyName, financialData, priceItems, priceType, projectName, projects, qualifications, responseTime, showToast, totalAmount, warrantyPeriod]);

  const handleCopyReport = useCallback(() => {
    navigator.clipboard.writeText(report)
      .then(() => showToast('商务材料草稿已复制到剪贴板', 'success'))
      .catch(() => showToast('复制失败', 'error'));
  }, [report, showToast]);

  const handleDeleteSaved = useCallback(async (id: string) => {
    try {
      await window.yibiao?.commercialBid.delete(id);
      setSavedBids((prev) => prev.filter((item) => item.id !== id));
      showToast('已删除', 'success');
    } catch (error) {
      showToast(`删除失败: ${error instanceof Error ? error.message : String(error)}`, 'error');
    }
  }, [showToast]);

  return (
    <div className="module-page module-page-wide business-bid-page">
      <header className="module-page-header">
        <div>
          <span className="section-kicker">COMMERCIAL</span>
          <h2>商务标</h2>
          <p>这里生成的是商务材料草稿和结构化中间层，不是最终递交标书。最终 Word/PDF 由完整标书合成器统一套版式、插入附件并注入本地报价。</p>
        </div>
      </header>

      <div className="business-bid-layout">
        {savedBids.length > 0 && (
          <aside className="module-panel business-history-panel">
            <strong className="module-section-title">历史草稿</strong>
            <div className="module-card-list">
              {savedBids.map((item) => (
                <article className="business-history-card" key={item.id}>
                  <strong title={item.projectName}>{item.projectName}</strong>
                  <span>{item.updatedAt?.slice(0, 10) || ''}</span>
                  <div className="module-button-row">
                    <button type="button" className="secondary-action module-action" onClick={() => {
                      setProjectName(item.projectName || '');
                      setCompanyName(item.companyName || '');
                      setPriceType(item.priceType || 'lumpSum');
                      if (item.result) {
                        setResult(item.result);
                        setReport(item.report || '');
                        setStep('result');
                      } else {
                        setStep('setup');
                      }
                    }}>加载</button>
                    <button type="button" className="danger-action module-action" onClick={() => void handleDeleteSaved(item.id)}>删除</button>
                  </div>
                </article>
              ))}
            </div>
          </aside>
        )}

        <main className="business-bid-main">
          <div className="module-note-banner">
            边界：资质和业绩应优先来自企业知识库；证书编号、有效期和附件后续由 OCR + 人工确认入库；报价只引用报价管理模块的本地核算结果，不由 AI 猜测。
          </div>

          <div className="business-step-tabs">
            {(['setup', 'sections', 'result'] as BidStep[]).map((item, index) => (
              <button
                key={item}
                type="button"
                className={`business-step-tab ${step === item ? 'is-active' : ''}`}
                onClick={() => {
                  if (item === 'setup') setStep('setup');
                  if (item === 'sections' && projectName.trim() && companyName.trim()) setStep('sections');
                  if (item === 'result' && result) setStep('result');
                }}
              >
                {['基本信息', '材料配置', '草稿结果'][index]}
              </button>
            ))}
          </div>

          {step === 'setup' && (
            <section className="module-panel module-form-panel">
              <div className="module-form-grid">
                <Field label="项目名称 *"><input value={projectName} onChange={(event) => setProjectName(event.target.value)} placeholder="输入招标项目名称" /></Field>
                <Field label="投标单位 *"><input value={companyName} onChange={(event) => setCompanyName(event.target.value)} placeholder="输入投标单位名称" /></Field>
              </div>
              <strong className="module-section-title">报价方式</strong>
              <div className="business-template-grid">
                {Object.entries(priceTemplates).map(([key, template]) => (
                  <button key={key} type="button" className={`business-template-card ${priceType === key ? 'is-selected' : ''}`} onClick={() => setPriceType(key)}>
                    <strong>{template.name}</strong>
                    <span>{template.description}</span>
                  </button>
                ))}
              </div>
              <div>
                <button type="button" className="primary-action module-action" onClick={() => {
                  if (!projectName.trim() || !companyName.trim()) {
                    showToast('请填写项目名称和投标单位', 'error');
                    return;
                  }
                  setStep('sections');
                }}>下一步</button>
              </div>
            </section>
          )}

          {step === 'sections' && (
            <section className="module-stack">
              <Panel title="投标报价说明">
                <div className="module-form-row">
                  <Field label="总金额（元）"><input type="number" value={totalAmount} onChange={(event) => setTotalAmount(Number(event.target.value))} /></Field>
                  <button type="button" className="secondary-action module-action" onClick={() => setPriceItems((prev) => [...prev, { name: '', description: '', amount: 0, unit: '项' }])}>添加费用项</button>
                </div>
                <div className="business-row-list">
                  {priceItems.map((item, index) => (
                    <div className="business-price-row" key={index}>
                      <input value={item.name} onChange={(event) => setPriceItems((prev) => prev.map((candidate, i) => i === index ? { ...candidate, name: event.target.value } : candidate))} placeholder="费用项名称" />
                      <input value={item.description} onChange={(event) => setPriceItems((prev) => prev.map((candidate, i) => i === index ? { ...candidate, description: event.target.value } : candidate))} placeholder="说明" />
                      <input type="number" value={item.amount} onChange={(event) => setPriceItems((prev) => prev.map((candidate, i) => i === index ? { ...candidate, amount: Number(event.target.value) } : candidate))} />
                      <input value={item.unit} onChange={(event) => setPriceItems((prev) => prev.map((candidate, i) => i === index ? { ...candidate, unit: event.target.value } : candidate))} />
                      <button type="button" className="module-link-button is-danger" onClick={() => setPriceItems((prev) => prev.filter((_, i) => i !== index))}>删除</button>
                    </div>
                  ))}
                </div>
                {!priceItems.length && <p>当前没有费用项。正式报价应从“报价管理”模块读取本地核算结果。</p>}
              </Panel>

              <Panel title="资质证明材料">
                <div className="business-row-list">
                  {qualifications.map((item, index) => (
                    <div className="business-qualification-row" key={item.id}>
                      <span>{item.name}{item.required && <b> *</b>}</span>
                      <input value={item.certificateNo} onChange={(event) => setQualifications((prev) => prev.map((candidate, i) => i === index ? { ...candidate, certificateNo: event.target.value } : candidate))} placeholder="证书编号" />
                      <input type="date" value={item.validFrom} onChange={(event) => setQualifications((prev) => prev.map((candidate, i) => i === index ? { ...candidate, validFrom: event.target.value } : candidate))} />
                      <input type="date" value={item.validTo} onChange={(event) => setQualifications((prev) => prev.map((candidate, i) => i === index ? { ...candidate, validTo: event.target.value } : candidate))} />
                      <select value={item.status} onChange={(event) => setQualifications((prev) => prev.map((candidate, i) => i === index ? { ...candidate, status: event.target.value } : candidate))}>
                        <option value="pending">待准备</option>
                        <option value="completed">已完成</option>
                        <option value="na">不适用</option>
                      </select>
                    </div>
                  ))}
                </div>
              </Panel>

              <Panel title="业绩证明材料">
                <button type="button" className="secondary-action module-action" onClick={() => setProjects((prev) => [...prev, { name: '', client: '', contractAmount: 0, completionDate: '', description: '' }])}>添加业绩</button>
                <div className="business-row-list">
                  {projects.map((item, index) => (
                    <div className="business-performance-row" key={index}>
                      <input value={item.name} onChange={(event) => setProjects((prev) => prev.map((candidate, i) => i === index ? { ...candidate, name: event.target.value } : candidate))} placeholder="项目名称" />
                      <input value={item.client} onChange={(event) => setProjects((prev) => prev.map((candidate, i) => i === index ? { ...candidate, client: event.target.value } : candidate))} placeholder="客户名称" />
                      <input type="number" value={item.contractAmount} onChange={(event) => setProjects((prev) => prev.map((candidate, i) => i === index ? { ...candidate, contractAmount: Number(event.target.value) } : candidate))} placeholder="合同金额" />
                      <input type="date" value={item.completionDate} onChange={(event) => setProjects((prev) => prev.map((candidate, i) => i === index ? { ...candidate, completionDate: event.target.value } : candidate))} />
                      <button type="button" className="module-link-button is-danger" onClick={() => setProjects((prev) => prev.filter((_, i) => i !== index))}>删除</button>
                    </div>
                  ))}
                </div>
                {!projects.length && <p>当前没有业绩。正式商务标通常需要合同、验收报告等证明附件。</p>}
              </Panel>

              <Panel title="售后服务与财务状况">
                <div className="module-form-grid">
                  <Field label="质保期"><input value={warrantyPeriod} onChange={(event) => setWarrantyPeriod(event.target.value)} /></Field>
                  <Field label="响应时间"><input value={responseTime} onChange={(event) => setResponseTime(event.target.value)} /></Field>
                  <Field label="银行授信"><input value={financialData.bankCredit} onChange={(event) => setFinancialData((prev) => ({ ...prev, bankCredit: event.target.value }))} /></Field>
                  <Field label="信用评级"><input value={financialData.creditRating} onChange={(event) => setFinancialData((prev) => ({ ...prev, creditRating: event.target.value }))} /></Field>
                </div>
              </Panel>

              <div className="module-button-row">
                <button type="button" className="secondary-action module-action" onClick={() => setStep('setup')}>上一步</button>
                <button type="button" className="primary-action module-action" onClick={() => void handleGenerate()} disabled={loading}>{loading ? '生成中...' : '生成商务材料草稿'}</button>
              </div>
            </section>
          )}

          {step === 'result' && result && (
            <section className="module-panel">
              <div className="business-info-grid">
                <InfoCard label="项目" value={result.projectName} />
                <InfoCard label="投标单位" value={result.companyName} />
                <InfoCard label="生成时间" value={new Date(result.generatedAt).toLocaleString('zh-CN')} />
              </div>

              <strong className="module-section-title">材料摘要</strong>
              <div className="business-summary-grid">
                {Object.entries(result.sections).map(([key, section]) => (
                  <div className="business-summary-card" key={key}>
                    <span>{sectionLabels[key] || key}</span>
                    <strong>{section.title || section.priceType || key}</strong>
                    <small>{summarizeSection(key, section)}</small>
                  </div>
                ))}
              </div>

              {report && (
                <div>
                  <div className="module-page-header business-preview-head">
                    <strong className="module-section-title">Markdown 中间层预览</strong>
                    <button type="button" className="secondary-action module-action" onClick={handleCopyReport}>复制草稿</button>
                  </div>
                  <pre className="module-previewer">{report}</pre>
                </div>
              )}

              <div className="module-button-row business-result-actions">
                <button type="button" className="secondary-action module-action" onClick={() => { setResult(null); setReport(''); setStep('setup'); }}>重新生成</button>
                <button type="button" className="primary-action module-action" onClick={() => setStep('sections')}>修改配置</button>
              </div>
            </section>
          )}
        </main>
      </div>
    </div>
  );
}

function summarizeSection(key: string, section: any) {
  if (key === 'price') return `${section.priceType}，总额 ${section.totalAmount || 0} ${section.currency || ''}`;
  if (key === 'qualifications') return `必备 ${section.requiredCount || 0} 项，已完成 ${section.completedCount || 0} 项`;
  if (key === 'performance') return `近 ${section.years || 3} 年业绩 ${section.totalProjects || 0} 个，金额 ${section.totalAmount || 0} 元`;
  if (key === 'service') return `质保 ${section.warrantyPeriod || '-'}，响应 ${section.responseTime || '-'}`;
  if (key === 'terms') return `${section.terms?.length || 0} 个条款，${section.allCompliant ? '默认响应' : '存在偏离'}`;
  if (key === 'financial') return `授信 ${section.bankCredit || '未填写'}，评级 ${section.creditRating || '未填写'}`;
  return '已生成';
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="module-field"><span>{label}</span>{children}</label>;
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return <div className="module-panel"><strong className="module-section-title">{title}</strong>{children}</div>;
}

function InfoCard({ label, value }: { label: string; value: string }) {
  return <div className="business-info-card"><span>{label}</span><strong>{value || '-'}</strong></div>;
}

export default BusinessBidPage;
