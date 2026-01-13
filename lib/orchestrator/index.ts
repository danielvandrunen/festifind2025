/**
 * Research Orchestrator Module
 * 
 * State-of-the-art AI-powered research automation for FestiFind
 * 
 * Usage:
 * ```typescript
 * import { orchestrator, ResearchOrchestrator } from '@/lib/orchestrator';
 * 
 * // Use singleton
 * const result = await orchestrator.findLinkedIn('Tomorrowland');
 * 
 * // Or create custom instance
 * const custom = new ResearchOrchestrator({ 
 *   model: 'claude-3-opus-20240229',
 *   maxIterations: 15 
 * });
 * ```
 * 
 * Environment Variables Required:
 * - ANTHROPIC_API_KEY: Your Anthropic API key
 */

export { ResearchOrchestrator, orchestrator } from './research-orchestrator';
export { defaultTools, webSearchTool, linkedinSearchTool, extractDataTool, validateLinkedInTool, synthesizeFindingsTool } from './tools';
export * from './types';
