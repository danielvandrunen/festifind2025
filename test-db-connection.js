// Script to test Supabase connection and verify tables
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Load environment variables from .env.local
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '.env.local') });

// Validate environment variables
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase environment variables');
  process.exit(1);
}

// Initialize Supabase client
const supabase = createClient(supabaseUrl, supabaseKey);

// Test database connection and table existence
async function testConnection() {
  try {
    console.log('Testing Supabase connection...');
    
    // Check if festivals table exists
    const { data: festivals, error: festivalsError } = await supabase
      .from('festivals')
      .select('count(*)', { count: 'exact', head: true });
    
    if (festivalsError) {
      throw new Error(`Error accessing festivals table: ${festivalsError.message}`);
    }
    
    console.log('✅ Festivals table exists');
    
    // Check if user_preferences table exists
    const { data: preferences, error: preferencesError } = await supabase
      .from('user_preferences')
      .select('count(*)', { count: 'exact', head: true });
    
    if (preferencesError) {
      throw new Error(`Error accessing user_preferences table: ${preferencesError.message}`);
    }
    
    console.log('✅ User_preferences table exists');
    
    // List all tables in the schema
    const { data: tables, error: tablesError } = await supabase
      .rpc('list_tables');
    
    if (tablesError) {
      console.warn(`Note: Could not list all tables: ${tablesError.message}`);
      console.warn('This might be due to RPC function not being available. This is not critical.');
    } else {
      console.log('Tables in database:', tables);
    }
    
    console.log('✅ Database connection successful!');
  } catch (error) {
    console.error('❌ Database connection test failed:', error.message);
    process.exit(1);
  }
}

testConnection(); 