/**
 * Festival Calendar Verification Tools
 * 
 * Tools for verifying festival presence across Dutch festival calendar websites.
 * Uses documented scrapers from the daniel/old files/ guides and Apify for execution.
 */

import { z } from 'zod';
import { getApifyClient, APIFY_ACTORS } from './client';
import type { ToolDefinition } from '../orchestrator/types';

/**
 * Documented Dutch Festival Calendar Sources
 * Based on documentation in daniel/old files/ and scrapers/
 */
export const FESTIVAL_CALENDAR_SOURCES = {
  // Working scrapers
  EBLIVE: {
    name: 'EB Live',
    url: 'https://www.eblive.nl/festivals/',
    searchUrl: (query: string) => `https://www.eblive.nl/festivals/?filters%5Bsearch%5D=${encodeURIComponent(query)}`,
    status: 'active',
    selectors: {
      festivalContainer: 'main > a[href*="festival_id"]',
      festivalName: 'h5',
    },
  },
  FESTIVALINFO: {
    name: 'FestivalInfo.nl',
    url: 'https://www.festivalinfo.nl/festivals/',
    searchUrl: (query: string) => `https://www.festivalinfo.nl/festivals/?q=${encodeURIComponent(query)}`,
    status: 'active',
    selectors: {
      festivalContainer: 'a[href*="/festival/"]',
      festivalName: 'strong',
    },
  },
  // Documented but not yet implemented
  PARTYFLOCK: {
    name: 'Partyflock',
    url: 'https://partyflock.nl/agenda/festivals',
    status: 'documented',
    selectors: {
      festivalContainer: 'tr',
      festivalName: 'span[itemprop="name"]',
    },
  },
  FESTILEAKS: {
    name: 'Festileaks',
    url: 'https://festileaks.com/festivalagenda/',
    status: 'documented',
    selectors: {
      festivalContainer: '.festivals-list-item',
      festivalName: '.festival-title',
    },
  },
  BEFESTI: {
    name: 'Befesti',
    url: 'https://befesti.nl/festivalagenda',
    status: 'documented',
    selectors: {
      festivalContainer: '.w-dyn-item',
      festivalName: '[data-element="card-title"]',
    },
  },
  FESTIVALFANS: {
    name: 'Festivalfans',
    url: 'https://festivalfans.nl/agenda/',
    status: 'documented',
    selectors: {
      festivalContainer: '.festival-item, .event-item, article.event, .agenda-item',
      festivalName: 'h2, h3, .event-title, .festival-title',
    },
  },
  FOLLOWTHEBEAT: {
    name: 'FollowTheBeat',
    url: 'https://followthebeat.nl/agenda/',
    status: 'documented',
    selectors: {
      festivalContainer: '.event-item, .festival-item, article.event, .agenda-item',
      festivalName: 'h2, h3, .event-title, .title',
    },
  },
} as const;

export type CalendarSourceKey = keyof typeof FESTIVAL_CALENDAR_SOURCES;

// ============================================================================
// Calendar Verification Result Types
// ============================================================================

export interface CalendarVerificationResult {
  source: string;
  sourceUrl: string;
  found: boolean;
  festivalUrl?: string;
  listingDetails?: {
    name?: string;
    date?: string;
    location?: string;
  };
  editionYear?: number | null;
  isCurrent?: boolean;
  checkedAt: string;
  error?: string;
}

export interface FullVerificationResult {
  festivalName: string;
  verifiedAt: string;
  sources: CalendarVerificationResult[];
  summary: {
    totalSources: number;
    foundOn: number;
    notFoundOn: number;
    errors: number;
  };
  isActive: boolean; // Found on at least one source
}

// ============================================================================
// Calendar Verification Tool
// ============================================================================

export const verifyFestivalOnCalendarsTool: ToolDefinition = {
  name: 'verify_festival_on_calendars',
  description: `Verify if a festival is listed on Dutch festival calendar websites. Checks multiple sources including EB Live, FestivalInfo.nl, Partyflock, Festileaks, Befesti, Festivalfans, and FollowTheBeat. Returns presence status across all platforms.`,
  inputSchema: z.object({
    festivalName: z.string().describe('The name of the festival to search for'),
    sources: z.array(z.enum([
      'EBLIVE', 'FESTIVALINFO', 'PARTYFLOCK', 'FESTILEAKS', 
      'BEFESTI', 'FESTIVALFANS', 'FOLLOWTHEBEAT', 'all'
    ])).default(['all']).describe('Calendar sources to check (default: all)'),
  }),
  run: async (input) => {
    const { festivalName, sources } = input as {
      festivalName: string;
      sources: string[];
    };

    const client = getApifyClient();

    if (!client.isConfigured()) {
      return {
        success: false,
        error: 'Apify API token not configured',
        results: null,
      };
    }

    console.log(`Verifying "${festivalName}" across calendar sources`);

    // Determine which sources to check
    const sourcesToCheck = sources.includes('all')
      ? Object.keys(FESTIVAL_CALENDAR_SOURCES) as CalendarSourceKey[]
      : sources as CalendarSourceKey[];

    const results: CalendarVerificationResult[] = [];

    // Use RAG Web Browser to search each source
    for (const sourceKey of sourcesToCheck) {
      const source = FESTIVAL_CALENDAR_SOURCES[sourceKey];
      
      try {
        console.log(`Checking ${source.name}...`);
        
        // Search Google with site restriction
        const searchQuery = `site:${new URL(source.url).hostname} "${festivalName}"`;
        
        const { items } = await client.runActor(
          APIFY_ACTORS.GOOGLE_SEARCH_SCRAPER,
          {
            queries: searchQuery,
            maxPagesPerQuery: 1,
            resultsPerPage: 5,
          },
          { waitForFinish: 30 }
        );

        const found = (items as any[]).length > 0;
        const firstResult = (items as any[])[0];

        results.push({
          source: source.name,
          sourceUrl: source.url,
          found,
          festivalUrl: found ? (firstResult?.url || firstResult?.link) : undefined,
          listingDetails: found ? {
            name: firstResult?.title,
          } : undefined,
          checkedAt: new Date().toISOString(),
        });

        // Small delay between sources to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 1000));
        
      } catch (error: any) {
        console.error(`Error checking ${source.name}:`, error);
        results.push({
          source: source.name,
          sourceUrl: source.url,
          found: false,
          checkedAt: new Date().toISOString(),
          error: error.message,
        });
      }
    }

    // Calculate summary
    const foundCount = results.filter(r => r.found).length;
    const errorCount = results.filter(r => r.error).length;

    const fullResult: FullVerificationResult = {
      festivalName,
      verifiedAt: new Date().toISOString(),
      sources: results,
      summary: {
        totalSources: results.length,
        foundOn: foundCount,
        notFoundOn: results.length - foundCount - errorCount,
        errors: errorCount,
      },
      isActive: foundCount > 0,
    };

    return {
      success: true,
      result: fullResult,
      message: `"${festivalName}" found on ${foundCount}/${results.length} calendar sources`,
    };
  },
};

// ============================================================================
// Single Source Lookup Tool
// ============================================================================

export const lookupFestivalOnSourceTool: ToolDefinition = {
  name: 'lookup_festival_on_source',
  description: `Look up a specific festival on a single Dutch calendar source. More detailed than the multi-source verification, attempts to extract full listing information.`,
  inputSchema: z.object({
    festivalName: z.string().describe('The name of the festival to search for'),
    source: z.enum([
      'EBLIVE', 'FESTIVALINFO', 'PARTYFLOCK', 'FESTILEAKS', 
      'BEFESTI', 'FESTIVALFANS', 'FOLLOWTHEBEAT'
    ]).describe('Calendar source to check'),
  }),
  run: async (input) => {
    const { festivalName, source } = input as {
      festivalName: string;
      source: CalendarSourceKey;
    };

    const client = getApifyClient();

    if (!client.isConfigured()) {
      return {
        success: false,
        error: 'Apify API token not configured',
      };
    }

    const sourceConfig = FESTIVAL_CALENDAR_SOURCES[source];
    console.log(`Looking up "${festivalName}" on ${sourceConfig.name}`);

    try {
      // Use RAG Web Browser for intelligent content extraction
      const { items } = await client.runActor(
        APIFY_ACTORS.RAG_WEB_BROWSER,
        {
          query: `site:${new URL(sourceConfig.url).hostname} "${festivalName}" festival`,
          maxResults: 3,
          outputFormats: ['markdown'],
        },
        { waitForFinish: 60 }
      );

      if ((items as any[]).length === 0) {
        return {
          success: true,
          found: false,
          source: sourceConfig.name,
          message: `"${festivalName}" not found on ${sourceConfig.name}`,
        };
      }

      // Extract relevant information from the first result
      const firstResult = (items as any[])[0];
      
      return {
        success: true,
        found: true,
        source: sourceConfig.name,
        sourceUrl: sourceConfig.url,
        festivalUrl: firstResult?.url,
        content: firstResult?.markdown?.substring(0, 3000),
        message: `Found "${festivalName}" on ${sourceConfig.name}`,
      };
    } catch (error: any) {
      console.error(`Error looking up on ${sourceConfig.name}:`, error);
      return {
        success: false,
        error: error.message,
        source: sourceConfig.name,
      };
    }
  },
};

// ============================================================================
// Scrape Calendar Source Tool (for fresh data)
// ============================================================================

export const scrapeCalendarSourceTool: ToolDefinition = {
  name: 'scrape_calendar_source',
  description: `Scrape a Dutch festival calendar source to get fresh festival listings. Returns a list of festivals currently listed on the source.`,
  inputSchema: z.object({
    source: z.enum([
      'EBLIVE', 'FESTIVALINFO', 'PARTYFLOCK', 'FESTILEAKS', 
      'BEFESTI', 'FESTIVALFANS', 'FOLLOWTHEBEAT'
    ]).describe('Calendar source to scrape'),
    maxFestivals: z.number().min(1).max(100).default(20).describe('Maximum festivals to retrieve'),
  }),
  run: async (input) => {
    const { source, maxFestivals } = input as {
      source: CalendarSourceKey;
      maxFestivals: number;
    };

    const client = getApifyClient();

    if (!client.isConfigured()) {
      return {
        success: false,
        error: 'Apify API token not configured',
      };
    }

    const sourceConfig = FESTIVAL_CALENDAR_SOURCES[source];
    console.log(`Scraping ${sourceConfig.name} for festival listings`);

    try {
      // Use Website Content Crawler to scrape the calendar page
      const { items } = await client.runActor(
        APIFY_ACTORS.WEBSITE_CONTENT_CRAWLER,
        {
          startUrls: [{ url: sourceConfig.url }],
          maxCrawlPages: Math.min(maxFestivals, 10),
          crawlerType: 'cheerio',
        },
        { waitForFinish: 120 }
      );

      return {
        success: true,
        source: sourceConfig.name,
        sourceUrl: sourceConfig.url,
        pagesScraped: (items as any[]).length,
        results: items,
        message: `Scraped ${(items as any[]).length} pages from ${sourceConfig.name}`,
      };
    } catch (error: any) {
      console.error(`Error scraping ${sourceConfig.name}:`, error);
      return {
        success: false,
        error: error.message,
        source: sourceConfig.name,
      };
    }
  },
};

// ============================================================================
// Export all calendar tools
// ============================================================================

export const calendarTools: ToolDefinition[] = [
  verifyFestivalOnCalendarsTool,
  lookupFestivalOnSourceTool,
  scrapeCalendarSourceTool,
];
