import { NextRequest, NextResponse } from 'next/server';
import { validateExtensionApiKey, getApiKeyFromRequest } from '../../../../lib/auth';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { apiKey } = body;

    if (!apiKey) {
      return NextResponse.json(
        { error: 'API key is required' },
        { status: 400 }
      );
    }

    // Validate API key
    if (!validateExtensionApiKey(apiKey)) {
      return NextResponse.json(
        { error: 'Invalid API key' },
        { status: 401 }
      );
    }

    // Log successful authentication
    console.log('Chrome extension authenticated successfully');

    return NextResponse.json({
      success: true,
      message: 'Authentication successful',
      permissions: ['create_festival', 'read_festival']
    });

  } catch (error) {
    console.error('Error in extension authentication:', error);
    return NextResponse.json(
      { error: 'Authentication failed' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    // Check API key from headers
    const apiKey = getApiKeyFromRequest(request);
    
    if (!apiKey) {
      return NextResponse.json(
        { error: 'API key is required in headers' },
        { status: 400 }
      );
    }

    if (!validateExtensionApiKey(apiKey)) {
      return NextResponse.json(
        { error: 'Invalid API key' },
        { status: 401 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'API key is valid',
      permissions: ['create_festival', 'read_festival']
    });

  } catch (error) {
    console.error('Error in extension authentication:', error);
    return NextResponse.json(
      { error: 'Authentication failed' },
      { status: 500 }
    );
  }
} 