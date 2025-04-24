import { JSDOM } from 'jsdom';
import path from 'path';
import fs from 'fs';
import { 
  saveHtmlToFile, 
  loadHtmlFromFile, 
  downloadHtml, 
  logScraperAction, 
  saveFestivalData,
  sleep
} from '../base-scraper/utils.js';
import { extractFestivalData, generatePrompt } from '../../utils/aiServices.js';

// Define constants
const SOURCE_ID = 'befesti';
const BASE_URL = 'https://befesti.nl';
const LIST_URL = `${BASE_URL}/festivalagenda`;
const LIST_FILE = 'festival-list.html';

/**
 * Main function to scrape Befesti
 * @returns {Promise<Array>} Array of festival objects
 */
export async function scrapeBefesti() {
  try {
    // Log the start of scraping
    logScraperAction(SOURCE_ID, 'scrape', 'started');
    
    // Check if we already have the HTML file
    let htmlContent;
    try {
      htmlContent = await loadHtmlFromFile(SOURCE_ID, LIST_FILE);
      logScraperAction(SOURCE_ID, 'load', 'success', { file: LIST_FILE });
    } catch (error) {
      // If file doesn't exist, download it
      logScraperAction(SOURCE_ID, 'load', 'failed', { error: error.message });
      htmlContent = await downloadHtml(LIST_URL);
      await saveHtmlToFile(htmlContent, SOURCE_ID, LIST_FILE);
      logScraperAction(SOURCE_ID, 'download', 'success', { url: LIST_URL });
    }
    
    // First try using AI-powered extraction
    const prompt = generatePrompt(SOURCE_ID);
    let festivals = [];
    
    if (prompt) {
      try {
        const aiExtractedFestivals = await extractFestivalData(htmlContent, SOURCE_ID, prompt);
        if (aiExtractedFestivals && aiExtractedFestivals.length > 0) {
          festivals = aiExtractedFestivals;
          logScraperAction(SOURCE_ID, 'ai-extraction', 'success', { count: festivals.length });
        } else {
          logScraperAction(SOURCE_ID, 'ai-extraction', 'failed', { error: 'No festivals extracted' });
        }
      } catch (error) {
        logScraperAction(SOURCE_ID, 'ai-extraction', 'failed', { error: error.message });
      }
    }
    
    // Fallback to traditional parsing if AI extraction failed
    if (festivals.length === 0) {
      festivals = parseHtml(htmlContent);
      logScraperAction(SOURCE_ID, 'fallback-parse', 'success', { count: festivals.length });
    }
    
    // Process detail pages for enhanced information if needed
    if (festivals.length > 0) {
      // In a production implementation, we would process detail pages here
      // const enhancedFestivals = await processDetailPages(festivals);
      // festivals = enhancedFestivals;
    }
    
    // Save the festival data
    await saveFestivalData(festivals, SOURCE_ID);
    
    // Log the completion of scraping
    logScraperAction(SOURCE_ID, 'scrape', 'completed', { count: festivals.length });
    
    return festivals;
  } catch (error) {
    logScraperAction(SOURCE_ID, 'scrape', 'failed', { error: error.message });
    console.error(`Error scraping ${SOURCE_ID}: ${error.message}`);
    return [];
  }
}

/**
 * Process detail pages for each festival to get enhanced information
 * @param {Array} festivals Array of festival objects
 * @returns {Promise<Array>} Enhanced festival objects
 */
async function processDetailPages(festivals) {
  const enhancedFestivals = [];
  
  for (const festival of festivals) {
    try {
      if (festival.detailUrl) {
        // Add a random delay to avoid rate limiting
        await sleep(1000 + Math.random() * 2000);
        
        const details = await getFestivalDetails(festival.detailUrl);
        enhancedFestivals.push({
          ...festival,
          ...details
        });
        
        logScraperAction(SOURCE_ID, 'detail-page', 'success', { 
          name: festival.name, 
          url: festival.detailUrl 
        });
      } else {
        enhancedFestivals.push(festival);
      }
    } catch (error) {
      logScraperAction(SOURCE_ID, 'detail-page', 'failed', { 
        name: festival.name,
        error: error.message 
      });
      enhancedFestivals.push(festival);
    }
  }
  
  return enhancedFestivals;
}

/**
 * Parse HTML content to extract festivals
 * @param {string} htmlContent HTML content to parse
 * @returns {Array} Array of festival objects
 */
function parseHtml(htmlContent) {
  const dom = new JSDOM(htmlContent);
  const document = dom.window.document;
  
  // Select all festival cards
  const festivalCards = document.querySelectorAll('.agenda--item .agenda--item--inner');
  const festivals = [];
  
  festivalCards.forEach(card => {
    try {
      // Extract festival name
      const nameElement = card.querySelector('h3[data-element="card-title"]');
      if (!nameElement) return;
      const name = nameElement.textContent.trim();
      
      // Extract date information
      const startDayElement = card.querySelector('div[data-element="day-start"]');
      const endDayElement = card.querySelector('div[data-element="day-end"]');
      
      // Skip if no start day
      if (!startDayElement) return;
      
      const startDay = startDayElement.textContent.trim();
      // Check if end day exists and is visible
      const hasEndDay = endDayElement && !endDayElement.classList.contains('is--date-text-hide');
      const endDay = hasEndDay ? endDayElement.textContent.trim() : startDay;
      
      // Extract month, often found in nearby elements - needs contextual parsing
      // For now, we'll need to examine the page structure to find where month info is stored
      
      // Extract location
      const locationParts = Array.from(card.querySelectorAll('.agenda--chip .text--s'));
      const location = locationParts
        .map(part => part.textContent.trim())
        .join('')
        .replace(/,\s*/g, ', ');
      
      // Extract detail page link
      const linkElement = card.closest('a');
      const detailRelativeUrl = linkElement ? linkElement.getAttribute('href') : null;
      const detailUrl = detailRelativeUrl ? `${BASE_URL}${detailRelativeUrl}` : null;
      
      // Parse dates (using a more sophisticated approach)
      const { startDate, endDate } = parseDates(startDay, endDay);
      
      festivals.push({
        name,
        startDate,
        endDate,
        location,
        detailUrl,
        sourceWebsite: SOURCE_ID
      });
    } catch (error) {
      console.error(`Error parsing festival card: ${error.message}`);
    }
  });
  
  return festivals;
}

/**
 * Parse date strings into Date objects
 * In a real implementation, we need to:
 * 1. Extract month and year from the page context
 * 2. Combine with day numbers to form complete dates
 * 
 * @param {string} startDay Start day as string (e.g., "11")
 * @param {string} endDay End day as string (e.g., "13")
 * @returns {Object} Object with startDate and endDate
 */
function parseDates(startDay, endDay) {
  // For demonstration, we'll use the current year and month
  // In a full implementation, month/year would be extracted from the page
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();  // 0-indexed
  
  const formatDate = (day) => {
    // Create a date object and format as ISO string
    const date = new Date(year, month, parseInt(day, 10));
    return date.toISOString().split('T')[0];  // YYYY-MM-DD format
  };
  
  return {
    startDate: formatDate(startDay),
    endDate: formatDate(endDay)
  };
}

/**
 * Get the details for a specific festival
 * This function would visit the detail page and extract more information
 * @param {string} detailUrl URL of the detail page
 * @returns {Promise<Object>} Enhanced festival details
 */
async function getFestivalDetails(detailUrl) {
  try {
    // Download the detail page
    const htmlContent = await downloadHtml(detailUrl);
    
    // Add delay to avoid rate limiting
    await sleep(1000 + Math.random() * 1000);
    
    // Parse the detail page HTML
    const dom = new JSDOM(htmlContent);
    const document = dom.window.document;
    
    // Extract additional details
    // (To be implemented based on detail page structure)
    
    return {
      // Additional details would be added here
    };
  } catch (error) {
    console.error(`Error getting festival details: ${error.message}`);
    return {};
  }
}

// Export the scraper function
export default scrapeBefesti; 