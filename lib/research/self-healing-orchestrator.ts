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
  SEARCHING_LINKEDIN_COMPANY = 'searching_linkedin_company',
  SEARCHING_LINKEDIN_EMPLOYEES = 'searching_linkedin_employees',
  FETCHING_NEWS = 'fetching_news',
  VERIFYING_CALENDARS = 'verifying_calendars',
  VALIDATING_RESULTS = 'validating_results',
  COMPLETED = 'completed',
  FAILED = 'failed',
}

// Employment verification types
export interface EmploymentVerification {
  isVerified: boolean;
  confidence: number;
  matchType: 'explicit_employment' | 'title_match' | 'company_mention' | 'unverified';
  evidence: string[];
}

// LinkedIn connection with enhanced data
export interface LinkedInConnection {
  name: string;
  title?: string;
  url: string;
  company?: string;
  role: 'decision_maker' | 'manager' | 'team_member' | 'unknown';
  employmentVerified: boolean;
  verification?: EmploymentVerification;
  discoveredVia: 'company_employee_search' | 'festival_search' | 'general_search';
  validated: boolean;
  validation?: PersonValidation;
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
  // Company LinkedIn page
  companyLinkedIn?: {
    url: string;
    name: string;
    description?: string;
    employeeCount?: number;
    verified: boolean;
  };
  // Enhanced LinkedIn connections
  linkedInConnections?: LinkedInConnection[];
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
  
  // Quality metrics
  qualityScore?: {
    overall: number;
    companyDiscovery: number;
    linkedinConnections: number;
    dataCompleteness: number;
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
   * Verify employment connection for a LinkedIn profile
   */
  private verifyEmployment(
    profileTitle: string,
    profileSnippet: string,
    companyName: string
  ): EmploymentVerification {
    const evidence: string[] = [];
    const companyLower = companyName.toLowerCase();
    const textLower = `${profileTitle} ${profileSnippet}`.toLowerCase();
    
    // Employment patterns ordered by strength
    const employmentPatterns = [
      { pattern: new RegExp(`works at ${companyLower}`, 'i'), type: 'explicit_employment' as const, weight: 1.0 },
      { pattern: new RegExp(`employee at ${companyLower}`, 'i'), type: 'explicit_employment' as const, weight: 1.0 },
      { pattern: new RegExp(`${companyLower} employee`, 'i'), type: 'explicit_employment' as const, weight: 1.0 },
      { pattern: new RegExp(`director at ${companyLower}`, 'i'), type: 'explicit_employment' as const, weight: 0.95 },
      { pattern: new RegExp(`ceo at ${companyLower}`, 'i'), type: 'explicit_employment' as const, weight: 0.95 },
      { pattern: new RegExp(`founder of ${companyLower}`, 'i'), type: 'explicit_employment' as const, weight: 0.95 },
      { pattern: new RegExp(`manager at ${companyLower}`, 'i'), type: 'explicit_employment' as const, weight: 0.9 },
      { pattern: new RegExp(`owner of ${companyLower}`, 'i'), type: 'explicit_employment' as const, weight: 0.9 },
      { pattern: new RegExp(`at ${companyLower}`, 'i'), type: 'title_match' as const, weight: 0.7 },
      { pattern: new RegExp(`bij ${companyLower}`, 'i'), type: 'title_match' as const, weight: 0.7 }, // Dutch
      { pattern: new RegExp(companyLower, 'i'), type: 'company_mention' as const, weight: 0.4 },
    ];
    
    let bestMatch: { type: EmploymentVerification['matchType']; weight: number } | null = null;
    
    for (const { pattern, type, weight } of employmentPatterns) {
      if (pattern.test(textLower)) {
        evidence.push(`Matched pattern: ${pattern.source}`);
        if (!bestMatch || weight > bestMatch.weight) {
          bestMatch = { type, weight };
        }
      }
    }
    
    if (bestMatch) {
      return {
        isVerified: bestMatch.weight >= 0.7,
        confidence: bestMatch.weight,
        matchType: bestMatch.type,
        evidence,
      };
    }
    
    return {
      isVerified: false,
      confidence: 0,
      matchType: 'unverified',
      evidence: ['No employment patterns matched'],
    };
  }

  /**
   * Determine role based on job title
   */
  private determineRole(jobTitle?: string): LinkedInConnection['role'] {
    if (!jobTitle) return 'unknown';
    
    const titleLower = jobTitle.toLowerCase();
    
    // Decision makers
    if (/\b(ceo|founder|owner|eigenaar|directeur|director|managing|general manager|oprichter|bestuurder)\b/i.test(titleLower)) {
      return 'decision_maker';
    }
    
    // Managers
    if (/\b(manager|head|lead|hoofd|coordinator|producer|programmer)\b/i.test(titleLower)) {
      return 'manager';
    }
    
    // Team members (any festival/event related role)
    if (/\b(festival|event|booking|marketing|production|operations|artist relations)\b/i.test(titleLower)) {
      return 'team_member';
    }
    
    return 'unknown';
  }

  /**
   * Phase 3a: Search LinkedIn for company page
   */
  private async searchLinkedInCompany(): Promise<void> {
    this.updateState({ phase: ResearchPhase.SEARCHING_LINKEDIN_COMPANY });
    console.log('[Orchestrator] Searching LinkedIn for company page...');

    const festivalName = this.state?.festivalName || '';
    const companyName = this.state?.organizingCompany?.name;

    if (!companyName) {
      console.log('[Orchestrator] No company name found, searching with festival name only');
    }

    // Search queries for company page
    const companyQueries: string[] = [];
    if (companyName) {
      companyQueries.push(`site:linkedin.com/company "${companyName}"`);
    }
    companyQueries.push(`site:linkedin.com/company "${festivalName}"`);
    
    for (const query of companyQueries) {
      const result = await this.apifyClient.runActor<any[]>(
        'apify/google-search-scraper',
        {
          queries: query,
          maxPagesPerQuery: 1,
          resultsPerPage: 5,
        },
        { maxRetries: 2 }
      );

      const organicResults = result.success && result.data?.[0]?.organicResults;
      
      if (organicResults?.length) {
        for (const item of organicResults) {
          const url = item.url || item.link;
          if (!url?.includes('linkedin.com/company/')) continue;

          const title = item.title || '';
          const snippet = item.snippet || item.description || '';
          
          // Extract company name from title (format: "Company Name | LinkedIn")
          const companyNameMatch = title.replace(/ \| LinkedIn$/, '').replace(/: Overview$/, '');
          
          this.updateState({
            companyLinkedIn: {
              url,
              name: companyNameMatch || companyName || festivalName,
              description: snippet,
              verified: true,
            },
          });
          
          console.log(`[Orchestrator] Found company LinkedIn page: ${url}`);
          return; // Found company page, move on
        }
      }
    }

    this.recordWarning('searchLinkedInCompany', 'No company LinkedIn page found');
  }

  /**
   * Phase 3b: Search LinkedIn for employees of the company
   */
  private async searchLinkedInEmployees(): Promise<void> {
    this.updateState({ phase: ResearchPhase.SEARCHING_LINKEDIN_EMPLOYEES });
    console.log('[Orchestrator] Searching LinkedIn for company employees...');

    const festivalName = this.state?.festivalName || '';
    const companyName = this.state?.organizingCompany?.name;
    
    const connections: LinkedInConnection[] = [];
    const seenUrls = new Set<string>();

    // Phase A: If we have a company name, search for employees OF that company (high priority)
    if (companyName) {
      const employeeQueries = [
        `site:linkedin.com/in "works at ${companyName}"`,
        `site:linkedin.com/in "at ${companyName}" director OR CEO OR founder OR manager`,
        `site:linkedin.com/in "${companyName}" festival OR event director OR manager`,
      ];

      for (const query of employeeQueries) {
        const result = await this.apifyClient.runActor<any[]>(
          'apify/google-search-scraper',
          {
            queries: query,
            maxPagesPerQuery: 1,
            resultsPerPage: 10,
          },
          { maxRetries: 2 }
        );

        const organicResults = result.success && result.data?.[0]?.organicResults;
        
        if (organicResults?.length) {
          for (const item of organicResults) {
            const url = item.url || item.link;
            if (!url?.includes('linkedin.com/in/') || seenUrls.has(url)) continue;
            seenUrls.add(url);

            const title = item.title || '';
            const snippet = item.snippet || item.description || '';
            
            // Parse name and job title
            const nameMatch = title.match(/^([^-–|]+)/);
            const name = nameMatch ? nameMatch[1].trim() : '';
            if (!name) continue;

            const titleMatch = title.match(/[-–|]\s*(.+?)(?:\s*[-–|]|$)/);
            const jobTitle = titleMatch ? titleMatch[1].trim() : undefined;

            // Verify employment
            const verification = this.verifyEmployment(title, snippet, companyName);
            
            // Only include if employment is verified
            if (verification.isVerified) {
              const connection: LinkedInConnection = {
                name,
                title: jobTitle,
                url,
                company: companyName,
                role: this.determineRole(jobTitle),
                employmentVerified: true,
                verification,
                discoveredVia: 'company_employee_search',
                validated: false,
              };

              // AI validation if available
              if (this.options.enableAIValidation && this.aiService.isAvailable()) {
                const validation = await this.aiService.validateLinkedInPerson(
                  festivalName,
                  name,
                  jobTitle || null,
                  null,
                  companyName
                );
                connection.validated = true;
                connection.validation = validation;
                
                if (validation.isRelevant && validation.confidence >= 0.4) {
                  connections.push(connection);
                }
              } else {
                connections.push(connection);
              }
            }
          }
        }
      }
    }

    // Phase B: Search for people associated with festival name (fallback/additional)
    const festivalQueries = [
      `site:linkedin.com/in "${festivalName}" organizer OR director OR founder OR producer`,
      `site:linkedin.com/in "${festivalName}" festival manager OR event manager`,
    ];

    for (const query of festivalQueries) {
      const result = await this.apifyClient.runActor<any[]>(
        'apify/google-search-scraper',
        {
          queries: query,
          maxPagesPerQuery: 1,
          resultsPerPage: 8,
        },
        { maxRetries: 2 }
      );

      const organicResults = result.success && result.data?.[0]?.organicResults;
      
      if (organicResults?.length) {
        for (const item of organicResults) {
          const url = item.url || item.link;
          if (!url?.includes('linkedin.com/in/') || seenUrls.has(url)) continue;
          seenUrls.add(url);

          const title = item.title || '';
          const snippet = item.snippet || item.description || '';
          
          const nameMatch = title.match(/^([^-–|]+)/);
          const name = nameMatch ? nameMatch[1].trim() : '';
          if (!name) continue;

          const titleMatch = title.match(/[-–|]\s*(.+?)(?:\s*[-–|]|$)/);
          const jobTitle = titleMatch ? titleMatch[1].trim() : undefined;

          // For festival-based searches, check if company name mentioned in snippet
          let verification: EmploymentVerification | undefined;
          let employmentVerified = false;
          
          if (companyName) {
            verification = this.verifyEmployment(title, snippet, companyName);
            employmentVerified = verification.isVerified;
          }

          const connection: LinkedInConnection = {
            name,
            title: jobTitle,
            url,
            company: companyName || undefined,
            role: this.determineRole(jobTitle),
            employmentVerified,
            verification,
            discoveredVia: 'festival_search',
            validated: false,
          };

          // AI validation if available
          if (this.options.enableAIValidation && this.aiService.isAvailable()) {
            const validation = await this.aiService.validateLinkedInPerson(
              festivalName,
              name,
              jobTitle || null,
              null,
              companyName || null
            );
            connection.validated = true;
            connection.validation = validation;
            
            if (validation.isRelevant && validation.confidence >= 0.3) {
              connections.push(connection);
            }
          } else {
            connections.push(connection);
          }
        }
      }
    }

    // Sort connections: verified employees first, then by role
    const roleOrder = { decision_maker: 0, manager: 1, team_member: 2, unknown: 3 };
    connections.sort((a, b) => {
      // Verified employees first
      if (a.employmentVerified && !b.employmentVerified) return -1;
      if (!a.employmentVerified && b.employmentVerified) return 1;
      // Then by role
      return roleOrder[a.role] - roleOrder[b.role];
    });

    // Calculate confidence
    const verifiedCount = connections.filter(c => c.employmentVerified).length;
    const decisionMakerCount = connections.filter(c => c.role === 'decision_maker').length;
    
    const confidence = connections.length > 0 
      ? Math.min(0.95, 0.2 + (verifiedCount * 0.15) + (decisionMakerCount * 0.1) + (connections.length * 0.05))
      : 0;

    // Update state with new LinkedIn connections
    this.updateState({
      linkedInConnections: connections.slice(0, 15), // Top 15 connections
      linkedInResults: {
        people: connections.slice(0, 15).map(c => ({
          name: c.name,
          title: c.title,
          url: c.url,
          company: c.company,
          validated: c.validated,
          validation: c.validation,
        })),
        searchedWith: companyName ? `Company: ${companyName}` : `Festival: ${festivalName}`,
        confidence,
      },
    });

    console.log(`[Orchestrator] Found ${connections.length} LinkedIn connections (${verifiedCount} verified employees)`);

    if (connections.length === 0) {
      this.recordWarning('searchLinkedInEmployees', 'No relevant LinkedIn profiles found');
    }
  }

  /**
   * Phase 4: Fetch and summarize news (uses company name if available)
   */
  private async fetchNews(): Promise<void> {
    this.updateState({ phase: ResearchPhase.FETCHING_NEWS });
    console.log('[Orchestrator] Fetching news articles...');

    const festivalName = this.state?.festivalName || '';
    const companyName = this.state?.organizingCompany?.name;
    const currentYear = new Date().getFullYear();

    // Build search query - include company name if available for better results
    let searchQuery = `"${festivalName}" festival ${currentYear} news OR review`;
    if (companyName) {
      searchQuery = `("${festivalName}" OR "${companyName}") festival ${currentYear} news OR review OR organisator`;
    }

    // Search for recent news
    const result = await this.apifyClient.runActor<any[]>(
      'apify/google-search-scraper',
      {
        queries: searchQuery,
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
   * Calculate overall confidence score with emphasis on verified LinkedIn connections
   */
  private calculateOverallConfidence(): void {
    this.updateState({ phase: ResearchPhase.VALIDATING_RESULTS });

    // Updated weights - LinkedIn connections are more important
    const weights = {
      company: 0.25,
      linkedin: 0.35,  // Increased weight for LinkedIn
      news: 0.15,
      calendar: 0.25,
    };

    // Calculate LinkedIn confidence with emphasis on verified employees
    const verifiedCount = this.state?.linkedInConnections?.filter(c => c.employmentVerified).length || 0;
    const decisionMakerCount = this.state?.linkedInConnections?.filter(c => c.role === 'decision_maker').length || 0;
    const hasCompanyLinkedIn = !!this.state?.companyLinkedIn;
    
    const linkedinConfidence = Math.min(0.95, 
      (this.state?.linkedInResults?.confidence || 0) * 0.4 +
      (verifiedCount > 0 ? 0.3 : 0) +
      (decisionMakerCount > 0 ? 0.2 : 0) +
      (hasCompanyLinkedIn ? 0.15 : 0)
    );

    const scores = {
      company: this.state?.organizingCompany?.confidence || 0,
      linkedin: linkedinConfidence,
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
   * Calculate quality score based on research completeness
   */
  private calculateQualityScore(): void {
    const hasHomepage = !!this.state?.discoveredHomepage;
    const hasCompany = !!this.state?.organizingCompany?.name;
    const hasLinkedInCompany = !!this.state?.companyLinkedIn;
    const hasVerifiedContacts = (this.state?.linkedInConnections?.filter(c => c.employmentVerified).length || 0) > 0;
    
    const companyDiscoveryScore = hasCompany 
      ? (this.state?.organizingCompany?.confidence || 0) 
      : 0;
    
    const verifiedCount = this.state?.linkedInConnections?.filter(c => c.employmentVerified).length || 0;
    const decisionMakerCount = this.state?.linkedInConnections?.filter(c => c.role === 'decision_maker').length || 0;
    const linkedinScore = Math.min(1, (verifiedCount * 0.2) + (decisionMakerCount * 0.15) + (hasLinkedInCompany ? 0.2 : 0));
    
    const completenessScore = [hasHomepage, hasCompany, hasLinkedInCompany, hasVerifiedContacts]
      .filter(Boolean).length / 4;
    
    const overallScore = (companyDiscoveryScore * 0.3) + (linkedinScore * 0.4) + (completenessScore * 0.3);
    
    this.updateState({
      qualityScore: {
        overall: Math.round(overallScore * 100),
        companyDiscovery: Math.round(companyDiscoveryScore * 100),
        linkedinConnections: Math.round(linkedinScore * 100),
        dataCompleteness: Math.round(completenessScore * 100),
      },
    });
  }

  /**
   * Main orchestration method - run the full research pipeline
   * Uses STRICT SEQUENTIAL flow for better data quality
   */
  async runResearch(
    festivalId: string,
    festivalName: string,
    festivalUrl?: string
  ): Promise<ResearchState> {
    console.log(`[Orchestrator] Starting SEQUENTIAL research for: ${festivalName}`);
    
    // Initialize state
    this.state = this.initState(festivalId, festivalName, festivalUrl);
    this.updateState({ attempts: 1 });

    try {
      // ============================================
      // PHASE 1: Discover festival website
      // ============================================
      const websiteUrl = await this.discoverWebsite();
      if (websiteUrl) {
        this.updateState({ discoveredHomepage: websiteUrl });
        
        // ============================================
        // PHASE 2: Extract company info (REQUIRED for LinkedIn)
        // This MUST complete before LinkedIn search
        // ============================================
        await this.extractCompanyInfo(websiteUrl);
      }

      // ============================================
      // PHASE 3a: Search LinkedIn for company page
      // Uses company name from Phase 2
      // ============================================
      await this.searchLinkedInCompany();
      
      // ============================================
      // PHASE 3b: Search LinkedIn for employees
      // Uses company name from Phase 2 for verification
      // ============================================
      await this.searchLinkedInEmployees();

      // ============================================
      // PHASE 4-5: News and Calendar can run in parallel
      // These use company name for better queries
      // ============================================
      if (this.options.parallelExecution) {
        await Promise.all([
          this.fetchNews(),
          this.verifyCalendars(),
        ]);
      } else {
        await this.fetchNews();
        await this.verifyCalendars();
      }

      // ============================================
      // PHASE 6: Calculate quality metrics
      // ============================================
      this.calculateOverallConfidence();
      this.calculateQualityScore();

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
      
      console.log(`[Orchestrator] Research completed. Quality score: ${this.state.qualityScore?.overall || 0}%`);
      
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
