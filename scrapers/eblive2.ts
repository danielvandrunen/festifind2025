import { chromium, Browser, Page } from 'playwright';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import winston from 'winston';

// Configure logger
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.splat(),
    winston.format.json()
  ),
  defaultMeta: { service: 'eblive-scraper' },
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.printf(({ level, message, timestamp, ...rest }) => {
          const restString = Object.keys(rest).length 
            ? `\n${JSON.stringify(rest, null, 2)}` 
            : '';
          return `${timestamp} [EBLive] ${level}: ${message}${restString}`;
        })
      )
    }),
    new winston.transports.File({ 
      filename: 'logs/eblive-error.log', 
      level: 'error',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      )
    }),
    new winston.transports.File({ 
      filename: 'logs/eblive-combined.log',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
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
function parseDate(dateStr: string): { startDate: string | undefined, endDate: string | undefined } {
  logger.debug(`Parsing date string: "${dateStr}"`);
  try {
    const months: Record<string, number> = {
      'jan': 0, 'feb': 1, 'mrt': 2, 'apr': 3, 'mei': 4, 'jun': 5,
      'jul': 6, 'aug': 7, 'sep': 8, 'okt': 9, 'nov': 10, 'dec': 11
    };
    
    let startDate: string | undefined = undefined;
    let endDate: string | undefined = undefined;
    
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
    return { startDate: undefined, endDate: undefined };
  }
}

/**
 * Main scraper function for EB Live
 */
export async function scrapeEBLive(options: {
  maxPages?: number;
  delay?: number;
  outputDir?: string;
  testMode?: boolean;
  onProgressUpdate?: (progress: number) => void;
  onLogUpdate?: (log: string) => void;
} = {}) {
  const {
    maxPages = 0, // 0 means scrape all pages
    delay = 1000, // Default delay between page requests
    outputDir = path.join(process.cwd(), 'data'),
    testMode = false,
    onProgressUpdate = () => {},
    onLogUpdate = () => {}
  } = options;
  
  const log = (message: string, level: 'info' | 'warn' | 'error' | 'debug' = 'info') => {
    logger[level](message);
    onLogUpdate(`[${new Date().toISOString()}] ${message}`);
  };
  
  log('Starting EB Live scraper', 'info');
  
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
    festivalsByPage: {} as Record<number, number>,
    timeElapsed: ''
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
    log('Navigating to EB Live festivals page');
    await page.goto('https://www.eblive.nl/festivals/');
    
    // Handle cookie consent if it appears
    try {
      await page.waitForSelector('button:has-text("Accepteren en doorgaan")', { timeout: 5000 });
      await page.click('button:has-text("Accepteren en doorgaan")');
      log('Accepted cookie consent banner');
    } catch (e) {
      log('No cookie banner found or already accepted');
    }
    
    // Get total number of pages from the festival count
    const pagesText = await page.locator('h5:has-text("festivals gevonden")').textContent();
    const festivalsCount = pagesText ? parseInt(pagesText.match(/\d+/)?.[0] || '0') : 0;
    totalPages = Math.ceil(festivalsCount / 24); // Assuming 24 festivals per page
    
    log(`Found approximately ${festivalsCount} festivals across ${totalPages} pages`);
    
    // If maxPages is specified, limit the scraping
    const pagesToScrape = maxPages > 0 ? Math.min(maxPages, totalPages) : totalPages;
    onProgressUpdate(5); // Initial progress
    
    while (hasMorePages && (maxPages === 0 || currentPage <= pagesToScrape)) {
      log(`Scraping page ${currentPage} of ${pagesToScrape > 0 ? pagesToScrape : totalPages}`);
      
      // Calculate progress percentage based on current page and total pages
      const progressPercentage = Math.min(
        5 + Math.floor((currentPage / (pagesToScrape > 0 ? pagesToScrape : totalPages)) * 90),
        95
      );
      onProgressUpdate(progressPercentage);
      
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
          log(`Failed to load page ${currentPage}, retry ${retries}/${maxRetries}`, 'warn');
          
          if (retries >= maxRetries) {
            log(`Failed to load page ${currentPage} after ${maxRetries} retries`, 'error');
            break;
          }
          
          // Wait before retrying
          await page.waitForTimeout(delay * 2);
        }
      }
      
      if (!pageLoaded) {
        log(`Skipping page ${currentPage} due to load failures`, 'error');
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
        log(`Found ${festivalLinks.length} festivals on page ${currentPage}`);
        
        for (const element of festivalLinks) {
          try {
            // Get festival URL and ID
            const url = await element.getAttribute('href') || '';
            const festivalId = url.match(/festival_id=(\d+)/)?.[1] || '';
            
            if (!festivalId) {
              log('Could not extract festival ID from URL', 'warn');
              continue;
            }
            
            // Get festival name
            const nameElement = await element.$('h5');
            const name = nameElement ? await nameElement.textContent() : '';
            
            if (!name) {
              log(`Could not extract festival name for ID: ${festivalId}`, 'warn');
              continue;
            }
            
            // Get location and dates
            const infoText = await element.evaluate((el: HTMLElement) => {
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
              const editionText = editionElement ? await editionElement.textContent() : null;
              edition = editionText || undefined;
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
              log(`Incomplete festival data for ID: ${festivalId}`, 'warn');
              metrics.errors++;
            }
          } catch (e) {
            log(`Error processing festival element`, 'error');
            metrics.errors++;
          }
        }
      } catch (e) {
        log(`Error extracting festivals from page ${currentPage}`, 'error');
        metrics.errors++;
      }
      
      // Record metrics for this page
      const pageTime = Date.now() - pageStart;
      metrics.festivalsByPage[currentPage] = pageNewFestivals.length;
      
      log(`Page ${currentPage} completed in ${pageTime}ms. Found ${pageNewFestivals.length} new festivals.`);
      
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
        log(`Progress saved to ${tempPath}`);
      }
    }
    
    // Finalize metrics
    metrics.endTime = new Date();
    const duration = (metrics.endTime.getTime() - metrics.startTime.getTime()) / 1000;
    metrics.timeElapsed = `${duration.toFixed(2)}s`;
    
    log(`Scraping completed. Summary: ${metrics.uniqueFestivals} unique festivals found, ${metrics.duplicates} duplicates, ${metrics.errors} errors in ${metrics.timeElapsed}`);
    
    // Save the data
    const outputPath = path.join(outputDir, `eblive-festivals-${new Date().toISOString().replace(/:/g, '-')}.json`);
    fs.writeFileSync(outputPath, JSON.stringify(allFestivals, null, 2));
    
    // Save metrics
    const metricsPath = path.join(outputDir, `eblive-metrics-${new Date().toISOString().replace(/:/g, '-')}.json`);
    fs.writeFileSync(metricsPath, JSON.stringify(metrics, null, 2));
    
    log(`Data saved to ${outputPath}`);
    onProgressUpdate(100); // Mark as complete
    
    return {
      festivals: allFestivals,
      metrics
    };
    
  } catch (error) {
    log('Critical error during scraping: ' + (error instanceof Error ? error.message : String(error)), 'error');
    throw error;
  } finally {
    await browser.close();
    log('Browser closed');
  }
}

/**
 * Utility to analyze if a complete scrape was successful
 */
export function analyzeScrapeResults(metrics: any, minExpectedFestivals = 900) {
  logger.info('Analyzing scrape results');
  
  const issues: string[] = [];
  
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