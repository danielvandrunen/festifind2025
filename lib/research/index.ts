/**
 * Research Module
 * 
 * Exports the self-healing research orchestrator and related utilities
 */

export { 
  getResilientApifyClient, 
  ResilientApifyClient,
  ApifyErrorType,
  type ApifyError,
  type ActorRunOptions,
  type ActorRunResult,
} from './resilient-apify-client';

export {
  getAIValidationService,
  AIValidationService,
  type CompanyValidation,
  type PersonValidation,
  type ContentValidation,
} from './ai-validation-service';

export {
  createOrchestrator,
  SelfHealingOrchestrator,
  ResearchPhase,
  type ResearchState,
  type OrchestratorOptions,
  type LinkedInConnection,
  type EmploymentVerification,
} from './self-healing-orchestrator';

export {
  verifyEmployment,
  determineRole,
  parseLinkedInProfile,
  sortConnectionsByRelevance,
  getVerifiedConnections,
  groupConnectionsByRole,
  type LinkedInConnection as LinkedInConnectionType,
  type EmploymentVerification as EmploymentVerificationType,
} from './employment-validator';

export {
  calculateQualityScore,
  getQualityIndicator,
  getImprovementSuggestions,
  formatQualityScoreForDisplay,
  type ResearchQualityScore,
  type QualityIndicator,
} from './quality-metrics';
