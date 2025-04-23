console.log("Starting test...");
const { createClient } = require('@supabase/supabase-js');
console.log("Loaded Supabase client library");

const supabaseUrl = "https://sxdbptmmvhluyxrlzgmh.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN4ZGJwdG1tdmhsdXl4cmx6Z21oIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDU0MTYwMDUsImV4cCI6MjA2MDk5MjAwNX0.asGZCsnEHuxMd09FrH-bPHGhs99Z0s5RE7kIz087kkY";

console.log('URL:', supabaseUrl);
console.log('KEY exists:', !!supabaseKey);

console.log("Creating Supabase client...");
const supabase = createClient(supabaseUrl, supabaseKey);
console.log("Supabase client created.");

console.log("Querying the festivals table...");
supabase
  .from('festivals')
  .select('*', { head: true })
  .then(response => {
    console.log('RESPONSE RECEIVED:');
    console.log(JSON.stringify(response, null, 2));
    if (response.error) {
      console.error('Error:', response.error);
    } else {
      console.log('Success! Festivals table exists.');
      
      // Now test the user_preferences table
      console.log("Querying the user_preferences table...");
      return supabase.from('user_preferences').select('*', { head: true });
    }
  })
  .then(response => {
    if (response) {
      console.log('USER_PREFS RESPONSE:');
      console.log(JSON.stringify(response, null, 2));
      if (response.error) {
        console.error('Error:', response.error);
      } else {
        console.log('Success! User_preferences table exists.');
        console.log('✅ Database connection successful!');
      }
    }
  })
  .catch(error => {
    console.error('Caught error:', error);
  })
  .finally(() => {
    console.log("Test completed.");
  }); 