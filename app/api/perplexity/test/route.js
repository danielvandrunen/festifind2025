// FestiFind Perplexity API - Test Endpoint for Vercel (Next.js App Router)
import { NextResponse } from 'next/server';
import { extractWithPerplexity } from '../../../../lib/perplexity-extractor';

// Handle CORS preflight
export async function OPTIONS(request) {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    }
  });
}

export async function GET(request) {
  try {
    console.log('🧪 Testing Perplexity API connection...');
    
    // Test HTML content
    const testHTML = `
      <html>
        <head><title>Tomorrowland 2025</title></head>
        <body>
          <h1>Tomorrowland 2025</h1>
          <p>Date: July 18-20, 2025</p>
          <p>Location: Boom, Belgium</p>
          <p>Contact: info@tomorrowland.com</p>
        </body>
      </html>
    `;

    const result = await extractWithPerplexity(testHTML, 'https://test.example.com');
    
    console.log('✅ Perplexity test successful');
    
    return NextResponse.json({
      success: true,
      message: 'Perplexity API test successful',
      testResult: result,
      timestamp: new Date().toISOString()
    }, {
      status: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      }
    });
    
  } catch (error) {
    console.error('❌ Perplexity test failed:', error);
    
    return NextResponse.json({
      success: false,
      error: error.message,
      details: {
        name: error.name,
        stack: error.stack,
        timestamp: new Date().toISOString()
      }
    }, {
      status: 500,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      }
    });
  }
}

export async function POST(request) {
  try {
    console.log('🧪 Testing Perplexity API with custom content...');
    
    const body = await request.json();
    const { html, url } = body;
    
    if (!html) {
      return NextResponse.json({
        success: false,
        error: 'HTML content is required for testing'
      }, { status: 400 });
    }

    const result = await extractWithPerplexity(html, url || 'https://test.example.com');
    
    console.log('✅ Perplexity custom test successful');
    
    return NextResponse.json({
      success: true,
      message: 'Perplexity API custom test successful',
      testResult: result,
      timestamp: new Date().toISOString()
    }, {
      status: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      }
    });
    
  } catch (error) {
    console.error('❌ Perplexity custom test failed:', error);
    
    return NextResponse.json({
      success: false,
      error: error.message,
      details: {
        name: error.name,
        stack: error.stack,
        timestamp: new Date().toISOString()
      }
    }, {
      status: 500,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      }
    });
  }
} 