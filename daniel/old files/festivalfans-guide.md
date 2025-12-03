# Festivalfans Scraper Implementation Guide

## Overview

This guide provides specific implementation instructions for scraping festival data from [Festivalfans](https://festivalfans.nl/agenda/). The Festivalfans website has a straightforward structure with pagination and clear festival listings.

## Website Structure Analysis

### Main Page Structure
- URL: `https://festivalfans.nl/agenda/`
- Page format: Paginated list with festivals
- Pagination: Simple next page navigation

### Festival Data Elements
From analyzing the website, the key elements for festivals on Festivalfans include:

- **Festival Container**: Each festival is typically in a card or list item element
- **Name**: Usually in a heading element or prominent text
- **Date**: Typically displayed in a standardized format
- **Location**: Often displayed with the city and venue
- **Detail URL**: Links to the festival detail page

## Implementation Steps

### 1. Basic Setup

```javascript
// scrapers/sources/festivalfans.js
const Browser = require('../core/browser');
const Storage = require('../core/storage');
const Parser = require('../core/parser');
const Logger = require('../core/logger');
const cheerio = require('cheerio');
const fs = require('fs').promises;

class FestivalfansScraper {
  constructor(options = {}) {
    this.browser = new Browser({
      engine: 'puppeteer', // Puppeteer works well for standard websites
      waitTime: 2000
    });
    this.storage = new Storage();
    this.parser = new Parser(options);
    this.logger = new Logger('festivalfans');
    this.source = 'festivalfans';
    this.baseUrl = 'https://festivalfans.nl/agenda/';
    
    // Pagination configuration
    this.maxPages = 20; // Estimated number of pages, will adjust dynamically
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

module.exports = FestivalfansScraper;
```

### 2. Multi-Page Scraping

```javascript
// Add to FestivalfansScraper class
async scrape() {
  try {
    this.logger.log('Starting Festivalfans scraper');
    
    // Navigate to first page
    await this.browser.navigate(this.baseUrl);
    
    // Get the page content
    let content = await this.browser.getContent();
    
    // Save the first page
    await this.storage.saveRawHtml(this.source, 1, content);
    this.logger.log('Saved page 1');
    
    // Try to find total number of pages
    const $ = cheerio.load(content);
    const paginationElements = $('.pagination a, .nav-links a, a.page-numbers');
    
    // Determine max pages from pagination
    let maxPageFound = 1;
    paginationElements.each((i, elem) => {
      const pageText = $(elem).text().trim();
      const pageNum = parseInt(pageText);
      if (!isNaN(pageNum) && pageNum > maxPageFound) {
        maxPageFound = pageNum;
      }
    });
    
    const maxPages = Math.max(this.maxPages, maxPageFound);
    this.logger.log(`Detected ${maxPages} pages to scrape`);
    this.logger.setTotal(maxPages);
    
    // Process remaining pages
    for (let page = 2; page <= maxPages; page++) {
      const nextPageUrl = `${this.baseUrl}page/${page}/`;
      this.logger.log(`Navigating to page ${page}: ${nextPageUrl}`);
      
      await this.browser.navigate(nextPageUrl);
      
      // Wait for page to load
      await this.browser.wait(2000);
      
      // Check if the page exists
      const pageExists = await this.browser.page.evaluate(() => {
        return !document.body.textContent.includes('Page not found') && 
               !document.body.textContent.includes('404');
      });
      
      if (!pageExists) {
        this.logger.log(`Page ${page} does not exist. Stopping pagination.`);
        break;
      }
      
      // Get the page content
      content = await this.browser.getContent();
      
      // Save the page content
      await this.storage.saveRawHtml(this.source, page, content);
      this.logger.log(`Saved page ${page}`);
      this.logger.increment(true);
      
      // Add a delay between pages
      await this.browser.wait(2000 + Math.random() * 1000);
    }
    
    this.logger.log('Festivalfans scraping complete');
    return true;
  } catch (error) {
    this.logger.error('Error scraping Festivalfans', error);
    return false;
  } finally {
    await this.close();
  }
}
```

### 3. Parsing Festival Data

```javascript
// Add to FestivalfansScraper class
async parse() {
  try {
    this.logger.log('Starting to parse Festivalfans data');
    
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
    
    // Fetch detail pages for complete information
    await this.fetchDetailPages(festivals);
    
    // Update processed data with detail info
    await this.storage.saveProcessedData(this.source, festivals);
    this.logger.log('Updated processed data with detail page information');
    
    return festivals;
  } catch (error) {
    this.logger.error('Error parsing Festivalfans data', error);
    return [];
  }
}

parseFestivalsFromPage(html, pageNum) {
  const $ = cheerio.load(html);
  const festivals = [];
  
  // Find all festival containers
  // Note: Adjust these selectors based on actual website structure
  $('.festival-item, .event-item, article.event, .agenda-item').each((i, element) => {
    try {
      // Extract festival name
      const nameElement = $(element).find('h2, h3, .event-title, .festival-title');
      const name = nameElement.first().text().trim();
      
      // Extract festival date
      const dateElement = $(element).find('.event-date, .date, .festival-date, time');
      const dateText = dateElement.first().text().trim();
      
      // Extract festival location
      const locationElement = $(element).find('.location, .venue, .festival-location, .event-venue');
      const location = locationElement.first().text().trim();
      
      // Extract detail URL
      const linkElement = $(element).find('a');
      const detailUrl = linkElement.attr('href');
      
      // Create basic festival object
      const festival = {
        name,
        location,
        detail_url: detailUrl,
        source: this.source,
        page: pageNum
      };
      
      // Try to parse date from list view
      if (dateText) {
        const dateInfo = this.parser.parseDateRange(dateText);
        festival.start_date = dateInfo.start_date;
        festival.end_date = dateInfo.end_date || dateInfo.start_date;
        festival.duration = dateInfo.duration || "1 day";
      }
      
      festivals.push(festival);
    } catch (error) {
      this.logger.error(`Error parsing festival at index ${i} on page ${pageNum}`, error);
    }
  });
  
  return festivals;
}
```

### 4. Fetching Detail Pages

```javascript
// Add to FestivalfansScraper class
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
        
        // Extract additional information from detail page
        await this.extractDetailedInfo($, festival);
        
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

async extractDetailedInfo($, festival) {
  try {
    // Look for more precise date information on the detail page
    const dateElements = $('.event-date, .date-display, .festival-date, time, .date');
    
    if (dateElements.length) {
      let bestDateText = '';
      
      // Try to find the most complete date information
      dateElements.each((i, elem) => {
        const dateText = $(elem).text().trim();
        // Prefer longer date strings as they typically contain more information
        if (dateText.length > bestDateText.length) {
          bestDateText = dateText;
        }
      });
      
      if (bestDateText) {
        // Parse the better date information
        const dateInfo = await this.parser.parseDateRange(bestDateText);
        
        // Only update if we got valid date information
        if (dateInfo.start_date) {
          festival.start_date = dateInfo.start_date;
          festival.end_date = dateInfo.end_date || festival.start_date;
          festival.duration = dateInfo.duration || "1 day";
        }
      }
    }
    
    // Look for more precise location information
    const locationElements = $('.location, .venue-details, .festival-venue, .event-location');
    
    if (locationElements.length) {
      let bestLocationText = '';
      
      // Try to find the most complete location information
      locationElements.each((i, elem) => {
        const locationText = $(elem).text().trim();
        // Prefer longer location strings as they typically contain more detail
        if (locationText.length > bestLocationText.length) {
          bestLocationText = locationText;
        }
      });
      
      if (bestLocationText && bestLocationText.length > festival.location.length) {
        festival.location = bestLocationText;
      }
    }
    
    // Extract any additional useful information
    // For example: ticket prices, lineup, etc.
    const ticketInfoElement = $('.ticket-info, .pricing, .ticket-price');
    if (ticketInfoElement.length) {
      festival.ticket_info = ticketInfoElement.first().text().trim();
    }
  } catch (error) {
    this.logger.error(`Error extracting detailed info for ${festival.name}`, error);
  }
}
```

### 5. Handling Festivalfans-Specific Challenges

```javascript
// Add to FestivalfansScraper class
async handleFilters() {
  // Some sites have filters that need to be adjusted for complete results
  try {
    // Check if there are any filter dropdowns or buttons
    const hasFilters = await this.browser.page.evaluate(() => {
      return document.querySelector('.filter, .filters, .filter-options, #filter-button') !== null;
    });
    
    if (hasFilters) {
      this.logger.log('Filters detected, attempting to set optimal filter settings');
      
      // Click to open filter options
      await this.browser.clickElement('.filter-toggle, .filter-button, #show-filters');
      await this.browser.wait(1000);
      
      // Select "All" or "Show all" options where available
      // Note: Selectors must be adjusted based on actual website structure
      const allOptions = await this.browser.page.$$('.filter-option[data-value="all"], .filter-all, .show-all');
      
      for (const option of allOptions) {
        await option.click();
        await this.browser.wait(500);
      }
      
      // Apply filters if there's a separate apply button
      const applyButton = await this.browser.page.$('.apply-filters, #apply-filter, .filter-submit');
      if (applyButton) {
        await applyButton.click();
        await this.browser.wait(2000);
      }
    }
    
    return true;
  } catch (error) {
    this.logger.error('Error handling filters', error);
    return false;
  }
}

async checkForLoadMore() {
  // Check if the page uses "Load More" instead of pagination
  try {
    const hasLoadMore = await this.browser.page.evaluate(() => {
      return document.querySelector('.load-more, #load-more, .more-events, .more-festivals') !== null;
    });
    
    if (hasLoadMore) {
      this.logger.log('Load More button detected, clicking to load all content');
      
      let loadMoreVisible = true;
      let clickCount = 0;
      const maxClicks = 30; // Prevent infinite loop
      
      while (loadMoreVisible && clickCount < maxClicks) {
        await this.browser.clickElement('.load-more, #load-more, .more-events, .more-festivals');
        clickCount++;
        
        await this.browser.wait(2000 + Math.random() * 1000);
        
        loadMoreVisible = await this.browser.page.evaluate(() => {
          const button = document.querySelector('.load-more, #load-more, .more-events, .more-festivals');
          return button && button.offsetParent !== null && !button.disabled;
        });
      }
      
      this.logger.log(`Clicked "Load More" button ${clickCount} times`);
      
      // Wait for final content to load
      await this.browser.wait(3000);
      
      return true;
    }
    
    return false;
  } catch (error) {
    this.logger.error('Error checking for Load More button', error);
    return false;
  }
}
```

## Complete Implementation Example

Putting it all together:

```javascript
// scrapers/sources/festivalfans.js
const Browser = require('../core/browser');
const Storage = require('../core/storage');
const Parser = require('../core/parser');
const Logger = require('../core/logger');
const cheerio = require('cheerio');
const fs = require('fs').promises;

class FestivalfansScraper {
  constructor(options = {}) {
    this.browser = new Browser({
      engine: 'puppeteer',
      waitTime: 2000
    });
    this.storage = new Storage();
    this.parser = new Parser(options);
    this.logger = new Logger('festivalfans');
    this.source = 'festivalfans';
    this.baseUrl = 'https://festivalfans.nl/agenda/';
    this.maxPages = 20;
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
      this.logger.log('Starting Festivalfans scraper');
      
      // Navigate to first page
      await this.browser.navigate(this.baseUrl);
      
      // Check for and handle any filters
      await this.handleFilters();
      
      // Check if the site uses "Load More" instead of pagination
      const usesLoadMore = await this.checkForLoadMore();
      
      if (!usesLoadMore) {
        // Standard pagination approach
        // Get the first page content
        let content = await this.browser.getContent();
        
        // Save the first page
        await this.storage.saveRawHtml(this.source, 1, content);
        this.logger.log('Saved page 1');
        
        // Determine max pages from pagination
        const $ = cheerio.load(content);
        const paginationElements = $('.pagination a, .nav-links a, a.page-numbers');
        
        let maxPageFound = 1;
        paginationElements.each((i, elem) => {
          const pageText = $(elem).text().trim();
          const pageNum = parseInt(pageText);
          if (!isNaN(pageNum) && pageNum > maxPageFound) {
            maxPageFound = pageNum;
          }
        });
        
        const maxPages = Math.max(this.maxPages, maxPageFound);
        this.logger.log(`Detected ${maxPages} pages to scrape`);
        this.logger.setTotal(maxPages);
        
        // Process remaining pages
        for (let page = 2; page <= maxPages; page++) {
          const nextPageUrl = `${this.baseUrl}page/${page}/`;
          this.logger.log(`Navigating to page ${page}: ${nextPageUrl}`);
          
          await this.browser.navigate(nextPageUrl);
          await this.browser.wait(2000);
          
          // Check if the page exists
          const pageExists = await this.browser.page.evaluate(() => {
            return !document.body.textContent.includes('Page not found') && 
                   !document.body.textContent.includes('404');
          });
          
          if (!pageExists) {
            this.logger.log(`Page ${page} does not exist. Stopping pagination.`);
            break;
          }
          
          // Get the page content
          content = await this.browser.getContent();
          
          // Save the page content
          await this.storage.saveRawHtml(this.source, page, content);
          this.logger.log(`Saved page ${page}`);
          this.logger.increment(true);
          
          // Add a delay between pages
          await this.browser.wait(2000 + Math.random() * 1000);
        }
      } else {
        // For "Load More" approach, we've already loaded all content, save the single page
        const content = await this.browser.getContent();
        await this.storage.saveRawHtml(this.source, 1, content);
        this.logger.log('Saved combined content as page 1');
      }
      
      this.logger.log('Festivalfans scraping complete');
      return true;
    } catch (error) {
      this.logger.error('Error scraping Festivalfans', error);
      return false;
    } finally {
      await this.close();
    }
  }
  
  async parse() {
    try {
      this.logger.log('Starting to parse Festivalfans data');
      
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
      
      // Fetch detail pages for complete information
      await this.fetchDetailPages(festivals);
      
      // Update processed data with detail info
      await this.storage.saveProcessedData(this.source, festivals);
      this.logger.log('Updated processed data with detail page information');
      
      return festivals;
    } catch (error) {
      this.logger.error('Error parsing Festivalfans data', error);
      return [];
    }
  }

  parseFestivalsFromPage(html, pageNum) {
    const $ = cheerio.load(html);
    const festivals = [];
    
    // Find all festival containers
    // Note: These selectors need to be updated based on actual website structure
    $('.festival-item, .event-item, article.event, .agenda-item').each((i, element) => {
      try {
        // Extract festival name
        const nameElement = $(element).find('h2, h3, .event-title, .festival-title');
        const name = nameElement.first().text().trim();
        
        // Extract festival date
        const dateElement = $(element).find('.event-date, .date, .festival-date, time');
        const dateText = dateElement.first().text().trim();
        
        // Extract festival location
        const locationElement = $(element).find('.location, .venue, .festival-location, .event-venue');
        const location = locationElement.first().text().trim();
        
        // Extract detail URL
        const linkElement = $(element).find('a');
        const detailUrl = linkElement.attr('href');
        
        // Create basic festival object
        const festival = {
          name,
          location,
          detail_url: detailUrl,
          source: this.source,
          page: pageNum
        };
        
        // Try to parse date from list view
        if (dateText) {
          const dateInfo = this.parser.parseDateRange(dateText);
          festival.start_date = dateInfo.start_date;
          festival.end_date = dateInfo.end_date || dateInfo.start_date;
          festival.duration = dateInfo.duration || "1 day";
        }
        
        festivals.push(festival);
      } catch (error) {
        this.logger.error(`Error parsing festival at index ${i} on page ${pageNum}`, error);
      }
    });
    
    return festivals;
  }
  
  async fetchDetailPages(festivals) {
    await this.browser.launch();
    
    this.logger.log(`Fetching detail pages for ${festivals.length} festivals`);
    this.logger.setTotal(festivals.length);
    
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
          await this.browser.wait(2000);
          
          const detailContent = await this.browser.getContent();
          const $ = cheerio.load(detailContent);
          
          await this.extractDetailedInfo($, festival);
          
          this.logger.increment(true);
          
          await this.browser.wait(3000 + Math.random() * 2000);
        } catch (error) {
          this.logger.error(`Error fetching detail page for ${festival.name}`, error);
          this.logger.increment(false);
        }
      }
      
      this.logger.log(`Completed batch ${batchNum + 1}/${totalBatches}. Pausing before next batch.`);
      await this.browser.wait(10000 + Math.random() * 5000);
    }
    
    await this.close();
  }

  async extractDetailedInfo($, festival) {
    try {
      // Look for more precise date information on the detail page
      const dateElements = $('.event-date, .date-display, .festival-date, time, .date');
      
      if (dateElements.length) {
        let bestDateText = '';
        
        dateElements.each((i, elem) => {
          const dateText = $(elem).text().trim();
          if (dateText.length > bestDateText.length) {
            bestDateText = dateText;
          }
        });
        
        if (bestDateText) {
          const dateInfo = await this.parser.parseDateRange(bestDateText);
          
          if (dateInfo.start_date) {
            festival.start_date = dateInfo.start_date;
            festival.end_date = dateInfo.end_date || festival.start_date;
            festival.duration = dateInfo.duration || "1 day";
          }
        }
      }
      
      // Look for more precise location information
      const locationElements = $('.location, .venue-details, .festival-venue, .event-location');
      
      if (locationElements.length) {
        let bestLocationText = '';
        
        locationElements.each((i, elem) => {
          const locationText = $(elem).text().trim();
          if (locationText.length > bestLocationText.length) {
            bestLocationText = locationText;
          }
        });
        
        if (bestLocationText && bestLocationText.length > festival.location.length) {
          festival.location = bestLocationText;
        }
      }
      
      // Extract additional useful information
      const ticketInfoElement = $('.ticket-info, .pricing, .ticket-price');
      if (ticketInfoElement.length) {
        festival.ticket_info = ticketInfoElement.first().text().trim();
      }
    } catch (error) {
      this.logger.error(`Error extracting detailed info for ${festival.name}`, error);
    }
  }
  
  async handleFilters() {
    try {
      const hasFilters = await this.browser.page.evaluate(() => {
        return document.querySelector('.filter, .filters, .filter-options, #filter-button') !== null;
      });
      
      if (hasFilters) {
        this.logger.log('Filters detected, attempting to set optimal filter settings');
        
        await this.browser.clickElement('.filter-toggle, .filter-button, #show-filters');
        await this.browser.wait(1000);
        
        const allOptions = await this.browser.page.$$('.filter-option[data-value="all"], .filter-all, .show-all');
        
        for (const option of allOptions) {
          await option.click();
          await this.browser.wait(500);
        }
        
        const applyButton = await this.browser.page.$('.apply-filters, #apply-filter, .filter-submit');
        if (applyButton) {
          await applyButton.click();
          await this.browser.wait(2000);
        }
      }
      
      return true;
    } catch (error) {
      this.logger.error('Error handling filters', error);
      return false;
    }
  }

  async checkForLoadMore() {
    try {
      const hasLoadMore = await this.browser.page.evaluate(() => {
        return document.querySelector('.load-more, #load-more, .more-events, .more-festivals') !== null;
      });
      
      if (hasLoadMore) {
        this.logger.log('Load More button detected, clicking to load all content');
        
        let loadMoreVisible = true;
        let clickCount = 0;
        const maxClicks = 30;
        
        while (loadMoreVisible && clickCount < maxClicks) {
          await this.browser.clickElement('.load-more, #load-more, .more-events, .more-festivals');
          clickCount++;
          
          await this.browser.wait(2000 + Math.random() * 1000);
          
          loadMoreVisible = await this.browser.page.evaluate(() => {
            const button = document.querySelector('.load-more, #load-more, .more-events, .more-festivals');
            return button && button.offsetParent !== null && !button.disabled;
          });
        }
        
        this.logger.log(`Clicked "Load More" button ${clickCount} times`);
        await this.browser.wait(3000);
        
        return true;
      }
      
      return false;
    } catch (error) {
      this.logger.error('Error checking for Load More button', error);
      return false;
    }
  }
}

module.exports = FestivalfansScraper;
```

## Usage Instructions

To use the Festivalfans scraper:

1. **Installation**:
   ```bash
   npm install cheerio puppeteer
   ```

2. **Configuration**:
   Update selectors in the constructor based on actual website structure.

3. **Run the Scraper**:
   ```javascript
   const FestivalfansScraper = require('./scrapers/sources/festivalfans');
   
   async function run() {
     const scraper = new FestivalfansScraper();
     
     try {
       await scraper.init();
       
       // Step 1: Scrape all pages
       const scrapeSuccess = await scraper.scrape();
       if (!scrapeSuccess) {
         console.error('Failed to scrape Festivalfans');
         return;
       }
       
       // Step 2: Parse the data
       const festivals = await scraper.parse();
       console.log(`Processed ${festivals.length} festivals`);
       
       // Step 3: Upload to database (implement separately)
     } catch (error) {
       console.error('Error running Festivalfans scraper:', error);
     }
   }
   
   run();
   ```

## Troubleshooting

### Common Issues:

1. **Selector Mismatches**:
   - If no festivals are being found, the selectors may need adjustment
   - Inspect the website structure and update selectors accordingly
   - Add more alternative selectors to increase robustness

2. **Date Format Challenges**:
   - Dutch date formats may require special handling
   - Use AI parsing for complex date formats
   - Implement fallback parsing for common date patterns

3. **Pagination Issues**:
   - If page detection isn't working, the URL structure may have changed
   - Check if the site uses different pagination methods (AJAX, Load More)
   - Test pagination URLs manually to verify the pattern

4. **Empty or Missing Data**:
   - If certain fields are consistently missing, check if they're in different locations
   - Look for JavaScript-rendered content that might not be immediately accessible
   - Consider implementing more sophisticated extraction logic

## Maintenance

To keep your Festivalfans scraper running smoothly:

1. **Regular Structure Checks**:
   - Check the website monthly for design or structure changes
   - Update selectors as needed based on HTML changes
   - Verify pagination still works as expected

2. **Data Quality Monitoring**:
   - Set up alerts for unusually low festival counts
   - Regularly validate date formats and location information
   - Compare extraction results against manual checks

3. **Performance Optimization**:
   - Monitor scraping times and adjust batch sizes if needed
   - Balance speed against anti-scraping measures
   - Consider implementing caching for frequently accessed pages

## Data Validation Tips

Ensure high-quality data from Festivalfans with these validation strategies:

1. **Date Validation**:
   - Make sure all dates are properly formatted as ISO strings
   - Check that start dates precede end dates for multi-day events
   - Verify dates fall within the expected range (current through December 2025)

2. **Name and Location Consistency**:
   - Check for consistent capitalization and formatting
   - Look for and correct common abbreviations
   - Ensure location data includes both venue and city where available

3. **URL Validation**:
   - Verify all detail URLs are absolute (not relative)
   - Test a sample of URLs to ensure they resolve correctly
   - Check for URL encoding issues in festival names with special characters