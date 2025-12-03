import { NextResponse } from 'next/server';
import { supabase } from '../../../../../lib/supabase-client';

export async function POST(request, { params }) {
  try {
    const { id } = params;
    const { start_date, end_date } = await request.json();
    
    console.log(`API: Updating dates for festival ${id}: ${start_date} to ${end_date}`);
    
    // Validate dates
    if (!start_date || !end_date) {
      return NextResponse.json(
        { error: 'Both start_date and end_date are required' },
        { status: 400 }
      );
    }
    
    // Update festival dates in database
    const { data, error } = await supabase
      .from('festivals')
      .update({ 
        start_date,
        end_date,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select('*')
      .single();
    
    if (error) {
      console.error('API: Error updating festival dates:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    
    console.log('API: Successfully updated festival dates:', data);
    
    return NextResponse.json({
      message: 'Festival dates updated successfully',
      festival: data
    });
    
  } catch (error) {
    console.error('API: Error updating festival dates:', error);
    return NextResponse.json(
      { error: 'An unexpected error occurred' },
      { status: 500 }
    );
  }
} 