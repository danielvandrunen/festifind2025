import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

type RouteParams = { params: { id: string } };

export async function POST(
  request: NextRequest,
  context: RouteParams
) {
  try {
    const { id } = context.params;
    const { isFavorite } = await request.json();
    
    // Validate input
    if (typeof isFavorite !== 'boolean') {
      return new NextResponse(
        JSON.stringify({ error: 'Invalid input: isFavorite must be a boolean' }),
        { 
          status: 400,
          headers: {
            'Content-Type': 'application/json',
          }
        }
      );
    }
    
    // Update the favorite status in database
    const { error } = await supabase
      .from('festivals')
      .update({ favorite: isFavorite })
      .eq('id', id);
    
    if (error) {
      console.error('Error updating favorite status:', error);
      return new NextResponse(
        JSON.stringify({ error: 'Failed to update favorite status' }),
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
    console.error('Exception in favorite endpoint:', err);
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