import { createClient } from '@supabase/supabase-js';

// Using service role key for development
// TODO: For production, set up proper row-level security and use anon key
const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || '';

// Create a single supabase client for interacting with your database
export const supabase = createClient(supabaseUrl, supabaseAnonKey); 