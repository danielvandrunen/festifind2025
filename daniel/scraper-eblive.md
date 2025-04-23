# EB Live Scraper Specification

## Overview

This document details the implementation specifications for the EB Live website scraper. The scraper will extract festival data from the EB Live festivals page, navigating through its pagination system which contains approximately 976 festivals over 41 pages.

## Source Website

- **Website**: [EB Live](https://www.eblive.nl/festivals/)
- **Type**: Dutch event guide and festival information website

## Scraping Strategy

The EB Live website uses a paginated system with specific URL parameters. The scraping strategy will need to:
1. Start with the base URL for the first page
2. Extract festival data from the current page (24 festivals per page)
3. Navigate to the next page using the correct pagination URL pattern
4. Repeat until all 41 pages have been processed
5. Visit individual detail pages for complete information

## HTML Structure

### Festival List Page

The main page contains festivals in a structured format with 24 festivals per page. Key elements:

#### Festival Element
```html
<div class="festival">
    <a href="https://www.eblive.nl/festival/?festival_id=10682&amp;index=3&amp;order_by=upcoming&amp;order=asc&amp;current_page=1&amp;per_page=24" class="festival-image" style="background-image: url('https://submit.ebfestivalguide.nl/files/images/30e8e324-2682-45e1-8d45-0727aa3d5f8e/Foule (3)-500x375.jpg');">
    <!--<img src="https://submit.ebfestivalguide.nl/files/images/30e8e324-2682-45e1-8d45-0727aa3d5f8e/Foule (3)-500x375.jpg" alt="Durbuy Rock Festival" >-->
    </a>
    <div class="festival-details">
        <h5 class="festival-name"><a href="https://www.eblive.nl/festival/?festival_id=10682">Durbuy Rock Festival</a></h5>
        <div class="festival-attributes">
            <div class="festival-location">
                <i class="fa fa-map-marker-alt"></i>
                <span>Bomal-sur-Ourthe (BE)</span>
            </div>
            <div class="festival-date">
                <i class="far fa-calendar"></i>
                <span>
                    Vr 11 apr t/m za 12 apr
                </span>
            </div>
        </div>
    </div>
</div>
```

### Pagination

The pagination URLs follow this pattern:
- Page 1: `https://www.eblive.nl/festivals/`
- Page 2: `https://www.eblive.nl/festivals/?filters%5Bsearch%5D=&filters%5Baddress%5D=&filters%5Bdistance%5D=&order_by=upcoming&page_nr=2`
- Page 3: `https://www.eblive.nl/festivals/?filters%5Bsearch%5D=&filters%5Baddress%5D=&filters%5Bdistance%5D=&order_by=upcoming&page_nr=3`
- Last page (41): `https://www.eblive.nl/festivals/?filters%5Bsearch%5D=&filters%5Baddress%5D=&filters%5Bdistance%5D=&order_by=upcoming&page_nr=41`

The key parameter for pagination is `page_nr={page_number}`.

### Detail Page

The detail page URL follows the pattern: `https://www.eblive.nl/festival/?festival_id={id}`

Example: [https://www.eblive.nl/festival/?festival_id=10682](https://www.eblive.nl/festival/?festival_id=10682)

On the detail page, you can find location information:

```html
<div class="festival-info-section">
    <div class="info-icon">
        <i class="fa fa-map-marker-alt"></i>
    </div>
    <div class="info-content">
        <h4>Locatie</h4>
        <div class="row field no-gutters">
            <div class="col-sm-4">
                Locatie naam
            </div>
            <div class="col-sm-8">
                Le Sassin
            </div>
        </div>
        
        <div class="row field no-gutters">
            <div class="col-sm-4">
                Plaatsnaam
            </div>
            <div class="col-sm-8">
                Bomal-sur-Ourthe
            </div>
        </div>
        
        <div class="row field no-gutters">
            <div class="col-sm-4">
                Land
            </div>
            <div class="col-sm-8">
                België
            </div>
        </div>

        <div class="row field no-gutters">
            <div class="col-sm-4">
                Type festival
            </div>
            <div class="col-sm-8">
                Indoor+Outdoor
            </div>
        </div>
    </div>
</div>
```

And date information:

```html
<div class="info-content">
    <h4>Datum</h4>
    <div class="festival-date field">Vrijdag 11 april t/m zaterdag 12 april 2025</div>
</div>
```

## CSS Selectors

### List Page Selectors
- **Festival Elements**: `.festival`
- **Festival Name**: `.festival-name a`
- **Festival Location**: `.festival-location span`
- **Festival Date**: `.festival-date span`
- **Detail Page Link**: `.festival-name a`

### Detail Page Selectors
- **Date Information Section**: `.info-content h4:contains("Datum") + .festival-date.field`
- **Location Name**: `.row.field:has(.col-sm-4:contains("Locatie naam")) .col-sm-8`
- **Location City**: `.row.field:has(.col-sm-4:contains("Plaatsnaam")) .col-sm-8`
- **Location Country**: `.row.field:has(.col-sm-4:contains("Land")) .col-sm-8`
- **Festival Type**: `.row.field:has(.col-sm-4:contains("Type festival")) .col-sm-8`

## Implementation Details

### 1. Pagination Navigation

The scraper will navigate through all 41 pages:

```javascript
// Pseudocode for pagination navigation
async function scrapeAllPages() {
  const festivals = [];
  const totalPages = 41;
  
  for (let page = 1; page <= totalPages; page++) {
    // Construct URL for current page
    let url = 'https://www.eblive.nl/festivals/';
    if (page > 1) {
      url = `${url}?filters%5Bsearch%5D=&filters%5Baddress%5D=&filters%5Bdistance%5D=&order_by=upcoming&page_nr=${page}`;
    }
    
    // Fetch the page
    const response = await fetch(url);
    const html = await response.text();
    
    // Parse festivals from this page
    const pageFestivals = parseFestivalsPage(html);
    
    // Process detail pages for each festival
    for (const festival of pageFestivals) {
      const enrichedFestival = await processDetailPage(festival);
      festivals.push(enrichedFestival);
      
      // Add delay between detail page requests
      await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 1000));
    }
    
    console.log(`Processed page ${page}/${totalPages}, found ${pageFestivals.length} festivals`);
    
    // Add delay between page requests
    await new Promise(resolve => setTimeout(resolve, 2000 + Math.random() * 1000));
  }
  
  return festivals;
}
```

### 2. Festival Data Extraction from List Page

```javascript
// Pseudocode for extracting festivals from a page
function parseFestivalsPage(html) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  
  const festivals = [];
  const festivalElements = doc.querySelectorAll('.festival');
  
  festivalElements.forEach(element => {
    // Extract name
    const nameElement = element.querySelector('.festival-name a');
    if (!nameElement) return; // Skip if no name
    
    const name = nameElement.textContent.trim();
    
    // Extract location
    const locationElement = element.querySelector('.festival-location span');
    if (!locationElement) return; // Skip if no location
    
    const location = locationElement.textContent.trim();
    
    // Extract date information
    const dateElement = element.querySelector('.festival-date span');
    if (!dateElement) return; // Skip if no date
    
    const dateText = dateElement.textContent.trim();
    
    // Extract detail page URL
    const detailUrl = nameElement.getAttribute('href');
    if (!detailUrl) return; // Skip if no detail URL
    
    // Initial parsing of date information (will be refined with detail page)
    const dateInfo = parseDutchDateRange(dateText);
    
    festivals.push({
      name,
      start_date: dateInfo.startDate,
      end_date: dateInfo.endDate,
      duration_days: dateInfo.durationDays,
      location,
      detail_url: detailUrl.startsWith('http') ? detailUrl : `https://www.eblive.nl${detailUrl}`,
      source_website: 'eblive'
    });
  });
  
  return festivals;
}
```

### 3. Detail Page Processing

For more accurate information, the scraper will process each festival's detail page:

```javascript
// Pseudocode for detail page processing
async function processDetailPage(festival) {
  // Fetch the detail page
  const response = await fetch(festival.detail_url);
  const html = await response.text();
  
  // Parse the HTML
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  
  // Extract complete date information
  const dateElement = doc.querySelector('.info-content h4:contains("Datum") + .festival-date.field');
  if (dateElement) {
    const fullDateText = dateElement.textContent.trim();
    const refinedDateInfo = parseDutchDetailDateRange(fullDateText);
    
    // Update with more accurate date information
    if (refinedDateInfo.startDate) festival.start_date = refinedDateInfo.startDate;
    if (refinedDateInfo.endDate) festival.end_date = refinedDateInfo.endDate;
    if (refinedDateInfo.durationDays) festival.duration_days = refinedDateInfo.durationDays;
  }
  
  // Extract more detailed location information
  const locationName = doc.querySelector('.row.field:has(.col-sm-4:contains("Locatie naam")) .col-sm-8')?.textContent.trim();
  const locationCity = doc.querySelector('.row.field:has(.col-sm-4:contains("Plaatsnaam")) .col-sm-8')?.textContent.trim();
  const locationCountry = doc.querySelector('.row.field:has(.col-sm-4:contains("Land")) .col-sm-8')?.textContent.trim();
  
  // Combine location information
  if (locationName || locationCity || locationCountry) {
    const detailedLocation = [locationName, locationCity, locationCountry]
      .filter(Boolean)
      .join(', ');
    
    if (detailedLocation) {
      festival.location = detailedLocation;
    }
  }
  
  return festival;
}
```

## Date Parsing Strategy

The EB Live website uses Dutch date formats in different styles. The scraper should:

1. Parse list page date ranges like "Vr 11 apr t/m za 12 apr"
2. Parse detail page date ranges like "Vrijdag 11 april t/m zaterdag 12 april 2025"
3. Handle single-day and multi-day events correctly
4. Output standardized ISO date format (YYYY-MM-DD)

Example date parsing functions:

```javascript
// Pseudocode for Dutch date range parsing from list page
function parseDutchDateRange(dateText) {
  // Map Dutch month abbreviations to numbers
  const monthMap = {
    'jan': '01', 'feb': '02', 'mrt': '03', 'apr': '04',
    'mei': '05', 'jun': '06', 'jul': '07', 'aug': '08',
    'sep': '09', 'okt': '10', 'nov': '11', 'dec': '12'
  };
  
  // Current year (fallback if year is not in the date text)
  const currentYear = new Date().getFullYear();
  
  // For formats like "Vr 11 apr t/m za 12 apr"
  const multiDayMatch = dateText.match(/(\d+)\s+([a-z]{3})\s+t\/m\s+[a-z]{2}\s+(\d+)\s+([a-z]{3})/i);
  if (multiDayMatch) {
    const [, startDay, startMonthText, endDay, endMonthText] = multiDayMatch;
    
    const startMonth = monthMap[startMonthText.toLowerCase()];
    const endMonth = monthMap[endMonthText.toLowerCase()];
    
    if (!startMonth || !endMonth) return { startDate: null, endDate: null, durationDays: 1 };
    
    const startDate = `${currentYear}-${startMonth}-${startDay.padStart(2, '0')}`;
    const endDate = `${currentYear}-${endMonth}-${endDay.padStart(2, '0')}`;
    
    // Calculate duration in days
    const start = new Date(startDate);
    const end = new Date(endDate);
    const durationDays = Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1;
    
    return { startDate, endDate, durationDays };
  }
  
  // For single day formats like "Za 26 apr"
  const singleDayMatch = dateText.match(/([a-z]{2})\s+(\d+)\s+([a-z]{3})/i);
  if (singleDayMatch) {
    const [, , day, monthText] = singleDayMatch;
    
    const month = monthMap[monthText.toLowerCase()];
    if (!month) return { startDate: null, endDate: null, durationDays: 1 };
    
    const date = `${currentYear}-${month}-${day.padStart(2, '0')}`;
    
    return { startDate: date, endDate: date, durationDays: 1 };
  }
  
  return { startDate: null, endDate: null, durationDays: 1 };
}

// Pseudocode for Dutch date range parsing from detail page
function parseDutchDetailDateRange(dateText) {
  // Map Dutch month names to numbers
  const monthMap = {
    'januari': '01', 'februari': '02', 'maart': '03', 'april': '04',
    'mei': '05', 'juni': '06', 'juli': '07', 'augustus': '08',
    'september': '09', 'oktober': '10', 'november': '11', 'december': '12'
  };
  
  // Example: "Vrijdag 11 april t/m zaterdag 12 april 2025"
  const match = dateText.match(/(\d+)\s+([a-z]+)(?:\s+t\/m\s+[a-z]+\s+(\d+)\s+([a-z]+))?\s+(\d{4})/i);
  
  if (match) {
    const [, startDay, startMonthText, endDay, endMonthText, year] = match;
    
    const startMonth = monthMap[startMonthText.toLowerCase()];
    if (!startMonth) return { startDate: null, endDate: null, durationDays: 1 };
    
    const startDate = `${year}-${startMonth}-${startDay.padStart(2, '0')}`;
    
    // If end day and month are present, it's a multi-day event
    if (endDay && endMonthText) {
      const endMonth = monthMap[endMonthText.toLowerCase()];
      if (!endMonth) return { startDate, endDate: startDate, durationDays: 1 };
      
      const endDate = `${year}-${endMonth}-${endDay.padStart(2, '0')}`;
      
      // Calculate duration in days
      const start = new Date(startDate);
      const end = new