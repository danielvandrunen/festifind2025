// FestiFind Chrome Extension - Content Script
// This script runs on every webpage and handles data extraction

console.log('FestiFind content script loaded on:', window.location.href);
console.log('Content script version: 1.0.2 - with Perplexity AI');

// Add a global indicator that the content script is loaded
window.festifindContentScriptLoaded = true;

// Perplexity service configuration
const PERPLEXITY_SERVICE_URL = 'https://festifind2025.vercel.app/api/perplexity';
const PERPLEXITY_API_KEY = 'festifind-perplexity-service-2025';

// Health check function
async function checkPerplexityServiceHealth() {
  try {
    console.log('🩺 Checking Perplexity service health...');
    const response = await fetch(`${PERPLEXITY_SERVICE_URL}/health`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    if (response.ok) {
      const healthData = await response.json();
      console.log('✅ Perplexity service is healthy:', healthData);
      return true;
    } else {
      console.error('❌ Perplexity service health check failed:', response.status);
      return false;
    }
  } catch (error) {
    console.error('❌ Perplexity service health check error:', error);
    return false;
  }
}

// Load the extractor utility
let extractorLoaded = false;

// Function to load the extractor script
async function loadExtractor() {
  if (extractorLoaded) return;
  
  try {
    // Load extractor.js by injecting it into the page
    const script = document.createElement('script');
    script.src = chrome.runtime.getURL('utils/extractor.js');
    script.onload = () => {
      extractorLoaded = true;
      console.log('Extractor loaded successfully');
    };
    (document.head || document.documentElement).appendChild(script);
    
    // Wait for script to load
    await new Promise((resolve) => {
      script.onload = resolve;
    });
    
    // Give it a moment to initialize
    await new Promise(resolve => setTimeout(resolve, 500));
    
  } catch (error) {
    console.error('Failed to load extractor:', error);
  }
}

// Perplexity AI extraction function with timeout
async function extractWithPerplexity(html, url, timeoutMs = 45000) {
  try {
    console.log('🤖 Attempting Perplexity AI extraction...');
    
    // Check service health first
    const isHealthy = await checkPerplexityServiceHealth();
    if (!isHealthy) {
      throw new Error('Perplexity service is not available - health check failed');
    }
    
    const extractUrl = `${PERPLEXITY_SERVICE_URL}/extract/html`;
    console.log(`📡 Service URL: ${extractUrl}`);
    console.log(`🔑 API Key: ${PERPLEXITY_API_KEY.substring(0, 20)}...`);
    console.log(`📄 HTML length: ${html.length} characters`);
    console.log(`🌐 URL: ${url}`);
    
    // Create a promise that rejects after timeout
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Perplexity request timed out after 45 seconds')), timeoutMs);
    });
    
    const requestData = {
      html: html,
      url: url
    };
    
    console.log('📦 Request data preview:', {
      htmlLength: html.length,
      htmlPreview: html.substring(0, 200) + '...',
      url: url
    });
    
    // Create the fetch promise
    const fetchPromise = fetch(extractUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${PERPLEXITY_API_KEY}`
      },
      body: JSON.stringify(requestData)
    });
    
    // Race between timeout and fetch
    const response = await Promise.race([fetchPromise, timeoutPromise]);
    
    console.log(`📥 Response status: ${response.status} ${response.statusText}`);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Response error body:', errorText);
      console.error('❌ Response headers:', Object.fromEntries(response.headers.entries()));
      
      // Provide specific error messages based on status codes
      let errorMessage;
      switch (response.status) {
        case 401:
          errorMessage = 'Authentication failed - invalid API key';
          break;
        case 403:
          errorMessage = 'Access forbidden - check API permissions';
          break;
        case 404:
          errorMessage = 'Perplexity service endpoint not found';
          break;
        case 429:
          errorMessage = 'Rate limit exceeded - please try again later';
          break;
        case 500:
          errorMessage = 'Perplexity service internal error';
          break;
        default:
          errorMessage = `Service error ${response.status}: ${response.statusText}`;
      }
      
      throw new Error(`${errorMessage} - ${errorText}`);
    }
    
    const result = await response.json();
    console.log('📊 Full response:', result);
    
    if (result.success) {
      console.log('✅ Perplexity extraction successful');
      console.log('📊 Confidence:', result.metadata?.confidence + '%');
      console.log('📈 Stats:', result.metadata?.stats);
      console.log('🎯 Extracted festival data:', result.data);
      return {
        data: result.data,
        metadata: result.metadata,
        method: 'perplexity-ai'
      };
    } else {
      throw new Error(result.error || result.message || 'Extraction failed');
    }
    
  } catch (error) {
    console.error('❌ Perplexity extraction failed:', error.message);
    console.error('❌ Error type:', error.constructor.name);
    console.error('❌ Error stack:', error.stack);
    return null;
  }
}

// Make extraction function globally available for testing
window.extractWithPerplexity = extractWithPerplexity;

// Enhanced extraction with retry logic
async function extractWithPerplexityRetry(html, url, maxRetries = 1) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    const startTime = Date.now();
    try {
      console.log(`🔄 Perplexity extraction attempt ${attempt}/${maxRetries} (45s timeout)`);
      
      const result = await extractWithPerplexity(html, url);
      
      const duration = Math.round((Date.now() - startTime) / 1000);
      console.log(`⏱️ Perplexity extraction took ${duration} seconds`);
      
      if (result) {
        console.log('✅ Perplexity extraction successful, using AI results');
        return result;
      }
      
      if (attempt === maxRetries) {
        console.log('🔧 All Perplexity attempts failed, will use regex fallback');
        return null;
      }
      
      // Wait before retry (shorter wait since we have long timeout)
      console.log(`⏳ Waiting 5 seconds before retry...`);
      await new Promise(resolve => setTimeout(resolve, 5000));
      
    } catch (error) {
      const duration = Math.round((Date.now() - startTime) / 1000);
      console.warn(`❌ Attempt ${attempt} failed after ${duration}s:`, error.message);
      
      if (attempt === maxRetries) {
        console.log('🔧 Perplexity service unavailable, falling back to regex');
        return null;
      }
    }
  }
  
  return null;
}

// Listen for messages from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('Content script received message:', request);
  
  try {
    if (request.action === 'extractFestivalData' || request.action === 'extractData') {
      handleExtractData(sendResponse);
      return true; // Indicates we will send a response asynchronously
    }
    
    if (request.action === 'ping') {
      console.log('Ping received, sending response');
      sendResponse({ 
        status: 'alive', 
        url: window.location.href,
        title: document.title,
        timestamp: new Date().toISOString()
      });
      return false;
    }
    
    // Unknown action
    console.warn('Unknown action received:', request.action);
    sendResponse({ 
      success: false, 
      error: `Unknown action: ${request.action}` 
    });
    return false;
    
  } catch (error) {
    console.error('Error in message listener:', error);
    sendResponse({ 
      success: false, 
      error: error.message 
    });
    return false;
  }
});

// Handle data extraction request
async function handleExtractData(sendResponse) {
  try {
    console.log('🚀 Starting Perplexity AI extraction...');
    
    // Get the full HTML content - try multiple methods to ensure we get everything
    let fullHtml;
    
    // Method 1: Try documentElement.outerHTML
    fullHtml = document.documentElement.outerHTML;
    
    // Method 2: If HTML is suspiciously short, try waiting for page to load
    if (fullHtml.length < 1000) {
      console.log('⚠️ HTML seems short, waiting for page to fully load...');
      await new Promise(resolve => setTimeout(resolve, 2000));
      fullHtml = document.documentElement.outerHTML;
    }
    
    // Method 3: If still short, try body.innerHTML with DOCTYPE
    if (fullHtml.length < 1000) {
      console.log('⚠️ Still short HTML, trying alternative method...');
      const doctype = document.doctype ? `<!DOCTYPE ${document.doctype.name}>` : '';
      fullHtml = doctype + document.documentElement.outerHTML;
    }
    
    const url = window.location.href;
    
    console.log(`📄 HTML length: ${fullHtml.length} characters`);
    console.log(`🌐 URL: ${url}`);
    console.log(`📝 HTML preview: ${fullHtml.substring(0, 200)}...`);
    
    // Use only Perplexity AI extraction (no regex fallback)
    const perplexityResult = await extractWithPerplexityRetry(fullHtml, url);
    
    if (perplexityResult) {
      console.log('✅ Perplexity AI extraction successful!');
      console.log('📊 Extracted data:', perplexityResult.data);
      
      sendResponse({
        success: true,
        data: perplexityResult.data,
        metadata: perplexityResult.metadata,
        method: 'perplexity-ai'
      });
      return;
    }
    
    // If Perplexity fails, return an error instead of falling back
    console.error('❌ Perplexity AI extraction failed');
    
    sendResponse({
      success: false,
      error: 'Perplexity AI extraction failed - check service connection',
      data: {
        name: '',
        dates: { startDate: null, endDate: null },
        location: '',
        emails: [],
        url: window.location.href,
        domain: window.location.hostname,
        title: document.title,
        timestamp: new Date().toISOString()
      },
      method: 'perplexity-ai-failed'
    });
    
  } catch (error) {
    console.error('❌ Error during data extraction:', error);
    console.error('❌ Error stack:', error.stack);
    console.error('❌ Error details:', {
      name: error.name,
      message: error.message,
      stack: error.stack
    });
    
    sendResponse({
      success: false,
      error: `Extraction error: ${error.message}`,
      data: {
        name: '',
        dates: { startDate: null, endDate: null },
        location: '',
        emails: [],
        url: window.location.href,
        domain: window.location.hostname,
        title: document.title,
        timestamp: new Date().toISOString()
      },
      method: 'error'
    });
  }
}

// Improved fallback extraction functions
function extractFestivalNameFallback() {
  try {
    // Check if main extractor function exists
    if (typeof extractFestivalName === 'function') {
      return extractFestivalName();
    }
    
    // Enhanced fallback logic
    const title = document.title;
    const festivalKeywords = ['festival', 'concert', 'event', 'music', 'evenement', 'konzert', 'live', 'show'];
    
    const lowerTitle = title.toLowerCase();
    const hasFestivalKeyword = festivalKeywords.some(keyword => lowerTitle.includes(keyword));
    
    if (hasFestivalKeyword) {
      return title.split(' - ')[0].split(' | ')[0].replace(/\d{4}/, '').trim();
    }
    
    // Try meta tags
    const ogTitle = document.querySelector('meta[property="og:title"]');
    if (ogTitle && ogTitle.content) {
      const content = ogTitle.content;
      if (festivalKeywords.some(keyword => content.toLowerCase().includes(keyword))) {
        return content.split(' - ')[0].split(' | ')[0].replace(/\d{4}/, '').trim();
      }
    }
    
    // Try H1 elements with better filtering
    const h1Elements = document.querySelectorAll('h1');
    for (const h1 of h1Elements) {
      const text = h1.textContent.trim();
      const lowerText = text.toLowerCase();
      
      if (text.length > 3 && text.length < 100 && 
          festivalKeywords.some(keyword => lowerText.includes(keyword))) {
        return text.replace(/\d{4}/, '').trim();
      }
    }
    
    return '';
  } catch (error) {
    console.error('Error extracting festival name:', error);
    return '';
  }
}

function extractDatesFallback() {
  try {
    // Check if main extractor function exists
    if (typeof extractDates === 'function') {
      return extractDates();
    }
    
    const dates = { startDate: null, endDate: null };
    
    // Try schema.org dates first
    const startDateElement = document.querySelector('[itemprop="startDate"]');
    const endDateElement = document.querySelector('[itemprop="endDate"]');
    
    if (startDateElement) {
      const datetime = startDateElement.getAttribute('datetime') || startDateElement.textContent;
      dates.startDate = formatSimpleDate(datetime);
    }
    
    if (endDateElement) {
      const datetime = endDateElement.getAttribute('datetime') || endDateElement.textContent;
      dates.endDate = formatSimpleDate(datetime);
    }
    
    // If no schema.org dates, try pattern matching in page text
    if (!dates.startDate) {
      const pageText = document.body.innerText;
      console.log('Searching for dates in page text...');
      
      // Enhanced date patterns including ranges
      const datePatterns = [
        // Date ranges like "July 15-17, 2025" or "July 15-17, 2025"
        /(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2})-(\d{1,2}),?\s+(\d{4})/gi,
        
        // Single dates like "July 15, 2025"
        /(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2}),?\s+(\d{4})/gi,
        
        // Numeric patterns
        /(\d{1,2})\/(\d{1,2})\/(\d{4})/g,
        /(\d{4})-(\d{1,2})-(\d{1,2})/g,
        
        // Date ranges with different separators
        /(\d{1,2})[\s\-–](\d{1,2})[\s\/\-](\d{1,2})[\s\/\-](\d{4})/g
      ];
      
      // Try date range pattern first (July 15-17, 2025)
      const rangePattern = /(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2})-(\d{1,2}),?\s+(\d{4})/gi;
      const rangeMatch = rangePattern.exec(pageText);
      
      if (rangeMatch) {
        const [, month, startDay, endDay, year] = rangeMatch;
        
        const startDateStr = `${month} ${startDay}, ${year}`;
        const endDateStr = `${month} ${endDay}, ${year}`;
        
        console.log('Found date range:', startDateStr, 'to', endDateStr);
        
        dates.startDate = formatSimpleDate(startDateStr);
        dates.endDate = formatSimpleDate(endDateStr);
        
        if (dates.startDate) {
          console.log('Successfully parsed date range');
          return dates;
        }
      }
      
      // Fallback to other patterns
      for (const pattern of datePatterns) {
        const matches = [...pageText.matchAll(pattern)];
        if (matches.length > 0) {
          const match = matches[0];
          console.log('Found date pattern match:', match[0]);
          
          const formattedDate = formatSimpleDate(match[0]);
          if (formattedDate) {
            dates.startDate = formattedDate;
            console.log('Formatted start date:', formattedDate);
            
            // Try to find end date from subsequent matches
            if (matches.length > 1) {
              const endFormatted = formatSimpleDate(matches[1][0]);
              if (endFormatted) {
                dates.endDate = endFormatted;
                console.log('Formatted end date:', endFormatted);
              }
            }
            break;
          }
        }
      }
    }
    
    return dates;
  } catch (error) {
    console.error('Error extracting dates:', error);
    return { startDate: null, endDate: null };
  }
}

function extractLocationFallback() {
  try {
    // Check if main extractor function exists
    if (typeof extractLocation === 'function') {
      return extractLocation();
    }
    
    // Try schema.org location first
    const locationElement = document.querySelector('[itemprop="location"]');
    if (locationElement) {
      const name = locationElement.querySelector('[itemprop="name"]');
      const address = locationElement.querySelector('[itemprop="address"]');
      
      if (name) return name.textContent.trim();
      if (address) return address.textContent.trim();
      return locationElement.textContent.trim();
    }
    
    // Look for common location patterns but filter out dates
    const locationSelectors = [
      '*[class*="venue"]',
      '*[class*="location"]', 
      '*[class*="address"]',
      '*[id*="venue"]',
      '*[id*="location"]'
    ];
    
    const dateKeywords = [
      'january', 'february', 'march', 'april', 'may', 'june', 
      'july', 'august', 'september', 'october', 'november', 'december',
      'januari', 'februari', 'maart', 'mei', 'juni', 'juli', 'augustus'
    ];
    
    for (const selector of locationSelectors) {
      const elements = document.querySelectorAll(selector);
      for (const element of elements) {
        const text = element.textContent.trim();
        
        // Filter out date-related content
        const hasDateKeywords = dateKeywords.some(keyword => 
          text.toLowerCase().includes(keyword)
        );
        
        const hasDatePattern = /\d{1,2}[\s\-\/]\d{1,2}[\s\-\/]\d{4}/.test(text) || 
                              /\d{4}/.test(text);
        
        if (text && text.length > 3 && text.length < 200 && 
            !hasDateKeywords && !hasDatePattern) {
          return text;
        }
      }
    }
    
    return '';
  } catch (error) {
    console.error('Error extracting location:', error);
    return '';
  }
}

function extractEmailsFallback() {
  try {
    // Check if main extractor function exists
    if (typeof extractEmails === 'function') {
      return extractEmails();
    }
    
    // Fallback: simple email extraction
    const emailRegex = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g;
    
    // Extract from page text
    const pageText = document.body.innerText;
    const textEmails = [...(pageText.match(emailRegex) || [])];
    
    // Extract from mailto links
    const mailtoLinks = document.querySelectorAll('a[href^="mailto:"]');
    const mailtoEmails = Array.from(mailtoLinks).map(link => 
      link.href.replace('mailto:', '').split('?')[0]
    );
    
    // Combine and deduplicate
    const allEmails = [...new Set([...textEmails, ...mailtoEmails])];
    
    // Filter valid emails
    return allEmails.filter(email => {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      return emailRegex.test(email) && email.length < 100;
    });
  } catch (error) {
    console.error('Error extracting emails:', error);
    return [];
  }
}

function formatSimpleDate(dateString) {
  try {
    console.log('Formatting date string:', dateString);
    
    // Clean up the date string
    let cleanDateString = dateString.trim();
    
    // Handle various formats
    const date = new Date(cleanDateString);
    
    if (isNaN(date.getTime())) {
      console.log('Failed to parse date:', dateString);
      return null;
    }
    
    const year = date.getFullYear();
    if (year < 2020 || year > 2035) {
      console.log('Date year out of range:', year);
      return null; // Filter unrealistic dates
    }
    
    const formattedDate = date.toISOString().split('T')[0];
    console.log('Successfully formatted date:', formattedDate);
    return formattedDate;
  } catch (error) {
    console.error('Error formatting date:', error);
    return null;
  }
}

// Initialize content script
console.log('FestiFind content script initialized');

// Send initial status to background script
chrome.runtime.sendMessage({
  action: 'contentScriptLoaded',
  url: window.location.href,
  title: document.title
}).catch(error => {
  // Ignore errors if background script is not ready
  console.log('Could not send message to background script:', error.message);
}); 