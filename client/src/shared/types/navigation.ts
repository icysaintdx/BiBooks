export type SectionId =
  | 'technical-plan'
  | 'business-bid'
  | 'pricing'
  | 'knowledge-base'
  | 'private-knowledge-base'
  | 'duplicate-check'
  | 'rejection-check'
  | 'bid-opportunity'
  | 'competitive-analysis'
  | 'compliance-check'
  | 'developer-test'
  | 'settings';

export interface AppMenuItem {
  id: SectionId;
  label: string;
  description: string;
}
