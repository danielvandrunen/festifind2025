# Festileaks Scraper Implementation Guide

## Overview

This guide provides specific implementation instructions for scraping festival data from [Festileaks](https://festileaks.com/festivalagenda/). Festileaks has a paginated structure with approximately 25 pages of festival content and specific URL parameters for pagination.

## Website Structure Analysis

### Main Page Structure
- URL: `https://festileaks.com/festivalagenda/`
- Page format: Paginated list with 20 festivals per page
- Pagination: Complex URL structure with multiple parameters
  ```
  https://festileaks.com/festivalagenda/?event_title=&event_startdate=2025-04-13&event_enddate=2026-04-13&country_id=0&city_id=0&terrain_id=0&artists=&genres=&label_slug=&ticketprice_min=0&ticketprice_max=2650&cap_min=0&cap_max=1400000&weekender=true&soldout=true&cancelled=true&organizer=0&pg=2
  ```

### Festival Data Elements
- **Container**: Each festival is in a `<div class="festivals-list-item">` element
- **Name**: Located within a span with class `festival-title`
  ```html
  <span class="festival-title">Ra:dius Festival</span>
  ```
- **Date**: Located within a span with class `festival-date`
  ```html
  <span class="festival-date">26 april 2025</span>
  ```
- **Location**: Located within a span with class `festival-location`
  ```html
  <span class="festival-location"><div class="flag">...</div><span>Maastricht, Nederland</span></span>
  ```
- **Detail URL**: The parent anchor tag contains the URL
  ```html
  <a href="/festival/ra-dius-festival/2025/" title="Bekijk Ra:dius Festival 2025" class="festival-item article">
  ```

## Implementation Steps

### 1. Basic Setup

```javascript
// scrapers/sources/festileaks.js
const Browser = require('../core/browser');
const Storage = require('../core/storage');
const Parser = require('../core/parser');
const Logger = require('../core/logger');
const cheerio = require('cheerio');

class FestileaksScraper {
  constructor(options = {}) {
    this.browser = new Browser({
      engine: 'puppeteer', // Puppeteer works well for Festileaks
      waitTime: 2000
    });
    this.storage = new Storage();
    this.parser = new Parser(options);
    this.logger = new Logger('festileaks');
    this.source = 'festileaks';
    this.baseUrl = 'https://festileaks.com/festivalagenda/';
    
    // Pagination configuration
    this.pagesPerBatch = 5; // Process 5 pages, then rest
    this.batchWaitTime = 10000; // 10 seconds between batches
    this.maxPages = 25; // Approximate number of pages to scrape
  }

  async init() {
    await this.storage.init();
    await this.logger.init();
    await this.browser.launch();
  }
  
  async close() {
    if (this.browser) {
      await this.browser.close();
    }
  }
}

module.exports = FestileaksScraper;
```

### 2. Multi-Page Scraping

```javascript
// Add to FestileaksScraper class
async scrape() {
  try {
    this.logger.log('Starting Festileaks scraper');
    
    // Navigate to first page
    await this.browser.navigate(this.baseUrl);
    
    // Get the current page content
    let content = await this.browser.getContent();
    
    // Save the first page
    await this.storage.saveRawHtml(this.source, 1, content);
    this.logger.log('Saved page 1');
    
    // Determine total number of pages
    const $ = cheerio.load(content);
    const lastPageLink = $('.page-numbers').last().prev();
    const maxPages = lastPageLink.length ? parseInt(lastPageLink.text().trim()) : this.maxPages;
    
    this.logger.log(`Detected ${maxPages} pages to scrape`);
    this.logger.setTotal(maxPages);
    
    // Process remaining pages in batches
    for (let page = 2; page <= maxPages; page++) {
      const pageUrl = this.getPageUrl(page);
      this.logger.log(`Navigating to page ${page}: ${pageUrl}`);
      
      await this.browser.navigate(pageUrl);
      
      // Allow time for page to load
      await this.browser.wait(2000);
      
      // Get the page content
      content = await this.browser.getContent();
      
      // Save the page content
      await this.storage.saveRawHtml(this.source, page, content);
      this.logger.log(`Saved page ${page}`);
      this.logger.increment(true);
      
      // Add a delay between pages to avoid triggering anti-scraping measures
      if (page % this.pagesPerBatch === 0 && page < maxPages) {
        this.logger.log(`Completed batch of ${this.pagesPerBatch} pages. Pausing before next batch.`);
        await this.browser.wait(this.batchWaitTime + Math.random() * 5000);
      } else {
        await this.browser.wait(2000 + Math.random() * 1000);
      }
   
   run();
   ```

## Troubleshooting

### Common Issues:

1. **Pagination Problems**:
   - If pagination URLs change, update the `getPageUrl` method
   - Check if the website has updated their filtering parameters
   - Verify the maximum number of pages is still accurate

2. **Dynamic Content Loading**:
   - Increase wait times if content isn't fully loading
   - Check if selectors have changed if elements aren't found
   - Consider implementing scroll actions to trigger lazy loading

3. **Date Parsing Issues**:
   - Dutch date formats may need special handling
   - Watch for special characters or formatting in date strings
   - Use the OpenAI parser for complex date formats

4. **Missing Festivals**:
   - Check if filters are correctly applied (may need to adjust URL parameters)
   - Verify that all containers are being properly selected
   - Look for pagination changes or new content containers

## Maintenance

Keep your Festileaks scraper running smoothly by:

1. Checking the website monthly for structure changes
2. Comparing the number of festivals found against expected totals
3. Validating dates to ensure they remain in the expected formats
4. Updating URL parameters if the filtering system changes

## Data Validation Tips

To ensure high-quality data from Festileaks:

1. **Date Validation**:
   - Verify all festivals have dates in the future
   - Check for reasonable date ranges (no festivals lasting months)
   - Look for consistent date formats across all entries

2. **Name Validation**:
   - Check for duplicate festival names within similar date ranges
   - Verify names don't contain HTML or special characters
   - Ensure names aren't truncated or cut off

3. **Location Validation**:
   - Check that locations follow expected formats (City, Country)
   - Verify no missing location data
   - Look for consistent formatting across entries }
    
    this.logger.log('Festileaks scraping complete');
    return true;
  } catch (error) {
    this.logger.error('Error scraping Festileaks', error);
    return false;
  } finally {
    await this.close();
  }
}

// Helper method to generate page URLs
getPageUrl(page) {
  // Base pattern from page 2 URL
  const basePattern = 'https://festileaks.com/festivalagenda/?event_title=&event_startdate={year}-{month}-{day}&event_enddate={next_year}-{month}-{day}&country_id=0&city_id=0&terrain_id=0&artists=&genres=&label_slug=&ticketprice_min=0&ticketprice_max=2650&cap_min=0&cap_max=1400000&weekender=true&soldout=true&cancelled=true&organizer=0&pg={page}';
  
  // Get current date for the startdate parameter
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const nextYear = year + 1;
  
  // Replace template values
  return basePattern
    .replace('{year}', year)
    .replace('{next_year}', nextYear)
    .replace('{month}', month)
    .replace('{day}', day)
    .replace('{page}', page);
}
```

### 3. Parsing Festival Data

```javascript
// Add to FestileaksScraper class
async parse() {
  try {
    this.logger.log('Starting to parse Festileaks data');
    
    // Get a list of all raw HTML files
    const files = await this.storage.getAllRawHtmlFiles(this.source);
    this.logger.log(`Found ${files.length} HTML files to parse`);
    
    const festivals = [];
    
    // Process each HTML file
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const pageNum = i + 1;
      
      this.logger.log(`Parsing page ${pageNum}`);
      
      // Read the HTML content
      const html = await fs.readFile(file, 'utf8');
      
      // Parse the festivals from this page
      const pageFestivals = this.parseFestivalsFromPage(html, pageNum);
      
      // Add to main array
      festivals.push(...pageFestivals);
      
      this.logger.log(`Found ${pageFestivals.length} festivals on page ${pageNum}`);
    }
    
    this.logger.log(`Total festivals found: ${festivals.length}`);
    
    // Save the processed data
    await this.storage.saveProcessedData(this.source, festivals);
    this.logger.log('Processed data saved successfully');
    
    // Optionally fetch detail pages if needed
    // await this.fetchDetailPages(festivals);
    
    return festivals;
  } catch (error) {
    this.logger.error('Error parsing Festileaks data', error);
    return [];
  }
}

parseFestivalsFromPage(html, pageNum) {
  const $ = cheerio.load(html);
  const festivals = [];
  
  // Find all festival items
  $('.festivals-list-item').each((i, element) => {
    try {
      // Extract festival name
      const nameElement = $(element).find('.festival-title');
      const name = nameElement.first().text().trim();
      
      // Extract festival date
      const dateElement = $(element).find('.festival-date');
      const dateText = dateElement.first().text().trim();
      
      // Extract festival location
      const locationElement = $(element).find('.festival-location span');
      const location = locationElement.last().text().trim();
      
      // Extract detail URL
      const linkElement = $(element).find('a.festival-item');
      const detailPath = linkElement.attr('href');
      const detailUrl = detailPath ? `https://festileaks.com${detailPath}` : null;
      
      // Parse date information
      const dateInfo = this.parser.parseDateRange(dateText);
      
      // Add the festival to our list
      festivals.push({
        name,
        start_date: dateInfo.start_date,
        end_date: dateInfo.end_date || dateInfo.start_date,
        duration: dateInfo.duration || "1 day",
        location,
        detail_url: detailUrl,
        source: this.source,
        page: pageNum
      });
    } catch (error) {
      this.logger.error(`Error parsing festival item on page ${pageNum}`, error);
    }
  });
  
  return festivals;
}
```

### 4. Fetching Detail Pages (Optional)

```javascript
// Add to FestileaksScraper class
async fetchDetailPages(festivals) {
  // Relaunch the browser since we closed it after scraping
  await this.browser.launch();
  
  this.logger.log(`Fetching detail pages for ${festivals.length} festivals`);
  this.logger.setTotal(festivals.length);
  
  // Process in smaller batches to avoid overwhelming the site
  const batchSize = 5;
  const totalBatches = Math.ceil(festivals.length / batchSize);
  
  for (let batchNum = 0; batchNum < totalBatches; batchNum++) {
    const startIdx = batchNum * batchSize;
    const endIdx = Math.min(startIdx + batchSize, festivals.length);
    const batch = festivals.slice(startIdx, endIdx);
    
    this.logger.log(`Processing batch ${batchNum + 1}/${totalBatches} (festivals ${startIdx + 1}-${endIdx})`);
    
    for (let i = 0; i < batch.length; i++) {
      const festival = batch[i];
      this.logger.log(`Fetching detail page for: ${festival.name}`);
      
      try {
        if (!festival.detail_url) {
          this.logger.error(`No detail URL for festival: ${festival.name}`, new Error('Missing URL'));
          this.logger.increment(false);
          continue;
        }
        
        await this.browser.navigate(festival.detail_url);
        await this.browser.wait(2000); // Wait for page to load
        
        const detailContent = await this.browser.getContent();
        const $ = cheerio.load(detailContent);
        
        // On Festileaks, most important info is already on list page,
        // but we could extract additional details here if needed
        // For example: ticket prices, lineup, etc.
        
        this.logger.increment(true);
        
        // Add a delay to avoid being blocked
        await this.browser.wait(3000 + Math.random() * 2000);
      } catch (error) {
        this.logger.error(`Error fetching detail page for ${festival.name}`, error);
        this.logger.increment(false);
      }
    }
    
    // Add a longer pause between batches
    this.logger.log(`Completed batch ${batchNum + 1}/${totalBatches}. Pausing before next batch.`);
    await this.browser.wait(10000 + Math.random() * 5000);
  }
  
  // Close the browser
  await this.close();
}
```

### 5. Handling Festileaks-Specific Challenges

```javascript
// Add to FestileaksScraper class
async handleDynamicContent() {
  // Festileaks may have dynamic content that needs time to load
  try {
    // Wait for the festival list to appear
    await this.browser.page.waitForSelector('.festivals-list-item', { timeout: 10000 });
    
    // Wait a bit longer to ensure all content is loaded
    await this.browser.wait(2000);
    
    return true;
  } catch (error) {
    this.logger.error('Error waiting for dynamic content to load', error);
    return false;
  }
}

async handleFilter() {
  // Festileaks has filters that may need to be adjusted
  try {
    // Click to open filters if they're hidden
    const showFiltersButton = await this.browser.page.$('.toggle-filters');
    if (showFiltersButton) {
      await this.browser.clickElement('.toggle-filters');
      await this.browser.wait(1000);
    }
    
    // Set date range if needed
    // This would be required if the URLs don't maintain the filter state
    
    return true;
  } catch (error) {
    this.logger.error('Error handling filters', error);
    return false;
  }
}
```

## Complete Implementation Example

Putting it all together:

```javascript
// scrapers/sources/festileaks.js
const Browser = require('../core/browser');
const Storage = require('../core/storage');
const Parser = require('../core/parser');
const Logger = require('../core/logger');
const cheerio = require('cheerio');
const fs = require('fs').promises;

class FestileaksScraper {
  constructor(options = {}) {
    this.browser = new Browser({
      engine: 'puppeteer',
      waitTime: 2000
    });
    this.storage = new Storage();
    this.parser = new Parser(options);
    this.logger = new Logger('festileaks');
    this.source = 'festileaks';
    this.baseUrl = 'https://festileaks.com/festivalagenda/';
    
    // Pagination configuration
    this.pagesPerBatch = 5;
    this.batchWaitTime = 10000;
    this.maxPages = 25;
  }

  async init() {
    await this.storage.init();
    await this.logger.init();
    await this.browser.launch();
  }
  
  async close() {
    if (this.browser) {
      await this.browser.close();
    }
  }
  
  async scrape() {
    try {
      this.logger.log('Starting Festileaks scraper');
      
      // Navigate to first page
      await this.browser.navigate(this.baseUrl);
      
      // Handle dynamic content and filters
      await this.handleDynamicContent();
      await this.handleFilter();
      
      // Get the current page content
      let content = await this.browser.getContent();
      
      // Save the first page
      await this.storage.saveRawHtml(this.source, 1, content);
      this.logger.log('Saved page 1');
      
      // Determine total number of pages
      const $ = cheerio.load(content);
      const lastPageLink = $('.page-numbers').last().prev();
      const maxPages = lastPageLink.length ? parseInt(lastPageLink.text().trim()) : this.maxPages;
      
      this.logger.log(`Detected ${maxPages} pages to scrape`);
      this.logger.setTotal(maxPages);
      
      // Process remaining pages in batches
      for (let page = 2; page <= maxPages; page++) {
        const pageUrl = this.getPageUrl(page);
        this.logger.log(`Navigating to page ${page}: ${pageUrl}`);
        
        await this.browser.navigate(pageUrl);
        
        // Handle dynamic content
        await this.handleDynamicContent();
        
        // Get the page content
        content = await this.browser.getContent();
        
        // Save the page content
        await this.storage.saveRawHtml(this.source, page, content);
        this.logger.log(`Saved page ${page}`);
        this.logger.increment(true);
        
        // Add a delay between pages to avoid triggering anti-scraping measures
        if (page % this.pagesPerBatch === 0 && page < maxPages) {
          this.logger.log(`Completed batch of ${this.pagesPerBatch} pages. Pausing before next batch.`);
          await this.browser.wait(this.batchWaitTime + Math.random() * 5000);
        } else {
          await this.browser.wait(2000 + Math.random() * 1000);
        }
      }
      
      this.logger.log('Festileaks scraping complete');
      return true;
    } catch (error) {
      this.logger.error('Error scraping Festileaks', error);
      return false;
    } finally {
      await this.close();
    }
  }

  getPageUrl(page) {
    const basePattern = 'https://festileaks.com/festivalagenda/?event_title=&event_startdate={year}-{month}-{day}&event_enddate={next_year}-{month}-{day}&country_id=0&city_id=0&terrain_id=0&artists=&genres=&label_slug=&ticketprice_min=0&ticketprice_max=2650&cap_min=0&cap_max=1400000&weekender=true&soldout=true&cancelled=true&organizer=0&pg={page}';
    
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const nextYear = year + 1;
    
    return basePattern
      .replace('{year}', year)
      .replace('{next_year}', nextYear)
      .replace('{month}', month)
      .replace('{day}', day)
      .replace('{page}', page);
  }
  
  async parse() {
    try {
      this.logger.log('Starting to parse Festileaks data');
      
      // Get a list of all raw HTML files
      const files = await this.storage.getAllRawHtmlFiles(this.source);
      this.logger.log(`Found ${files.length} HTML files to parse`);
      
      const festivals = [];
      
      // Process each HTML file
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const pageNum = i + 1;
        
        this.logger.log(`Parsing page ${pageNum}`);
        
        // Read the HTML content
        const html = await fs.readFile(file, 'utf8');
        
        // Parse the festivals from this page
        const pageFestivals = this.parseFestivalsFromPage(html, pageNum);
        
        // Add to main array
        festivals.push(...pageFestivals);
        
        this.logger.log(`Found ${pageFestivals.length} festivals on page ${pageNum}`);
      }
      
      this.logger.log(`Total festivals found: ${festivals.length}`);
      
      // Save the processed data
      await this.storage.saveProcessedData(this.source, festivals);
      this.logger.log('Processed data saved successfully');
      
      return festivals;
    } catch (error) {
      this.logger.error('Error parsing Festileaks data', error);
      return [];
    }
  }

  parseFestivalsFromPage(html, pageNum) {
    const $ = cheerio.load(html);
    const festivals = [];
    
    // Find all festival items
    $('.festivals-list-item').each((i, element) => {
      try {
        // Extract festival name
        const nameElement = $(element).find('.festival-title');
        const name = nameElement.first().text().trim();
        
        // Extract festival date
        const dateElement = $(element).find('.festival-date');
        const dateText = dateElement.first().text().trim();
        
        // Extract festival location
        const locationElement = $(element).find('.festival-location span');
        const location = locationElement.last().text().trim();
        
        // Extract detail URL
        const linkElement = $(element).find('a.festival-item');
        const detailPath = linkElement.attr('href');
        const detailUrl = detailPath ? `https://festileaks.com${detailPath}` : null;
        
        // Parse date information
        const dateInfo = this.parser.parseDateRange(dateText);
        
        // Add the festival to our list
        festivals.push({
          name,
          start_date: dateInfo.start_date,
          end_date: dateInfo.end_date || dateInfo.start_date,
          duration: dateInfo.duration || "1 day",
          location,
          detail_url: detailUrl,
          source: this.source,
          page: pageNum
        });
      } catch (error) {
        this.logger.error(`Error parsing festival item on page ${pageNum}`, error);
      }
    });
    
    return festivals;
  }
  
  async handleDynamicContent() {
    try {
      // Wait for the festival list to appear
      await this.browser.page.waitForSelector('.festivals-list-item', { timeout: 10000 });
      
      // Wait a bit longer to ensure all content is loaded
      await this.browser.wait(2000);
      
      return true;
    } catch (error) {
      this.logger.error('Error waiting for dynamic content to load', error);
      return false;
    }
  }

  async handleFilter() {
    try {
      // Click to open filters if they're hidden
      const showFiltersButton = await this.browser.page.$('.toggle-filters');
      if (showFiltersButton) {
        await this.browser.clickElement('.toggle-filters');
        await this.browser.wait(1000);
      }
      
      return true;
    } catch (error) {
      this.logger.error('Error handling filters', error);
      return false;
    }
  }
}

module.exports = FestileaksScraper;
```

## Usage Instructions

To use the Festileaks scraper:

1. **Installation**:
   ```bash
   npm install cheerio puppeteer
   ```

2. **Configuration**:
   Update any settings in the constructor as needed.

3. **Run the Scraper**:
   ```javascript
   const FestileaksScraper = require('./scrapers/sources/festileaks');
   
   async function run() {
     const scraper = new FestileaksScraper();
     
     try {
       await scraper.init();
       
       // Step 1: Scrape all pages
       const scrapeSuccess = await scraper.scrape();
       if (!scrapeSuccess) {
         console.error('Failed to scrape Festileaks');
         return;
       }
       
       // Step 2: Parse the data
       const festivals = await scraper.parse();
       console.log(`Processed ${festivals.length} festivals`);
       
       // Step 3: Upload to database (implement separately)
     } catch (error) {
       console.error('Error running Festileaks scraper:', error);
     }
   }
   