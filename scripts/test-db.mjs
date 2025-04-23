import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
dotenv.config({ path: resolve(__dirname, '../.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase environment variables');
  process.exit(1);
}

console.log('Supabase URL:', supabaseUrl);
console.log('Supabase Key:', supabaseKey.substring(0, 10) + '...');

const supabase = createClient(supabaseUrl, supabaseKey);

async function testConnection() {
  try {
    console.log('Testing Supabase connection...');
    
    // Test festivals table
    const { data, error, count } = await supabase
      .from('festivals')
      .select('*', { count: 'exact', head: true });
    
    if (error) {
      throw new Error(`Error accessing festivals table: ${error.message}`);
    }
    
    console.log('✅ Festivals table exists');
    
    // Test user_preferences table
    const { data: prefs, error: prefsError } = await supabase
      .from('user_preferences')
      .select('*', { count: 'exact', head: true });
    
    if (prefsError) {
      throw new Error(`Error accessing user_preferences table: ${prefsError.message}`);
    }
    
    console.log('✅ User_preferences table exists');
    console.log('✅ Database connection successful!');
    
  } catch (error) {
    console.error('❌ Database connection test failed:', error.message);
    process.exit(1);
  }
}

testConnection(); 