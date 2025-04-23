# Partyflock Scraper Specification

## Overview

This document details the implementation specifications for the Partyflock website scraper. The scraper will extract festival data from the Partyflock festival agenda page.

## Source Website

- **Website**: [Partyflock](https://partyflock.nl/agenda/festivals)
- **Type**: Dutch electronic music and festival community website

## Scraping Strategy

The Partyflock website has a continuous scrolling page that loads more festivals as you scroll down. The scraping strategy will need to:
1. Scroll to the bottom of the page to load all festivals
2. Extract festival data from table rows
3. Extract detail page URLs for each festival
4. Visit individual detail pages to get complete information

## HTML Structure

### Festival List Page

The main page contains festivals in a table format. Key elements:

#### Festival Row Element
```html
<tr>
  <td style="max-width:60%">
    <meta itemprop="eventStatus" content="https://schema.org/EventScheduled">
    <meta itemprop="eventAttendanceMode" content="https://schema.org/OfflineEventAttendanceMode">
    <meta itemprop="startDate" content="2025-04-11T18:00:00+02:00">
    <meta itemprop="duration" content="PT10H">
    <meta itemprop="endDate" content="2025-04-12T03:59:59+02:00">
    <a href="/event/brege-pop-festival-nl">
      <meta itemprop="url" content="https://partyflock.nl/event/brege-pop-festival-nl">
      <span itemprop="name">Brêgepop Festival</span>
    </a>
  </td>
  <td class="right rpad nowrap">
    18 <img loading="lazy" alt="bezoekers" title="bezoekers" class="lower" style="width: 24px; height: 16px;" src="https://static.partyflock.nl/presence/apf.png">
  </td>
  <td>
    <span class="hidden" itemprop="location" itemscope="" itemtype="https://schema.org/EventVenue">
      <meta itemprop="name" content="Evenemententerrein Bregepop">
      <span itemprop="geo" itemscope="" itemtype="https://schema.org/GeoCoordinates">
        <meta itemprop="latitude" content="52.9472288">
        <meta itemprop="longitude" content="5.7861592">
      </span>
      <span itemprop="address" itemscope="" itemtype="https://schema.org/PostalAddress">
        <meta itemprop="addressLocality" content="Scharsterbrug">
        <span itemprop="addressCountry" itemscope="" itemtype="https://schema.org/Country">
          <meta itemprop="name" content="Nederland">
          <meta itemprop="alternateName" content="NL">
        </span>
      </span>
    </span>
    <a href="/location/23288:Evenemententerrein-Bregepop">Evenemententerrein Bregepop</a>, 
    <span class="nowrap light7">
      <a href="/city/6382:Scharsterbrug">Scharsterbrug</a>
    </span>
  </td>
</tr>
```

### Detail Page

The detail page URL follows the pattern: `https://partyflock.nl/event/{festival-slug}`

Example: [https://partyflock.nl/event/brege-pop-festival-nl](https://partyflock.nl/event/brege-pop-festival-nl)

On the detail page, you can find:

```html
<a href="/agenda/day/2025/4/11">vrijdag 11 april 2025</a>
```

For date information, and:

```html
<span itemprop="name">Evenemententerrein Bregepop</span>
```

For venue information.

For multi-day events, there's a table structure:

```html
<table class="hla dens nomargin vtop">
  <tbody>
    <tr class="">
      <td><a href="/event/rebirth-festival-nl">REBiRTH Festival</a>,&nbsp;</td>
      <td class="right">vr 11 apr 2025, 14:00</td>
      <td></td>
      <td></td>
    </tr>
    <tr class="win ">
      <td><a href="/party/467863:REBiRTH-Festival">REBiRTH Festival</a>,&nbsp;</td>
      <td class="right">za 12 apr 2025, 12:00</td>
      <td>&nbsp;←</td>
      <td></td>
    </tr>
    <tr class="">
      <td><a href="/party/475522:REBiRTH-Festival">REBiRTH Festival</a>,&nbsp;</td>
      <td class="right">zo 13 apr 2025, 13:00</td>
      <td></td>
      <td></td>
    </tr>
  </tbody>
</table>
```

## CSS Selectors

### List Page Selectors
- **Festival Rows**: `table.agenda tbody tr`
- **Festival Name**: `td:first-child a span[itemprop="name"]`
- **Festival URL**: `td:first-child a[href]`
- **Start Date (metadata)**: `meta[itemprop="startDate"]`
- **End Date (metadata)**: `meta[itemprop="endDate"]`
- **Location Name**: `span[itemprop="location"] meta[itemprop="name"]`
- **Location City**: `span[itemprop="address"] meta[itemprop="addressLocality"]`
- **Location Country**: `span[itemprop="addressCountry"] meta[itemprop="name"]`

### Detail Page Selectors
- **Date Information**: `a[href^="/agenda/day/"]`
- **Multi-day Events Table**: `table.hla.dens.nomargin.vtop`
- **Multi-day Event Rows**: `table.hla.dens.nomargin.vtop tbody tr`
- **Multi-day Event Dates**: `td.right`

## Implementation Details

### 1. Page Loading Strategy

Since Partyflock uses infinite scrolling, the scraper must scroll to load all content:

```javascript
// Pseudocode for scrolling logic
async function scrollToBottom() {
  let previousHeight = 0;
  let currentHeight = document.body.scrollHeight;
  
  // Continue scrolling until no new content loads
  while (previousHeight !== currentHeight) {
    previousHeight = currentHeight;
    window.scrollTo(0, document.body.scrollHeight);
    
    // Wait for new content to load
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    currentHeight = document.body.scrollHeight;
  }
}
```

### 2. Festival Data Extraction

```javascript
// Pseudocode for extraction logic
function extractFestivals() {
  const festivals = [];
  const rows = document.querySelectorAll('table.agenda tbody tr');
  
  rows.forEach(row => {
    // Skip rows without actual festival data
    const nameElement = row.querySelector('td:first-child a span[itemprop="name"]');
    if (!nameElement) return;
    
    const name = nameElement.textContent.trim();
    const detailUrl = 'https://partyflock.nl' + row.querySelector('td:first-child a').getAttribute('href');
    
    // Extract metadata from meta tags
    const startDateMeta = row.querySelector('meta[itemprop="startDate"]');
    const endDateMeta = row.querySelector('meta[itemprop="endDate"]');
    
    let startDate = startDateMeta ? new Date(startDateMeta.getAttribute('content')) : null;
    let endDate = endDateMeta ? new Date(endDateMeta.getAttribute('content')) : null;
    
    // Format dates to ISO strings (YYYY-MM-DD)
    const formattedStartDate = startDate ? startDate.toISOString().split('T')[0] : null;
    const formattedEndDate = endDate ? endDate.toISOString().split('T')[0] : null;
    
    // Calculate duration in days
    const durationDays = startDate && endDate 
      ? Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24)) 
      : 1;
    
    // Extract location information
    const locationName = row.querySelector('span[itemprop="location"] meta[itemprop="name"]')?.getAttribute('content');
    const locationCity = row.querySelector('span[itemprop="address"] meta[itemprop="addressLocality"]')?.getAttribute('content');
    const locationCountry = row.querySelector('span[itemprop="addressCountry"] meta[itemprop="name"]')?.getAttribute('content');
    
    const location = [locationName, locationCity, locationCountry]
      .filter(Boolean)
      .join(', ');
    
    festivals.push({
      name,
      start_date: formattedStartDate,
      end_date: formattedEndDate,
      duration_days: durationDays,
      location,
      detail_url: detailUrl,
      source_website: 'partyflock'
    });
  });
  
  return festivals;
}
```

### 3. Detail Page Processing

For festivals where more information is needed, the scraper will visit detail pages:

```javascript
// Pseudocode for detail page processing
async function processDetailPage(festival) {
  // Fetch the detail page
  const response = await fetch(festival.detail_url);
  const html = await response.text();
  
  // Parse the HTML
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  
  // Check for multi-day event table
  const multiDayTable = doc.querySelector('table.hla.dens.nomargin.vtop');
  
  if (multiDayTable) {
    // Extract dates from multi-day event table
    const dateRows = Array.from(multiDayTable.querySelectorAll('tbody tr'));
    if (dateRows.length > 0) {
      // Get first day date
      const firstDayText = dateRows[0].querySelector('td.right').textContent.trim();
      // Get last day date (if available)
      const lastDayText = dateRows[dateRows.length - 1].querySelector('td.right').textContent.trim();
      
      // Parse these dates (implementation depends on date format)
      // Update festival object with parsed dates
      // ...
    }
  } else {
    // For single-day events, find the date information
    const dateLink = doc.querySelector('a[href^="/agenda/day/"]');
    if (dateLink) {
      const dateText = dateLink.textContent.trim();
      // Parse this date (implementation depends on date format)
      // Update festival object
      // ...
    }
  }
  
  return festival; // Return updated festival object
}
```

## Date Parsing Strategy

The Partyflock website uses Dutch date formats. The scraper should:

1. Extract ISO format dates from meta tags when available
2. For multi-day events, parse the Dutch date text (e.g., "vr 11 apr 2025, 14:00")
3. Handle all date formats consistently to output YYYY-MM-DD format
4. Calculate duration accurately considering partial days

Example date parsing function:

```javascript
// Pseudocode for Dutch date parsing
function parseDutchDate(dateString) {
  // Example: "vr 11 apr 2025, 14:00"
  const months = {
    'jan': '01', 'feb': '02', 'mrt': '03', 'apr': '04', 
    'mei': '05', 'jun': '06', 'jul': '07', 'aug': '08',
    'sep': '09', 'okt': '10', 'nov': '11', 'dec': '12'
  };
  
  // Extract day, month, year
  const match = dateString.match(/(\d+)\s+([a-z]{3})\s+(\d{4})/i);
  if (!match) return null;
  
  const [, day, monthText, year] = match;
  const month = months[monthText.toLowerCase()];
  
  if (!month) return null;
  
  // Format as YYYY-MM-DD
  return `${year}-${month}-${day.padStart(2, '0')}`;
}
```

## Anti-Scraping Considerations

1. **Rate Limiting**:
   - Implement random delays between requests (1-3 seconds)
   - Batch processing to avoid rapid successive requests

2. **Browser Fingerprinting**:
   - Use realistic user agent strings
   - Rotate user agents if necessary

3. **Session Management**:
   - Handle cookies appropriately
   - Consider session persistence

4. **Request Patterns**:
   - Avoid perfectly regular patterns (add randomization)
   - Implement exponential backoff for retries

## Output Format

The scraper will output a structured JSON array of festival objects:

```json
[
  {
    "name": "Brêgepop Festival",
    "start_date": "2025-04-11",
    "end_date": "2025-04-12",
    "duration_days": 2,
    "location": "Evenemententerrein Bregepop, Scharsterbrug, Nederland",
    "detail_url": "https://partyflock.nl/event/brege-pop-festival-nl",
    "source_website": "partyflock"
  },
  {
    "name": "REBiRTH Festival",
    "start_date": "2025-04-11",
    "end_date": "2025-04-13",
    "duration_days": 3,
    "location": "Raamse Akkers, Haaren, Nederland",
    "detail_url": "https://partyflock.nl/event/rebirth-festival-nl",
    "source_website": "partyflock"
  }
  // More festivals...
]
```

## Validation Checks

Before finalizing the output, the scraper will validate:

1. Complete date information (start and end dates)
2. Festival name presence and format
3. Location information completeness
4. Proper URL formation for the detail page
5. Duration calculation accuracy

## Development and Testing Approach

1. Create a test script that downloads the full HTML
2. Develop extraction logic against the saved HTML
3. Test with a small subset of festivals
4. Implement detail page processing
5. Test end-to-end with proper rate limiting
6. Validate results against manual inspection

## Related Documents
- [Problem Statement](./problem-statement.md)
- [Technical Architecture](./technical-architecture.md)
- [Database Schema](./database-schema.md)
- [Tasks](./tasks.md)