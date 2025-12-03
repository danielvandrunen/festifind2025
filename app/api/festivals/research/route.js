// @ts-nocheck
// Force ESM mode

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

/**
 * GET handler to retrieve all research data
 * Returns a list of all festival research entries
 */
export async function GET(req) {
  try {
    console.log('Fetching all research data from database');
    
    // Try to fetch all research entries from the database
    const { data, error } = await supabase
      .from('festival_research')
      .select('*') // Select all fields including research_log
      .order('updated_at', { ascending: false });
    
    if (error) {
      console.error('Error fetching research data:', error);
      // Return empty array instead of error to avoid breaking the UI
      return NextResponse.json([]);
    }
    
    console.log(`Found ${data?.length || 0} research entries`);
    return NextResponse.json(data || []);
  } catch (error) {
    console.error('Error in research API:', error);
    // Return empty array instead of error to avoid breaking the UI
    return NextResponse.json([]);
  }
}

/**
 * DELETE handler to clear all research data
 * Removes all festival research entries from the database
 */
export async function DELETE(req) {
  try {
    console.log('🗑️ DEV TOOLS: Clearing all research data from database...');
    
    // Delete all research entries from the database
    const { error } = await supabase
      .from('festival_research')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all rows (using a condition that's always true)
    
    if (error) {
      console.error('❌ DEV TOOLS: Error clearing research data from database:', error);
      return NextResponse.json({
        error: 'Failed to clear research data from database', 
        details: error.message
      }, { status: 500 });
    }
    
    console.log('✅ DEV TOOLS: Successfully cleared all research data from database');
    return NextResponse.json({
      message: 'All research data cleared successfully',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ DEV TOOLS: Error in research DELETE API:', error);
    return NextResponse.json({
      error: 'An unexpected error occurred while clearing research data', 
      details: error.message
    }, { status: 500 });
  }
} 