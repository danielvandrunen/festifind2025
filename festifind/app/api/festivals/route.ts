import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET() {
  try {
    console.log('API: Fetching festivals from database...');
    
    // Test database connection first
    const { error: connectionError } = await supabase.from('festivals').select('count').limit(1);
    if (connectionError) {
      console.error('API: Database connection error:', connectionError);
      return new NextResponse(JSON.stringify({ error: 'Database connection error' }), { 
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        }
      });
    }
    
    // Fetch all festivals
    const { data, error } = await supabase
      .from('festivals')
      .select('*')
      .order('start_date', { ascending: true });

    if (error) {
      console.error('API: Error fetching festivals:', error);
      return new NextResponse(JSON.stringify({ error: error.message }), { 
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        }
      });
    }

    console.log(`API: Found ${data?.length || 0} festivals in database`);
    
    return new NextResponse(JSON.stringify({
      count: data?.length || 0,
      festivals: data
    }), {
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      }
    });
  } catch (err) {
    console.error('API: Exception in festivals endpoint:', err);
    return new NextResponse(JSON.stringify({ 
      error: 'Internal Server Error', 
      details: err instanceof Error ? err.message : String(err) 
    }), { 
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      }
    });
  }
}

// Handle OPTIONS requests for CORS
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
} 