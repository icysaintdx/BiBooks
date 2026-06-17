import { useMemo, useState } from 'react';
import './ProjectManagementPage.css';
import type { BidProjectSummary, TenderFileSelectionResult } from '../../../shared/types/ipc';
import type { SectionId } from '../../../shared/types/navigation';

interface ProjectManagementPageProps {
  currentProjectId: string;
  projects: BidProjectSummary[];
  onCreateProject: (input: { name: string; tenderSourcePath?: string; tenderFileName?: string; notes?: string; password?: string }) => Promise<void> | void;
  onDeleteProject: (projectId: string) => Promise<void> | void;
  onDestroyProject: (projectId: string) => Promise<void> | void;
  onEnterProject: (projectId: string, section?: SectionId, password?: string) => Promise<void> | void;
  onRestoreProject: (projectId: string) => Promise<void> | void;
  onSelectTenderFile: () => Promise<TenderFileSelectionResult>;
  onUpdateProject: (projectId: string, patch: Partial<Pick<BidProjectSummary, 'name' | 'tenderFileName' | 'notes' | 'status'>> & { tenderSourcePath?: string; password?: string }) => Promise<void> | void;
}

const statusLabels: Record<string, string> = {
  active: '进行中',
  archived: '已归档',
  won: '已中标',
  lost: '未中标',
  deleted: '回收站',
};

function formatDate(value?: string) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleString('zh-CN', { hour12: false });
}

function activeLastSection(project: BidProjectSummary): SectionId {
  return project.lastSection === 'project-management' ? 'technical-plan' : project.lastSection;
}

function projectStateText(project: BidProjectSummary) {
  if (project.deletedAt) return '回收站';
  if (project.hasPassword && !project.isUnlocked) return '需密码';
  return statusLabels[project.status] || project.status || '进行中';
}

export default function ProjectManagementPage({
  currentProjectId,
  projects,
  onCreateProject,
  onDeleteProject,
  onDestroyProject,
  onEnterProject,
  onRestoreProject,
  onSelectTenderFile,
  onUpdateProject,
}: ProjectManagementPageProps) {
  const [newName, setNewName] = useState('');
  const [newTenderFile, setNewTenderFile] = useState<{ filePath: string; fileName: string } | null>(null);
  const [newNotes, setNewNotes] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [showRecycleBin, setShowRecycleBin] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [editPassword, setEditPassword] = useState('');
  const [unlockingId, setUnlockingId] = useState<string | null>(null);
  const [unlockPassword, setUnlockPassword] = useState('');
  const [deleteCandidate, setDeleteCandidate] = useState<BidProjectSummary | null>(null);
  const [deleteConfirmName, setDeleteConfirmName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const visibleProjects = useMemo(
    () => projects.filter((project) => (showRecycleBin ? Boolean(project.deletedAt) : !project.deletedAt)),
    [projects, showRecycleBin],
  );
  const sortedProjects = useMemo(
    () => [...visibleProjects].sort((a, b) => String(b.lastOpenedAt || b.updatedAt).localeCompare(String(a.lastOpenedAt || a.updatedAt))),
    [visibleProjects],
  );
  const currentProject = projects.find((project) => project.id === currentProjectId) || null;
  const deletedCount = projects.filter((project) => project.deletedAt).length;

  const handleSelectTenderFile = async () => {
    setError(null);
    const result = await onSelectTenderFile();
    if (!result.success || !result.filePath || !result.fileName) return;

    setNewTenderFile({ filePath: result.filePath, fileName: result.fileName });
    const suggestedName = result.suggestedProjectName || result.fileName.replace(/\.[^.]+$/, '');
    if (!newName.trim()) {
      setNewName(suggestedName);
      return;
    }
    if (window.confirm('是否使用招标文件名称更新项目名称？')) {
      setNewName(suggestedName);
    }
  };

  const handleCreate = async () => {
    const name = newName.trim();
    if (!name) {
      setError('请填写项目名称，或者先选择招标文件自动带入项目名称。');
      return;
    }

    setBusy(true);
    setError(null);
    try {
      await onCreateProject({
        name,
        tenderSourcePath: newTenderFile?.filePath,
        tenderFileName: newTenderFile?.fileName,
        notes: newNotes.trim(),
        password: newPassword.trim(),
      });
      setNewName('');
      setNewTenderFile(null);
      setNewNotes('');
      setNewPassword('');
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  const startEdit = (project: BidProjectSummary) => {
    setEditingId(project.id);
    setEditName(project.name || '');
    setEditNotes(project.notes || '');
    setEditPassword('');
    setError(null);
  };

  const saveEdit = async (projectId: string) => {
    const name = editName.trim();
    if (!name) {
      setError('项目名称不能为空。');
      return;
    }

    setBusy(true);
    setError(null);
    try {
      const patch: Partial<Pick<BidProjectSummary, 'name' | 'notes'>> & { password?: string } = { name, notes: editNotes.trim() };
      if (editPassword.trim()) patch.password = editPassword.trim();
      await onUpdateProject(projectId, patch);
      setEditingId(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  const enterProject = async (project: BidProjectSummary) => {
    if (project.hasPassword && !project.isUnlocked) {
      setUnlockingId(project.id);
      setUnlockPassword('');
      setError(null);
      return;
    }
    await onEnterProject(project.id, activeLastSection(project));
  };

  const unlockAndEnter = async (project: BidProjectSummary) => {
    setBusy(true);
    setError(null);
    try {
      await onEnterProject(project.id, activeLastSection(project), unlockPassword);
      setUnlockingId(null);
      setUnlockPassword('');
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  const moveToRecycleBin = async () => {
    if (!deleteCandidate || deleteConfirmName.trim() !== deleteCandidate.name) return;

    setBusy(true);
    setError(null);
    try {
      await onDeleteProject(deleteCandidate.id);
      setDeleteCandidate(null);
      setDeleteConfirmName('');
      setShowRecycleBin(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="project-management-page">
      <section className="project-management-header">
        <div>
          <span className="section-kicker">PROJECTS</span>
          <h1>投标项目管理</h1>
          <p>每个标都是独立项目，包含自己的目录、招标文件副本、制作进度、资料记录和模块数据。启动后需要重新选择项目，加密项目需要重新输入访问密码。</p>
        </div>
        <div className="current-project-pill">
          <span>当前项目</span>
          <strong>{currentProject?.name || '未选择'}</strong>
          <small>{currentProject ? (currentProject.isUnlocked ? '已进入，其他页面将对齐此项目' : '需解锁后进入') : '请先在项目列表中选择项目'}</small>
        </div>
      </section>

      {error && <div className="project-error-banner">{error}</div>}

      <section className="project-create-panel">
        <div className="project-create-title">
          <div>
            <strong>新建投标项目</strong>
            <span>点击“新建项目”后才会创建项目目录、复制招标文件并写入数据库。</span>
          </div>
          <button type="button" className="project-secondary-button" onClick={handleSelectTenderFile} disabled={busy}>选择招标文件</button>
        </div>
        <div className="project-create-grid">
          <label>
            <span>项目名称</span>
            <input value={newName} onChange={(event) => setNewName(event.target.value)} placeholder="选择招标文件后可自动带入" />
          </label>
          <label>
            <span>招标文件</span>
            <input value={newTenderFile?.fileName || ''} readOnly placeholder="请选择本地招标文件" />
          </label>
          <label>
            <span>访问密码（可选）</span>
            <input type="password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} placeholder="留空则不设密码" />
          </label>
          <label className="project-create-notes">
            <span>项目备注</span>
            <input value={newNotes} onChange={(event) => setNewNotes(event.target.value)} placeholder="客户、截止时间、联系人或其他说明" />
          </label>
          <button type="button" className="project-primary-button" onClick={handleCreate} disabled={busy}>新建项目</button>
        </div>
      </section>

      <section className="project-list-section">
        <div className="project-list-head">
          <div>
            <span className="section-kicker">{showRecycleBin ? 'RECYCLE BIN' : 'PROJECT LIST'}</span>
            <strong>{showRecycleBin ? `回收站：${deletedCount} 个项目` : `${visibleProjects.length} 个投标项目`}</strong>
          </div>
          <button type="button" className="project-secondary-button" onClick={() => setShowRecycleBin((value) => !value)}>
            {showRecycleBin ? '返回项目列表' : `回收站${deletedCount ? `（${deletedCount}）` : ''}`}
          </button>
        </div>

        {sortedProjects.length === 0 ? (
          <div className="project-empty-panel">{showRecycleBin ? '回收站为空。' : '还没有项目，请先选择招标文件并新建项目。'}</div>
        ) : (
          <div className="project-card-grid">
            {sortedProjects.map((project) => {
              const isCurrent = project.id === currentProjectId;
              const isEditing = editingId === project.id;
              const isUnlocking = unlockingId === project.id;
              return (
                <article key={project.id} className={`project-card ${isCurrent ? 'is-current' : ''} ${project.deletedAt ? 'is-deleted' : ''}`}>
                  <div className="project-card-top">
                    <div>
                      <span className="project-status">{projectStateText(project)}</span>
                      {isEditing ? <input className="project-edit-name" value={editName} onChange={(event) => setEditName(event.target.value)} /> : <h2>{project.name}</h2>}
                    </div>
                    {isCurrent && <span className="project-current-tag">当前</span>}
                  </div>

                  {isEditing ? (
                    <div className="project-edit-fields">
                      <label><span>备注</span><textarea value={editNotes} onChange={(event) => setEditNotes(event.target.value)} rows={3} /></label>
                      <label><span>新访问密码</span><input type="password" value={editPassword} onChange={(event) => setEditPassword(event.target.value)} placeholder="留空则不修改" /></label>
                    </div>
                  ) : (
                    <>
                      <p className="project-card-file">{project.tenderFileName || '尚未绑定招标文件'}</p>
                      <p className="project-card-notes">{project.notes || '暂无备注'}</p>
                    </>
                  )}

                  {isUnlocking && (
                    <div className="project-unlock-row">
                      <input type="password" value={unlockPassword} onChange={(event) => setUnlockPassword(event.target.value)} placeholder="输入项目访问密码" />
                      <button type="button" onClick={() => void unlockAndEnter(project)} disabled={busy}>解锁进入</button>
                    </div>
                  )}

                  <div className="project-meta-grid">
                    <span title={project.projectDir}>项目目录：{project.projectDir || '创建后自动生成'}</span>
                    <span>{project.deletedAt ? `删除时间：${formatDate(project.deletedAt)}，计划销毁：${formatDate(project.purgeAfter)}` : `上次打开：${formatDate(project.lastOpenedAt)}`}</span>
                  </div>

                  <div className="project-card-actions">
                    {project.deletedAt ? (
                      <>
                        <button type="button" onClick={() => void onRestoreProject(project.id)} disabled={busy}>恢复</button>
                        <button type="button" className="project-danger-button" onClick={() => void onDestroyProject(project.id)} disabled={busy}>立即销毁</button>
                      </>
                    ) : isEditing ? (
                      <>
                        <button type="button" className="project-primary-button" onClick={() => void saveEdit(project.id)} disabled={busy}>保存</button>
                        <button type="button" onClick={() => setEditingId(null)} disabled={busy}>取消</button>
                      </>
                    ) : (
                      <>
                        <button type="button" className="project-primary-button" onClick={() => void enterProject(project)}>进入项目</button>
                        <button type="button" onClick={() => startEdit(project)}>改名/密码</button>
                        <button type="button" className="project-danger-button" onClick={() => { setDeleteCandidate(project); setDeleteConfirmName(''); }} disabled={busy}>删除</button>
                      </>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      {deleteCandidate && (
        <div className="project-modal-backdrop" role="presentation">
          <div className="project-modal" role="dialog" aria-modal="true" aria-label="删除项目确认">
            <strong>删除项目到回收站</strong>
            <p>项目会先进入回收站，7 天后自动销毁。请二次确认，并输入项目名称：{deleteCandidate.name}</p>
            <input value={deleteConfirmName} onChange={(event) => setDeleteConfirmName(event.target.value)} placeholder="输入项目名称" />
            <div className="project-modal-actions">
              <button type="button" onClick={() => setDeleteCandidate(null)}>取消</button>
              <button type="button" className="project-danger-button" onClick={() => void moveToRecycleBin()} disabled={deleteConfirmName.trim() !== deleteCandidate.name || busy}>确认删除</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
