import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getApifyClient, APIFY_ACTORS } from '../../../../lib/apify/client';

// Input validation schema
const InputSchema = z.object({
  festivalId: z.string(),
  festivalName: z.string(),
  festivalUrl: z.string().url().optional(),
});

// Company extraction patterns for Dutch/international companies
const COMPANY_PATTERNS = [
  // Dutch legal entities
  /([A-Z][A-Za-z0-9\s&\-']+)\s+(?:B\.?V\.?|BV)/gi,
  /([A-Z][A-Za-z0-9\s&\-']+)\s+(?:N\.?V\.?|NV)/gi,
  /(?:Stichting|Foundation)\s+([A-Z][A-Za-z0-9\s&\-']+)/gi,
  /([A-Z][A-Za-z0-9\s&\-']+)\s+(?:VOF|V\.O\.F\.)/gi,
  
  // "Organized by" patterns (EN/NL)
  /(?:organized|organised|presented)\s+by\s+([A-Z][A-Za-z0-9\s&\-']+(?:\s+(?:B\.?V\.?|BV|Events?))?)/gi,
  /(?:georganiseerd|gepresenteerd)\s+door\s+([A-Z][A-Za-z0-9\s&\-']+)/gi,
  
  // Copyright patterns
  /©\s*\d{4}\s+([A-Z][A-Za-z0-9\s&\-']+(?:\s+(?:B\.?V\.?|BV))?)/gi,
  /copyright\s+(?:\d{4}\s+)?([A-Z][A-Za-z0-9\s&\-']+)/gi,
  
  // Dutch Chamber of Commerce (KvK)
  /KvK[:\s]+(\d{8})/gi,
  /(?:Chamber of Commerce|Kamer van Koophandel)[:\s]+(\d{8})/gi,
];

// Pages to check for company information
const COMPANY_PAGES = [
  '/privacy',
  '/privacy-policy',
  '/privacybeleid',
  '/contact',
  '/about',
  '/about-us',
  '/over-ons',
  '/impressum',
  '/disclaimer',
  '/terms',
  '/algemene-voorwaarden',
];

interface CompanyResult {
  companyName: string | null;
  companyUrl: string | null;
  kvkNumber: string | null;
  confidence: 'high' | 'medium' | 'low';
  source: string;
  allMatches: string[];
}

/**
 * Extract company information from text content
 */
function extractCompanyInfo(content: string, sourceUrl: string): CompanyResult {
  const matches: string[] = [];
  let kvkNumber: string | null = null;
  
  // Run all patterns against the content
  for (const pattern of COMPANY_PATTERNS) {
    const regex = new RegExp(pattern.source, pattern.flags);
    let match;
    while ((match = regex.exec(content)) !== null) {
      const extracted = match[1]?.trim();
      if (extracted) {
        // Check if it's a KvK number
        if (/^\d{8}$/.test(extracted)) {
          kvkNumber = extracted;
        } else if (extracted.length > 3 && extracted.length < 100) {
          // Filter out very short or very long matches
          matches.push(extracted);
        }
      }
    }
  }
  
  // Deduplicate and count occurrences
  const countMap = new Map<string, number>();
  for (const m of matches) {
    const normalized = m.replace(/\s+/g, ' ').trim();
    countMap.set(normalized, (countMap.get(normalized) || 0) + 1);
  }
  
  // Sort by frequency
  const sorted = Array.from(countMap.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([name]) => name);
  
  // Determine confidence based on match quality
  let confidence: 'high' | 'medium' | 'low' = 'low';
  if (sorted.length > 0) {
    const topMatch = sorted[0];
    const count = countMap.get(topMatch) || 0;
    
    // High confidence if: KvK found OR multiple occurrences OR contains B.V./Stichting
    if (kvkNumber || count >= 3 || /(?:B\.?V\.?|BV|Stichting|Foundation)/i.test(topMatch)) {
      confidence = 'high';
    } else if (count >= 2 || sorted.length >= 2) {
      confidence = 'medium';
    }
  }
  
  return {
    companyName: sorted[0] || null,
    companyUrl: null, // Could be enhanced to find company website
    kvkNumber,
    confidence,
    source: sourceUrl,
    allMatches: sorted.slice(0, 5), // Top 5 matches
  };
}

export async function POST(request: NextRequest) {
  // Validate API token
  if (!process.env.APIFY_API_TOKEN) {
    return NextResponse.json(
      { success: false, error: 'APIFY_API_TOKEN not configured' },
      { status: 503 }
    );
  }

  try {
    const body = await request.json();
    const validationResult = InputSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        { success: false, error: 'Invalid request body', details: validationResult.error.flatten() },
        { status: 400 }
      );
    }

    const { festivalId, festivalName, festivalUrl } = validationResult.data;
    const client = getApifyClient();

    console.log(`Company discovery for: ${festivalName}`);
    console.log(`Festival URL: ${festivalUrl || 'Not provided - will search'}`);

    let baseUrl = festivalUrl;
    let discoveredHomepage: string | null = null;

    // Phase 1: If no URL provided, search for the festival homepage
    if (!baseUrl) {
      console.log('No URL provided, searching for festival homepage...');
      
      const searchQuery = `"${festivalName}" festival official site`;
      const { items: searchResults } = await client.runActor(
        APIFY_ACTORS.GOOGLE_SEARCH_SCRAPER,
        {
          queries: searchQuery,
          maxPagesPerQuery: 1,
          resultsPerPage: 5,
        },
        { waitForFinish: 30 }
      );

      // Look for official website (not social media, not calendar sites)
      const excludePatterns = [
        /facebook\.com/i,
        /instagram\.com/i,
        /twitter\.com/i,
        /linkedin\.com/i,
        /festivalinfo/i,
        /partyflock/i,
        /eblive/i,
        /festileaks/i,
      ];

      for (const result of searchResults as any[]) {
        const url = String(result.url || result.link || '');
        if (url && !excludePatterns.some(p => p.test(url))) {
          baseUrl = url;
          discoveredHomepage = url;
          console.log(`Discovered homepage: ${url}`);
          break;
        }
      }

      if (!baseUrl) {
        return NextResponse.json({
          success: true,
          data: {
            companyName: null,
            companyUrl: null,
            kvkNumber: null,
            confidence: 'low',
            source: 'search',
            allMatches: [],
            discoveredHomepage: null,
            message: 'Could not find festival homepage',
          },
        });
      }
    }

    // Phase 2: Build list of pages to scrape
    const urlObj = new URL(baseUrl);
    const origin = urlObj.origin;
    
    // Start with the main page and add company-related pages
    const pagesToScrape = [
      baseUrl,
      ...COMPANY_PAGES.map(path => `${origin}${path}`),
    ];

    console.log(`Scraping ${pagesToScrape.length} pages for company info...`);

    // Phase 3: Use RAG Web Browser to scrape pages in parallel (max 3 at a time)
    const allResults: CompanyResult[] = [];
    const batchSize = 3;
    
    for (let i = 0; i < pagesToScrape.length; i += batchSize) {
      const batch = pagesToScrape.slice(i, i + batchSize);
      
      const batchPromises = batch.map(async (url) => {
        try {
          console.log(`Scraping: ${url}`);
          const { items } = await client.runActor(
            APIFY_ACTORS.RAG_WEB_BROWSER,
            {
              query: url,
              maxResults: 1,
              outputFormats: ['markdown'],
            },
            { waitForFinish: 20 }
          );

          if (items && items.length > 0) {
            const item = items[0] as any;
            const content = String(item.markdown || item.text || '');
            return extractCompanyInfo(content, url);
          }
          return null;
        } catch (error) {
          console.log(`Failed to scrape ${url}:`, error);
          return null;
        }
      });

      const results = await Promise.all(batchPromises);
      allResults.push(...results.filter((r): r is CompanyResult => r !== null));
      
      // If we found a high-confidence match, we can stop early
      const highConfidence = allResults.find(r => r.confidence === 'high');
      if (highConfidence) {
        console.log('Found high-confidence company match, stopping early');
        break;
      }
    }

    // Phase 4: Aggregate results and pick the best match
    const allMatches = new Map<string, { count: number; confidence: string; sources: string[] }>();
    let bestKvk: string | null = null;

    for (const result of allResults) {
      if (result.kvkNumber) {
        bestKvk = result.kvkNumber;
      }
      
      for (const match of result.allMatches) {
        const existing = allMatches.get(match);
        if (existing) {
          existing.count++;
          existing.sources.push(result.source);
          if (result.confidence === 'high') existing.confidence = 'high';
        } else {
          allMatches.set(match, {
            count: 1,
            confidence: result.confidence,
            sources: [result.source],
          });
        }
      }
    }

    // Sort by count and confidence
    const sortedMatches = Array.from(allMatches.entries())
      .sort((a, b) => {
        // Prioritize high confidence
        if (a[1].confidence === 'high' && b[1].confidence !== 'high') return -1;
        if (b[1].confidence === 'high' && a[1].confidence !== 'high') return 1;
        // Then by count
        return b[1].count - a[1].count;
      });

    const bestMatch = sortedMatches[0];
    
    // Determine final confidence
    let finalConfidence: 'high' | 'medium' | 'low' = 'low';
    if (bestMatch) {
      if (bestKvk || bestMatch[1].confidence === 'high' || bestMatch[1].count >= 3) {
        finalConfidence = 'high';
      } else if (bestMatch[1].count >= 2) {
        finalConfidence = 'medium';
      }
    }

    const response = {
      success: true,
      data: {
        companyName: bestMatch?.[0] || null,
        companyUrl: null,
        kvkNumber: bestKvk,
        confidence: finalConfidence,
        source: bestMatch?.[1].sources[0] || baseUrl,
        allMatches: sortedMatches.slice(0, 5).map(([name, data]) => ({
          name,
          count: data.count,
          sources: data.sources,
        })),
        discoveredHomepage,
        pagesScraped: allResults.length,
      },
    };

    console.log('Company discovery result:', JSON.stringify(response.data, null, 2));

    return NextResponse.json(response);
  } catch (error: any) {
    console.error('Company discovery error:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
