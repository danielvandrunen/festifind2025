import { parseDutchDate, extractDateInfo, calculateDuration } from './utils/date-parser.js';

/**
 * Extract festival list from a page
 * @param {Page} page - Playwright page object
 * @returns {Promise<Array>} Array of festival objects
 */
export async function extractFestivalList(page) {
  return page.evaluate(() => {
    const results = [];
    const festivalLinks = document.querySelectorAll('a[href*="/festival/"]');
    
    // Browser-side implementation of basic date parsing
    function extractDateInfoBrowser(detailText) {
      if (!detailText) return { dates: '', startDate: undefined, endDate: undefined };
      
      const months = {
        'jan': 0, 'januari': 0,
        'feb': 1, 'februari': 1,
        'mrt': 2, 'maart': 2,
        'apr': 3, 'april': 3,
        'mei': 4,
        'jun': 5, 'juni': 5,
        'jul': 6, 'juli': 6,
        'aug': 7, 'augustus': 7,
        'sep': 8, 'september': 8,
        'okt': 9, 'oktober': 9,
        'nov': 10, 'november': 10,
        'dec': 11, 'december': 11
      };
      
      // Normalize text
      const normalizedText = detailText.toLowerCase().replace(/\s+/g, ' ');
      
      // Try different patterns to extract dates
      let dateString = '';
      let startDate = undefined;
      let endDate = undefined;
      
      // Standard format: "10 mei 2023" or "10 mei"
      const datePattern = /\b(\d{1,2})\s+(jan|feb|mrt|maart|apr|april|mei|jun|juni|jul|juli|aug|augustus|sep|september|okt|oktober|nov|november|dec|december)(\s+20\d{2})?\b/i;
      const rangePattern = /\b(\d{1,2})\s+(jan|feb|mrt|maart|apr|april|mei|jun|juni|jul|juli|aug|augustus|sep|september|okt|oktober|nov|november|dec|december)(\s+20\d{2})?\s+t\/m\s+(\d{1,2})(\s+(jan|feb|mrt|maart|apr|april|mei|jun|juni|jul|juli|aug|augustus|sep|september|okt|oktober|nov|november|dec|december))?(\s+20\d{2})?\b/i;
      
      // First try range pattern
      const rangeMatch = normalizedText.match(rangePattern);
      if (rangeMatch) {
        dateString = rangeMatch[0];
        
        // Start date
        const startDay = parseInt(rangeMatch[1]);
        const startMonth = months[rangeMatch[2].toLowerCase()];
        const startYear = rangeMatch[3] ? parseInt(rangeMatch[3].trim()) : new Date().getFullYear();
        
        // End date
        const endDay = parseInt(rangeMatch[4]);
        const endMonth = rangeMatch[6] ? months[rangeMatch[6].toLowerCase()] : startMonth;
        const endYear = rangeMatch[7] ? parseInt(rangeMatch[7].trim()) : startYear;
        
        startDate = `${startYear}-${String(startMonth + 1).padStart(2, '0')}-${String(startDay).padStart(2, '0')}`;
        endDate = `${endYear}-${String(endMonth + 1).padStart(2, '0')}-${String(endDay).padStart(2, '0')}`;
      } else {
        // Try single date pattern
        const dateMatch = normalizedText.match(datePattern);
        if (dateMatch) {
          dateString = dateMatch[0];
          const day = parseInt(dateMatch[1]);
          const month = months[dateMatch[2].toLowerCase()];
          const year = dateMatch[3] ? parseInt(dateMatch[3].trim()) : new Date().getFullYear();
          
          startDate = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
          endDate = startDate;
        }
      }
      
      // If no date found, check if there's a year mentioned
      if (!dateString) {
        const yearMatch = normalizedText.match(/\b(20\d{2})\b/);
        if (yearMatch) {
          dateString = yearMatch[0];
        }
      }
      
      return { dates: dateString, startDate, endDate };
    }
    
    // Function to extract date information from festival detail page HTML
    function extractFestivalDateFromPage() {
      // Look for date containers
      const dateContainers = document.querySelectorAll('.festival_date, .date-display, .event-date, time[datetime]');
      if (dateContainers.length > 0) {
        for (const container of dateContainers) {
          // Check if it has a datetime attribute
          if (container.hasAttribute('datetime')) {
            const datetime = container.getAttribute('datetime');
            if (datetime && datetime.includes('-')) {
              return {
                dates: container.textContent.trim(),
                startDate: datetime.split('T')[0],
                endDate: datetime.split('T')[0]
              };
            }
          }
          
          // Otherwise extract from text content
          const dateText = container.textContent.trim();
          if (dateText) {
            return extractDateInfoBrowser(dateText);
          }
        }
      }
      
      // Look for date information in page meta tags
      const metaTags = document.querySelectorAll('meta[property="og:start_date"], meta[property="event:start_time"], meta[name="date"]');
      for (const meta of metaTags) {
        const content = meta.getAttribute('content');
        if (content && content.includes('-')) {
          return {
            dates: content,
            startDate: content.split('T')[0],
            endDate: content.split('T')[0]
          };
        }
      }
      
      // If no specific date elements, try to find date information in headings or strong text
      const dateHeadings = document.querySelectorAll('h1, h2, h3, h4, strong');
      for (const heading of dateHeadings) {
        const text = heading.textContent.trim();
        // Look for patterns that likely indicate dates
        if (/\d{1,2}\s+(jan|feb|mrt|apr|mei|jun|jul|aug|sep|okt|nov|dec)/i.test(text) || 
            text.includes('t/m') || 
            /\d{1,2}[\/\-]\d{1,2}/.test(text)) {
          return extractDateInfoBrowser(text);
        }
      }
      
      return { dates: '', startDate: undefined, endDate: undefined };
    }
    
    festivalLinks.forEach(link => {
      // Only process links that are direct festival listings (not sidebar links)
      if (!link.querySelector('strong')) return;
      
      const nameElement = link.querySelector('strong');
      const name = nameElement ? nameElement.textContent.trim() : '';
      
      // Extract ID from URL
      const urlMatch = link.href.match(/\/festival\/(\d+)\//);
      const id = urlMatch ? urlMatch[1] : '';
      
      if (!id || !name) return;
      
      // Extract details from link text content
      const fullText = link.textContent.trim();
      const detailsText = fullText.replace(name, '').trim();
      
      // Extract pagination indicators separately - typically in (1/4) format
      const paginationMatch = detailsText.match(/\((\d+)\/(\d+)\)/);
      const dateRange = paginationMatch ? {
        current: parseInt(paginationMatch[1]),
        total: parseInt(paginationMatch[2])
      } : null;
      
      // Clean the details text by removing pagination info for better location parsing
      const cleanDetailsText = detailsText.replace(/\(\d+\/\d+\)/, '').trim();
      
      // Improved location parsing
      let city = '';
      let country = '';
      
      // Format examples:
      // "Brussel, België 11 dagen 56"
      // "Amsterdam, Nederland 1 dag 28" 
      // "Enschede, Nederland 1 dag 3"
      
      // Try more specific regex to extract city and country
      const locationMatch = cleanDetailsText.match(/^([^,0-9]+),\s*([^,0-9]+)/);
      if (locationMatch) {
        city = locationMatch[1].trim();
        country = locationMatch[2].trim();
      } else {
        // If no comma format, try to extract just the city
        const cityMatch = cleanDetailsText.match(/^([^0-9]+?)(?:\s+\d|\s+dag)/);
        if (cityMatch) {
          city = cityMatch[1].trim();
          // Default country to Netherlands if not specified
          country = 'Nederland';
        }
      }
      
      // Ensure the location fields are correctly assigned
      const location = { 
        city: city || '', 
        country: country || 'Nederland' // Default to Netherlands
      };
      
      // Parse duration
      const durationMatch = cleanDetailsText.match(/(\d+)\s+dag(en)?/);
      const duration = durationMatch ? parseInt(durationMatch[1]) : 1;
      
      // More robust date parsing - try to extract date information
      const dateText = cleanDetailsText;
      let dates = '';
      let startDate = null;
      let endDate = null;
      
      // First try to extract date from the festival detail page itself
      const pageDate = extractFestivalDateFromPage();
      if (pageDate.startDate) {
        dates = pageDate.dates;
        startDate = pageDate.startDate;
        endDate = pageDate.endDate || pageDate.startDate;
      } else {
        // Otherwise try the link text
        const dateInfo = extractDateInfoBrowser(dateText);
        if (dateInfo.dates) {
          dates = dateInfo.dates;
          startDate = dateInfo.startDate;
          endDate = dateInfo.endDate || dateInfo.startDate;
        }
      }
      
      // If we found a start date, make sure it has the correct year
      if (startDate && startDate.includes('-')) {
        // Extract the year from the date
        const dateYear = parseInt(startDate.split('-')[0]);
        // Check if it's a reasonable year (2020-2030)
        if (dateYear < 2020 || dateYear > 2030) {
          // If not, use current year
          const currentYear = new Date().getFullYear();
          // Replace the year part
          startDate = `${currentYear}${startDate.substring(4)}`;
          if (endDate) {
            endDate = `${currentYear}${endDate.substring(4)}`;
          }
        }
      }
      
      // Parse number of acts - find numbers that aren't part of the pagination or duration
      const numActsMatch = cleanDetailsText.match(/(?<!\/)(\d+)(?!\s*dag)/);
      const numActs = numActsMatch ? parseInt(numActsMatch[0]) : 0;
      
      // Parse special features
      const isFree = cleanDetailsText.includes('festival is gratis') || cleanDetailsText.toLowerCase().includes('gratis');
      const hasCamping = cleanDetailsText.includes('festival heeft camping') || cleanDetailsText.toLowerCase().includes('camping');
      
      results.push({
        id,
        name,
        url: link.href,
        location,
        duration,
        dateRange,
        dates,
        startDate,
        endDate,
        numActs,
        isFree,
        hasCamping,
        source: 'festivalinfo.nl',
        scrapedAt: new Date().toISOString()
      });
    });
    
    return results;
  });
}

/**
 * Extract festival details from a festival page
 * @param {Page} page - Playwright page object 
 * @param {string} festivalUrl - URL of the festival page
 * @returns {Promise<Object>} Festival details
 */
export async function extractFestivalDetails(page, festivalUrl) {
  await page.goto(festivalUrl, { waitUntil: 'networkidle' });
  
  // Extract details using page.evaluate with proper selectors
  const details = await page.evaluate(() => {
    // Description - typically in the first paragraph
    const descriptionElem = document.querySelector('.leftcol p');
    const description = descriptionElem ? descriptionElem.textContent.trim() : '';
    
    // Festival dates - check multiple elements that might contain date info
    const dateElements = [
      ...Array.from(document.querySelectorAll('strong:not([class])')),
      ...Array.from(document.querySelectorAll('.date, .festival-date, .event-date, time[datetime]')),
      ...Array.from(document.querySelectorAll('h1, h2, h3, h4, h5'))
    ];
    
    // Find the element with the most likely date text
    let bestDateText = '';
    let startDate = null;
    let endDate = null;
    
    // First check for time elements with datetime attribute
    const timeElement = document.querySelector('time[datetime]');
    if (timeElement && timeElement.hasAttribute('datetime')) {
      const datetime = timeElement.getAttribute('datetime');
      if (datetime && datetime.includes('-')) {
        startDate = datetime.split('T')[0];
        endDate = startDate;
        bestDateText = timeElement.textContent.trim();
      }
    }
    
    // If no datetime attribute found, look through other elements
    if (!startDate) {
      for (const element of dateElements) {
        const text = element.textContent.trim();
        
        // Check if it looks like a date
        if (/\d{1,2}\s+(jan|feb|mrt|apr|mei|jun|jul|aug|sep|okt|nov|dec)/i.test(text) ||
            text.includes('t/m') ||
            /\d{1,2}[\/\-]\d{1,2}/.test(text)) {
          // Prioritize by length (longer usually = more complete) and presence of specific date indicators
          if (text.length > bestDateText.length || 
              (text.includes('t/m') && !bestDateText.includes('t/m')) ||
              (text.includes('2025') && !bestDateText.includes('2025'))) {
            bestDateText = text;
          }
        }
      }
    }
    
    // Also check meta tags for event start date
    const metaTags = document.querySelectorAll('meta[property="og:start_date"], meta[property="event:start_time"], meta[name="date"]');
    for (const meta of metaTags) {
      const content = meta.getAttribute('content');
      if (content && (content.includes('-') || content.includes('/'))) {
        // If it looks like a date format
        const dateParts = content.split(/[-T/]/);
        if (dateParts.length >= 3 && dateParts[0].length === 4) {
          // ISO format YYYY-MM-DD
          startDate = `${dateParts[0]}-${dateParts[1]}-${dateParts[2].substring(0, 2)}`;
          endDate = startDate;
          if (!bestDateText) bestDateText = content;
        }
      }
    }
    
    // Location info
    const locationElements = document.querySelectorAll('h2, .location');
    let locationText = '';
    
    // Find location by looking for headings with "REISINFORMATIE" and taking the next paragraph
    for (const elem of locationElements) {
      if (elem.tagName === 'H2' && elem.textContent.includes('REISINFORMATIE')) {
        const nextElem = elem.nextElementSibling;
        if (nextElem && nextElem.tagName === 'P') {
          locationText = nextElem.textContent.trim();
          break;
        }
      } else if (elem.classList.contains('location')) {
        locationText = elem.textContent.trim();
        break;
      }
    }
    
    // Artists lineup
    const artists = Array.from(document.querySelectorAll('.artist, .ActsBlock a'))
      .map(element => {
        // Try different ways to get the artist name
        const nameElement = element.querySelector('strong, paragraph, span') || element;
        return {
          name: nameElement.textContent.trim(),
          url: element.href || ''
        };
      })
      .filter(artist => artist.name.length > 0);
    
    // Ticket information
    const ticketElement = document.querySelector('a[href*="tickets"]');
    const ticketUrl = ticketElement ? ticketElement.href : '';
    
    // Also try to find by text content if not found by href
    if (!ticketUrl) {
      const allLinks = Array.from(document.querySelectorAll('a'));
      const ticketLink = allLinks.find(link => 
        link.textContent.includes('BESTEL TICKETS') || 
        link.textContent.toLowerCase().includes('tickets') ||
        link.textContent.toLowerCase().includes('kaarten')
      );
      if (ticketLink) {
        ticketUrl = ticketLink.href;
      }
    }
    
    // Check if the festival is free
    const pageText = document.body.textContent.toLowerCase();
    const isFree = pageText.includes('gratis') || pageText.includes('free entry');
    
    // Check if camping is available
    const hasCamping = pageText.includes('camping') || 
                      pageText.includes('kamperen') || 
                      pageText.includes('tent');
    
    // Calculate duration if we have start and end dates
    let duration = 1;
    if (startDate && endDate) {
      const start = new Date(startDate);
      const end = new Date(endDate);
      if (!isNaN(start.getTime()) && !isNaN(end.getTime())) {
        const diffTime = Math.abs(end - start);
        duration = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1; // Add 1 for inclusive count
      }
    }
                      
    return {
      description,
      dateText: bestDateText,
      startDate,
      endDate,
      duration,
      locationText,
      artists,
      ticketUrl,
      isFree,
      hasCamping
    };
  });
  
  // Parse dates server-side for more reliability
  if (details.dateText && (!details.startDate || !details.endDate)) {
    const dateInfo = extractDateInfo(details.dateText);
    details.startDate = dateInfo.startDate;
    details.endDate = dateInfo.endDate || dateInfo.startDate;
  }
  
  // Calculate duration based on start and end date
  if (details.startDate && details.endDate) {
    details.duration = calculateDuration(details.startDate, details.endDate);
  }
  
  return details;
}

/**
 * Normalize the extracted data to prepare for storage
 * @param {Object} festival - Festival data from list page
 * @param {Object} details - Festival details from detail page
 * @returns {Object} Normalized festival data
 */
export function normalizeFestivalData(festival, details = null) {
  if (!festival) return null;
  
  // Create a normalized copy
  const normalized = { ...festival };
  
  // If we have details, merge them
  if (details) {
    // Use detail dates if available - these are typically more accurate
    if (details.startDate) {
      normalized.startDate = details.startDate;
      // Update scrapedAt timestamp for the new data
      normalized.normalizedAt = new Date().toISOString();
    }
    
    if (details.endDate) normalized.endDate = details.endDate;
    if (details.duration) normalized.duration = details.duration;
    if (details.dateText) normalized.dates = details.dateText;
    
    // Add other details
    normalized.description = details.description || '';
    normalized.ticketUrl = details.ticketUrl || '';
    normalized.artists = details.artists || [];
    
    // Override list-level flags with detail page data if available
    if (typeof details.isFree === 'boolean') normalized.isFree = details.isFree;
    if (typeof details.hasCamping === 'boolean') normalized.hasCamping = details.hasCamping;
  }
  
  // Calculate duration if missing but we have start and end dates
  if (!normalized.duration && normalized.startDate && normalized.endDate) {
    normalized.duration = calculateDuration(normalized.startDate, normalized.endDate);
  }
  
  // Ensure location fields are present
  if (!normalized.city && normalized.location && normalized.location.city) {
    normalized.city = normalized.location.city;
  }
  
  if (!normalized.country && normalized.location && normalized.location.country) {
    normalized.country = normalized.location.country;
  }
  
  // If neither startDate nor endDate is set but duration is, add timestamp to show it was normalized
  if (!normalized.normalizedAt && (!normalized.startDate || !normalized.endDate) && normalized.duration) {
    normalized.normalizedAt = new Date().toISOString();
  }
  
  return normalized;
}