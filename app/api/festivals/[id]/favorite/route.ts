import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '../../../../../lib/supabase-client';

interface Params {
  id: string;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<Params> }
) {
  const { id } = await params;
  
  try {
    // Parse the request body
    const body = await request.json();
    
    // Support both parameter formats
    const favorite = body.favorite !== undefined ? body.favorite : body.isFavorite;
    
    if (typeof favorite !== 'boolean') {
      console.error('Invalid input type for favorite:', favorite);
      return NextResponse.json({ 
        success: false, 
        message: 'Invalid input. "favorite" must be a boolean value.' 
      }, { status: 400 });
    }
    
    // Update the festival favorite status in the database
    const { data, error } = await supabase
      .from('festivals')
      .update({ favorite })
      .eq('id', id)
      .select()
      .single();
    
    if (error) {
      console.error('Error updating favorite status:', error);
      return NextResponse.json({ 
        success: false, 
        message: 'Database error when updating favorite status',
        error: error.message,
        details: error
      }, { status: 500 });
    }
    
    return NextResponse.json({ 
      success: true, 
      message: `Festival ${favorite ? 'added to' : 'removed from'} favorites`,
      data 
    });
    
  } catch (error: any) {
    console.error('Error processing favorite update:', error);
    return NextResponse.json({ 
      success: false, 
      message: 'Error processing request',
      error: error.message
    }, { status: 500 });
  }
}