# Festivalinfo Scraper Specification

## Overview

This document details the implementation specifications for the Festivalinfo website scraper. The scraper will extract festival data from the Festivalinfo festivals page, navigating through its week-by-week pagination system.

## Source Website

- **Website**: [Festivalinfo](https://www.festivalinfo.nl/festivals/)
- **Type**: Dutch music festival information website

## Scraping Strategy

The Festivalinfo website uses a week-by-week pagination system. The scraping strategy will need to:
1. Start with the base URL for the current week
2. Extract festival data from the current page
3. Navigate to the next week using the pagination
4. Repeat until all weeks have been processed
5. Visit individual detail pages for complete information when needed

## HTML Structure

### Festival List Page

The main page contains festivals in a structured format. Key elements:

#### Festival Date Element
```html
<section class="festival_agenda_date absolute">
    <span>VR</span>
    <span class="festival_dag">11</span>
    <span>APR</span>
</section>
```

Note: This date section covers multiple festivals that occur on the same day until a new date section appears.

#### Festival Info Element
```html
<a href="https://www.festivalinfo.nl/festival/34287/Kingdance-/2025/" title="Kingdance 2025 festival informatie">
    <section class="festival_rows_info">
        <div class="td_img last">
            <figure class="relative">
                <img alt="Kingdance 2025 logo" width="68" src="/img/upload/c/2/Kingdance_2025_logo.jpg" style="min-height:68px;">
            </figure>
        </div>
        <div class="td_1 last">
            <strong>Kingdance</strong>
            <span>(1/2)</span>
        </div>
        <div class="td_2 last">
            Zwolle, <br>Nederland
        </div>
        <div class="td_3 last">2 dagen</div>
        <div class="td_4 last">55</div>
        <div class="td_5 last"></div>
        <div class="td_6 relative last">
            <div style="width:49px; float:left;">&nbsp;</div>
        </div>
    </section>
</a>
```

### Pagination

The pagination URLs follow this pattern:
- Week 1: `https://www.festivalinfo.nl/festivals/`
- Week 2: `https://www.festivalinfo.nl/festivals/?page=1`
- Week 3: `https://www.festivalinfo.nl/festivals/?page=2`
- And so on...

### Detail Page

The detail page URL follows the pattern: `https://www.festivalinfo.nl/festival/{id}/{festival-name}/{year}/`

Example: [https://www.festivalinfo.nl/festival/34287/Kingdance-/2025/](https://www.festivalinfo.nl/festival/34287/Kingdance-/2025/)

On the detail page, you can find:

```html
<section class="event twelvecol mobpad" style="float:none !important;">
    <div class="event_date" style="margin: 0 1% 1% 0% !important;">
        <span class="small_item">vr</span><br>
        <strong><span>25</span></strong><br>
        <span class="small_item">apr</span>
    </div>
    <div class="event_date">
        <span class="small_item">za</span><br>
        <strong><span>26</span></strong><br>
        <span class="small_item">apr</span>
    </div>
    <div id="event_name" style="font-size:0.6em;">
        <p><strong>Kingdance 2025</strong></p>
        <p style="font-size:1.3em;line-height:1.3em;">
            <a href="#stay22" style="color:grey;">
                <span class="festival_location_icon" title="festival locatie op kaart"></span>
                Zwolle, Nederland
            </a>
        </p>
    </div>
</section>
```

## CSS Selectors

### List Page Selectors
- **Date Sections**: `section.festival_agenda_date`
- **Festival Day**: `span.festival_dag`
- **Festival Month**: `section.festival_agenda_date span:last-child`
- **Festival Rows**: `section.festival_rows_info`
- **Festival Name**: `div.td_1.last strong`
- **Duration Info**: `div.td_3.last` (e.g., "2 dagen")
- **Location**: `div.td_2.last` (format: "City, Country")
- **Detail URL**: Parent `<a>` element's `href` attribute

### Detail Page Selectors
- **Event Section**: `section.event.twelvecol.mobpad`
- **Event Dates**: `div.event_date`
- **Day Numbers**: `div.event_date strong span`
- **Month Names**: `div.event_date span.small_item:last-child`
- **Festival Name**: `div#event_name p strong`
- **Location**: `div#event_name p a[href="#stay22"]`

## Implementation Details

### 1. Week-by-Week Navigation

The scraper will need to navigate through each week's page:

```javascript
// Pseudocode for week navigation
async function scrapeAllWeeks() {
  const festivals = [];
  let currentPage = 0;
  let hasMorePages = true;
  
  while (hasMorePages) {
    // Construct URL for current page
    const url = currentPage === 0 
      ? 'https://www.festivalinfo.nl/festivals/' 
      : `https://www.festivalinfo.nl/festivals/?page=${currentPage}`;
    
    // Fetch the page
    const response = await fetch(url);
    const html = await response.text();
    
    // Check if this page has festival content
    const hasContent = html.includes('festival_rows_info');
    
    if (!hasContent) {
      // No more festivals to scrape
      hasMorePages = false;
      break;
    }
    
    // Parse this week's festivals
    const weekFestivals = await parseWeekPage(html);
    festivals.push(...weekFestivals);
    
    // Move to next page
    currentPage++;
    
    // Add delay to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 1500 + Math.random() * 1000));
  }
  
  return festivals;
}
```

### 2. Festival Data Extraction

The scraper needs to associate the correct date with each festival:

```javascript
// Pseudocode for extracting festivals from a week page
function parseWeekPage(html) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  
  const festivals = [];
  let currentDate = null;
  
  // Process all elements in order
  const allElements = Array.from(doc.querySelectorAll('section.festival_agenda_date, a section.festival_rows_info'));
  
  allElements.forEach(element => {
    if (element.classList.contains('festival_agenda_date')) {
      // This is a date section, update currentDate
      const day = element.querySelector('span.festival_dag').textContent.trim();
      const month = element.querySelector('span:last-child').textContent.trim();
      const year = new Date().getFullYear(); // Or extract from context if available
      
      currentDate = parseDutchDate(`${day} ${month} ${year}`);
    } else {
      // This is a festival row
      const festivalSection = element;
      const linkElement = festivalSection.closest('a');
      
      if (!linkElement || !currentDate) return; // Skip if no date context or link
      
      const name = festivalSection.querySelector('div.td_1.last strong').textContent.trim();
      const detailUrl = linkElement.getAttribute('href');
      
      // Extract location
      const locationElement = festivalSection.querySelector('div.td_2.last');
      const location = locationElement ? locationElement.textContent.trim().replace(/\s+/g, ' ') : '';
      
      // Extract duration info
      const durationElement = festivalSection.querySelector('div.td_3.last');
      const durationText = durationElement ? durationElement.textContent.trim() : '1 dag';
      
      // Parse duration (e.g., "2 dagen" -> 2)
      const durationMatch = durationText.match(/(\d+)/);
      const durationDays = durationMatch ? parseInt(durationMatch[1]) : 1;
      
      // Calculate end date based on duration
      const startDate = new Date(currentDate);
      const endDate = new Date(startDate);
      endDate.setDate(startDate.getDate() + durationDays - 1);
      
      festivals.push({
        name,
        start_date: startDate.toISOString().split('T')[0],
        end_date: endDate.toISOString().split('T')[0],
        duration_days: durationDays,
        location,
        detail_url: detailUrl,
        source_website: 'festivalinfo'
      });
    }
  });
  
  return festivals;
}
```

### 3. Detail Page Processing

For complete and accurate information, the scraper should visit detail pages:

```javascript
// Pseudocode for detail page processing
async function processDetailPage(festival) {
  // Fetch the detail page
  const response = await fetch(festival.detail_url);
  const html = await response.text();
  
  // Parse the HTML
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  
  // Extract detailed date information
  const eventSection = doc.querySelector('section.event.twelvecol.mobpad');
  if (eventSection) {
    const dateElements = eventSection.querySelectorAll('div.event_date');
    
    if (dateElements.length > 0) {
      // Get first date
      const firstDayEl = dateElements[0].querySelector('strong span');
      const firstMonthEl = dateElements[0].querySelector('span.small_item:last-child');
      
      // Get last date (if multiple)
      const lastDayEl = dateElements[dateElements.length - 1].querySelector('strong span');
      const lastMonthEl = dateElements[dateElements.length - 1].querySelector('span.small_item:last-child');
      
      if (firstDayEl && firstMonthEl) {
        const firstDay = firstDayEl.textContent.trim();
        const firstMonth = firstMonthEl.textContent.trim();
        const year = festival.start_date.split('-')[0]; // Extract year from existing date
        
        // Parse start date
        const startDate = parseDutchDate(`${firstDay} ${firstMonth} ${year}`);
        
        // For multi-day events
        if (dateElements.length > 1 && lastDayEl && lastMonthEl) {
          const lastDay = lastDayEl.textContent.trim();
          const lastMonth = lastMonthEl.textContent.trim();
          
          // Parse end date
          const endDate = parseDutchDate(`${lastDay} ${lastMonth} ${year}`);
          
          // Calculate duration
          const start = new Date(startDate);
          const end = new Date(endDate);
          const durationDays = Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1;
          
          // Update festival with more accurate information
          festival.start_date = startDate;
          festival.end_date = endDate;
          festival.duration_days = durationDays;
        }
      }
    }
    
    // Extract more accurate location information
    const locationEl = eventSection.querySelector('div#event_name p a[href="#stay22"]');
    if (locationEl) {
      const location = locationEl.textContent.trim();
      if (location) {
        festival.location = location;
      }
    }
  }
  
  return festival;
}
```

## Date Parsing Strategy

The Festivalinfo website uses Dutch date formats. The scraper should:

1. Extract day numbers and month names from the festival list
2. Parse Dutch month abbreviations (e.g., "APR" -> 04)
3. Handle both single and multi-day events correctly
4. Output standardized ISO date format (YYYY-MM-DD)

Example date parsing function:

```javascript
// Pseudocode for Dutch date parsing
function parseDutchDate(dateString) {
  // Map Dutch month abbreviations to numbers
  const monthMap = {
    'JAN': '01', 'FEB': '02', 'MRT': '03', 'APR': '04',
    'MEI': '05', 'JUN': '06', 'JUL': '07', 'AUG': '08',
    'SEP': '09', 'OKT': '10', 'NOV': '11', 'DEC': '12'
  };
  
  // Parse date string like "11 APR 2025"
  const parts = dateString.trim().split(/\s+/);
  if (parts.length < 3) return null;
  
  const day = parts[0].padStart(2, '0');
  const monthAbbr = parts[1].toUpperCase();
  const year = parts[2];
  
  if (!monthMap[monthAbbr]) return null;
  
  const month = monthMap[monthAbbr];
  return `${year}-${month}-${day}`;
}
```

## Anti-Scraping Considerations

1. **Rate Limiting**:
   - Add random delays between page requests (1-3 seconds)
   - Implement longer delays between batches of requests

2. **Browser Fingerprinting**:
   - Use realistic user agent strings
   - Rotate user agents periodically

3. **Request Patterns**:
   - Add randomization to request timing
   - Implement exponential backoff for retries

4. **Session Management**:
   - Handle cookies appropriately
   - Maintain session context between requests

## Output Format

The scraper will output a structured JSON array of festival objects:

```json
[
  {
    "name": "Kingdance",
    "start_date": "2025-04-25",
    "end_date": "2025-04-26",
    "duration_days": 2,
    "location": "Zwolle, Nederland",
    "detail_url": "https://www.festivalinfo.nl/festival/34287/Kingdance-/2025/",
    "source_website": "festivalinfo"
  },
  {
    "name": "Awakenings Easter Festival",
    "start_date": "2025-04-11",
    "end_date": "2025-04-11",
    "duration_days": 1,
    "location": "Amsterdam, Nederland",
    "detail_url": "https://www.festivalinfo.nl/festival/12345/Awakenings-Easter-Festival/2025/",
    "source_website": "festivalinfo"
  }
  // More festivals...
]
```

## Validation Checks

Before finalizing the output, the scraper will validate:

1. Complete date information (start and end dates)
2. Proper duration calculation (especially for multi-day events)
3. Festival name presence and format
4. Location information completeness
5. Valid detail page URLs

## Development and Testing Approach

1. Create a test script that downloads a few week pages
2. Develop extraction logic against the saved HTML
3. Test with a small subset of pages
4. Implement detail page processing
5. Test end-to-end with proper rate limiting
6. Validate results against manual inspection

## Special Considerations

1. The scraper must handle the date context correctly, as one date section applies to multiple festivals until a new date section appears.
2. Multi-day festivals require attention to calculate the correct duration and end date.
3. The website might update its structure over time, so the scraper should be designed to be adaptable.

## Related Documents
- [Problem Statement](./problem-statement.md)
- [Technical Architecture](./technical-architecture.md)
- [Database Schema](./database-schema.md)
- [Tasks](./tasks.md)