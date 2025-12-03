import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';

// Function to generate a simple UUID
function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

// Get the latest scraped file from the eblive2 data directory
function getLatestScrapedFile() {
  const dataDir = path.join(process.cwd(), 'data', 'eblive2');
  
  // Check if the data directory exists
  if (!fs.existsSync(dataDir)) {
    return null;
  }
  
  // Get all JSON files that contain festival data
  const files = fs.readdirSync(dataDir)
    .filter(file => file.startsWith('eblive-festivals-') && file.endsWith('.json'))
    .map(file => {
      const fullPath = path.join(dataDir, file);
      const stats = fs.statSync(fullPath);
      return {
        name: file,
        path: fullPath,
        created: stats.mtime.getTime()
      };
    });
  
  // Sort by creation date (newest first)
  files.sort((a, b) => b.created - a.created);
  
  // Return the newest file or null if no files
  return files.length > 0 ? files[0] : null;
}

// Format the festivals for database storage
function formatFestivalsForDB(festivals) {
  // Default date for festivals with unknown dates
  const defaultDate = new Date('2025-01-01').toISOString().split('T')[0];
  
  return festivals.map(festival => {
    // Required fields for the database
    return {
      id: generateUUID(), // Use our simple UUID generator
      name: festival.name,
      location: festival.location || '',
      source: 'eblive',
      // Use defaultDate if startDate is null or undefined
      start_date: festival.startDate || defaultDate,
      // Use startDate for endDate if endDate is null but startDate exists
      // Otherwise use defaultDate if both are null
      end_date: festival.endDate || festival.startDate || defaultDate,
      url: festival.url,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      archived: false,
      favorite: false
    };
  });
}

// Add a function to check the actual database schema
async function checkDatabaseSchema(supabase) {
  try {
    console.log("Checking database schema...");
    // Query the schema information
    const { data, error } = await supabase.rpc('get_table_columns', { table_name: 'festivals' });
    
    if (error) {
      console.error("Error fetching schema:", error);
      return null;
    }
    
    console.log("Database schema for festivals table:", data);
    return data;
  } catch (error) {
    console.error("Error in schema check:", error);
    return null;
  }
}

export default async function handler(req, res) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method not allowed' });
  }
  
  try {
    // Debug environment variables
    console.log("Environment variables check:");
    console.log("NEXT_PUBLIC_SUPABASE_URL exists:", !!process.env.NEXT_PUBLIC_SUPABASE_URL);
    console.log("service_role exists:", !!process.env.service_role);
    
    // Get Supabase credentials from environment variables or request body
    let supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    let supabaseServiceKey = process.env.service_role || process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    // If service role key is missing, try alternative environment variable names
    if (!supabaseServiceKey) {
      supabaseServiceKey = process.env.SUPABASE_KEY || 
                           process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
                           process.env.SUPABASE_ANON_KEY;
      
      console.log("Using alternative key:", !!supabaseServiceKey);
    }
    
    // Check if credentials are in the request body
    if (req.body && req.body.supabaseUrl && req.body.supabaseKey) {
      supabaseUrl = req.body.supabaseUrl;
      supabaseServiceKey = req.body.supabaseKey;
      console.log("Using credentials from request body");
    }
    
    // Final check for credentials
    if (!supabaseUrl) {
      return res.status(500).json({
        success: false,
        message: 'Supabase URL is missing. Please check your environment variables.',
        debug: {
          env_vars_exist: {
            NEXT_PUBLIC_SUPABASE_URL: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
            service_role: !!process.env.service_role,
            SUPABASE_SERVICE_ROLE_KEY: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
            SUPABASE_KEY: !!process.env.SUPABASE_KEY,
            NEXT_PUBLIC_SUPABASE_ANON_KEY: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
          }
        }
      });
    }
    
    if (!supabaseServiceKey) {
      return res.status(500).json({
        success: false,
        message: 'Supabase API key is missing. Please check your environment variables.',
        debug: {
          env_vars_exist: {
            NEXT_PUBLIC_SUPABASE_URL: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
            service_role: !!process.env.service_role,
            SUPABASE_SERVICE_ROLE_KEY: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
            SUPABASE_KEY: !!process.env.SUPABASE_KEY,
            NEXT_PUBLIC_SUPABASE_ANON_KEY: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
          }
        }
      });
    }
    
    console.log("Supabase URL:", supabaseUrl);
    console.log("Supabase key provided:", supabaseServiceKey ? "Yes (masked)" : "No");
    
    // Initialize Supabase client with service role for direct database access
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    // Optionally check schema (might not work if RPC function doesn't exist)
    try {
      await checkDatabaseSchema(supabase);
    } catch (e) {
      console.log("Schema check failed (this is okay):", e.message);
    }
    
    // Get the latest scraped file
    const latestFile = getLatestScrapedFile();
    
    if (!latestFile) {
      return res.status(404).json({
        success: false,
        message: 'No scraped data found'
      });
    }
    
    console.log(`Reading festival data from ${latestFile.name}`);
    
    // Read and parse the festival data
    const fileContent = fs.readFileSync(latestFile.path, 'utf8');
    let festivals = [];
    
    try {
      // Parse the JSON content - the file format could be either:
      // 1. An array of festivals directly, or
      // 2. An object with a festivals array and other metadata
      const data = JSON.parse(fileContent);
      
      if (Array.isArray(data)) {
        // The file contains a direct array of festivals
        festivals = data;
      } else if (data.festivals && Array.isArray(data.festivals)) {
        // The file contains an object with a festivals property
        festivals = data.festivals;
      } else {
        // Unexpected format - check all properties to see if any is an array of festivals
        for (const key in data) {
          if (Array.isArray(data[key]) && data[key].length > 0 && data[key][0].name) {
            festivals = data[key];
            break;
          }
        }
      }
    } catch (error) {
      console.error('Error parsing JSON from file:', error);
      return res.status(500).json({
        success: false,
        message: 'Error parsing festival data',
        error: error.message
      });
    }
    
    if (!festivals || festivals.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'No festivals found in the latest scraped data'
      });
    }
    
    console.log(`Found ${festivals.length} festivals to upload`);
    
    // Format festivals for database insertion
    const formattedFestivals = formatFestivalsForDB(festivals);
    
    console.log(`Uploading ${formattedFestivals.length} festivals to Supabase`);
    
    // Upload to Supabase with upsert (update if exists, insert if not)
    try {
      console.log(`Attempting to upsert ${formattedFestivals.length} festivals with the following schema:`);
      console.log(Object.keys(formattedFestivals[0]));
      
      const { data, error } = await supabase
        .from('festivals')
        .upsert(formattedFestivals, {
          onConflict: 'id',
          returning: 'minimal' // Don't return the inserted rows
        });
      
      if (error) {
        console.error('Error uploading to Supabase:', error);
        return res.status(500).json({
          success: false,
          message: `Failed to upload festivals: ${error.message}`,
          error
        });
      }
      
      console.log(`Upload successful for ${formattedFestivals.length} festivals`);
      
      // Return success response
      return res.status(200).json({
        success: true,
        message: `Successfully uploaded ${formattedFestivals.length} festivals to Supabase`,
        count: formattedFestivals.length,
        file: latestFile.name
      });
    } catch (schemaError) {
      console.error('Schema error during upload:', schemaError);
      return res.status(500).json({
        success: false,
        message: `Schema error during upload: ${schemaError.message}`,
        error: schemaError
      });
    }
    
  } catch (error) {
    console.error('Error in upload handler:', error);
    return res.status(500).json({
      success: false,
      message: `An error occurred: ${error.message}`,
      error: error.toString()
    });
  }
} 