# FestiFind - General Scraping Implementation Guide

## Architecture Overview

The scraping solution will follow a two-stage approach:

1. **Local Extraction**: Using Puppeteer/Playwright to fetch and store HTML content
2. **Data Processing**: Parsing the HTML content to extract structured festival data
3. **Validation & Upload**: Verifying data quality before uploading to Supabase

This approach ensures robustness against anti-scraping measures while allowing thorough validation before affecting the production database.

## Technologies

- **Puppeteer**: For websites requiring JavaScript rendering
- **Playwright**: For more complex websites with advanced interactions
- **OpenAI API**: For complex date/text parsing when needed
- **Node.js**: For running extraction scripts locally
- **Supabase**: For storing processed festival data

## Setup Instructions

### 1. Development Environment

```bash
# Clone the repository
git clone https://github.com/danielvandrunen/festifind.git
cd festifind

# Install dependencies
npm install

# Install browser automation libraries
npm install puppeteer playwright
```

### 2. Project Structure

```
festifind/
├── scrapers/
│   ├── core/
│   │   ├── browser.js            # Browser automation utilities
│   │   ├── parser.js             # HTML parsing utilities
│   │   ├── storage.js            # Local file storage
│   │   └── upload.js             # Supabase upload
│   ├── sources/
│   │   ├── partyflock.js         # Partyflock specific scraper
│   │   ├── festileaks.js         # Festileaks specific scraper
│   │   ├── befesti.js            # Befesti specific scraper
│   │   ├── festivalfans.js       # Festivalfans specific scraper
│   │   └── followthebeat.js      # Followthebeat specific scraper
│   └── index.js                  # Scraper entry point
├── data/
│   ├── raw/                      # Raw HTML storage 
│   └── processed/                # Processed JSON data
└── dev-tools/
    ├── validator.js              # Data validation tools
    └── viewer.js                 # Data viewing utilities
```

## Implementation Steps

### 1. Core Browser Automation Module

Create a unified browser automation module that works with both Puppeteer and Playwright:

```javascript
// scrapers/core/browser.js
const puppeteer = require('puppeteer');
const { chromium } = require('playwright');

class Browser {
  constructor(options = {}) {
    this.engine = options.engine || 'puppeteer';
    this.browser = null;
    this.page = null;
    this.userAgent = options.userAgent || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36';
    this.waitTime = options.waitTime || 2000;
  }

  async launch() {
    if (this.engine === 'puppeteer') {
      this.browser = await puppeteer.launch({
        headless: false,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      });
      this.page = await this.browser.newPage();
    } else {
      this.browser = await chromium.launch({ headless: false });
      this.page = await this.browser.newPage();
    }
    
    // Set user agent
    await this.page.setUserAgent(this.userAgent);
    
    // Add random delay to simulate human behavior
    await this.page.setDefaultNavigationTimeout(60000);
  }

  async navigate(url) {
    console.log(`Navigating to ${url}`);
    
    if (this.engine === 'puppeteer') {
      await this.page.goto(url, { waitUntil: 'networkidle2' });
    } else {
      await this.page.goto(url, { waitUntil: 'networkidle' });
    }
    
    // Random wait to avoid detection
    await this.wait(this.waitTime + Math.floor(Math.random() * 1000));
  }

  async scrollToBottom() {
    console.log('Scrolling to bottom of page');
    
    if (this.engine === 'puppeteer') {
      await this.page.evaluate(async () => {
        await new Promise((resolve) => {
          let totalHeight = 0;
          const distance = 100;
          const timer = setInterval(() => {
            const scrollHeight = document.body.scrollHeight;
            window.scrollBy(0, distance);
            totalHeight += distance;
            
            if (totalHeight >= scrollHeight) {
              clearInterval(timer);
              resolve();
            }
          }, 100);
        });
      });
    } else {
      await this.page.evaluate(async () => {
        await new Promise((resolve) => {
          let totalHeight = 0;
          const distance = 100;
          const timer = setInterval(() => {
            const scrollHeight = document.body.scrollHeight;
            window.scrollBy(0, distance);
            totalHeight += distance;
            
            if (totalHeight >= scrollHeight) {
              clearInterval(timer);
              resolve();
            }
          }, 100);
        });
      });
    }
    
    await this.wait(1000);
  }

  async wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async getContent() {
    if (this.engine === 'puppeteer') {
      return await this.page.content();
    } else {
      return await this.page.content();
    }
  }

  async close() {
    if (this.browser) {
      await this.browser.close();
    }
  }
  
  async clickElement(selector) {
    console.log(`Clicking element: ${selector}`);
    
    if (this.engine === 'puppeteer') {
      await this.page.waitForSelector(selector);
      await this.page.click(selector);
    } else {
      await this.page.waitForSelector(selector);
      await this.page.click(selector);
    }
    
    await this.wait(this.waitTime);
  }
  
  async extractLinks(selector) {
    console.log(`Extracting links from: ${selector}`);
    
    if (this.engine === 'puppeteer') {
      return await this.page.evaluate((sel) => {
        const elements = Array.from(document.querySelectorAll(sel));
        return elements.map(el => el.href);
      }, selector);
    } else {
      return await this.page.evaluate((sel) => {
        const elements = Array.from(document.querySelectorAll(sel));
        return elements.map(el => el.href);
      }, selector);
    }
  }
}

module.exports = Browser;
```

### 2. Storage Module

Create a module for handling local file storage:

```javascript
// scrapers/core/storage.js
const fs = require('fs').promises;
const path = require('path');

class Storage {
  constructor(options = {}) {
    this.rawDir = options.rawDir || path.join(process.cwd(), 'data', 'raw');
    this.processedDir = options.processedDir || path.join(process.cwd(), 'data', 'processed');
  }

  async init() {
    // Create directories if they don't exist
    await fs.mkdir(this.rawDir, { recursive: true });
    await fs.mkdir(this.processedDir, { recursive: true });
  }

  async saveRawHtml(source, page, content) {
    const filename = `${source}_page${page}.html`;
    const filePath = path.join(this.rawDir, filename);
    await fs.writeFile(filePath, content);
    console.log(`Saved raw HTML to ${filePath}`);
    return filePath;
  }

  async saveProcessedData(source, data) {
    const filename = `${source}_processed.json`;
    const filePath = path.join(this.processedDir, filename);
    await fs.writeFile(filePath, JSON.stringify(data, null, 2));
    console.log(`Saved processed data to ${filePath}`);
    return filePath;
  }

  async getRawHtml(source, page) {
    const filename = `${source}_page${page}.html`;
    const filePath = path.join(this.rawDir, filename);
    return await fs.readFile(filePath, 'utf8');
  }

  async getProcessedData(source) {
    const filename = `${source}_processed.json`;
    const filePath = path.join(this.processedDir, filename);
    try {
      const data = await fs.readFile(filePath, 'utf8');
      return JSON.parse(data);
    } catch (error) {
      console.error(`Error reading processed data: ${error}`);
      return [];
    }
  }
  
  async getAllRawHtmlFiles(source) {
    const files = await fs.readdir(this.rawDir);
    return files
      .filter(file => file.startsWith(`${source}_page`) && file.endsWith('.html'))
      .map(file => path.join(this.rawDir, file));
  }
}

module.exports = Storage;
```

### 3. Upload Module

Create a module for uploading data to Supabase:

```javascript
// scrapers/core/upload.js
const { createClient } = require('@supabase/supabase-js');

class Uploader {
  constructor(options = {}) {
    this.supabaseUrl = options.supabaseUrl || 'https://lfqwwjrvxiqbizirwxgf.supabase.co';
    this.supabaseKey = options.supabaseKey || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxmcXd3anJ2eGlxYml6aXJ3eGdmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDQzNjg0OTgsImV4cCI6MjA1OTk0NDQ5OH0.u15Z1OSFy-RS-2Jv-diKVl_k8-uoCcFyTtsfCXbuGAw';
    this.supabase = createClient(this.supabaseUrl, this.supabaseKey);
    this.tableName = options.tableName || 'festivals';
  }

  async uploadFestivals(festivals) {
    console.log(`Uploading ${festivals.length} festivals to Supabase...`);
    
    // Process in batches to avoid hitting limits
    const batchSize = 50;
    const batches = [];
    
    for (let i = 0; i < festivals.length; i += batchSize) {
      batches.push(festivals.slice(i, i + batchSize));
    }
    
    const results = [];
    
    for (let i = 0; i < batches.length; i++) {
      console.log(`Processing batch ${i+1} of ${batches.length}`);
      const batch = batches[i];
      
      // Use upsert to update existing records or insert new ones
      const { data, error } = await this.supabase
        .from(this.tableName)
        .upsert(batch, {
          onConflict: 'name,start_date,source',
          returning: 'minimal'
        });
      
      if (error) {
        console.error(`Error uploading batch ${i+1}:`, error);
      } else {
        results.push(...(data || []));
        console.log(`Successfully uploaded batch ${i+1}`);
      }
      
      // Add a small delay between batches
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    console.log(`Upload complete. ${results.length} festivals processed.`);
    return results;
  }
  
  async getFestivals() {
    const { data, error } = await this.supabase
      .from(this.tableName)
      .select('*');
      
    if (error) {
      console.error(`Error fetching festivals:`, error);
      return [];
    }
    
    return data;
  }
}

module.exports = Uploader;
```

### 4. Parser Module

Create a base parser module with common parsing functions:

```javascript
// scrapers/core/parser.js
const cheerio = require('cheerio');
const { OpenAI } = require('openai');

class Parser {
  constructor(options = {}) {
    this.openaiApiKey = options.openaiApiKey;
    this.openai = this.openaiApiKey ? new OpenAI({ apiKey: this.openaiApiKey }) : null;
  }

  load(html) {
    return cheerio.load(html);
  }

  // Standard date parsing function
  parseDate(dateStr) {
    // Try standard parsing first
    try {
      // Handle Dutch date formats
      const dutchMonths = {
        'jan': 'January', 'feb': 'February', 'mrt': 'March', 'apr': 'April',
        'mei': 'May', 'jun': 'June', 'jul': 'July', 'aug': 'August',
        'sep': 'September', 'okt': 'October', 'nov': 'November', 'dec': 'December'
      };
      
      // Replace Dutch month abbreviations with English
      let processedDateStr = dateStr.toLowerCase();
      Object.entries(dutchMonths).forEach(([dutch, english]) => {
        processedDateStr = processedDateStr.replace(new RegExp(dutch, 'g'), english);
      });
      
      // Try to parse the date
      const date = new Date(processedDateStr);
      if (!isNaN(date.getTime())) {
        return date.toISOString().split('T')[0]; // YYYY-MM-DD format
      }
      
      throw new Error('Standard date parsing failed');
    } catch (error) {
      // If standard parsing fails and OpenAI is available, use it
      if (this.openai) {
        return this.parseDateWithAI(dateStr);
      } else {
        console.error(`Error parsing date: ${dateStr}`);
        return null;
      }
    }
  }

  // AI-assisted date parsing for complex formats
  async parseDateWithAI(dateStr) {
    try {
      const response = await this.openai.chat.completions.create({
        model: "gpt-4",
        messages: [
          {
            role: "system",
            content: "You are a helper that extracts dates from text. Return only a date in YYYY-MM-DD format."
          },
          {
            role: "user",
            content: `Extract the date from this text: "${dateStr}". Return ONLY the date in YYYY-MM-DD format. If there's a range, return the start date.`
          }
        ],
        temperature: 0.1,
      });
      
      // Extract the date from the response
      const parsedDate = response.choices[0].message.content.trim();
      
      // Validate the result is in YYYY-MM-DD format
      if (/^\d{4}-\d{2}-\d{2}$/.test(parsedDate)) {
        return parsedDate;
      } else {
        console.error(`AI returned invalid date format: ${parsedDate}`);
        return null;
      }
    } catch (error) {
      console.error(`Error using AI to parse date: ${error}`);
      return null;
    }
  }
  
  // Extract date range and duration
  async parseDateRange(dateStr) {
    try {
      if (this.openai) {
        const response = await this.openai.chat.completions.create({
          model: "gpt-4",
          messages: [
            {
              role: "system",
              content: "You are a helper that extracts date information from text."
            },
            {
              role: "user",
              content: `Extract the start date, end date, and duration from this text: "${dateStr}". Return a JSON object with format {"start_date": "YYYY-MM-DD", "end_date": "YYYY-MM-DD", "duration": "X days"}`
            }
          ],
          temperature: 0.1,
        });
        
        // Parse the JSON response
        try {
          const jsonResponse = JSON.parse(response.choices[0].message.content.trim());
          return jsonResponse;
        } catch (e) {
          console.error(`Error parsing AI response: ${e}`);
          return {
            start_date: await this.parseDateWithAI(dateStr),
            end_date: null,
            duration: "1 day"
          };
        }
      } else {
        // Fallback to basic parsing
        return {
          start_date: this.parseDate(dateStr),
          end_date: null,
          duration: "1 day"
        };
      }
    } catch (error) {
      console.error(`Error parsing date range: ${error}`);
      return {
        start_date: null,
        end_date: null,
        duration: null
      };
    }
  }
}

module.exports = Parser;
```

### 5. Example Source Implementation

Here's an example implementation for one source (the rest will follow in individual guides):

```javascript
// scrapers/sources/partyflock.js
const Browser = require('../core/browser');
const Storage = require('../core/storage');
const Parser = require('../core/parser');

class PartyflockScraper {
  constructor(options = {}) {
    this.browser = new Browser({
      engine: 'playwright', // Use Playwright for Partyflock
      waitTime: 3000 // Longer wait time for this site
    });
    this.storage = new Storage();
    this.parser = new Parser(options);
    this.source = 'partyflock';
    this.baseUrl = 'https://partyflock.nl/agenda/festivals';
  }

  async init() {
    await this.storage.init();
    await this.browser.launch();
  }

  async scrape() {
    try {
      // Navigate to festivals page
      await this.browser.navigate(this.baseUrl);
      
      // Scroll to load all festivals
      await this.browser.scrollToBottom();
      
      // Get the page content
      const content = await this.browser.getContent();
      
      // Save raw HTML
      await this.storage.saveRawHtml(this.source, 1, content);
      
      // Process the festivals (will implement in parse method)
      console.log('Partyflock scraping complete.');
      
      return true;
    } catch (error) {
      console.error(`Error scraping Partyflock: ${error}`);
      return false;
    } finally {
      await this.browser.close();
    }
  }

  async parse() {
    try {
      // Get the raw HTML
      const html = await this.storage.getRawHtml(this.source, 1);
      
      // Parse the HTML using cheerio
      const $ = this.parser.load(html);
      
      const festivals = [];
      
      // Extract festival data based on selectors
      $('tr').each((i, element) => {
        const nameElement = $(element).find('td:first-child a');
        
        if (nameElement.length) {
          const name = nameElement.text().trim();
          const detailUrl = 'https://partyflock.nl' + nameElement.attr('href');
          
          // Get location
          const locationElement = $(element).find('td:nth-child(3) a:first-child');
          const location = locationElement.length ? locationElement.text().trim() : null;
          
          // Get city
          const cityElement = $(element).find('td:nth-child(3) .nowrap a');
          const city = cityElement.length ? cityElement.text().trim() : null;
          
          // Merge the location data
          const fullLocation = location && city ? `${location}, ${city}` : (location || city || 'Unknown');
          
          // We'll need to fetch the detail page for the date
          
          festivals.push({
            name,
            detail_url: detailUrl,
            location: fullLocation,
            source: this.source,
            // Date will be added later
          });
        }
      });
      
      console.log(`Found ${festivals.length} festivals on Partyflock`);
      
      // We need to fetch detail pages to get dates
      await this.fetchDetailPages(festivals);
      
      // Save processed data
      await this.storage.saveProcessedData(this.source, festivals);
      
      return festivals;
    } catch (error) {
      console.error(`Error parsing Partyflock data: ${error}`);
      return [];
    }
  }
  
  async fetchDetailPages(festivals) {
    // We'll initialize the browser again since we closed it after scraping
    await this.browser.launch();
    
    // Fetch dates for each festival (or a subset for testing)
    const maxFestivals = 10; // Limit for testing, remove in production
    const festivalSubset = festivals.slice(0, maxFestivals);
    
    for (let i = 0; i < festivalSubset.length; i++) {
      const festival = festivalSubset[i];
      console.log(`Fetching detail page ${i+1}/${festivalSubset.length}: ${festival.name}`);
      
      try {
        await this.browser.navigate(festival.detail_url);
        await this.browser.wait(2000); // Wait for page to load
        
        const detailContent = await this.browser.getContent();
        const $ = this.parser.load(detailContent);
        
        // Extract date from detail page
        const dateElement = $('a[href^="/agenda/day/"]').first();
        const dateText = dateElement.length ? dateElement.text().trim() : null;
        
        if (dateText) {
          // Parse the date using our parser
          const dateInfo = await this.parser.parseDateRange(dateText);
          festival.start_date = dateInfo.start_date;
          festival.end_date = dateInfo.end_date;
          festival.duration = dateInfo.duration;
        }
        
        // Add a delay to avoid being blocked
        await this.browser.wait(3000 + Math.random() * 2000);
      } catch (error) {
        console.error(`Error fetching detail page for ${festival.name}: ${error}`);
      }
    }
    
    // Update the original festivals array with the data from the subset
    for (let i = 0; i < festivalSubset.length; i++) {
      festivals[i] = festivalSubset[i];
    }
    
    // Close the browser
    await this.browser.close();
  }
}

module.exports = PartyflockScraper;
```

### 6. Main Scraper Entry Point

Create the main entry point for running scrapers:

```javascript
// scrapers/index.js
const PartyflockScraper = require('./sources/partyflock');
const FestileaksScraper = require('./sources/festileaks');
const BefestiScraper = require('./sources/befesti');
const FestivalfansScraper = require('./sources/festivalfans');
const FollowthebeatScraper = require('./sources/followthebeat');
const Uploader = require('./core/upload');

async function runScraper(source) {
  console.log(`Running scraper for ${source}...`);
  
  let scraper;
  
  // Choose the right scraper based on source
  switch (source) {
    case 'partyflock':
      scraper = new PartyflockScraper();
      break;
    case 'festileaks':
      scraper = new FestileaksScraper();
      break;
    case 'befesti':
      scraper = new BefestiScraper();
      break;
    case 'festivalfans':
      scraper = new FestivalfansScraper();
      break;
    case 'followthebeat':
      scraper = new FollowthebeatScraper();
      break;
    default:
      console.error(`Unknown source: ${source}`);
      return;
  }
  
  try {
    // Initialize and run the scraper
    await scraper.init();
    const success = await scraper.scrape();
    
    if (success) {
      console.log(`Successfully scraped ${source}`);
    } else {
      console.error(`Failed to scrape ${source}`);
    }
  } catch (error) {
    console.error(`Error running scraper for ${source}:`, error);
  }
}

async function parseData(source) {
  console.log(`Parsing data for ${source}...`);
  
  let scraper;
  
  // Choose the right scraper based on source
  switch (source) {
    case 'partyflock':
      scraper = new PartyflockScraper();
      break;
    case 'festileaks':
      scraper = new FestileaksScraper();
      break;
    case 'befesti':
      scraper = new BefestiScraper();
      break;
    case 'festivalfans':
      scraper = new FestivalfansScraper();
      break;
    case 'followthebeat':
      scraper = new FollowthebeatScraper();
      break;
    default:
      console.error(`Unknown source: ${source}`);
      return [];
  }
  
  try {
    // Parse the scraped data
    const festivals = await scraper.parse();
    return festivals;
  } catch (error) {
    console.error(`Error parsing data for ${source}:`, error);
    return [];
  }
}

async function uploadData(source) {
  console.log(`Uploading data for ${source}...`);
  
  try {
    // Create a storage instance to get processed data
    const Storage = require('./core/storage');
    const storage = new Storage();
    await storage.init();
    
    // Get the processed data
    const festivals = await storage.getProcessedData(source);
    
    if (festivals.length === 0) {
      console.log(`No festivals to upload for ${source}`);
      return;
    }
    
    // Upload to Supabase
    const uploader = new Uploader();
    await uploader.uploadFestivals(festivals);
    
    console.log(`Successfully uploaded ${festivals.length} festivals for ${source}`);
  } catch (error) {
    console.error(`Error uploading data for ${source}:`, error);
  }
}

// Command line interface
const [,, command, source] = process.argv;

if (!command) {
  console.error('No command specified. Use: scrape, parse, or upload');
  process.exit(1);
}

if (!source && command !== 'all') {
  console.error('No source specified. Use: partyflock, festileaks, befesti, festivalfans, or followthebeat');
  process.exit(1);
}

async function main() {
  if (command === 'all') {
    // Run all scrapers
    const sources = ['partyflock', 'festileaks', 'befesti', 'festivalfans', 'followthebeat'];
    
    for (const src of sources) {
      await runScraper(src);
    }
  } else if (command === 'scrape') {
    await runScraper(source);
  } else if (command === 'parse') {
    await parseData(source);
  } else if (command === 'upload') {
    await uploadData(source);
  } else {
    console.error(`Unknown command: ${command}. Use: scrape, parse, or upload`);
  }
}

main().catch(console.error);
```

## Anti-Scraping Strategies

To avoid triggering anti-scraping measures, implement these practices in your scrapers:

1. **Request Throttling**
   - Add random delays between requests (2-5 seconds)
   - Limit concurrent connections to a single domain
   - Implement exponential backoff for retries

2. **Browser Fingerprinting**
   - Rotate user agents
   - Maintain cookies and session state
   - Mimic human-like behavior with random scrolling and clicks

3. **IP Protection**
   - Consider using a proxy rotation service for large-scale scraping
   - Implement IP blocking detection and pause mechanism

4. **Error Handling**
   - Implement robust error handling and recovery
   - Log failed requests for manual review
   - Create checkpoints to resume interrupted scraping

## Data Validation

Before uploading scraped data to Supabase, implement these validation steps:

1. **Schema Validation**
   - Ensure all required fields are present
   - Validate data types and formats
   - Check for null or empty fields

2. **Date Validation**
   - Ensure dates are in proper ISO format
   - Validate date ranges (start date before end date)
   - Check that dates fall within expected range (before December 2025)

3. **Duplicate Detection**
   - Check for duplicates within a single source
   - Flag potential duplicates across sources
   - Implement merging strategy if needed

4. **Content Validation**
   - Check for malformed URLs
   - Validate location data
   - Ensure text fields don't contain HTML or script injection

5. **Consistency Checks**
   - Compare parsed data with expected patterns
   - Flag anomalies for manual review
   - Implement sanity checks (e.g., festivals should have future dates)

## Dev Tools Integration

The scraping solution should integrate with your dev tools for:

1. **Progress Monitoring**
   - Real-time scraping progress indicators
   - Error logging and reporting
   - Performance statistics

2. **Data Inspection**
   - Raw HTML viewer
   - Parsed data viewer in tabular format
   - Error highlighting and debugging tools

3. **Manual Controls**
   - Start/stop scraping buttons
   - Retry failed requests
   - Upload verification and confirmation

## Recommended Browser Configuration

For optimal scraping results, configure browsers with these settings:

```javascript
// Puppeteer recommended settings
const puppeteerOptions = {
  headless: false, // Use headless: 'new' for newer versions
  args: [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-dev-shm-usage',
    '--disable-accelerated-2d-canvas',
    '--disable-gpu',
    '--window-size=1920,1080',
  ],
  defaultViewport: {
    width: 1920,
    height: 1080
  },
  timeout: 60000
};

// Playwright recommended settings
const playwrightOptions = {
  headless: false,
  viewport: { width: 1920, height: 1080 },
  userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
  timeout: 60000
};
```

## Docker Setup

To ensure consistent environments between development and deployment, set up Docker:

```dockerfile
# Dockerfile
FROM node:18-slim

# Install required dependencies for browsers
RUN apt-get update && apt-get install -y \
    wget \
    gnupg \
    libgconf-2-4 \
    libxss1 \
    libappindicator1 \
    libindicator7 \
    xvfb \
    libnss3 \
    libasound2 \
    fonts-liberation \
    libgbm1 \
    libu2f-udev \
    xdg-utils \
    --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

# Install Chrome for Puppeteer/Playwright
RUN wget -q -O - https://dl-ssl.google.com/linux/linux_signing_key.pub | apt-key add - \
    && sh -c 'echo "deb [arch=amd64] http://dl.google.com/linux/chrome/deb/ stable main" >> /etc/apt/sources.list.d/google.list' \
    && apt-get update \
    && apt-get install -y google-chrome-stable \
    && rm -rf /var/lib/apt/lists/*

# Create app directory
WORKDIR /app

# Install app dependencies
COPY package*.json ./
RUN npm install

# Install browser automation tools
RUN npx playwright install-deps
RUN npx playwright install chromium
RUN npm install puppeteer

# Copy source files
COPY . .

# Create data directories
RUN mkdir -p data/raw data/processed

# Set entry point
ENTRYPOINT ["node", "scrapers/index.js"]
```

Docker Compose setup for development:

```yaml
# docker-compose.yml
version: '3'
services:
  scraper:
    build: .
    volumes:
      - ./data:/app/data
      - ./scrapers:/app/scrapers
    environment:
      - NODE_ENV=development
      - OPENAI_API_KEY=${OPENAI_API_KEY}
    command: ["node", "scrapers/index.js", "scrape", "partyflock"]
```

## Execution Commands

Run the scrapers using:

```bash
# Basic commands
npm run scrape partyflock   # Scrape Partyflock festivals
npm run parse partyflock    # Parse Partyflock data
npm run upload partyflock   # Upload Partyflock data to Supabase

# Combined execution
npm run all partyflock      # Scrape, parse, and upload Partyflock

# Run all scrapers
npm run all                 # Run all sources

# Docker execution
docker-compose run --rm scraper scrape partyflock
docker-compose run --rm scraper parse partyflock
docker-compose run --rm scraper upload partyflock
```

## Monitoring and Logging

Implement robust logging for tracking scraper execution:

```javascript
// logger.js
const fs = require('fs').promises;
const path = require('path');

class Logger {
  constructor(source) {
    this.source = source;
    this.logDir = path.join(process.cwd(), 'logs');
    this.logFile = path.join(this.logDir, `${source}_${new Date().toISOString().split('T')[0]}.log`);
    this.progress = {
      total: 0,
      current: 0,
      success: 0,
      error: 0
    };
  }

  async init() {
    await fs.mkdir(this.logDir, { recursive: true });
  }

  setTotal(total) {
    this.progress.total = total;
    this.progress.current = 0;
    this.progress.success = 0;
    this.progress.error = 0;
    this.log(`Starting scrape with ${total} items to process`);
  }

  increment(success = true) {
    this.progress.current++;
    if (success) {
      this.progress.success++;
    } else {
      this.progress.error++;
    }
    
    // Log progress every 10 items
    if (this.progress.current % 10 === 0) {
      this.log(`Progress: ${this.progress.current}/${this.progress.total} (${this.getPercentage()}%)`);
    }
  }

  getPercentage() {
    if (this.progress.total === 0) return 0;
    return Math.round((this.progress.current / this.progress.total) * 100);
  }

  getProgressStats() {
    return {
      total: this.progress.total,
      current: this.progress.current,
      success: this.progress.success,
      error: this.progress.error,
      percentage: this.getPercentage()
    };
  }

  async log(message, level = 'INFO') {
    const timestamp = new Date().toISOString();
    const logEntry = `[${timestamp}] [${level}] [${this.source}] ${message}\n`;
    
    // Log to console
    console.log(`[${level}] [${this.source}] ${message}`);
    
    // Log to file
    try {
      await fs.appendFile(this.logFile, logEntry);
    } catch (error) {
      console.error(`Error writing to log file: ${error}`);
    }
  }

  async error(message, error) {
    const errorMessage = `${message}: ${error.message}`;
    await this.log(errorMessage, 'ERROR');
    
    // Log stack trace for debugging
    if (error.stack) {
      await this.log(`Stack trace: ${error.stack}`, 'DEBUG');
    }
  }
}

module.exports = Logger;
```

## Security Considerations

When implementing web scraping, be mindful of these security practices:

1. **Credential Protection**
   - Never hardcode API keys or secrets
   - Use environment variables or secure storage
   - Rotate credentials regularly

2. **Input Validation**
   - Sanitize all input from external sources
   - Validate URLs before navigation
   - Implement content security policies

3. **Rate Limiting**
   - Respect websites' robots.txt
   - Implement self-imposed rate limits
   - Monitor for response code changes

4. **Data Protection**
   - Minimize data collection to what's needed
   - Implement proper data storage security
   - Don't store sensitive user data

## Best Practices for Maintainability

For long-term success with the scraping solution:

1. **Documentation**
   - Document the CSS selectors used for each site
   - Maintain a changelog of website structure changes
   - Create a troubleshooting guide for common issues

2. **Modular Design**
   - Keep scraper implementations separate
   - Use dependency injection for components
   - Implement clear interfaces between modules

3. **Testing Strategy**
   - Create unit tests for parsing functions
   - Implement integration tests for complete flow
   - Set up monitoring for production scrapers

4. **Maintenance Schedule**
   - Weekly checks of scraper functionality
   - Monthly reviews of website structure changes
   - Quarterly audits of data quality and completeness
