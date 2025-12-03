// Simple script to test Supabase connection
import { createClient } from '@supabase/supabase-js';

// Use the keys from config files
const supabaseUrl = 'https://sxdbptmmvhluyxrlzgmh.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN4ZGJwdG1tdmhsdXl4cmx6Z21oIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDU0MTYwMDUsImV4cCI6MjA2MDk5MjAwNX0.asGZCsnEHuxMd09FrH-bPHGhs99Z0s5RE7kIz087kkY';

console.log('Testing connection to Supabase...');
console.log('URL:', supabaseUrl);
console.log('Key type: anon');

// Initialize Supabase client
const supabase = createClient(supabaseUrl, supabaseKey);

async function testSupabaseConnection() {
  console.log('Testing Supabase connection...');
  console.log(`URL: ${supabaseUrl}`);
  console.log(`Key: ${supabaseKey.substring(0, 10)}...`);
  
  try {
    // Fetch festivals from Supabase
    const { data, error } = await supabase
      .from('festivals')
      .select('*')
      .order('start_date', { ascending: true });
    
    if (error) {
      console.error('Error connecting to Supabase:', error);
      return;
    }
    
    console.log(`Found ${data.length} festivals:`);
    data.forEach((festival, i) => {
      console.log(`${i+1}. ${festival.name} (${festival.id})`);
    });
  } catch (error) {
    console.error('Exception when connecting to Supabase:', error);
  }
}

testSupabaseConnection(); 