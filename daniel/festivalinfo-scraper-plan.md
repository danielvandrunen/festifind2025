# FestivalInfo Scraper Implementation Plan

## Overview
This document outlines the implementation plan for creating a scraper for [festivalinfo.nl](https://www.festivalinfo.nl/festivals/) to extract festival data. This scraper will be developed as a completely isolated service from the existing eblive scraper to prevent any cross-contamination of code or bugs.

## Website Structure Analysis

### Pagination
- Base URL: `https://www.festivalinfo.nl/festivals/`
- Pagination format: `?page=X` where X is the page number (e.g., `?page=1`, `?page=2`, etc.)
- Navigation: "Vorige week" and "Volgende week" links at the top and bottom of the festival listing
- Other views available: per week, per month, alphabetical, free, and by region

### DOM Selectors for Festival Listings
Based on analysis of the website's structure:

1. **Festival Listings Container**: Festival entries appear within a list format without specific class identifiers
2. **Festival Item Selectors**:
   - Festival links: `a[href*="/festival/"]`
   - Festival name: `strong` element inside the link
   - Festival details: Text content after the `strong` element in the same link 
   - Special features: Text containing "festival is gratis", "festival heeft camping"

### Festival Data Available
Based on the analysis of festival listings and individual festival pages:

1. **From listing page:**
   - Festival name
   - Location (city, country)
   - Duration (days)
   - Date range (when available in format "(1/5)" indicating day 1 of 5)
   - Number of acts
   - Special features (free, camping available, etc.)

2. **From individual festival page:**
   - Detailed description: Within paragraph tags following the page header
   - Ticket information: In the "BESTEL TICKETS VOOR DIT FESTIVAL" section
   - Venue details: In the "Festival locaties" section
   - Artist lineup: In the "Bevestigde artiesten" section, each artist has its own link and image
   - Historical information: In the "HISTORIE" section, showing previous editions
   - Travel information: In the "REISINFORMATIE" section
   - News related to the festival: In the section with links to news articles
   - User engagement: In "LEDEN DIE HIER NAAR TOE GAAN" and similar sections

## Technical Implementation

### Scraper Architecture
1. **Separate Docker Container**
   - Create a new service in docker-compose.yml:
   ```yaml
   festivalinfo-scraper:
     build:
       context: .
       dockerfile: Dockerfile.festivalinfo
     volumes:
       - ./scrapers/festivalinfo:/app/scrapers/festivalinfo
       - ./data:/app/data
       - ./logs:/app/logs
     environment:
       - LOG_LEVEL=info
       - DOCKER=true
     command: node scrapers/festivalinfo/index.js
   ```
   - Create a dedicated Dockerfile.festivalinfo:
   ```Dockerfile
   FROM node:18-alpine
   
   WORKDIR /app
   
   # Install Playwright dependencies
   RUN apk add --no-cache \
       chromium \
       ffmpeg \
       libwebp \
       libstdc++ \
       g++ \
       ca-certificates
   
   # Set Playwright browser binary paths
   ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright
   ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
   
   # Copy package files
   COPY package*.json ./
   
   # Install dependencies
   RUN npm ci
   
   # Copy source code
   COPY . .
   
   # Set up log directory
   RUN mkdir -p logs
   
   # Run the scraper
   CMD ["node", "scrapers/festivalinfo/index.js"]
   ```

2. **Directory Structure**
```
/scrapers/
  /eblive2/            # Existing scraper
    eblive2.js
    eblive2.ts
  /festivalinfo/       # New scraper
    index.js           # Main entry point
    parser.js          # HTML parsing logic
    api.js             # API interactions with Supabase
    config.js          # Configuration
    models/            # Data models
      festival.js      # Festival data model
      artist.js        # Artist data model
    utils/             # Utility functions
      date-parser.js   # Date parsing utilities (Dutch formats)
      text-cleaner.js  # Text cleaning utilities
      hash-generator.js # Hash generation for deduplication
    tests/             # Unit tests
```

3. **Tech Stack**
   - Node.js
   - Playwright for browser automation (matching eblive2 scraper)
   - Winston for logging (matching eblive2 configuration)
   - Jest for testing

### Scraping Strategy

1. **Initial Setup**
   - Configure throttling/rate limiting to avoid overloading the server:
   ```javascript
   const delay = process.env.SCRAPER_DELAY || 2000; // 2 seconds between requests
   const delayBetweenPages = async () => new Promise(resolve => setTimeout(resolve, delay));
   ```
   - Set up user agent rotation:
   ```javascript
   const userAgents = [
     'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
     'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.1.1 Safari/605.1.15',
     // Add more user agents
   ];
   ```
   - Implement error handling and retry logic:
   ```javascript
   async function fetchWithRetry(url, options = {}, maxRetries = 3) {
     let retries = 0;
     while (retries < maxRetries) {
       try {
         return await page.goto(url, { waitUntil: 'networkidle' });
       } catch (err) {
         retries++;
         logger.warn(`Fetch failed, retrying ${retries}/${maxRetries}`, { url, error: err.message });
         await delayBetweenPages();
       }
     }
     throw new Error(`Failed to fetch ${url} after ${maxRetries} retries`);
   }
   ```

2. **Pagination Handling**
   - Start with page 1 and crawl through all pages:
   ```javascript
   // Extract page info to determine how many pages to crawl
   const getPageCount = async (page) => {
     const lastPageLink = await page.evaluate(() => {
       const pagination = Array.from(document.querySelectorAll('a[href*="?page="]'));
       return pagination.length > 0 ? 
         Math.max(...pagination.map(link => {
           const match = link.href.match(/\?page=(\d+)/);
           return match ? parseInt(match[1]) : 0;
         })) : 0;
     });
     return lastPageLink || 0;
   };
   ```
   - Navigate through pages:
   ```javascript
   for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
     await page.goto(`https://www.festivalinfo.nl/festivals/?page=${pageNum}`);
     // Scrape festivals on this page
   }
   ```

3. **Data Extraction**
   - Festival list extraction function:
   ```javascript
   async function extractFestivalList(page) {
     return page.evaluate(() => {
       const festivals = [];
       const festivalLinks = document.querySelectorAll('a[href*="/festival/"]');
       
       festivalLinks.forEach(link => {
         // Only process links that are direct festival listings (not sidebar links)
         if (!link.querySelector('strong')) return;
         
         const nameElement = link.querySelector('strong');
         const name = nameElement ? nameElement.textContent.trim() : '';
         
         // Extract ID from URL
         const urlMatch = link.href.match(/\/festival\/(\d+)\//);
         const id = urlMatch ? urlMatch[1] : '';
         
         // Extract details from link text content
         const fullText = link.textContent.trim();
         const detailsText = fullText.replace(name, '').trim();
         
         // Parse location, duration, etc.
         const locationMatch = detailsText.match(/([^,]+),\s*([^,]+)/);
         const location = locationMatch ? 
           { city: locationMatch[1].trim(), country: locationMatch[2].trim() } : 
           { city: '', country: '' };
         
         const durationMatch = detailsText.match(/(\d+)\s+dag(en)?/);
         const duration = durationMatch ? parseInt(durationMatch[1]) : 1;
         
         const dateRangeMatch = detailsText.match(/\((\d+)\/(\d+)\)/);
         const dateRange = dateRangeMatch ? 
           { current: parseInt(dateRangeMatch[1]), total: parseInt(dateRangeMatch[2]) } : 
           null;
         
         const numActsMatch = detailsText.match(/(\d+)(?!\/)(?!\s+dag)/);
         const numActs = numActsMatch ? parseInt(numActsMatch[1]) : 0;
         
         const isFree = detailsText.includes('festival is gratis');
         const hasCamping = detailsText.includes('festival heeft camping');
         
         festivals.push({
           id,
           name,
           url: link.href,
           location,
           duration,
           dateRange,
           numActs,
           isFree,
           hasCamping,
           source: 'festivalinfo.nl',
           scrapedAt: new Date().toISOString()
         });
       });
       
       return festivals;
     });
   }
   ```
   - Festival detail page extraction:
   ```javascript
   async function extractFestivalDetails(page, festivalUrl) {
     await page.goto(festivalUrl, { waitUntil: 'networkidle' });
     
     // Extract details using page.evaluate with proper selectors
     return page.evaluate(() => {
       // Description
       const descriptionElem = document.querySelector('p:nth-of-type(1)');
       const description = descriptionElem ? descriptionElem.textContent.trim() : '';
       
       // Dates
       const dateText = Array.from(document.querySelectorAll('strong:not([class])'))
         .map(el => el.textContent.trim())
         .filter(txt => txt.match(/^\d+$/))
         .join(' ');
         
       // Artists
       const artists = Array.from(document.querySelectorAll('.Bevestigde artiesten a'))
         .map(link => ({
           name: link.querySelector('paragraph') ? link.querySelector('paragraph').textContent.trim() : '',
           url: link.href
         }));
       
       // Travel info
       const travelInfo = document.querySelector('h2:contains("REISINFORMATIE") + p');
       
       // Return structured data
       return {
         description,
         dateText,
         artists,
         travelInfo: travelInfo ? travelInfo.textContent : ''
       };
     });
   }
   ```

4. **Data Processing**
   - Normalize location data:
   ```javascript
   function normalizeLocation(location) {
     if (!location) return { city: '', country: '' };
     
     // Standardize Netherlands variants
     if (location.country.match(/^(nederland|the netherlands|holland|pays-bas)$/i)) {
       location.country = 'Nederland';
     }
     
     // Standardize Belgium variants
     if (location.country.match(/^(belgi(ë|e)|belgium|belgique)$/i)) {
       location.country = 'België';
     }
     
     return location;
   }
   ```
   - Standardize date formats:
   ```javascript
   function parseDutchDate(dateStr) {
     // Reuse the date parsing logic from eblive2.js but adapt for festivalinfo.nl format
     const months = {
       'jan': 0, 'feb': 1, 'mrt': 2, 'apr': 3, 'mei': 4, 'jun': 5,
       'jul': 6, 'aug': 7, 'sep': 8, 'okt': 9, 'nov': 10, 'dec': 11
     };
     
     // Implementation similar to eblive2 parseDate function
   }
   ```

5. **Data Storage**
   - Store extracted data in the Supabase database but in separate tables:
   ```javascript
   async function storeFestivalData(festivals) {
     const { createClient } = require('@supabase/supabase-js');
     
     const supabase = createClient(
       process.env.NEXT_PUBLIC_SUPABASE_URL,
       process.env.SUPABASE_SERVICE_KEY
     );
     
     for (const festival of festivals) {
       const { data, error } = await supabase
         .from('festival_info_festivals')
         .upsert({
           festival_id: festival.id,
           name: festival.name,
           url: festival.url,
           location_city: festival.location.city,
           location_country: festival.location.country,
           start_date: festival.startDate,
           end_date: festival.endDate,
           duration: festival.duration,
           num_acts: festival.numActs,
           is_free: festival.isFree,
           has_camping: festival.hasCamping,
           description: festival.description,
           created_at: new Date(),
           updated_at: new Date()
         }, { onConflict: 'festival_id' });
         
       if (error) {
         logger.error(`Error storing festival ${festival.id}`, { error });
       }
       
       // Store artists if available
       if (festival.artists && festival.artists.length > 0) {
         for (const artist of festival.artists) {
           const { error: artistError } = await supabase
             .from('festival_info_acts')
             .insert({
               festival_id: festival.id,
               name: artist.name,
               url: artist.url
             });
             
           if (artistError) {
             logger.error(`Error storing artist for festival ${festival.id}`, { error: artistError });
           }
         }
       }
     }
   }
   ```

## Database Schema

```sql
-- Separate schema for festival_info data to maintain isolation
CREATE SCHEMA IF NOT EXISTS festival_info;

-- Main festivals table
CREATE TABLE festival_info.festivals (
  id SERIAL PRIMARY KEY,
  festival_id VARCHAR(50) UNIQUE NOT NULL, -- Original ID from festivalinfo.nl
  name VARCHAR(255) NOT NULL,
  url TEXT NOT NULL,
  description TEXT,
  location_city VARCHAR(100),
  location_country VARCHAR(100),
  start_date DATE,
  end_date DATE,
  duration INTEGER,
  num_acts INTEGER,
  is_free BOOLEAN,
  has_camping BOOLEAN,
  ticket_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Artists/acts table
CREATE TABLE festival_info.acts (
  id SERIAL PRIMARY KEY,
  festival_id VARCHAR(50) REFERENCES festival_info.festivals(festival_id),
  name VARCHAR(255) NOT NULL,
  url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Scraping runs tracking
CREATE TABLE festival_info.scrape_runs (
  id SERIAL PRIMARY KEY,
  start_time TIMESTAMP WITH TIME ZONE NOT NULL,
  end_time TIMESTAMP WITH TIME ZONE,
  total_festivals INTEGER DEFAULT 0,
  unique_festivals INTEGER DEFAULT 0,
  errors INTEGER DEFAULT 0,
  status VARCHAR(50) DEFAULT 'running',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

## Integration Plan

1. **API Endpoints**
   - Create new API endpoints specifically for festivalinfo data:
   ```javascript
   // File: pages/api/festivals/festivalinfo.js
   import { createClient } from '@supabase/supabase-js';

   export default async function handler(req, res) {
     const supabase = createClient(
       process.env.NEXT_PUBLIC_SUPABASE_URL,
       process.env.SUPABASE_SERVICE_KEY
     );
     
     const { data, error } = await supabase
       .from('festival_info.festivals')
       .select('*')
       .order('start_date', { ascending: true });
       
     if (error) {
       return res.status(500).json({ error: error.message });
     }
     
     return res.status(200).json(data);
   }
   ```

2. **Scheduled Execution**
   - Create a script to run the scraper on a schedule:
   ```javascript
   // File: scripts/run-festivalinfo-scraper.js
   const { execSync } = require('child_process');
   const path = require('path');

   console.log('Starting FestivalInfo scraper run...');
   
   try {
     // Run the scraper in a Docker container
     execSync('docker-compose run --rm festivalinfo-scraper', { 
       stdio: 'inherit',
       cwd: path.resolve(__dirname, '..')
     });
     console.log('FestivalInfo scraper completed successfully');
   } catch (error) {
     console.error('Error running FestivalInfo scraper:', error);
     process.exit(1);
   }
   ```
   - Set up a GitHub Actions workflow to run on a schedule:
   ```yaml
   # .github/workflows/festivalinfo-scraper.yml
   name: Run FestivalInfo Scraper

   on:
     schedule:
       - cron: '0 2 * * *'  # Run daily at 2 AM UTC
     workflow_dispatch: # Allow manual triggering

   jobs:
     scrape:
       runs-on: ubuntu-latest
       steps:
         - uses: actions/checkout@v3
         
         - name: Set up Docker Buildx
           uses: docker/setup-buildx-action@v2
           
         - name: Run FestivalInfo Scraper
           run: |
             docker-compose build festivalinfo-scraper
             docker-compose run --rm festivalinfo-scraper
   ```

3. **Error Reporting**
   - Implement logging with Winston (same as eblive scraper)
   - Set up error alerts with a Discord webhook integration:
   ```javascript
   // utils/discord-alerts.js
   const fetch = require('node-fetch');

   async function sendDiscordAlert(message, level = 'info') {
     const webhookUrl = process.env.DISCORD_WEBHOOK_URL;
     if (!webhookUrl) return;
     
     const color = level === 'error' ? 16711680 : level === 'warn' ? 16776960 : 65280;
     
     try {
       await fetch(webhookUrl, {
         method: 'POST',
         headers: { 'Content-Type': 'application/json' },
         body: JSON.stringify({
           embeds: [{
             title: `FestivalInfo Scraper ${level.toUpperCase()}`,
             description: message,
             color,
             timestamp: new Date().toISOString()
           }]
         })
       });
     } catch (error) {
       console.error('Failed to send Discord alert:', error);
     }
   }

   module.exports = { sendDiscordAlert };
   ```

## Testing Plan

1. **Unit Tests**
   ```javascript
   // tests/parser.test.js
   const { extractFestivalList } = require('../scrapers/festivalinfo/parser');
   
   describe('Festival Parser', () => {
     test('should extract festival data from HTML', async () => {
       const mockPage = {
         evaluate: jest.fn().mockResolvedValue([
           {
             id: '12345',
             name: 'Test Festival',
             url: 'https://www.festivalinfo.nl/festival/12345/Test-Festival/2025/',
             location: { city: 'Amsterdam', country: 'Nederland' },
             duration: 3,
             isFree: false,
             hasCamping: true
           }
         ])
       };
       
       const festivals = await extractFestivalList(mockPage);
       expect(festivals).toHaveLength(1);
       expect(festivals[0].name).toBe('Test Festival');
       expect(festivals[0].duration).toBe(3);
     });
   });
   ```

2. **Integration Tests**
   ```javascript
   // tests/scraper.integration.test.js
   const { scrapeFestivalInfo } = require('../scrapers/festivalinfo');
   
   describe('FestivalInfo Scraper Integration', () => {
     test('should scrape festivals and store in database', async () => {
       // This test requires a running database
       // Consider using a mock or test database
       const result = await scrapeFestivalInfo({ 
         maxPages: 1,
         testMode: true 
       });
       
       expect(result.totalFestivals).toBeGreaterThan(0);
       expect(result.errors).toBe(0);
     }, 30000); // Longer timeout for integration test
   });
   ```

3. **Validation Tests**
   ```javascript
   // utils/data-validator.js
   function validateFestival(festival) {
     const errors = [];
     
     if (!festival.name) errors.push('Missing festival name');
     if (!festival.festival_id) errors.push('Missing festival ID');
     
     // Date validation
     if (festival.start_date && festival.end_date) {
       const start = new Date(festival.start_date);
       const end = new Date(festival.end_date);
       
       if (isNaN(start.getTime())) errors.push('Invalid start date');
       if (isNaN(end.getTime())) errors.push('Invalid end date');
       if (start > end) errors.push('Start date is after end date');
     }
     
     return { isValid: errors.length === 0, errors };
   }
   
   module.exports = { validateFestival };
   ```

## Implementation Phases

### Phase 1: Setup & Basic Scraping
- Create project structure following the outlined directory structure
- Set up Docker configuration and test container build
- Implement basic HTTP client using Playwright
- Develop HTML parsing logic for festival listings
- Build pagination handling

### Phase 2: Detailed Data Extraction
- Implement festival detail page scraping
- Extract artist information with proper selectors
- Build data cleaning utilities for dates, text, and locations
- Create hashing function for deduplication

### Phase 3: Storage & Integration
- Create database schema in Supabase
- Implement data storage logic with upsert support
- Set up scheduled execution via GitHub Actions
- Configure logging and error reporting

### Phase 4: Testing & Refinement
- Write unit tests for parsers and utilities
- Create integration tests for the full scraping pipeline
- Implement data validation checks
- Set up monitoring and alerting
- Optimize performance with proper delays and retries

## Potential Challenges

1. **Website Changes**
   - Implement monitoring for HTML structure changes:
   ```javascript
   function monitorSelectorEfficiency(selector, expectedCount, page) {
     const count = await page.evaluate((sel) => document.querySelectorAll(sel).length, selector);
     
     if (count < expectedCount * 0.5) { // If less than 50% of expected elements found
       logger.warn(`Selector efficiency warning: ${selector} found ${count} elements (expected ~${expectedCount})`);
       sendDiscordAlert(`Possible website structure change: ${selector} is now returning ${count} elements`, 'warn');
     }
   }
   ```

2. **Rate Limiting**
   - Implement exponential backoff:
   ```javascript
   async function delayWithBackoff(attempt) {
     const baseDelay = 2000; // 2 seconds
     const maxDelay = 60000; // 1 minute
     const delay = Math.min(baseDelay * Math.pow(1.5, attempt), maxDelay);
     
     logger.info(`Backing off for ${delay}ms (attempt ${attempt})`);
     await new Promise(resolve => setTimeout(resolve, delay));
   }
   ```

3. **Data Inconsistencies**
   - Build robust validation:
   ```javascript
   function validateScrapedData(festivals) {
     const validFestivals = [];
     const invalidFestivals = [];
     
     for (const festival of festivals) {
       const { isValid, errors } = validateFestival(festival);
       
       if (isValid) {
         validFestivals.push(festival);
       } else {
         logger.warn(`Invalid festival data for ${festival.name}`, { errors });
         invalidFestivals.push({ festival, errors });
       }
     }
     
     return { validFestivals, invalidFestivals };
   }
   ```

## Conclusion
This scraper will be implemented as a completely isolated service from the eblive scraper, with its own codebase, database tables, and execution schedule. This approach will ensure that any issues with one scraper do not affect the other, while still allowing the data to be used together in the FestiFind application. 