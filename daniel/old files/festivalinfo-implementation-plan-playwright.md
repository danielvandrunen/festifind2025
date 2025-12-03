# Festivalinfo.nl Scraping Implementation Plan for V0

This implementation plan is specifically designed to help V0 successfully scrape Festivalinfo.nl while avoiding the common errors encountered, particularly the "The string did not match the expected pattern" error with Puppeteer.

## Key Insights and Issues

1. The website has a weekly pagination structure
2. Puppeteer appears to have difficulties with some JavaScript on the site
3. The site likely has anti-scraping measures in place causing 403 errors
4. We need an approach that's less detectable than standard browser automation

## Recommended Approach: Playwright + Stealth Mode

Playwright is a better choice than Puppeteer for this specific site because:
1. It has better handling of complex JavaScript
2. More advanced stealth capabilities out of the box
3. Better error recovery mechanisms

## Implementation Plan

### Step 1: Setup Project Structure

```
/festifind
  /src
    /scrapers
      /festivalinfo
        index.js
        detail-scraper.js
        list-scraper.js
        utils.js
    /db
      upload.js
  /data
    /festivalinfo
      raw/
      processed/
```

### Step 2: Base Configuration (index.js)

```javascript
const { chromium } = require('playwright');
const fs = require('fs/promises');
const path = require('path');
const { scrapeWeekPage } = require('./list-scraper');
const { scrapeDetailPage } = require('./detail-scraper');

// Constants
const BASE_URL = 'https://www.festivalinfo.nl/festivals/';
const MAX_WEEKS = 52; // Scrape up to a year ahead
const OUTPUT_DIR = path.join(__dirname, '../../../data/festivalinfo/raw');

async function main() {
  console.log('Starting Festivalinfo scraper');
  
  // Create output directory if it doesn't exist
  await fs.mkdir(OUTPUT_DIR, { recursive: true });
  
  // Launch browser with stealth configuration
  const browser = await chromium.launch({
    headless: false, // Use true in production, false for debugging
    slowMo: 50 // Slow down actions to appear more human-like
  });
  
  try {
    const context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      viewport: { width: 1920, height: 1080 },
      deviceScaleFactor: 1,
      // Prevent WebDriver detection
      bypassCSP: true,
      permissions: ['geolocation'],
      javaScriptEnabled: true
    });
    
    // Create a new page
    const page = await context.newPage();
    
    // Add stealth mode behavior
    await page.addInitScript(() => {
      // Override properties that detect automation
      Object.defineProperty(navigator, 'webdriver', { get: () => false });
      delete navigator.__proto__.webdriver;
      // Hide automation flags
      window.chrome = { runtime: {} };
      // Hide automation-related functions
      const originalQuerySelector = document.querySelector;
      document.querySelector = function(...args) {
        if (args[0] && args[0].includes('driver')) return null;
        return originalQuerySelector.apply(this, args);
      };
    });
    
    // Visit homepage first to get cookies
    await page.goto('https://www.festivalinfo.nl/', { waitUntil: 'domcontentloaded', timeout: 30000 });
    
    // Accept cookies if there's a prompt
    try {
      const cookieButton = await page.waitForSelector('button:has-text("Accepteer")', { timeout: 5000 });
      if (cookieButton) await cookieButton.click();
    } catch (e) {
      console.log('No cookie prompt detected or not in expected format');
    }
    
    // Wait for a bit before continuing
    await page.waitForTimeout(2000);
    
    // Array to collect festivals
    const festivals = [];
    
    // Navigate through weeks
    for (let week = 0; week < MAX_WEEKS; week++) {
      const url = week === 0 ? BASE_URL : `${BASE_URL}?page=${week}`;
      console.log(`Scraping week ${week}: ${url}`);
      
      try {
        // Use a function with retry logic
        const weekFestivals = await scrapeWeekPage(page, url, week);
        
        if (weekFestivals && weekFestivals.length > 0) {
          festivals.push(...weekFestivals);
          
          // Save raw HTML for this week
          const content = await page.content();
          await fs.writeFile(path.join(OUTPUT_DIR, `week_${week}.html`), content);
          
          console.log(`Found ${weekFestivals.length} festivals for week ${week}`);
        } else {
          console.log(`No festivals found for week ${week}, we might have reached the end`);
          
          // Check if we're at the end of available data
          const isLastPage = await page.evaluate(() => {
            return !document.querySelector('a[href*="festivals/?page="]');
          });
          
          if (isLastPage) {
            console.log('No more week links found, ending scrape');
            break;
          }
        }
        
        // Random delay between weeks to appear more human-like
        await page.waitForTimeout(3000 + Math.random() * 2000);
        
      } catch (error) {
        console.error(`Error scraping week ${week}:`, error.message);
        // Save the state before error for debugging
        await page.screenshot({ path: path.join(OUTPUT_DIR, `error_week_${week}.png`) });
        
        // Continue to next week despite errors
        continue;
      }
    }
    
    // Save the collected festivals for later processing
    await fs.writeFile(
      path.join(OUTPUT_DIR, 'festivals.json'), 
      JSON.stringify(festivals, null, 2)
    );
    
    console.log(`Scraped ${festivals.length} festivals in total`);
    
    // Process a subset of festival detail pages
    // Limit to avoid overloading or detection
    const samplesToProcess = festivals.slice(0, 50);
    let successCount = 0;
    
    for (const [index, festival] of samplesToProcess.entries()) {
      try {
        console.log(`Processing detail page ${index + 1}/${samplesToProcess.length}: ${festival.name}`);
        
        // Use the detail scraper function
        const detailData = await scrapeDetailPage(page, festival.detailUrl, festival.id);
        
        // Merge detail data with festival data
        festivals[festivals.findIndex(f => f.id === festival.id)] = {
          ...festival,
          ...detailData
        };
        
        successCount++;
        
        // Add human-like delay between requests
        await page.waitForTimeout(4000 + Math.random() * 3000);
        
      } catch (error) {
        console.error(`Error scraping detail for ${festival.name}:`, error.message);
        // Continue despite errors
      }
    }
    
    console.log(`Successfully scraped ${successCount} detail pages out of ${samplesToProcess.length}`);
    
    // Save the enriched data
    await fs.writeFile(
      path.join(OUTPUT_DIR, 'festivals_with_details.json'), 
      JSON.stringify(festivals, null, 2)
    );
    
  } catch (error) {
    console.error('Fatal error in scraper:', error);
  } finally {
    await browser.close();
    console.log('Festivalinfo scraper completed');
  }
}

// Start the scraper
main().catch(console.error);

module.exports = { main };
```

### Step 3: List Page Scraper (list-scraper.js)

```javascript
const fs = require('fs/promises');
const path = require('path');
const { extractFestivalId, sleep } = require('./utils');

const OUTPUT_DIR = path.join(__dirname, '../../../data/festivalinfo/raw');

/**
 * Scrapes a week page with retry logic
 */
async function scrapeWeekPage(page, url, weekNum) {
  const MAX_RETRIES = 3;
  let retries = 0;
  
  while (retries < MAX_RETRIES) {
    try {
      // Navigate to the page with timeout and wait until network is idle
      const response = await page.goto(url, { 
        waitUntil: 'networkidle',
        timeout: 30000 
      });
      
      if (response.status() === 403) {
        console.log(`Received 403 Forbidden for week ${weekNum}, retrying with different approach`);
        retries++;
        
        // Wait longer between retries
        await sleep(10000 + Math.random() * 5000);
        
        // Try with a different navigation approach
        await page.goto('https://www.festivalinfo.nl/', { waitUntil: 'domcontentloaded' });
        await sleep(3000);
        // Click on festivals tab instead of direct URL
        await page.click('a[href*="festivals"]');
        await sleep(2000);
        
        // If not on first week, use pagination
        if (weekNum > 0) {
          for (let i = 0; i < weekNum; i++) {
            const nextButton = await page.$('a:has-text("Volgende week")');
            if (nextButton) {
              await nextButton.click();
              await sleep(2000);
            }
          }
        }
        
        continue;
      }
      
      // Wait for the festival table to load
      await page.waitForSelector('table tr', { timeout: 10000 }).catch(() => {
        console.log('Festival table not found, page might be empty or structure changed');
      });
      
      // Take screenshot for debugging
      await page.screenshot({ path: path.join(OUTPUT_DIR, `week_${weekNum}_screenshot.png`) });
      
      // Extract festivals
      const festivals = await page.evaluate((weekNumber) => {
        const results = [];
        
        // Get all date sections
        let currentDate = null;
        const dateRows = Array.from(document.querySelectorAll('section.festival_agenda_date'));
        
        // Process each date row
        dateRows.forEach(dateRow => {
          try {
            const day = dateRow.querySelector('.festival_dag')?.textContent.trim();
            const monthElem = dateRow.querySelectorAll('span')[2];
            const month = monthElem ? monthElem.textContent.trim() : '';
            
            if (day && month) {
              currentDate = `${day} ${month} 2025`;
              
              // Get all festival rows after this date section until the next date section
              let festivalElements = [];
              let currentElement = dateRow.parentElement;
              
              // Keep traversing siblings until next date section or end
              while (currentElement.nextElementSibling) {
                currentElement = currentElement.nextElementSibling;
                
                // Check if this is a new date section
                if (currentElement.querySelector('section.festival_agenda_date')) {
                  break;
                }
                
                // Check if this contains a festival
                const festivalLinks = currentElement.querySelectorAll('a[href*="/festival/"]');
                festivalLinks.forEach(link => {
                  if (link.href && !festivalElements.includes(link)) {
                    festivalElements.push(link);
                  }
                });
              }
              
              // Process each festival element
              festivalElements.forEach(festivalElem => {
                try {
                  const linkElem = festivalElem;
                  const href = linkElem.href;
                  
                  // Find parent container with festival info
                  const infoContainer = linkElem.querySelector('section.festival_rows_info');
                  
                  if (infoContainer) {
                    const nameElem = infoContainer.querySelector('.td_1 strong');
                    const locationElem = infoContainer.querySelector('.td_2');
                    const durationElem = infoContainer.querySelector('.td_3');
                    
                    const name = nameElem ? nameElem.textContent.trim() : '';
                    const location = locationElem ? locationElem.textContent.trim().replace(/\\n/g, ' ') : '';
                    const duration = durationElem ? durationElem.textContent.trim() : '';
                    
                    if (name) {
                      results.push({
                        name,
                        date: currentDate,
                        location,
                        duration,
                        detailUrl: href,
                        week: weekNumber,
                        source: 'Festivalinfo'
                      });
                    }
                  }
                } catch (elemError) {
                  console.error('Error processing festival element:', elemError);
                }
              });
            }
          } catch (dateError) {
            console.error('Error processing date row:', dateError);
          }
        });
        
        return results;
      }, weekNum);
      
      console.log(`Found ${festivals.length} festivals on week ${weekNum}`);
      
      // Add unique ID to each festival based on URL
      return festivals.map(festival => ({
        ...festival,
        id: extractFestivalId(festival.detailUrl)
      }));
      
    } catch (error) {
      console.error(`Attempt ${retries + 1} failed for week ${weekNum}:`, error.message);
      retries++;
      
      if (retries >= MAX_RETRIES) {
        console.error(`Failed to scrape week ${weekNum} after ${MAX_RETRIES} attempts`);
        return [];
      }
      
      // Wait before retrying
      await sleep(5000 + (retries * 2000));
    }
  }
  
  return [];
}

module.exports = { scrapeWeekPage };
```

### Step 4: Detail Page Scraper (detail-scraper.js)

```javascript
const fs = require('fs/promises');
const path = require('path');
const { sleep } = require('./utils');

const OUTPUT_DIR = path.join(__dirname, '../../../data/festivalinfo/raw');

/**
 * Scrapes a festival detail page
 */
async function scrapeDetailPage(page, url, festivalId) {
  const MAX_RETRIES = 3;
  let retries = 0;
  
  while (retries < MAX_RETRIES) {
    try {
      console.log(`Scraping detail page: ${url}`);
      
      // Navigate to the page with timeout and wait until network is idle
      const response = await page.goto(url, { 
        waitUntil: 'domcontentloaded',
        timeout: 30000 
      });
      
      if (response.status() === 403) {
        console.log(`Received 403 Forbidden for detail page, retrying with different approach`);
        retries++;
        
        // Wait longer between retries
        await sleep(10000 + Math.random() * 5000);
        
        // Try a different approach - visit the homepage first
        await page.goto('https://www.festivalinfo.nl/', { waitUntil: 'domcontentloaded' });
        await sleep(3000);
        
        // Do some random actions to look human
        await page.evaluate(() => {
          window.scrollBy(0, 300);
        });
        await sleep(1000);
        
        // Then try the detail page again
        continue;
      }
      
      // Wait for the main festival content
      await page.waitForSelector('section.event', { timeout: 15000 }).catch(() => {
        console.log('Festival detail content not found, structure may have changed');
      });
      
      // Take screenshot for debugging
      await page.screenshot({ path: path.join(OUTPUT_DIR, `detail_${festivalId}_screenshot.png`) });
      
      // Save the raw HTML
      const content = await page.content();
      await fs.writeFile(path.join(OUTPUT_DIR, `detail_${festivalId}.html`), content);
      
      // Extract detail information
      const detailData = await page.evaluate(() => {
        const result = {
          detailedDates: [],
          fullLocation: '',
          description: ''
        };
        
        // Get all date elements for multi-day events
        const dateElements = document.querySelectorAll('.event_date');
        if (dateElements && dateElements.length > 0) {
          Array.from(dateElements).forEach(dateElem => {
            const dayOfWeek = dateElem.querySelector('.small_item')?.textContent.trim() || '';
            const day = dateElem.querySelector('strong span')?.textContent.trim() || '';
            const month = dateElem.querySelectorAll('.small_item')[1]?.textContent.trim() || '';
            
            if (day && month) {
              result.detailedDates.push(`${dayOfWeek} ${day} ${month} 2025`);
            }
          });
        }
        
        // Get full location information
        const locationElem = document.querySelector('p:has(.festival_location_icon)');
        if (locationElem) {
          result.fullLocation = locationElem.textContent.trim();
        }
        
        // Get description
        const descElem = document.querySelector('.muziekfestival-description');
        if (descElem) {
          result.description = descElem.textContent.trim();
        }
        
        // Get ticket info if available
        const ticketElems = document.querySelectorAll('.ticket-info');
        if (ticketElems.length > 0) {
          result.ticketInfo = Array.from(ticketElems).map(elem => elem.textContent.trim()).join(' | ');
        }
        
        return result;
      });
      
      return detailData;
      
    } catch (error) {
      console.error(`Attempt ${retries + 1} failed for detail page ${festivalId}:`, error.message);
      retries++;
      
      if (retries >= MAX_RETRIES) {
        console.error(`Failed to scrape detail page ${festivalId} after ${MAX_RETRIES} attempts`);
        return {};
      }
      
      // Wait before retrying
      await sleep(5000 + (retries * 2000));
    }
  }
  
  return {};
}

module.exports = { scrapeDetailPage };
```

### Step 5: Utility Functions (utils.js)

```javascript
/**
 * Extracts a festival ID from a URL
 */
function extractFestivalId(url) {
  if (!url) return 'unknown';
  
  try {
    // Parse the URL to extract the festival ID
    const matches = url.match(/\/festival\/(\d+)\//);
    if (matches && matches[1]) {
      return matches[1];
    }
    
    // Fallback - use the whole URL's hash
    return `festival_${url.split('/').pop().replace(/\W/g, '_')}`;
  } catch (e) {
    return 'unknown';
  }
}

/**
 * Sleep function for delays
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Gets a random delay to appear more human-like
 */
function getRandomDelay(min, max) {
  return Math.floor(Math.random() * (max - min + 1) + min);
}

/**
 * Gets a random user agent
 */
function getRandomUserAgent() {
  const userAgents = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:124.0) Gecko/20100101 Firefox/124.0',
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:123.0) Gecko/20100101 Firefox/123.0'
  ];
  
  return userAgents[Math.floor(Math.random() * userAgents.length)];
}

module.exports = {
  extractFestivalId,
  sleep,
  getRandomDelay,
  getRandomUserAgent
};
```

### Step 6: Local DB Upload Utility (db/upload.js)

```javascript
const fs = require('fs/promises');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

// Supabase config from the project
const supabaseUrl = 'https://lfqwwjrvxiqbizirwxgf.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxmcXd3anJ2eGlxYml6aXJ3eGdmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDQzNjg0OTgsImV4cCI6MjA1OTk0NDQ5OH0.u15Z1OSFy-RS-2Jv-diKVl_k8-uoCcFyTtsfCXbuGAw';

// Initialize Supabase client
const supabase = createClient(supabaseUrl, supabaseKey);

/**
 * Uploads festival data to Supabase
 */
async function uploadFestivalsToSupabase(filePath) {
  try {
    console.log(`Reading festival data from ${filePath}`);
    
    // Read the JSON file
    const rawData = await fs.readFile(filePath, 'utf8');
    const festivals = JSON.parse(rawData);
    
    console.log(`Uploading ${festivals.length} festivals to Supabase`);
    
    // Format data for upload
    const formattedFestivals = festivals.map(festival => ({
      name: festival.name,
      start_date: formatDateString(festival.date),
      location: festival.location,
      duration: extractDurationDays(festival.duration),
      source: 'Festivalinfo',
      source_url: festival.detailUrl,
      source_id: festival.id,
      description: festival.description || '',
      is_archived: false,
      is_favorite: false
    }));
    
    // Upload to Supabase in batches of 50
    const batchSize = 50;
    for (let i = 0; i < formattedFestivals.length; i += batchSize) {
      const batch = formattedFestivals.slice(i, i + batchSize);
      
      const { data, error } = await supabase
        .from('festivals')
        .upsert(batch, { 
          onConflict: 'source_id, source',
          ignoreDuplicates: false
        });
      
      if (error) {
        console.error(`Error uploading batch ${i / batchSize + 1}:`, error);
      } else {
        console.log(`Successfully uploaded batch ${i / batchSize + 1} of ${Math.ceil(formattedFestivals.length / batchSize)}`);
      }
      
      // Wait a bit between batches
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    console.log('Upload to Supabase completed');
    
  } catch (error) {
    console.error('Error uploading festivals to Supabase:', error);
  }
}

/**
 * Formats a date string to ISO format
 */
function formatDateString(dateString) {
  // Example input: "11 APR 2025"
  if (!dateString) return null;
  
  try {
    const parts = dateString.split(' ');
    if (parts.length < 3) return null;
    
    const day = parts[0].padStart(2, '0');
    
    // Convert month abbreviation to number
    const monthMap = {
      'JAN': '01', 'FEB': '02', 'MAR': '03', 'MRT': '03', 
      'APR': '04', 'MEI': '05', 'MAY': '05', 'JUN': '06',
      'JUL': '07', 'AUG': '08', 'SEP': '09', 'OKT': '10', 
      'OCT': '10', 'NOV': '11', 'DEC': '12'
    };
    
    const month = monthMap[parts[1].toUpperCase()] || '01';
    const year = parts[2];
    
    return `${year}-${month}-${day}`;
  } catch (e) {
    console.error('Error formatting date:', e);
    return null;
  }
}

/**
 * Extracts the number of days from duration string
 */
function extractDurationDays(durationString) {
  if (!durationString) return 1;
  
  try {
    // Example input: "2 dagen"
    const match = durationString.match(/(\d+)\s*dagen?/);
    if (match && match[1]) {
      return parseInt(match[1], 10);
    }
    
    // Another format might be "(1/2)" meaning 1 of 2 days
    const formatMatch = durationString.match(/\((\d+)\/(\d+)\)/);
    if (formatMatch && formatMatch[2]) {
      return parseInt(formatMatch[2], 10);
    }
    
    return 1; // Default to 1 day
  } catch (e) {
    return 1;
  }
}

// Command line usage
if (require.main === module) {
  const args = process.argv.slice(2);
  const filePath = args[0] || path.join(__dirname, '../../data/festivalinfo/raw/festivals_with_details.json');
  
  uploadFestivalsToSupabase(filePath).catch(console.error);
}

module.exports = { uploadFestivalsToSupabase };
```

## Key Implementation Differences from Previous Approach

1. **Switching to Playwright** instead of Puppeteer:
   - Better handling of complex JavaScript
   - More reliable navigation
   - Better error recovery

2. **Enhanced Stealth Techniques**:
   - Overrides WebDriver detection properties
   - Randomizes behavior patterns
   - Mimics real browser fingerprints
   - Handles cookies properly

3. **Progressive Navigation Approach**:
   - Alternative navigation paths when 403 errors occur
   - Uses natural browsing patterns (clicking links vs direct URL navigation)
   - Implements retry logic with increasing backoff

4. **Robust Error Handling**:
   - Proper handling of unexpected page structures
   - Graceful recovery from network issues
   - Detailed logging for debugging
   - Screenshots at failure points

5. **Data Processing Improvements**:
   - Better date parsing with Dutch month handling
   - Fallbacks for missing information
   - Structured storage of multi-day events

## Advanced Anti-Detection Techniques

To avoid the 403 errors that V0 is encountering, the implementation includes multiple advanced anti-detection techniques:

### 1. Browser Context Configuration

```javascript
// Create a stealthy browser context
const context = await browser.newContext({
  userAgent: getRandomUserAgent(),
  viewport: { width: 1920, height: 1080 },
  deviceScaleFactor: 1,
  colorScheme: 'light',
  locale: 'nl-NL',
  timezoneId: 'Europe/Amsterdam',
  geolocation: { longitude: 4.9041, latitude: 52.3676 }, // Amsterdam coordinates
  permissions: ['geolocation'],
  bypassCSP: true,
  javaScriptEnabled: true,
  // Set has-touch for mobile emulation occasionally
  hasTouch: Math.random() > 0.8,
  // Reduce motion to appear more like an accessibility user
  reducedMotion: Math.random() > 0.9 ? 'reduce' : 'no-preference',
});
```

### 2. Custom Page Initialization Scripts

```javascript
// Add scripts that hide automation
await page.addInitScript(() => {
  // Override properties that detect automation
  Object.defineProperty(navigator, 'webdriver', { get: () => false });
  
  // Add plugins array to navigator
  if (navigator.plugins.length === 0) {
    Object.defineProperty(navigator, 'plugins', {
      get: () => [1, 2, 3, 4, 5].map(() => ({
        description: 'Chromium PDF Plugin',
        filename: 'internal-pdf-viewer',
        name: 'Chrome PDF Plugin',
        MimeTypes: [{
          description: 'Portable Document Format',
          enabledPlugin: true,
          suffixes: 'pdf',
          type: 'application/pdf'
        }]
      }))
    });
  }
  
  // Add Chrome-specific properties
  window.chrome = {
    app: {
      isInstalled: false,
      InstallState: { DISABLED: 'disabled', INSTALLED: 'installed', NOT_INSTALLED: 'not_installed' },
      RunningState: { CANNOT_RUN: 'cannot_run', READY_TO_RUN: 'ready_to_run', RUNNING: 'running' }
    },
    runtime: {
      OnInstalledReason: {
        CHROME_UPDATE: 'chrome_update',
        INSTALL: 'install',
        SHARED_MODULE_UPDATE: 'shared_module_update',
        UPDATE: 'update'
      },
      OnRestartRequiredReason: {
        APP_UPDATE: 'app_update',
        OS_UPDATE: 'os_update',
        PERIODIC: 'periodic'
      },
      PlatformArch: {
        ARM: 'arm',
        ARM64: 'arm64',
        MIPS: 'mips',
        MIPS64: 'mips64',
        X86_32: 'x86-32',
        X86_64: 'x86-64'
      },
      PlatformNaclArch: {
        ARM: 'arm',
        MIPS: 'mips',
        MIPS64: 'mips64',
        X86_32: 'x86-32',
        X86_64: 'x86-64'
      },
      PlatformOs: {
        ANDROID: 'android',
        CROS: 'cros',
        LINUX: 'linux',
        MAC: 'mac',
        OPENBSD: 'openbsd',
        WIN: 'win'
      },
      RequestUpdateCheckStatus: {
        NO_UPDATE: 'no_update',
        THROTTLED: 'throttled',
        UPDATE_AVAILABLE: 'update_available'
      }
    }
  };
  
  // Override iframe contentWindow access behavior
  const nativelyGetContentWindow = Object.getOwnPropertyDescriptor(
    HTMLIFrameElement.prototype, 'contentWindow'
  ).get;
  
  Object.defineProperty(HTMLIFrameElement.prototype, 'contentWindow', {
    get() {
      const contentWindow = nativelyGetContentWindow.call(this);
      if (contentWindow) {
        Object.defineProperty(contentWindow.navigator, 'webdriver', { get: () => false });
      }
      return contentWindow;
    }
  });
  
  // Add canvas fingerprint randomization
  const originalToDataURL = HTMLCanvasElement.prototype.toDataURL;
  HTMLCanvasElement.prototype.toDataURL = function(type) {
    if (type === 'image/png' && this.width === 16 && this.height === 16) {
      // This is likely a fingerprinting attempt
      const oldData = originalToDataURL.apply(this, arguments);
      
      // Add slight random noise to the fingerprint
      const slight_variation = Math.floor(Math.random() * 15);
      return oldData.substring(0, oldData.length - slight_variation) + 
             oldData.substring(oldData.length - slight_variation).split('').reverse().join('');
    }
    return originalToDataURL.apply(this, arguments);
  };
});
```

### 3. Human-Like Browsing Behavior

```javascript
/**
 * Simulates realistic human browsing behavior
 */
async function simulateHumanBrowsing(page) {
  // Random scrolling
  const scrollAmount = Math.floor(Math.random() * 1000) + 500;
  await page.evaluate((amount) => window.scrollBy(0, amount), scrollAmount);
  await page.waitForTimeout(Math.random() * 1000 + 500);
  
  // Mouse movements
  const randomX = Math.floor(Math.random() * 800);
  const randomY = Math.floor(Math.random() * 600);
  await page.mouse.move(randomX, randomY);
  
  // Sometimes hover over random links (30% chance)
  if (Math.random() < 0.3) {
    const links = await page.$('a');
    if (links.length > 0) {
      const randomLink = links[Math.floor(Math.random() * links.length)];
      await randomLink.hover();
      await page.waitForTimeout(Math.random() * 1000 + 300);
    }
  }
  
  // Sometimes scroll back up a bit (20% chance)
  if (Math.random() < 0.2) {
    const upAmount = -(Math.floor(Math.random() * 300) + 100);
    await page.evaluate((amount) => window.scrollBy(0, amount), upAmount);
    await page.waitForTimeout(Math.random() * 800 + 200);
  }
}
```

### 4. Dynamic Proxy Rotation (if needed)

If you encounter persistent IP blocking, you can implement proxy rotation:

```javascript
/**
 * Creates a browser with proxy settings
 */
async function createBrowserWithProxy() {
  const proxies = [
    { server: 'http://proxy1.example.com:8080', username: 'user1', password: 'pass1' },
    { server: 'http://proxy2.example.com:8080', username: 'user2', password: 'pass2' },
    // Add more proxies as needed
  ];
  
  const proxy = proxies[Math.floor(Math.random() * proxies.length)];
  
  return await chromium.launch({
    headless: false,
    proxy: {
      server: proxy.server,
      username: proxy.username,
      password: proxy.password
    }
  });
}
```

## Handling the "String Did Not Match Expected Pattern" Error

This specific error in V0 with Puppeteer often occurs due to CSS selector issues or timing problems. Our implementation addresses this by:

1. Using more robust selectors
2. Adding proper waiting for elements
3. Implementing proper error handling
4. Using Playwright's more reliable selectors

## Data Processing and Parsing

The scraper includes logic to properly handle the specific structures of Festivalinfo.nl:

1. **Date Handling**: Proper parsing of Dutch date formats
2. **Navigation Patterns**: Week-by-week navigation
3. **Multi-Day Festivals**: Special handling for festivals that span multiple days

## Tracking State and Progress

To avoid restarting from scratch if the scraping is interrupted:

```javascript
/**
 * Saves the current progress
 */
async function saveProgress(currentWeek, processedFestivals) {
  const progressData = {
    lastWeek: currentWeek,
    timestamp: new Date().toISOString(),
    processedCount: processedFestivals.length
  };
  
  await fs.writeFile(
    path.join(OUTPUT_DIR, 'progress.json'), 
    JSON.stringify(progressData, null, 2)
  );
}

/**
 * Loads the previous progress if available
 */
async function loadProgress() {
  const progressFile = path.join(OUTPUT_DIR, 'progress.json');
  
  try {
    if (await fs.access(progressFile).then(() => true).catch(() => false)) {
      const data = await fs.readFile(progressFile, 'utf8');
      return JSON.parse(data);
    }
  } catch (error) {
    console.error('Error loading progress:', error);
  }
  
  return null;
}
```

## Installation and Running Instructions

1. **Install dependencies**:

```bash
npm install playwright axios fs-extra path
```

2. **Run the scraper**:

```bash
node src/scrapers/festivalinfo/index.js
```

3. **Upload to Supabase**:

```bash
node src/db/upload.js
```

## Troubleshooting Guide

If you encounter issues:

1. **403 Errors**: 
   - Use the alternative navigation paths
   - Implement proxy rotation
   - Add more random delays

2. **Parsing Issues**:
   - Check if the website structure has changed
   - Update the selectors accordingly
   - Look at the screenshots for debugging

3. **Performance Issues**:
   - Reduce concurrent requests
   - Increase delays between requests
   - Limit the number of weeks to scrape at once

By following this implementation plan, V0 should be able to successfully scrape Festivalinfo.nl while avoiding the common errors encountered previously.
