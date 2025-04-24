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
      return new NextResponse(
        JSON.stringify({ error: 'Invalid input: notes must be a string' }),
        { 
          status: 400,
          headers: {
            'Content-Type': 'application/json',
          }
        }
      );
    }
    
    // Update the notes in database
    const { error } = await supabase
      .from('festivals')
      .update({ notes })
      .eq('id', id);
    
    if (error) {
      console.error('Error updating notes:', error);
      return new NextResponse(
        JSON.stringify({ error: 'Failed to update notes' }),
        { 
          status: 500,
          headers: {
            'Content-Type': 'application/json',
          }
        }
      );
    }
    
    return new NextResponse(
      JSON.stringify({ success: true }),
      { 
        status: 200,
        headers: {
          'Content-Type': 'application/json',
        }
      }
    );
  } catch (err) {
    console.error('Exception in notes endpoint:', err);
    return new NextResponse(
      JSON.stringify({ error: 'Internal Server Error' }),
      { 
        status: 500,
        headers: {
          'Content-Type': 'application/json',
        }
      }
    );
  }
} 