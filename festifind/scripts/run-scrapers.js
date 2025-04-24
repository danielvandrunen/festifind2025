import { scrapeBefesti } from '../scrapers/befesti/index.js';
import fs from 'fs';
import path from 'path';
import { promises as fsPromises } from 'fs';

/**
 * Run all scrapers sequentially
 */
async function runAllScrapers() {
  try {
    console.log('🚀 Starting all scrapers...');
    
    // Ensure the logs directory exists
    const logsDir = path.join(process.cwd(), 'data', 'logs');
    if (!fs.existsSync(logsDir)) {
      await fsPromises.mkdir(logsDir, { recursive: true });
    }
    
    // Run Befesti scraper
    console.log('\n📊 Running Befesti scraper...');
    try {
      const befestiFestivals = await scrapeBefesti();
      console.log(`✅ Befesti scraper completed successfully! Found ${befestiFestivals.length} festivals.`);
    } catch (error) {
      console.error(`❌ Befesti scraper failed: ${error.message}`);
    }
    
    // Add other scrapers here as they are implemented
    
    console.log('\n🏁 All scrapers completed!');
  } catch (error) {
    console.error(`❌ Error running scrapers: ${error.message}`);
  }
}

// Run the scrapers when script is executed directly
runAllScrapers(); 