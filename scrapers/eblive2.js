import { chromium } from 'playwright';
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

/**
 * Generate a unique hash for the festival for deduplication purposes
 */
function generateFestivalHash(festival) {
  const hashString = `${festival.source}:${festival.id}:${festival.name}:${festival.dates}`;
  return crypto.createHash('md5').update(hashString).digest('hex');
}

/**
 * Parse Dutch date formats into ISO dates
 */
function parseDate(dateStr) {
  logger.debug(`Parsing date string: "${dateStr}"`);
  try {
    const months = {
      'jan': 0, 'feb': 1, 'mrt': 2, 'apr': 3, 'mei': 4, 'jun': 5,
      'jul': 6, 'aug': 7, 'sep': 8, 'okt': 9, 'nov': 10, 'dec': 11
    };
    
    let startDate = undefined;
    let endDate = undefined;
    
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
 * Clean up a festival name by removing extra spaces, newlines, etc.
 */
function cleanFestivalName(name) {
  if (!name) return '';
  
  // Remove newlines and excessive whitespace
  let cleaned = name.replace(/\n+/g, ' ').replace(/\s+/g, ' ').trim();
  
  // Remove common heading or label text
  cleaned = cleaned.replace(/^(Uitgelicht|Editie #\d+|Editie|Feature)[\s:]+/i, '');
  
  // Remove dates that might have been captured in the name
  cleaned = cleaned.replace(/(ma|di|wo|do|vr|za|zo)\s+\d+\s+(jan|feb|m(aa)?rt|apr|mei|jun|jul|aug|sep|o[ck]t|nov|dec)(\s+t\/m|\s+-).*/i, '');
  
  // Remove any trailing dates like "Vr 18 apr t" that got cut off
  cleaned = cleaned.replace(/\s+(ma|di|wo|do|vr|za|zo)\s+\d+\s+(jan|feb|m(aa)?rt|apr|mei|jun|jul|aug|sep|o[ck]t|nov|dec).*$/i, '');
  
  // Remove #N that might be edition numbers
  cleaned = cleaned.replace(/^#\d+$/, '');
  cleaned = cleaned.replace(/^Editie #\d+$/, '');
  
  // If after cleaning we just have numbers or short strings, use the fallback name from the URL if available
  if (cleaned.length <= 2 || cleaned.match(/^[0-9\s]+$/)) {
    return ''; // Return empty to trigger fallback name extraction
  }
  
  // Try to extract only the festival name
  // Look for patterns like "Something Festival" or just a standalone name
  const nameParts = cleaned.split(/\s+/).filter(part => 
    part.length > 1 && 
    !part.match(/^(van|de|het|en|the|in|op|te|at|of|for|festival|rock|pop|music|concert|editie|uitgelic)$/i));
  
  if (nameParts.length > 0) {
    // If we have filtered name parts, join them with spaces
    // This helps to remove common words like "Festival" if they're part of longer phrases
    cleaned = nameParts.join(' ');
  }
  
  // Remove trailing spaces and punctuation
  cleaned = cleaned.trim().replace(/[,.;:!?]+$/, '');
  
  return cleaned;
}

/**
 * Main scraper function for EB Live
 */
export async function scrapeEBLive(options = {}) {
  const {
    maxPages = 0, // 0 means scrape all pages (will use the detected totalPages value)
    delay = 1500, // Increased default delay to avoid rate limiting
    outputDir = path.join(process.cwd(), 'data'),
    testMode = false,
    onProgressUpdate = () => {},
    onLogUpdate = () => {},
    dockerMode = process.env.DOCKER === 'true' || process.env.CONTAINER === 'true'
  } = options;
  
  const log = (message, level = 'info') => {
    logger[level](message);
    onLogUpdate(`[${new Date().toISOString()}] ${message}`);
  };
  
  log('Starting EB Live scraper', 'info');
  log(`Running in ${dockerMode ? 'Docker container' : 'local environment'}`);
  
  // Browser launch options optimized for container environments
  const browserOptions = {
    headless: true, // Always use headless in Docker
    args: [
      '--disable-gpu',
      '--disable-dev-shm-usage',
      '--disable-setuid-sandbox',
      '--no-sandbox',
      '--no-zygote',
      '--single-process',
      '--disable-extensions',
      '--disable-accelerated-2d-canvas',
      '--disable-gl-drawing-for-tests',
      '--mute-audio',
      '--disable-background-networking',
      '--disable-background-timer-throttling',
      '--disable-backgrounding-occluded-windows',
      '--disable-breakpad',
      '--disable-client-side-phishing-detection',
      '--disable-component-update',
      '--disable-default-apps',
      '--disable-domain-reliability',
      '--disable-features=AudioServiceOutOfProcess',
      '--disable-hang-monitor',
      '--disable-ipc-flooding-protection',
      '--disable-notifications',
      '--disable-offer-store-unmasked-wallet-cards',
      '--disable-print-preview',
      '--disable-prompt-on-repost',
      '--disable-speech-api',
      '--disable-sync',
      '--hide-scrollbars',
      '--ignore-certificate-errors',
      '--ignore-certificate-errors-spki-list',
      '--no-first-run',
      '--use-gl=swiftshader',
      '--window-size=1920,1080'
    ]
  };
  
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
  
  const allFestivals = [];
  const festivalIds = new Set(); // For deduplication
  let currentPage = 1;
  let totalPages = 41; // Hard-coded as 41 based on your specification
  let hasMorePages = true;
  
  // Create browser context with additional error handling
  let browser;
  try {
    // Ensure output directory exists
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    
    // Ensure logs directory exists
    if (!fs.existsSync('logs')) {
      fs.mkdirSync('logs', { recursive: true });
    }
    
    // Launch browser with retries for Docker compatibility
    let browserLaunchRetries = 0;
    const maxBrowserLaunchRetries = 3;
    
    while (!browser && browserLaunchRetries < maxBrowserLaunchRetries) {
      try {
        log(`Launching browser (attempt ${browserLaunchRetries + 1}/${maxBrowserLaunchRetries})`);
        browser = await chromium.launch(browserOptions);
      } catch (err) {
        browserLaunchRetries++;
        log(`Failed to launch browser: ${err.message}`, 'error');
        
        if (browserLaunchRetries >= maxBrowserLaunchRetries) {
          throw new Error(`Failed to launch browser after ${maxBrowserLaunchRetries} attempts: ${err.message}`);
        }
        
        // Wait before retrying
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }
    
    const context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      viewport: { width: 1280, height: 800 }
    });
    
    // Initialize first page and handle cookies
    const page = await context.newPage();
    log('Navigating to EB Live festivals page');
    
    // Navigate with retries for resilience
    let initialNavigationRetries = 0;
    const maxNavigationRetries = 3;
    let initialPageLoaded = false;
    
    while (!initialPageLoaded && initialNavigationRetries < maxNavigationRetries) {
      try {
        await page.goto('https://www.eblive.nl/festivals/', { 
          timeout: 60000,
          waitUntil: 'domcontentloaded'
        });
        initialPageLoaded = true;
      } catch (err) {
        initialNavigationRetries++;
        log(`Failed initial navigation: ${err.message}`, 'error');
        
        if (initialNavigationRetries >= maxNavigationRetries) {
          throw new Error(`Failed to navigate to initial page after ${maxNavigationRetries} attempts`);
        }
        
        // Wait before retrying
        await new Promise(resolve => setTimeout(resolve, 3000));
      }
    }
    
    // Handle cookie consent if it appears
    try {
      await page.waitForSelector('button:has-text("Accepteren en doorgaan")', { timeout: 10000 });
      await page.click('button:has-text("Accepteren en doorgaan")');
      log('Accepted cookie consent banner');
    } catch (e) {
      log('No cookie banner found or already accepted');
    }
    
    // Try to get total pages from the festival count
    try {
      const pagesText = await page.locator('h5:has-text("festivals gevonden")').textContent();
      const festivalsCount = pagesText ? parseInt(pagesText.match(/\d+/)?.[0] || '0') : 0;
      
      if (festivalsCount > 0) {
        const calculatedPages = Math.ceil(festivalsCount / 24); // Assuming 24 festivals per page
        totalPages = calculatedPages > 0 ? calculatedPages : totalPages;
        log(`Found approximately ${festivalsCount} festivals across ${totalPages} pages`);
      } else {
        log(`Using default total pages: ${totalPages}`);
      }
    } catch (err) {
      log(`Error detecting total pages, using default (${totalPages}): ${err.message}`, 'warn');
    }
    
    // If maxPages is specified, limit the scraping
    const pagesToScrape = maxPages > 0 ? Math.min(maxPages, totalPages) : totalPages;
    log(`Will scrape ${pagesToScrape} pages in total`);
    onProgressUpdate(5); // Initial progress
    
    // Create additional failure recovery variables
    let consecutiveFailures = 0;
    const maxConsecutiveFailures = 3;
    
    while (hasMorePages && (maxPages === 0 || currentPage <= pagesToScrape) && consecutiveFailures < maxConsecutiveFailures) {
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
            timeout: 60000, // Increased timeout for Docker
            waitUntil: 'domcontentloaded'
          });
          
          // Wait for the content to load with a more reliable indicator
          await page.waitForLoadState('networkidle', { timeout: 10000 });
          pageLoaded = true;
        } catch (e) {
          retries++;
          log(`Failed to load page ${currentPage}, retry ${retries}/${maxRetries}: ${e.message}`, 'warn');
          
          if (retries >= maxRetries) {
            log(`Failed to load page ${currentPage} after ${maxRetries} retries`, 'error');
            consecutiveFailures++;
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
      } else {
        // Reset consecutive failures counter on success
        consecutiveFailures = 0;
      }
      
      // Extract festival data
      const pageStart = Date.now();
      const pageNewFestivals = [];
      metrics.pages++;
      
      try {
        // Take a screenshot to debug (in test mode)
        if (testMode) {
          await page.screenshot({ path: path.join(outputDir, `page-${currentPage}.png`) });
        }
        
        // Wait for page content to be fully loaded
        await page.waitForTimeout(1000);
        
        // Extract all links containing 'festival_id'
        const festivalLinks = await page.$$('a[href*="festival_id"]');
        log(`Found ${festivalLinks.length} festival links on page ${currentPage}`);
        
        // If no festivals found, try waiting and looking again
        if (festivalLinks.length === 0) {
          log('No festivals found initially, waiting longer for page to load', 'warn');
          await page.waitForTimeout(5000);
          const retryLinks = await page.$$('a[href*="festival_id"]');
          log(`Found ${retryLinks.length} festival links after waiting`);
          
          // If still no festivals, try a page reload
          if (retryLinks.length === 0) {
            log('Still no festivals found, trying to reload the page', 'warn');
            await page.reload({ waitUntil: 'networkidle' });
            await page.waitForTimeout(3000);
          }
        }
        
        // Try again to get festival links
        const finalLinks = await page.$$('a[href*="festival_id"]');
        log(`Final count: ${finalLinks.length} festival links on page ${currentPage}`);
        
        // Process all festival links
        for (const link of finalLinks) {
          try {
            // Get URL and ID
            const url = await link.getAttribute('href') || '';
            const festivalId = url.match(/festival_id=(\d+)/)?.[1] || '';
            
            if (!festivalId) {
              log('Could not extract festival ID from URL', 'warn');
              continue;
            }
            
            // Get link text which might contain the festival name
            const linkText = await link.textContent() || '';
            
            // Extract more data from the parent element to try to find the full context
            const parentData = await link.evaluate(el => {
              // Go up in the DOM to find a container that might have all the festival data
              const parentCard = el.closest('div') || el.parentElement || document.body;
              
              // Extract all text content and visible text nodes
              return {
                allText: parentCard.textContent || '',
                innerHTML: parentCard.innerHTML || '',
                linkHref: el.getAttribute('href') || '',
                linkText: el.textContent || ''
              };
            });
            
            // Try to extract the festival name from the link or surrounding content
            let name = linkText;
            if (!name || name.length <= 3 || name.match(/meer info|lees meer|details/i)) {
              // If the link text isn't helpful, look through the parent's text
              const lines = parentData.allText.split('\n')
                .map(line => line.trim())
                .filter(line => line.length > 0);
              
              // Try to find a line that looks like a festival name (not a date, location, or button text)
              for (const line of lines) {
                if (line.length > 3 && 
                    !line.match(/^(ma|di|wo|do|vr|za|zo)/i) && // Not starting with day of week
                    !line.match(/(tickets|bestel|koop|prijs|gratis|uitverkocht|euro)/i) && // Not ticket related
                    !line.match(/^(jan|feb|mrt|apr|mei|jun|jul|aug|sep|okt|nov|dec)/i)) { // Not starting with month
                  name = line;
                  break;
                }
              }
            }
            
            // If we still don't have a name, it might be in the URL
            if (!name || name.length <= 3) {
              const urlNameMatch = url.match(/festival_name=([^&]+)/);
              if (urlNameMatch) {
                name = decodeURIComponent(urlNameMatch[1].replace(/\+/g, ' '));
              }
            }
            
            if (!name || name.length <= 3) {
              log(`Could not extract festival name for ID: ${festivalId}`, 'warn');
              continue;
            }
            
            // Try to find location and dates from the parent text
            let location = '';
            let dates = '';
            
            const lines = parentData.allText.split('\n')
              .map(line => line.trim())
              .filter(line => line.length > 0 && line !== name);
            
            // Look for date patterns in lines
            for (const line of lines) {
              if (line.match(/(ma|di|wo|do|vr|za|zo)\s+\d+|t\/m|\d+\s+(jan|feb|mrt|apr|mei|jun|jul|aug|sep|okt|nov|dec)/i)) {
                dates = line;
              } else if (line.length > 2 && line.length < 30 && 
                        !line.match(/(festival|tickets|koop|bestel|meer info|gratis|uitverkocht|lees meer|details)/i)) {
                location = line;
              }
            }
            
            // Create festival object with what we have
            const festival = {
              id: festivalId,
              name: cleanFestivalName(name.trim()),
              location: location.trim(),
              dates: dates.trim(),
              url: url.startsWith('http') ? url : `https://www.eblive.nl${url}`,
              source: 'eblive'
            };
            
            // Parse dates if we found any
            if (dates) {
              const { startDate, endDate } = parseDate(dates);
              festival.startDate = startDate;
              festival.endDate = endDate;
            }
            
            // Generate hash for deduplication
            const hash = generateFestivalHash(festival);
            const scrapedAt = new Date().toISOString();
            
            const completeFestival = {
              ...festival,
              hash,
              scrapedAt
            };
            
            // Only add festivals with minimum required data
            if (festival.name && (festival.location || festival.dates)) {
              // Track metrics
              metrics.totalFestivals++;
              
              // Check for duplicates
              if (festivalIds.has(hash)) {
                metrics.duplicates++;
                logger.debug(`Found duplicate festival: ${name} (${festivalId})`);
              } else {
                // Add to results
                festivalIds.add(hash);
                allFestivals.push(completeFestival);
                pageNewFestivals.push(completeFestival);
                metrics.uniqueFestivals++;
                log(`Added festival: ${name} (${festivalId})`);
              }
            } else {
              log(`Incomplete festival data for ID: ${festivalId}`, 'warn');
              log(`  Name: ${festival.name}`, 'debug');
              log(`  Location: ${festival.location}`, 'debug');
              log(`  Dates: ${festival.dates}`, 'debug');
            }
          } catch (e) {
            log(`Error processing festival element: ${e.message}`, 'error');
            metrics.errors++;
          }
        }
        
        // If we found zero festivals on this page, mark it as an error
        if (finalLinks.length === 0) {
          throw new Error(`No festival links found on page ${currentPage} after multiple attempts`);
        }
      } catch (e) {
        log(`Error extracting festivals from page ${currentPage}: ${e.message}`, 'error');
        metrics.errors++;
        consecutiveFailures++;
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
      if (currentPage % 3 === 0 || !hasMorePages) {
        const tempPath = path.join(outputDir, `eblive-festivals-progress-${new Date().toISOString().replace(/:/g, '-')}.json`);
        fs.writeFileSync(tempPath, JSON.stringify(allFestivals, null, 2));
        log(`Progress saved to ${tempPath}`);
      }
      
      // If we're in Docker mode, manage memory more aggressively
      if (dockerMode && currentPage % 5 === 0) {
        // Force garbage collection in Node.js when in Docker
        if (global.gc) {
          log('Running forced garbage collection');
          global.gc();
        }
      }
    }
    
    // Check if we exited due to too many consecutive failures
    if (consecutiveFailures >= maxConsecutiveFailures) {
      log(`Stopped scraping due to ${consecutiveFailures} consecutive page failures`, 'error');
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
    if (browser) {
      try {
        await browser.close();
        log('Browser closed');
      } catch (err) {
        log(`Error closing browser: ${err.message}`, 'error');
      }
    }
  }
}

/**
 * Utility to analyze if a complete scrape was successful
 */
export function analyzeScrapeResults(metrics, minExpectedFestivals = 700) {
  logger.info('Analyzing scrape results');
  
  const issues = [];
  
  // Check total festivals count - lowered expectation for production environment
  if (metrics.uniqueFestivals < minExpectedFestivals) {
    issues.push(`Found only ${metrics.uniqueFestivals} festivals, expected at least ${minExpectedFestivals}`);
  }
  
  // Check for pages with few or no festivals
  const emptyPages = Object.entries(metrics.festivalsByPage)
    .filter(([_, count]) => count === 0)
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