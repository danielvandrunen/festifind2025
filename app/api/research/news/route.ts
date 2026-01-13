/**
 * News Research API Endpoint
 * 
 * POST /api/research/news
 * 
 * Search for news articles and press coverage about a festival.
 * Now fetches actual article content using RAG Web Browser for summaries.
 * Uses Apify's Google Search scraper for news results.
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getApifyClient, APIFY_ACTORS } from '../../../../lib/apify/client';

// Request schema - updated with fetchContent option
const NewsRequestSchema = z.object({
  festivalName: z.string().min(1, 'Festival name is required'),
  festivalId: z.string().optional(),
  language: z.enum(['nl', 'en', 'de', 'fr']).default('nl'),
  maxResults: z.number().min(1).max(50).default(10),
  includeReviews: z.boolean().default(true),
  fetchContent: z.boolean().default(true), // NEW: Fetch actual article content
  maxContentArticles: z.number().min(0).max(5).default(3), // Limit content fetching for speed
});

interface NewsArticle {
  title: string;
  url: string;
  snippet?: string;
  source: string;
  type: 'news' | 'review';
  summary?: string;
  date?: string;
  fetchedContent?: boolean;
}

/**
 * Extract a clean summary from article content
 */
function extractSummary(content: string, maxLength: number = 400): string {
  // Remove markdown formatting
  let text = content
    .replace(/#+\s*/g, '')
    .replace(/\*\*/g, '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // [text](url) -> text
    .replace(/!\[.*?\]\([^)]+\)/g, '') // Remove images
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  
  // Find first meaningful paragraph (not too short)
  const paragraphs = text.split(/\n\n+/).filter(p => p.length > 50);
  
  if (paragraphs.length === 0) {
    return text.substring(0, maxLength);
  }
  
  // Take first 2 paragraphs or up to maxLength
  let summary = paragraphs.slice(0, 2).join(' ').trim();
  
  if (summary.length > maxLength) {
    summary = summary.substring(0, maxLength);
    // Don't cut in the middle of a word
    const lastSpace = summary.lastIndexOf(' ');
    if (lastSpace > maxLength - 50) {
      summary = summary.substring(0, lastSpace);
    }
    summary += '...';
  }
  
  return summary;
}

/**
 * Extract date from article content or title
 */
function extractDate(content: string, title: string): string | undefined {
  // Common date patterns
  const datePatterns = [
    // Full dates: Jan 15, 2025 / January 15, 2025
    /\b(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s+\d{1,2},?\s+202[4-6]\b/gi,
    // ISO dates: 2025-01-15
    /\b202[4-6]-\d{2}-\d{2}\b/g,
    // European dates: 15-01-2025, 15/01/2025
    /\b\d{1,2}[-/]\d{1,2}[-/]202[4-6]\b/g,
    // Dutch format: 15 januari 2025
    /\b\d{1,2}\s+(januari|februari|maart|april|mei|juni|juli|augustus|september|oktober|november|december)\s+202[4-6]\b/gi,
  ];
  
  const textToSearch = title + ' ' + content.substring(0, 1000);
  
  for (const pattern of datePatterns) {
    const match = textToSearch.match(pattern);
    if (match) {
      return match[0];
    }
  }
  
  return undefined;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validatedInput = NewsRequestSchema.parse(body);

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

    const { festivalName, language, maxResults, includeReviews, fetchContent, maxContentArticles } = validatedInput;
    console.log(`News research for: ${festivalName} (fetchContent: ${fetchContent})`);

    // Build search queries - run in PARALLEL
    const currentYear = new Date().getFullYear();
    const newsQuery = `"${festivalName}" festival nieuws OR news ${currentYear} OR ${currentYear + 1}`;
    const reviewQuery = `"${festivalName}" festival review OR recensie OR ervaring ${currentYear}`;
    
    const searchPromises: Promise<any>[] = [
      client.runActor(
        APIFY_ACTORS.GOOGLE_SEARCH_SCRAPER,
        {
          queries: newsQuery,
          maxPagesPerQuery: 1,
          resultsPerPage: Math.min(maxResults, 10),
          languageCode: language,
          countryCode: language === 'nl' ? 'nl' : undefined,
        },
        { waitForFinish: 25 }
      ),
    ];

    if (includeReviews) {
      searchPromises.push(
        client.runActor(
          APIFY_ACTORS.GOOGLE_SEARCH_SCRAPER,
          {
            queries: reviewQuery,
            maxPagesPerQuery: 1,
            resultsPerPage: 5,
            languageCode: language,
          },
          { waitForFinish: 25 }
        )
      );
    }

    const results = await Promise.all(searchPromises);
    const newsItems = results[0].items;
    const reviewItems = includeReviews ? results[1]?.items || [] : [];

    // Initial structure of results (without content)
    const newsArticles: NewsArticle[] = (newsItems as any[]).slice(0, maxResults).map(item => ({
      title: item.title,
      url: item.url || item.link,
      snippet: item.description || item.snippet,
      source: extractDomain(item.url || item.link),
      type: 'news' as const,
    }));

    const reviewArticles: NewsArticle[] = (reviewItems as any[]).map(item => ({
      title: item.title,
      url: item.url || item.link,
      snippet: item.description || item.snippet,
      source: extractDomain(item.url || item.link),
      type: 'review' as const,
    }));

    // All articles combined
    let allArticles: NewsArticle[] = [...newsArticles, ...reviewArticles];

    // Phase 2: Fetch actual content for top articles using RAG Web Browser
    if (fetchContent && maxContentArticles > 0) {
      console.log(`Fetching content for top ${maxContentArticles} articles...`);
      
      // Select top articles to fetch content for (prioritize news over reviews)
      const articlesToFetch = allArticles
        .filter(a => !a.url.includes('linkedin.com') && !a.url.includes('facebook.com'))
        .slice(0, maxContentArticles);
      
      const contentPromises = articlesToFetch.map(async (article) => {
        try {
          console.log(`Fetching content: ${article.url}`);
          const contentResult = await client.runActor(
            APIFY_ACTORS.RAG_WEB_BROWSER,
            {
              query: article.url,
              maxResults: 1,
              outputFormats: ['markdown'],
            },
            { waitForFinish: 20 }
          );
          
          if (contentResult.items?.length > 0) {
            const item = contentResult.items[0] as any;
            const content = String(item.markdown || item.text || '');
            return {
              url: article.url,
              summary: extractSummary(content),
              date: extractDate(content, article.title),
              fetchedContent: true,
            };
          }
          return { url: article.url, fetchedContent: false };
        } catch (error) {
          console.log(`Failed to fetch content for ${article.url}`);
          return { url: article.url, fetchedContent: false };
        }
      });

      const contentResults = await Promise.all(contentPromises);
      
      // Merge content back into articles
      for (const contentResult of contentResults) {
        const article = allArticles.find(a => a.url === contentResult.url);
        if (article && contentResult.fetchedContent) {
          article.summary = contentResult.summary;
          article.date = contentResult.date || article.date;
          article.fetchedContent = true;
        }
      }
    }

    // Categorize news by sentiment/type
    const categorized = {
      announcements: allArticles.filter(n => 
        n.type === 'news' && (
          n.title?.toLowerCase().includes('announce') || 
          n.title?.toLowerCase().includes('lineup') ||
          n.title?.toLowerCase().includes('tickets') ||
          n.title?.toLowerCase().includes('programma') ||
          n.title?.toLowerCase().includes('bekend')
        )
      ),
      general: allArticles.filter(n => 
        n.type === 'news' &&
        !n.title?.toLowerCase().includes('announce') && 
        !n.title?.toLowerCase().includes('lineup') &&
        !n.title?.toLowerCase().includes('tickets')
      ),
      reviews: allArticles.filter(n => n.type === 'review'),
    };

    return NextResponse.json({
      success: true,
      festivalName,
      festivalId: validatedInput.festivalId,
      results: {
        all: allArticles,
        categorized,
      },
      summary: {
        totalArticles: allArticles.length,
        totalNews: newsArticles.length,
        totalReviews: reviewArticles.length,
        announcements: categorized.announcements.length,
        articlesWithContent: allArticles.filter(a => a.fetchedContent).length,
      },
      timestamp: new Date().toISOString(),
    });

  } catch (error: any) {
    console.error('News research error:', error);

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

function extractDomain(url: string): string {
  try {
    const domain = new URL(url).hostname;
    return domain.replace('www.', '');
  } catch {
    return 'unknown';
  }
}
