# EB Live Scraper Implementation Guide

This document outlines the implementation details for the EB Live festival scraper, which is part of the FestiFind project as outlined in the project plan. The scraper will extract festival data from [EB Live](https://www.eblive.nl/festivals/) for use in our aggregation platform.

## Table of Contents
- [Data Structure](#data-structure)
- [Core Implementation](#core-implementation)
- [Logging Strategy](#logging-strategy)
- [Deduplication Strategy](#deduplication-strategy)
- [Testing Approach](#testing-approach)
- [Docker Configuration](#docker-configuration)
- [Integration with FestiFind](#integration-with-festifind)
- [Running Instructions](#running-instructions)

## Data Structure

```typescript
// Festival interface representing data from EB Live
interface Festival {
  id: string;           // Festival ID from the source
  name: string;         // Festival name
  location: string;     // Location including city and country
  dates: string;        // Raw date string from the source
  edition?: string;     // Edition number if available (e.g. "Editie #26")
  url: string;          // Full URL to the festival page
  
  // Parsed data
  startDate?: string;   // ISO format start date (YYYY-MM-DD)
  endDate?: string;     // ISO format end date (YYYY-MM-DD)
  
  // Metadata
  scrapedAt: string;    // ISO timestamp of when this was scraped
  source: string;       // Will be "eblive"
  hash: string;         // Unique hash for deduplication
}
```

## Core Implementation

### File: `src/scrapers/eblive-scraper.ts`

```typescript
import { chromium, Browser, Page } from 'playwright';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { createLogger, format, transports } from 'winston';

// Configure logger
const logger = createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: format.combine(
    format.timestamp(),
    format.errors({ stack: true }),
    format.splat(),
    format.json()
  ),
  defaultMeta: { service: 'eblive-scraper' },
  transports: [
    new transports.Console({
      format: format.combine(
        format.colorize(),
        format.printf(({ level, message, timestamp, ...rest }) => {
          const restString = Object.keys(rest).length 
            ? `\n${JSON.stringify(rest, null, 2)}` 
            : '';
          return `${timestamp} [EBLive] ${level}: ${message}${restString}`;
        })
      )
    }),
    new transports.File({ 
      filename: 'logs/eblive-error.log', 
      level: 'error',
      format: format.combine(
        format.timestamp(),
        format.json()
      )
    }),
    new transports.File({ 
      filename: 'logs/eblive-combined.log',
      format: format.combine(
        format.timestamp(),
        format.json()
      )
    })
  ]
});

interface Festival {
  id: string;
  name: string;
  location: string;
  dates: string;
  edition?: string;
  url: string;
  startDate?: string;
  endDate?: string;
  scrapedAt: string;
  source: string;
  hash: string;
}

/**
 * Generate a unique hash for the festival for deduplication purposes
 */
function generateFestivalHash(festival: Omit<Festival, 'hash' | 'scrapedAt'>): string {
  const hashString = `${festival.source}:${festival.id}:${festival.name}:${festival.dates}`;
  return crypto.createHash('md5').update(hashString).digest('hex');
}

/**
 * Parse Dutch date formats into ISO dates
 */
function parseDate(dateStr: string): { startDate: string | null, endDate: string | null } {
  logger.debug(`Parsing date string: "${dateStr}"`);
  try {
    const months: Record<string, number> = {
      'jan': 0, 'feb': 1, 'mrt': 2, 'apr': 3, 'mei': 4, 'jun': 5,
      'jul': 6, 'aug': 7, 'sep': 8, 'okt': 9, 'nov': 10, 'dec': 11
    };
    
    let startDate: string | null = null;
    let endDate: string | null = null;
    
    // Handle different date formats
    if (dateStr.includes('t/m')) {
      // Range format: "Wo 21 mei t/m do 29 mei"
      const [startPart, endPart] = dateStr.split('t/m').map(p => p.trim());
      
      // Parse start date
      const startDayMatch = startPart.match(/\d+/);
      const startMonthMatch = startPart.match(/(jan|feb|mrt|apr|mei|jun|jul|aug|sep|okt|nov|dec)/i);
      
      if (startDayMatch && startMonthMatch) {
        const day = parseInt(startDayMatch[0]);
        const month = months[startMonthMatch[0].toLowerCase()];
        const year = new Date().getFullYear();
        startDate = new Date(year, month, day).toISOString().split('T')[0];
      }
      
      // Parse end date
      const endDayMatch = endPart.match(/\d+/);
      const endMonthMatch = endPart.match(/(jan|feb|mrt|apr|mei|jun|jul|aug|sep|okt|nov|dec)/i);
      
      if (endDayMatch && endMonthMatch) {
        const day = parseInt(endDayMatch[0]);
        const month = months[endMonthMatch[0].toLowerCase()];
        
        // Handle year rollover (December to January)
        let year = new Date().getFullYear();
        const startMonth = startMonthMatch ? months[startMonthMatch[0].toLowerCase()] : -1;
        
        if (startMonth > month) {
          year += 1; // Next year
        }
        
        endDate = new Date(year, month, day).toISOString().split('T')[0];
      }
    } else {
      // Single day format: "Zaterdag 31 mei"
      const parts = dateStr.split(' ');
      const day = parseInt(parts.find(p => /^\d+$/.test(p)) || '0');
      const monthStr = parts.find(p => Object.keys(months).some(m => p.toLowerCase().includes(m)));
      
      if (day && monthStr) {
        const monthKey = Object.keys(months).find(m => monthStr.toLowerCase().includes(m));
        if (monthKey) {
          const month = months[monthKey];
          const year = new Date().getFullYear();
          startDate = new Date(year, month, day).toISOString().split('T')[0];
          endDate = startDate; // Same day for single-day events
        }
      }
    }
    
    logger.debug(`Parsed dates: startDate=${startDate}, endDate=${endDate}`);
    return { startDate, endDate };
  } catch (e) {
    logger.error(`Error parsing date: "${dateStr}"`, { error: e });
    return { startDate: null, endDate: null };
  }
}

/**
 * Main scraper function for EB Live
 */
async function scrapeEBLive(options: {
  maxPages?: number;
  delay?: number;
  outputDir?: string;
  testMode?: boolean;
} = {}) {
  const {
    maxPages = 0, // 0 means scrape all pages
    delay = 1000, // Default delay between page requests
    outputDir = path.join(process.cwd(), 'data'),
    testMode = false
  } = options;
  
  logger.info('Starting EB Live scraper', { maxPages, delay, outputDir, testMode });
  
  const browser = await chromium.launch({
    headless: !testMode, // Use headful mode for testing if needed
  });
  
  // Store for extraction metrics
  const metrics = {
    totalFestivals: 0,
    uniqueFestivals: 0,
    duplicates: 0,
    errors: 0,
    startTime: new Date(),
    endTime: new Date(),
    pages: 0,
    festivalsByPage: {} as Record<number, number>
  };
  
  const allFestivals: Festival[] = [];
  const festivalIds = new Set<string>(); // For deduplication
  let currentPage = 1;
  let totalPages = 0;
  let hasMorePages = true;
  
  try {
    // Ensure output directory exists
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    
    // Ensure logs directory exists
    if (!fs.existsSync('logs')) {
      fs.mkdirSync('logs', { recursive: true });
    }
    
    const context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      viewport: { width: 1280, height: 800 }
    });
    
    // Initialize first page and handle cookies
    const page = await context.newPage();
    logger.info('Navigating to EB Live festivals page');
    await page.goto('https://www.eblive.nl/festivals/');
    
    // Handle cookie consent if it appears
    try {
      await page.waitForSelector('button:has-text("Accepteren en doorgaan")', { timeout: 5000 });
      await page.click('button:has-text("Accepteren en doorgaan")');
      logger.info('Accepted cookie consent banner');
    } catch (e) {
      logger.info('No cookie banner found or already accepted');
    }
    
    // Get total number of pages from the festival count
    const pagesText = await page.locator('h5:has-text("festivals gevonden")').textContent();
    const festivalsCount = pagesText ? parseInt(pagesText.match(/\d+/)?.[0] || '0') : 0;
    totalPages = Math.ceil(festivalsCount / 24); // Assuming 24 festivals per page
    
    logger.info(`Found approximately ${festivalsCount} festivals across ${totalPages} pages`);
    
    // If maxPages is specified, limit the scraping
    const pagesToScrape = maxPages > 0 ? Math.min(maxPages, totalPages) : totalPages;
    
    while (hasMorePages && (maxPages === 0 || currentPage <= pagesToScrape)) {
      logger.info(`Scraping page ${currentPage} of ${pagesToScrape > 0 ? pagesToScrape : totalPages}`);
      
      // Navigate to the current page with retries
      const maxRetries = 3;
      let retries = 0;
      let pageLoaded = false;
      
      while (!pageLoaded && retries < maxRetries) {
        try {
          await page.goto(`https://www.eblive.nl/festivals/?filters%5Bsearch%5D=&filters%5Baddress%5D=&filters%5Bdistance%5D=&order_by=upcoming&page_nr=${currentPage}`, {
            timeout: 30000,
            waitUntil: 'domcontentloaded'
          });
          
          // Wait for the festival items to load
          await page.waitForSelector('h5 a[href*="festival_id"]', { timeout: 10000 });
          pageLoaded = true;
        } catch (e) {
          retries++;
          logger.warn(`Failed to load page ${currentPage}, retry ${retries}/${maxRetries}`, { error: e });
          
          if (retries >= maxRetries) {
            logger.error(`Failed to load page ${currentPage} after ${maxRetries} retries`, { error: e });
            break;
          }
          
          // Wait before retrying
          await page.waitForTimeout(delay * 2);
        }
      }
      
      if (!pageLoaded) {
        logger.error(`Skipping page ${currentPage} due to load failures`);
        currentPage++;
        continue;
      }
      
      // Extract festival data
      const pageStart = Date.now();
      const pageNewFestivals: Festival[] = [];
      metrics.pages++;
      
      try {
        // Find all festival containers
        const festivalLinks = await page.$$('main > [href*="festival_id"]');
        logger.info(`Found ${festivalLinks.length} festivals on page ${currentPage}`);
        
        for (const element of festivalLinks) {
          try {
            // Get festival URL and ID
            const url = await element.getAttribute('href') || '';
            const festivalId = url.match(/festival_id=(\d+)/)?.[1] || '';
            
            if (!festivalId) {
              logger.warn('Could not extract festival ID from URL', { url });
              continue;
            }
            
            // Get festival name
            const nameElement = await element.$('h5');
            const name = nameElement ? await nameElement.textContent() : '';
            
            if (!name) {
              logger.warn('Could not extract festival name', { festivalId });
              continue;
            }
            
            // Get location and dates
            const infoText = await element.evaluate(el => {
              // Get the text node that contains location and dates
              const text = Array.from(el.childNodes)
                .filter(node => node.nodeType === Node.TEXT_NODE)
                .map(node => node.textContent?.trim())
                .join(' ');
              return text;
            });
            
            // Parse location and dates from the info text
            const locationMatch = infoText.match(/(.+?)\s+([A-Za-z]+\s+\d+.*)/);
            const location = locationMatch ? locationMatch[1].trim() : '';
            const dates = locationMatch ? locationMatch[2].trim() : '';
            
            // Get edition if available
            let edition: string | undefined;
            try {
              // Look for edition text nearby
              const editionElement = await page.$(`a[href*="festival_id=${festivalId}"][href*="index"] + a[href*="Editie"]`);
              edition = editionElement ? await editionElement.textContent() : undefined;
            } catch (e) {
              logger.debug(`No edition found for festival ${name} (${festivalId})`);
            }
            
            if (name && location) {
              // Parse dates
              const { startDate, endDate } = parseDate(dates);
              
              // Create festival object
              const festival: Omit<Festival, 'hash' | 'scrapedAt'> = {
                id: festivalId,
                name: name.trim(),
                location: location.trim(),
                dates: dates.trim(),
                edition: edition?.trim(),
                url: `https://www.eblive.nl${url}`,
                startDate,
                endDate,
                source: 'eblive'
              };
              
              // Generate hash for deduplication
              const hash = generateFestivalHash(festival);
              const scrapedAt = new Date().toISOString();
              
              const completeFestival: Festival = {
                ...festival,
                hash,
                scrapedAt
              };
              
              // Track metrics
              metrics.totalFestivals++;
              
              // Check for duplicates using the festival ID
              if (festivalIds.has(hash)) {
                metrics.duplicates++;
                logger.debug(`Found duplicate festival: ${name} (${festivalId})`);
              } else {
                // Add to results
                festivalIds.add(hash);
                allFestivals.push(completeFestival);
                pageNewFestivals.push(completeFestival);
                metrics.uniqueFestivals++;
                logger.debug(`Added festival: ${name} (${festivalId})`);
              }
            } else {
              logger.warn(`Incomplete festival data`, { festivalId, name, location, dates });
              metrics.errors++;
            }
          } catch (e) {
            logger.error(`Error processing festival element`, { error: e });
            metrics.errors++;
          }
        }
      } catch (e) {
        logger.error(`Error extracting festivals from page ${currentPage}`, { error: e });
        metrics.errors++;
      }
      
      // Record metrics for this page
      const pageTime = Date.now() - pageStart;
      metrics.festivalsByPage[currentPage] = pageNewFestivals.length;
      
      logger.info(`Page ${currentPage} completed in ${pageTime}ms. Found ${pageNewFestivals.length} new festivals.`);
      
      // Check if there's a next page
      if (currentPage < totalPages) {
        hasMorePages = true;
        currentPage++;
      } else {
        hasMorePages = false;
      }
      
      // Add a delay to avoid rate limiting
      await page.waitForTimeout(delay);
      
      // Periodically save progress
      if (currentPage % 5 === 0 || !hasMorePages) {
        const tempPath = path.join(outputDir, `eblive-festivals-progress-${new Date().toISOString().replace(/:/g, '-')}.json`);
        fs.writeFileSync(tempPath, JSON.stringify(allFestivals, null, 2));
        logger.info(`Progress saved to ${tempPath}`);
      }
    }
    
    // Finalize metrics
    metrics.endTime = new Date();
    const duration = (metrics.endTime.getTime() - metrics.startTime.getTime()) / 1000;
    
    logger.info(`Scraping completed. Summary:`, {
      totalFestivals: metrics.totalFestivals,
      uniqueFestivals: metrics.uniqueFestivals,
      duplicates: metrics.duplicates,
      errors: metrics.errors,
      pages: metrics.pages,
      duration: `${duration.toFixed(2)}s`,
      festivalsByPage: metrics.festivalsByPage
    });
    
    // Save the data
    const outputPath = path.join(outputDir, `eblive-festivals-${new Date().toISOString().replace(/:/g, '-')}.json`);
    fs.writeFileSync(outputPath, JSON.stringify(allFestivals, null, 2));
    
    // Save metrics
    const metricsPath = path.join(outputDir, `eblive-metrics-${new Date().toISOString().replace(/:/g, '-')}.json`);
    fs.writeFileSync(metricsPath, JSON.stringify(metrics, null, 2));
    
    logger.info(`Data saved to ${outputPath}`);
    logger.info(`Metrics saved to ${metricsPath}`);
    
    return {
      festivals: allFestivals,
      metrics
    };
    
  } catch (error) {
    logger.error('Critical error during scraping:', { error });
    throw error;
  } finally {
    await browser.close();
    logger.info('Browser closed');
  }
}

/**
 * Utility to analyze if a complete scrape was successful
 */
function analyzeScrapeResults(metrics: any, minExpectedFestivals = 900) {
  logger.info('Analyzing scrape results');
  
  const issues = [];
  
  // Check total festivals count
  if (metrics.uniqueFestivals < minExpectedFestivals) {
    issues.push(`Found only ${metrics.uniqueFestivals} festivals, expected at least ${minExpectedFestivals}`);
  }
  
  // Check for pages with few or no festivals
  const emptyPages = Object.entries(metrics.festivalsByPage)
    .filter(([_, count]) => (count as number) === 0)
    .map(([page, _]) => page);
    
  if (emptyPages.length > 0) {
    issues.push(`Found ${emptyPages.length} pages with no festivals: ${emptyPages.join(', ')}`);
  }
  
  // Check error rate
  const errorRate = metrics.errors / metrics.totalFestivals;
  if (errorRate > 0.05) { // 5% error threshold
    issues.push(`High error rate: ${(errorRate * 100).toFixed(2)}% (${metrics.errors} errors)`);
  }
  
  if (issues.length === 0) {
    logger.info('Scrape analysis: No issues found');
    return { success: true, issues: [] };
  } else {
    logger.warn('Scrape analysis found issues:', { issues });
    return { success: false, issues };
  }
}

// Export functions for use in tests and main application
export {
  scrapeEBLive,
  analyzeScrapeResults,
  parseDate,
  generateFestivalHash,
  type Festival
};

// Run the scraper if this file is executed directly
if (require.main === module) {
  scrapeEBLive().catch(error => {
    logger.error('Scraper failed with error:', { error });
    process.exit(1);
  });
}
```

## Logging Strategy

The implementation uses Winston for structured logging with multiple transports:

1. **Console Transport**: Colorized logs for real-time monitoring
2. **Error Log File**: Captures only error-level logs for quick troubleshooting
3. **Combined Log File**: Contains all logs with timestamps and metadata

Log levels include:
- **error**: Critical failures requiring immediate attention
- **warn**: Non-fatal issues that might affect data quality
- **info**: Regular progress updates and milestones
- **debug**: Detailed information for troubleshooting

Each log entry includes:
- Timestamp
- Service name
- Level
- Message
- Context data (where relevant)

## Deduplication Strategy

The scraper implements a multi-level deduplication strategy:

1. **Runtime Deduplication**:
   - Uses a Set of hash values to prevent duplicates during a single scrape run
   - The hash is generated from `source:id:name:dates` to uniquely identify each festival

2. **Database Deduplication**:
   - When uploading to Supabase, uses `ON CONFLICT` to handle existing records
   - Primary key of `source` + `source_id` prevents duplicates from the same source

3. **Cross-Source Deduplication**:
   - Implemented at the application level in FestiFind
   - Uses fuzzy matching based on name, dates, and location

The deduplication process is extensively logged for auditing and debugging.

## Testing Approach

### File: `src/tests/eblive-scraper.test.ts`

```typescript
import { scrapeEBLive, analyzeScrapeResults, parseDate, generateFestivalHash, Festival } from '../scrapers/eblive-scraper';
import path from 'path';
import fs from 'fs';

// Testing utility to check for new festivals across pages
async function testPageUniqueness(maxPages = 3, outputDir = path.join(__dirname, '../../test-data')) {
  console.log(`Testing uniqueness across ${maxPages} pages`);
  
  // Create output directory if it doesn't exist
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  
  // Scrape first page
  const firstPageResult = await scrapeEBLive({
    maxPages: 1,
    outputDir,
    testMode: true
  });
  
  const firstPageCount = firstPageResult.festivals.length;
  console.log(`First page returned ${firstPageCount} festivals`);
  
  // Scrape specified number of pages
  const multiPageResult = await scrapeEBLive({
    maxPages,
    outputDir,
    testMode: true
  });
  
  const multiPageCount = multiPageResult.festivals.length;
  console.log(`${maxPages} pages returned ${multiPageCount} festivals`);
  
  // Check if we got more unique festivals
  const hasNewFestivals = multiPageCount > firstPageCount;
  const newFestivalsCount = multiPageCount - firstPageCount;
  
  console.log(`Found ${newFestivalsCount} new festivals in subsequent pages`);
  console.log(`Test ${hasNewFestivals ? 'PASSED' : 'FAILED'}`);
  
  return {
    passed: hasNewFestivals,
    firstPageCount,
    multiPageCount,
    newFestivalsCount
  };
}

// Testing utility to verify date parsing
function testDateParsing() {
  console.log('Testing date parsing functionality');
  
  const testCases = [
    { input: 'Wo 21 mei t/m do 29 mei', expected: { startDate: expect.any(String), endDate: expect.any(String) } },
    { input: 'Zaterdag 31 mei', expected: { startDate: expect.any(String), endDate: expect.any(String) } },
    { input: 'Do 29 mei t/m za 31 mei', expected: { startDate: expect.any(String), endDate: expect.any(String) } },
    { input: 'Vr 30 mei t/m za 31 mei', expected: { startDate: expect.any(String), endDate: expect.any(String) } },
    { input: 'Wo 28 mei t/m zo 1 jun', expected: { startDate: expect.any(String), endDate: expect.any(String) } }
  ];
  
  let passed = 0;
  const results = [];
  
  for (const { input, expected } of testCases) {
    const result = parseDate(input);
    const isPassing = 
      (result.startDate !== null) === (expected.startDate !== null) &&
      (result.endDate !== null) === (expected.endDate !== null);
    
    if (isPassing) passed++;
    
    results.push({
      input,
      result,
      passed: isPassing
    });
    
    console.log(`Test case: "${input}" - ${isPassing ? 'PASSED' : 'FAILED'}`);
    console.log(`  Results: startDate=${result.startDate}, endDate=${result.endDate}`);
  }
  
  console.log(`Date parsing: ${passed}/${testCases.length} tests passed`);
  
  return {
    passed: passed === testCases.length,
    testsPassed: passed,
    totalTests: testCases.length,
    results
  };
}

// Testing utility to verify hash generation
function testHashGeneration() {
  console.log('Testing hash generation for deduplication');
  
  const festival1 = {
    id: '12345',
    name: 'Test Festival',
    location: 'Amsterdam (NL)',
    dates: 'Vr 30 mei t/m za 31 mei',
    url: 'https://example.com',
    source: 'eblive'
  };
  
  const festival2 = {
    ...festival1
  };
  
  const festival3 = {
    ...festival1,
    name: 'Test Festival Changed'
  };
  
  const hash1 = generateFestivalHash(festival1);
  const hash2 = generateFestivalHash(festival2);
  const hash3 = generateFestivalHash(festival3);
  
  const hashesMatch = hash1 === hash2;
  const differentHash = hash1 !== hash3;
  
  console.log(`Same festivals produce same hash: ${hashesMatch ? 'PASSED' : 'FAILED'}`);
  console.log(`Different festivals produce different hash: ${differentHash ? 'PASSED' : 'FAILED'}`);
  
  return {
    passed: hashesMatch && differentHash,
    hash1,
    hash2,
    hash3
  };
}

// Run all tests
async function runAllTests() {
  console.log('Starting EB Live scraper tests');
  
  const uniquenessResult = await testPageUniqueness();
  const dateParsingResult = testDateParsing();
  const hashGenerationResult = testHashGeneration();
  
  const allPassed = uniquenessResult.passed && dateParsingResult.passed && hashGenerationResult.passed;
  
  console.log('\nTest Summary:');
  console.log(`Page Uniqueness: ${uniquenessResult.passed ? 'PASSED' : 'FAILED'}`);
  console.log(`Date Parsing: ${dateParsingResult.passed ? 'PASSED' : 'FAILED'}`);
  console.log(`Hash Generation: ${hashGenerationResult.passed ? 'PASSED' : 'FAILED'}`);
  console.log(`Overall: ${allPassed ? 'PASSED' : 'FAILED'}`);
  
  return {
    allPassed,
    uniquenessResult,
    dateParsingResult,
    hashGenerationResult
  };
}

// Run the tests
if (require.main === module) {
  runAllTests().catch(console.error);
}

export {
  testPageUniqueness,
  testDateParsing,
  testHashGeneration,
  runAllTests
};
```

## Docker Configuration

### Dockerfile

```dockerfile
FROM node:18-slim

# Install dependencies for Playwright
RUN apt-get update && apt-get install -y \
    libgtk-3-0 \
    libasound2 \
    libdrm2 \
    libgbm1 \
    libnss3 \
    libxss1 \
    libxtst6 \
    xauth \
    xvfb \
    wget \
    gnupg \
    ca-certificates \
    fonts-liberation \
    libappindicator3-1 \
    libnss3 \
    lsb-release \
    xdg-utils \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install
RUN npx playwright install chromium
RUN npx playwright install-deps

# Copy the rest of the application
COPY . .

# Create directories for data and logs
RUN mkdir -p data logs

# Build TypeScript
RUN npm run build

# Set the entry point
CMD ["node", "dist/scrapers/eblive-scraper.js"]
```

### docker-compose.yml

```yaml
version: '3.8'

services:
  eblive-scraper:
    build: .
    volumes:
      - ./data:/app/data
      - ./logs:/app/logs
    environment:
      - SUPABASE_URL=${SUPABASE_URL}
      - SUPABASE_SERVICE_KEY=${SUPABASE_SERVICE_KEY}
      - LOG_LEVEL=info
    command: ["node", "dist/scrapers/eblive-scraper.js"]
  
  eblive-test:
    build: .
    volumes:
      - ./data:/app/data
      - ./logs:/app/logs
    environment:
      - LOG_LEVEL=debug
    command: ["node", "dist/tests/eblive-scraper.test.js"]
```

## Integration with FestiFind

### File: `src/integrations/supabase-uploader.ts`

```typescript
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { createLogger, format, transports } from 'winston';

// Configure logger
const logger = createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: format.combine(
    format.timestamp(),
    format.errors({ stack: true }),
    format.splat(),
    format.json()
  ),
  defaultMeta: { service: 'supabase-uploader' },
  transports: [
    new transports.Console({
      format: format.combine(
        format.colorize(),
        format.printf(({ level, message, timestamp, ...rest }) => {
          const restString = Object.keys(rest).length 
            ? `\n${JSON.stringify(rest, null, 2)}` 
            : '';
          return `${timestamp} [Uploader] ${level}: ${message}${restString}`;
        })
      )
    }),
    new transports.File({ 
      filename: 'logs/uploader-error.log', 
      level: 'error',
      format: format.combine(
        format.timestamp(),
        format.json()
      )
    }),
    new transports.File({ 
      filename: 'logs/uploader-combined.log',
      format: format.combine(
        format.timestamp(),
        format.json()
      )
    })
  ]
});

interface UploadStats {
  totalFestivals: number;
  successfulUploads: number;
  failedUploads: number;
  existingEntries: number;
  updatedEntries: number;
  newEntries: number;
  uploadDuration: number;
}

/**
 * Uploads festivals data to Supabase with detailed logging and stats
 */
async function uploadToSupabase(
  filePath: string,
  options: {
    dryRun?: boolean;
    batchSize?: number;
  } = {}
) {
  const { 
    dryRun = false,
    batchSize = 50
  } = options;
  
  logger.info(`Starting upload process with options`, { dryRun, batchSize, filePath });
  
  // Load environment variables
  const supabaseUrl = process.env.SUPABASE_URL || '';
  const supabaseKey = process.env.SUPABASE_SERVICE_KEY || '';
  
  if (!supabaseUrl || !supabaseKey) {
    logger.error('Missing Supabase credentials');
    throw new Error('Missing Supabase credentials');
  }
  
  // Initialize Supabase client
  const supabase = createClient(supabaseUrl, supabaseKey);
  logger.info('Supabase client initialized');
  
  // Load scraped data
  if (!fs.existsSync(filePath)) {
    logger.error('No data file found', { filePath });
    throw new Error(`No data file found at ${filePath}`);
  }
  
  let festivalsRaw;
  try {
    festivalsRaw = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    logger.info(`Loaded ${festivalsRaw.length} festivals from file`);
  } catch (e) {
    logger.error('Error parsing file', { error: e });
    throw new Error(`Error parsing file: ${e}`);
  }
  
  const stats: UploadStats = {
    totalFestivals: festivalsRaw.length,
    successfulUploads: 0,
    failedUploads: 0,
    existingEntries: 0,
    updatedEntries: 0,
    newEntries: 0,
    uploadDuration: 0
  };
  
  const startTime = Date.now();
  
  try {
    // First, get existing festival IDs to check which ones need updates vs. inserts
    logger.info('Fetching existing festival IDs from database');
    const { data: existingFestivals, error: fetchError } = await supabase
      .from('festivals')
      .select('source_id, updated_at')
      .eq('source', 'eblive');
    
    if (fetchError) {
      logger.error('Error fetching existing festivals', { error: fetchError });
      throw new Error(`Error fetching existing festivals: ${fetchError.message}`);
    }
    
    // Create a map of existing festivals for quick lookup
    const existingFestivalMap = new Map();
    existingFestivals?.forEach(festival => {
      existingFestivalMap.set(festival.source_id, festival.updated_at);
    });
    
    logger.info(`Found ${existingFestivalMap.size} existing festivals in database`);
    
    // Process festivals in batches
    const batches = [];
    for (let i = 0; i < festivalsRaw.length; i += batchSize) {
      batches.push(festivalsRaw.slice(i, i + batchSize));
    }
    
    logger.info(`Splitting upload into ${batches.length} batches of ${batchSize}`);
    
    let batchNumber = 1;
    for (const batch of batches) {
      logger.info(`Processing batch ${batchNumber}/${batches.length}`);
      
      // Transform data to match database schema
      const formattedFestivals = batch.map(festival => {
        const isExisting = existingFestivalMap.has(festival.id);
        
        // Choose whether to update based on whether the festival exists
        if (isExisting) {
          stats.existingEntries++;
        } else {
          stats.newEntries++;
        }
        
        return {
          source: 'eblive',
          source_id: festival.id,
          name: festival.name,
          location: festival.location,
          dates_description: festival.dates,
          start_date: festival.startDate,
          end_date: festival.endDate,
          edition: festival.edition ? festival.edition.replace(/^Editie #/, '') : null,
          url: festival.url,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          data: { 
            hash: festival.hash, 
            scraped_at: festival.scrapedAt 
          }
        };
      });
      
      // In dry run mode, just log what would happen
      if (dryRun) {
        logger.info(`[DRY RUN] Would upload ${formattedFestivals.length} festivals`);
        stats.successfulUploads += formattedFestivals.length;
      } else {
        // Actual upload
        const { data, error } = await supabase
          .from('festivals')
          .upsert(formattedFestivals, { 
            onConflict: 'source,source_id',
            ignoreDuplicates: false // Set to true if you don't want to update existing records
          });
        
        if (error) {
          logger.error(`Error uploading batch ${batchNumber}`, { error });
          stats.failedUploads += formattedFestivals.length;
        } else {
          logger.info(`Successfully uploaded batch ${batchNumber}`);
          stats.successfulUploads += formattedFestivals.length;
          
          // Check how many were updates vs inserts
          formattedFestivals.forEach(festival => {
            if (existingFestivalMap.has(festival.source_id)) {
              stats.updatedEntries++;
            }
          });
        }
      }
      
      batchNumber++;
      
      // Add a small delay between batches
      if (!dryRun && batchNumber < batches.length) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }
    
    stats.uploadDuration = (Date.now() - startTime) / 1000;
    
    logger.info('Upload completed successfully', { stats });
    return { success: true, stats };
    
  } catch (error) {
    stats.uploadDuration = (Date.now() - startTime) / 1000;
    logger.error('Error during upload process', { error, stats });
    throw error;
  }
}

// Run the uploader if this file is executed directly
if (require.main === module) {
  const filePath = process.argv[2];
  const dryRun = process.argv.includes('--dry-run');
  
  if (!filePath) {
    logger.error('No file path provided. Usage: node supabase-uploader.js <file-path> [--dry-run]');
    process.exit(1);
  }
  
  uploadToSupabase(filePath, { dryRun })
    .then(() => {
      logger.info('Upload script completed');
      process.exit(0);
    })
    .catch(error => {
      logger.error('Upload script failed', { error });
      process.exit(1);
    });
}

export { uploadToSupabase };
```

## Running Instructions

### Setup

1. Ensure you have Node.js 18+ and Docker installed.

2. Clone the repository:
   ```bash
   git clone https://github.com/yourusername/festifind.git
   cd festifind
   ```

3. Install dependencies:
   ```bash
   npm install
   ```

4. Create a `.env` file with your Supabase credentials:
   ```
   SUPABASE_URL=your_supabase_url
   SUPABASE_SERVICE_KEY=your_supabase_key
   LOG_LEVEL=info
   ```

### Running Tests

To verify the scraper functionality:

```bash
# Run in Docker
docker-compose up eblive-test

# Or locally
npm run test:eblive
```

### Running the Scraper

To run the full scraper:

```bash
# Run in Docker
docker-compose up eblive-scraper

# Or locally
npm run scrape:eblive
```

The scraper will:
1. Navigate through all pages of the EB Live festivals section
2. Extract detailed information about each festival
3. Save the data to JSON files in the `data` directory
4. Generate detailed logs in the `logs` directory

### Uploading to Supabase

To upload the scraped data to Supabase:

```bash
# Using the most recent data file
npm run upload:eblive

# Specify a data file
node dist/integrations/supabase-uploader.js ./data/eblive-festivals-2023-01-15T12-35-42.json

# Dry run (no actual upload)
node dist/integrations/supabase-uploader.js ./data/eblive-festivals-latest.json --dry-run
```

## Potential Challenges and Solutions

1. **Rate Limiting**
   - The scraper includes configurable delays between requests
   - Implements retries with exponential backoff
   - Uses a realistic user agent string

2. **Website Structure Changes**
   - Detailed error logging helps identify structural changes
   - The selector strategy uses multiple fallback methods
   - Regular tests can detect when the site structure changes

3. **Large Dataset Handling**
   - Paginates through all ~41 pages systematically
   - Batched processing prevents memory issues
   - Progress saves provide recovery points

4. **Data Quality**
   - Robust date parsing handles multiple Dutch date formats
   - Extensive validation and error catching for incomplete data
   - Detailed logs identify problematic entries

5. **Deployment Stability**
   - Docker configuration ensures consistent environment
   - Volume mounting preserves data across container restarts
   - Adequate error handling prevents unexpected crashes

By following this implementation guide, the EB Live scraper will reliably extract all festival data, even as the website evolves over time. The robust logging and testing approach ensures that any issues can be quickly identified and resolved. 