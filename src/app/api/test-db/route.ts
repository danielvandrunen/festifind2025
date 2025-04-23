import { supabase } from '../../../lib/supabase/client';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    // Test festivals table
    const { data: festivals, error: festivalsError, count: festivalsCount } = await supabase
      .from('festivals')
      .select('*', { count: 'exact', head: true });
    
    if (festivalsError) {
      return NextResponse.json({ 
        success: false, 
        error: `Error accessing festivals table: ${festivalsError.message}` 
      }, { status: 500 });
    }
    
    // Test user_preferences table
    const { data: prefs, error: prefsError, count: prefsCount } = await supabase
      .from('user_preferences')
      .select('*', { count: 'exact', head: true });
    
    if (prefsError) {
      return NextResponse.json({ 
        success: false, 
        error: `Error accessing user_preferences table: ${prefsError.message}` 
      }, { status: 500 });
    }
    
    return NextResponse.json({
      success: true,
      message: 'Database connection successful',
      tables: {
        festivals: {
          exists: true,
          count: festivalsCount || 0
        },
        user_preferences: {
          exists: true,
          count: prefsCount || 0
        }
      }
    });
  } catch (error) {
    return NextResponse.json({ 
      success: false, 
      error: `Database connection test failed: ${error.message}` 
    }, { status: 500 });
  }
} 