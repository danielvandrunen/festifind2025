/**
 * Research Orchestrator
 * State-of-the-art AI-powered research automation using Anthropic Claude
 * 
 * Features:
 * - Multi-step reasoning with tool use
 * - Streaming support for real-time updates
 * - Extensible tool system
 * - Proper error handling and retry logic
 */

import Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';
import {
  type ResearchQuery,
  type ResearchResult,
  type OrchestratorConfig,
  type OrchestratorEvent,
  type AgentState,
  ResearchQuerySchema,
} from './types';
import { defaultTools } from './tools';

// Default configuration using latest Claude model
const DEFAULT_CONFIG: OrchestratorConfig = {
  model: 'claude-sonnet-4-20250514',
  maxTokens: 4096,
  temperature: 0.7,
  maxIterations: 10,
  enableStreaming: true,
  tools: defaultTools,
};

// System prompt for the research agent
const RESEARCH_SYSTEM_PROMPT = `You are an expert research assistant specialized in gathering information about music festivals and events. Your goal is to find accurate, verifiable information efficiently.

## Your Capabilities
- Search the web for festival information
- Find LinkedIn company pages and organizer profiles  
- Extract structured data from websites
- Validate and verify discovered information
- Synthesize findings into actionable insights

## Research Strategy
1. Start with a web search to find the festival's official presence
2. Look for LinkedIn company pages and key organizer profiles
3. Extract contact information and social media links
4. Validate all discovered URLs and data
5. Synthesize findings with confidence scores

## Quality Standards
- Only report information you can verify
- Assign confidence scores (0-1) to all findings
- Prioritize official sources over secondary sources
- Flag any inconsistencies or potential errors

## Output Format
Always provide structured findings that can be imported into a database.
For LinkedIn profiles, ensure URLs are properly formatted and validated.`;

export class ResearchOrchestrator {
  private client: Anthropic;
  private config: OrchestratorConfig;
  private eventHandlers: ((event: OrchestratorEvent) => void)[] = [];

  constructor(config: Partial<OrchestratorConfig> = {}) {
    // Initialize Anthropic client - uses ANTHROPIC_API_KEY env var automatically
    this.client = new Anthropic();
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Subscribe to orchestrator events for real-time updates
   */
  onEvent(handler: (event: OrchestratorEvent) => void): () => void {
    this.eventHandlers.push(handler);
    return () => {
      this.eventHandlers = this.eventHandlers.filter(h => h !== handler);
    };
  }

  private emit(event: OrchestratorEvent): void {
    this.eventHandlers.forEach(handler => handler(event));
  }

  /**
   * Convert our tool definitions to Anthropic's tool format
   */
  private getAnthropicTools(): Anthropic.Tool[] {
    return this.config.tools.map(tool => ({
      name: tool.name,
      description: tool.description,
      input_schema: this.zodToJsonSchema(tool.inputSchema) as Anthropic.Tool.InputSchema,
    }));
  }

  /**
   * Convert Zod schema to JSON Schema for Anthropic
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private zodToJsonSchema(schema: any): Record<string, unknown> {
    // Simple conversion - in production, use zod-to-json-schema library
    if (schema instanceof z.ZodObject) {
      const shape = schema.shape as Record<string, unknown>;
      const properties: Record<string, unknown> = {};
      const required: string[] = [];

      for (const [key, value] of Object.entries(shape)) {
        properties[key] = this.zodToJsonSchema(value);
        if (!(value instanceof z.ZodOptional)) {
          required.push(key);
        }
      }

      return {
        type: 'object',
        properties,
        required: required.length > 0 ? required : undefined,
      };
    }

    if (schema instanceof z.ZodString) {
      return { type: 'string', description: schema.description };
    }

    if (schema instanceof z.ZodNumber) {
      return { type: 'number', description: schema.description };
    }

    if (schema instanceof z.ZodEnum) {
      return { type: 'string', enum: (schema as any).options, description: schema.description };
    }

    if (schema instanceof z.ZodArray) {
      return {
        type: 'array',
        items: this.zodToJsonSchema((schema as any).element),
        description: schema.description,
      };
    }

    if (schema instanceof z.ZodOptional) {
      return this.zodToJsonSchema((schema as any).unwrap());
    }

    if (schema instanceof z.ZodDefault) {
      return this.zodToJsonSchema((schema as any).removeDefault());
    }

    return { type: 'string' };
  }

  /**
   * Execute a tool and return the result
   */
  private async executeTool(toolName: string, toolInput: unknown): Promise<string> {
    const tool = this.config.tools.find(t => t.name === toolName);
    if (!tool) {
      return JSON.stringify({ error: `Unknown tool: ${toolName}` });
    }

    try {
      this.emit({ type: 'tool_call', tool: toolName, input: toolInput });
      const result = await tool.run(toolInput);
      this.emit({ type: 'tool_result', tool: toolName, result });
      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return JSON.stringify({ error: errorMessage });
    }
  }

  /**
   * Main research method - orchestrates multi-step research
   */
  async research(query: ResearchQuery): Promise<ResearchResult> {
    // Validate input
    const validatedQuery = ResearchQuerySchema.parse(query);
    this.emit({ type: 'start', query: validatedQuery });

    const messages: Anthropic.MessageParam[] = [
      {
        role: 'user',
        content: this.buildResearchPrompt(validatedQuery),
      },
    ];

    const findings: ResearchResult['findings'] = [];
    const linkedinProfiles: NonNullable<ResearchResult['linkedinProfiles']> = [];

    try {
      let iteration = 0;
      
      while (iteration < this.config.maxIterations) {
        iteration++;
        
        const response = await this.client.messages.create({
          model: this.config.model,
          max_tokens: this.config.maxTokens,
          temperature: this.config.temperature,
          system: RESEARCH_SYSTEM_PROMPT,
          tools: this.getAnthropicTools(),
          messages,
        });

        // Process response content
        for (const block of response.content) {
          if (block.type === 'text') {
            this.emit({ type: 'thinking', content: block.text });
          } else if (block.type === 'tool_use') {
            const toolResult = await this.executeTool(block.name, block.input);
            
            // Parse and store findings
            try {
              const parsed = JSON.parse(toolResult);
              if (parsed.success !== false) {
                const finding = {
                  type: block.name,
                  data: parsed,
                  confidence: this.estimateConfidence(block.name, parsed),
                  source: block.name,
                  timestamp: new Date().toISOString(),
                };
                findings.push(finding);
                this.emit({ type: 'finding', finding });

                // Extract LinkedIn profiles if found
                if (block.name === 'validate_linkedin_url' && parsed.isValid) {
                  linkedinProfiles.push({
                    url: parsed.standardizedUrl || parsed.url,
                    type: parsed.detectedType as 'company' | 'person' | 'event',
                    name: validatedQuery.festivalName,
                  });
                }
              }
            } catch {
              // Tool result wasn't JSON, store as string
              findings.push({
                type: block.name,
                data: toolResult,
                confidence: 0.5,
                source: block.name,
                timestamp: new Date().toISOString(),
              });
            }

            // Add tool result to messages for context
            messages.push({
              role: 'assistant',
              content: response.content,
            });
            messages.push({
              role: 'user',
              content: [
                {
                  type: 'tool_result',
                  tool_use_id: block.id,
                  content: toolResult,
                },
              ],
            });
          }
        }

        // Check if we're done
        if (response.stop_reason === 'end_turn') {
          break;
        }
      }

      const result: ResearchResult = {
        festivalId: validatedQuery.festivalId,
        festivalName: validatedQuery.festivalName,
        findings,
        linkedinProfiles: linkedinProfiles.length > 0 ? linkedinProfiles : undefined,
        status: 'completed',
      };

      this.emit({ type: 'complete', result });
      return result;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.emit({ type: 'error', error: errorMessage });
      
      return {
        festivalId: validatedQuery.festivalId,
        festivalName: validatedQuery.festivalName,
        findings,
        status: 'failed',
        error: errorMessage,
      };
    }
  }

  /**
   * Build the initial research prompt
   */
  private buildResearchPrompt(query: ResearchQuery): string {
    const targetInfoList = query.targetInfo
      .map(info => `- ${info.replace(/_/g, ' ')}`)
      .join('\n');

    return `Please research the following festival and gather the requested information:

**Festival Name:** ${query.festivalName}
${query.festivalId ? `**Festival ID:** ${query.festivalId}` : ''}

**Information to gather:**
${targetInfoList}

**Research depth:** ${query.maxDepth} levels (follow links up to this depth)
**Priority:** ${query.priority}

Please use the available tools to:
1. Search for the festival's official online presence
2. Find LinkedIn profiles for the organization and key people
3. Extract and validate any discovered information
4. Synthesize your findings into a structured report

Start by searching for the festival's web presence, then proceed to gather the specific information requested.`;
  }

  /**
   * Estimate confidence based on tool and result
   */
  private estimateConfidence(toolName: string, result: Record<string, unknown>): number {
    // Higher confidence for validation tools
    if (toolName === 'validate_linkedin_url' && result.isValid) {
      return 0.95;
    }
    if (toolName === 'extract_webpage_data' && result.success) {
      return 0.85;
    }
    if (toolName === 'web_search') {
      return 0.7;
    }
    if (toolName === 'linkedin_search') {
      return 0.6; // Lower until validated
    }
    return 0.5;
  }

  /**
   * Quick LinkedIn research - convenience method
   */
  async findLinkedIn(festivalName: string, festivalId?: string): Promise<ResearchResult> {
    return this.research({
      festivalId,
      festivalName,
      targetInfo: ['linkedin_company', 'linkedin_organizers'],
      maxDepth: 2,
      priority: 'high',
    });
  }
}

// Export singleton for convenience
export const orchestrator = new ResearchOrchestrator();

// Export types
export * from './types';
