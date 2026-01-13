/**
 * Self-Healing Research Orchestrator
 * 
 * A sophisticated orchestrator that:
 * - Manages research pipeline with state persistence
 * - Implements self-healing with automatic retries and fallbacks
 * - Uses AI for validation and quality scoring
 * - Provides confidence levels for research results
 * - Gracefully degrades when services are unavailable
 */

import { getResilientApifyClient, ApifyErrorType, ActorRunResult } from './resilient-apify-client';
import { getAIValidationService, ContentValidation, PersonValidation, CompanyValidation } from './ai-validation-service';

// Research state types
export enum ResearchPhase {
  NOT_STARTED = 'not_started',
  DISCOVERING_WEBSITE = 'discovering_website',
  EXTRACTING_COMPANY = 'extracting_company',
  SEARCHING_LINKEDIN = 'searching_linkedin',
  FETCHING_NEWS = 'fetching_news',
  VERIFYING_CALENDARS = 'verifying_calendars',
  VALIDATING_RESULTS = 'validating_results',
  COMPLETED = 'completed',
  FAILED = 'failed',
}

export interface ResearchState {
  phase: ResearchPhase;
  festivalId: string;
  festivalName: string;
  festivalUrl?: string;
  startedAt: string;
  lastUpdatedAt: string;
  attempts: number;
  
  // Results
  discoveredHomepage?: string;
  organizingCompany?: {
    name: string | null;
    confidence: number;
    kvkNumber?: string | null;
    validated: boolean;
    validationResult?: CompanyValidation;
  };
  linkedInResults?: {
    people: Array<{
      name: string;
      title?: string;
      url: string;
      company?: string;
      validated: boolean;
      validation?: PersonValidation;
    }>;
    searchedWith: string;
    confidence: number;
  };
  newsResults?: {
    articles: Array<{
      title: string;
      url: string;
      source?: string;
      date?: string;
      summary?: string;
      validated: boolean;
      validation?: ContentValidation;
    }>;
    confidence: number;
  };
  calendarResults?: {
    sources: Array<{
      name: string;
      found: boolean;
      url?: string;
      editionYear?: number;
      isCurrent?: boolean;
    }>;
    confidence: number;
  };
  
  // Meta
  errors: Array<{ phase: string; message: string; timestamp: string }>;
  warnings: Array<{ phase: string; message: string; timestamp: string }>;
  overallConfidence: number;
  confidenceLevel: 'high' | 'medium' | 'low';
}

export interface OrchestratorOptions {
  maxRetries?: number;
  enableAIValidation?: boolean;
  minConfidenceToPass?: number;
  parallelExecution?: boolean;
  fallbackToBasicSearch?: boolean;
}

// Calendar sources to verify
const CALENDAR_SOURCES = [
  { name: 'Festivalinfo', baseUrl: 'festivalinfo.nl', searchUrl: 'https://www.festivalinfo.nl/zoek/?q=' },
  { name: 'Partyflock', baseUrl: 'partyflock.nl', searchUrl: 'https://partyflock.nl/search?query=' },
  { name: 'EB Live', baseUrl: 'eblive.nl', searchUrl: 'https://www.eblive.nl/?s=' },
  { name: 'Festileaks', baseUrl: 'festileaks.com', searchUrl: 'https://www.festileaks.com/?s=' },
  { name: 'Follow the Beat', baseUrl: 'followthebeat.nl', searchUrl: 'https://www.followthebeat.nl/?s=' },
];

class SelfHealingOrchestrator {
  private apifyClient = getResilientApifyClient();
  private aiService = getAIValidationService();
  private state: ResearchState | null = null;
  private options: OrchestratorOptions;
  private onProgressCallback?: (state: ResearchState) => void;

  constructor(options: OrchestratorOptions = {}) {
    this.options = {
      maxRetries: 3,
      enableAIValidation: true,
      minConfidenceToPass: 0.3,
      parallelExecution: true,
      fallbackToBasicSearch: true,
      ...options,
    };
  }

  /**
   * Set a callback to receive progress updates
   */
  onProgress(callback: (state: ResearchState) => void): void {
    this.onProgressCallback = callback;
  }

  /**
   * Initialize research state
   */
  private initState(festivalId: string, festivalName: string, festivalUrl?: string): ResearchState {
    return {
      phase: ResearchPhase.NOT_STARTED,
      festivalId,
      festivalName,
      festivalUrl,
      startedAt: new Date().toISOString(),
      lastUpdatedAt: new Date().toISOString(),
      attempts: 0,
      errors: [],
      warnings: [],
      overallConfidence: 0,
      confidenceLevel: 'low',
    };
  }

  /**
   * Update state and notify progress
   */
  private updateState(updates: Partial<ResearchState>): void {
    if (this.state) {
      this.state = {
        ...this.state,
        ...updates,
        lastUpdatedAt: new Date().toISOString(),
      };
      this.onProgressCallback?.(this.state);
    }
  }

  /**
   * Record an error
   */
  private recordError(phase: string, message: string): void {
    this.state?.errors.push({
      phase,
      message,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Record a warning
   */
  private recordWarning(phase: string, message: string): void {
    this.state?.warnings.push({
      phase,
      message,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Phase 1: Discover website if not provided
   */
  private async discoverWebsite(): Promise<string | null> {
    this.updateState({ phase: ResearchPhase.DISCOVERING_WEBSITE });

    if (this.state?.festivalUrl) {
      console.log('[Orchestrator] Using provided festival URL');
      return this.state.festivalUrl;
    }

    console.log('[Orchestrator] Searching for festival website...');
    
    const searchQuery = `"${this.state?.festivalName}" festival official website`;
    const result = await this.apifyClient.runActor<any[]>(
      'apify/google-search-scraper',
      {
        queries: searchQuery,
        maxPagesPerQuery: 1,
        resultsPerPage: 5,
      },
      { maxRetries: 2 }
    );

    // Google Search Scraper returns results in organicResults array
    const organicResults = result.success && result.data?.[0]?.organicResults;
    
    if (!organicResults?.length) {
      this.recordWarning('discoverWebsite', 'Could not find festival website via search');
      
      // Fallback: try RAG web browser for direct search
      if (this.options.fallbackToBasicSearch) {
        const fallbackResult = await this.apifyClient.runActor<any[]>(
          'apify/rag-web-browser',
          {
            query: `${this.state?.festivalName} festival official site`,
            maxResults: 3,
            outputFormats: ['markdown'],
          },
          { maxRetries: 1 }
        );

        if (fallbackResult.success && fallbackResult.data?.[0]) {
          const ragResult = fallbackResult.data[0];
          return ragResult.url || ragResult.crawl?.requestUrl;
        }
      }
      
      return null;
    }

    // Filter out social media and calendar sites
    const excludePatterns = [
      /facebook\.com/i, /instagram\.com/i, /twitter\.com/i,
      /linkedin\.com/i, /youtube\.com/i, /spotify\.com/i,
      /festivalinfo/i, /partyflock/i, /eblive/i, /festileaks/i,
    ];

    for (const item of organicResults) {
      const url = item.url || item.link;
      if (url && !excludePatterns.some(p => p.test(url))) {
        return url;
      }
    }

    return null;
  }

  /**
   * Phase 2: Extract company information from website
   */
  private async extractCompanyInfo(websiteUrl: string): Promise<void> {
    this.updateState({ phase: ResearchPhase.EXTRACTING_COMPANY });
    console.log('[Orchestrator] Extracting company info from website...');

    const pagesToCheck = [
      websiteUrl,
      `${new URL(websiteUrl).origin}/privacy`,
      `${new URL(websiteUrl).origin}/contact`,
      `${new URL(websiteUrl).origin}/about`,
      `${new URL(websiteUrl).origin}/over-ons`,
    ];

    const companyPatterns = [
      /([A-Z][A-Za-z0-9\s&\-']+)\s+(?:B\.?V\.?|BV)/gi,
      /(?:Stichting|Foundation)\s+([A-Z][A-Za-z0-9\s&\-']+)/gi,
      /(?:organized|organised|georganiseerd)\s+(?:by|door)\s+([A-Z][A-Za-z0-9\s&\-']+)/gi,
      /©\s*\d{4}\s+([A-Z][A-Za-z0-9\s&\-']+)/gi,
      /KvK[:\s]+(\d{8})/gi,
    ];

    const allMatches: Array<{ name: string; source: string; count: number }> = [];
    let kvkNumber: string | null = null;

    // Try to scrape pages for company info
    for (const url of pagesToCheck.slice(0, 3)) { // Limit to 3 pages to save resources
      const result = await this.apifyClient.runActor<any[]>(
        'apify/rag-web-browser',
        {
          query: url,
          maxResults: 1,
          outputFormats: ['markdown'],
        },
        { maxRetries: 1 }
      );

      if (result.success && result.data?.[0]) {
        const content = result.data[0].markdown || result.data[0].text || '';
        
        for (const pattern of companyPatterns) {
          const regex = new RegExp(pattern.source, pattern.flags);
          let match;
          while ((match = regex.exec(content)) !== null) {
            const extracted = match[1]?.trim();
            if (extracted) {
              if (/^\d{8}$/.test(extracted)) {
                kvkNumber = extracted;
              } else if (extracted.length > 3 && extracted.length < 80) {
                const existing = allMatches.find(m => m.name.toLowerCase() === extracted.toLowerCase());
                if (existing) {
                  existing.count++;
                } else {
                  allMatches.push({ name: extracted, source: url, count: 1 });
                }
              }
            }
          }
        }
      }
    }

    // Sort by count and pick best match
    allMatches.sort((a, b) => b.count - a.count);
    const bestMatch = allMatches[0];

    if (bestMatch) {
      let confidence = Math.min(0.9, 0.3 + (bestMatch.count * 0.15));
      if (kvkNumber) confidence = Math.min(1, confidence + 0.2);

      // Validate with AI if available
      let validationResult: CompanyValidation | undefined;
      if (this.options.enableAIValidation && this.aiService.isAvailable()) {
        validationResult = await this.aiService.validateCompanyName(
          this.state?.festivalName || '',
          bestMatch.name,
          bestMatch.source
        );
        
        // Adjust confidence based on AI validation
        if (validationResult.isValid) {
          confidence = Math.max(confidence, validationResult.confidence);
        } else {
          confidence = Math.min(confidence, 0.3);
          this.recordWarning('extractCompany', `AI flagged company "${bestMatch.name}" as potentially invalid`);
        }
      }

      this.updateState({
        organizingCompany: {
          name: validationResult?.normalizedName || bestMatch.name,
          confidence,
          kvkNumber,
          validated: !!validationResult,
          validationResult,
        },
      });
    } else {
      this.recordWarning('extractCompany', 'No company information found on website');
      this.updateState({
        organizingCompany: {
          name: null,
          confidence: 0,
          validated: false,
        },
      });
    }
  }

  /**
   * Phase 3: Search LinkedIn for relevant people
   */
  private async searchLinkedIn(): Promise<void> {
    this.updateState({ phase: ResearchPhase.SEARCHING_LINKEDIN });
    console.log('[Orchestrator] Searching LinkedIn for people...');

    const festivalName = this.state?.festivalName || '';
    const companyName = this.state?.organizingCompany?.name;

    // Build intelligent search queries
    const queries: string[] = [];
    
    if (companyName) {
      queries.push(`"${companyName}" festival organizer`);
      queries.push(`"${companyName}" director OR founder OR CEO`);
    }
    queries.push(`"${festivalName}" organizer OR director OR founder`);
    queries.push(`"${festivalName}" festival production`);

    const searchQuery = queries.slice(0, 2).join(' OR ');
    
    const result = await this.apifyClient.runActor<any[]>(
      'apify/google-search-scraper',
      {
        queries: `site:linkedin.com/in ${searchQuery}`,
        maxPagesPerQuery: 1,
        resultsPerPage: 10,
      },
      { maxRetries: 2 }
    );

    const people: Array<{
      name: string;
      title?: string;
      url: string;
      company?: string;
      validated: boolean;
      validation?: PersonValidation;
    }> = [];

    // Google Search Scraper returns results in organicResults array
    const organicResults = result.success && result.data?.[0]?.organicResults;
    
    if (organicResults?.length) {
      for (const item of organicResults.slice(0, 10)) {
        const url = item.url || item.link;
        if (!url?.includes('linkedin.com/in/')) continue;

        // Extract name and title from search result
        const title = item.title || '';
        const snippet = item.snippet || item.description || '';
        
        const nameMatch = title.match(/^([^-–|]+)/);
        const name = nameMatch ? nameMatch[1].trim() : '';
        
        if (!name) continue;

        // Extract job title from title or snippet
        const titleMatch = title.match(/[-–|]\s*(.+?)(?:\s*[-–|]|$)/);
        const jobTitle = titleMatch ? titleMatch[1].trim() : undefined;
        
        const person: typeof people[0] = {
          name,
          title: jobTitle,
          url,
          validated: false,
        };

        // Validate with AI if available
        if (this.options.enableAIValidation && this.aiService.isAvailable()) {
          const validation = await this.aiService.validateLinkedInPerson(
            festivalName,
            name,
            jobTitle || null,
            null,
            companyName || null
          );
          
          person.validated = true;
          person.validation = validation;
          
          // Only include if AI says it's relevant
          if (validation.isRelevant && validation.confidence >= 0.4) {
            people.push(person);
          }
        } else {
          // Without AI, include all results
          people.push(person);
        }
      }
    }

    const confidence = people.length > 0 
      ? Math.min(0.9, 0.3 + (people.length * 0.1))
      : 0;

    this.updateState({
      linkedInResults: {
        people,
        searchedWith: searchQuery,
        confidence,
      },
    });

    if (people.length === 0) {
      this.recordWarning('searchLinkedIn', 'No relevant LinkedIn profiles found');
    }
  }

  /**
   * Phase 4: Fetch and summarize news
   */
  private async fetchNews(): Promise<void> {
    this.updateState({ phase: ResearchPhase.FETCHING_NEWS });
    console.log('[Orchestrator] Fetching news articles...');

    const festivalName = this.state?.festivalName || '';
    const currentYear = new Date().getFullYear();

    // Search for recent news
    const result = await this.apifyClient.runActor<any[]>(
      'apify/google-search-scraper',
      {
        queries: `"${festivalName}" festival ${currentYear} news OR review`,
        maxPagesPerQuery: 1,
        resultsPerPage: 10,
      },
      { maxRetries: 2 }
    );

    const articles: Array<{
      title: string;
      url: string;
      source?: string;
      date?: string;
      summary?: string;
      validated: boolean;
      validation?: ContentValidation;
    }> = [];

    // Google Search Scraper returns results in organicResults array
    const organicResults = result.success && result.data?.[0]?.organicResults;
    
    if (organicResults?.length) {
      // Filter to actual news articles
      const newsItems = organicResults.filter((item: any) => {
        const url = item.url || item.link || '';
        return !url.includes('linkedin.com') && 
               !url.includes('facebook.com') &&
               !url.includes('instagram.com');
      }).slice(0, 5);

      // Fetch and summarize each article
      for (const item of newsItems) {
        const url = item.url || item.link;
        if (!url) continue;

        const article: typeof articles[0] = {
          title: item.title || 'Untitled',
          url,
          source: new URL(url).hostname.replace('www.', ''),
          validated: false,
        };

        // Try to fetch full content for summary
        const contentResult = await this.apifyClient.runActor<any[]>(
          'apify/rag-web-browser',
          {
            query: url,
            maxResults: 1,
            outputFormats: ['markdown'],
          },
          { maxRetries: 1 }
        );

        if (contentResult.success && contentResult.data?.[0]) {
          const content = contentResult.data[0].markdown || contentResult.data[0].text || '';
          
          // Validate and summarize with AI
          if (this.options.enableAIValidation && this.aiService.isAvailable()) {
            const validation = await this.aiService.validateContent(
              festivalName,
              content,
              'news'
            );
            
            article.validated = true;
            article.validation = validation;
            article.summary = validation.summary;
            
            // Extract date from validation key facts
            const dateMatch = content.match(/\b(20\d{2}[-/]\d{1,2}[-/]\d{1,2}|\d{1,2}[-/]\d{1,2}[-/]20\d{2})\b/);
            if (dateMatch) article.date = dateMatch[1];
          } else {
            // Basic summary without AI
            article.summary = content.substring(0, 200).trim() + '...';
          }
        }

        articles.push(article);
      }
    }

    const confidence = articles.length > 0 
      ? Math.min(0.9, 0.3 + (articles.length * 0.12))
      : 0;

    this.updateState({
      newsResults: {
        articles,
        confidence,
      },
    });

    if (articles.length === 0) {
      this.recordWarning('fetchNews', 'No news articles found');
    }
  }

  /**
   * Phase 5: Verify presence on calendar websites
   */
  private async verifyCalendars(): Promise<void> {
    this.updateState({ phase: ResearchPhase.VERIFYING_CALENDARS });
    console.log('[Orchestrator] Verifying calendar sources...');

    const festivalName = this.state?.festivalName || '';
    const currentYear = new Date().getFullYear();
    
    const sources: Array<{
      name: string;
      found: boolean;
      url?: string;
      editionYear?: number;
      isCurrent?: boolean;
    }> = [];

    // Check each calendar source
    for (const calendar of CALENDAR_SOURCES) {
      const searchUrl = `${calendar.searchUrl}${encodeURIComponent(festivalName)}`;
      
      const result = await this.apifyClient.runActor<any[]>(
        'apify/rag-web-browser',
        {
          query: searchUrl,
          maxResults: 1,
          outputFormats: ['markdown'],
        },
        { maxRetries: 1 }
      );

      const source: typeof sources[0] = {
        name: calendar.name,
        found: false,
      };

      if (result.success && result.data?.[0]) {
        const content = result.data[0].markdown || result.data[0].text || '';
        const contentLower = content.toLowerCase();
        const festivalLower = festivalName.toLowerCase();

        // Check if festival is mentioned
        if (contentLower.includes(festivalLower)) {
          source.found = true;
          source.url = searchUrl;
          
          // Try to extract edition year
          const yearMatches = content.match(/\b(202[4-9]|203[0-9])\b/g);
          if (yearMatches) {
            const years = yearMatches.map(y => parseInt(y));
            const latestYear = Math.max(...years);
            source.editionYear = latestYear;
            source.isCurrent = latestYear >= currentYear;
          }
        }
      }

      sources.push(source);
    }

    const foundCount = sources.filter(s => s.found).length;
    const currentCount = sources.filter(s => s.isCurrent).length;
    
    const confidence = foundCount > 0 
      ? Math.min(0.9, 0.3 + (foundCount * 0.15) + (currentCount * 0.1))
      : 0;

    this.updateState({
      calendarResults: {
        sources,
        confidence,
      },
    });

    if (foundCount === 0) {
      this.recordWarning('verifyCalendars', 'Festival not found on any calendar sites');
    }
  }

  /**
   * Calculate overall confidence score
   */
  private calculateOverallConfidence(): void {
    this.updateState({ phase: ResearchPhase.VALIDATING_RESULTS });

    const weights = {
      company: 0.3,
      linkedin: 0.25,
      news: 0.2,
      calendar: 0.25,
    };

    const scores = {
      company: this.state?.organizingCompany?.confidence || 0,
      linkedin: this.state?.linkedInResults?.confidence || 0,
      news: this.state?.newsResults?.confidence || 0,
      calendar: this.state?.calendarResults?.confidence || 0,
    };

    const overall = 
      (scores.company * weights.company) +
      (scores.linkedin * weights.linkedin) +
      (scores.news * weights.news) +
      (scores.calendar * weights.calendar);

    const level: 'high' | 'medium' | 'low' = 
      overall >= 0.7 ? 'high' : overall >= 0.4 ? 'medium' : 'low';

    this.updateState({
      overallConfidence: overall,
      confidenceLevel: level,
    });
  }

  /**
   * Main orchestration method - run the full research pipeline
   */
  async runResearch(
    festivalId: string,
    festivalName: string,
    festivalUrl?: string
  ): Promise<ResearchState> {
    console.log(`[Orchestrator] Starting research for: ${festivalName}`);
    
    // Initialize state
    this.state = this.initState(festivalId, festivalName, festivalUrl);
    this.updateState({ attempts: 1 });

    try {
      // Phase 1: Discover website
      const websiteUrl = await this.discoverWebsite();
      if (websiteUrl) {
        this.updateState({ discoveredHomepage: websiteUrl });
        
        // Phase 2: Extract company info (depends on Phase 1)
        await this.extractCompanyInfo(websiteUrl);
      }

      // Phases 3-5 can run in parallel if enabled
      if (this.options.parallelExecution) {
        await Promise.all([
          this.searchLinkedIn(),
          this.fetchNews(),
          this.verifyCalendars(),
        ]);
      } else {
        await this.searchLinkedIn();
        await this.fetchNews();
        await this.verifyCalendars();
      }

      // Calculate final confidence
      this.calculateOverallConfidence();

      // Check if we should retry for better results
      if (this.state.overallConfidence < (this.options.minConfidenceToPass || 0.3)) {
        if (this.state.attempts < (this.options.maxRetries || 3)) {
          console.log('[Orchestrator] Low confidence, attempting retry with AI suggestions...');
          
          if (this.aiService.isAvailable()) {
            const strategy = await this.aiService.suggestRetryStrategy(
              festivalName,
              {
                company: this.state.organizingCompany,
                linkedin: this.state.linkedInResults,
                news: this.state.newsResults,
                calendar: this.state.calendarResults,
              },
              this.state.errors.map(e => e.phase)
            );

            if (strategy.shouldRetry) {
              this.recordWarning('orchestrator', `Retrying based on AI suggestion: ${strategy.strategies[0]?.suggestion || 'default'}`);
              this.updateState({ attempts: this.state.attempts + 1 });
              // Could implement more sophisticated retry here
            }
          }
        }
      }

      this.updateState({ phase: ResearchPhase.COMPLETED });
      
    } catch (error: any) {
      console.error('[Orchestrator] Research failed:', error);
      this.recordError('orchestrator', error.message);
      this.updateState({ phase: ResearchPhase.FAILED });
    }

    return this.state;
  }

  /**
   * Get current state (for resuming or checking progress)
   */
  getState(): ResearchState | null {
    return this.state;
  }
}

// Factory function
export function createOrchestrator(options?: OrchestratorOptions): SelfHealingOrchestrator {
  return new SelfHealingOrchestrator(options);
}

export { SelfHealingOrchestrator };
