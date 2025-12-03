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
    const archived = body.archived !== undefined ? body.archived : body.isArchived;
    
    if (typeof archived !== 'boolean') {
      console.error('Invalid input type for archived:', archived);
      return NextResponse.json({ 
        success: false, 
        message: 'Invalid input. "archived" must be a boolean value.' 
      }, { status: 400 });
    }
    
    // Update the festival archive status in the database
    const { data, error } = await supabase
      .from('festivals')
      .update({ archived })
      .eq('id', id)
      .select()
      .single();
    
    if (error) {
      console.error('Error updating archive status:', error);
      return NextResponse.json({ 
        success: false, 
        message: 'Database error when updating archive status',
        error: error.message,
        details: error
      }, { status: 500 });
    }
    
    return NextResponse.json({ 
      success: true, 
      message: `Festival ${archived ? 'archived' : 'unarchived'}`,
      data 
    });
    
  } catch (error: any) {
    console.error('Error processing archive update:', error);
    return NextResponse.json({ 
      success: false, 
      message: 'Error processing request',
      error: error.message
    }, { status: 500 });
  }
} 