/**
 * Orchestrated Research API
 * 
 * Uses the self-healing orchestrator for comprehensive festival research
 * with automatic retries, AI validation, and confidence scoring.
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { supabase } from '../../../../lib/supabase-client';
import { createOrchestrator, ResearchPhase } from '../../../../lib/research';

// Input validation schema
const ResearchRequestSchema = z.object({
  festivalId: z.string().min(1),
  festivalName: z.string().min(1),
  festivalUrl: z.string().url().optional().nullable(),
  options: z.object({
    maxRetries: z.number().min(1).max(5).optional(),
    enableAIValidation: z.boolean().optional(),
    parallelExecution: z.boolean().optional(),
  }).optional(),
});

// Supabase client is imported from centralized client with fallback defaults

export async function POST(request: NextRequest) {
  const encoder = new TextEncoder();
  
  // Check for Apify configuration
  if (!process.env.APIFY_API_TOKEN) {
    return NextResponse.json(
      { 
        success: false, 
        error: 'APIFY_API_TOKEN not configured',
        message: 'Research functionality requires Apify API access. Please configure your API token.'
      },
      { status: 503 }
    );
  }

  // Use the centralized Supabase client (has fallback defaults)
  console.log('[Orchestrator] Using centralized Supabase client');

  try {
    const body = await request.json();
    const input = ResearchRequestSchema.parse(body);

    // Create orchestrator with options
    const orchestrator = createOrchestrator({
      maxRetries: input.options?.maxRetries ?? 3,
      enableAIValidation: input.options?.enableAIValidation ?? true,
      parallelExecution: input.options?.parallelExecution ?? true,
      fallbackToBasicSearch: true,
      minConfidenceToPass: 0.3,
    });

    // For streaming progress updates, create a readable stream
    const stream = new ReadableStream({
      async start(controller) {
        // Set up progress callback
        orchestrator.onProgress((state) => {
          const progressEvent = {
            type: 'progress',
            phase: state.phase,
            confidence: state.overallConfidence,
            data: {
              company: state.organizingCompany,
              linkedin: state.linkedInResults ? {
                count: state.linkedInResults.people.length,
                confidence: state.linkedInResults.confidence,
              } : null,
              news: state.newsResults ? {
                count: state.newsResults.articles.length,
                confidence: state.newsResults.confidence,
              } : null,
              calendar: state.calendarResults ? {
                found: state.calendarResults.sources.filter(s => s.found).length,
                total: state.calendarResults.sources.length,
                confidence: state.calendarResults.confidence,
              } : null,
            },
            warnings: state.warnings.length,
            errors: state.errors.length,
          };

          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify(progressEvent)}\n\n`)
          );
        });

        // Run the research
        const result = await orchestrator.runResearch(
          input.festivalId,
          input.festivalName,
          input.festivalUrl || undefined
        );

        // Save results to Supabase using the centralized client
        let savedToDatabase = false;
        try {
          
          const updatePayload: Record<string, any> = {
            research_data: {
              company: result.organizingCompany,
              linkedin: result.linkedInResults,
              news: result.newsResults,
              calendar: result.calendarResults,
              confidence: {
                overall: result.overallConfidence,
                level: result.confidenceLevel,
              },
              meta: {
                startedAt: result.startedAt,
                completedAt: result.lastUpdatedAt,
                phase: result.phase,
                attempts: result.attempts,
                errors: result.errors,
                warnings: result.warnings,
              },
            },
            last_verified: new Date().toISOString(),
          };

          // Update additional fields if discovered
          if (result.discoveredHomepage) {
            updatePayload.homepage_url = result.discoveredHomepage;
          }
          if (result.organizingCompany?.name) {
            updatePayload.organizing_company = result.organizingCompany.name;
          }

          const { error } = await supabase
            .from('festivals')
            .update(updatePayload)
            .eq('id', input.festivalId);

          if (!error) {
            savedToDatabase = true;
            console.log('[Orchestrator] Research saved to database for festival:', input.festivalId);
          } else {
            console.error('[Orchestrator] Failed to save research to database:', error);
          }
        } catch (dbError: any) {
          console.error('[Orchestrator] Database save error:', dbError.message);
        }

        // Send final result
        const finalEvent = {
          type: 'complete',
          success: result.phase === ResearchPhase.COMPLETED,
          savedToDatabase,
          result: {
            phase: result.phase,
            festivalId: result.festivalId,
            discoveredHomepage: result.discoveredHomepage,
            organizingCompany: result.organizingCompany,
            linkedInResults: result.linkedInResults,
            newsResults: result.newsResults,
            calendarResults: result.calendarResults,
            overallConfidence: result.overallConfidence,
            confidenceLevel: result.confidenceLevel,
            errors: result.errors,
            warnings: result.warnings,
            duration: {
              startedAt: result.startedAt,
              completedAt: result.lastUpdatedAt,
            },
          },
        };

        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify(finalEvent)}\n\n`)
        );
        controller.close();
      },
    });

    // Return Server-Sent Events response
    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });

  } catch (error: any) {
    console.error('Orchestrated research API error:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: 'Invalid request data', details: error.issues },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

// Also support a simpler non-streaming endpoint
export async function GET(request: NextRequest) {
  return NextResponse.json({
    success: true,
    message: 'Orchestrated Research API',
    description: 'Use POST to start a research job with streaming progress updates',
    endpoints: {
      POST: {
        description: 'Start orchestrated research for a festival',
        body: {
          festivalId: 'string (required)',
          festivalName: 'string (required)',
          festivalUrl: 'string (optional)',
          options: {
            maxRetries: 'number (1-5, default: 3)',
            enableAIValidation: 'boolean (default: true)',
            parallelExecution: 'boolean (default: true)',
          },
        },
        response: 'Server-Sent Events stream with progress updates',
      },
    },
    features: [
      'Self-healing with automatic retries',
      'Circuit breaker for Apify failures',
      'AI validation of results (requires ANTHROPIC_API_KEY)',
      'Confidence scoring',
      'Automatic database persistence',
      'Graceful degradation when services unavailable',
    ],
    status: {
      apifyConfigured: !!process.env.APIFY_API_TOKEN,
      anthropicConfigured: !!process.env.ANTHROPIC_API_KEY,
      supabaseConfigured: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
    },
  });
}
