/**
 * Script to run the enhanced FestivalInfo scraper with better date extraction
 * Usage: node scripts/run-festivalinfo-scraper-enhanced.js [--docker]
 */

import { execSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

// Get current directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Parse command line arguments
const args = process.argv.slice(2);
const useDocker = args.includes('--docker');

console.log('Starting enhanced FestivalInfo scraper with date extraction...');

// Set environment variables for enhanced scraping
process.env.FESTIVALINFO_EXTRACT_DETAILS = 'true';  // Enable detail page scraping
process.env.FESTIVALINFO_MAX_PAGES = '0';           // Scrape all pages (0 = all)
process.env.FESTIVALINFO_DELAY = '2000';            // 2 seconds between page requests
process.env.FESTIVALINFO_DETAIL_DELAY = '1500';     // 1.5 seconds between detail page requests

try {
  if (useDocker) {
    // Run in Docker container
    console.log('Building Docker image for festivalinfo-scraper...');
    execSync('docker-compose build festivalinfo-scraper', { 
      stdio: 'inherit',
      cwd: path.resolve(__dirname, '..')
    });
    
    console.log('Running scraper in Docker container...');
    execSync('docker-compose run --rm -e FESTIVALINFO_EXTRACT_DETAILS=true festivalinfo-scraper', { 
      stdio: 'inherit',
      cwd: path.resolve(__dirname, '..')
    });
  } else {
    // Run locally with Node
    console.log('Running scraper locally...');
    execSync('node scrapers/festivalinfo/run.js', {
      stdio: 'inherit',
      cwd: path.resolve(__dirname, '..'),
      env: {
        ...process.env,
        FESTIVALINFO_EXTRACT_DETAILS: 'true'
      }
    });
  }
  
  console.log('Enhanced FestivalInfo scraper completed successfully');
} catch (error) {
  console.error('Error running enhanced FestivalInfo scraper:', error.message);
  process.exit(1);
} 