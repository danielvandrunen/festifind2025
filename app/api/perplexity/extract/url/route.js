// @ts-nocheck
// Force ESM mode

// FestiFind Perplexity API - URL Extraction Endpoint for Vercel (Next.js App Router)
import { NextResponse } from 'next/server';
import { authenticateRequest } from '../../../../../lib/perplexity-auth';
import { processHTML } from '../../../../../lib/html-processor';
import { extractWithPerplexity } from '../../../../../lib/perplexity-extractor';

// Handle CORS preflight
export async function OPTIONS(request) {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    }
  });
}

export async function POST(request) {
  try {
    console.log('🚀 Perplexity URL extraction request received');
    
    // Add CORS headers
    const headers = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    };
    
    // Authenticate request
    const authResult = authenticateRequest(request);
    if (!authResult.success) {
      console.log('❌ Authentication failed:', authResult.error);
      return NextResponse.json({
        success: false,
        error: authResult.error
      }, { status: 401, headers });
    }

    const body = await request.json();
    const { url, html } = body;
    
    if (!url && !html) {
      return NextResponse.json({
        success: false,
        error: 'Either URL or HTML content is required'
      }, { status: 400, headers });
    }

    let content = html;
    let sourceUrl = url;
    
    // If only URL provided, fetch the content
    if (url && !html) {
      try {
        console.log(`🌐 Fetching content from: ${url}`);
        const response = await fetch(url, {
          headers: {
            'User-Agent': 'FestiFind-Bot/1.0 (+https://festifind2025.vercel.app)'
          }
        });
        
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        content = await response.text();
        console.log(`📄 Fetched content: ${content.length} characters`);
      } catch (fetchError) {
        console.error('❌ Failed to fetch URL:', fetchError);
        return NextResponse.json({
          success: false,
          error: `Failed to fetch URL: ${fetchError.message}`
        }, { status: 400, headers });
      }
    }
    
    console.log(`📄 Processing content (${content.length} chars) from: ${sourceUrl || 'provided HTML'}`);
    
    // Process HTML to optimize for AI
    const processedContent = processHTML(content);
    console.log(`🔄 Processed content: ${processedContent.length} chars (${Math.round((1 - processedContent.length / content.length) * 100)}% reduction)`);
    
    // Extract with Perplexity AI
    const result = await extractWithPerplexity(processedContent, sourceUrl);
    
    if (result.success) {
      console.log('✅ Extraction successful');
      return NextResponse.json(result, { status: 200, headers });
    } else {
      console.log('❌ Extraction failed:', result.error);
      return NextResponse.json(result, { status: 500, headers });
    }
    
  } catch (error) {
    console.error('❌ URL extraction endpoint error:', error);
    return NextResponse.json({
      success: false,
      error: 'Internal server error'
    }, { 
      status: 500, 
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      }
    });
  }
} 