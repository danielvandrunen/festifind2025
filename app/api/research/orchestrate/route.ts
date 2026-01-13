/**
 * Research Orchestrator API Endpoint
 * 
 * POST /api/research/orchestrate
 * 
 * Initiates AI-powered research for a festival using Claude
 * Streams events back to the client for real-time updates
 */

import { NextRequest, NextResponse } from 'next/server';
import { ResearchOrchestrator, ResearchQuerySchema } from '../../../../lib/orchestrator';

// Check for API key at startup
const hasApiKey = !!process.env.ANTHROPIC_API_KEY;

export async function POST(request: NextRequest) {
  // Verify API key is configured
  if (!hasApiKey) {
    return NextResponse.json(
      { 
        success: false, 
        error: 'ANTHROPIC_API_KEY not configured',
        message: 'Please add ANTHROPIC_API_KEY to your environment variables'
      },
      { status: 503 }
    );
  }

  try {
    const body = await request.json();
    
    // Validate request body
    const parseResult = ResearchQuerySchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Invalid request body',
          details: parseResult.error.flatten()
        },
        { status: 400 }
      );
    }

    const query = parseResult.data;

    // Create orchestrator instance
    const orchestrator = new ResearchOrchestrator();
    
    // For streaming responses, we'd use SSE or WebSockets
    // For now, return the complete result
    const events: unknown[] = [];
    orchestrator.onEvent((event) => {
      events.push(event);
    });

    // Execute research
    const result = await orchestrator.research(query);

    return NextResponse.json({
      success: true,
      result,
      events, // Include events for debugging/transparency
    });

  } catch (error) {
    console.error('Research orchestrator error:', error);
    
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

// GET endpoint for checking orchestrator status
export async function GET() {
  return NextResponse.json({
    service: 'research-orchestrator',
    status: hasApiKey ? 'ready' : 'not_configured',
    capabilities: [
      'web_search',
      'linkedin_search', 
      'extract_webpage_data',
      'validate_linkedin_url',
      'synthesize_findings'
    ],
    models: [
      'claude-sonnet-4-20250514',
      'claude-3-5-sonnet-20241022',
      'claude-3-opus-20240229'
    ],
    configuration: {
      apiKeyConfigured: hasApiKey,
      message: hasApiKey 
        ? 'Orchestrator ready for research tasks' 
        : 'Add ANTHROPIC_API_KEY to environment variables'
    }
  });
}
