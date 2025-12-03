import fs from 'fs';
import path from 'path';

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

// Get the latest status file
function getLatestStatus() {
  const statusPath = path.join(process.cwd(), 'data', 'eblive2', 'latest-status.json');
  
  if (fs.existsSync(statusPath)) {
    try {
      const statusContent = fs.readFileSync(statusPath, 'utf8');
      return JSON.parse(statusContent);
    } catch (error) {
      console.error('Error reading status file:', error);
      return null;
    }
  }
  
  return null;
}

export default async function handler(req, res) {
  try {
    const latestFile = getLatestScrapedFile();
    
    if (!latestFile) {
      return res.status(200).json({
        success: false,
        message: 'No festival data files found',
        festivals: []
      });
    }
    
    // Read the file content
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
    
    return res.status(200).json({
      success: true,
      file: latestFile.name,
      timestamp: new Date().toISOString(),
      count: festivals.length,
      festivals: festivals
    });
  } catch (error) {
    console.error('Error getting latest festival data:', error);
    return res.status(500).json({
      success: false,
      message: 'Error getting latest festival data',
      error: error.message
    });
  }
} 