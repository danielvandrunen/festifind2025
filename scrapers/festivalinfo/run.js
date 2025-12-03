/**
 * Enhanced runner script for the FestivalInfo scraper
 * This script provides better configuration and error handling
 */
import { scrapeFestivalInfo } from './index.js';
import path from 'path';
import fs from 'fs';

// Set default scraping options
const maxPages = process.env.FESTIVALINFO_MAX_PAGES ? parseInt(process.env.FESTIVALINFO_MAX_PAGES) : 0;
const delay = process.env.FESTIVALINFO_DELAY ? parseInt(process.env.FESTIVALINFO_DELAY) : 3000;
const detailDelay = process.env.FESTIVALINFO_DETAIL_DELAY ? parseInt(process.env.FESTIVALINFO_DETAIL_DELAY) : 2000;
const extractDetails = process.env.FESTIVALINFO_EXTRACT_DETAILS === 'true';

// Ensure data directory exists
const dataDir = path.join(process.cwd(), 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
  console.log(`Created data directory at ${dataDir}`);
}

// Create festivalinfo subdirectory if it doesn't exist
const festivalinfoDir = path.join(dataDir, 'festivalinfo');
if (!fs.existsSync(festivalinfoDir)) {
  fs.mkdirSync(festivalinfoDir, { recursive: true });
  console.log(`Created festivalinfo subdirectory at ${festivalinfoDir}`);
}

console.log(`Starting FestivalInfo scraper with configuration:
- Max Pages: ${maxPages === 0 ? 'ALL' : maxPages}
- Page Delay: ${delay}ms
- Detail Delay: ${detailDelay}ms
- Extract Detail Pages: ${extractDetails ? 'YES' : 'NO'}
- Output Directory: ${festivalinfoDir}
`);

// Run the scraper with progress logging
async function run() {
  try {
    // Set up progress callback
    const onProgressUpdate = (progress) => {
      const percent = Math.round(progress * 100);
      process.stdout.write(`\rScraping progress: ${percent}% complete`);
    };
    
    // Set up log callback
    const onLogUpdate = (message) => {
      console.log(message);
    };
    
    const result = await scrapeFestivalInfo({
      maxPages,
      delay,
      detailDelay, 
      outputDir: festivalinfoDir,
      extractDetailPages: extractDetails,
      onProgressUpdate,
      onLogUpdate
    });
    
    if (result.success) {
      console.log('\n\nScraping completed successfully!');
      console.log(`Total festivals found: ${result.metrics.totalFestivals}`);
      console.log(`Unique festivals: ${result.metrics.uniqueFestivals}`);
      console.log(`Duplicates: ${result.metrics.duplicates}`);
      console.log(`Total pages scraped: ${result.metrics.pages}`);
      console.log(`Time elapsed: ${result.metrics.timeElapsed}`);
      console.log(`Output file: ${result.outputFile}`);
    } else {
      console.error('\n\nScraping failed:', result.error);
      process.exit(1);
    }
  } catch (error) {
    console.error('\n\nUnexpected error during scraping:', error);
    process.exit(1);
  }
}

// Start the scraper
run(); 