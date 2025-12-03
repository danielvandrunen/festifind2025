import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Print environment variables for debugging
console.log('=== Environment variables ===');
console.log('NEXT_PUBLIC_SUPABASE_URL:', process.env.NEXT_PUBLIC_SUPABASE_URL);
console.log('NEXT_PUBLIC_SUPABASE_ANON_KEY:', process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? '"' + process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY.substring(0, 10) + '... (masked)' : 'undefined');
console.log('NODE_ENV:', process.env.NODE_ENV);
console.log('===========================');

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Check if Supabase credentials are configured
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://sxdbptmmvhluyxrlzgmh.supabase.co';
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN4ZGJwdG1tdmhsdXl4cmx6Z21oIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDU0MTYwMDUsImV4cCI6MjA2MDk5MjAwNX0.asGZCsnEHuxMd09FrH-bPHGhs99Z0s5RE7kIz087kkY';
    
    console.log('Creating Supabase client with URL:', supabaseUrl);
    
    // Create Supabase client
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    // Define the path to the festivals.json file
    const outputPath = path.join(process.cwd(), 'scrapers', 'eblive', 'output', 'festivals.json');
    console.log('Looking for festivals.json at:', outputPath);
    
    // Check if the file exists
    if (!fs.existsSync(outputPath)) {
      console.error('Output file not found at:', outputPath);
      return res.status(404).json({ error: 'Output file not found' });
    }
    
    console.log('Found festivals.json file');
    
    // Read the file
    const fileContent = fs.readFileSync(outputPath, 'utf8');
    let festivals = [];
    
    try {
      festivals = JSON.parse(fileContent);
      console.log('Successfully parsed festivals.json with', festivals.length, 'festivals');
    } catch (parseError) {
      console.error('Error parsing festivals.json:', parseError);
      return res.status(500).json({ error: 'Error parsing festivals data', details: parseError.message });
    }

    // Prepare data for upload - log field mappings for first festival as example
    console.log('Sample festival data before mapping:', JSON.stringify(festivals[0], null, 2));
    
    const uploadData = festivals.map(festival => {
      // Format the location string properly
      let location = festival.city || '';
      if (festival.country_code) {
        location = location ? `${location} (${festival.country_code})` : festival.country_code;
      }
      
      return {
        name: festival.name,
        location: location,
        country: festival.country_code, // Use country_code as country
        start_date: festival.start_date,
        end_date: festival.end_date,
        url: festival.url,
        source: 'eblive'
      };
    });
    
    console.log('Sample festival data after mapping:', JSON.stringify(uploadData[0], null, 2));
    console.log('Uploading data to Supabase:', uploadData.length, 'festivals');
    
    // Get the database schema to verify table structure
    try {
      const { data: schemaData, error: schemaError } = await supabase
        .from('festivals')
        .select('*')
        .limit(1);
      
      if (schemaError) {
        console.error('Error fetching schema:', schemaError);
      } else {
        console.log('Sample database record structure:', schemaData.length > 0 ? Object.keys(schemaData[0]) : 'No records found');
      }
    } catch (schemaCheckError) {
      console.error('Error checking schema:', schemaCheckError);
    }
    
    // First, fetch existing records to avoid duplicates
    const { data: existingRecords, error: fetchError } = await supabase
      .from('festivals')
      .select('url')
      .eq('source', 'eblive');
    
    if (fetchError) {
      console.error('Error fetching existing records:', fetchError);
      return res.status(500).json({
        error: 'Error fetching existing records',
        details: fetchError.message
      });
    }
    
    // Create a set of existing URLs for quick lookup
    const existingUrls = new Set();
    if (existingRecords && existingRecords.length > 0) {
      existingRecords.forEach(record => {
        if (record.url) {
          existingUrls.add(record.url);
        }
      });
    }
    
    console.log('Found', existingUrls.size, 'existing festivals with source=eblive');
    
    // Filter out festivals that already exist in the database
    const newFestivals = uploadData.filter(festival => {
      return !existingUrls.has(festival.url);
    });
    
    console.log('Uploading', newFestivals.length, 'new festivals');
    
    if (newFestivals.length === 0) {
      console.log('No new festivals to upload');
      return res.status(200).json({
        success: true,
        message: 'No new festivals to upload',
        count: 0
      });
    }
    
    // Insert new festivals
    const { data, error } = await supabase
      .from('festivals')
      .insert(newFestivals);
    
    if (error) {
      console.error('Error uploading to Supabase:', error);
      console.error('Error code:', error.code);
      console.error('Error message:', error.message);
      console.error('Error details:', error.details);
      
      return res.status(500).json({
        error: 'Error uploading to Supabase',
        details: error.message,
        code: error.code
      });
    }
    
    console.log('Upload successful!');
    
    // Return success response
    res.status(200).json({
      success: true,
      message: `Successfully uploaded ${newFestivals.length} festivals to Supabase`,
      count: newFestivals.length
    });
  } catch (error) {
    console.error('Error uploading to Supabase:', error);
    res.status(500).json({
      error: 'Error uploading to Supabase',
      details: error.message
    });
  }
} 