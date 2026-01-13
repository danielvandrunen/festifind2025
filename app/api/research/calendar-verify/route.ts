/**
 * Calendar Verification API Endpoint
 * 
 * POST /api/research/calendar-verify
 * 
 * Verify if a festival is listed on Dutch festival calendar websites.
 * Now extracts edition year to check if listing is current.
 * Checks: EB Live, FestivalInfo.nl, Partyflock, Festileaks, Befesti, Festivalfans, FollowTheBeat
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getApifyClient, APIFY_ACTORS } from '../../../../lib/apify/client';
import { 
  FESTIVAL_CALENDAR_SOURCES, 
  type CalendarVerificationResult,
  type FullVerificationResult,
  type CalendarSourceKey 
} from '../../../../lib/apify/calendar-tools';

// Request schema - updated with extractYear option
const CalendarVerifyRequestSchema = z.object({
  festivalName: z.string().min(1, 'Festival name is required'),
  festivalId: z.string().optional(),
  sources: z.array(z.enum([
    'EBLIVE', 'FESTIVALINFO', 'PARTYFLOCK', 'FESTILEAKS', 
    'BEFESTI', 'FESTIVALFANS', 'FOLLOWTHEBEAT', 'all'
  ])).default(['all']),
  extractYear: z.boolean().default(true), // NEW: Extract edition year from results
  updateDatabase: z.boolean().default(false),
});

// Extended result type with year information
interface CalendarResultWithYear extends CalendarVerificationResult {
  editionYear?: number | null;
  isCurrent?: boolean;
}

/**
 * Extract edition year from text content
 */
function extractEditionYear(text: string): number | null {
  const currentYear = new Date().getFullYear();
  const nextYear = currentYear + 1;
  
  // Look for years in the text (current year, next year, or previous year)
  const yearPattern = new RegExp(`\\b(${currentYear - 1}|${currentYear}|${nextYear})\\b`, 'g');
  const matches = text.match(yearPattern);
  
  if (!matches) return null;
  
  // Parse all found years
  const years = matches.map(y => parseInt(y, 10));
  
  // Prefer current or next year over previous year
  if (years.includes(nextYear)) return nextYear;
  if (years.includes(currentYear)) return currentYear;
  if (years.includes(currentYear - 1)) return currentYear - 1;
  
  // Return the highest year found
  return Math.max(...years);
}

/**
 * Check if a year is considered "current" (this year or next year)
 */
function isCurrentEdition(year: number | null): boolean {
  if (!year) return false;
  const currentYear = new Date().getFullYear();
  return year >= currentYear;
}

/**
 * Extract date information from search result
 */
function extractDateFromResult(item: any): string | null {
  const text = `${item.title || ''} ${item.description || ''} ${item.snippet || ''}`;
  
  // Look for date patterns
  const datePatterns = [
    // "15 juni 2025", "15 juni"
    /\b(\d{1,2})\s+(januari|februari|maart|april|mei|juni|juli|augustus|september|oktober|november|december)(?:\s+(202[4-6]))?\b/gi,
    // "15-06-2025", "15/06/2025"
    /\b(\d{1,2})[-/](\d{1,2})[-/](202[4-6])\b/g,
  ];
  
  for (const pattern of datePatterns) {
    const match = text.match(pattern);
    if (match) {
      return match[0];
    }
  }
  
  return null;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validatedInput = CalendarVerifyRequestSchema.parse(body);

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

    const { festivalName, extractYear } = validatedInput;
    console.log(`Calendar verification for: ${festivalName} (extractYear: ${extractYear})`);

    // Determine which sources to check
    const sourcesToCheck = validatedInput.sources.includes('all')
      ? Object.keys(FESTIVAL_CALENDAR_SOURCES) as CalendarSourceKey[]
      : validatedInput.sources.filter(s => s !== 'all') as CalendarSourceKey[];

    // Check ALL sources in PARALLEL for speed (7x faster!)
    const searchPromises = sourcesToCheck.map(async (sourceKey) => {
      const source = FESTIVAL_CALENDAR_SOURCES[sourceKey];
      
      try {
        console.log(`Checking ${source.name}...`);
        
        // Use site-restricted Google search
        const hostname = new URL(source.url).hostname;
        const searchQuery = `site:${hostname} "${festivalName}"`;
        
        const { items } = await client.runActor(
          APIFY_ACTORS.GOOGLE_SEARCH_SCRAPER,
          {
            queries: searchQuery,
            maxPagesPerQuery: 1,
            resultsPerPage: 3,
          },
          { waitForFinish: 25 }
        );

        const found = (items as any[]).length > 0;
        const firstResult = (items as any[])[0];
        
        // Extract year from the search result
        let editionYear: number | null = null;
        let dateFound: string | null = null;
        
        if (found && firstResult && extractYear) {
          const combinedText = `${firstResult.title || ''} ${firstResult.description || ''} ${firstResult.snippet || ''}`;
          editionYear = extractEditionYear(combinedText);
          dateFound = extractDateFromResult(firstResult);
        }

        const result: CalendarResultWithYear = {
          source: source.name,
          sourceUrl: source.url,
          found,
          festivalUrl: found ? (firstResult?.url || firstResult?.link) : undefined,
          listingDetails: found ? {
            name: firstResult?.title,
            date: dateFound || undefined,
          } : undefined,
          editionYear,
          isCurrent: isCurrentEdition(editionYear),
          checkedAt: new Date().toISOString(),
        };
        
        return result;
        
      } catch (error: any) {
        console.error(`Error checking ${source.name}:`, error);
        return {
          source: source.name,
          sourceUrl: source.url,
          found: false,
          checkedAt: new Date().toISOString(),
          error: error.message,
        } as CalendarResultWithYear;
      }
    });

    const results = await Promise.all(searchPromises);

    // Calculate summary with year information
    const foundCount = results.filter(r => r.found).length;
    const currentListings = results.filter(r => r.found && r.isCurrent).length;
    const errorCount = results.filter(r => r.error).length;
    
    // Determine if festival is actively listed (found on current year calendars)
    const isActiveOnCalendars = currentListings > 0 || foundCount >= 2;

    const fullResult: FullVerificationResult & { 
      summary: FullVerificationResult['summary'] & { 
        currentListings: number;
        isActiveOnCalendars: boolean;
      } 
    } = {
      festivalName,
      verifiedAt: new Date().toISOString(),
      sources: results,
      summary: {
        totalSources: results.length,
        foundOn: foundCount,
        notFoundOn: results.length - foundCount - errorCount,
        errors: errorCount,
        currentListings,
        isActiveOnCalendars,
      },
      isActive: foundCount > 0,
    };

    // Optionally update the database
    if (validatedInput.updateDatabase && validatedInput.festivalId) {
      try {
        const { supabase } = await import('../../../../lib/supabase-client');
        
        // Build calendar_presence object
        const calendarPresence: Record<string, any> = {};
        for (const result of results) {
          const key = result.source.toLowerCase().replace(/[^a-z]/g, '');
          calendarPresence[key] = {
            found: result.found,
            url: result.festivalUrl,
            editionYear: result.editionYear,
            isCurrent: result.isCurrent,
            lastChecked: result.checkedAt,
          };
        }

        await supabase
          .from('festivals')
          .update({
            calendar_presence: calendarPresence,
            last_verified: new Date().toISOString(),
          })
          .eq('id', validatedInput.festivalId);
          
        console.log(`Updated database for festival ${validatedInput.festivalId}`);
      } catch (dbError) {
        console.error('Database update error:', dbError);
        // Don't fail the request, just log the error
      }
    }

    return NextResponse.json({
      success: true,
      result: fullResult,
      message: `"${festivalName}" found on ${foundCount}/${results.length} sources (${currentListings} current listings)`,
    });

  } catch (error: any) {
    console.error('Calendar verification error:', error);

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
