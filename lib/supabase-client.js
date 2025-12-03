/**
 * Centralized Supabase client for the entire application
 * This creates a single instance that should be imported and used everywhere
 */

import { createClient } from '@supabase/supabase-js';

// Default values from variables.md
const DEFAULT_URL = 'https://sxdbptmmvhluyxrlzgmh.supabase.co';
const DEFAULT_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN4ZGJwdG1tdmhsdXl4cmx6Z21oIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDU0MTYwMDUsImV4cCI6MjA2MDk5MjAwNX0.asGZCsnEHuxMd09FrH-bPHGhs99Z0s5RE7kIz087kkY';

// Environment variables take precedence over defaults
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || DEFAULT_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || DEFAULT_KEY;

// Log configuration for debugging (without exposing full key)
if (process.env.NODE_ENV === 'development') {
  console.log('Supabase URL:', supabaseUrl);
  console.log('Supabase key provided:', supabaseKey ? 'Yes (masked)' : 'No');
}

// Initialize the Supabase client
const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    persistSession: false,
  },
  // Set a higher row limit for all queries
  db: {
    schema: 'public',
  },
  global: {
    headers: {
      'x-supabase-query-rows-limit': '10000', // Set a higher row limit globally
    },
    fetch: (...args) => {
      return fetch(...args).catch(error => {
        console.error('Supabase fetch error:', error);
        throw error;
      });
    }
  }
});

/**
 * Fetch data with automatic error handling and retries
 * @param {string} table - The table to query
 * @param {Object} options - Query options (select, order, filters, etc.)
 * @param {number} retries - Number of retry attempts (default: 1)
 * @returns {Promise<Array>} - The fetched data or empty array
 */
export async function fetchData(table, options = {}, retries = 1) {
  try {
    let query = supabase.from(table).select(options.select || '*');
    
    // Apply ordering if specified
    if (options.order) {
      query = query.order(options.order.column, { 
        ascending: options.order.ascending 
      });
    }
    
    // Apply filters if provided
    if (options.filters) {
      options.filters.forEach(filter => {
        query = query.filter(filter.column, filter.operator, filter.value);
      });
    }
    
    // Apply a high limit by default
    const limit = options.limit || 10000;
    query = query.limit(limit);
    
    // Execute the query
    const { data, error } = await query;
    
    if (error) {
      console.error(`Error fetching from ${table}:`, error);
      throw error;
    }
    
    return data || [];
  } catch (error) {
    console.error(`Exception fetching from ${table}:`, error);
    
    // Retry logic for transient issues
    if (retries > 0) {
      console.log(`Retrying fetch from ${table}, ${retries} attempts left...`);
      return new Promise(resolve => {
        setTimeout(() => {
          resolve(fetchData(table, options, retries - 1));
        }, 1000); // 1 second delay before retry
      });
    }
    
    // Return empty array if all retries failed
    return [];
  }
}

/**
 * Test the Supabase connection
 * @returns {Promise<boolean>} - Whether the connection was successful
 */
export async function testConnection() {
  try {
    const { data, error } = await supabase.from('festivals').select('count', { count: 'exact' });
    
    if (error) {
      console.error('Supabase connection test failed:', error);
      return false;
    }
    
    console.log('Supabase connection successful');
    return true;
  } catch (error) {
    console.error('Exception testing Supabase connection:', error);
    return false;
  }
}

/**
 * Apply a migration to the database
 * @param {string} name - Migration name
 * @param {string} sql - SQL query to execute
 * @returns {Promise<boolean>} - Whether the migration was successful
 */
export async function applyMigration(name, sql) {
  try {
    console.log(`Applying migration: ${name}`);
    
    // Try using the built-in RPC method if available
    try {
      const { error } = await supabase.rpc('apply_migration', {
        name,
        sql
      });
      
      if (!error) {
        console.log(`Migration applied via RPC: ${name}`);
        return true;
      }
    } catch (rpcError) {
      console.log('RPC method not available, falling back to direct SQL execution');
    }
    
    // Fall back to direct SQL execution through the REST API
    const projectId = supabaseUrl.match(/https:\/\/([a-zA-Z0-9-]+)\.supabase\.co/)[1];
    const endpoint = `https://${projectId}.supabase.co/rest/v1/`;
    
    console.log(`Executing SQL directly via REST API for project ${projectId}`);
    
    const response = await fetch(`${endpoint}sql`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`
      },
      body: JSON.stringify({
        query: sql
      })
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`SQL execution failed: ${response.status} ${errorText}`);
    }
    
    console.log(`Migration applied directly via REST API: ${name}`);
    return true;
  } catch (error) {
    console.error(`Exception applying migration "${name}":`, error);
    return false;
  }
}

export { supabase };
export default supabase; 