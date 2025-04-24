import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { isFavorite } = await request.json();
    
    // Validate input
    if (typeof isFavorite !== 'boolean') {
      return NextResponse.json(
        { error: 'Invalid input: isFavorite must be a boolean' },
        { status: 400 }
      );
    }
    
    // Check if Supabase environment variables are set
    const isSupabaseConfigured = 
      process.env.NEXT_PUBLIC_SUPABASE_URL && 
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    
    // If Supabase is not configured, return mock success for deployment
    if (!isSupabaseConfigured) {
      console.log('API: Supabase is not configured, returning mock success');
      return NextResponse.json(
        { success: true, mockResponse: true },
        { status: 200 }
      );
    }
    
    // Update the favorite status in database
    const { error } = await supabase
      .from('festivals')
      .update({ favorite: isFavorite })
      .eq('id', id);
    
    if (error) {
      console.error('Error updating favorite status:', error);
      return NextResponse.json(
        { error: 'Failed to update favorite status' },
        { status: 500 }
      );
    }
    
    return NextResponse.json(
      { success: true },
      { status: 200 }
    );
  } catch (err) {
    console.error('Exception in favorite endpoint:', err);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
} 