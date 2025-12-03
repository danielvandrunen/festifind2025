import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

// Main festivals endpoint to get all festivals
export async function GET() {
  try {
    console.log('API: Fetching festivals from database...');
    
    // Check if Supabase environment variables are set
    const isSupabaseConfigured = 
      process.env.NEXT_PUBLIC_SUPABASE_URL && 
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    
    // If Supabase is not configured, return mock data for deployment
    if (!isSupabaseConfigured) {
      console.log('API: Supabase is not configured, returning mock data');
      return NextResponse.json(
        { 
          festivals: [
            { 
              id: 'mock-id-1', 
              name: 'Mock Festival 1', 
              start_date: '2025-07-01', 
              end_date: '2025-07-03',
              location: 'Mock Location 1',
              favorite: false,
              archived: false,
              notes: ''
            },
            { 
              id: 'mock-id-2', 
              name: 'Mock Festival 2', 
              start_date: '2025-08-15', 
              end_date: '2025-08-17',
              location: 'Mock Location 2',
              favorite: true,
              archived: false,
              notes: 'Mock notes'
            }
          ] 
        },
        { status: 200 }
      );
    }

    // Query the database
    const { data: festivals, error } = await supabase
      .from('festivals')
      .select('*')
      .order('start_date', { ascending: true });
    
    if (error) {
      console.log('API: Database connection error:', error);
      return NextResponse.json(
        { error: 'Database connection error', details: error },
        { status: 500 }
      );
    }
    
    console.log(`API: Found ${festivals?.length || 0} festivals in database`);
    
    return NextResponse.json({ festivals }, { status: 200 });
  } catch (err) {
    console.error('API: Error fetching festivals:', err);
    return NextResponse.json(
      { error: 'Failed to fetch festivals' },
      { status: 500 }
    );
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