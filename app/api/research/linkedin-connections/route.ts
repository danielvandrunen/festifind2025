/**
 * LinkedIn Connections API Endpoint
 * 
 * POST /api/research/linkedin-connections
 * 
 * Returns verified LinkedIn connections for a festival using the two-phase
 * search approach: first find company, then find employees.
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getApifyClient, APIFY_ACTORS } from '../../../../lib/apify/client';
import { 
  verifyEmployment, 
  determineRole, 
  sortConnectionsByRelevance,
  type LinkedInConnection,
  type EmploymentVerification
} from '../../../../lib/research/employment-validator';

// Request schema
const RequestSchema = z.object({
  festivalName: z.string().min(1, 'Festival name is required'),
  festivalId: z.string().optional(),
  companyName: z.string().optional(),
  festivalUrl: z.string().optional(),
  maxResults: z.number().min(1).max(30).default(15),
});

// Response types
interface CompanyLinkedIn {
  url: string;
  name: string;
  description?: string;
  verified: boolean;
}

interface LinkedInConnectionsResponse {
  success: boolean;
  festivalName: string;
  companyName?: string | null;
  companyLinkedIn?: CompanyLinkedIn | null;
  connections: LinkedInConnection[];
  summary: {
    total: number;
    verified: number;
    decisionMakers: number;
    managers: number;
    searchStrategy: string;
  };
  timestamp: string;
}

/**
 * Parse LinkedIn company from search result
 */
function parseCompanyResult(item: any): CompanyLinkedIn | null {
  const url = item.url || item.link;
  if (!url?.includes('linkedin.com/company/')) return null;
  
  const title = (item.title || '').replace(/ \| LinkedIn$/, '').replace(/: Overview$/, '');
  const description = item.snippet || item.description;
  
  return {
    url,
    name: title,
    description,
    verified: true,
  };
}

/**
 * Parse LinkedIn profile from search result
 */
function parseProfileResult(
  item: any, 
  companyName?: string,
  discoveredVia: LinkedInConnection['discoveredVia'] = 'general_search'
): LinkedInConnection | null {
  const url = item.url || item.link;
  if (!url?.includes('linkedin.com/in/')) return null;
  
  const title = item.title || '';
  const snippet = item.snippet || item.description || '';
  
  // Parse name
  const nameMatch = title.match(/^([^-–|]+)/);
  const name = nameMatch ? nameMatch[1].trim() : '';
  if (!name) return null;
  
  // Parse job title
  const titleMatch = title.match(/[-–|]\s*(.+?)(?:\s*[-–|]|$)/);
  const jobTitle = titleMatch ? titleMatch[1].trim().replace(/ \| LinkedIn$/, '') : undefined;
  
  // Verify employment
  let verification: EmploymentVerification | undefined;
  let employmentVerified = false;
  
  if (companyName) {
    verification = verifyEmployment(title, snippet, companyName);
    employmentVerified = verification.isVerified;
  }
  
  return {
    name,
    title: jobTitle,
    url,
    company: companyName,
    role: determineRole(jobTitle),
    employmentVerified,
    verification,
    discoveredVia,
  };
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validated = RequestSchema.parse(body);

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

    const { festivalName, companyName, maxResults } = validated;
    console.log(`[LinkedIn Connections] Starting search for: ${festivalName}${companyName ? ` (Company: ${companyName})` : ''}`);

    const connections: LinkedInConnection[] = [];
    const seenUrls = new Set<string>();
    let companyLinkedIn: CompanyLinkedIn | null = null;
    let searchStrategy = 'festival_search';

    // ============================================
    // PHASE 1: Search for company LinkedIn page
    // ============================================
    if (companyName) {
      console.log(`[LinkedIn Connections] Phase 1: Searching for company page...`);
      
      const companyQueries = [
        `site:linkedin.com/company "${companyName}"`,
        `site:linkedin.com/company "${festivalName}"`,
      ];

      for (const query of companyQueries) {
        if (companyLinkedIn) break;
        
        try {
          const result = await client.runActor(
            APIFY_ACTORS.GOOGLE_SEARCH_SCRAPER,
            {
              queries: query,
              maxPagesPerQuery: 1,
              resultsPerPage: 5,
            },
            { waitForFinish: 25 }
          );

          for (const item of result.items || []) {
            const company = parseCompanyResult(item);
            if (company) {
              companyLinkedIn = company;
              console.log(`[LinkedIn Connections] Found company page: ${company.url}`);
              break;
            }
          }
        } catch (error) {
          console.error(`[LinkedIn Connections] Company search failed:`, error);
        }
      }
    }

    // ============================================
    // PHASE 2: Search for employees of the company
    // ============================================
    if (companyName) {
      console.log(`[LinkedIn Connections] Phase 2: Searching for employees...`);
      searchStrategy = 'company_employee_search';

      const employeeQueries = [
        `site:linkedin.com/in "works at ${companyName}"`,
        `site:linkedin.com/in "at ${companyName}" director OR CEO OR founder OR manager`,
        `site:linkedin.com/in "${companyName}" festival OR event director OR manager`,
      ];

      for (const query of employeeQueries) {
        try {
          const result = await client.runActor(
            APIFY_ACTORS.GOOGLE_SEARCH_SCRAPER,
            {
              queries: query,
              maxPagesPerQuery: 1,
              resultsPerPage: 10,
            },
            { waitForFinish: 25 }
          );

          for (const item of result.items || []) {
            const url = item.url || item.link;
            if (seenUrls.has(url)) continue;
            seenUrls.add(url);

            const connection = parseProfileResult(item, companyName, 'company_employee_search');
            if (connection && connection.employmentVerified) {
              connections.push(connection);
            }
          }
        } catch (error) {
          console.error(`[LinkedIn Connections] Employee search failed:`, error);
        }

        // Stop if we have enough verified connections
        if (connections.length >= maxResults) break;
      }
    }

    // ============================================
    // PHASE 3: Fallback/supplementary festival search
    // ============================================
    if (connections.length < maxResults / 2) {
      console.log(`[LinkedIn Connections] Phase 3: Festival name search...`);
      
      const festivalQueries = [
        `site:linkedin.com/in "${festivalName}" organizer OR director OR founder OR producer`,
        `site:linkedin.com/in "${festivalName}" festival manager OR event manager`,
      ];

      for (const query of festivalQueries) {
        try {
          const result = await client.runActor(
            APIFY_ACTORS.GOOGLE_SEARCH_SCRAPER,
            {
              queries: query,
              maxPagesPerQuery: 1,
              resultsPerPage: 8,
            },
            { waitForFinish: 25 }
          );

          for (const item of result.items || []) {
            const url = item.url || item.link;
            if (seenUrls.has(url)) continue;
            seenUrls.add(url);

            const connection = parseProfileResult(item, companyName, 'festival_search');
            if (connection) {
              // For festival searches, include even without company verification
              // but mark them appropriately
              connections.push(connection);
            }
          }
        } catch (error) {
          console.error(`[LinkedIn Connections] Festival search failed:`, error);
        }

        if (connections.length >= maxResults) break;
      }
    }

    // Sort connections by relevance
    const sortedConnections = sortConnectionsByRelevance(connections).slice(0, maxResults);

    // Calculate summary statistics
    const verifiedCount = sortedConnections.filter(c => c.employmentVerified).length;
    const decisionMakerCount = sortedConnections.filter(c => c.role === 'decision_maker').length;
    const managerCount = sortedConnections.filter(c => c.role === 'manager').length;

    console.log(`[LinkedIn Connections] Found ${sortedConnections.length} connections (${verifiedCount} verified, ${decisionMakerCount} decision makers)`);

    const response: LinkedInConnectionsResponse = {
      success: true,
      festivalName,
      companyName: companyName || null,
      companyLinkedIn,
      connections: sortedConnections,
      summary: {
        total: sortedConnections.length,
        verified: verifiedCount,
        decisionMakers: decisionMakerCount,
        managers: managerCount,
        searchStrategy,
      },
      timestamp: new Date().toISOString(),
    };

    return NextResponse.json(response);

  } catch (error: any) {
    console.error('[LinkedIn Connections] Error:', error);

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
