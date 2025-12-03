/**
 * Script to run the FestivalInfo scraper
 * Usage: node scripts/run-festivalinfo-scraper.js [--docker]
 */

const { execSync } = require('child_process');
const path = require('path');

// Parse command line arguments
const args = process.argv.slice(2);
const useDocker = args.includes('--docker');

console.log('Starting FestivalInfo scraper...');
console.log(`Mode: ${useDocker ? 'Docker' : 'Local'}`);

try {
  if (useDocker) {
    // Run in Docker container
    execSync('docker-compose build festivalinfo-scraper', { 
      stdio: 'inherit',
      cwd: path.resolve(__dirname, '..')
    });
    
    execSync('docker-compose run --rm festivalinfo-scraper', { 
      stdio: 'inherit',
      cwd: path.resolve(__dirname, '..')
    });
  } else {
    // Run locally
    execSync('node scrapers/festivalinfo/index.js', {
      stdio: 'inherit',
      cwd: path.resolve(__dirname, '..')
    });
  }
  
  console.log('FestivalInfo scraper completed successfully');
} catch (error) {
  console.error('Error running FestivalInfo scraper:', error.message);
  process.exit(1);
} 