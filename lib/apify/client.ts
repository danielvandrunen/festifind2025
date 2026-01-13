/**
 * Apify Client Service
 * 
 * Handles communication with Apify API for running actors and retrieving results.
 * Provides a clean interface for the research orchestrator to execute web scraping tasks.
 */

import { z } from 'zod';

// Apify API configuration
const APIFY_API_BASE = 'https://api.apify.com/v2';

// Common Apify Actor IDs
export const APIFY_ACTORS = {
  // LinkedIn scraping
  LINKEDIN_COMPANY_SCRAPER: 'dev_fusion/Linkedin-Company-Scraper',
  LINKEDIN_PROFILE_SCRAPER: 'anchor/linkedin-profile-scraper',
  
  // General web scraping
  WEBSITE_CONTENT_CRAWLER: 'apify/website-content-crawler',
  RAG_WEB_BROWSER: 'apify/rag-web-browser',
  CHEERIO_SCRAPER: 'apify/cheerio-scraper',
  
  // Search engines
  GOOGLE_SEARCH_SCRAPER: 'apify/google-search-scraper',
  
  // Social media
  INSTAGRAM_SCRAPER: 'apify/instagram-scraper',
  FACEBOOK_POSTS_SCRAPER: 'apify/facebook-posts-scraper',
} as const;

// Actor run status schema
export const ActorRunStatusSchema = z.enum([
  'READY',
  'RUNNING',
  'SUCCEEDED',
  'FAILED',
  'TIMING-OUT',
  'TIMED-OUT',
  'ABORTING',
  'ABORTED'
]);

export type ActorRunStatus = z.infer<typeof ActorRunStatusSchema>;

// Actor run result schema
export const ActorRunResultSchema = z.object({
  id: z.string(),
  actId: z.string(),
  status: ActorRunStatusSchema,
  startedAt: z.string().optional(),
  finishedAt: z.string().optional(),
  defaultDatasetId: z.string().optional(),
  defaultKeyValueStoreId: z.string().optional(),
});

export type ActorRunResult = z.infer<typeof ActorRunResultSchema>;

// Dataset item schema (generic)
export const DatasetItemSchema = z.record(z.any());
export type DatasetItem = z.infer<typeof DatasetItemSchema>;

/**
 * Apify Client class for interacting with the Apify API
 */
export class ApifyClient {
  private apiToken: string;
  private baseUrl: string;

  constructor(apiToken?: string) {
    this.apiToken = apiToken || process.env.APIFY_API_TOKEN || '';
    this.baseUrl = APIFY_API_BASE;

    if (!this.apiToken) {
      console.warn('APIFY_API_TOKEN is not set. Apify client will not be able to make API calls.');
    }
  }

  /**
   * Make an authenticated request to the Apify API
   */
  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    // Add token as query parameter (Apify's preferred method)
    const urlWithToken = url.includes('?') 
      ? `${url}&token=${this.apiToken}`
      : `${url}?token=${this.apiToken}`;

    const response = await fetch(urlWithToken, {
      ...options,
      headers,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Apify API error (${response.status}): ${errorText}`);
    }

    return response.json();
  }

  /**
   * Run an actor and wait for it to complete
   */
  async runActor<TInput = Record<string, any>, TOutput = DatasetItem[]>(
    actorId: string,
    input: TInput,
    options: {
      waitForFinish?: number; // seconds to wait, 0 = don't wait
      memory?: number; // MB
      timeout?: number; // seconds
    } = {}
  ): Promise<{
    run: ActorRunResult;
    items: TOutput;
  }> {
    const { waitForFinish = 120, memory, timeout } = options;

    // Convert actor ID format from "username/actor-name" to "username~actor-name" 
    // Apify API requires tilde separator, not slash
    const normalizedActorId = actorId.replace('/', '~');

    console.log(`Running Apify actor: ${actorId} (API format: ${normalizedActorId})`);
    console.log(`Input:`, JSON.stringify(input, null, 2));

    // Build query params
    const params = new URLSearchParams();
    if (waitForFinish > 0) params.append('waitForFinish', waitForFinish.toString());
    if (memory) params.append('memory', memory.toString());
    if (timeout) params.append('timeout', timeout.toString());

    const queryString = params.toString();
    const endpoint = `/acts/${normalizedActorId}/runs${queryString ? `?${queryString}` : ''}`;

    // Start the actor run
    const runResponse = await this.request<{ data: ActorRunResult }>(endpoint, {
      method: 'POST',
      body: JSON.stringify(input),
    });

    const run = runResponse.data;
    console.log(`Actor run started: ${run.id}, status: ${run.status}`);

    // If we waited for finish and have a dataset, fetch the items
    let items: TOutput = [] as unknown as TOutput;
    
    if (run.status === 'SUCCEEDED' && run.defaultDatasetId) {
      items = await this.getDatasetItems<TOutput>(run.defaultDatasetId);
    } else if (run.status === 'FAILED' || run.status === 'TIMED-OUT' || run.status === 'ABORTED') {
      console.error(`Actor run failed with status: ${run.status}`);
    }

    return { run, items };
  }

  /**
   * Get items from a dataset
   */
  async getDatasetItems<T = DatasetItem[]>(
    datasetId: string,
    options: {
      limit?: number;
      offset?: number;
      fields?: string[];
    } = {}
  ): Promise<T> {
    const { limit = 1000, offset = 0, fields } = options;

    const params = new URLSearchParams({
      limit: limit.toString(),
      offset: offset.toString(),
    });

    if (fields && fields.length > 0) {
      params.append('fields', fields.join(','));
    }

    const endpoint = `/datasets/${datasetId}/items?${params.toString()}`;
    const items = await this.request<T>(endpoint);
    
    return items;
  }

  /**
   * Get the status of an actor run
   */
  async getRunStatus(runId: string): Promise<ActorRunResult> {
    const endpoint = `/actor-runs/${runId}`;
    const response = await this.request<{ data: ActorRunResult }>(endpoint);
    return response.data;
  }

  /**
   * Poll for actor run completion
   */
  async waitForRun(
    runId: string,
    options: {
      pollInterval?: number; // ms
      maxWait?: number; // ms
    } = {}
  ): Promise<ActorRunResult> {
    const { pollInterval = 5000, maxWait = 300000 } = options; // 5 min default max
    const startTime = Date.now();

    while (Date.now() - startTime < maxWait) {
      const run = await this.getRunStatus(runId);

      if (['SUCCEEDED', 'FAILED', 'TIMED-OUT', 'ABORTED'].includes(run.status)) {
        return run;
      }

      await new Promise(resolve => setTimeout(resolve, pollInterval));
    }

    throw new Error(`Actor run ${runId} did not complete within ${maxWait}ms`);
  }

  /**
   * Check if the client is configured with a valid API token
   */
  isConfigured(): boolean {
    return !!this.apiToken;
  }
}

// Singleton instance
let clientInstance: ApifyClient | null = null;

/**
 * Get the singleton Apify client instance
 */
export function getApifyClient(): ApifyClient {
  if (!clientInstance) {
    clientInstance = new ApifyClient();
  }
  return clientInstance;
}

/**
 * Create a new Apify client with a specific token
 */
export function createApifyClient(apiToken: string): ApifyClient {
  return new ApifyClient(apiToken);
}

export default ApifyClient;
