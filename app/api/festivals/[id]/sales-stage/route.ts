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
    
    // Get the sales_stage value
    const sales_stage = body.sales_stage;
    
    if (!sales_stage || typeof sales_stage !== 'string') {
      console.error('Invalid input type for sales_stage:', sales_stage);
      return NextResponse.json({ 
        success: false, 
        message: 'Invalid input. "sales_stage" must be a valid string value.' 
      }, { status: 400 });
    }
    
    // Validate the sales stage value
    const validStages = ['favorited', 'outreach', 'talking', 'offer', 'deal'];
    if (!validStages.includes(sales_stage)) {
      return NextResponse.json({ 
        success: false, 
        message: `Invalid sales stage. Must be one of: ${validStages.join(', ')}` 
      }, { status: 400 });
    }
    
    // Update the festival sales stage in the database
    const { data, error } = await supabase
      .from('festivals')
      .update({ sales_stage })
      .eq('id', id)
      .select()
      .single();
    
    if (error) {
      console.error('Error updating sales stage:', error);
      return NextResponse.json({ 
        success: false, 
        message: 'Database error when updating sales stage',
        error: error.message,
        details: error
      }, { status: 500 });
    }
    
    return NextResponse.json({ 
      success: true, 
      message: `Festival sales stage updated to "${sales_stage}"`,
      data 
    });
    
  } catch (error: any) {
    console.error('Error processing sales stage update:', error);
    return NextResponse.json({ 
      success: false, 
      message: 'Error processing request',
      error: error.message
    }, { status: 500 });
  }
} 