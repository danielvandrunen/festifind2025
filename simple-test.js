const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = "https://sxdbptmmvhluyxrlzgmh.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN4ZGJwdG1tdmhsdXl4cmx6Z21oIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDU0MTYwMDUsImV4cCI6MjA2MDk5MjAwNX0.asGZCsnEHuxMd09FrH-bPHGhs99Z0s5RE7kIz087kkY";

console.log('URL:', supabaseUrl);
console.log('KEY exists:', !!supabaseKey);

const supabase = createClient(supabaseUrl, supabaseKey);

supabase
  .from('festivals')
  .select('*', { head: true })
  .then(response => {
    console.log('RESPONSE:', response);
    if (response.error) {
      console.error('Error:', response.error);
    } else {
      console.log('Success! Festivals table exists.');
    }
  })
  .catch(error => {
    console.error('Caught error:', error);
  }); 