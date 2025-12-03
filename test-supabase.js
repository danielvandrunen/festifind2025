// Test script for Supabase connection
const { createClient } = require('@supabase/supabase-js');

// Using the same credentials from the app
const supabaseUrl = 'https://sxdbptmmvhluyxrlzgmh.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN4ZGJwdG1tdmhsdXl4cmx6Z21oIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0NTQxNjAwNSwiZXhwIjoyMDYwOTkyMDA1fQ.xZnyf5iqVRnfzbp5a0bDFCWDQ66Vfdbi1pZG7yhL5VU';

// Create Supabase client
const supabase = createClient(supabaseUrl, supabaseKey);

// Test query
async function testConnection() {
  console.log('Testing Supabase connection...');
  
  try {
    const { data, error } = await supabase
      .from('festivals')
      .select('*')
      .limit(1);
    
    if (error) {
      console.error('Supabase connection error:', error);
      return;
    }
    
    console.log('Connection successful! Sample data:');
    console.log(JSON.stringify(data, null, 2));
    console.log(`Retrieved ${data.length} records`);
  } catch (err) {
    console.error('Exception during Supabase test:', err);
  }
}

// Run the test
testConnection(); 