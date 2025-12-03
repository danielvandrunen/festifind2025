/**
 * Test script for improved festivalinfo date scraping
 * This script runs a limited scrape focusing on date extraction
 */

import { scrapeFestivalInfo } from '../scrapers/festivalinfo/index.js';
import path from 'path';
import fs from 'fs';

// Set up test configuration
const config = {
  maxPages: 2, // Only scrape 2 pages for testing
  delay: 1000,  // Shorter delay for testing
  detailDelay: 500,
  outputDir: path.join(process.cwd(), 'data', 'festivalinfo-test'),
  extractDetailPages: true, // Enable extraction of detail pages for better date info
  onProgressUpdate: (progress) => {
    console.log(`Progress: ${Math.round(progress * 100)}%`);
  },
  onLogUpdate: (message) => {
    console.log(message);
  }
};

// Ensure test output directory exists
if (!fs.existsSync(config.outputDir)) {
  fs.mkdirSync(config.outputDir, { recursive: true });
  console.log(`Created test directory at ${config.outputDir}`);
}

console.log('Starting festivalinfo date scraping test...');

async function run() {
  try {
    const result = await scrapeFestivalInfo(config);
    
    if (result.success) {
      console.log('\nTest scrape completed successfully');
      console.log(`Found ${result.metrics.uniqueFestivals} unique festivals`);
      
      // Analyze the date extraction results
      const outputFile = path.join(config.outputDir, result.outputFile);
      const data = JSON.parse(fs.readFileSync(outputFile, 'utf8'));
      
      // Count festivals with date information
      const withStartDate = data.filter(f => f.startDate).length;
      const withEndDate = data.filter(f => f.endDate).length;
      const withDateRange = data.filter(f => f.dateRange).length;
      
      console.log('\nDate extraction statistics:');
      console.log(`Festivals with startDate: ${withStartDate} (${Math.round(withStartDate/data.length*100)}%)`);
      console.log(`Festivals with endDate: ${withEndDate} (${Math.round(withEndDate/data.length*100)}%)`);
      console.log(`Festivals with dateRange: ${withDateRange} (${Math.round(withDateRange/data.length*100)}%)`);
      
      // Print some examples of festivals with dates
      console.log('\nSample festivals with date information:');
      const samplesWithDates = data.filter(f => f.startDate).slice(0, 5);
      
      samplesWithDates.forEach((festival, i) => {
        console.log(`\nFestival ${i+1}: ${festival.name}`);
        console.log(`- StartDate: ${festival.startDate}`);
        console.log(`- EndDate: ${festival.endDate}`);
        console.log(`- Duration: ${festival.duration} days`);
        console.log(`- DateRange: ${JSON.stringify(festival.dateRange)}`);
        console.log(`- URL: ${festival.url}`);
      });
      
      console.log('\nTest output saved to:', outputFile);
    } else {
      console.error('Test scrape failed:', result.error);
    }
  } catch (error) {
    console.error('Error running test:', error);
  }
}

run(); 