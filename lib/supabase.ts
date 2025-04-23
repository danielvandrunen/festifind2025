import { createClient } from '@supabase/supabase-js';

// Using service role key for development
// TODO: For production, set up proper row-level security and use anon key
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://sxdbptmmvhluyxrlzgmh.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN4ZGJwdG1tdmhsdXl4cmx6Z21oIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0NTQxNjAwNSwiZXhwIjoyMDYwOTkyMDA1fQ.xZnyf5iqVRnfzbp5a0bDFCWDQ66Vfdbi1pZG7yhL5VU';

// Create a single supabase client for interacting with your database
export const supabase = createClient(supabaseUrl, supabaseKey); 