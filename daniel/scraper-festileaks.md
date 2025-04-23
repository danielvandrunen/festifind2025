# Festileaks Scraper Specification

## Overview

This document details the implementation specifications for the Festileaks website scraper. The scraper will extract festival data from the Festileaks festival agenda page, which uses a specific pagination system with query parameters.

## Source Website

- **Website**: [Festileaks](https://festileaks.com/festivalagenda/)
- **Type**: Dutch festival news and information website

## Scraping Strategy

The Festileaks website uses a pagination system with specific URL parameters. The scraping strategy will need to:
1. Start with the base URL for the first page
2. Extract festival data from the current page
3. Navigate to the next page using the correct pagination URL pattern
4. Repeat until all pages (approximately 25) have been processed
5. Visit individual detail pages for complete information when needed

## HTML Structure

### Festival List Page

The main page contains festivals in a list format with 20 festivals per page. Key elements:

#### Festival List Item
```html
<div class="festivals-list-item">
    <div class="festivals-list-column column-name">
        <a href="/festival/ra-dius-festival/2025/" title="Bekijk Ra:dius Festival 2025" class="festival-item article">
            <div class="festival-logo radius-small">
                <div class="image-container">
                    <div class="image-inner">
                        <img src="https://festileaks.com/wp-content/uploads/2024/11/radius-80x80.jpeg" alt="Ra:dius Festival Logo">
                    </div>
                </div>
            </div>
            <div class="festival-content">
                <span class="festival-title">Ra:dius Festival</span>
                <span class="festival-date">26 april 2025</span>
                <span class="festival-location">
                    <div class="flag">
                        <div class="image-container">
                            <div class="image-inner">
                                <img src="https://festileaks.com/wp-content/themes/festileaks/media/flags/nl.png" alt="Nederland">
                            </div>
                        </div>
                    </div>
                    <span>Maastricht, Nederland</span>
                </span>
            </div>
        </a>
    </div>
    <div class="festivals-list-column column-line-up">
        <!-- Lineup information -->
    </div>
</div>
```

### Pagination

The pagination URLs follow a specific pattern with query parameters:

- Page 1: `https://festileaks.com/festivalagenda/`
- Page 2: `https://festileaks.com/festivalagenda/?event_title=&event_startdate=2025-04-13&event_enddate=2026-04-13&country_id=0&city_id=0&terrain_id=0&artists=&genres=&label_slug=&ticketprice_min=0&ticketprice_max=2650&cap_min=0&cap_max=1400000&weekender=true&soldout=true&cancelled=true&organizer=0&pg=2`
- Page 3: `https://festileaks.com/festivalagenda/?event_title=&event_startdate=2025-04-13&event_enddate=2026-04-13&country_id=0&city_id=0&terrain_id=0&artists=&genres=&label_slug=&ticketprice_min=0&ticketprice_max=2650&cap_min=0&cap_max=1400000&weekender=true&soldout=true&cancelled=true&organizer=0&pg=3`

The key parameter for pagination is `pg={page_number}`. The other parameters may change slightly over time but don't affect the basic pagination functionality.

### Detail Page

The detail page URL follows the pattern: `https://festileaks.com/festival/{festival-slug}/{year}/`

Example: [https://festileaks.com/festival/ra-dius-festival/2025/](https://festileaks.com/festival/ra-dius-festival/2025/)

## CSS Selectors

### List Page Selectors
- **Festival Items**: `.festivals-list-item`
- **Festival Name**: `.festival-title`
- **Festival Date**: `.festival-date`
- **Festival Location**: `.festival-location span`
- **Detail Page Link**: `.festivals-list-column.column-name a`

### Pagination Selectors
- **Next Page Button**: `.pagination-next` or similar
- **Page Count Information**: Element containing information about total pages

## Implementation Details

### 1. Pagination Navigation

The scraper needs to navigate through all pages:

```javascript
// Pseudocode for pagination navigation
async function scrapeAllPages() {
  const festivals = [];
  let currentPage = 1;
  const totalPages = 25; // This could be extracted from the page or estimated
  
  while (currentPage <= totalPages) {
    // Construct URL for current page
    let url = 'https://festileaks.com/festivalagenda/';
    if (currentPage > 1) {
      const baseParams = 'event_title=&event_startdate=2025-04-13&event_enddate=2026-04-13&country_id=0&city_id=0&terrain_id=0&artists=&genres=&label_slug=&ticketprice_min=0&ticketprice_max=2650&cap_min=0&cap_max=1400000&weekender=true&soldout=true&cancelled=true&organizer=0';
      url = `${url}?${baseParams}&pg=${currentPage}`;
    }
    
    // Fetch the page
    const response = await fetch(url);
    const html = await response.text();
    
    // Check if this page has festival content
    const hasContent = html.includes('festivals-list-item');
    if (!hasContent) {
      // No more festivals to scrape
      break;
    }
    
    // Parse festivals from this page
    const pageFestivals = parseFestivalsPage(html);
    festivals.push(...pageFestivals);
    
    // Move to next page
    currentPage++;
    
    // Add delay to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 1500 + Math.random() * 1000));
  }
  
  return festivals;
}
```

### 2. Festival Data Extraction

```javascript
// Pseudocode for extracting festivals from a page
function parseFestivalsPage(html) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  
  const festivals = [];
  const festivalItems = doc.querySelectorAll('.festivals-list-item');
  
  festivalItems.forEach(item => {
    // Extract name
    const nameElement = item.querySelector('.festival-title');
    if (!nameElement) return; // Skip if no name
    
    const name = nameElement.textContent.trim();
    
    // Extract date
    const dateElement = item.querySelector('.festival-date');
    if (!dateElement) return; // Skip if no date
    
    const dateText = dateElement.textContent.trim();
    const parsedDate = parseDutchDate(dateText);
    
    // Extract location
    const locationElement = item.querySelector('.festival-location span');
    if (!locationElement) return; // Skip if no location
    
    const location = locationElement.textContent.trim();
    
    // Extract detail page URL
    const linkElement = item.querySelector('.festivals-list-column.column-name a');
    if (!linkElement) return; // Skip if no link
    
    const relativePath = linkElement.getAttribute('href');
    const detailUrl = `https://festileaks.com${relativePath}`;
    
    // For single-day festivals, end date is the same as start date
    const startDate = parsedDate;
    const endDate = parsedDate; // Might be updated with detail page info
    const durationDays = 1; // Might be updated with detail page info
    
    festivals.push({
      name,
      start_date: startDate,
      end_date: endDate,
      duration_days: durationDays,
      location,
      detail_url: detailUrl,
      source_website: 'festileaks'
    });
  });
  
  return festivals;
}
```

### 3. Detail Page Processing

To get more accurate information about multi-day festivals:

```javascript
// Pseudocode for detail page processing
async function processDetailPage(festival) {
  // Fetch the detail page
  const response = await fetch(festival.detail_url);
  const html = await response.text();
  
  // Parse the HTML
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  
  // The detail page might contain more precise date information for multi-day events
  // We need to look for patterns that indicate a range of dates
  
  // This is placeholder logic - the actual selectors would need to be determined
  // by inspecting the detail pages
  const dateElements = doc.querySelectorAll('.festival-dates .date-range, .event-meta .date-info');
  
  dateElements.forEach(element => {
    const dateText = element.textContent.trim();
    
    // Look for date ranges like "26-28 april 2025" or "26 april - 28 april 2025"
    const rangeMatch = dateText.match(/(\d+)\s*[-–]\s*(\d+)\s+([a-zA-Z]+)\s+(\d{4})/);
    if (rangeMatch) {
      const [, startDay, endDay, month, year] = rangeMatch;
      
      // Parse start and end dates
      const startDate = parseDutchDate(`${startDay} ${month} ${year}`);
      const endDate = parseDutchDate(`${endDay} ${month} ${year}`);
      
      // Calculate duration
      const start = new Date(startDate);
      const end = new Date(endDate);
      const durationDays = Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1;
      
      // Update festival with more accurate information
      festival.start_date = startDate;
      festival.end_date = endDate;
      festival.duration_days = durationDays;
    }
  });
  
  return festival;
}
```

## Date Parsing Strategy

The Festileaks website uses Dutch date formats. The scraper should:

1. Parse date strings like "26 april 2025"
2. Handle date ranges for multi-day events
3. Output standardized ISO date format (YYYY-MM-DD)

Example date parsing function:

```javascript
// Pseudocode for Dutch date parsing
function parseDutchDate(dateString) {
  // Map Dutch month names to numbers
  const monthMap = {
    'januari': '01', 'februari': '02', 'maart': '03', 'april': '04',
    'mei': '05', 'juni': '06', 'juli': '07', 'augustus': '08',
    'september': '09', 'oktober': '10', 'november': '11', 'december': '12'
  };
  
  // Try to match a pattern like "26 april 2025"
  const singleDateMatch = dateString.match(/(\d+)\s+([a-zA-Z]+)\s+(\d{4})/);
  if (singleDateMatch) {
    const [, day, monthName, year] = singleDateMatch;
    const paddedDay = day.padStart(2, '0');
    
    // Convert month name to number
    const monthNameLower = monthName.toLowerCase();
    const month = monthMap[monthNameLower];
    
    if (!month) return null;
    
    return `${year}-${month}-${paddedDay}`;
  }
  
  return null;
}
```

## Anti-Scraping Considerations

1. **Rate Limiting**:
   - Add delays between page requests (1.5-3 seconds)
   - Implement longer delays for detail page requests

2. **Browser Fingerprinting**:
   - Use realistic user agent strings
   - Rotate between a set of common user agents

3. **Request Patterns**:
   - Add randomization to request timing
   - Don't make all requests in the exact same order

4. **Session Management**:
   - Handle cookies and session state appropriately
   - Process any required tokens or anti-bot measures

## Output Format

The scraper will output a structured JSON array of festival objects:

```json
[
  {
    "name": "Ra:dius Festival",
    "start_date": "2025-04-26",
    "end_date": "2025-04-26",
    "duration_days": 1,
    "location": "Maastricht, Nederland",
    "detail_url": "https://festileaks.com/festival/ra-dius-festival/2025/",
    "source_website": "festileaks"
  },
  {
    "name": "Paaspop",
    "start_date": "2025-04-18",
    "end_date": "2025-04-20",
    "duration_days": 3,
    "location": "Schijndel, Nederland",
    "detail_url": "https://festileaks.com/festival/paaspop/2025/",
    "source_website": "festileaks"
  }
  // More festivals...
]
```

## Validation Checks

Before finalizing the output, the scraper will validate:

1. Complete date information (start and end dates)
2. Proper duration calculation for multi-day events
3. Festival name presence and format
4. Location information completeness
5. Valid detail page URLs

## Development and Testing Approach

1. Create a test script that downloads a few pages
2. Develop extraction logic against the saved HTML
3. Test with a small subset of pages
4. Implement detail page processing
5. Test pagination functionality
6. Validate results against manual inspection

## Special Considerations

1. The pagination URLs contain date parameters which might need updating over time
2. The scraper should be robust against changes in the query parameter structure
3. Multi-day festivals might only be identified correctly by visiting detail pages
4. The website might use different date formats in different contexts

## Related Documents
- [Problem Statement](./problem-statement.md)
- [Technical Architecture](./technical-architecture.md)
- [Database Schema](./database-schema.md)
- [Tasks](./tasks.md)