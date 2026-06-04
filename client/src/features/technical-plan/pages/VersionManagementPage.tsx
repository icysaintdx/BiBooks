import { useEffect, useState } from 'react';
import { useToast } from '../../../shared/ui';
import type { VersionSummary, VersionComparison, VersionChangeItem } from '../../../shared/types';

interface VersionManagementPageProps {
  onRestore?: () => void;
}

function VersionManagementPage({ onRestore }: VersionManagementPageProps) {
  const { showToast } = useToast();
  const [versions, setVersions] = useState<VersionSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveName, setSaveName] = useState('');
  const [saveDescription, setSaveDescription] = useState('');
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [comparison, setComparison] = useState<VersionComparison | null>(null);
  const [compareMode, setCompareMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const loadVersions = async () => {
    try {
      setLoading(true);
      const list = await window.yibiao?.versions.list();
      if (list) setVersions(list as VersionSummary[]);
    } catch (error) {
      showToast(error instanceof Error ? error.message : '加载版本列表失败', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadVersions();
  }, []);

  const handleSave = async () => {
    try {
      setSaving(true);
      await window.yibiao?.versions.save({ name: saveName || undefined, description: saveDescription || undefined });
      showToast('版本保存成功', 'success');
      setShowSaveDialog(false);
      setSaveName('');
      setSaveDescription('');
      loadVersions();
    } catch (error) {
      showToast(error instanceof Error ? error.message : '保存版本失败', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleRestore = async (id: string) => {
    if (!confirm('确定要恢复到此版本吗？当前未保存的更改将丢失。')) return;

    try {
      const result = await window.yibiao?.versions.restore(id);
      if (result) {
        showToast(`已恢复到版本：${result.name}`, 'success');
        onRestore?.();
      }
    } catch (error) {
      showToast(error instanceof Error ? error.message : '恢复版本失败', 'error');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('确定要删除此版本吗？')) return;

    try {
      await window.yibiao?.versions.delete(id);
      showToast('版本已删除', 'success');
      loadVersions();
    } catch (error) {
      showToast(error instanceof Error ? error.message : '删除版本失败', 'error');
    }
  };

  const handleCompare = async () => {
    if (selectedIds.length !== 2) {
      showToast('请选择两个版本进行对比', 'info');
      return;
    }

    try {
      const result = await window.yibiao?.versions.compare({ versionId1: selectedIds[0], versionId2: selectedIds[1] });
      if (result) setComparison(result as VersionComparison);
    } catch (error) {
      showToast(error instanceof Error ? error.message : '版本对比失败', 'error');
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      if (prev.includes(id)) return prev.filter((i) => i !== id);
      if (prev.length >= 2) return [prev[1], id];
      return [...prev, id];
    });
  };

  const formatDate = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
    } catch {
      return dateStr;
    }
  };

  const stepLabels: Record<string, string> = {
    'document-analysis': '上传文件',
    'bid-analysis': '招标解析',
    'outline-generation': '目录生成',
    'global-facts': '全局事实',
    'content-edit': '正文生成',
    expand: '扩写改写',
  };

  return (
    <div className="version-management-page">
      <div className="version-management-header">
        <div>
          <span className="section-kicker">版本管理</span>
          <strong>技术方案版本快照</strong>
          <p>保存当前工作进度，支持版本历史查看和恢复。</p>
        </div>
        <div className="version-management-actions">
          {compareMode && (
            <button type="button" className="secondary-action" onClick={handleCompare} disabled={selectedIds.length !== 2}>
              对比选中版本
            </button>
          )}
          <button type="button" className="secondary-action" onClick={() => setCompareMode((prev) => !prev)}>
            {compareMode ? '取消对比' : '版本对比'}
          </button>
          <button type="button" className="primary-action" onClick={() => setShowSaveDialog(true)}>
            保存当前版本
          </button>
        </div>
      </div>

      {/* 保存对话框 */}
      {showSaveDialog && (
        <div className="version-save-dialog">
          <h4>保存版本快照</h4>
          <label>
            <span>版本名称</span>
            <input value={saveName} onChange={(e) => setSaveName(e.target.value)} placeholder={`版本 ${new Date().toLocaleString('zh-CN')}`} />
          </label>
          <label>
            <span>版本说明（可选）</span>
            <textarea value={saveDescription} onChange={(e) => setSaveDescription(e.target.value)} placeholder="记录本次修改的主要内容" rows={2} />
          </label>
          <div className="version-save-dialog-actions">
            <button type="button" className="secondary-action" onClick={() => setShowSaveDialog(false)}>取消</button>
            <button type="button" className="primary-action" onClick={handleSave} disabled={saving}>{saving ? '保存中...' : '保存'}</button>
          </div>
        </div>
      )}

      {/* 版本对比结果 */}
      {comparison && (
        <div className="version-comparison-result">
          <h4>版本对比结果</h4>
          <div className="version-comparison-summary">
            <span>{comparison.version1.name}</span>
            <span>→</span>
            <span>{comparison.version2.name}</span>
            <span className="version-comparison-stats">
              共 {comparison.totalChanges} 处变更：
              新增 {comparison.addedCount}，修改 {comparison.modifiedCount}，删除 {comparison.removedCount}
            </span>
          </div>
          {comparison.outlineChanges.length > 0 && (
            <div className="version-comparison-changes">
              {comparison.outlineChanges.map((change, idx) => (
                <div key={idx} className={`version-change-item is-${change.type}`}>
                  <span className="version-change-type">
                    {change.type === 'added' ? '新增' : change.type === 'removed' ? '删除' : '修改'}
                  </span>
                  <span className="version-change-id">{change.id}</span>
                  <span className="version-change-title">{change.title}</span>
                  {change.fields && (
                    <span className="version-change-fields">
                      {change.fields.map((f) => f.field).join('、')}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
          <button type="button" className="secondary-action" onClick={() => setComparison(null)}>关闭对比</button>
        </div>
      )}

      {/* 版本列表 */}
      <div className="version-list">
        {loading ? (
          <div className="version-list-empty">加载中...</div>
        ) : versions.length === 0 ? (
          <div className="version-list-empty">
            <strong>暂无版本快照</strong>
            <p>点击"保存当前版本"创建第一个版本快照。</p>
          </div>
        ) : (
          versions.map((version) => (
            <div
              key={version.id}
              className={`version-item${selectedIds.includes(version.id) ? ' is-selected' : ''}`}
              onClick={compareMode ? () => toggleSelect(version.id) : undefined}
            >
              <div className="version-item-main">
                <div className="version-item-head">
                  {compareMode && (
                    <input type="checkbox" checked={selectedIds.includes(version.id)} onChange={() => toggleSelect(version.id)} />
                  )}
                  <strong>{version.name}</strong>
                  <span className="version-item-step">{stepLabels[version.step] || version.step}</span>
                </div>
                {version.description && <p className="version-item-desc">{version.description}</p>}
                <div className="version-item-meta">
                  <span>{version.outlineNodeCount} 个目录节点</span>
                  <span>{version.contentWordCount.toLocaleString()} 字</span>
                  <span>{formatDate(version.createdAt)}</span>
                </div>
              </div>
              {!compareMode && (
                <div className="version-item-actions">
                  <button type="button" className="secondary-action" onClick={() => handleRestore(version.id)}>恢复</button>
                  <button type="button" className="danger-action" onClick={() => handleDelete(version.id)}>删除</button>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export default VersionManagementPage;
