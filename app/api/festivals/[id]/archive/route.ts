import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const { isArchived } = await request.json();
    
    // Validate input
    if (typeof isArchived !== 'boolean') {
      return new NextResponse(
        JSON.stringify({ error: 'Invalid input: isArchived must be a boolean' }),
        { 
          status: 400,
          headers: {
            'Content-Type': 'application/json',
          }
        }
      );
    }
    
    // Update the archived status in database
    const { error } = await supabase
      .from('festivals')
      .update({ archived: isArchived })
      .eq('id', id);
    
    if (error) {
      console.error('Error updating archived status:', error);
      return new NextResponse(
        JSON.stringify({ error: 'Failed to update archived status' }),
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
    console.error('Exception in archive endpoint:', err);
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