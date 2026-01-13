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
} from './self-healing-orchestrator';
