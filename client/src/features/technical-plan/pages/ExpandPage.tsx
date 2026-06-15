import * as Dialog from '@radix-ui/react-dialog';
import { useCallback, useEffect, useMemo, useState, type CSSProperties, type ReactNode } from 'react';
import { MarkdownEditor, MarkdownRenderer, useToast } from '../../../shared/ui';
import type { OutlineData, OutlineItem } from '../../../shared/types';
import { countReadableWords } from '../../../shared/utils/wordCount';
import type { BackgroundTaskState, ContentGenerationOptions, ContentGenerationSectionStatus, ContentGenerationSections } from '../types';

interface ExpandPageProps {
  outlineData: OutlineData | null;
  task?: BackgroundTaskState;
  contentGenerationOptions?: ContentGenerationOptions;
  sections: ContentGenerationSections;
  onContentSaved: (item: OutlineItem, content: string) => Promise<void> | void;
}

const statusLabels: Record<ContentGenerationSectionStatus, string> = {
  idle: '待生成',
  running: '扩写中',
  success: '已生成',
  error: '失败',
};

function collectLeafItems(items: OutlineItem[]): OutlineItem[] {
  return items.flatMap((item) => item.children?.length ? collectLeafItems(item.children) : [item]);
}

function findItem(items: OutlineItem[], id: string): OutlineItem | null {
  for (const item of items) {
    if (item.id === id) return item;
    if (item.children?.length) {
      const found = findItem(item.children, id);
      if (found) return found;
    }
  }
  return null;
}

function getLeafContent(item: OutlineItem, sections: ContentGenerationSections) {
  return sections[item.id]?.content || item.content || '';
}

function getLeafStatus(item: OutlineItem, sections: ContentGenerationSections): ContentGenerationSectionStatus {
  const section = sections[item.id];
  if (section?.status) return section.status;
  return getLeafContent(item, sections).trim() ? 'success' : 'idle';
}

function ExpandPage({ outlineData, task, contentGenerationOptions, sections, onContentSaved }: ExpandPageProps) {
  const { showToast } = useToast();
  const leaves = useMemo(() => outlineData?.outline ? collectLeafItems(outlineData.outline) : [], [outlineData]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [activeItemId, setActiveItemId] = useState('');
  const [requirement, setRequirement] = useState('');
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [draftContent, setDraftContent] = useState('');
  const [confirmOpen, setConfirmOpen] = useState(false);

  const running = task?.status === 'running' || task?.status === 'pausing';
  const latestLog = task?.logs?.[task.logs.length - 1] || '';

  const activeItem = outlineData?.outline && activeItemId ? findItem(outlineData.outline, activeItemId) : null;
  const activeIsLeaf = Boolean(activeItem && !activeItem.children?.length);
  const activeContent = activeItem && activeIsLeaf ? getLeafContent(activeItem, sections) : '';
  const editing = Boolean(activeItem && activeIsLeaf && editingItemId === activeItem.id);

  const generatedLeaves = useMemo(() => leaves.filter((item) => getLeafStatus(item, sections) === 'success'), [leaves, sections]);
  const totalWords = useMemo(() => leaves.reduce((sum, item) => sum + countReadableWords(getLeafContent(item, sections)), 0), [leaves, sections]);

  useEffect(() => {
    if (!leaves.length) {
      setActiveItemId('');
      return;
    }
    if (!activeItemId || !findItem(outlineData!.outline, activeItemId)) {
      setActiveItemId(generatedLeaves[0]?.id || leaves[0].id);
    }
  }, [activeItemId, generatedLeaves, leaves, outlineData]);

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const selectAllGenerated = useCallback(() => {
    setSelectedIds(new Set(generatedLeaves.map((item) => item.id)));
  }, [generatedLeaves]);

  const clearSelection = useCallback(() => setSelectedIds(new Set()), []);

  const startExpansion = useCallback(async () => {
    const targetItemIds = [...selectedIds];
    if (!targetItemIds.length) {
      showToast('请先勾选需要扩写的小节', 'info');
      return;
    }
    if (running) {
      showToast('已有扩写或正文生成任务进行中，请稍候', 'info');
      return;
    }

    try {
      await window.yibiao?.tasks.startContentGeneration({
        regenerate: true,
        targetItemIds,
        requirement: requirement.trim(),
        generationOptions: {
          tableRequirement: contentGenerationOptions?.tableRequirement ?? 'heavy',
          useMermaidImages: contentGenerationOptions?.useMermaidImages ?? true,
          useAiImages: contentGenerationOptions?.useAiImages ?? false,
          maxAiImages: contentGenerationOptions?.maxAiImages ?? 0,
          contentConcurrency: contentGenerationOptions?.contentConcurrency ?? 5,
          enableConsistencyAudit: contentGenerationOptions?.enableConsistencyAudit ?? false,
        },
      });
      setConfirmOpen(false);
      showToast(`已启动批量扩写 ${targetItemIds.length} 个小节，可在目录查看进度`, 'success');
    } catch (error) {
      showToast(error instanceof Error ? error.message : '启动扩写任务失败', 'error');
    }
  }, [contentGenerationOptions, requirement, running, selectedIds, showToast]);

  const startEditing = useCallback(() => {
    if (!activeItem || !activeIsLeaf) {
      showToast('请选择一个叶子小节后再校准', 'info');
      return;
    }
    setEditingItemId(activeItem.id);
    setDraftContent(activeContent);
  }, [activeContent, activeIsLeaf, activeItem, showToast]);

  const cancelEditing = useCallback(() => {
    setEditingItemId(null);
    setDraftContent('');
  }, []);

  const saveEditing = useCallback(async () => {
    if (!activeItem || !activeIsLeaf) return;
    try {
      await onContentSaved(activeItem, draftContent);
      setEditingItemId(null);
      showToast('校准内容已保存', 'success');
    } catch (error) {
      showToast(error instanceof Error ? error.message : '保存失败', 'error');
    }
  }, [activeIsLeaf, activeItem, draftContent, onContentSaved, showToast]);

  if (!outlineData?.outline?.length) {
    return (
      <div className="plan-step-body content-generation-page">
        <section className="markdown-empty-state content-generation-empty">
          <strong>暂无目录</strong>
          <p>请先完成目录生成和正文生成，再进入扩写改写。</p>
        </section>
      </div>
    );
  }

  const renderTree = (items: OutlineItem[], level = 0): ReactNode => items.map((item) => {
    const isLeaf = !item.children?.length;
    const status = isLeaf ? getLeafStatus(item, sections) : 'idle';
    const words = isLeaf ? countReadableWords(getLeafContent(item, sections)) : 0;
    const checked = selectedIds.has(item.id);

    return (
      <div className="content-outline-node" key={item.id} style={{ '--content-level': level } as CSSProperties}>
        <div className={`content-outline-item is-${status}${activeItemId === item.id ? ' is-active' : ''}`}>
          {isLeaf && (
            <input
              type="checkbox"
              className="expand-select-checkbox"
              checked={checked}
              disabled={running || status !== 'success'}
              onChange={() => toggleSelect(item.id)}
              onClick={(event) => event.stopPropagation()}
              aria-label={`选择小节 ${item.id}`}
            />
          )}
          <button type="button" className="content-outline-text expand-outline-text" onClick={() => setActiveItemId(item.id)}>
            <strong>{item.id} {item.title}</strong>
            <small>{isLeaf ? `${statusLabels[status]} · ${words} 字` : `${collectLeafItems(item.children || []).length} 个小节`}</small>
          </button>
        </div>
        {item.children?.length ? renderTree(item.children, level + 1) : null}
      </div>
    );
  });

  return (
    <div className="plan-step-body content-generation-page">
      <section className="content-generation-command-bar">
        <div>
          <span className="section-kicker">STEP 06</span>
          <strong>扩写改写</strong>
          <p>勾选已生成的小节，填写扩写要求后批量改写，再人工校准定稿。</p>
        </div>
        <div className="content-generation-stats" aria-label="扩写统计">
          <span><strong>{generatedLeaves.length}</strong> 可扩写</span>
          <span><strong>{selectedIds.size}</strong> 已勾选</span>
          <span><strong>{totalWords}</strong> 字</span>
        </div>
        <div className="content-generation-actions">
          <button type="button" className="secondary-action" onClick={selectAllGenerated} disabled={running || !generatedLeaves.length}>全选已生成</button>
          <button type="button" className="secondary-action" onClick={clearSelection} disabled={running || !selectedIds.size}>清空勾选</button>
          <button type="button" className="primary-action" onClick={() => setConfirmOpen(true)} disabled={running || !selectedIds.size}>
            {running ? '扩写中...' : '批量扩写'}
          </button>
        </div>
      </section>

      {running && (
        <p className="content-generation-config-note">{latestLog || '正在后台扩写所选小节，模型返回后会实时更新正文。'}</p>
      )}

      <section className="content-generation-workspace">
        <aside className="content-outline-panel">
          <div className="analysis-result-head">
            <strong>标书目录</strong>
            <span>{leaves.length} 个小节</span>
          </div>
          <div className="content-outline-list">
            {renderTree(outlineData.outline)}
          </div>
        </aside>

        <article className="content-reader-panel">
          <div className="content-reader-head">
            <div>
              <span className="section-kicker">人工校准</span>
              <strong>{activeItem ? `${activeItem.id} ${activeItem.title}` : '选择小节'}</strong>
              <p>{activeItem?.description || '选择左侧小节查看并校准扩写后的正文。'}</p>
            </div>
            <div className="content-reader-actions">
              {editing ? (
                <>
                  <button type="button" className="primary-action" onClick={saveEditing}>保存</button>
                  <button type="button" className="secondary-action" onClick={cancelEditing}>取消</button>
                </>
              ) : (
                <button type="button" className="secondary-action" onClick={startEditing} disabled={!activeItem || !activeIsLeaf || running}>校准编辑</button>
              )}
            </div>
          </div>

          {activeItem && activeIsLeaf && editing ? (
            <MarkdownEditor value={draftContent} onChange={setDraftContent} placeholder="输入 Markdown 正文..." />
          ) : activeItem && activeIsLeaf && activeContent.trim() ? (
            <div className="markdown-viewer content-generation-output">
              <MarkdownRenderer>{activeContent}</MarkdownRenderer>
            </div>
          ) : (
            <div className="markdown-empty-state content-generation-empty">
              <strong>暂无正文</strong>
              <p>该小节尚未生成正文，请先在生成正文步骤完成，再回到这里扩写。</p>
            </div>
          )}
        </article>
      </section>

      <Dialog.Root open={confirmOpen} onOpenChange={setConfirmOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="content-regenerate-modal" />
          <Dialog.Content className="content-regenerate-card">
            <div className="content-regenerate-card-head">
              <span className="section-kicker">批量扩写</span>
              <Dialog.Title>扩写所选 {selectedIds.size} 个小节</Dialog.Title>
              <Dialog.Description>填写本次扩写的统一要求，AI 会在保留章节结构的前提下重写选中小节正文。</Dialog.Description>
            </div>
            <textarea
              value={requirement}
              onChange={(event) => setRequirement(event.target.value)}
              placeholder="例如：补充实施细节和数据支撑，强化与招标技术要求的呼应，语言更专业严谨。"
            />
            <div className="content-regenerate-actions">
              <Dialog.Close className="secondary-action" type="button">取消</Dialog.Close>
              <button type="button" className="primary-action" onClick={startExpansion} disabled={running || !selectedIds.size}>开始扩写</button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  );
}

export default ExpandPage;
