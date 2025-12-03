/**
 * Configuration for the FestivalInfo scraper
 */

export default {
  // Base URLs
  baseUrl: 'https://www.festivalinfo.nl/festivals/',
  detailUrlPattern: 'https://www.festivalinfo.nl/festival/{id}/',
  
  // Rate limiting
  delay: process.env.FESTIVALINFO_DELAY || 2000, // 2 seconds between requests
  detailDelay: process.env.FESTIVALINFO_DETAIL_DELAY || 1500, // 1.5 seconds between detail page requests
  maxConcurrent: process.env.FESTIVALINFO_MAX_CONCURRENT || 1, // Maximum concurrent requests
  
  // Pagination
  maxPages: process.env.FESTIVALINFO_MAX_PAGES || 0, // 0 = scrape all pages
  
  // Browser config
  browserArgs: [
    '--disable-gpu',
    '--disable-dev-shm-usage',
    '--disable-setuid-sandbox',
    '--no-sandbox',
  ],
  
  // User agents to rotate between
  userAgents: [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.1.1 Safari/605.1.15',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:89.0) Gecko/20100101 Firefox/89.0',
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/90.0.4430.93 Safari/537.36',
    'Mozilla/5.0 (iPhone; CPU iPhone OS 14_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.1 Mobile/15E148 Safari/604.1'
  ],
  
  // Retry configuration
  maxRetries: 3,
  retryDelay: 5000, // 5 seconds
  
  // Output configuration
  outputDir: process.env.FESTIVALINFO_OUTPUT_DIR || './data',
  
  // Selectors for extracting data
  selectors: {
    festivalList: 'a[href*="/festival/"]',
    festivalName: 'strong',
    pagination: 'a[href*="?page="]',
    description: '.leftcol p',
    dateElements: 'strong:not([class])',
    locationInfo: 'h2:contains("REISINFORMATIE") + p, .location',
    artists: '.artist, .ActsBlock a',
    artistName: 'strong, paragraph, span',
    ticketLink: 'a[href*="tickets"], a:contains("BESTEL TICKETS")'
  },
  
  // Database configuration
  database: {
    schema: 'festival_info',
    festivalsTable: 'festivals',
    actsTable: 'acts',
    runsTable: 'scrape_runs'
  }
}; 