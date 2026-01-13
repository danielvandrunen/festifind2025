/**
 * Research Orchestrator Types
 * State-of-the-art type definitions for AI-powered research automation
 */

import { z } from 'zod';

// Research task schemas
export const ResearchQuerySchema = z.object({
  festivalId: z.string().uuid().optional(),
  festivalName: z.string(),
  targetInfo: z.array(z.enum([
    'linkedin_company',
    'linkedin_organizers', 
    'contact_emails',
    'social_media',
    'venue_details',
    'ticket_pricing',
    'artist_lineup',
    'sponsorship_info'
  ])),
  maxDepth: z.number().min(1).max(5).default(3),
  priority: z.enum(['low', 'medium', 'high']).default('medium'),
});

export type ResearchQuery = z.infer<typeof ResearchQuerySchema>;

// Research result types
export const ResearchResultSchema = z.object({
  festivalId: z.string().optional(),
  festivalName: z.string(),
  findings: z.array(z.object({
    type: z.string(),
    data: z.unknown(),
    confidence: z.number().min(0).max(1),
    source: z.string().optional(),
    timestamp: z.string().datetime(),
  })),
  linkedinProfiles: z.array(z.object({
    url: z.string().url(),
    type: z.enum(['company', 'person', 'event']),
    name: z.string(),
    role: z.string().optional(),
  })).optional(),
  status: z.enum(['pending', 'in_progress', 'completed', 'failed']),
  error: z.string().optional(),
});

export type ResearchResult = z.infer<typeof ResearchResultSchema>;

// Orchestrator configuration
export interface OrchestratorConfig {
  model: 'claude-sonnet-4-20250514' | 'claude-3-5-sonnet-20241022' | 'claude-3-opus-20240229';
  maxTokens: number;
  temperature: number;
  maxIterations: number;
  enableStreaming: boolean;
  tools: ToolDefinition[];
}

// Tool definition for extensibility
export interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: z.ZodType<unknown>;
  run: (input: unknown) => Promise<string>;
}

// Agent state for multi-step orchestration
export interface AgentState {
  messages: AgentMessage[];
  currentStep: number;
  totalSteps: number;
  findings: ResearchResult['findings'];
  status: ResearchResult['status'];
}

export interface AgentMessage {
  role: 'user' | 'assistant' | 'tool';
  content: string;
  toolUse?: {
    name: string;
    input: unknown;
    result?: string;
  };
  timestamp: string;
}

// Event types for streaming
export type OrchestratorEvent = 
  | { type: 'start'; query: ResearchQuery }
  | { type: 'thinking'; content: string }
  | { type: 'tool_call'; tool: string; input: unknown }
  | { type: 'tool_result'; tool: string; result: string }
  | { type: 'finding'; finding: ResearchResult['findings'][0] }
  | { type: 'complete'; result: ResearchResult }
  | { type: 'error'; error: string };
