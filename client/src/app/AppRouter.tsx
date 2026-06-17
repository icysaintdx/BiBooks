import type { SectionId } from '../shared/types/navigation';
import type { BidProjectSummary } from '../shared/types/ipc';
import BidOpportunityPage from '../features/bid-opportunity/pages/BidOpportunityPage';
import BusinessBidPage from '../features/business-bid/pages/BusinessBidPage';
import PricingPage from '../features/pricing/pages/PricingPage';
import DeveloperTestPage from '../features/developer/pages/DeveloperTestPage';
import DuplicateCheckPage from '../features/duplicate-check/pages/DuplicateCheckPage';
import KnowledgeBasePage from '../features/knowledge-base/pages/KnowledgeBasePage';
import PrivateKnowledgeBasePage from '../features/knowledge-base/pages/PrivateKnowledgeBasePage';
import RejectionCheckPage from '../features/rejection-check/pages/RejectionCheckPage';
import SettingsPage from '../features/settings/pages/SettingsPage';
import TechnicalPlanHome from '../features/technical-plan/pages/TechnicalPlanHome';
import CompetitiveAnalysisStandalonePage from '../features/competitive-analysis/pages/CompetitiveAnalysisStandalonePage';
import ComplianceCheckStandalonePage from '../features/compliance-check/pages/ComplianceCheckStandalonePage';
import ProjectManagementPage from '../features/project-management/pages/ProjectManagementPage';

interface AppRouterProps {
  activeSection: SectionId;
  currentProjectId: string;
  projects: BidProjectSummary[];
  onCreateProject: (input: { name: string; tenderSourcePath?: string; tenderFileName?: string; notes?: string; password?: string }) => Promise<void> | void;
  onDeleteProject: (projectId: string) => Promise<void> | void;
  onDestroyProject: (projectId: string) => Promise<void> | void;
  onEnterProject: (projectId: string, section?: SectionId, password?: string) => Promise<void> | void;
  onRestoreProject: (projectId: string) => Promise<void> | void;
  onSelectTenderFile: () => Promise<{ success: boolean; canceled?: boolean; filePath?: string; fileName?: string; suggestedProjectName?: string }>;
  onUpdateProject: (projectId: string, patch: Partial<Pick<BidProjectSummary, 'name' | 'tenderFileName' | 'notes' | 'status'>> & { tenderSourcePath?: string; password?: string }) => Promise<void> | void;
  onSectionChange: (section: SectionId) => void;
  onDeveloperModeChange: (developerMode: boolean) => void;
}

function AppRouter({
  activeSection,
  currentProjectId,
  projects,
  onCreateProject,
  onDeleteProject,
  onDestroyProject,
  onEnterProject,
  onRestoreProject,
  onSelectTenderFile,
  onUpdateProject,
  onSectionChange,
  onDeveloperModeChange,
}: AppRouterProps) {
  switch (activeSection) {
    case 'project-management':
      return (
        <ProjectManagementPage
          currentProjectId={currentProjectId}
          projects={projects}
          onCreateProject={onCreateProject}
          onDeleteProject={onDeleteProject}
          onDestroyProject={onDestroyProject}
          onEnterProject={onEnterProject}
          onRestoreProject={onRestoreProject}
          onSelectTenderFile={onSelectTenderFile}
          onUpdateProject={onUpdateProject}
        />
      );
    case 'technical-plan':
      return <TechnicalPlanHome onNavigateSection={onSectionChange} />;
    case 'business-bid':
      return <BusinessBidPage />;
    case 'pricing':
      return <PricingPage />;
    case 'knowledge-base':
      return <KnowledgeBasePage />;
    case 'private-knowledge-base':
      return <PrivateKnowledgeBasePage />;
    case 'duplicate-check':
      return <DuplicateCheckPage />;
    case 'rejection-check':
      return <RejectionCheckPage />;
    case 'bid-opportunity':
      return <BidOpportunityPage />;
    case 'competitive-analysis':
      return <CompetitiveAnalysisStandalonePage />;
    case 'compliance-check':
      return <ComplianceCheckStandalonePage />;
    case 'developer-test':
      return <DeveloperTestPage />;
    case 'settings':
      return <SettingsPage onDeveloperModeChange={onDeveloperModeChange} />;
    default:
      return null;
  }
}

export default AppRouter;
