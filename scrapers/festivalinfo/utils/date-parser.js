/**
 * Utility functions for parsing Dutch date formats from festivalinfo.nl
 */

/**
 * Parse Dutch date strings into standard ISO date format
 * @param {string} dateString - Dutch format date string
 * @returns {string} ISO date string
 */
export function parseDutchDate(dateString) {
  if (!dateString) return null;
  
  const months = {
    'januari': '01', 'jan': '01',
    'februari': '02', 'feb': '02',
    'maart': '03', 'mrt': '03',
    'april': '04', 'apr': '04',
    'mei': '05',
    'juni': '06', 'jun': '06',
    'juli': '07', 'jul': '07',
    'augustus': '08', 'aug': '08',
    'september': '09', 'sep': '09',
    'oktober': '10', 'okt': '10',
    'november': '11', 'nov': '11',
    'december': '12', 'dec': '12'
  };
  
  // Handle numerical date formats like 14/05 or 14-05
  const numericMatch = dateString.match(/(\d{1,2})[\/\-](\d{1,2})(?:[\/\-](\d{2,4}))?/);
  if (numericMatch) {
    const day = numericMatch[1].padStart(2, '0');
    const month = numericMatch[2].padStart(2, '0');
    let year = numericMatch[3];
    
    // If year is not provided or is only 2 digits
    if (!year) {
      // Use current year by default
      year = new Date().getFullYear();
    } else if (year.length === 2) {
      // Convert 2-digit year to 4-digit
      year = year < 50 ? '20' + year : '19' + year;
    }
    
    return `${year}-${month}-${day}`;
  }
  
  // Handle Dutch text format like "14 mei 2023"
  const dutchMatch = dateString.toLowerCase().match(/(\d{1,2})\s+([a-zë]+)(?:\s+(\d{4}))?/);
  if (dutchMatch) {
    const day = dutchMatch[1].padStart(2, '0');
    const monthName = dutchMatch[2];
    const month = months[monthName];
    
    if (!month) return null; // Unknown month name
    
    let year = dutchMatch[3];
    if (!year) {
      // Use current year by default
      year = new Date().getFullYear();
    }
    
    return `${year}-${month}-${day}`;
  }
  
  // Try to extract just a year
  const yearMatch = dateString.match(/\b(20\d{2})\b/);
  if (yearMatch) {
    return `${yearMatch[1]}-01-01`; // Default to January 1st if only year is given
  }
  
  return null;
}

/**
 * Extract date information from text
 * @param {string} text - Text containing date information
 * @returns {Object} Date information
 */
export function extractDateInfo(text) {
  if (!text) return {};
  
  // Normalize text
  const normalizedText = text.toLowerCase().trim();
  
  // Check for date range with "t/m" (Dutch for "until")
  const rangePattern = /(\d{1,2})\s+([a-zë]+)\s*(?:\d{4})?\s*(?:t\/m|-|tot(?:\s+en\s+met)?)\s*(\d{1,2})\s+([a-zë]+)(?:\s+(\d{4}))?/i;
  const rangeMatch = normalizedText.match(rangePattern);
  
  // Check for date range with slashes or dashes (e.g., 14/05-16/05 or 14-05/16-05)
  const numericRangePattern = /(\d{1,2})[\/\-](\d{1,2})(?:[\/\-](?:\d{2,4})?)?\s*(?:-|t\/m|tot)\s*(\d{1,2})[\/\-](\d{1,2})(?:[\/\-](\d{2,4}))?/;
  const numericRangeMatch = normalizedText.match(numericRangePattern);
  
  // Check for single date
  const singleDatePattern = /(\d{1,2})\s+([a-zë]+)(?:\s+(\d{4}))?/i;
  const singleDateMatch = normalizedText.match(singleDatePattern);
  
  // Check for single numeric date (e.g., 14/05)
  const numericDatePattern = /(\d{1,2})[\/\-](\d{1,2})(?:[\/\-](\d{2,4}))?/;
  const numericDateMatch = normalizedText.match(numericDatePattern);
  
  // Process date range with text month names
  if (rangeMatch) {
    const startDate = parseDutchDate(`${rangeMatch[1]} ${rangeMatch[2]} ${rangeMatch[5] || ''}`);
    const endDate = parseDutchDate(`${rangeMatch[3]} ${rangeMatch[4]} ${rangeMatch[5] || ''}`);
    
    return {
      startDate,
      endDate
    };
  }
  
  // Process numeric date range
  if (numericRangeMatch) {
    const startDate = parseDutchDate(`${numericRangeMatch[1]}/${numericRangeMatch[2]}`);
    const endDate = parseDutchDate(`${numericRangeMatch[3]}/${numericRangeMatch[4]}`);
    
    return {
      startDate,
      endDate
    };
  }
  
  // Process single text date
  if (singleDateMatch) {
    const date = parseDutchDate(`${singleDateMatch[1]} ${singleDateMatch[2]} ${singleDateMatch[3] || ''}`);
    return {
      startDate: date,
      endDate: date
    };
  }
  
  // Process single numeric date
  if (numericDateMatch) {
    const date = parseDutchDate(`${numericDateMatch[1]}/${numericDateMatch[2]}`);
    return {
      startDate: date,
      endDate: date
    };
  }
  
  // Check for just a year
  const yearPattern = /\b(20\d{2})\b/;
  const yearMatch = normalizedText.match(yearPattern);
  if (yearMatch) {
    return {
      startDate: `${yearMatch[1]}-01-01`,
      endDate: `${yearMatch[1]}-12-31` // Full year
    };
  }
  
  return {};
}

/**
 * Calculate festival duration in days
 * @param {string} startDate - ISO format start date
 * @param {string} endDate - ISO format end date
 * @returns {number} Duration in days
 */
export function calculateDuration(startDate, endDate) {
  if (!startDate || !endDate) return 1;
  
  try {
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return 1;
    }
    
    // Calculate difference in days and add 1 (inclusive count)
    const diffTime = Math.abs(end - start);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
    
    return diffDays > 0 ? diffDays : 1;
  } catch (error) {
    return 1;
  }
} 