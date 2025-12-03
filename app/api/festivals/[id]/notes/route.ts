import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { notes } = await request.json();
    
    // Validate input
    if (typeof notes !== 'string') {
      return NextResponse.json(
        { error: 'Invalid input: notes must be a string' },
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
    
    // Update the notes in database
    const { error } = await supabase
      .from('festivals')
      .update({ notes })
      .eq('id', id);
    
    if (error) {
      console.error('Error updating notes:', error);
      return NextResponse.json(
        { error: 'Failed to update notes' },
        { status: 500 }
      );
    }
    
    return NextResponse.json(
      { success: true },
      { status: 200 }
    );
  } catch (err) {
    console.error('Exception in notes endpoint:', err);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
} 