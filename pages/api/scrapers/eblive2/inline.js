import puppeteer from 'puppeteer-core';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

// Create a directory for storing scraper data if it doesn't exist
const dataDir = path.join(process.cwd(), 'data', 'eblive2');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// Create logs directory if it doesn't exist
const logsDir = path.join(process.cwd(), 'logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// Store active scraper process to prevent multiple runs
let isScraperRunning = false;

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
    
    return { startDate, endDate };
  } catch (e) {
    console.error(`Error parsing date: "${dateStr}"`, e);
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
  const nameParts = cleaned.split(/\s+/).filter(part => 
    part.length > 1 && 
    !part.match(/^(van|de|het|en|the|in|op|te|at|of|for|festival|rock|pop|music|concert|editie|uitgelic)$/i));
  
  if (nameParts.length > 0) {
    // If we have filtered name parts, join them with spaces
    cleaned = nameParts.join(' ');
  }
  
  // Remove trailing spaces and punctuation
  cleaned = cleaned.trim().replace(/[,.;:!?]+$/, '');
  
  return cleaned;
}

/**
 * Main scraper function for EB Live
 */
async function scrapeEBLive({ maxPages = 41, testMode = false, dockerMode = false }) {
  // Create log function with [EBLive] prefix
  const log = (message, level = 'info') => {
    const timestamp = new Date().toISOString();
    const prefix = `[EBLive] ${level}:`;
    
    const logEntry = {
      timestamp,
      level,
      message,
      prefix,
    };
    
    // Format and write to console
    const formattedMsg = `${prefix} ${message}`;
    
    if (level === 'error') {
      console.error(formattedMsg);
    } else if (level === 'warn') {
      console.warn(formattedMsg);
    } else {
      console.log(formattedMsg);
    }
    
    // Write to log file
    try {
      const logFilePath = path.join(process.cwd(), 'logs', `eblive-${new Date().toISOString().split('T')[0]}.log`);
      fs.appendFileSync(logFilePath, `${timestamp} [${level.toUpperCase()}] ${message}\n`);
    } catch (e) {
      console.error(`Failed to write to log file: ${e.message}`);
    }
    
    return logEntry;
  };
  
  // Helper to update status file
  const updateStatus = (status) => {
    try {
      const statusPath = path.join(dataDir, 'latest-status.json');
      fs.writeFileSync(statusPath, JSON.stringify({
        ...status,
        timestamp: new Date().toISOString()
      }, null, 2));
    } catch (err) {
      console.error(`Failed to update status file: ${err.message}`);
    }
  };
  
  // Start with initial status
  updateStatus({
    success: true,
    inProgress: true,
    progress: 0,
    message: 'Scraper starting...'
  });
  
  log('Starting EB Live scraper', 'info');
  log(`Running in ${dockerMode ? 'Docker container' : 'local environment'}`);
  
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
  let totalPages = 41; // Hard-coded as default
  let hasMorePages = true;
  
  // Create browser context with additional error handling
  let browser;
  try {
    // Launch browser with retries for Docker compatibility
    let browserLaunchRetries = 0;
    const maxBrowserLaunchRetries = 3;
    
    while (!browser && browserLaunchRetries < maxBrowserLaunchRetries) {
      try {
        log(`Launching browser (attempt ${browserLaunchRetries + 1}/${maxBrowserLaunchRetries})`);
        
        if (dockerMode) {
          log('Detected Docker environment - using special browser launch settings');
          
          // In Docker, we need to check multiple possible paths for Chromium
          const possiblePaths = [
            '/usr/bin/chromium',
            '/usr/bin/chromium-browser',
            '/usr/bin/google-chrome',
            '/usr/bin/google-chrome-stable',
            '/usr/bin/chrome'
          ];
          
          let chromiumPath = null;
          
          // Check which browser executable exists
          for (const path of possiblePaths) {
            try {
              if (fs.existsSync(path)) {
                chromiumPath = path;
                log(`Found browser at path: ${chromiumPath}`);
                break;
              }
            } catch (e) {
              // Continue checking other paths
            }
          }
          
          if (!chromiumPath) {
            log('No browser found at any of the expected paths. Will try without specifying executable path.', 'warn');
          }
          
          const launchOptions = {
            ignoreHTTPSErrors: true,
            args: [
              '--disable-gpu',
              '--disable-dev-shm-usage',
              '--disable-setuid-sandbox',
              '--no-sandbox',
              '--no-zygote'
            ]
          };
          
          // Only set executable path if we found it
          if (chromiumPath) {
            launchOptions.executablePath = chromiumPath;
          }
          
          try {
            browser = await puppeteer.launch(launchOptions);
          } catch (err) {
            log(`Failed to launch browser with specific path: ${err.message}`, 'warn');
            log('Trying alternate launch method for Docker...', 'info');
            
            // Try again without executable path
            try {
              browser = await puppeteer.launch({
                ignoreHTTPSErrors: true,
                args: [
                  '--disable-gpu',
                  '--disable-dev-shm-usage',
                  '--disable-setuid-sandbox',
                  '--no-sandbox',
                  '--no-zygote',
                  '--single-process'
                ]
              });
            } catch (innerErr) {
              log(`Failed alternate launch method: ${innerErr.message}`, 'error');
              throw new Error(`Failed to launch browser in Docker: ${err.message}`);
            }
          }
        } else {
          // Use Puppeteer with executable path for local environment
          const executablePath = process.platform === 'darwin'
            ? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
            : process.platform === 'win32'
              ? 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
              : '/usr/bin/google-chrome';
          
          log(`Using browser executable path: ${executablePath}`);
          
          browser = await puppeteer.launch({
            executablePath,
            headless: true,
            ignoreHTTPSErrors: true,
            args: [
              '--disable-gpu',
              '--disable-dev-shm-usage',
              '--disable-setuid-sandbox',
              '--no-sandbox',
              '--no-zygote',
              '--single-process'
            ]
          });
        }
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
    
    // Initialize first page and handle cookies
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    await page.setViewport({ width: 1280, height: 800 });
    
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
      // New code compatible with Puppeteer
      const acceptCookieButton = await page.waitForSelector('button[contains*="Accepteren en doorgaan"], button[contains*="accepteer"], button.cookie-accept', { 
        timeout: 10000,
        visible: true
      }).catch(() => null);
      
      if (acceptCookieButton) {
        await acceptCookieButton.click();
        log('Accepted cookie consent banner');
      }
    } catch (e) {
      log('No cookie banner found or already accepted');
    }
    
    // Try to get total pages from the festival count
    try {
      const pagesText = await page.evaluate(() => {
        const element = document.querySelector('h5');
        const elements = Array.from(document.querySelectorAll('h5'));
        const festivalElement = elements.find(el => el.textContent.includes('festivals gevonden'));
        return festivalElement ? festivalElement.textContent : '';
      });
      
      const festivalCount = pagesText ? parseInt(pagesText.match(/\d+/)?.[0] || '0') : 0;
      
      if (festivalCount > 0) {
        const calculatedPages = Math.ceil(festivalCount / 24); // Assuming 24 festivals per page
        totalPages = calculatedPages > 0 ? calculatedPages : totalPages;
        log(`Found approximately ${festivalCount} festivals across ${totalPages} pages`);
      } else {
        log(`Using default total pages: ${totalPages}`);
      }
    } catch (err) {
      log(`Error detecting total pages, using default (${totalPages}): ${err.message}`, 'warn');
    }
    
    // If maxPages is specified, limit the scraping
    const pagesToScrape = maxPages > 0 ? Math.min(maxPages, totalPages) : totalPages;
    log(`Will scrape ${pagesToScrape} pages in total`);
    
    // Create additional failure recovery variables
    let consecutiveFailures = 0;
    const maxConsecutiveFailures = 3;
    
    while (hasMorePages && (maxPages === 0 || currentPage <= pagesToScrape) && consecutiveFailures < maxConsecutiveFailures) {
      log(`Scraping page ${currentPage} of ${pagesToScrape > 0 ? pagesToScrape : totalPages}`);
      
      // Update progress status
      const progressPercentage = Math.min(
        5 + Math.floor((currentPage / (pagesToScrape || 1)) * 90),
        95
      );
      
      updateStatus({
        success: true,
        inProgress: true,
        progress: progressPercentage,
        message: `Scraping page ${currentPage} of ${pagesToScrape > 0 ? pagesToScrape : totalPages}`,
        metrics: {
          ...metrics,
          currentPage,
          totalPages: pagesToScrape
        }
      });
      
      // Navigate to the current page with retries
      const maxRetries = 3;
      let retries = 0;
      let pageLoaded = false;
      
      while (!pageLoaded && retries < maxRetries) {
        try {
          await page.goto(`https://www.eblive.nl/festivals/?filters%5Bsearch%5D=&filters%5Baddress%5D=&filters%5Bdistance%5D=&order_by=upcoming&page_nr=${currentPage}`, {
            timeout: 60000,
            waitUntil: 'domcontentloaded'
          });
          
          // Wait for networkidle
          await new Promise(resolve => setTimeout(resolve, 5000));
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
          await new Promise(resolve => setTimeout(resolve, 1500));
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
          await page.screenshot({ path: path.join(dataDir, `page-${currentPage}.png`) });
        }
        
        // Wait for page content to be fully loaded
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Extract all links containing 'festival_id'
        const festivalLinks = await page.$$eval('a[href*="festival_id"]', links => {
          return links.map(link => {
            // Get parent data
            const parentElement = link.closest('div') || link.parentElement;
            
            return {
              url: link.href,
              linkText: link.textContent.trim(),
              parentText: parentElement ? parentElement.textContent.trim() : '',
              parentHTML: parentElement ? parentElement.innerHTML : ''
            };
          });
        });
        
        log(`Found ${festivalLinks.length} festival links on page ${currentPage}`);
        
        // If no festivals found, try waiting and looking again
        if (festivalLinks.length === 0) {
          log('No festivals found initially, waiting longer for page to load', 'warn');
          await new Promise(resolve => setTimeout(resolve, 5000));
          
          // Try again to get festival links
          const retryLinks = await page.$$eval('a[href*="festival_id"]', links => {
            return links.map(link => {
              // Get parent data
              const parentElement = link.closest('div') || link.parentElement;
              
              return {
                url: link.href,
                linkText: link.textContent.trim(),
                parentText: parentElement ? parentElement.textContent.trim() : '',
                parentHTML: parentElement ? parentElement.innerHTML : ''
              };
            });
          });
          
          log(`Found ${retryLinks.length} festival links after waiting`);
          
          // If still no festivals, try a page reload
          if (retryLinks.length === 0) {
            log('Still no festivals found, trying to reload the page', 'warn');
            await page.reload({ waitUntil: 'domcontentloaded' });
            await new Promise(resolve => setTimeout(resolve, 3000));
          }
        }
        
        // Process all festival links
        for (const link of festivalLinks) {
          try {
            // Get URL and ID
            const url = link.url || '';
            const festivalIdMatch = url.match(/festival_id=(\d+)/);
            const festivalId = festivalIdMatch ? festivalIdMatch[1] : '';
            
            if (!festivalId) {
              log('Could not extract festival ID from URL', 'warn');
              continue;
            }
            
            // Get link text which might contain the festival name
            const linkText = link.linkText || '';
            
            // Extract more data from the parent element
            const parentData = {
              allText: link.parentText || '',
              innerHTML: link.parentHTML || '',
              linkHref: url,
              linkText
            };
            
            // Try to extract the festival name from the link or surrounding content
            let name = linkText;
            if (!name || name.length <= 3 || name.match(/meer info|lees meer|details/i)) {
              // If the link text isn't helpful, look through the parent's text
              const lines = parentData.allText.split('\n')
                .map(line => line.trim())
                .filter(line => line.length > 0);
              
              // Try to find a line that looks like a festival name
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
                console.debug(`Found duplicate festival: ${name} (${festivalId})`);
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
            }
          } catch (e) {
            log(`Error processing festival element: ${e.message}`, 'error');
            metrics.errors++;
          }
        }
        
        // If we found zero festivals on this page, mark it as an error
        if (festivalLinks.length === 0) {
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
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      // Periodically save progress
      if (currentPage % 3 === 0 || !hasMorePages) {
        const tempPath = path.join(dataDir, `eblive-festivals-progress-${new Date().toISOString().replace(/:/g, '-')}.json`);
        fs.writeFileSync(tempPath, JSON.stringify(allFestivals, null, 2));
        log(`Progress saved to ${tempPath}`);
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
    const outputPath = path.join(dataDir, `eblive-festivals-${new Date().toISOString().replace(/:/g, '-')}.json`);
    fs.writeFileSync(outputPath, JSON.stringify(allFestivals, null, 2));
    
    // Save metrics
    const metricsPath = path.join(dataDir, `eblive-metrics-${new Date().toISOString().replace(/:/g, '-')}.json`);
    fs.writeFileSync(metricsPath, JSON.stringify(metrics, null, 2));
    
    log(`Data saved to ${outputPath}`);
    
    // Update status file with final results
    updateStatus({
      success: true,
      inProgress: false,
      progress: 100,
      message: `Scraper completed. ${metrics.uniqueFestivals} unique festivals found, ${metrics.duplicates} duplicates, ${metrics.errors} errors in ${metrics.timeElapsed}`,
      festivals: allFestivals,
      metrics
    });
    
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

export default async function handler(req, res) {
  const startTime = Date.now();
  const { maxPages, testMode = false, dockerMode: requestedDockerMode = false } = req.body || {};
  
  // Auto-detect Docker environment if not explicitly requested
  // Check for common Docker environment variables or filesystem markers
  const isDockerEnvironment = () => {
    try {
      // Check for common Docker environment variables
      if (process.env.DOCKER_ENV === 'true' || process.env.NEXT_PUBLIC_DOCKER_ENV === 'true') {
        return true;
      }
      
      // Check for .dockerenv file which exists in Docker containers
      if (fs.existsSync('/.dockerenv')) {
        return true;
      }
      
      // Check if cgroup contains docker
      if (fs.existsSync('/proc/1/cgroup') && 
          fs.readFileSync('/proc/1/cgroup', 'utf8').includes('docker')) {
        return true;
      }
      
      return false;
    } catch (err) {
      console.warn('Error during Docker environment detection:', err.message);
      return false;
    }
  };
  
  // Use requested Docker mode or auto-detect
  const dockerMode = requestedDockerMode || isDockerEnvironment();
  console.log(`Docker environment detected: ${dockerMode}`);
  
  // Don't allow multiple simultaneous scraper runs
  if (isScraperRunning) {
    return res.status(409).json({
      success: false,
      inProgress: true,
      timestamp: new Date().toISOString(),
      message: "Scraper is already running. Please wait for it to complete."
    });
  }
  
  // Start scraper in the background and return immediately
  isScraperRunning = true;
  
  // Return immediate response
  res.status(200).json({
    success: true,
    inProgress: true,
    timestamp: new Date().toISOString(),
    message: `Scraper started with maxPages=${maxPages}, testMode=${testMode}, dockerMode=${dockerMode}. Check logs for updates.`
  });
  
  try {
    // Call the main scraper function with the provided parameters
    await scrapeEBLive({
      maxPages,
      testMode,
      dockerMode
    });
  } catch (error) {
    console.error('Error during scraping:', error);
    // Update the status file with the error
    const errorStatus = {
      success: false,
      inProgress: false,
      error: error.message,
      timestamp: new Date().toISOString(),
      duration: `${((Date.now() - startTime) / 1000).toFixed(2)}s`,
      message: `Scraper failed: ${error.message}`
    };
    
    try {
      fs.writeFileSync(path.join(dataDir, 'latest-status.json'), JSON.stringify(errorStatus, null, 2));
    } catch (writeErr) {
      console.error('Failed to update status file after error:', writeErr);
    }
  } finally {
    // Release the lock
    isScraperRunning = false;
  }
} 