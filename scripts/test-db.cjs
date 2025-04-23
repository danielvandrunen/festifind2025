const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

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
    const { data: festivals, error: festivalsError, count: festivalsCount } = await supabase
      .from('festivals')
      .select('*', { count: 'exact', head: true });
    
    if (festivalsError) {
      throw new Error(`Error accessing festivals table: ${festivalsError.message}`);
    }
    
    console.log('✅ Festivals table exists');
    
    // Test user_preferences table
    const { data: preferences, error: preferencesError, count: preferencesCount } = await supabase
      .from('user_preferences')
      .select('*', { count: 'exact', head: true });
    
    if (preferencesError) {
      throw new Error(`Error accessing user_preferences table: ${preferencesError.message}`);
    }
    
    console.log('✅ User_preferences table exists');
    console.log('✅ Database connection successful!');
    
  } catch (error) {
    console.error('❌ Database connection test failed:', error);
    process.exit(1);
  }
}

testConnection(); 