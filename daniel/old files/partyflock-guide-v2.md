# Partyflock Scraper Implementation Guide

## Overview

This guide provides specific implementation instructions for scraping festival data from [Partyflock](https://partyflock.nl/agenda/festivals). Partyflock has a distinctive structure with a single page containing all festivals that needs to be scrolled through completely.

## Website Structure Analysis

### Main Page Structure
- URL: `https://partyflock.nl/agenda/festivals`
- Page format: Single long page with all festivals
- Pagination: None, requires scrolling to load all content
- Festival elements: Table rows (`<tr>`) containing festival information

### Festival Data Elements
- **Name**: Located in the first table cell (`<td>`) within an anchor tag
  ```html
  <td style="max-width:60%"><a href="/event/brege-pop-festival-nl"><span itemprop="name">Brêgepop Festival</span></a></td>
  ```

- **Detail URL**: Anchor tag link, must be prefixed with domain
  ```html
  <a href="/event/brege-pop-festival-nl">
  ```

- **Location**: Located in the third table cell
  ```html
  <td><a href="/location/23288:Evenemententerrein-Bregepop">Evenemententerrein Bregepop</a>, <span class="nowrap light7"><a href="/city/6382:Scharsterbrug">Scharsterbrug</a></span></td>
  ```

- **Date**: On detail page, found in the date link
  ```html
  <a href="/agenda/day/2025/4/11">vrijdag 11 april 2025</a>
  ```

- **Multi-day events**: Displayed in a table on the detail page
  ```html
  <table class="hla dens nomargin vtop">
    <tbody>
      <tr class=""><td><a href="/event/rebirth-festival-nl">REBiRTH Festival</a>,&nbsp;</td><td class="right">vr 11 apr 2025, 14:00</td><td></td><td></td></tr>
      <tr class="win "><td><a href="/party/467863:REBiRTH-Festival">REBiRTH Festival</a>,&nbsp;</td><td class="right">za 12 apr 2025, 12:00</td><td>&nbsp;←</td><td></td></tr>
      <tr class=""><td><a href="/party/475522:REBiRTH-Festival">REBiRTH Festival</a>,&nbsp;</td><td class="right">zo 13 apr 2025, 13:00</td><td></td><td></td></tr>
    </tbody>
  </table>
  ```

## Implementation Steps

### 1. Basic Setup

```javascript
// scrapers/sources/partyflock.js
const Browser = require('../core/browser');
const Storage = require('../core/storage');
const Parser = require('../core/parser');
const Logger = require('../core/logger');
const cheerio = require('cheerio');

class PartyflockScraper {
  constructor(options = {}) {
    this.browser = new Browser({
      engine: 'playwright', // Playwright better handles complex JS-heavy sites like Partyflock
      waitTime: 3000 // Longer wait time for this site
    });
    this.storage = new Storage();
    this.parser = new Parser(options);
    this.logger = new Logger('partyflock');
    this.source = 'partyflock';
    this.baseUrl = 'https://partyflock.nl/agenda/festivals';
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

module.exports = PartyflockScraper;
```

### 2. Main Page Scraping

```javascript
// Add to PartyflockScraper class
async scrape() {
  try {
    this.logger.log('Starting Partyflock scraper');
    
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
    this.logger.error('Error scraping Partyflock', error);
    return false;
  } finally {
    await this.close();
  }
}

async scrollToLoadAll() {
  // Partyflock may have lazy loading or dynamic content
  await this.browser.page.evaluate(async () => {
    // Function to scroll slowly down the page
    await new Promise((resolve) => {
      let scrollDistance = 0;
      const maxScroll = document.body.scrollHeight;
      const scrollInterval = setInterval(() => {
        window.scrollBy(0, 300); // Scroll 300px at a time
        scrollDistance += 300;
        
        // Add small random pauses to simulate human scrolling
        if (Math.random() < 0.2) {
          clearInterval(scrollInterval);
          setTimeout(() => {
            scrollInterval = setInterval(() => {
              window.scrollBy(0, 300);
              scrollDistance += 300;
              
              if (scrollDistance >= maxScroll) {
                clearInterval(scrollInterval);
                resolve();
              }
            }, 100);
          }, Math.random() * 1000 + 500);
        }
        
        if (scrollDistance >= maxScroll) {
          clearInterval(scrollInterval);
          resolve();
        }
      }, 100);
    });
    
    // Wait for any lazy-loaded content
    await new Promise(resolve => setTimeout(resolve, 2000));
  });
  
  // Additional wait to ensure all content is loaded
  await this.browser.wait(3000);
}
```

### 3. Parsing Festival Data

```javascript
// Add to PartyflockScraper class
async parse() {
  try {
    this.logger.log('Starting to parse Partyflock data');
    
    // Get the raw HTML
    const html = await this.storage.getRawHtml(this.source, 1);
    
    // Parse the HTML using cheerio
    const $ = cheerio.load(html);
    
    const festivals = [];
    
    // Track how many festivals we expect to process
    const festivalCount = $('tr').has('td[style="max-width:60%"] a').length;
    this.logger.setTotal(festivalCount);
    this.logger.log(`Found ${festivalCount} potential festivals to process`);
    
    // Extract festival data based on selectors
    $('tr').each((i, element) => {
      const nameElement = $(element).find('td[style="max-width:60%"] a span[itemprop="name"]');
      
      if (nameElement.length) {
        const name = nameElement.text().trim();
        const linkElement = $(element).find('td[style="max-width:60%"] a');
        const detailPath = linkElement.attr('href');
        const detailUrl = detailPath ? `https://partyflock.nl${detailPath}` : null;
        
        // Get location
        const locationElement = $(element).find('td:nth-child(3) a:first-child');
        const location = locationElement.length ? locationElement.text().trim() : null;
        
        // Get city
        const cityElement = $(element).find('td:nth-child(3) .nowrap a');
        const city = cityElement.length ? cityElement.text().trim() : null;
        
        // Merge the location data
        const fullLocation = location && city ? `${location}, ${city}` : (location || city || 'Unknown');
        
        festivals.push({
          name,
          detail_url: detailUrl,
          location: fullLocation,
          source: this.source,
          // Date will be added when we fetch detail pages
        });
        
        this.logger.increment(true);
      }
    });
    
    this.logger.log(`Found ${festivals.length} festivals on Partyflock`);
    
    // We need to fetch detail pages to get dates
    await this.fetchDetailPages(festivals);
    
    // Save processed data
    await this.storage.saveProcessedData(this.source, festivals);
    this.logger.log('Processed data saved successfully');
    
    return festivals;
  } catch (error) {
    this.logger.error('Error parsing Partyflock data', error);
    return [];
  }
}
```

### 4. Fetching Detail Pages for Dates

```javascript
// Add to PartyflockScraper class
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
        
        // Extract date(s) from detail page
        await this.extractDates($, festival);
        
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

async extractDates($, festival) {
  try {
    // Check for multi-day event first
    const multiDayTable = $('table.hla.dens.nomargin.vtop');
    
    if (multiDayTable.length) {
      // Multi-day event
      const dates = [];
      
      multiDayTable.find('tr').each((i, row) => {
        const dateText = $(row).find('td.right').text().trim();
        if (dateText) {
          dates.push(dateText);
        }
      });
      
      if (dates.length > 0) {
        // Use AI to parse the complete date range
        const datesText = dates.join(' - ');
        const dateInfo = await this.parser.parseDateRange(datesText);
        
        festival.start_date = dateInfo.start_date;
        festival.end_date = dateInfo.end_date;
        festival.duration = dateInfo.duration || `${dates.length} days`;
        
        return;
      }
    }
    
    // Regular single date event
    const dateElement = $('a[href^="/agenda/day/"]').first();
    const dateText = dateElement.length ? dateElement.text().trim() : null;
    
    if (dateText) {
      // Parse the date
      const dateInfo = await this.parser.parseDateRange(dateText);
      festival.start_date = dateInfo.start_date;
      festival.end_date = dateInfo.end_date || festival.start_date; // Same day for single-day events
      festival.duration = dateInfo.duration || "1 day";
    } else {
      // Look for any date-like text as a fallback
      const pageText = $('body').text();
      const dateInfo = await this.parser.parseDateWithAI(pageText);
      
      if (dateInfo) {
        festival.start_date = dateInfo;
        festival.end_date = dateInfo; // Assume same day if we're not sure
        festival.duration = "1 day";
      }
    }
  } catch (error) {
    this.logger.error(`Error extracting dates for ${festival.name}`, error);
  }
}
```

### 5. Handling Partyflock-Specific Challenges

```javascript
// Add to PartyflockScraper class
async handlePossibleCaptcha() {
  // Check if there's a CAPTCHA or login wall
  const isCaptcha = await this.browser.page.evaluate(() => {
    return (
      document.body.innerText.includes('CAPTCHA') ||
      document.body.innerText.includes('robot') ||
      document.body.innerText.includes('Please log in') ||
      document.body.innerText.includes('Login required')
    );
  });
  
  if (isCaptcha) {
    this.logger.log('CAPTCHA or login wall detected. Pausing for manual intervention.');
    
    // Alert the user
    await this.browser.page.evaluate(() => {
      alert('CAPTCHA or login required! Please solve it manually and then close this alert.');
    });
    
    // Wait for a while to give time for manual solving
    await this.browser.wait(30000);
    this.logger.log('Resuming after waiting for manual intervention');
  }
}

async testConnection() {
  try {
    // Simple test to check if we can access Partyflock
    await this.browser.navigate('https://partyflock.nl');
    
    const isAccessible = await this.browser.page.evaluate(() => {
      return !document.body.innerText.includes('Access Denied') &&
             !document.body.innerText.includes('IP blocked');
    });
    
    if (!isAccessible) {
      this.logger.error('Access to Partyflock appears to be blocked', new Error('Access Denied'));
      return false;
    }
    
    this.logger.log('Connection to Partyflock successful');
    return true;
  } catch (error) {
    this.logger.error('Error testing connection to Partyflock', error);
    return false;
  }
}
```

## Complete Implementation Example

Putting it all together:

```javascript
// scrapers/sources/partyflock.js
const Browser = require('../core/browser');
const Storage = require('../core/storage');
const Parser = require('../core/parser');
const Logger = require('../core/logger');
const cheerio = require('cheerio');

class PartyflockScraper {
  constructor(options = {}) {
    this.browser = new Browser({
      engine: 'playwright',
      waitTime: 3000
    });
    this.storage = new Storage();
    this.parser = new Parser(options);
    this.logger = new Logger('partyflock');
    this.source = 'partyflock';
    this.baseUrl = 'https://partyflock.nl/agenda/festivals';
  }

  async init() {
    await this.storage.init();
    await this.logger.init();
    await this.browser.launch();
    
    // Test connection before proceeding
    const connectionOk = await this.testConnection();
    if (!connectionOk) {
      throw new Error('Cannot connect to Partyflock. Aborting.');
    }
  }
  
  async close() {
    if (this.browser) {
      await this.browser.close();
    }
  }
  
  async scrape() {
    try {
      this.logger.log('Starting Partyflock scraper');
      
      // Navigate to festivals page
      await this.browser.navigate(this.baseUrl);
      
      // Check for CAPTCHAs or login walls
      await this.handlePossibleCaptcha();
      
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
      this.logger.error('Error scraping Partyflock', error);
      return false;
    } finally {
      await this.close();
    }
  }

  async scrollToLoadAll() {
    await this.browser.page.evaluate(async () => {
      await new Promise((resolve) => {
        let scrollDistance = 0;
        const maxScroll = document.body.scrollHeight;
        let scrollInterval = setInterval(() => {
          window.scrollBy(0, 300);
          scrollDistance += 300;
          
          // Add small random pauses to simulate human scrolling
          if (Math.random() < 0.2) {
            clearInterval(scrollInterval);
            setTimeout(() => {
              scrollInterval = setInterval(() => {
                window.scrollBy(0, 300);
                scrollDistance += 300;
                
                if (scrollDistance >= maxScroll) {
                  clearInterval(scrollInterval);
                  resolve();
                }
              }, 100);
            }, Math.random() * 1000 + 500);
          }
          
          if (scrollDistance >= maxScroll) {
            clearInterval(scrollInterval);
            resolve();
          }
        }, 100);
      });
      
      // Wait for any lazy-loaded content
      await new Promise(resolve => setTimeout(resolve, 2000));
    });
    
    // Additional wait to ensure all content is loaded
    await this.browser.wait(3000);
  }
  
  async parse() {
    try {
      this.logger.log('Starting to parse Partyflock data');
      
      // Get the raw HTML
      const html = await this.storage.getRawHtml(this.source, 1);
      
      // Parse the HTML using cheerio
      const $ = cheerio.load(html);
      
      const festivals = [];
      
      // Track how many festivals we expect to process
      const festivalCount = $('tr').has('td[style="max-width:60%"] a').length;
      this.logger.setTotal(festivalCount);
      this.logger.log(`Found ${festivalCount} potential festivals to process`);
      
      // Extract festival data based on selectors
      $('tr').each((i, element) => {
        const nameElement = $(element).find('td[style="max-width:60%"] a span[itemprop="name"]');
        
        if (nameElement.length) {
          const name = nameElement.text().trim();
          const linkElement = $(element).find('td[style="max-width:60%"] a');
          const detailPath = linkElement.attr('href');
          const detailUrl = detailPath ? `https://partyflock.nl${detailPath}` : null;
          
          // Get location
          const locationElement = $(element).find('td:nth-child(3) a:first-child');
          const location = locationElement.length ? locationElement.text().trim() : null;
          
          // Get city
          const cityElement = $(element).find('td:nth-child(3) .nowrap a');
          const city = cityElement.length ? cityElement.text().trim() : null;
          
          // Merge the location data
          const fullLocation = location && city ? `${location}, ${city}` : (location || city || 'Unknown');
          
          festivals.push({
            name,
            detail_url: detailUrl,
            location: fullLocation,
            source: this.source,
            // Date will be added when we fetch detail pages
          });
          
          this.logger.increment(true);
        }
      });
      
      this.logger.log(`Found ${festivals.length} festivals on Partyflock`);
      
      // We need to fetch detail pages to get dates
      await this.fetchDetailPages(festivals);
      
      // Save processed data
      await this.storage.saveProcessedData(this.source, festivals);
      this.logger.log('Processed data saved successfully');
      
      return festivals;
    } catch (error) {
      this.logger.error('Error parsing Partyflock data', error);
      return [];
    }
  }
  
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
          
          // Check for CAPTCHAs or login walls
          await this.handlePossibleCaptcha();
          
          const detailContent = await this.browser.getContent();
          const $ = cheerio.load(detailContent);
          
          // Extract date(s) from detail page
          await this.extractDates($, festival);
          
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

  async extractDates($, festival) {
    try {
      // Check for multi-day event first
      const multiDayTable = $('table.hla.dens.nomargin.vtop');
      
      if (multiDayTable.length) {
        // Multi-day event
        const dates = [];
        
        multiDayTable.find('tr').each((i, row) => {
          const dateText = $(row).find('td.right').text().trim();
          if (dateText) {
            dates.push(dateText);
          }
        });
        
        if (dates.length > 0) {
          // Use AI to parse the complete date range
          const datesText = dates.join(' - ');
          const dateInfo = await this.parser.parseDateRange(datesText);
          
          festival.start_date = dateInfo.start_date;
          festival.end_date = dateInfo.end_date;
          festival.duration = dateInfo.duration || `${dates.length} days`;
          
          return;
        }
      }
      
      // Regular single date event
      const dateElement = $('a[href^="/agenda/day/"]').first();
      const dateText = dateElement.length ? dateElement.text().trim() : null;
      
      if (dateText) {
        // Parse the date
        const dateInfo = await this.parser.parseDateRange(dateText);
        festival.start_date = dateInfo.start_date;
        festival.end_date = dateInfo.end_date || festival.start_date; // Same day for single-day events
        festival.duration = dateInfo.duration || "1 day";
      } else {
        // Look for any date-like text as a fallback
        const pageText = $('body').text();
        const dateInfo = await this.parser.parseDateWithAI(pageText);
        
        if (dateInfo) {
          festival.start_date = dateInfo;
          festival.end_date = dateInfo; // Assume same day if we're not sure
          festival.duration = "1 day";
        }
      }
    } catch (error) {
      this.logger.error(`Error extracting dates for ${festival.name}`, error);
    }
  }
  
  async handlePossibleCaptcha() {
    // Check if there's a CAPTCHA or login wall
    const isCaptcha = await this.browser.page.evaluate(() => {
      return (
        document.body.innerText.includes('CAPTCHA') ||
        document.body.innerText.includes('robot') ||
        document.body.innerText.includes('Please log in') ||
        document.body.innerText.includes('Login required')
      );
    });
    
    if (isCaptcha) {
      this.logger.log('CAPTCHA or login wall detected. Pausing for manual intervention.');
      
      // Alert the user
      await this.browser.page.evaluate(() => {
        alert('CAPTCHA or login required! Please solve it manually and then close this alert.');
      });
      
      // Wait for a while to give time for manual solving
      await this.browser.wait(30000);
      this.logger.log('Resuming after waiting for manual intervention');
    }
  }

  async testConnection() {
    try {
      // Simple test to check if we can access Partyflock
      await this.browser.navigate('https://partyflock.nl');
      
      const isAccessible = await this.browser.page.evaluate(() => {
        return !document.body.innerText.includes('Access Denied') &&
               !document.body.innerText.includes('IP blocked');
      });
      
      if (!isAccessible) {
        this.logger.error('Access to Partyflock appears to be blocked', new Error('Access Denied'));
        return false;
      }
      
      this.logger.log('Connection to Partyflock successful');
      return true;
    } catch (error) {
      this.logger.error('Error testing connection to Partyflock', error);
      return false;
    }
  }
}

module.exports = PartyflockScraper;
```

## Usage Instructions

To use the Partyflock scraper:

1. **Installation**:
   ```bash
   npm install cheerio playwright
   ```

2. **Configuration**:
   Update any settings in the constructor as needed.

3. **Run the Scraper**:
   ```javascript
   const PartyflockScraper = require('./scrapers/sources/partyflock');
   
   async function run() {
     const scraper = new PartyflockScraper();
     
     try {
       await scraper.init();
       
       // Step 1: Scrape the main page
       const scrapeSuccess = await scraper.scrape();
       if (!scrapeSuccess) {
         console.error('Failed to scrape Partyflock');
         return;
       }
       
       // Step 2: Parse the data
       const festivals = await scraper.parse();
       console.log(`Processed ${festivals.length} festivals`);
       
       // Step 3: Upload to database (implement separately)
     } catch (error) {
       console.error('Error running Partyflock scraper:', error);
     }
   }
   
   run();
   ```

## Troubleshooting

### Common Issues:

1. **Access Denied / IP Blocked**:
   - Use a different IP address or proxy
   - Implement a longer delay between requests
   - Consider reducing the batch size

2. **Login Walls**:
   - The script can pause for manual intervention
   - Consider implementing cookie storage for login sessions

3. **Parsing Failures**:
   - Check if the website structure has changed
   - Update the CSS selectors as needed
   - Use the debug log to identify which elements aren't being found

4. **Date Formatting Issues**:
   - Dutch dates may require special handling
   - Use the OpenAI-powered parsing for complex dates
   - Implement fallback patterns for known date formats

## Maintenance

Regularly check if the Partyflock website structure changes by:

1. Comparing the current HTML with previously saved versions
2. Monitoring failure rates during scraping
3. Setting up alerts for any significant drop in discovered festivals

Run a validation script periodically that checks for:
1. Missing dates in the extracted data
2. Unusually short or long festival names
3. Missing location data
4. Broken detail URLs