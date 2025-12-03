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

export default async function handler(req, res) {
  try {
    const dataDir = path.join(process.cwd(), 'data', 'eblive2');
    
    // Check if data directory exists
    if (!fs.existsSync(dataDir)) {
      return res.status(200).json({
        success: false,
        message: 'No scraper data available yet',
        lastRun: null,
        festivals: []
      });
    }
    
    // Check if status file exists
    const statusPath = path.join(dataDir, 'latest-status.json');
    let status = null;
    
    if (fs.existsSync(statusPath)) {
      try {
        status = JSON.parse(fs.readFileSync(statusPath, 'utf8'));
      } catch (e) {
        console.error('Error parsing status file:', e);
      }
    }
    
    // Find the most recent festival file and results file
    const latestFile = getLatestScrapedFile();
    const files = fs.readdirSync(dataDir).filter(f => f.startsWith('results-'));
    
    let latestResultsFile = null;
    let latestFestivals = [];
    
    // Try to get festivals from the latest scraped file
    if (latestFile) {
      try {
        const fileContent = fs.readFileSync(latestFile.path, 'utf8');
        latestFestivals = JSON.parse(fileContent);
      } catch (e) {
        console.error('Error reading latest festival file:', e);
      }
    }
    
    // If no festivals from latest file, try old results file
    if (latestFestivals.length === 0 && files.length > 0) {
      latestResultsFile = files.sort().reverse()[0];
      
      try {
        const resultsPath = path.join(dataDir, latestResultsFile);
        const results = JSON.parse(fs.readFileSync(resultsPath, 'utf8'));
        latestFestivals = results.festivals || [];
      } catch (e) {
        console.error('Error reading results file:', e);
      }
    }
    
    // Return combined status
    return res.status(200).json({
      success: true,
      status: status?.status || (latestFestivals.length > 0 ? 'success' : 'never_run'),
      inProgress: status?.inProgress || false,
      progress: status?.progress || 0,
      festivalCount: latestFestivals.length,
      lastRun: status?.timestamp || (latestFile ? new Date(latestFile.created).toISOString() : null),
      latestFile: latestFile ? latestFile.name : null,
      latestResultsFile,
      metrics: status?.metrics || null,
      festivals: latestFestivals.slice(0, 10) // Only return first 10 for the status API
    });
  } catch (error) {
    console.error('Error in status API:', error);
    return res.status(500).json({
      success: false,
      message: 'Error checking scraper status',
      error: error.message
    });
  }
} 