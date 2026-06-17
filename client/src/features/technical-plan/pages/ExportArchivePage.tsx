import { useEffect, useMemo, useState } from 'react';
import { MarkdownEditor, useToast } from '../../../shared/ui';
import type { LayoutTemplateConfig, OutlineData, OutlineItem } from '../../../shared/types';
import PagedDocumentPreview from '../components/PagedDocumentPreview';

interface ExportArchivePageProps {
  outlineData: OutlineData | null;
  exporting: boolean;
  generatedContentCount: number;
  exportBlocked: boolean;
  exportBlockReason: string;
  bidderName?: string;
  previewMarkdown: string;
  previewWarnings: string[];
  previewLoading: boolean;
  layoutTemplate?: LayoutTemplateConfig | null;
  onRefreshPreview: () => Promise<void> | void;
  onExportWord: (previewMarkdown?: string) => void;
  onSavePreviewDraft: (previewMarkdown: string) => void;
  onOpenVersions: () => void;
  onBackToCheck: () => void;
}

function collectLeafItems(items: OutlineItem[]): OutlineItem[] {
  return items.flatMap((item) => item.children?.length ? collectLeafItems(item.children) : [item]);
}

function buildPreviewStats(markdown: string) {
  const text = String(markdown || '');
  return {
    words: text.replace(/\s+/g, '').length,
    headings: (text.match(/^#{1,6}\s+/gm) || []).length,
    tables: (text.match(/^\s*\|.+\|\s*$/gm) || []).length,
    images: (text.match(/!\[[^\]]*]\([^)]+\)/g) || []).length,
  };
}

function insertAtCursor(text: string, insertText: string, selectionStart?: number, selectionEnd?: number) {
  const start = Math.max(0, Number(selectionStart) || 0);
  const end = Math.max(start, Number(selectionEnd) || start);
  const before = text.slice(0, start);
  const after = text.slice(end);
  const prefix = before && !before.endsWith('\n') ? '\n\n' : '';
  const suffix = after && !after.startsWith('\n') ? '\n\n' : '';
  return `${before}${prefix}${insertText}${suffix}${after}`;
}

function ExportArchivePage({
  outlineData,
  exporting,
  generatedContentCount,
  exportBlocked,
  exportBlockReason,
  bidderName,
  previewMarkdown,
  previewWarnings,
  previewLoading,
  layoutTemplate,
  onRefreshPreview,
  onExportWord,
  onSavePreviewDraft,
  onOpenVersions,
  onBackToCheck,
}: ExportArchivePageProps) {
  const { showToast } = useToast();
  const leaves = outlineData?.outline ? collectLeafItems(outlineData.outline) : [];
  const [draft, setDraft] = useState('');
  const [mode, setMode] = useState<'edit' | 'page-preview'>('page-preview');
  const [aiRequirement, setAiRequirement] = useState('');
  const [aiRunning, setAiRunning] = useState(false);
  const [insertPosition, setInsertPosition] = useState({ start: 0, end: 0 });

  useEffect(() => {
    setDraft(previewMarkdown || '');
  }, [previewMarkdown]);

  const previewStats = useMemo(() => buildPreviewStats(draft), [draft]);

  const insertTextBlock = () => {
    setDraft((prev) => insertAtCursor(prev, '\n## 新增文字章节\n\n请在这里填写需要追加的文字内容。\n', insertPosition.start, insertPosition.end));
    showToast('已插入文字块', 'success');
  };

  const insertImageBlock = () => {
    setDraft((prev) => insertAtCursor(prev, '\n![图片说明](D:/请替换为实际图片路径.png)\n', insertPosition.start, insertPosition.end));
    showToast('已插入图片占位符', 'success');
  };

  const insertTableBlock = () => {
    setDraft((prev) => insertAtCursor(prev, '\n| 项目 | 内容 | 备注 |\n| --- | --- | --- |\n| 示例 | 请填写 | 请核对 |\n', insertPosition.start, insertPosition.end));
    showToast('已插入表格', 'success');
  };

  const rewriteWithAi = async () => {
    const selected = draft.slice(insertPosition.start, insertPosition.end).trim();
    if (!selected) {
      showToast('请先在编辑框中选中需要 AI 改写的文字', 'info');
      return;
    }
    if (!aiRequirement.trim()) {
      showToast('请先填写改写要求', 'info');
      return;
    }

    try {
      setAiRunning(true);
      const rewritten = await window.yibiao?.ai.chat({
        temperature: 0.2,
        logTitle: '合并预览 AI 改写',
        messages: [
          {
            role: 'system',
            content: '你是投标文件改写助手。只允许基于用户提供的原文和改写要求进行改写，不得新增无依据事实、金额、日期、资质、案例或承诺。输出改写后的正文，不要解释过程。',
          },
          {
            role: 'user',
            content: `改写要求：${aiRequirement.trim()}\n\n待改写原文：\n${selected}`,
          },
        ],
      });
      const nextText = String(rewritten || '').trim();
      if (!nextText) {
        showToast('AI 没有返回可用改写内容', 'error');
        return;
      }
      setDraft((prev) => prev.slice(0, insertPosition.start) + nextText + prev.slice(insertPosition.end));
      showToast('AI 改写已写入预览草稿，请人工核对后再导出', 'success');
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'AI 改写失败', 'error');
    } finally {
      setAiRunning(false);
    }
  };

  const saveDraft = () => {
    onSavePreviewDraft(draft);
    showToast('合并预览草稿已保存到当前导出步骤', 'success');
  };

  const toggleMode = () => {
    setMode((prev) => (prev === 'edit' ? 'page-preview' : 'edit'));
  };

  return (
    <div className="plan-step-body export-archive-page">
      <section className="delivery-check-hero">
        <div>
          <span className="section-kicker">STEP 08</span>
          <strong>合并预览与导出归档</strong>
          <p>这里是导出前最后一层。可以预览完整标书草稿、手动编辑、插入文字/图片/表格，或让 AI 只针对选中文字改写。正式 Word/PDF 只输出最终稿，内部标记不会写入正式文件。</p>
        </div>
      </section>

      <section className="export-archive-grid">
        <article className="export-archive-card">
          <span>技术正文</span>
          <strong>{generatedContentCount}/{leaves.length || 0}</strong>
          <p>来自技术方案流程的最终正文，按当前版式模板写入“技术标”章节。</p>
        </article>
        <article className="export-archive-card">
          <span>商务材料</span>
          <strong>项目内最新</strong>
          <p>读取当前项目已保存的商务材料草稿，作为“商务标”章节合入最终文件。</p>
        </article>
        <article className="export-archive-card">
          <span>报价文件</span>
          <strong>本地注入</strong>
          <p>读取报价管理模块的本地核算结果，导出阶段写入报价表，不经过 AI。</p>
        </article>
      </section>

      <section className="export-preview-panel">
        <div className="delivery-check-panel-head">
          <div>
            <span className="section-kicker">合并前预览编辑</span>
            <h3>完整标书草稿</h3>
          </div>
        </div>

        <div className="export-preview-stats">
          <span><strong>{previewStats.words}</strong> 字符</span>
          <span><strong>{previewStats.headings}</strong> 标题</span>
          <span><strong>{previewStats.tables}</strong> 表格行</span>
          <span><strong>{previewStats.images}</strong> 图片</span>
        </div>

        {previewWarnings.length > 0 && (
          <div className="export-warning-list export-preview-warnings">
            <strong>导出前需要核对</strong>
            {previewWarnings.map((warning) => <small key={warning}>{warning}</small>)}
          </div>
        )}

        <div className="export-preview-tools">
          <button type="button" className="secondary-action" onClick={insertTextBlock}>插入文字</button>
          <button type="button" className="secondary-action" onClick={insertImageBlock}>插入图片</button>
          <button type="button" className="secondary-action" onClick={insertTableBlock}>插入表格</button>
          <input
            type="text"
            value={aiRequirement}
            onChange={(event) => setAiRequirement(event.target.value)}
            placeholder="AI 改写要求：例如更正式、补充服务响应但不得新增事实"
          />
          <button type="button" className="primary-action" onClick={rewriteWithAi} disabled={aiRunning || !draft.trim()}>
            {aiRunning ? '改写中...' : 'AI 改写选中段落'}
          </button>
        </div>

        {mode === 'edit' ? (
          <div className="export-preview-editor">
            <MarkdownEditor
              value={draft}
              onChange={setDraft}
              onSelectionChange={setInsertPosition}
              placeholder="合并后的完整标书内容草稿。此处作为内容层编辑，右侧页面预览会套用当前版式模板。"
            />
          </div>
        ) : (
          <PagedDocumentPreview
            markdown={draft}
            layoutTemplate={layoutTemplate}
            projectName={outlineData?.project_name || ''}
            bidderName={bidderName || ''}
            toolbarActions={(
              <div className="export-preview-actions">
                <button type="button" className="secondary-action" onClick={() => void onRefreshPreview()} disabled={previewLoading || exporting}>
                  {previewLoading ? '正在合成...' : '重新合成'}
                </button>
                <button type="button" className="secondary-action" onClick={toggleMode}>
                  编辑草稿
                </button>
                <button type="button" className="primary-action" onClick={saveDraft} disabled={!draft.trim()}>保存草稿</button>
              </div>
            )}
          />
        )}
      </section>

      <section className="delivery-check-actions">
        <button type="button" className="secondary-action" onClick={onBackToCheck}>返回交付检查</button>
        <button type="button" className="secondary-action" onClick={onOpenVersions}>打开版本审阅</button>
        <button type="button" className="primary-action" onClick={() => onExportWord(draft)} disabled={exporting || exportBlocked || !outlineData || !draft.trim()}>
          {exporting ? '导出中...' : exportBlocked ? '请先补齐' : '导出完整标书 Word'}
        </button>
      </section>
      {exportBlocked && exportBlockReason && <div className="export-warning-list export-preview-warnings"><strong>当前禁止导出</strong><small>{exportBlockReason}</small></div>}
    </div>
  );
}

export default ExportArchivePage;
