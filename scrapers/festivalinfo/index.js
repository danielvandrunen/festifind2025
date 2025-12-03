import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import winston from 'winston';
import { fileURLToPath } from 'url';
import { extractFestivalList, extractFestivalDetails, normalizeFestivalData } from './parser.js';

// Configure logger
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.splat(),
    winston.format.json()
  ),
  defaultMeta: { service: 'festivalinfo-scraper' },
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.printf(({ level, message, timestamp, ...rest }) => {
          const restString = Object.keys(rest).length 
            ? `\n${JSON.stringify(rest, null, 2)}` 
            : '';
          return `${timestamp} [FestivalInfo] ${level}: ${message}${restString}`;
        })
      )
    }),
    new winston.transports.File({ 
      filename: 'logs/festivalinfo-error.log', 
      level: 'error',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      )
    }),
    new winston.transports.File({ 
      filename: 'logs/festivalinfo-combined.log',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      )
    })
  ]
});

/**
 * Main scraper function for Festival Info
 */
export async function scrapeFestivalInfo(options = {}) {
  const {
    maxPages = 0, // 0 means scrape all pages
    delay = 2000, // 2 seconds between page requests
    detailDelay = 2000, // Delay between detail page requests
    outputDir = path.join(process.cwd(), 'data'),
    testMode = false,
    onProgressUpdate = () => {},
    onLogUpdate = () => {},
    dockerMode = process.env.DOCKER === 'true' || process.env.CONTAINER === 'true',
    extractDetailPages = false // Set to true to extract more detail from each festival page
  } = options;
  
  const log = (message, level = 'info') => {
    logger[level](message);
    onLogUpdate(`[${new Date().toISOString()}] ${message}`);
  };
  
  log('Starting FestivalInfo scraper', 'info');
  log(`Running in ${dockerMode ? 'Docker container' : 'local environment'}`);
  
  // Browser launch options optimized for container environments
  const browserOptions = {
    headless: true, // Always use headless in Docker
    executablePath: dockerMode ? '/usr/bin/chromium-browser' : undefined,
    args: [
      '--disable-gpu',
      '--disable-dev-shm-usage',
      '--disable-setuid-sandbox',
      '--no-sandbox',
    ]
  };
  
  log(`Using browser at: ${browserOptions.executablePath || 'default location'}`);
  
  // Store for extraction metrics
  const metrics = {
    totalFestivals: 0,
    uniqueFestivals: 0,
    duplicates: 0,
    errors: 0,
    startTime: new Date(),
    endTime: new Date(),
    pages: 0,
    festivalsByPage: {},
    timeElapsed: ''
  };
  
  const browser = await chromium.launch(browserOptions);
  const context = await browser.newContext();
  const page = await context.newPage();
  
  try {
    // Ensure output directory exists
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    
    // Start scraping
    log('Starting scrape of festivalinfo.nl');
    
    // Navigate to the festivals page
    await page.goto('https://www.festivalinfo.nl/festivals/', { 
      waitUntil: 'networkidle',
      timeout: 60000 // 60 seconds timeout
    });
    
    log('Loaded festivals page, detecting pagination');
    
    // Determine total pages to scrape
    const totalPages = await page.evaluate(() => {
      // Look for pagination links that have page=X in their href
      const pageLinks = Array.from(document.querySelectorAll('a[href*="?page="]'));
      if (!pageLinks.length) return 1;
      
      // Extract page numbers from all links
      const pageNumbers = pageLinks.map(link => {
        const match = link.href.match(/\?page=(\d+)/);
        return match ? parseInt(match[1], 10) : 0;
      }).filter(num => num > 0);
      
      // If no valid page numbers found, return 1
      if (pageNumbers.length === 0) return 1;
      
      // Return the highest page number found
      return Math.max(...pageNumbers);
    });
    
    log(`Detected ${totalPages} total pages of festivals`);
    
    // Force minimum of 40 pages if detection fails
    // The website typically has 40+ pages of festivals
    const minimumPages = 40;
    
    // Double-check pagination by also looking at the last page link
    const lastPageCheck = await page.evaluate(() => {
      // Look for the "Last" or "Laatste" link which typically points to the last page
      const lastLink = Array.from(document.querySelectorAll('a')).find(a => 
        (a.textContent.includes('Last') || a.textContent.includes('Laatste')) && 
        a.href.includes('?page=')
      );
      
      if (lastLink) {
        const match = lastLink.href.match(/\?page=(\d+)/);
        return match ? parseInt(match[1], 10) : 0;
      }
      
      // Alternative approach: look for pagination container and get all page links
      const paginationContainers = Array.from(document.querySelectorAll('.pagination, .pager, nav'));
      for (const container of paginationContainers) {
        const pageLinks = Array.from(container.querySelectorAll('a[href*="?page="]'));
        if (pageLinks.length > 0) {
          // Extract numbers and get the highest one
          const pageNumbers = pageLinks.map(link => {
            const match = link.href.match(/\?page=(\d+)/);
            return match ? parseInt(match[1], 10) : 0;
          }).filter(num => num > 0);
          
          if (pageNumbers.length > 0) {
            return Math.max(...pageNumbers);
          }
        }
      }
      
      // Dump all links with page references for debugging
      const allPageLinks = Array.from(document.querySelectorAll('a[href*="page"]'));
      console.log("All page-related links:", allPageLinks.map(a => a.href));
      
      return 0; // Couldn't find a last page indicator
    });
    
    log(`Pagination check result: ${lastPageCheck}`);
    
    // Use the highest value between our two page detection methods and the minimum pages
    let correctedTotalPages = Math.max(totalPages, lastPageCheck, minimumPages);
    
    if (lastPageCheck > 0 && lastPageCheck !== totalPages) {
      log(`Pagination check found different total: ${lastPageCheck}, using higher value: ${correctedTotalPages}`);
    } else if (correctedTotalPages === minimumPages) {
      log(`Using minimum page count (${minimumPages}) since detection found only ${totalPages} pages`);
    }
    
    // Hard safety check - if both detection methods fail, use a reasonable minimum
    if (correctedTotalPages < 2) {
      correctedTotalPages = minimumPages;
      log(`Pagination detection failed completely. Forcing minimum of ${minimumPages} pages.`);
    }
    
    // Determine how many pages to scrape
    const pagesToScrape = maxPages > 0 ? Math.min(maxPages, correctedTotalPages) : correctedTotalPages;
    log(`Will scrape ${pagesToScrape} pages of festivals`);
    
    const allFestivals = [];
    const festivalIds = new Set();
    
    // Loop through pages - start from page 1 as festivalinfo uses 1-based pagination
    for (let currentPage = 1; currentPage <= pagesToScrape; currentPage++) {
      log(`Processing page ${currentPage}/${pagesToScrape}`);
      
      // Always navigate explicitly to each page to avoid any navigation issues
      const pageUrl = currentPage === 1 
        ? 'https://www.festivalinfo.nl/festivals/' 
        : `https://www.festivalinfo.nl/festivals/?page=${currentPage}`;
      
      log(`Navigating to page ${currentPage}: ${pageUrl}`);
      await page.goto(pageUrl, { 
        waitUntil: 'networkidle',
        timeout: 60000
      });
      
      // Extract festivals from this page using parser.js
      const festivals = await extractFestivalList(page);
      
      log(`Found ${festivals.length} festivals on page ${currentPage}`);
      
      // Process the festivals
      for (const festival of festivals) {
        metrics.totalFestivals++;
        
        // Generate a hash for deduplication
        const hashString = `${festival.source}:${festival.id}:${festival.name}`;
        festival.hash = crypto.createHash('md5').update(hashString).digest('hex');
        
        // Normalize the festival data
        const normalizedFestival = normalizeFestivalData(festival);
        
        // Check for duplicates
        if (festivalIds.has(normalizedFestival.hash)) {
          metrics.duplicates++;
          continue;
        }
        
        festivalIds.add(normalizedFestival.hash);
        allFestivals.push(normalizedFestival);
        metrics.uniqueFestivals++;
      }
      
      metrics.festivalsByPage[currentPage] = festivals.length;
      metrics.pages++;
      
      // Update progress
      onProgressUpdate(currentPage / pagesToScrape);
      
      // Add delay between pages
      if (currentPage < pagesToScrape) {
        log(`Waiting ${delay}ms before next page`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    
    // If requested, extract additional details from festival pages
    if (extractDetailPages && !testMode) {
      log(`Extracting details from ${Math.min(50, allFestivals.length)} festival pages`);
      
      // Limit the number of detail pages to prevent excessive requests
      const festivalsToProcess = allFestivals.slice(0, 50);
      let detailsProcessed = 0;
      
      for (const festival of festivalsToProcess) {
        try {
          log(`Extracting details for ${festival.name} (${++detailsProcessed}/${festivalsToProcess.length})`);
          
          // Get festival details
          const details = await extractFestivalDetails(page, festival.url);
          
          // Add details to the festival object
          Object.assign(festival, normalizeFestivalData(festival, details));
          
          // Update progress
          onProgressUpdate(0.5 + (detailsProcessed / festivalsToProcess.length) * 0.5);
          
          // Delay between requests
          await new Promise(resolve => setTimeout(resolve, detailDelay));
        } catch (error) {
          log(`Error extracting details for ${festival.name}: ${error.message}`, 'error');
          metrics.errors++;
        }
      }
    }
    
    // Timestamp the output file with ISO date and festival count
    const timestamp = new Date().toISOString().replace(/:/g, '-');
    const outputFilename = `festivalinfo_${timestamp}_${allFestivals.length}festivals.json`;
    const outputPath = path.join(outputDir, outputFilename);
    
    // Make sure we're only outputting unique festivals
    log(`Saving ${allFestivals.length} unique festivals to output directory`);
    
    // Write the output file
    fs.writeFileSync(outputPath, JSON.stringify(allFestivals, null, 2));
    log(`Successfully saved festivals to ${outputPath}`);
    
    // Calculate elapsed time
    metrics.endTime = new Date();
    const elapsedMs = metrics.endTime - metrics.startTime;
    const minutes = Math.floor(elapsedMs / 60000);
    const seconds = Math.floor((elapsedMs % 60000) / 1000);
    metrics.timeElapsed = `${minutes}m ${seconds}s`;
    
    log(`Scrape completed in ${metrics.timeElapsed}`);
    log(`Total festivals found: ${metrics.totalFestivals}`);
    log(`Unique festivals: ${metrics.uniqueFestivals}`);
    log(`Duplicates: ${metrics.duplicates}`);
    
    // Return success result with metrics
    return {
      success: true,
      metrics,
      outputFile: outputFilename
    };
  } catch (error) {
    log(`Error during scrape: ${error.message}`, 'error');
    logger.error('Scrape failed', { error });
    
    return {
      success: false,
      error: error.message,
      metrics
    };
  } finally {
    await browser.close();
  }
}

// Run the scraper if this file is executed directly
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  scrapeFestivalInfo().catch(console.error);
} 