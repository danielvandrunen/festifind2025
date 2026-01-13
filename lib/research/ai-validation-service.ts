/**
 * AI Validation Service
 * 
 * Uses Anthropic Claude for:
 * - Content validation and quality scoring
 * - Data extraction and normalization
 * - Sanity checks on research results
 * - Generating confidence scores
 */

import Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';

// Validation result schemas
const CompanyValidationSchema = z.object({
  isValid: z.boolean(),
  confidence: z.number().min(0).max(1),
  normalizedName: z.string().nullable(),
  companyType: z.enum(['bv', 'nv', 'stichting', 'vof', 'unknown']).nullable(),
  reasoning: z.string(),
  suggestedCorrections: z.array(z.string()).optional(),
});

const PersonValidationSchema = z.object({
  isRelevant: z.boolean(),
  confidence: z.number().min(0).max(1),
  role: z.string().nullable(),
  isDecisionMaker: z.boolean(),
  reasoning: z.string(),
});

const ContentValidationSchema = z.object({
  isRelevant: z.boolean(),
  confidence: z.number().min(0).max(1),
  quality: z.enum(['high', 'medium', 'low']),
  summary: z.string(),
  keyFacts: z.array(z.string()),
  reasoning: z.string(),
});

export type CompanyValidation = z.infer<typeof CompanyValidationSchema>;
export type PersonValidation = z.infer<typeof PersonValidationSchema>;
export type ContentValidation = z.infer<typeof ContentValidationSchema>;

interface AIValidationOptions {
  maxTokens?: number;
  temperature?: number;
}

class AIValidationService {
  private client: Anthropic | null = null;
  private isConfigured: boolean = false;

  constructor() {
    this.initClient();
  }

  private initClient(): void {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (apiKey) {
      this.client = new Anthropic({ apiKey });
      this.isConfigured = true;
    } else {
      console.warn('[AI Validation] ANTHROPIC_API_KEY not configured');
    }
  }

  isAvailable(): boolean {
    return this.isConfigured;
  }

  /**
   * Call Claude with structured output expectations
   */
  private async callClaude(
    systemPrompt: string,
    userPrompt: string,
    options: AIValidationOptions = {}
  ): Promise<string | null> {
    if (!this.client) return null;

    try {
      const response = await this.client.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: options.maxTokens ?? 1024,
        temperature: options.temperature ?? 0.1,
        messages: [
          {
            role: 'user',
            content: `${systemPrompt}\n\n${userPrompt}`,
          },
        ],
      });

      const textBlock = response.content.find(block => block.type === 'text');
      return textBlock && textBlock.type === 'text' ? textBlock.text : null;
    } catch (error) {
      console.error('[AI Validation] Claude API error:', error);
      return null;
    }
  }

  /**
   * Parse JSON from Claude's response
   */
  private parseJsonResponse<T>(
    response: string | null,
    schema: z.ZodSchema<T>
  ): T | null {
    if (!response) return null;

    try {
      // Extract JSON from response (handle markdown code blocks)
      const jsonMatch = response.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
      const jsonStr = jsonMatch ? jsonMatch[1] : response;
      
      const parsed = JSON.parse(jsonStr);
      return schema.parse(parsed);
    } catch (error) {
      console.error('[AI Validation] Failed to parse response:', error);
      return null;
    }
  }

  /**
   * Validate and score a company name extraction
   */
  async validateCompanyName(
    festivalName: string,
    extractedCompany: string | null,
    sourceUrl: string,
    sourceContent?: string
  ): Promise<CompanyValidation> {
    const defaultResult: CompanyValidation = {
      isValid: false,
      confidence: 0,
      normalizedName: null,
      companyType: null,
      reasoning: 'AI validation unavailable',
    };

    if (!this.client || !extractedCompany) return defaultResult;

    const systemPrompt = `You are an expert at validating company information for Dutch festivals.
Your task is to validate if an extracted company name is legitimate and actually organizes the given festival.

Response format (JSON only):
{
  "isValid": boolean,
  "confidence": number (0-1),
  "normalizedName": string or null,
  "companyType": "bv" | "nv" | "stichting" | "vof" | "unknown" | null,
  "reasoning": string,
  "suggestedCorrections": string[] (optional)
}`;

    const userPrompt = `Festival: ${festivalName}
Extracted Company: ${extractedCompany}
Source URL: ${sourceUrl}
${sourceContent ? `Source Content (excerpt): ${sourceContent.substring(0, 1000)}` : ''}

Validate this company extraction. Consider:
1. Does the company name make sense for organizing a festival?
2. Does it follow Dutch company naming conventions (B.V., N.V., Stichting, etc.)?
3. Is it likely to be the actual organizer vs. a sponsor or partner?
4. What is your confidence level in this extraction?`;

    const response = await this.callClaude(systemPrompt, userPrompt);
    return this.parseJsonResponse(response, CompanyValidationSchema) ?? defaultResult;
  }

  /**
   * Validate a LinkedIn person's relevance to a festival
   */
  async validateLinkedInPerson(
    festivalName: string,
    personName: string,
    personTitle: string | null,
    personCompany: string | null,
    organizingCompany: string | null
  ): Promise<PersonValidation> {
    const defaultResult: PersonValidation = {
      isRelevant: false,
      confidence: 0,
      role: null,
      isDecisionMaker: false,
      reasoning: 'AI validation unavailable',
    };

    if (!this.client) return defaultResult;

    const systemPrompt = `You are an expert at identifying key people involved in festival organization.
Determine if a LinkedIn profile is relevant to the festival and likely to be a decision-maker.

Response format (JSON only):
{
  "isRelevant": boolean,
  "confidence": number (0-1),
  "role": string or null (e.g., "organizer", "marketing", "founder", "production"),
  "isDecisionMaker": boolean,
  "reasoning": string
}`;

    const userPrompt = `Festival: ${festivalName}
${organizingCompany ? `Organizing Company: ${organizingCompany}` : ''}

LinkedIn Profile:
- Name: ${personName}
- Title: ${personTitle || 'Unknown'}
- Company: ${personCompany || 'Unknown'}

Evaluate if this person is:
1. Actually connected to this festival/company
2. In a position to make decisions about sponsorships, partnerships, bookings
3. Relevant for business development purposes`;

    const response = await this.callClaude(systemPrompt, userPrompt);
    return this.parseJsonResponse(response, PersonValidationSchema) ?? defaultResult;
  }

  /**
   * Validate and summarize scraped content relevance
   */
  async validateContent(
    festivalName: string,
    content: string,
    contentType: 'news' | 'website' | 'calendar'
  ): Promise<ContentValidation> {
    const defaultResult: ContentValidation = {
      isRelevant: false,
      confidence: 0,
      quality: 'low',
      summary: '',
      keyFacts: [],
      reasoning: 'AI validation unavailable',
    };

    if (!this.client || !content) return defaultResult;

    const systemPrompt = `You are an expert at analyzing content about music festivals.
Evaluate if content is relevant, extract key information, and assess quality.

Response format (JSON only):
{
  "isRelevant": boolean,
  "confidence": number (0-1),
  "quality": "high" | "medium" | "low",
  "summary": string (2-3 sentences),
  "keyFacts": string[] (max 5 facts),
  "reasoning": string
}`;

    const userPrompt = `Festival: ${festivalName}
Content Type: ${contentType}
Content:
${content.substring(0, 3000)}

Analyze this content for:
1. Is it actually about the festival (not just mentioning it)?
2. Is the information current and accurate?
3. What are the key facts (dates, location, lineup, status)?
4. Is this high-quality source content?`;

    const response = await this.callClaude(systemPrompt, userPrompt);
    return this.parseJsonResponse(response, ContentValidationSchema) ?? defaultResult;
  }

  /**
   * Generate an overall confidence score for research results
   */
  async generateConfidenceScore(
    festivalName: string,
    researchResults: {
      companyFound: boolean;
      linkedInProfilesCount: number;
      newsArticlesCount: number;
      calendarSourcesFound: number;
      hasWebsite: boolean;
    }
  ): Promise<{ score: number; level: 'high' | 'medium' | 'low'; reasoning: string }> {
    const defaultResult = {
      score: 0,
      level: 'low' as const,
      reasoning: 'Unable to calculate confidence',
    };

    if (!this.client) {
      // Calculate basic score without AI
      let score = 0;
      if (researchResults.companyFound) score += 0.3;
      if (researchResults.linkedInProfilesCount > 0) score += 0.2;
      if (researchResults.newsArticlesCount > 0) score += 0.2;
      if (researchResults.calendarSourcesFound > 0) score += 0.15;
      if (researchResults.hasWebsite) score += 0.15;

      return {
        score,
        level: score >= 0.7 ? 'high' : score >= 0.4 ? 'medium' : 'low',
        reasoning: 'Basic heuristic calculation (AI unavailable)',
      };
    }

    const systemPrompt = `You are evaluating the completeness and reliability of research about a festival.
Calculate a confidence score based on what information was found.

Response format (JSON only):
{
  "score": number (0-1),
  "level": "high" | "medium" | "low",
  "reasoning": string
}`;

    const userPrompt = `Festival: ${festivalName}

Research Results:
- Organizing company found: ${researchResults.companyFound}
- LinkedIn profiles found: ${researchResults.linkedInProfilesCount}
- News articles found: ${researchResults.newsArticlesCount}
- Calendar sources confirming: ${researchResults.calendarSourcesFound}
- Website available: ${researchResults.hasWebsite}

Generate a confidence score considering:
1. How complete is the research?
2. Can we trust the festival is legitimate and active?
3. Do we have enough information for business outreach?`;

    const response = await this.callClaude(systemPrompt, userPrompt);
    const parsed = this.parseJsonResponse(response, z.object({
      score: z.number(),
      level: z.enum(['high', 'medium', 'low']),
      reasoning: z.string(),
    }));

    return parsed ?? defaultResult;
  }

  /**
   * Suggest retry strategies based on current results
   */
  async suggestRetryStrategy(
    festivalName: string,
    currentResults: Record<string, any>,
    failedOperations: string[]
  ): Promise<{
    shouldRetry: boolean;
    strategies: Array<{ operation: string; suggestion: string }>;
    alternativeApproaches: string[];
  }> {
    const defaultResult = {
      shouldRetry: failedOperations.length > 0,
      strategies: failedOperations.map(op => ({
        operation: op,
        suggestion: 'Retry with default parameters',
      })),
      alternativeApproaches: [],
    };

    if (!this.client) return defaultResult;

    const systemPrompt = `You are a research strategy advisor for festival data collection.
Based on current results and failures, suggest retry strategies and alternatives.

Response format (JSON only):
{
  "shouldRetry": boolean,
  "strategies": [{"operation": string, "suggestion": string}],
  "alternativeApproaches": string[]
}`;

    const userPrompt = `Festival: ${festivalName}

Current Results: ${JSON.stringify(currentResults, null, 2)}

Failed Operations: ${failedOperations.join(', ')}

Suggest:
1. Should we retry failed operations? If so, how?
2. What alternative approaches could yield better results?
3. Are there different search terms or strategies to try?`;

    const response = await this.callClaude(systemPrompt, userPrompt);
    const parsed = this.parseJsonResponse(response, z.object({
      shouldRetry: z.boolean(),
      strategies: z.array(z.object({
        operation: z.string(),
        suggestion: z.string(),
      })),
      alternativeApproaches: z.array(z.string()),
    }));

    return parsed ?? defaultResult;
  }
}

// Singleton instance
let serviceInstance: AIValidationService | null = null;

export function getAIValidationService(): AIValidationService {
  if (!serviceInstance) {
    serviceInstance = new AIValidationService();
  }
  return serviceInstance;
}

export { AIValidationService };
