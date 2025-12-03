# FollowTheBeat Scraper Implementation Guide

## Overview

This guide provides specific implementation instructions for scraping festival data from [FollowTheBeat](https://followthebeat.nl/agenda/). FollowTheBeat has a simple pagination structure with approximately 30 pages of festivals.

## Website Structure Analysis

### Main Page Structure
- URL: `https://followthebeat.nl/agenda/`
- Page format: Paginated list with festivals
- Pagination: Simple pagination via `/page/{number}/` structure
  - Example: `https://followthebeat.nl/agenda/page/2/`
  - Example: `https://followthebeat.nl/agenda/page/3/`

### Festival Data Elements
Based on the project requirements, the key elements for festivals on FollowTheBeat likely include:

- **Festival Container**: Each festival is contained in a list or grid item
- **Name**: Typically in a heading element
- **Date**: Usually displayed in a standardized format
- **Location**: Often includes venue and city information
- **Detail URL**: Links to the festival detail page for more information

## Implementation Steps

### 1. Basic Setup

```javascript
// scrapers/sources/followthebeat.js
const Browser = require('../core/browser');
const Storage = require('../core/storage');
const Parser = require('../core/parser');
const Logger = require('../core/logger');
const cheerio = require('cheerio');
const fs = require('fs').promises;

class FollowthebeatScraper {
  constructor(options = {}) {
    this.browser = new Browser({
      engine: 'puppeteer', // Puppeteer works well for standard websites
      waitTime: 2000
    });
    this.storage = new Storage();
    this.parser = new Parser(options);
    this.logger = new Logger('followthebeat');
    this.source = 'followthebeat';
    this.baseUrl = 'https://followthebeat.nl/agenda/';
    
    // Pagination configuration
    this.maxPages = 30; // Expected number of pages based on requirements
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

module.exports = FollowthebeatScraper;
```

### 2. Multi-Page Scraping

```javascript
// Add to FollowthebeatScraper class
async scrape() {
  try {
    this.logger.log('Starting FollowTheBeat scraper');
    
    // Navigate to first page
    await this.browser.navigate(this.baseUrl);
    
    // Get the first page content
    let content = await this.browser.getContent();
    
    // Save the first page
    await this.storage.saveRawHtml(this.source, 1, content);
    this.logger.log('Saved page 1');
    
    // Try to find the total number of pages
    const $ = cheerio.load(content);
    const paginationElements = $('.pagination a, .page-numbers, .nav-links a');
    
    // Determine max pages from pagination
    let maxPageFound = 1;
    paginationElements.each((i, elem) => {
      const pageText = $(elem).text().trim();
      const pageNum = parseInt(pageText);
      if (!isNaN(pageNum) && pageNum > maxPageFound) {
        maxPageFound = pageNum;
      }
    });
    
    const maxPages = Math.min(this.maxPages, Math.max(30, maxPageFound));
    this.logger.log(`Will scrape ${maxPages} pages`);
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
      
      // Add a delay between pages to avoid triggering anti-scraping measures
      await this.browser.wait(2000 + Math.random() * 1000);
    }
    
    this.logger.log('FollowTheBeat scraping complete');
    return true;
  } catch (error) {
    this.logger.error('Error scraping FollowTheBeat', error);
    return false;
  } finally {
    await this.close();
  }
}
```

### 3. Parsing Festival Data

```javascript
// Add to FollowthebeatScraper class
async parse() {
  try {
    this.logger.log('Starting to parse FollowTheBeat data');
    
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
    this.logger.error('Error parsing FollowTheBeat data', error);
    return [];
  }
}

parseFestivalsFromPage(html, pageNum) {
  const $ = cheerio.load(html);
  const festivals = [];
  
  // Find all festival containers
  // Note: The selectors below are placeholders and need to be updated based on the actual website structure
  $('.event-item, .festival-item, article.event, .agenda-item').each((i, element) => {
    try {
      // Extract festival name
      const nameElement = $(element).find('h2, h3, .event-title, .title');
      const name = nameElement.first().text().trim();
      
      // Extract festival date
      const dateElement = $(element).find('.date, .event-date, time');
      const dateText = dateElement.first().text().trim();
      
      // Extract festival location
      const locationElement = $(element).find('.location, .venue, .place');
      const location = locationElement.first().text().trim();
      
      // Extract detail URL
      const linkElement = $(element).find('a');
      const detailUrl = linkElement.attr('href');
      
      // Basic festival object
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
// Add to FollowthebeatScraper class
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
    const dateElements = $('.event-date, .date-info, .festival-date, time');
    
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
        // Parse the date information
        const dateInfo = await this.parser.parseDateRange(bestDateText);
        
        // Only update if we got valid date information
        if (dateInfo.start_date) {
          festival.start_date = dateInfo.start_date;
          festival.end_date = dateInfo.end_date || festival.start_date;
          festival.duration = dateInfo.duration || "1 day";
        }
      }
    }
    
    // Look for more detailed location information
    const locationElements = $('.location-info, .venue-details, .event-location');
    
    if (locationElements.length) {
      let bestLocationText = '';
      
      // Try to find the most complete location information
      locationElements.each((i, elem) => {
        const locationText = $(elem).text().trim();
        // Prefer longer location strings as they typically contain more details
        if (locationText.length > bestLocationText.length) {
          bestLocationText = locationText;
        }
      });
      
      if (bestLocationText && bestLocationText.length > festival.location.length) {
        festival.location = bestLocationText;
      }
    }
    
    // Extract any additional useful information
    const additionalInfo = $('.event-details, .additional-info, .festival-info');
    if (additionalInfo.length) {
      festival.additional_info = additionalInfo.first().text().trim();
    }
  } catch (error) {
    this.logger.error(`Error extracting detailed info for ${festival.name}`, error);
  }
}
```

### 5. Handling FollowTheBeat-Specific Challenges

```javascript
// Add to FollowthebeatScraper class
async handleFilters() {
  // Some festival sites have filters that need to be adjusted
  try {
    // Check if there are any filter controls
    const hasFilters = await this.browser.page.evaluate(() => {
      return document.querySelector('.filters, .filter-controls, .filter-options') !== null;
    });
    
    if (hasFilters) {
      this.logger.log('Filters detected, attempting to set optimal filter settings');
      
      // Open filter options if they're in a dropdown
      const filterToggle = await this.browser.page.$('.filter-toggle, .show-filters');
      if (filterToggle) {
        await filterToggle.click();
        await this.browser.wait(1000);
      }
      
      // Look for filter dropdowns that might restrict the date range
      const dateFilters = await this.browser.page.$$('select[name*="date"], select[name*="month"], select[name*="year"]');
      
      for (const filter of dateFilters) {
        // Try to select the option that shows all future events
        await this.browser.page.evaluate((element) => {
          // Find the "all" or furthest future option
          const options = element.querySelectorAll('option');
          let targetOption = null;
          
          // Look for "all" option first
          for (const option of options) {
            if (option.textContent.toLowerCase().includes('all') || 
                option.textContent.toLowerCase().includes('alle')) {
              targetOption = option;
              break;
            }
          }
          
          // If no "all" option, select the last option (usually the furthest in the future)
          if (!targetOption && options.length > 0) {
            targetOption = options[options.length - 1];
          }
          
          // Select the target option
          if (targetOption) {
            element.value = targetOption.value;
            
            // Trigger change event
            const event = new Event('change', { bubbles: true });
            element.dispatchEvent(event);
          }
        }, filter);
        
        await this.browser.wait(500);
      }
      
      // Submit the filter form if needed
      const applyButton = await this.browser.page.$('button[type="submit"], .apply-filters, .filter-submit');
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
```

## Complete Implementation Example

Putting it all together:

```javascript
// scrapers/sources/followthebeat.js
const Browser = require('../core/browser');
const Storage = require('../core/storage');
const Parser = require('../core/parser');
const Logger = require('../core/logger');
const cheerio = require('cheerio');
const fs = require('fs').promises;

class FollowthebeatScraper {
  constructor(options = {}) {
    this.browser = new Browser({
      engine: 'puppeteer',
      waitTime: 2000
    });
    this.storage = new Storage();
    this.parser = new Parser(options);
    this.logger = new Logger('followthebeat');
    this.source = 'followthebeat';
    this.baseUrl = 'https://followthebeat.nl/agenda/';
    this.maxPages = 30;
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
      this.logger.log('Starting FollowTheBeat scraper');
      
      // Navigate to first page
      await this.browser.navigate(this.baseUrl);
      
      // Handle any filters
      await this.handleFilters();
      
      // Get the first page content
      let content = await this.browser.getContent();
      
      // Save the first page
      await this.storage.saveRawHtml(this.source, 1, content);
      this.logger.log('Saved page 1');
      
      // Try to find the total number of pages
      const $ = cheerio.load(content);
      const paginationElements = $('.pagination a, .page-numbers, .nav-links a');
      
      // Determine max pages from pagination
      let maxPageFound = 1;
      paginationElements.each((i, elem) => {
        const pageText = $(elem).text().trim();
        const pageNum = parseInt(pageText);
        if (!isNaN(pageNum) && pageNum > maxPageFound) {
          maxPageFound = pageNum;
        }
      });
      
      const maxPages = Math.min(this.maxPages, Math.max(30, maxPageFound));
      this.logger.log(`Will scrape ${maxPages} pages`);
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
      
      this.logger.log('FollowTheBeat scraping complete');
      return true;
    } catch (error) {
      this.logger.error('Error scraping FollowTheBeat', error);
      return false;
    } finally {
      await this.close();
    }
  }
  
  async parse() {
    try {
      this.logger.log('Starting to parse FollowTheBeat data');
      
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
      this.logger.error('Error parsing FollowTheBeat data', error);
      return [];
    }
  }

  parseFestivalsFromPage(html, pageNum) {
    const $ = cheerio.load(html);
    const festivals = [];
    
    // Find all festival containers
    // Note: These selectors need to be updated based on actual website structure
    $('.event-item, .festival-item, article.event, .agenda-item').each((i, element) => {
      try {
        // Extract festival name
        const nameElement = $(element).find('h2, h3, .event-title, .title');
        const name = nameElement.first().text().trim();
        
        // Extract festival date
        const dateElement = $(element).find('.date, .event-date, time');
        const dateText = dateElement.first().text().trim();
        
        // Extract festival location
        const locationElement = $(element).find('.location, .venue, .place');
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
      const dateElements = $('.event-date, .date-info, .festival-date, time');
      
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
      
      // Look for more detailed location information
      const locationElements = $('.location-info, .venue-details, .event-location');
      
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
      
      // Extract any additional useful information
      const additionalInfo = $('.event-details, .additional-info, .festival-info');
      if (additionalInfo.length) {
        festival.additional_info = additionalInfo.first().text().trim();
      }
    } catch (error) {
      this.logger.error(`Error extracting detailed info for ${festival.name}`, error);
    }
  }
  
  async handleFilters() {
    try {
      const hasFilters = await this.browser.page.evaluate(() => {
        return document.querySelector('.filters, .