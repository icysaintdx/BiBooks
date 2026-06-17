import { useEffect, useMemo, useState } from 'react';
import AppRouter from './app/AppRouter';
import AppShell from './components/AppShell';
import type { BidProjectSummary } from './shared/types/ipc';
import type { SectionId } from './shared/types/navigation';
import { REPAIR_TASKS_CHANGED_EVENT } from './shared/utils/repairTaskReview';

function App() {
  const [activeSection, setActiveSection] = useState<SectionId>('project-management');
  const [developerMode, setDeveloperMode] = useState(false);
  const [projects, setProjects] = useState<BidProjectSummary[]>([]);
  const [currentProjectId, setCurrentProjectId] = useState('');

  const activeProjects = useMemo(() => projects.filter((project) => !project.deletedAt), [projects]);
  const [pendingReviewCount, setPendingReviewCount] = useState(0);

  useEffect(() => {
    void window.yibiao?.config.load()
      .then((config) => setDeveloperMode(Boolean(config?.developer_mode)))
      .catch((error) => console.warn('读取开发者模式失败', error));
  }, []);

  useEffect(() => {
    void window.yibiao?.projectWorkspace.clearCurrent()
      .then((state) => {
        setProjects(state.projects || []);
        setCurrentProjectId('');
        setActiveSection('project-management');
      })
      .catch(() => {
        void window.yibiao?.projectWorkspace.list({ includeDeleted: true })
          .then((state) => {
            setProjects(state.projects || []);
            setCurrentProjectId('');
            setActiveSection('project-management');
          })
          .catch((error) => console.warn('读取投标项目失败', error));
      });
  }, []);

  useEffect(() => {
    const loadPendingReviewCount = async () => {
      try {
        const tasks = await window.yibiao?.repairTasks?.list({ status: 'needs_review' });
        setPendingReviewCount(Array.isArray(tasks) ? tasks.length : 0);
      } catch {
        setPendingReviewCount(0);
      }
    };
    void loadPendingReviewCount();

    const handleChanged = () => void loadPendingReviewCount();
    window.addEventListener(REPAIR_TASKS_CHANGED_EVENT, handleChanged as EventListener);
    const timer = window.setInterval(() => {
      void loadPendingReviewCount();
    }, 15000);

    return () => {
      window.removeEventListener(REPAIR_TASKS_CHANGED_EVENT, handleChanged as EventListener);
      window.clearInterval(timer);
    };
  }, [activeSection, currentProjectId]);

  useEffect(() => {
    if (!developerMode && activeSection === 'developer-test') setActiveSection('project-management');
  }, [activeSection, developerMode]);

  const refreshProjectState = async (state?: { currentProjectId?: string; projects?: BidProjectSummary[] }) => {
    if (state?.projects) {
      setProjects(state.projects);
      setCurrentProjectId(state.currentProjectId || '');
      return;
    }
    const next = await window.yibiao?.projectWorkspace.list({ includeDeleted: true });
    setProjects(next?.projects || []);
    setCurrentProjectId(next?.currentProjectId || '');
  };

  const handleSectionChange = (section: SectionId) => {
    if (section !== 'project-management' && !currentProjectId) {
      setActiveSection('project-management');
      return;
    }
    setActiveSection(section);
    if (section !== 'developer-test' && section !== 'project-management') {
      void window.yibiao?.projectWorkspace.saveLastSection(section)
        .then((state) => refreshProjectState(state))
        .catch((error) => console.warn('保存项目位置失败', error));
    }
  };

  const handleProjectChange = (projectId: string) => {
    if (!projectId || projectId === currentProjectId) {
      setActiveSection('project-management');
      return;
    }
    void window.yibiao?.projectWorkspace.select(projectId)
      .then((state) => {
        void refreshProjectState(state);
        setActiveSection('project-management');
      })
      .catch((error) => console.warn('切换投标项目失败', error));
  };

  const handleCreateProject = async (input?: { name?: string; tenderSourcePath?: string; tenderFileName?: string; notes?: string; password?: string }) => {
    if (!input?.name?.trim()) {
      setActiveSection('project-management');
      return;
    }
    const state = await window.yibiao?.projectWorkspace.create({
      name: input.name.trim(),
      tenderSourcePath: input.tenderSourcePath || '',
      tenderFileName: input.tenderFileName || '',
      notes: input.notes || '',
      password: input.password || '',
      lastSection: 'technical-plan',
    });
    await refreshProjectState(state);
    setActiveSection('project-management');
  };

  const handleUpdateProject = async (projectId: string, patch: Partial<Pick<BidProjectSummary, 'name' | 'tenderFileName' | 'notes' | 'status'>> & { tenderSourcePath?: string; password?: string }) => {
    const state = await window.yibiao?.projectWorkspace.update(projectId, patch);
    await refreshProjectState(state);
  };

  const handleDeleteProject = async (projectId: string) => {
    const state = await window.yibiao?.projectWorkspace.delete(projectId);
    await refreshProjectState(state);
    setActiveSection('project-management');
  };

  const handleRestoreProject = async (projectId: string) => {
    const state = await window.yibiao?.projectWorkspace.restore(projectId);
    await refreshProjectState(state);
  };

  const handleDestroyProject = async (projectId: string) => {
    if (!window.confirm('确认立即销毁该项目？此操作无法恢复。')) return;
    const state = await window.yibiao?.projectWorkspace.destroy(projectId);
    await refreshProjectState(state);
    setActiveSection('project-management');
  };

  const handleSelectTenderFile = async () => {
    return await window.yibiao?.projectWorkspace.selectTenderFile() || { success: false, canceled: true };
  };

  const handleEnterProject = async (projectId: string, section?: SectionId, password?: string) => {
    const state = await window.yibiao?.projectWorkspace.select(projectId, password ? { password } : undefined);
    await refreshProjectState(state);
    const current = (state?.projects || []).find((project) => project.id === state?.currentProjectId);
    const savedSection = current?.lastSection === 'project-management' ? 'technical-plan' : current?.lastSection;
    setActiveSection(section && section !== 'project-management' ? section : savedSection || 'technical-plan');
  };

  return (
    <AppShell
      activeSection={activeSection}
      currentProjectId={currentProjectId}
      developerMode={developerMode}
      projects={activeProjects}
      pendingReviewCount={pendingReviewCount}
      onCreateProject={handleCreateProject}
      onProjectChange={handleProjectChange}
      onSectionChange={handleSectionChange}
      onGoToDeliveryCheck={() => setActiveSection('technical-plan')}
    >
      <AppRouter
        activeSection={activeSection}
        currentProjectId={currentProjectId}
        projects={projects}
        onCreateProject={handleCreateProject}
        onDeleteProject={handleDeleteProject}
        onDestroyProject={handleDestroyProject}
        onEnterProject={handleEnterProject}
        onRestoreProject={handleRestoreProject}
        onSelectTenderFile={handleSelectTenderFile}
        onUpdateProject={handleUpdateProject}
        onSectionChange={handleSectionChange}
        onDeveloperModeChange={setDeveloperMode}
      />
    </AppShell>
  );
}

export default App;
