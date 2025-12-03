import { createClient } from '@supabase/supabase-js';
import winston from 'winston';

// Configure logger
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  defaultMeta: { service: 'festivalinfo-api' },
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.printf(({ level, message, timestamp }) => {
          return `${timestamp} [FestivalInfo API] ${level}: ${message}`;
        })
      )
    })
  ]
});

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

let supabase = null;

/**
 * Get a Supabase client instance
 * @returns {Object} Supabase client
 */
export function getSupabaseClient() {
  if (!supabase) {
    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Supabase credentials not configured. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_KEY environment variables');
    }
    
    supabase = createClient(supabaseUrl, supabaseKey);
    logger.info('Supabase client initialized');
  }
  
  return supabase;
}

/**
 * Ensure the required schema and tables exist
 * @returns {Promise<boolean>} Success status
 */
export async function ensureSchemaExists() {
  const client = getSupabaseClient();
  
  try {
    // Create schema if it doesn't exist
    const { error: schemaError } = await client.rpc('create_schema_if_not_exists', {
      schema_name: 'festival_info'
    });
    
    if (schemaError) {
      logger.error('Error creating schema:', schemaError);
      
      // Try alternative approach if RPC fails
      const { error: sqlError } = await client.rpc('execute_sql', {
        sql_string: 'CREATE SCHEMA IF NOT EXISTS festival_info;'
      });
      
      if (sqlError) {
        logger.error('Error creating schema with SQL:', sqlError);
        return false;
      }
    }
    
    // Create festivals table
    const { error: festivalsTableError } = await client.rpc('execute_sql', {
      sql_string: `
        CREATE TABLE IF NOT EXISTS festival_info.festivals (
          id SERIAL PRIMARY KEY,
          festival_id VARCHAR(50) UNIQUE NOT NULL,
          name VARCHAR(255) NOT NULL,
          url TEXT NOT NULL,
          description TEXT,
          location_city VARCHAR(100),
          location_country VARCHAR(100),
          start_date DATE,
          end_date DATE,
          duration INTEGER,
          num_acts INTEGER,
          is_free BOOLEAN,
          has_camping BOOLEAN,
          ticket_url TEXT,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
      `
    });
    
    if (festivalsTableError) {
      logger.error('Error creating festivals table:', festivalsTableError);
      return false;
    }
    
    // Create acts table
    const { error: actsTableError } = await client.rpc('execute_sql', {
      sql_string: `
        CREATE TABLE IF NOT EXISTS festival_info.acts (
          id SERIAL PRIMARY KEY,
          festival_id VARCHAR(50) REFERENCES festival_info.festivals(festival_id),
          name VARCHAR(255) NOT NULL,
          url TEXT,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
      `
    });
    
    if (actsTableError) {
      logger.error('Error creating acts table:', actsTableError);
      return false;
    }
    
    // Create scrape runs table
    const { error: runsTableError } = await client.rpc('execute_sql', {
      sql_string: `
        CREATE TABLE IF NOT EXISTS festival_info.scrape_runs (
          id SERIAL PRIMARY KEY,
          start_time TIMESTAMP WITH TIME ZONE NOT NULL,
          end_time TIMESTAMP WITH TIME ZONE,
          total_festivals INTEGER DEFAULT 0,
          unique_festivals INTEGER DEFAULT 0,
          errors INTEGER DEFAULT 0,
          status VARCHAR(50) DEFAULT 'running',
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
      `
    });
    
    if (runsTableError) {
      logger.error('Error creating scrape_runs table:', runsTableError);
      return false;
    }
    
    logger.info('Schema and tables created successfully');
    return true;
  } catch (error) {
    logger.error('Unexpected error creating schema:', error);
    return false;
  }
}

/**
 * Start a new scrape run
 * @returns {Promise<Object>} Scrape run details
 */
export async function startScrapeRun() {
  const client = getSupabaseClient();
  
  try {
    const { data, error } = await client
      .from('festival_info.scrape_runs')
      .insert({
        start_time: new Date().toISOString(),
        status: 'running'
      })
      .select()
      .single();
    
    if (error) {
      logger.error('Error starting scrape run:', error);
      return null;
    }
    
    logger.info(`Started scrape run with ID: ${data.id}`);
    return data;
  } catch (error) {
    logger.error('Unexpected error starting scrape run:', error);
    return null;
  }
}

/**
 * Update a scrape run
 * @param {number} runId - ID of the scrape run
 * @param {Object} metrics - Metrics to update
 * @returns {Promise<boolean>} Success status
 */
export async function updateScrapeRun(runId, metrics) {
  const client = getSupabaseClient();
  
  try {
    const { error } = await client
      .from('festival_info.scrape_runs')
      .update({
        total_festivals: metrics.totalFestivals || 0,
        unique_festivals: metrics.uniqueFestivals || 0,
        errors: metrics.errors || 0,
        status: metrics.status || 'running',
        end_time: metrics.status === 'completed' ? new Date().toISOString() : null
      })
      .eq('id', runId);
    
    if (error) {
      logger.error(`Error updating scrape run ${runId}:`, error);
      return false;
    }
    
    return true;
  } catch (error) {
    logger.error(`Unexpected error updating scrape run ${runId}:`, error);
    return false;
  }
}

/**
 * Store festival data
 * @param {Object} festival - Festival data
 * @returns {Promise<Object>} Stored festival data
 */
export async function storeFestival(festival) {
  const client = getSupabaseClient();
  
  try {
    // Prepare the festival record
    const festivalRecord = {
      festival_id: festival.id,
      name: festival.name,
      url: festival.url,
      description: festival.description || '',
      location_city: festival.location?.city || '',
      location_country: festival.location?.country || '',
      start_date: festival.startDate || null,
      end_date: festival.endDate || null,
      duration: festival.duration || 1,
      num_acts: festival.numActs || 0,
      is_free: festival.isFree || false,
      has_camping: festival.hasCamping || false,
      ticket_url: festival.ticketUrl || '',
      updated_at: new Date().toISOString()
    };
    
    // Insert or update the festival
    const { data, error } = await client
      .from('festival_info.festivals')
      .upsert(festivalRecord, { 
        onConflict: 'festival_id',
        returning: 'minimal'
      });
    
    if (error) {
      logger.error(`Error storing festival ${festival.id}:`, error);
      return null;
    }
    
    // Store artists if present
    if (festival.artists && festival.artists.length > 0) {
      const artistRecords = festival.artists.map(artist => ({
        festival_id: festival.id,
        name: artist.name,
        url: artist.url || ''
      }));
      
      // Delete existing acts for this festival to avoid duplicates
      await client
        .from('festival_info.acts')
        .delete()
        .eq('festival_id', festival.id);
      
      // Insert new acts
      const { error: artistError } = await client
        .from('festival_info.acts')
        .insert(artistRecords);
      
      if (artistError) {
        logger.warn(`Error storing artists for festival ${festival.id}:`, artistError);
      }
    }
    
    return festivalRecord;
  } catch (error) {
    logger.error(`Unexpected error storing festival ${festival.id}:`, error);
    return null;
  }
}

/**
 * Store multiple festivals
 * @param {Array} festivals - Array of festival objects
 * @returns {Promise<Object>} Results including success count and errors
 */
export async function storeFestivals(festivals) {
  const results = {
    total: festivals.length,
    successful: 0,
    failed: 0,
    errors: []
  };
  
  for (const festival of festivals) {
    try {
      const stored = await storeFestival(festival);
      
      if (stored) {
        results.successful++;
      } else {
        results.failed++;
        results.errors.push(`Failed to store festival ${festival.id}: ${festival.name}`);
      }
    } catch (error) {
      results.failed++;
      results.errors.push(`Exception storing festival ${festival.id}: ${error.message}`);
    }
  }
  
  return results;
} 