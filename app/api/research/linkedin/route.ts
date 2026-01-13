/**
 * LinkedIn Research API Endpoint
 * 
 * POST /api/research/linkedin
 * 
 * Search for LinkedIn profiles (primarily people) associated with a festival.
 * Now accepts optional companyName from company discovery to improve search targeting.
 * Uses Apify's Google Search scraper to find LinkedIn results.
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getApifyClient, APIFY_ACTORS } from '../../../../lib/apify/client';

// Request schema - updated to accept companyName
const LinkedInRequestSchema = z.object({
  festivalName: z.string().min(1, 'Festival name is required'),
  festivalId: z.string().optional(),
  companyName: z.string().optional(), // NEW: from company discovery
  festivalUrl: z.string().optional(),
  country: z.string().default('Netherlands'),
  maxResults: z.number().min(1).max(20).default(10),
});

/**
 * Build smart LinkedIn search queries based on available information
 */
function buildLinkedInQueries(
  festivalName: string,
  companyName?: string,
  country?: string
): { query: string; type: 'people' | 'company'; priority: 'primary' | 'secondary' }[] {
  const queries: { query: string; type: 'people' | 'company'; priority: 'primary' | 'secondary' }[] = [];
  
  // If we have a company name, prioritize searching for people at that company
  if (companyName) {
    // Primary: People working at the organizing company
    queries.push({
      query: `site:linkedin.com/in "${companyName}" festival OR event`,
      type: 'people',
      priority: 'primary',
    });
    
    // People with director/manager roles at the company
    queries.push({
      query: `site:linkedin.com/in "${companyName}" director OR manager OR organizer`,
      type: 'people',
      priority: 'primary',
    });
    
    // Company page for the organizing company
    queries.push({
      query: `site:linkedin.com/company "${companyName}"`,
      type: 'company',
      priority: 'secondary',
    });
  }
  
  // Secondary: People directly associated with the festival name
  queries.push({
    query: `site:linkedin.com/in "${festivalName}" organizer OR director OR founder OR producer`,
    type: 'people',
    priority: companyName ? 'secondary' : 'primary',
  });
  
  // Festival company page
  queries.push({
    query: `site:linkedin.com/company "${festivalName}" ${country || ''}`.trim(),
    type: 'company',
    priority: 'secondary',
  });
  
  // People mentioning the festival in their profile
  if (!companyName) {
    queries.push({
      query: `site:linkedin.com/in "${festivalName}" event manager OR booking`,
      type: 'people',
      priority: 'secondary',
    });
  }
  
  return queries;
}

/**
 * Parse LinkedIn person result
 */
function parseLinkedInPerson(item: any): { name: string; title?: string; url: string; company?: string } | null {
  const url = item.url || item.link;
  if (!url?.includes('linkedin.com/in')) return null;
  
  let title = item.title || '';
  
  // Parse "Name - Title at Company | LinkedIn" format
  let name = title.replace(/ \| LinkedIn$/, '');
  let personTitle: string | undefined;
  let company: string | undefined;
  
  // Extract name and title
  const dashMatch = name.match(/^([^-]+)\s+-\s+(.+)$/);
  if (dashMatch) {
    name = dashMatch[1].trim();
    const titlePart = dashMatch[2];
    
    // Check for "Title at Company" pattern
    const atMatch = titlePart.match(/^(.+?)\s+(?:at|bij|@)\s+(.+)$/i);
    if (atMatch) {
      personTitle = atMatch[1].trim();
      company = atMatch[2].trim();
    } else {
      personTitle = titlePart.trim();
    }
  }
  
  return {
    name: name.trim(),
    title: personTitle,
    url,
    company,
  };
}

/**
 * Parse LinkedIn company result
 */
function parseLinkedInCompany(item: any): { name: string; url: string; description?: string } | null {
  const url = item.url || item.link;
  if (!url?.includes('linkedin.com/company')) return null;
  
  return {
    name: item.title?.replace(/ \| LinkedIn$/, '').replace(/: Overview$/, '') || 'Unknown Company',
    url,
    description: item.description || item.snippet,
  };
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validatedInput = LinkedInRequestSchema.parse(body);

    const client = getApifyClient();

    if (!client.isConfigured()) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Apify API token not configured',
          message: 'Please add APIFY_API_TOKEN to your environment variables' 
        },
        { status: 503 }
      );
    }

    const { festivalName, companyName, country, maxResults } = validatedInput;
    console.log(`LinkedIn research for: ${festivalName}${companyName ? ` (Company: ${companyName})` : ''}`);

    // Build smart queries based on available information
    const queries = buildLinkedInQueries(festivalName, companyName, country);
    
    // Separate primary and secondary queries
    const primaryQueries = queries.filter(q => q.priority === 'primary');
    const secondaryQueries = queries.filter(q => q.priority === 'secondary');
    
    console.log(`Running ${primaryQueries.length} primary + ${secondaryQueries.length} secondary queries`);

    // Run primary queries in parallel first
    const primaryResults = await Promise.all(
      primaryQueries.map(async (q) => {
        try {
          const result = await client.runActor(
            APIFY_ACTORS.GOOGLE_SEARCH_SCRAPER,
            {
              queries: q.query,
              maxPagesPerQuery: 1,
              resultsPerPage: Math.ceil(maxResults / primaryQueries.length),
            },
            { waitForFinish: 25 }
          );
          return { type: q.type, items: result.items };
        } catch (error) {
          console.error(`Query failed: ${q.query}`, error);
          return { type: q.type, items: [] };
        }
      })
    );

    // Run secondary queries in parallel
    const secondaryResults = await Promise.all(
      secondaryQueries.slice(0, 2).map(async (q) => { // Limit to 2 secondary queries
        try {
          const result = await client.runActor(
            APIFY_ACTORS.GOOGLE_SEARCH_SCRAPER,
            {
              queries: q.query,
              maxPagesPerQuery: 1,
              resultsPerPage: 5,
            },
            { waitForFinish: 20 }
          );
          return { type: q.type, items: result.items };
        } catch (error) {
          console.error(`Secondary query failed: ${q.query}`, error);
          return { type: q.type, items: [] };
        }
      })
    );

    // Combine and deduplicate results
    const allResults = [...primaryResults, ...secondaryResults];
    
    const seenUrls = new Set<string>();
    const people: Array<{ name: string; title?: string; url: string; company?: string }> = [];
    const companies: Array<{ name: string; url: string; description?: string }> = [];

    for (const result of allResults) {
      for (const item of result.items as any[]) {
        const url = item.url || item.link;
        if (!url || seenUrls.has(url)) continue;
        seenUrls.add(url);
        
        if (result.type === 'people' || url.includes('linkedin.com/in')) {
          const person = parseLinkedInPerson(item);
          if (person) people.push(person);
        }
        
        if (result.type === 'company' || url.includes('linkedin.com/company')) {
          const company = parseLinkedInCompany(item);
          if (company) companies.push(company);
        }
      }
    }

    // Sort people by relevance (those with title/company first)
    people.sort((a, b) => {
      if (a.title && !b.title) return -1;
      if (!a.title && b.title) return 1;
      if (a.company && !b.company) return -1;
      if (!a.company && b.company) return 1;
      return 0;
    });

    return NextResponse.json({
      success: true,
      festivalName,
      festivalId: validatedInput.festivalId,
      searchedWithCompany: companyName || null,
      results: {
        people: people.slice(0, maxResults),
        companies: companies.slice(0, 5),
      },
      summary: {
        peopleFound: people.length,
        companiesFound: companies.length,
        queriesRun: queries.length,
      },
      timestamp: new Date().toISOString(),
    });

  } catch (error: any) {
    console.error('LinkedIn research error:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: 'Invalid request', details: error.flatten() },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
