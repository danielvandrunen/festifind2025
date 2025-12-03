// Test script for the EBLive scraper
import { scrapeEBLive } from '../scrapers/eblive2.js';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

// Set up directory paths for ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dataDir = path.join(__dirname, '..', 'data', 'eblive2');

// Ensure data directory exists
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

async function runTest() {
  console.log('Starting EBLive 2.0 scraper test...');

  // Simple progress handler
  const onProgressUpdate = (progress) => {
    process.stdout.write(`\rProgress: ${progress.toFixed(1)}%`);
  };

  // Simple log handler
  const onLogUpdate = (log) => {
    console.log(log);
  };

  try {
    // Run the scraper with limited pages
    const result = await scrapeEBLive({
      maxPages: 2, // Test with 2 pages to check pagination
      outputDir: dataDir,
      onProgressUpdate,
      onLogUpdate,
      testMode: false
    });

    console.log('\nTest completed successfully!');
    console.log(`Found ${result.festivals.length} festivals`);
    
    if (result.festivals.length > 0) {
      console.log('First festival:', result.festivals[0]?.name);
      
      // Save a small sample to a status file for the API to use
      const statusPath = path.join(dataDir, 'latest-status.json');
      fs.writeFileSync(statusPath, JSON.stringify({
        success: true,
        timestamp: new Date().toISOString(),
        lastRun: new Date().toISOString(),
        festivalCount: result.festivals.length,
        pages: result.metrics.pages,
        timeElapsed: result.metrics.timeElapsed,
        metrics: result.metrics
      }));
      
      // Save a small sample of festivals for the API to display
      const resultsPath = path.join(dataDir, `results-${new Date().toISOString().replace(/:/g, '-')}.json`);
      fs.writeFileSync(resultsPath, JSON.stringify({
        success: true,
        timestamp: new Date().toISOString(),
        festivalCount: result.festivals.length,
        pages: result.metrics.pages,
        timeElapsed: result.metrics.timeElapsed,
        metrics: result.metrics,
        festivals: result.festivals.slice(0, 50) // Limit to first 50 festivals for UI display
      }, null, 2));
      
      console.log(`Saved status file for API at ${statusPath}`);
    }
  } catch (error) {
    console.error('Test failed:', error);
  }
}

runTest(); 