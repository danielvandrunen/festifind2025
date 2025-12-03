// Simple script to test local Supabase connection
import { createClient } from '@supabase/supabase-js';

// Local Supabase URL and anon key
const supabaseUrl = 'http://localhost:54321';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN4ZGJwdG1tdmhsdXl4cmx6Z21oIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDU0MTYwMDUsImV4cCI6MjA2MDk5MjAwNX0.asGZCsnEHuxMd09FrH-bPHGhs99Z0s5RE7kIz087kkY';

console.log('Testing local Supabase connection...');
console.log(`URL: ${supabaseUrl}`);
console.log(`Key: ${supabaseKey.substring(0, 15)}...`);

// Initialize Supabase client
const supabase = createClient(supabaseUrl, supabaseKey);

async function testConnection() {
  try {
    // Fetch festivals from Supabase
    const { data, error } = await supabase
      .from('festivals')
      .select('*')
      .limit(5);
    
    if (error) {
      console.error('Error connecting to local Supabase:', error);
      return;
    }
    
    console.log(`Success! Found ${data.length} festivals:`);
    data.forEach((festival, i) => {
      console.log(`${i+1}. ${festival.name} (${festival.start_date})`);
    });
  } catch (error) {
    console.error('Exception when connecting to local Supabase:', error);
  }
}

// Run the test
testConnection(); 