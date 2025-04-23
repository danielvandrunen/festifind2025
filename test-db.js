import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function testConnection() {
  try {
    console.log('Testing Supabase connection...');
    
    // Test festivals table
    const { count: festivalsCount, error: festivalsError } = await supabase
      .from('festivals')
      .select('*', { count: 'exact', head: true });
    
    if (festivalsError) {
      throw new Error(`Error accessing festivals table: ${festivalsError.message}`);
    }
    
    console.log('✅ Festivals table exists');
    
    // Test user_preferences table
    const { count: preferencesCount, error: preferencesError } = await supabase
      .from('user_preferences')
      .select('*', { count: 'exact', head: true });
    
    if (preferencesError) {
      throw new Error(`Error accessing user_preferences table: ${preferencesError.message}`);
    }
    
    console.log('✅ User_preferences table exists');
    console.log('✅ Database connection successful!');
    
    return true;
  } catch (error) {
    console.error('❌ Database connection test failed:', error.message);
    return false;
  }
}

testConnection(); 