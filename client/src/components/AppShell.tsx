import * as Tooltip from '@radix-ui/react-tooltip';
import type { ReactNode } from 'react';
import type { SectionId } from '../shared/types/navigation';
import type { BidProjectSummary } from '../shared/types/ipc';
import Sidebar from './Sidebar';

interface AppShellProps {
  activeSection: SectionId;
  children: ReactNode;
  developerMode: boolean;
  currentProjectId: string;
  pendingReviewCount: number;
  projects: BidProjectSummary[];
  onCreateProject: (input?: { name?: string; tenderFileName?: string; notes?: string }) => void;
  onProjectChange: (projectId: string) => void;
  onSectionChange: (section: SectionId) => void;
  onGoToDeliveryCheck: () => void;
}

function AppShell({ activeSection, children, developerMode, currentProjectId, pendingReviewCount, projects, onCreateProject, onProjectChange, onSectionChange, onGoToDeliveryCheck }: AppShellProps) {
  return (
    <Tooltip.Provider delayDuration={120} skipDelayDuration={80}>
      <div className="app-shell">
        <Sidebar
          activeSection={activeSection}
          currentProjectId={currentProjectId}
          developerMode={developerMode}
          pendingReviewCount={pendingReviewCount}
          projects={projects}
          onCreateProject={onCreateProject}
          onProjectChange={onProjectChange}
          onSectionChange={onSectionChange}
          onGoToDeliveryCheck={onGoToDeliveryCheck}
        />

        <main className="main-area">
          <section className="content-shell" aria-label="主内容">
            {children}
          </section>
        </main>
      </div>
    </Tooltip.Provider>
  );
}

export default AppShell;
