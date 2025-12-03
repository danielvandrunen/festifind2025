// Command-line script to run the EBLive scraper without the web UI
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

// Parse command line arguments
const args = process.argv.slice(2);
const maxPages = args.includes('--all') ? 0 : 
                (args.includes('--max-pages') ? 
                  parseInt(args[args.indexOf('--max-pages') + 1], 10) : 41); // Default to all 41 pages
const testMode = args.includes('--test');
const dockerMode = args.includes('--docker') || process.env.DOCKER === 'true' || process.env.CONTAINER === 'true';

async function main() {
  console.log('Starting EBLive 2.0 scraper...');
  console.log(`Max pages: ${maxPages || 'ALL'}`);
  console.log(`Test mode: ${testMode ? 'YES' : 'NO'}`);
  console.log(`Docker mode: ${dockerMode ? 'YES' : 'NO'}`);
  console.log(`Output directory: ${dataDir}`);
  console.log('-----------------------------------');

  // Simple progress handler
  const onProgressUpdate = (progress) => {
    process.stdout.write(`\rProgress: ${progress.toFixed(1)}%`);
  };

  // Simple log handler
  const onLogUpdate = (log) => {
    console.log(log);
  };

  try {
    // Check for enough memory in Docker environment
    if (dockerMode) {
      console.log('Running in Docker environment - optimizing for container use');
      
      // Write initial status file
      const statusPath = path.join(dataDir, 'latest-status.json');
      fs.writeFileSync(statusPath, JSON.stringify({
        success: true,
        inProgress: true,
        timestamp: new Date().toISOString(),
        lastRun: new Date().toISOString(),
        message: 'Scraper starting...',
        progress: 0
      }));
    }
    
    const result = await scrapeEBLive({
      maxPages,
      outputDir: dataDir,
      onProgressUpdate,
      onLogUpdate,
      testMode,
      dockerMode
    });

    console.log('\nScraper completed successfully!');
    console.log(`Found ${result.festivals.length} festivals`);
    
    if (result.festivals.length > 0) {
      console.log('First few festivals:');
      result.festivals.slice(0, 5).forEach(f => {
        console.log(`- ${f.name} (${f.location}) - ${f.dates}`);
      });
      
      // Save a status file for the API to use
      const statusPath = path.join(dataDir, 'latest-status.json');
      fs.writeFileSync(statusPath, JSON.stringify({
        success: true,
        inProgress: false,
        timestamp: new Date().toISOString(),
        lastRun: new Date().toISOString(),
        festivalCount: result.festivals.length,
        pages: result.metrics.pages,
        timeElapsed: result.metrics.timeElapsed,
        metrics: result.metrics,
        progress: 100
      }));
      
      // Save festival data in smaller chunks to handle memory constraints in Docker
      const fullDataPath = path.join(dataDir, `eblive-festivals-${new Date().toISOString().replace(/:/g, '-')}.json`);
      fs.writeFileSync(fullDataPath, JSON.stringify(result.festivals, null, 2));
      
      // Also save a sample for the UI
      const resultsPath = path.join(dataDir, `results-${new Date().toISOString().replace(/:/g, '-')}.json`);
      fs.writeFileSync(resultsPath, JSON.stringify({
        success: true,
        timestamp: new Date().toISOString(),
        festivalCount: result.festivals.length,
        pages: result.metrics.pages,
        timeElapsed: result.metrics.timeElapsed,
        metrics: result.metrics,
        festivals: result.festivals.slice(0, 100) // Include up to 100 festivals for UI display
      }, null, 2));
      
      console.log(`\nStatus file saved to: ${statusPath}`);
      console.log(`Results file saved to: ${resultsPath}`);
      console.log(`Full data saved to: ${fullDataPath}`);
    }
  } catch (error) {
    console.error('Scraper failed:', error);
    
    // Save error status
    const statusPath = path.join(dataDir, 'latest-status.json');
    fs.writeFileSync(statusPath, JSON.stringify({
      success: false,
      inProgress: false,
      timestamp: new Date().toISOString(),
      lastRun: new Date().toISOString(),
      error: error.message || 'Unknown error during scraping'
    }));
    
    process.exit(1);
  }
}

main(); 