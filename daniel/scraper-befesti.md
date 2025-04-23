# Befesti Scraper Specification

## Overview

This document details the implementation specifications for the Befesti website scraper. The scraper will extract festival data from the Befesti.nl festival agenda page.

## Source Website

- **Website**: [Befesti](https://befesti.nl/festivalagenda)
- **Type**: Dutch festival aggregator website

## Scraping Strategy

The Befesti website has a unique structure that requires:
1. Scrolling to the bottom of the page to load all festivals
2. Extracting festival information from the loaded page
3. Fetching individual detail pages for complete information

## HTML Structure

### Festival List Page

The main page contains festival cards with partial information. Key elements:

#### Date Element
```html
<div class="agenda--datum--double">
    <div data-element="day-start" class="h4 margin--0">11</div>
    <div data-element="day-dash" class="h4 margin--0 is--date-text-hide">-</div>
    <div data-element="day-end" class="h4 margin--0 is--date-text-hide">13</div>
</div>
```

#### Festival Name Element
```html
<h3 data-element="card-title" class="h4">REBiRTH Festival</h3>
```

#### Location Element
```html
<div class="agenda--chip">
    <div class="text--s">Raamse Akkers</div>
    <div class="text--s">,&nbsp;</div>
    <div class="text--s">Haaren</div>
</div>
```

### Detail Page

The detail page URL follows the pattern: `https://befesti.nl/festival/{festival-slug}`

Example: [https://befesti.nl/festival/rebirth-festival](https://befesti.nl/festival/rebirth-festival)

The detail page contains more comprehensive information that should be extracted.

## CSS Selectors

### List Page Selectors
- **Festival Cards**: `.agenda--item .agenda--item--inner`
- **Festival Name**: `h3[data-element="card-title"]`
- **Start Date Day**: `div[data-element="day-start"]`
- **End Date Day (if exists)**: `div[data-element="day-end"]`
- **Month Information**: Needs to be extracted from context or detail page
- **Location**: `.agenda--chip .text--s`
- **Detail Page Link**: the containing `<a>` element's href attribute

### Detail Page Selectors
- **Full Date Information**: Look for date information in the detail page
- **Complete Location Information**: Look for location details

## Implementation Details

### 1. Page Loading Strategy

To ensure all festivals are loaded, the scraper must:

```javascript
// Pseudocode for scrolling logic
async function scrollToBottom() {
  let lastHeight = 0;
  let currentHeight = document.body.scrollHeight;
  
  while (lastHeight !== currentHeight) {
    lastHeight = currentHeight;
    window.scrollTo(0, document.body.scrollHeight);
    await sleep(1000); // Wait for content to load
    currentHeight = document.body.scrollHeight;
  }
}
```

### 2. Festival Data Extraction

```javascript
// Pseudocode for extraction logic
function extractFestivalData() {
  const festivalCards = document.querySelectorAll('.agenda--item .agenda--item--inner');
  const festivals = [];
  
  festivalCards.forEach(card => {
    const name = card.querySelector('h3[data-element="card-title"]').textContent.trim();
    const startDay = card.querySelector('div[data-element="day-start"]').textContent.trim();
    
    // Handle end date if exists
    let endDay = '';
    const endDayElement = card.querySelector('div[data-element="day-end"]');
    if (endDayElement && !endDayElement.classList.contains('is--date-text-hide')) {
      endDay = endDayElement.textContent.trim();
    }
    
    // Extract location
    const locationParts = Array.from(card.querySelectorAll('.agenda--chip .text--s'));
    const location = locationParts.map(part => part.textContent.trim()).join('').replace(/,\s*/g, ', ');
    
    // Get detail page URL
    const detailUrl = card.querySelector('a').href;
    
    festivals.push({
      name,
      startDay, 
      endDay,
      location,
      detailUrl,
      sourceWebsite: 'befesti'
    });
  });
  
  return festivals;
}
```

### 3. Detail Page Processing

For each festival, the scraper will:
1. Visit the detail page URL
2. Extract complete date information
3. Validate and enhance the festival data
4. Return the full record

```javascript
// Pseudocode for detail page processing
async function processDetailPage(festival) {
  // Load the detail page
  const response = await fetch(festival.detailUrl);
  const html = await response.text();
  
  // Parse the HTML
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  
  // Extract full date information
  // (Exact selectors would need to be determined by inspecting the detail page)
  
  // Update the festival object with the new information
  return enhancedFestival;
}
```

## Date Parsing Strategy

The Befesti website displays dates in Dutch format. The scraper must:
1. Extract the day numbers from the list page
2. Extract month and year information from the detail page
3. Combine this information into a standardized ISO date format (YYYY-MM-DD)

For example, when seeing "11-13" as days and determining it's in April 2025:
- Start date: 2025-04-11
- End date: 2025-04-13
- Duration: 3 days

## Anti-Scraping Considerations

The Befesti website may have measures to prevent automated scraping:

1. **Rate Limiting**: Implement delays between requests (1-2 seconds)
2. **Browser Fingerprinting**: Use realistic user agent strings
3. **Request Patterns**: Avoid perfectly regular request patterns
4. **Session Management**: Handle cookies appropriately

## Error Handling

The scraper should gracefully handle:
1. Connection issues
2. Changes in website structure
3. Missing elements or information
4. Rate limiting or blocking responses

## Output Format

The scraper will output a structured JSON array of festival objects:

```json
[
  {
    "name": "REBiRTH Festival",
    "start_date": "2025-04-11",
    "end_date": "2025-04-13",
    "duration_days": 3,
    "location": "Raamse Akkers, Haaren",
    "detail_url": "https://befesti.nl/festival/rebirth-festival",
    "source_website": "befesti"
  },
  // More festivals...
]
```

## Validation Checks

Before finalizing the output, the scraper will validate:
1. Complete date information (start and end dates)
2. Festival name presence and format
3. Location information completeness
4. Proper URL formation for the detail page

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