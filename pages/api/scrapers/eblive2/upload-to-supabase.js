import supabase from '../../../../lib/supabase-client';
import fs from 'fs';
import path from 'path';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { resultFile } = req.body;
    const dataDir = path.join(process.cwd(), 'data', 'eblive2');
    
    // If no specific file is provided, use the latest results file
    let targetFile = resultFile;
    if (!targetFile) {
      const files = fs.readdirSync(dataDir).filter(f => f.startsWith('results-'));
      if (files.length === 0) {
        return res.status(404).json({ 
          success: false, 
          error: 'No results files found' 
        });
      }
      targetFile = files.sort().reverse()[0]; // Get the latest file
    }
    
    const resultsPath = path.join(dataDir, targetFile);
    
    // Check if the file exists
    if (!fs.existsSync(resultsPath)) {
      return res.status(404).json({ 
        success: false, 
        error: `Results file not found: ${targetFile}` 
      });
    }
    
    // Read the file
    const fileContent = fs.readFileSync(resultsPath, 'utf8');
    let data;
    
    try {
      data = JSON.parse(fileContent);
    } catch (parseError) {
      return res.status(500).json({ 
        success: false, 
        error: 'Error parsing results data', 
        details: parseError.message 
      });
    }
    
    const festivals = data.festivals || [];
    
    if (festivals.length === 0) {
      return res.status(200).json({
        success: true,
        message: 'No festivals to upload',
        count: 0
      });
    }
    
    // First, check the structure of the festivals table
    const { data: schemaCheck, error: schemaError } = await supabase
      .from('festivals')
      .select('*')
      .limit(1);
    
    if (schemaError) {
      return res.status(500).json({
        success: false,
        error: 'Error checking table schema',
        details: schemaError.message
      });
    }
    
    // Log the schema structure
    console.log('Table schema columns:', schemaCheck.length ? Object.keys(schemaCheck[0]) : 'No records found');
    
    // Determine if external_id or source_id exists
    const hasExternalId = schemaCheck.length && 'external_id' in schemaCheck[0];
    const hasSourceId = schemaCheck.length && 'source_id' in schemaCheck[0];
    const idField = hasExternalId ? 'external_id' : hasSourceId ? 'source_id' : undefined;
    
    // Prepare data for Supabase based on actual schema
    const uploadData = festivals.map(festival => {
      const festivalData = {
        name: festival.name,
        location: festival.location || '',
        url: festival.url,
        source: 'eblive2',
        // Only add fields that likely exist in most schema designs
        start_date: festival.startDate,
        end_date: festival.endDate
      };
      
      // Add optional fields based on schema
      if (idField) {
        festivalData[idField] = festival.id;
      }
      
      // Check if country field exists
      if (schemaCheck.length && 'country' in schemaCheck[0]) {
        festivalData.country = festival.location?.includes('(') 
          ? festival.location.match(/\(([^)]+)\)/)?.[1] 
          : null;
      }
      
      // Check if original_dates field exists
      if (schemaCheck.length && 'original_dates' in schemaCheck[0]) {
        festivalData.original_dates = festival.dates;
      }
      
      // Check if scraped_at field exists
      if (schemaCheck.length && 'scraped_at' in schemaCheck[0]) {
        festivalData.scraped_at = festival.scrapedAt || new Date().toISOString();
      }
      
      return festivalData;
    });
    
    // First, fetch existing records to avoid duplicates using URL as the most reliable key
    const { data: existingRecords, error: fetchError } = await supabase
      .from('festivals')
      .select('url')
      .eq('source', 'eblive2');
    
    if (fetchError) {
      return res.status(500).json({
        success: false,
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
    
    // Filter out festivals that already exist in the database
    const newFestivals = uploadData.filter(festival => {
      return !existingUrls.has(festival.url);
    });
    
    if (newFestivals.length === 0) {
      return res.status(200).json({
        success: true,
        message: 'All festivals already exist in the database',
        count: 0
      });
    }
    
    // Upload the data in batches of 100 to avoid hitting limits
    const batchSize = 100;
    const results = [];
    
    for (let i = 0; i < newFestivals.length; i += batchSize) {
      const batch = newFestivals.slice(i, i + batchSize);
      const { data, error } = await supabase
        .from('festivals')
        .insert(batch)
        .select();
      
      if (error) {
        return res.status(500).json({
          success: false,
          error: 'Error uploading to Supabase',
          details: error.message,
          code: error.code,
          completed: results.length
        });
      }
      
      results.push(...(data || []));
    }
    
    // Return success response
    return res.status(200).json({
      success: true,
      message: `Successfully uploaded ${results.length} festivals to Supabase`,
      count: results.length,
      totalFestivals: festivals.length,
      alreadyExisted: festivals.length - newFestivals.length
    });
    
  } catch (error) {
    console.error('Error uploading to Supabase:', error);
    return res.status(500).json({
      success: false,
      error: 'Error uploading to Supabase',
      details: error.message
    });
  }
} 