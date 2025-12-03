const { createClient } = require('@supabase/supabase-js');

// Use the same credentials as our insert script
const supabaseUrl = 'https://sxdbptmmvhluyxrlzgmh.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN4ZGJwdG1tdmhsdXl4cmx6Z21oIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0NTQxNjAwNSwiZXhwIjoyMDYwOTkyMDA1fQ.xZnyf5iqVRnfzbp5a0bDFCWDQ66Vfdbi1pZG7yhL5VU';

const supabase = createClient(supabaseUrl, supabaseKey);

async function fetchFestivals() {
  console.log('Testing festival retrieval from database...');
  
  try {
    // Fetch all festivals
    const { data, error } = await supabase
      .from('festivals')
      .select('*')
      .order('start_date', { ascending: true });
    
    if (error) {
      console.error('Error fetching festivals:', error);
      return;
    }
    
    console.log(`Found ${data.length} festivals in the database:`);
    data.forEach((festival, index) => {
      console.log(`${index + 1}. ${festival.name} (${festival.start_date} - ${festival.end_date})`);
    });
    
    // Also test with the anon key which is what the frontend uses
    console.log('\nTesting with anon key (what the frontend uses):');
    const anonClient = createClient(
      supabaseUrl,
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN4ZGJwdG1tdmhsdXl4cmx6Z21oIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDU0MTYwMDUsImV4cCI6MjA2MDk5MjAwNX0.asGZCsnEHuxMd09FrH-b0RnE4iREUNP0dGVjijLl8yE'
    );
    
    const { data: anonData, error: anonError } = await anonClient
      .from('festivals')
      .select('*')
      .order('start_date', { ascending: true });
      
    if (anonError) {
      console.error('Error fetching with anon key:', anonError);
      return;
    }
    
    console.log(`Anon key retrieved ${anonData.length} festivals`);
    
  } catch (err) {
    console.error('Error during test:', err);
  }
}

// Run the function
fetchFestivals()
  .catch(err => {
    console.error('Unhandled error:', err);
    process.exit(1);
  }); 