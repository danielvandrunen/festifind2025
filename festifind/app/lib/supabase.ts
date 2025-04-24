import { SupabaseClient } from '@supabase/supabase-js';

// Mock client implementation
const mockClient: SupabaseClient = {
  from: () => ({
    select: () => ({
      order: () => Promise.resolve({ data: [], error: null }),
      eq: () => Promise.resolve({ data: [], error: null })
    }),
    update: () => ({
      eq: () => Promise.resolve({ data: null, error: null })
    })
  }),
} as unknown as SupabaseClient;

// Determine if we're in a server context or browser context
const isServer = typeof window === 'undefined';

// Create a function to get the Supabase client
export const getSupabaseClient = async (): Promise<SupabaseClient> => {
  // If we're in a browser context, or if we have environment variables
  if (!isServer || (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)) {
    try {
      const { createClient } = await import('@supabase/supabase-js');
      const url = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
      const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
      
      if (url && key) {
        return createClient(url, key);
      }
    } catch (error) {
      console.error('Error initializing Supabase client:', error);
    }
  }
  
  // Return mock client as fallback
  return mockClient;
};

// Export a pre-initialized client for convenience in most scenarios
export const supabase = mockClient; 