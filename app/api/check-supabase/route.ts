import { NextResponse } from 'next/server';
import { supabase } from '../../../lib/supabase-client';

export async function GET() {
  console.log('DIAGNOSTIC: Running Supabase connection check...');
  
  const diagnosticInfo = {
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL || 'unavailable',
    supabaseAnonKeyFirstChars: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.substring(0, 10) + '...' || 'undefined',
    tests: [] as Array<{name: string, success: boolean, data?: any, error?: any}>
  };
  
  // Test 1: Direct query to festivals table
  try {
    console.log('DIAGNOSTIC: Testing direct query to festivals table...');
    const { data, error } = await supabase
      .from('festivals')
      .select('*')
      .order('start_date', { ascending: true });
    
    diagnosticInfo.tests.push({
      name: 'Direct query to festivals table',
      success: !error,
      data: error ? null : {
        count: data?.length || 0,
        firstItem: data?.[0] ? {...data[0], id: data[0].id?.substring(0, 8) + '...'} : null
      },
      error: error ? {...error} : null
    });
  } catch (error) {
    diagnosticInfo.tests.push({
      name: 'Direct query to festivals table',
      success: false,
      error: error instanceof Error ? error.message : String(error)
    });
  }
  
  // Test 2: Count query
  try {
    console.log('DIAGNOSTIC: Testing count query...');
    const { count, error } = await supabase
      .from('festivals')
      .select('*', { count: 'exact', head: true });
    
    diagnosticInfo.tests.push({
      name: 'Count query',
      success: !error,
      data: error ? null : { count },
      error: error ? {...error} : null
    });
  } catch (error) {
    diagnosticInfo.tests.push({
      name: 'Count query',
      success: false,
      error: error instanceof Error ? error.message : String(error)
    });
  }
  
  // Test 3: Query for a single festival
  try {
    console.log('DIAGNOSTIC: Testing single festival query...');
    const { data, error } = await supabase
      .from('festivals')
      .select('name')
      .limit(1)
      .single();
    
    diagnosticInfo.tests.push({
      name: 'Single festival query',
      success: !error,
      data: error ? null : data,
      error: error ? {...error} : null
    });
  } catch (error) {
    diagnosticInfo.tests.push({
      name: 'Single festival query',
      success: false,
      error: error instanceof Error ? error.message : String(error)
    });
  }
  
  console.log('DIAGNOSTIC: Test results:', JSON.stringify(diagnosticInfo, null, 2));
  
  return NextResponse.json(diagnosticInfo);
} 