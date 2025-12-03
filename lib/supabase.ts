import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Using service role key for development
// TODO: For production, set up proper row-level security and use anon key
const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

// Create a single supabase client for interacting with your database
// Use a placeholder URL during build time if env vars are not set
let supabase: SupabaseClient;

if (supabaseUrl && supabaseAnonKey) {
  supabase = createClient(supabaseUrl, supabaseAnonKey);
} else {
  // Create a dummy client that will fail gracefully at runtime
  // This allows the build to complete even without env vars
  supabase = createClient('https://placeholder.supabase.co', 'placeholder-key');
}

export { supabase };
