import type { SectionId } from '../shared/types/navigation';
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

interface AppRouterProps {
  activeSection: SectionId;
  onDeveloperModeChange: (developerMode: boolean) => void;
}

function AppRouter({ activeSection, onDeveloperModeChange }: AppRouterProps) {
  switch (activeSection) {
    case 'technical-plan':
      return <TechnicalPlanHome />;
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

