// Simple script to test Supabase connection
import { createClient } from '@supabase/supabase-js';

// Supabase configuration from variables.md (using the service_role key)
const supabaseUrl = 'https://sxdbptmmvhluyxrlzgmh.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN4ZGJwdG1tdmhsdXl4cmx6Z21oIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDU0MTYwMDUsImV4cCI6MjA2MDk5MjAwNX0.asGZCsnEHuxMd09FrH-bPHGhs99Z0s5RE7kIz087kkY';

console.log('Testing connection to Supabase...');
console.log('URL:', supabaseUrl);
console.log('Key provided:', supabaseKey ? 'Yes (masked)' : 'No');

// Initialize Supabase client
const supabase = createClient(supabaseUrl, supabaseKey);

async function testConnection() {
  try {
    // Try to fetch data from the festivals table
    console.log('Fetching data from festivals table...');
    const { data, error } = await supabase
      .from('festivals')
      .select('*')
      .limit(5);
    
    if (error) {
      console.error('Error connecting to Supabase:', error);
      return;
    }
    
    console.log('Connection successful!');
    console.log(`Found ${data.length} festivals`);
    if (data.length > 0) {
      console.log('First festival:', data[0]);
    } else {
      console.log('No festivals found in the database');
    }
  } catch (err) {
    console.error('Exception:', err);
  }
}

testConnection(); 