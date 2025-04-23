const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

// Add handlers for uncaught exceptions
process.on('uncaughtException', (err) => {
  console.error('Uncaught exception:', err);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

console.log('URL:', url);
console.log('KEY:', key ? key.substring(0, 10) + '...' : 'Not Found');

try {
  console.log('Creating Supabase client...');
  const supabase = createClient(url, key);
  console.log('Supabase client created.');

  async function main() {
    try {
      console.log('Testing festivals table...');
      const { data, error } = await supabase.from('festivals').select('*', { head: true });
      
      console.log('Response received:', JSON.stringify({ data, error }, null, 2));
      
      if (error) {
        console.error('Error accessing festivals table:', error.message);
        process.exit(1);
      }
      
      console.log('Festivals table exists!');
      
      console.log('Testing user_preferences table...');
      const { data: data2, error: error2 } = await supabase.from('user_preferences').select('*', { head: true });
      
      console.log('Response received:', JSON.stringify({ data: data2, error: error2 }, null, 2));
      
      if (error2) {
        console.error('Error accessing user_preferences table:', error2.message);
        process.exit(1);
      }
      
      console.log('User_preferences table exists!');
      console.log('Database connection successful!');
    } catch (error) {
      console.error('Test failed:', error);
      process.exit(1);
    }
  }

  // Actually run the function
  main();
} catch (error) {
  console.error('Error setting up Supabase client:', error);
  process.exit(1);
} 