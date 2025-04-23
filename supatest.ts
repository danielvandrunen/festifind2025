import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !key) {
  console.error('Missing Supabase environment variables');
  process.exit(1);
}

console.log('Using URL:', url);
console.log('Key found:', !!key);

const supabase = createClient(url, key);

async function main() {
  try {
    // Test festivals table
    console.log('Testing festivals table...');
    const { error: festivalsError } = await supabase
      .from('festivals')
      .select('*', { count: 'exact', head: true });
    
    if (festivalsError) {
      throw new Error(`Error accessing festivals table: ${festivalsError.message}`);
    }
    
    console.log('✓ Festivals table exists!');
    
    // Test user_preferences table
    console.log('Testing user_preferences table...');
    const { error: prefsError } = await supabase
      .from('user_preferences')
      .select('*', { count: 'exact', head: true });
    
    if (prefsError) {
      throw new Error(`Error accessing user_preferences table: ${prefsError.message}`);
    }
    
    console.log('✓ User_preferences table exists!');
    console.log('✓ Database connection successful!');
  } catch (error) {
    console.error('✗ Database test failed:', error);
    process.exit(1);
  }
}

main(); 