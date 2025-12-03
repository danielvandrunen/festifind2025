// FestiFind Data Extraction Engine
// Supports Dutch, German, English, and French

// Multi-language date patterns with better specificity
const DATE_PATTERNS = {
  dutch: [
    // More specific Dutch date patterns
    /(\d{1,2})\s+(januari|februari|maart|april|mei|juni|juli|augustus|september|oktober|november|december)\s+(\d{4})/gi,
    /(\d{1,2})-(\d{1,2})-(\d{4})/g,
    /(\d{1,2})\/(\d{1,2})\/(\d{4})/g,
    // Dutch date ranges
    /(\d{1,2})\s+(januari|februari|maart|april|mei|juni|juli|augustus|september|oktober|november|december)\s+t\/m\s+(\d{1,2})\s+(januari|februari|maart|april|mei|juni|juli|augustus|september|oktober|november|december)\s+(\d{4})/gi,
    /(\d{1,2})\s*-\s*(\d{1,2})\s+(januari|februari|maart|april|mei|juni|juli|augustus|september|oktober|november|december)\s+(\d{4})/gi
  ],
  german: [
    // More specific German date patterns
    /(\d{1,2})\.\s*(Januar|Februar|März|April|Mai|Juni|Juli|August|September|Oktober|November|Dezember)\s+(\d{4})/gi,
    /(\d{1,2})\.(\d{1,2})\.(\d{4})/g,
    // German date ranges
    /(\d{1,2})\.\s*-\s*(\d{1,2})\.\s*(Januar|Februar|März|April|Mai|Juni|Juli|August|September|Oktober|November|Dezember)\s+(\d{4})/gi,
    /(\d{1,2})\.\s*(Januar|Februar|März|April|Mai|Juni|Juli|August|September|Oktober|November|Dezember)\s+bis\s+(\d{1,2})\.\s*(Januar|Februar|März|April|Mai|Juni|Juli|August|September|Oktober|November|Dezember)\s+(\d{4})/gi
  ],
  english: [
    // More specific English date patterns
    /(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2}),?\s+(\d{4})/gi,
    /(\d{1,2})\/(\d{1,2})\/(\d{4})/g,
    /(\d{4})-(\d{1,2})-(\d{1,2})/g,
    // English date ranges
    /(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2})\s*-\s*(\d{1,2}),?\s+(\d{4})/gi,
    /(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2})\s+to\s+(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2}),?\s+(\d{4})/gi
  ],
  french: [
    // More specific French date patterns
    /(\d{1,2})\s+(janvier|février|mars|avril|mai|juin|juillet|août|septembre|octobre|novembre|décembre)\s+(\d{4})/gi,
    /(\d{1,2})\/(\d{1,2})\/(\d{4})/g,
    // French date ranges
    /(\d{1,2})\s*-\s*(\d{1,2})\s+(janvier|février|mars|avril|mai|juin|juillet|août|septembre|octobre|novembre|décembre)\s+(\d{4})/gi,
    /(\d{1,2})\s+(janvier|février|mars|avril|mai|juin|juillet|août|septembre|octobre|novembre|décembre)\s+au\s+(\d{1,2})\s+(janvier|février|mars|avril|mai|juin|juillet|août|septembre|octobre|novembre|décembre)\s+(\d{4})/gi
  ]
};

// Month mappings for different languages
const MONTH_MAPPINGS = {
  dutch: {
    'januari': 1, 'februari': 2, 'maart': 3, 'april': 4, 'mei': 5, 'juni': 6,
    'juli': 7, 'augustus': 8, 'september': 9, 'oktober': 10, 'november': 11, 'december': 12
  },
  german: {
    'januar': 1, 'februar': 2, 'märz': 3, 'april': 4, 'mai': 5, 'juni': 6,
    'juli': 7, 'august': 8, 'september': 9, 'oktober': 10, 'november': 11, 'dezember': 12
  },
  english: {
    'january': 1, 'february': 2, 'march': 3, 'april': 4, 'may': 5, 'june': 6,
    'july': 7, 'august': 8, 'september': 9, 'october': 10, 'november': 11, 'december': 12
  },
  french: {
    'janvier': 1, 'février': 2, 'mars': 3, 'avril': 4, 'mai': 5, 'juin': 6,
    'juillet': 7, 'août': 8, 'septembre': 9, 'octobre': 10, 'novembre': 11, 'décembre': 12
  }
};

// Festival keywords for different languages
const FESTIVAL_KEYWORDS = {
  dutch: ['festival', 'evenement', 'muziekfestival', 'concerten', 'optreden'],
  german: ['festival', 'musikfestival', 'konzert', 'veranstaltung', 'aufführung'],
  english: ['festival', 'music festival', 'concert', 'event', 'performance'],
  french: ['festival', 'festival de musique', 'concert', 'événement', 'spectacle']
};

// Date-related keywords to exclude from location extraction
const DATE_KEYWORDS = [
  'january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december',
  'januari', 'februari', 'maart', 'mei', 'juni', 'juli', 'augustus', 'oktober', 'november',
  'januar', 'februar', 'märz', 'mai', 'juni', 'juli', 'august', 'september', 'oktober', 'november', 'dezember',
  'janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre',
  'mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun',
  'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday',
  'maandag', 'dinsdag', 'woensdag', 'donderdag', 'vrijdag', 'zaterdag', 'zondag',
  'montag', 'dienstag', 'mittwoch', 'donnerstag', 'freitag', 'samstag', 'sonntag',
  'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'
];

/**
 * Extract festival name from the page
 */
function extractFestivalName() {
  console.log('Extracting festival name...');
  
  // Priority order for name extraction
  const sources = [
    // 1. Page title
    () => {
      const title = document.title;
      if (containsFestivalKeywords(title)) {
        return cleanFestivalName(title);
      }
      return null;
    },
    
    // 2. H1 headings
    () => {
      const h1Elements = document.querySelectorAll('h1');
      for (const h1 of h1Elements) {
        const text = h1.textContent.trim();
        if (containsFestivalKeywords(text)) {
          return cleanFestivalName(text);
        }
      }
      return null;
    },
    
    // 3. H2 headings
    () => {
      const h2Elements = document.querySelectorAll('h2');
      for (const h2 of h2Elements) {
        const text = h2.textContent.trim();
        if (containsFestivalKeywords(text)) {
          return cleanFestivalName(text);
        }
      }
      return null;
    },
    
    // 4. Meta tags
    () => {
      const ogTitle = document.querySelector('meta[property="og:title"]');
      if (ogTitle && containsFestivalKeywords(ogTitle.content)) {
        return cleanFestivalName(ogTitle.content);
      }
      
      const metaTitle = document.querySelector('meta[name="title"]');
      if (metaTitle && containsFestivalKeywords(metaTitle.content)) {
        return cleanFestivalName(metaTitle.content);
      }
      
      return null;
    },
    
    // 5. Schema.org markup
    () => {
      const eventName = document.querySelector('[itemtype*="Event"] [itemprop="name"]');
      if (eventName) {
        return cleanFestivalName(eventName.textContent);
      }
      return null;
    }
  ];
  
  // Try each source until we find a name
  for (const source of sources) {
    try {
      const name = source();
      if (name && name.length > 3) {
        console.log('Found festival name:', name);
        return name;
      }
    } catch (error) {
      console.error('Error in name extraction source:', error);
    }
  }
  
  console.log('No festival name found');
  return '';
}

/**
 * Check if text contains festival keywords
 */
function containsFestivalKeywords(text) {
  const lowerText = text.toLowerCase();
  
  for (const language of Object.keys(FESTIVAL_KEYWORDS)) {
    for (const keyword of FESTIVAL_KEYWORDS[language]) {
      if (lowerText.includes(keyword.toLowerCase())) {
        return true;
      }
    }
  }
  
  return false;
}

/**
 * Clean and format festival name
 */
function cleanFestivalName(name) {
  return name
    .replace(/\s*-\s*.*$/, '') // Remove everything after dash
    .replace(/\s*\|\s*.*$/, '') // Remove everything after pipe
    .replace(/\s*\(\d{4}\)/, '') // Remove year in parentheses
    .trim();
}

/**
 * Extract dates from the page with improved parsing
 */
function extractDates() {
  console.log('Extracting dates...');
  
  const pageText = document.body.innerText;
  const dates = { startDate: null, endDate: null };
  let foundDates = [];
  
  // Try schema.org dates first (most reliable)
  const startDateElement = document.querySelector('[itemprop="startDate"]');
  const endDateElement = document.querySelector('[itemprop="endDate"]');
  
  if (startDateElement) {
    const startDate = formatDate(startDateElement.getAttribute('datetime') || startDateElement.textContent);
    if (startDate) {
      dates.startDate = startDate;
      console.log('Found schema.org start date:', startDate);
    }
  }
  
  if (endDateElement) {
    const endDate = formatDate(endDateElement.getAttribute('datetime') || endDateElement.textContent);
    if (endDate) {
      dates.endDate = endDate;
      console.log('Found schema.org end date:', endDate);
    }
  }
  
  // If no schema.org dates, try pattern matching
  if (!dates.startDate) {
    console.log('No schema.org dates found, trying pattern matching...');
    
    // Try each language pattern
    for (const language of Object.keys(DATE_PATTERNS)) {
      for (const pattern of DATE_PATTERNS[language]) {
        const matches = [...pageText.matchAll(pattern)];
        
        if (matches.length > 0) {
          console.log(`Found dates using ${language} pattern:`, matches);
          
          for (const match of matches) {
            const parsedDates = parseAdvancedDate(match, language);
            foundDates = foundDates.concat(parsedDates.filter(date => date !== null));
          }
          
          if (foundDates.length > 0) {
            break;
          }
        }
      }
      
      if (foundDates.length > 0) break;
    }
    
    // Process found dates
    if (foundDates.length > 0) {
      foundDates.sort((a, b) => new Date(a) - new Date(b));
      dates.startDate = foundDates[0];
      dates.endDate = foundDates.length > 1 ? foundDates[foundDates.length - 1] : foundDates[0];
    }
  }
  
  console.log('Extracted dates:', dates);
  return dates;
}

/**
 * Advanced date parsing that handles ranges and multiple formats
 */
function parseAdvancedDate(match, language) {
  const results = [];
  
  try {
    if (language === 'dutch') {
      if (match[0].includes('t/m') || match[0].includes('-')) {
        // Handle Dutch date ranges
        const parts = match[0].split(/\s+t\/m\s+|\s*-\s*/);
        for (const part of parts) {
          const dateMatch = part.match(/(\d{1,2})\s+(januari|februari|maart|april|mei|juni|juli|augustus|september|oktober|november|december)\s+(\d{4})/gi);
          if (dateMatch) {
            results.push(parseDate(dateMatch, language));
          }
        }
      } else {
        results.push(parseDate(match, language));
      }
    } else if (language === 'german') {
      if (match[0].includes('bis') || match[0].includes('-')) {
        // Handle German date ranges
        const parts = match[0].split(/\s+bis\s+|\s*-\s*/);
        for (const part of parts) {
          const dateMatch = part.match(/(\d{1,2})\.\s*(Januar|Februar|März|April|Mai|Juni|Juli|August|September|Oktober|November|Dezember)\s+(\d{4})/gi);
          if (dateMatch) {
            results.push(parseDate(dateMatch, language));
          }
        }
      } else {
        results.push(parseDate(match, language));
      }
    } else if (language === 'english') {
      if (match[0].includes('to') || match[0].includes('-')) {
        // Handle English date ranges
        const parts = match[0].split(/\s+to\s+|\s*-\s*/);
        for (const part of parts) {
          const dateMatch = part.match(/(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2}),?\s+(\d{4})/gi);
          if (dateMatch) {
            results.push(parseDate(dateMatch, language));
          }
        }
      } else {
        results.push(parseDate(match, language));
      }
    } else if (language === 'french') {
      if (match[0].includes('au') || match[0].includes('-')) {
        // Handle French date ranges
        const parts = match[0].split(/\s+au\s+|\s*-\s*/);
        for (const part of parts) {
          const dateMatch = part.match(/(\d{1,2})\s+(janvier|février|mars|avril|mai|juin|juillet|août|septembre|octobre|novembre|décembre)\s+(\d{4})/gi);
          if (dateMatch) {
            results.push(parseDate(dateMatch, language));
          }
        }
      } else {
        results.push(parseDate(match, language));
      }
    }
  } catch (error) {
    console.error('Error in advanced date parsing:', error);
  }
  
  return results.filter(date => date !== null);
}

/**
 * Parse date from regex match based on language
 */
function parseDate(match, language) {
  try {
    if (language === 'dutch' || language === 'german' || language === 'french') {
      const day = parseInt(match[1]);
      const monthName = match[2].toLowerCase();
      const year = parseInt(match[3]);
      
      const monthMapping = MONTH_MAPPINGS[language];
      const month = monthMapping[monthName];
      
      if (month && day >= 1 && day <= 31 && year >= 2020 && year <= 2030) {
        return formatDate(`${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`);
      }
    } else if (language === 'english') {
      if (match[1] && isNaN(match[1])) {
        // Month name format
        const monthName = match[1].toLowerCase();
        const day = parseInt(match[2]);
        const year = parseInt(match[3]);
        
        const month = MONTH_MAPPINGS.english[monthName];
        if (month && day >= 1 && day <= 31 && year >= 2020 && year <= 2030) {
          return formatDate(`${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`);
        }
      } else {
        // Try to parse numeric formats
        const dateStr = match[0];
        const date = new Date(dateStr);
        if (!isNaN(date.getTime()) && date.getFullYear() >= 2020 && date.getFullYear() <= 2030) {
          return formatDate(dateStr);
        }
      }
    }
  } catch (error) {
    console.error('Error parsing date:', error);
  }
  
  return null;
}

/**
 * Format date to YYYY-MM-DD
 */
function formatDate(dateString) {
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return null;
    
    const year = date.getFullYear();
    if (year < 2020 || year > 2030) return null; // Reasonable date range filter
    
    return date.toISOString().split('T')[0];
  } catch (error) {
    return null;
  }
}

/**
 * Check if text contains date-related keywords
 */
function containsDateKeywords(text) {
  const lowerText = text.toLowerCase();
  return DATE_KEYWORDS.some(keyword => lowerText.includes(keyword));
}

/**
 * Extract location from the page with improved filtering
 */
function extractLocation() {
  console.log('Extracting location...');
  
  // Priority order for location extraction
  const sources = [
    // 1. Schema.org location
    () => {
      const location = document.querySelector('[itemprop="location"]');
      if (location) {
        const name = location.querySelector('[itemprop="name"]');
        const address = location.querySelector('[itemprop="address"]');
        
        if (name) return name.textContent.trim();
        if (address) return address.textContent.trim();
        return location.textContent.trim();
      }
      return null;
    },
    
    // 2. Meta tags
    () => {
      const metaLocation = document.querySelector('meta[name="location"], meta[property="event:location"]');
      if (metaLocation) {
        return metaLocation.content.trim();
      }
      return null;
    },
    
    // 3. Common location patterns with date filtering
    () => {
      const locationKeywords = ['venue', 'location', 'address', 'plaats', 'ort', 'lieu', 'locatie'];
      
      for (const keyword of locationKeywords) {
        const elements = document.querySelectorAll(`*[class*="${keyword}"], *[id*="${keyword}"]`);
        
        for (const element of elements) {
          const text = element.textContent.trim();
          
          // Filter out date-related content and validate length
          if (text && 
              text.length > 3 && 
              text.length < 200 && 
              !containsDateKeywords(text) &&
              !text.match(/\d{1,2}[\s\-\/]\d{1,2}[\s\-\/]\d{4}/) && // No date patterns
              !text.match(/\d{4}/) // No years
             ) {
            return text;
          }
        }
      }
      
      return null;
    }
  ];
  
  // Try each source
  for (const source of sources) {
    try {
      const location = source();
      if (location && location.length > 3) {
        console.log('Found location:', location);
        return cleanLocation(location);
      }
    } catch (error) {
      console.error('Error in location extraction source:', error);
    }
  }
  
  console.log('No location found');
  return '';
}

/**
 * Clean location text
 */
function cleanLocation(location) {
  return location
    .replace(/\n/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Extract emails from the page
 */
function extractEmails() {
  console.log('Extracting emails...');
  
  const emailRegex = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g;
  const pageText = document.body.innerText;
  
  // Also check href attributes for mailto links
  const mailtoLinks = document.querySelectorAll('a[href^="mailto:"]');
  const mailtoEmails = Array.from(mailtoLinks).map(link => 
    link.href.replace('mailto:', '').split('?')[0]
  );
  
  // Extract from page text
  const textEmails = [...(pageText.match(emailRegex) || [])];
  
  // Combine and deduplicate
  const allEmails = [...new Set([...textEmails, ...mailtoEmails])];
  
  // Filter valid emails
  const validEmails = allEmails.filter(email => isValidEmail(email));
  
  console.log('Found emails:', validEmails);
  return validEmails;
}

/**
 * Validate email format
 */
function isValidEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email) && email.length < 100;
}

/**
 * Main extraction function
 */
function extractAllData() {
  console.log('Starting data extraction for:', window.location.href);
  
  const data = {
    name: extractFestivalName(),
    dates: extractDates(),
    location: extractLocation(),
    emails: extractEmails(),
    url: window.location.href,
    timestamp: new Date().toISOString()
  };
  
  console.log('Extracted data:', data);
  return data;
}

// Export functions for use in content script
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    extractAllData,
    extractFestivalName,
    extractDates,
    extractLocation,
    extractEmails,
    isValidEmail
  };
} 