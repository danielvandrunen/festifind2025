#!/usr/bin/env node

import scrapeBefesti from '../scrapers/befesti/index.js';

/**
 * Run the Befesti scraper
 */
async function main() {
  console.log('Starting Befesti scraper...');
  
  try {
    const festivals = await scrapeBefesti();
    console.log(`Successfully scraped ${festivals.length} festivals from Befesti`);
    console.log('-----------------------------------');
    console.log('Sample festivals:');
    // Display first 3 festivals as example
    festivals.slice(0, 3).forEach((festival, index) => {
      console.log(`\nFestival ${index + 1}:`);
      console.log(`Name: ${festival.name}`);
      console.log(`Dates: ${festival.startDate} to ${festival.endDate || festival.startDate}`);
      console.log(`Location: ${festival.location}`);
      console.log(`Detail URL: ${festival.detailUrl}`);
    });
  } catch (error) {
    console.error(`Error running Befesti scraper: ${error.message}`);
    process.exit(1);
  }
}

// Run the main function
main(); 