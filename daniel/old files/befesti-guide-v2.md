# Befesti Scraper Implementation Guide

## Overview

This guide provides specific implementation instructions for scraping festival data from [Befesti](https://befesti.nl/festivalagenda). Befesti has a unique structure that requires scrolling to load all content and detailed page visits to gather complete festival information.

## Website Structure Analysis

### Main Page Structure
- URL: `https://befesti.nl/festivalagenda`
- Page format: Single page with scrolling to load more content
- Pagination: None, requires scrolling to see all festivals
- Festival elements: Card-like elements containing festival information

### Festival Data Elements
- **Date**: Located in a div with class `agenda--datum--double`
  ```html
  <div class="agenda--datum--double">
    <div data-element="day-start" class="h4 margin--0">11</div>
    <div data-element="day-dash" class="h4 margin--0 is--date-text-hide">-</div>
    <div data-element="day-end" class="h4 margin--0 is--date-text-hide">13</div>
  </div>
  ```

- **Name**: Located in an h3 element with data attribute `data-element="card-title"`
  ```html
  <h3 data-element="card-title" class="h4">REBiRTH Festival</h3>
  ```

- **Location**: Located in a div with class `agenda--chip`
  ```html
  <div class="agenda--chip">
    <div class="text--s">Raamse Akkers</div>
    <div class="text--s">,&nbsp;</div>
    <div class="text--s">Haaren</div>
  </div>
  ```

- **Detail URL**: Format follows `https://befesti.nl/festival/{festival-name}`
  Example: `https://befesti.nl/festival/rebirth-festival`

## Implementation Steps

### 1. Basic Setup

```javascript
// scrapers/sources/befesti.js
const Browser = require('../core/browser');
const Storage = require('../core/storage');
const Parser = require('../core/parser');
const Logger = require('../core/logger');
const cheerio = require('cheerio');

class BefestiScraper {
  constructor(options = {}) {
    this.browser = new Browser({
      engine: 'playwright', // Playwright works better for infinite scrolling
      waitTime: 2000
    });
    this.storage = new Storage();
    this.parser = new Parser(options);
    this.logger = new Logger('befesti');
    this.source = 'befesti';
    this.baseUrl = 'https://befesti.nl/festivalagenda';
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

module.exports = BefestiScraper;
```

### 2. Implementing Infinite Scroll

```javascript
// Add to BefestiScraper class
async scrape() {
  try {
    this.logger.log('Starting Befesti scraper');
    
    // Navigate to festivals page
    await this.browser.navigate(this.baseUrl);
    
    // Scroll to load all festivals
    this.logger.log('Scrolling to load all festivals');
    await this.scrollToLoadAll();
    
    // Get the page content
    const content = await this.browser.getContent();
    
    // Save raw HTML
    await this.storage.saveRawHtml(this.source, 1, content);
    this.logger.log('Raw HTML saved successfully');
    
    return true;
  } catch (error) {
    this.logger.error('Error scraping Befesti', error);
    return false;
  } finally {
    await this.close();
  }
}

async scrollToLoadAll() {
  // Befesti uses infinite scrolling or "load more" functionality
  await this.browser.page.evaluate(async () => {
    const scrollStep = 300; // Scroll 300px at a time
    const scrollDelay = 1000; // Wait 1 second between scrolls
    const endDetectionThreshold = 5; // Stop after 5 scrolls with no height change
    
    let lastHeight = 0;
    let unchangedScrolls = 0;
    
    while (unchangedScrolls < endDetectionThreshold) {
      // Scroll down
      window.scrollBy(0, scrollStep);
      
      // Wait for content to load
      await new Promise(resolve => setTimeout(resolve, scrollDelay));
      
      // Check if page height has changed
      const currentHeight = document.body.scrollHeight;
      if (currentHeight === lastHeight) {
        unchangedScrolls++;
      } else {
        unchangedScrolls = 0;
        lastHeight = currentHeight;
      }
      
      // Add some randomness to scrolling to appear more human-like
      if (Math.random() < 0.3) {
        await new Promise(resolve => setTimeout(resolve, 500 + Math.random() * 1000));
      }
    }
    
    // Scroll to top to ensure all content is in viewable area
    window.scrollTo(0, 0);
  });
  
  // Additional wait to ensure all content is loaded
  await this.browser.wait(3000);
}
```

### 3. Parsing Festival List

```javascript
// Add to BefestiScraper class
async parse() {
  try {
    this.logger.log('Starting to parse Befesti data');
    
    // Get the raw HTML
    const html = await this.storage.getRawHtml(this.source, 1);
    
    // Parse the HTML using cheerio
    const $ = cheerio.load(html);
    
    const festivals = [];
    
    // Find all festival containers
    // This selector may need adjustment based on the actual structure
    const festivalCards = $('[data-element="card-title"]').closest('.w-dyn-item');
    
    this.logger.log(`Found ${festivalCards.length} potential festivals`);
    this.logger.setTotal(festivalCards.length);
    
    // Extract basic festival data
    festivalCards.each((i, element) => {
      try {
        // Extract name
        const nameElement = $(element).find('[data-element="card-title"]');
        const name = nameElement.text().trim();
        
        // Extract date information
        const dateElement = $(element).find('.agenda--datum--double');
        let dateText = '';
        
        if (dateElement.length) {
          const startDay = dateElement.find('[data-element="day-start"]').text().trim();
          const endDay = dateElement.find('[data-element="day-end"]').text().trim();
          
          // We need to find the month - may be in another element
          const monthElement = $(element).find('.agenda--month');
          const month = monthElement.text().trim();
          
          // Combine date parts
          if (endDay && endDay !== startDay) {
            dateText = `${startDay}-${endDay} ${month}`;
          } else {
            dateText = `${startDay} ${month}`;
          }
        }
        
        // Extract location
        const locationElement = $(element).find('.agenda--chip');
        let location = '';
        
        if (locationElement.length) {
          location = locationElement.text().replace(/\s+/g, ' ').trim();
        }
        
        // Extract detail URL
        let detailUrl = '';
        const linkElement = $(element).find('a');
        if (linkElement.length) {
          const href = linkElement.attr('href');
          if (href) {
            detailUrl = href.startsWith('http') ? href : `https://befesti.nl${href}`;
          }
        }
        
        // Create basic festival object
        const festival = {
          name,
          location,
          detail_url: detailUrl,
          source: this.source,
          // We'll need to get full date info from detail page
        };
        
        festivals.push(festival);
        this.logger.increment(true);
      } catch (error) {
        this.logger.error(`Error parsing festival at index ${i}`, error);
        this.logger.increment(false);
      }
    });
    
    this.logger.log(`Extracted basic data for ${festivals.length} festivals`);
    
    // We need to fetch detail pages to get complete date information
    await this.fetchDetailPages(festivals);
    
    // Save processed data
    await this.storage.saveProcessedData(this.source, festivals);
    this.logger.log('Processed data saved successfully');
    
    return festivals;
  } catch (error) {
    this.logger.error('Error parsing Befesti data', error);
    return [];
  }
}
```

### 4. Fetching Detail Pages

```javascript
// Add to BefestiScraper class
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
        
        // Extract detailed date information
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
    // Look for date information on the detail page
    const dateElement = $('.festival--date, .event--date, [data-element="date"]');
    
    if (dateElement.length) {
      const dateText = dateElement.text().trim();
      
      // Use our parser to extract structured date information
      const dateInfo = await this.parser.parseDateRange(dateText);
      
      festival.start_date = dateInfo.start_date;
      festival.end_date = dateInfo.end_date || festival.start_date;
      festival.duration = dateInfo.duration || "1 day";
    } else {
      // If we can't find specific date elements, try to extract from page text
      const pageText = $('body').text();
      const result = await this.parser.parseDateWithAI(pageText);
      
      if (result) {
        festival.start_date = result;
        festival.end_date = result; // Assume same day if we're not sure
        festival.duration = "1 day";
      }
    }
    
    // We could extract additional information here if needed
    // For example: ticket prices, lineup, etc.
    
    // Update location if more detailed on the detail page
    const locationElement = $('.festival--location, .event--location, [data-element="location"]');
    if (locationElement.length) {
      const locationText = locationElement.text().trim();
      if (locationText) {
        festival.location = locationText;
      }
    }
  } catch (error) {
    this.logger.error(`Error extracting detailed info for ${festival.name}`, error);
  }
}
```

### 5. Handling Befesti-Specific Challenges

```javascript
// Add to BefestiScraper class
async handleLoadMoreButton() {
  // Befesti might use a "Load More" button instead of infinite scroll
  try {
    // Keep clicking "Load More" until it disappears
    let loadMoreVisible = true;
    let clickCount = 0;
    const maxClicks = 30; // Prevent infinite loop
    
    while (loadMoreVisible && clickCount < maxClicks) {
      // Check if the load more button exists and is visible
      const loadMoreButton = await this.browser.page.$('[data-element="load-more"], .load-more-button, .pagination-button');
      
      if (loadMoreButton) {
        // Click the button
        await this.browser.clickElement('[data-element="load-more"], .load-more-button, .pagination-button');
        clickCount++;
        
        // Wait for new content to load
        await this.browser.wait(2000 + Math.random() * 1000);
        
        // Check if button is still visible after loading
        loadMoreVisible = await this.browser.page.evaluate(() => {
          const button = document.querySelector('[data-element="load-more"], .load-more-button, .pagination-button');
          return button && button.offsetParent !== null; // Check if visible
        });
      } else {
        loadMoreVisible = false;
      }
    }
    
    this.logger.log(`Clicked "Load More" button ${clickCount} times`);
    
    // Wait for final content to load
    await this.browser.wait(3000);
  } catch (error) {
    this.logger.error('Error handling "Load More" button', error);
  }
}
```

## Complete Implementation Example

Putting it all together:

```javascript
// scrapers/sources/befesti.js
const Browser = require('../core/browser');
const Storage = require('../core/storage');
const Parser = require('../core/parser');
const Logger = require('../core/logger');
const cheerio = require('cheerio');

class BefestiScraper {
  constructor(options = {}) {
    this.browser = new Browser({
      engine: 'playwright',
      waitTime: 2000
    });
    this.storage = new Storage();
    this.parser = new Parser(options);
    this.logger = new Logger('befesti');
    this.source = 'befesti';
    this.baseUrl = 'https://befesti.nl/festivalagenda';
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
      this.logger.log('Starting Befesti scraper');
      
      // Navigate to festivals page
      await this.browser.navigate(this.baseUrl);
      
      // Try both loading methods - "Load More" button or infinite scroll
      await this.handleLoadMoreButton();
      
      // If the above didn't work or to ensure all content is loaded, use scrolling
      this.logger.log('Scrolling to load all festivals');
      await this.scrollToLoadAll();
      
      // Get the page content
      const content = await this.browser.getContent();
      
      // Save raw HTML
      await this.storage.saveRawHtml(this.source, 1, content);
      this.logger.log('Raw HTML saved successfully');
      
      return true;
    } catch (error) {
      this.logger.error('Error scraping Befesti', error);
      return false;
    } finally {
      await this.close();
    }
  }

  async handleLoadMoreButton() {
    try {
      let loadMoreVisible = true;
      let clickCount = 0;
      const maxClicks = 30;
      
      while (loadMoreVisible && clickCount < maxClicks) {
        const loadMoreButton = await this.browser.page.$('[data-element="load-more"], .load-more-button, .pagination-button');
        
        if (loadMoreButton) {
          await this.browser.clickElement('[data-element="load-more"], .load-more-button, .pagination-button');
          clickCount++;
          
          await this.browser.wait(2000 + Math.random() * 1000);
          
          loadMoreVisible = await this.browser.page.evaluate(() => {
            const button = document.querySelector('[data-element="load-more"], .load-more-button, .pagination-button');
            return button && button.offsetParent !== null;
          });
        } else {
          loadMoreVisible = false;
        }
      }
      
      this.logger.log(`Clicked "Load More" button ${clickCount} times`);
      await this.browser.wait(3000);
    } catch (error) {
      this.logger.error('Error handling "Load More" button', error);
    }
  }

  async scrollToLoadAll() {
    await this.browser.page.evaluate(async () => {
      const scrollStep = 300;
      const scrollDelay = 1000;
      const endDetectionThreshold = 5;
      
      let lastHeight = 0;
      let unchangedScrolls = 0;
      
      while (unchangedScrolls < endDetectionThreshold) {
        window.scrollBy(0, scrollStep);
        
        await new Promise(resolve => setTimeout(resolve, scrollDelay));
        
        const currentHeight = document.body.scrollHeight;
        if (currentHeight === lastHeight) {
          unchangedScrolls++;
        } else {
          unchangedScrolls = 0;
          lastHeight = currentHeight;
        }
        
        if (Math.random() < 0.3) {
          await new Promise(resolve => setTimeout(resolve, 500 + Math.random() * 1000));
        }
      }
      
      window.scrollTo(0, 0);
    });
    
    await this.browser.wait(3000);
  }
  
  async parse() {
    try {
      this.logger.log('Starting to parse Befesti data');
      
      const html = await this.storage.getRawHtml(this.source, 1);
      const $ = cheerio.load(html);
      
      const festivals = [];
      
      // Find all festival containers
      const festivalCards = $('[data-element="card-title"]').closest('.w-dyn-item');
      
      this.logger.log(`Found ${festivalCards.length} potential festivals`);
      this.logger.setTotal(festivalCards.length);
      
      festivalCards.each((i, element) => {
        try {
          // Extract name
          const nameElement = $(element).find('[data-element="card-title"]');
          const name = nameElement.text().trim();
          
          // Extract date information
          const dateElement = $(element).find('.agenda--datum--double');
          let dateText = '';
          
          if (dateElement.length) {
            const startDay = dateElement.find('[data-element="day-start"]').text().trim();
            const endDay = dateElement.find('[data-element="day-end"]').text().trim();
            
            const monthElement = $(element).find('.agenda--month');
            const month = monthElement.text().trim();
            
            if (endDay && endDay !== startDay) {
              dateText = `${startDay}-${endDay} ${month}`;
            } else {
              dateText = `${startDay} ${month}`;
            }
          }
          
          // Extract location
          const locationElement = $(element).find('.agenda--chip');
          let location = '';
          
          if (locationElement.length) {
            location = locationElement.text().replace(/\s+/g, ' ').trim();
          }
          
          // Extract detail URL
          let detailUrl = '';
          const linkElement = $(element).find('a');
          if (linkElement.length) {
            const href = linkElement.attr('href');
            if (href) {
              detailUrl = href.startsWith('http') ? href : `https://befesti.nl${href}`;
            }
          }
          
          const festival = {
            name,
            location,
            detail_url: detailUrl,
            source: this.source,
            // Preliminary date parsing from list view
            raw_date: dateText
          };
          
          festivals.push(festival);
          this.logger.increment(true);
        } catch (error) {
          this.logger.error(`Error parsing festival at index ${i}`, error);
          this.logger.increment(false);
        }
      });
      
      this.logger.log(`Extracted basic data for ${festivals.length} festivals`);
      
      // Fetch detail pages for complete information
      await this.fetchDetailPages(festivals);
      
      // Save processed data
      await this.storage.saveProcessedData(this.source, festivals);
      this.logger.log('Processed data saved successfully');
      
      return festivals;
    } catch (error) {
      this.logger.error('Error parsing Befesti data', error);
      return [];
    }
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
      // If we already have raw date info from the list page, use it as a fallback
      const rawDate = festival.raw_date;
      delete festival.raw_date; // Remove the temporary field
      
      // Look for date information on the detail page
      const dateElement = $('.festival--date, .event--date, [data-element="date"]');
      
      if (dateElement.length) {
        const dateText = dateElement.text().trim();
        
        const dateInfo = await this.parser.parseDateRange(dateText);
        
        festival.start_date = dateInfo.start_date;
        festival.end_date = dateInfo.end_date || festival.start_date;
        festival.duration = dateInfo.duration || "1 day";
      } else if (rawDate) {
        // Use the raw date from the list page with AI parsing
        const dateInfo = await this.parser.parseDateRange(rawDate);
        
        festival.start_date = dateInfo.start_date;
        festival.end_date = dateInfo.end_date || festival.start_date;
        festival.duration = dateInfo.duration || "1 day";
      } else {
        // Last resort: extract from page text
        const pageText = $('body').text();
        const result = await this.parser.parseDateWithAI(pageText);
        
        if (result) {
          festival.start_date = result;
          festival.end_date = result;
          festival.duration = "1 day";
        }
      }
      
      // Update location if more detailed on the detail page
      const locationElement = $('.festival--location, .event--location, [data-element="location"]');
      if (locationElement.length) {
        const locationText = locationElement.text().trim();
        if (locationText) {
          festival.location = locationText;
        }
      }
    } catch (error) {
      this.logger.error(`Error extracting detailed info for ${festival.name}`, error);
    }
  }
}

module.exports = BefestiScraper;
```

## Usage Instructions

To use the Befesti scraper:

1. **Installation**:
   ```bash
   npm install cheerio playwright
   ```

2. **Configuration**:
   Update any settings in the constructor as needed.

3. **Run the Scraper**:
   ```javascript
   const BefestiScraper = require('./scrapers/sources/befesti');
   
   async function run() {
     const scraper = new BefestiScraper();
     
     try {
       await scraper.init();
       
       // Step 1: Scrape the main page
       const scrapeSuccess = await scraper.scrape();
       if (!scrapeSuccess) {
         console.error('Failed to scrape Befesti');
         return;
       }
       
       // Step 2: Parse the data
       const festivals = await scraper.parse();
       console.log(`Processed ${festivals.length} festivals`);
       
       // Step 3: Upload to database (implement separately)
     } catch (error) {
       console.error('Error running Befesti scraper:', error);
     }
   }
   
   run();
   ```

## Troubleshooting

### Common Issues:

1. **Selector Changes**:
   - The site may update its HTML structure, requiring selector updates
   - Check for changes in the class names and data attributes
   - Consider implementing flexible selectors with multiple options

2. **Infinite Scroll Issues**:
   - If scrolling doesn't load all content, try the "Load More" button approach
   - Increase scroll steps or wait times if content isn't fully loading
   - Check if the site has implemented anti-scraping measures

3. **Date Format Challenges**:
   - Befesti uses a unique date format with separate day-start and day-end elements
   - Month information might be in a separate element
   - Use AI parsing for complex date formats

4. **Rendering Issues**:
   - Befesti may use JavaScript to render content
   - Increase wait times if content isn't appearing
   - Consider switching to Puppeteer if certain elements can't be accessed

## Maintenance

To keep your Befesti scraper running smoothly:

1. Check the website monthly for structure or design changes
2. Update selectors as needed based on HTML structure changes
3. Validate that both infinite scroll and "Load More" methods still work
4. Compare the number of festivals found against expected totals

## Data Validation Tips

For high-quality Befesti data:

1. **Date Validation**:
   - Ensure dates have been properly combined from separate elements
   - Verify multi-day events show correct start and end dates
   - Check that months and years are correctly assigned

2. **Location Validation**:
   - Befesti may have locations split across multiple elements
   - Ensure commas and spacing in locations are consistent
   - Verify location data is complete with venue and city

3. **URL Validation**:
   - Check that relative URLs have been properly converted to absolute URLs
   - Verify all detail URLs follow the expected pattern
   - Test a sample of detail URLs to ensure they resolve correctly