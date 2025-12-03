# Festival Scraper Implementation Guide

## Overview

This guide outlines how to build an app that scrapes festival information from Dutch festival websites, stores the data in Supabase, and displays it in a web app. The focus is on practical implementation strategies rather than providing complete code.

## Architecture

1. **Scraper Component**:
   - Runs locally in Docker
   - Scrapes data from festival websites
   - Uploads data to Supabase database

2. **Web App Component**:
   - Retrieves festival data from Supabase
   - Displays festival information to users

## Scraper Implementation Approach

### 1. Set Up Docker Environment

Create a Dockerfile with these key components:
- Use Node.js base image (Node 18 recommended)
- Install Chromium for headless browsing
- Install required dependencies for Puppeteer to work properly

```dockerfile
FROM node:18-slim

# Install Chromium and its dependencies
RUN apt-get update && apt-get install -y \
    chromium \
    fonts-ipafont-gothic fonts-wqy-zenhei fonts-thai-tlwg fonts-kacst fonts-freefont-ttf \
    ca-certificates \
    --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

# Set up working directory
WORKDIR /app

# Set environment variables for Puppeteer
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium
```

### 2. Website Analysis & Scraping Strategy

Based on analysis of the websites, here's the recommended approach for each:

#### partyflock.nl
- Data is organized in tables with structured metadata
- Festival information is embedded in `meta` tags with attributes like `itemprop="startDate"`, `itemprop="endDate"`, etc.
- Extract festival names from links containing `/party/`, `/festival/`, or `/event/` in their URLs
- Calculate festival duration using the startDate and endDate metadata

#### festileaks.com
- Festival data is organized in card elements with class `.festival-item`
- Extract festival name from heading elements (h1, h2, h3)
- Extract date from elements with date-like patterns (e.g., "4-6 juli 2025")
- Extract location from elements with location class
- Calculate duration from date range (like "4-6" = 3 days)

#### festivalfans.nl
- Clear structure with date patterns followed by festival links
- Festival names are typically in headings or links
- Date patterns show both single-day events ("25 april") and multi-day events ("25-26 april")
- Location is usually provided in a separate element

#### befesti.nl, eblive.nl, followthebeat.nl
- Similar approach: look for card-like elements containing festival information
- Extract data from heading elements, date patterns, and location text
- Use parent-child relationships to associate related information

### 3. Core Functions to Implement

1. **Website Scraper Functions**:
   - Create specialized functions for each website to handle their unique structures
   - Implement fallback methods if primary extraction fails

2. **Data Extraction Logic**:
   - Extract festival name, date range, location, and URL
   - Calculate festival duration from date ranges
   - Handle edge cases like missing information

3. **Data Processing**:
   - Normalize data format across different sources
   - Clean and validate extracted data
   - Remove duplicates by comparing festival name, date, and source

4. **Supabase Integration**:
   - Implement upsert operations to avoid duplicates
   - Batch uploads to handle large datasets efficiently

### 4. Key Scraping Techniques

1. **For structured websites (partyflock.nl)**:
   - Use `querySelectorAll` with metadata selectors
   - Extract data from structured attributes

2. **For card-based layouts (festileaks.com, festivalfans.nl)**:
   - Find container elements with festival information
   - Extract data from child elements with relevant classes

3. **For websites with less clear structure**:
   - Identify text patterns for dates, locations, and festival names
   - Walk up the DOM tree to find related information
   - Use multiple extraction attempts with fallbacks

4. **Handle cookie consent banners**:
   - Implement code to accept cookies when necessary
   - Use a delay to ensure the page is fully loaded

## Pagination Handling

Many festival websites implement pagination to display their event listings across multiple pages. Here's a strategy for handling pagination:

### 1. Pagination Detection

- Look for navigation elements with page numbers or "Next"/"Previous" links
- Common selectors include: `.pagination`, `.pages`, `[class*="paging"]`, `nav ul li a`

### 2. Common Pagination Patterns

Based on the examined websites:

#### partyflock.nl
- Uses tab-based navigation for different months
- Each tab loads a new table with festivals
- Strategy: Click on each month tab and scrape the content

#### festileaks.com
- Uses "Load More" buttons rather than traditional pagination
- Strategy: Detect and click the "Load More" button until all content is loaded

#### festivalfans.nl
- Shows multiple events on a single page
- Has category navigation rather than pagination
- Strategy: Scrape the main page and follow category links if needed

### 3. Implementation Approaches

#### Method 1: Click-through Pagination
```javascript
async function scrapeWithPagination(page, scrapeCurrentPage) {
  let results = [];
  let hasNextPage = true;
  let pageNum = 1;
  
  while (hasNextPage) {
    console.log(`Scraping page ${pageNum}...`);
    
    // Scrape current page content
    const pageResults = await scrapeCurrentPage(page);
    results = [...results, ...pageResults];
    
    // Check for next page button
    const nextButton = await page.$('.pagination .next, .pagination [aria-label="Next"]');
    if (nextButton) {
      await nextButton.click();
      await page.waitForTimeout(2000); // Wait for new content to load
      pageNum++;
    } else {
      hasNextPage = false;
    }
  }
  
  return results;
}
```

#### Method 2: URL Parameter Pagination
```javascript
async function scrapeWithURLPagination(baseUrl, totalPages, scrapeFunction) {
  let allResults = [];
  
  for (let page = 1; page <= totalPages; page++) {
    const url = `${baseUrl}?page=${page}`;
    console.log(`Scraping ${url}...`);
    
    const pageResults = await scrapeFunction(url);
    allResults = [...allResults, ...pageResults];
  }
  
  return allResults;
}
```

#### Method 3: Infinite Scroll Simulation
```javascript
async function scrapeInfiniteScroll(page, extractItems, itemTargetCount) {
  let items = [];
  
  try {
    let previousHeight;
    
    while (items.length < itemTargetCount) {
      items = await page.evaluate(extractItems);
      previousHeight = await page.evaluate('document.body.scrollHeight');
      await page.evaluate('window.scrollTo(0, document.body.scrollHeight)');
      await page.waitForFunction(`document.body.scrollHeight > ${previousHeight}`);
      await page.waitForTimeout(1000);
      
      // Safety check - if no new items after scrolling, exit
      const newItems = await page.evaluate(extractItems);
      if (newItems.length === items.length) {
        break;
      }
    }
  } catch (e) {
    console.log('Error scrolling: ', e);
  }
  
  return items;
}
```

### 4. Detecting the End of Pagination

- Check for disabled "Next" buttons: `nextButton.classList.contains('disabled')`
- Verify page numbers in URL or pagination components
- Look for text indicating "End of results" or similar
- Implement a safety counter to prevent infinite loops

### 5. Handling AJAX-based Pagination

For websites that load content dynamically via AJAX:

1. Listen for network requests that fetch data
2. Extract pagination parameters from these requests
3. Directly call the API endpoints to get data for each page
4. Example with Puppeteer:

```javascript
// Monitor network requests for AJAX pagination
await page.setRequestInterception(true);
page.on('request', request => {
  if (request.url().includes('/api/events')) {
    console.log('Found API request:', request.url());
    // Store API URL for direct fetching
  }
  request.continue();
});
```

## Implementation Notes

1. **Error Handling**:
   - Create robust error handling for each website
   - Continue scraping even if one website fails
   - Log detailed error information for debugging

2. **Rate Limiting**:
   - Add delays between requests to avoid being blocked
   - Implement randomized delays to appear more human-like

3. **Data Validation**:
   - Validate dates and normalize formats
   - Check for missing required fields
   - Handle multilingual content appropriately

4. **Pagination Retry Logic**:
   - Implement backoff strategy for failed pagination attempts
   - Set maximum retry attempts to avoid endless loops
   - Log pagination failures for later analysis

## Supabase Schema Design

Create a table structure that accommodates all festival information:

```sql
CREATE TABLE festivals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  start_date TEXT,
  end_date TEXT,
  duration_days INTEGER,
  location TEXT,
  url TEXT,
  source_website TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(name, start_date, source_website)
);

-- Additional indexes for efficient queries
CREATE INDEX idx_festivals_start_date ON festivals(start_date);
CREATE INDEX idx_festivals_source ON festivals(source_website);
CREATE INDEX idx_festivals_location ON festivals(location);
```

## Final Advice

1. Start with a single website implementation and test thoroughly before adding more
2. Create a flexible data model in Supabase that can accommodate information from all sources
3. Implement the scraper as a scheduled job that runs periodically to keep data fresh
4. Consider adding a manual trigger option for immediate data updates
5. Focus on making the extraction code resilient to website layout changes
6. Implement proper error reporting to identify problematic websites quickly

## Conclusion

The festival scraper architecture described in this guide provides a robust approach to collect data from multiple festival websites and consolidate it in a central database. By implementing specialized scrapers for each website and handling pagination carefully, you can build a comprehensive festival database that will power your web application.
