import fs from 'fs';
import path from 'path';
import { promises as fsPromises } from 'fs';

/**
 * Saves HTML content to a file
 * @param {string} content HTML content to save
 * @param {string} sourceId Source website identifier
 * @param {string} fileName Name of the file to save
 * @returns {Promise<string>} Path to the saved file
 */
export async function saveHtmlToFile(content, sourceId, fileName) {
  try {
    const dirPath = path.join(process.cwd(), 'data', 'scrapes', sourceId);
    
    // Ensure directory exists
    await fsPromises.mkdir(dirPath, { recursive: true });
    
    const filePath = path.join(dirPath, fileName);
    await fsPromises.writeFile(filePath, content);
    console.log(`HTML saved to ${filePath}`);
    return filePath;
  } catch (error) {
    console.error(`Error saving HTML to file: ${error.message}`);
    throw error;
  }
}

/**
 * Loads HTML content from a file
 * @param {string} sourceId Source website identifier
 * @param {string} fileName Name of the file to load
 * @returns {Promise<string>} HTML content
 */
export async function loadHtmlFromFile(sourceId, fileName) {
  try {
    const filePath = path.join(process.cwd(), 'data', 'scrapes', sourceId, fileName);
    const content = await fsPromises.readFile(filePath, 'utf8');
    return content;
  } catch (error) {
    console.error(`Error loading HTML from file: ${error.message}`);
    throw error;
  }
}

/**
 * Downloads HTML content from a URL
 * @param {string} url URL to download from
 * @param {Object} options Fetch options
 * @returns {Promise<string>} HTML content
 */
export async function downloadHtml(url, options = {}) {
  try {
    const headers = {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
      ...options.headers
    };
    
    const response = await fetch(url, {
      ...options,
      headers
    });
    
    if (!response.ok) {
      throw new Error(`Failed to download HTML: ${response.status} ${response.statusText}`);
    }
    
    return await response.text();
  } catch (error) {
    console.error(`Error downloading HTML: ${error.message}`);
    throw error;
  }
}

/**
 * Logs scraper action and status
 * @param {string} sourceId Source website identifier
 * @param {string} action Action being performed
 * @param {string} status Status of the action
 * @param {Object} details Additional details
 */
export function logScraperAction(sourceId, action, status, details = {}) {
  const timestamp = new Date().toISOString();
  const logEntry = {
    timestamp,
    sourceId,
    action,
    status,
    details
  };
  
  console.log(`[${timestamp}] ${sourceId} - ${action}: ${status}`);
  
  try {
    const logsDir = path.join(process.cwd(), 'data', 'logs');
    
    // Ensure directory exists
    if (!fs.existsSync(logsDir)) {
      fs.mkdirSync(logsDir, { recursive: true });
    }
    
    const logPath = path.join(logsDir, `${sourceId}.json`);
    let logs = [];
    
    if (fs.existsSync(logPath)) {
      logs = JSON.parse(fs.readFileSync(logPath, 'utf8'));
    }
    
    logs.push(logEntry);
    fs.writeFileSync(logPath, JSON.stringify(logs, null, 2));
  } catch (error) {
    console.error(`Error saving log: ${error.message}`);
  }
}

/**
 * Saves extracted festival data to a JSON file
 * @param {Array} festivals Array of festival objects
 * @param {string} sourceId Source website identifier
 * @returns {Promise<string>} Path to the saved file
 */
export async function saveFestivalData(festivals, sourceId) {
  try {
    const dirPath = path.join(process.cwd(), 'data', 'processed');
    
    // Ensure directory exists
    await fsPromises.mkdir(dirPath, { recursive: true });
    
    const filePath = path.join(dirPath, `${sourceId}.json`);
    await fsPromises.writeFile(filePath, JSON.stringify(festivals, null, 2));
    console.log(`Saved ${festivals.length} festivals to ${filePath}`);
    return filePath;
  } catch (error) {
    console.error(`Error saving festival data: ${error.message}`);
    throw error;
  }
}

/**
 * Implements a simple rate limiter to avoid overloading websites
 * @param {number} ms Milliseconds to wait
 * @returns {Promise<void>}
 */
export function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
} 