/**
 * Apify Research Tools
 * 
 * Tool definitions for the research orchestrator using Apify actors.
 * Each tool wraps an Apify actor for specific research tasks.
 */

import { z } from 'zod';
import { getApifyClient, APIFY_ACTORS, type DatasetItem } from './client';
import type { ToolDefinition } from '../orchestrator/types';

// Re-export APIFY_ACTORS for backward compatibility
export { APIFY_ACTORS };

// ============================================================================
// LinkedIn Company Search Tool
// ============================================================================

export interface LinkedInCompanyResult {
  name: string;
  url: string;
  description?: string;
  industry?: string;
  companySize?: string;
  headquarters?: string;
  founded?: string;
  specialties?: string[];
  followerCount?: number;
  employeeCount?: number;
  logo?: string;
}

export const linkedInCompanySearchTool: ToolDefinition = {
  name: 'linkedin_company_search',
  description: `Search LinkedIn for company pages related to a festival. Uses Apify's LinkedIn Company Scraper to find and extract detailed company information including description, industry, size, and social proof metrics. Best for finding official festival organizer companies.`,
  inputSchema: z.object({
    companyName: z.string().describe('The festival or company name to search for on LinkedIn'),
    country: z.string().optional().describe('Country to filter results (e.g., "Netherlands", "NL")'),
    maxResults: z.number().min(1).max(10).default(3).describe('Maximum number of company results to return'),
  }),
  run: async (input) => {
    const { companyName, country, maxResults } = input as { 
      companyName: string; 
      country?: string; 
      maxResults: number;
    };
    
    const client = getApifyClient();
    
    if (!client.isConfigured()) {
      return {
        success: false,
        error: 'Apify API token not configured',
        results: [],
      };
    }

    console.log(`Searching LinkedIn for company: "${companyName}"`);

    try {
      // Use Google Search to find LinkedIn company pages
      const searchQuery = `site:linkedin.com/company "${companyName}" ${country || ''}`.trim();
      
      const { items } = await client.runActor(
        APIFY_ACTORS.GOOGLE_SEARCH_SCRAPER,
        {
          queries: searchQuery,
          maxPagesPerQuery: 1,
          resultsPerPage: maxResults,
        },
        { waitForFinish: 60 }
      );

      // Filter and transform results
      const linkedInResults = (items as DatasetItem[])
        .filter((item: DatasetItem) => 
          item.url?.includes('linkedin.com/company') || 
          item.link?.includes('linkedin.com/company')
        )
        .slice(0, maxResults)
        .map((item: DatasetItem) => ({
          name: item.title || item.name || companyName,
          url: item.url || item.link,
          description: item.description || item.snippet,
        }));

      return {
        success: true,
        query: companyName,
        resultsCount: linkedInResults.length,
        results: linkedInResults,
        message: `Found ${linkedInResults.length} LinkedIn company pages for "${companyName}"`,
      };
    } catch (error: any) {
      console.error('LinkedIn company search error:', error);
      return {
        success: false,
        error: error.message,
        results: [],
      };
    }
  },
};

// ============================================================================
// Website Content Crawler Tool
// ============================================================================

export interface WebsiteContentResult {
  url: string;
  title?: string;
  text?: string;
  markdown?: string;
  metadata?: Record<string, any>;
}

export const websiteContentCrawlerTool: ToolDefinition = {
  name: 'website_content_crawler',
  description: `Crawl a website to extract content including FAQs, about pages, contact information, and general text. Uses Apify's Website Content Crawler for intelligent content extraction. Best for extracting structured information from festival websites.`,
  inputSchema: z.object({
    startUrls: z.array(z.string().url()).describe('URLs to start crawling from'),
    maxPages: z.number().min(1).max(50).default(10).describe('Maximum number of pages to crawl'),
    extractContent: z.array(z.enum(['faq', 'about', 'contact', 'lineup', 'tickets', 'all']))
      .default(['all'])
      .describe('Types of content to prioritize extracting'),
  }),
  run: async (input) => {
    const { startUrls, maxPages, extractContent } = input as {
      startUrls: string[];
      maxPages: number;
      extractContent: string[];
    };

    const client = getApifyClient();

    if (!client.isConfigured()) {
      return {
        success: false,
        error: 'Apify API token not configured',
        results: [],
      };
    }

    console.log(`Crawling websites: ${startUrls.join(', ')}`);

    try {
      const { items } = await client.runActor(
        APIFY_ACTORS.WEBSITE_CONTENT_CRAWLER,
        {
          startUrls: startUrls.map(url => ({ url })),
          maxCrawlPages: maxPages,
          crawlerType: 'cheerio', // Faster for text extraction
          includeUrlGlobs: extractContent.includes('all') ? [] : extractContent.map(type => {
            switch (type) {
              case 'faq': return '*faq*';
              case 'about': return '*about*';
              case 'contact': return '*contact*';
              case 'lineup': return '*lineup*';
              case 'tickets': return '*ticket*';
              default: return '*';
            }
          }),
        },
        { waitForFinish: 120, timeout: 180 }
      );

      const results = (items as DatasetItem[]).map((item: DatasetItem) => ({
        url: item.url,
        title: item.title,
        text: item.text?.substring(0, 5000), // Limit text length
        markdown: item.markdown?.substring(0, 5000),
        metadata: item.metadata,
      }));

      return {
        success: true,
        pagesExtracted: results.length,
        results,
        message: `Extracted content from ${results.length} pages`,
      };
    } catch (error: any) {
      console.error('Website crawler error:', error);
      return {
        success: false,
        error: error.message,
        results: [],
      };
    }
  },
};

// ============================================================================
// Google Search Tool (for news and general research)
// ============================================================================

export interface GoogleSearchResult {
  title: string;
  url: string;
  description: string;
  displayedUrl?: string;
}

export const googleSearchTool: ToolDefinition = {
  name: 'google_search',
  description: `Search Google for news articles, reviews, and general information about a festival. Uses Apify's Google Search Scraper. Best for finding recent news, press coverage, and public sentiment.`,
  inputSchema: z.object({
    query: z.string().describe('Search query (e.g., "Tomorrowland 2025 news")'),
    searchType: z.enum(['general', 'news', 'images']).default('general').describe('Type of search'),
    maxResults: z.number().min(1).max(50).default(10).describe('Maximum results to return'),
    language: z.string().default('nl').describe('Language code (e.g., "nl" for Dutch, "en" for English)'),
  }),
  run: async (input) => {
    const { query, searchType, maxResults, language } = input as {
      query: string;
      searchType: string;
      maxResults: number;
      language: string;
    };

    const client = getApifyClient();

    if (!client.isConfigured()) {
      return {
        success: false,
        error: 'Apify API token not configured',
        results: [],
      };
    }

    console.log(`Google search: "${query}" (type: ${searchType})`);

    try {
      // Modify query for news searches
      const searchQuery = searchType === 'news' 
        ? `${query} nieuws OR news OR 2025 OR 2024` 
        : query;

      const { items } = await client.runActor(
        APIFY_ACTORS.GOOGLE_SEARCH_SCRAPER,
        {
          queries: searchQuery,
          maxPagesPerQuery: Math.ceil(maxResults / 10),
          resultsPerPage: Math.min(maxResults, 10),
          languageCode: language,
          countryCode: language === 'nl' ? 'nl' : undefined,
        },
        { waitForFinish: 60 }
      );

      const results = (items as DatasetItem[]).slice(0, maxResults).map((item: DatasetItem) => ({
        title: item.title,
        url: item.url || item.link,
        description: item.description || item.snippet,
        displayedUrl: item.displayedUrl,
      }));

      return {
        success: true,
        query,
        searchType,
        resultsCount: results.length,
        results,
        message: `Found ${results.length} ${searchType} results for "${query}"`,
      };
    } catch (error: any) {
      console.error('Google search error:', error);
      return {
        success: false,
        error: error.message,
        results: [],
      };
    }
  },
};

// ============================================================================
// RAG Web Browser Tool (intelligent web browsing)
// ============================================================================

export const ragWebBrowserTool: ToolDefinition = {
  name: 'rag_web_browser',
  description: `Intelligent web browser that can search Google and extract content from results. Similar to ChatGPT's web browsing capability. Best for complex research queries that need both search and content extraction.`,
  inputSchema: z.object({
    query: z.string().describe('Search query or URL to browse'),
    maxResults: z.number().min(1).max(5).default(3).describe('Number of top pages to extract content from'),
    outputFormats: z.array(z.enum(['markdown', 'text', 'html'])).default(['markdown']).describe('Output format'),
  }),
  run: async (input) => {
    const { query, maxResults, outputFormats } = input as {
      query: string;
      maxResults: number;
      outputFormats: string[];
    };

    const client = getApifyClient();

    if (!client.isConfigured()) {
      return {
        success: false,
        error: 'Apify API token not configured',
        results: [],
      };
    }

    console.log(`RAG Web Browser: "${query}"`);

    try {
      const { items } = await client.runActor(
        APIFY_ACTORS.RAG_WEB_BROWSER,
        {
          query,
          maxResults,
          outputFormats,
        },
        { waitForFinish: 120 }
      );

      return {
        success: true,
        query,
        pagesExtracted: (items as DatasetItem[]).length,
        results: items,
        message: `Extracted content from ${(items as DatasetItem[]).length} pages for "${query}"`,
      };
    } catch (error: any) {
      console.error('RAG Web Browser error:', error);
      return {
        success: false,
        error: error.message,
        results: [],
      };
    }
  },
};

// ============================================================================
// Instagram Scraper Tool (for festival photos and social presence)
// ============================================================================

export const instagramScraperTool: ToolDefinition = {
  name: 'instagram_scraper',
  description: `Scrape Instagram for festival photos, posts, and social media presence. Uses Apify's Instagram Scraper. Best for gathering visual content and social proof.`,
  inputSchema: z.object({
    searchQuery: z.string().describe('Instagram username or hashtag to search (without @ or #)'),
    searchType: z.enum(['user', 'hashtag']).default('user').describe('Search for user profile or hashtag'),
    maxPosts: z.number().min(1).max(50).default(12).describe('Maximum posts to retrieve'),
  }),
  run: async (input) => {
    const { searchQuery, searchType, maxPosts } = input as {
      searchQuery: string;
      searchType: string;
      maxPosts: number;
    };

    const client = getApifyClient();

    if (!client.isConfigured()) {
      return {
        success: false,
        error: 'Apify API token not configured',
        results: [],
      };
    }

    console.log(`Instagram scraper: "${searchQuery}" (type: ${searchType})`);

    try {
      const actorInput = searchType === 'user'
        ? { directUrls: [`https://www.instagram.com/${searchQuery}/`], resultsLimit: maxPosts }
        : { hashtags: [searchQuery], resultsLimit: maxPosts };

      const { items } = await client.runActor(
        APIFY_ACTORS.INSTAGRAM_SCRAPER,
        actorInput,
        { waitForFinish: 120 }
      );

      const results = (items as DatasetItem[]).map((item: DatasetItem) => ({
        url: item.url,
        imageUrl: item.displayUrl || item.thumbnailUrl,
        caption: item.caption?.substring(0, 500),
        likes: item.likesCount,
        comments: item.commentsCount,
        timestamp: item.timestamp,
        type: item.type,
      }));

      return {
        success: true,
        searchQuery,
        searchType,
        postsFound: results.length,
        results,
        message: `Found ${results.length} Instagram posts for "${searchQuery}"`,
      };
    } catch (error: any) {
      console.error('Instagram scraper error:', error);
      return {
        success: false,
        error: error.message,
        results: [],
      };
    }
  },
};

// ============================================================================
// Export all Apify tools
// ============================================================================

export const apifyTools: ToolDefinition[] = [
  linkedInCompanySearchTool,
  websiteContentCrawlerTool,
  googleSearchTool,
  ragWebBrowserTool,
  instagramScraperTool,
];
