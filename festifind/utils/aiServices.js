import dotenv from 'dotenv';
dotenv.config();

/**
 * Truncate HTML content to fit within token limits
 * @param {string} htmlContent - Original HTML content
 * @param {number} maxLength - Maximum length in characters
 * @returns {string} - Truncated HTML content
 */
function truncateHtml(htmlContent, maxLength = 20000) {
  if (htmlContent.length <= maxLength) {
    return htmlContent;
  }
  
  // Find a good break point (end of a tag)
  const breakPoint = htmlContent.lastIndexOf('>', maxLength);
  if (breakPoint !== -1) {
    return htmlContent.substring(0, breakPoint + 1) + '<!-- content truncated -->';
  }
  
  // Fallback to hard truncation
  return htmlContent.substring(0, maxLength) + '<!-- content truncated -->';
}

/**
 * Query OpenAI API to extract festival data from HTML
 * @param {string} htmlContent - HTML content to process
 * @param {string} sourceId - Source website identifier
 * @param {string} prompt - Prompt for the AI
 * @returns {Promise<string>} - AI response
 */
export async function queryOpenAI(htmlContent, sourceId, prompt) {
  try {
    // Truncate HTML to avoid token limits
    const truncatedHtml = truncateHtml(htmlContent);
    console.log(`Original HTML size: ${htmlContent.length}, truncated to: ${truncatedHtml.length}`);
    
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: 'gpt-3.5-turbo', // Using a model with higher rate limits
        messages: [
          {
            role: 'system',
            content: 'You are a specialist in extracting festival data from HTML. Extract only what is asked for and return in the requested format.'
          },
          {
            role: 'user',
            content: `${prompt}\n\nHTML Content:\n${truncatedHtml}`
          }
        ],
        temperature: 0.3,
        max_tokens: 4000
      })
    });

    const data = await response.json();
    
    if (data.error) {
      console.error(`OpenAI API Error: ${data.error.message}`);
      return null;
    }
    
    return data.choices[0].message.content;
  } catch (error) {
    console.error(`Error querying OpenAI: ${error.message}`);
    return null;
  }
}

/**
 * Query Grok API to extract festival data from HTML
 * @param {string} htmlContent - HTML content to process
 * @param {string} sourceId - Source website identifier
 * @param {string} prompt - Prompt for the AI
 * @returns {Promise<string>} - AI response
 */
export async function queryGrok(htmlContent, sourceId, prompt) {
  try {
    // For now, we'll disable Grok queries since the API key is invalid
    console.log(`Skipping Grok API query due to invalid API key`);
    return null;
    
    /*
    // This code is kept for reference but not executed
    const truncatedHtml = truncateHtml(htmlContent);
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.XAI_API_KEY}`
      },
      body: JSON.stringify({
        model: 'llama3-8b-8192',
        messages: [
          {
            role: 'system',
            content: 'You are a specialist in extracting festival data from HTML. Extract only what is asked for and return in the requested format.'
          },
          {
            role: 'user',
            content: `${prompt}\n\nHTML Content:\n${truncatedHtml}`
          }
        ],
        temperature: 0.2,
        max_tokens: 4000
      })
    });

    const data = await response.json();
    
    if (data.error) {
      console.error(`Grok API Error: ${data.error.message}`);
      return null;
    }
    
    return data.choices[0].message.content;
    */
  } catch (error) {
    console.error(`Error querying Grok: ${error.message}`);
    return null;
  }
}

/**
 * Extract festival data using AI services with fallback strategy
 * @param {string} htmlContent - HTML content to process
 * @param {string} sourceId - Source website identifier
 * @param {string} prompt - Prompt for the AI
 * @returns {Promise<Array|null>} - Array of festival objects or null
 */
export async function extractFestivalData(htmlContent, sourceId, prompt) {
  // Try OpenAI first
  const openAIResult = await queryOpenAI(htmlContent, sourceId, prompt);
  
  if (openAIResult) {
    try {
      return JSON.parse(openAIResult);
    } catch (error) {
      console.warn(`OpenAI response for ${sourceId} not valid JSON: ${error.message}`);
      console.warn(`Response excerpt: ${openAIResult.substring(0, 200)}...`);
    }
  }
  
  // Fallback to Grok
  const grokResult = await queryGrok(htmlContent, sourceId, prompt);
  
  if (grokResult) {
    try {
      return JSON.parse(grokResult);
    } catch (error) {
      console.error(`Neither AI service returned valid JSON for ${sourceId}`);
      return null;
    }
  }
  
  return null;
}

/**
 * Generate source-specific prompt for festival extraction
 * @param {string} sourceId - Source website identifier
 * @returns {string} - Prompt for AI service
 */
export function generatePrompt(sourceId) {
  const prompts = {
    befesti: `
    Extract all festivals from this HTML from Befesti.nl.
    For each festival, extract:
    1. Festival name
    2. Start date
    3. End date (if available)
    4. Location
    5. Link to detail page

    Pay careful attention to these elements:
    - Festival cards are in .agenda--item .agenda--item--inner elements
    - Festival names are in h3[data-element="card-title"] elements
    - Start day is in div[data-element="day-start"] elements
    - End day is in div[data-element="day-end"] elements (check if it has 'is--date-text-hide' class)
    - Location is in .agenda--chip .text--s elements
    - The detail page URL is in the containing 'a' element's href attribute

    Format the response as a JSON array of objects with these fields:
    {
      "name": "Festival Name",
      "startDate": "YYYY-MM-DD",
      "endDate": "YYYY-MM-DD", // null if not available
      "location": "Location name",
      "detailUrl": "https://full.url.to.detail.page"
    }
    
    Important notes:
    - Dates should be in YYYY-MM-DD format
    - Make sure to construct complete URLs for detail links (prepend 'https://befesti.nl' if needed)
    - Process all festivals found on the page
    - You need to figure out the month and year from context, as the cards only show days
    - Return only valid JSON, no extra text or explanations
    `,
    partyflock: `
    Extract all festivals from this HTML from Partyflock.nl.
    Pay careful attention to these elements:
    - Festivals are in tr elements
    - Dates are in meta elements with itemprop="startDate" and itemprop="endDate"
    - Locations are in span elements with itemprop="name" inside span with itemprop="location"
    - Festival names are in span elements with itemprop="name" inside a href links

    Format the response as JSON array with:
    {
      "name": "Festival Name",
      "startDate": "YYYY-MM-DD",
      "endDate": "YYYY-MM-DD",
      "location": "Location name, City",
      "detailUrl": "https://partyflock.nl/complete-link"
    }
    `,
    // Add prompts for other sources as needed
  };
  
  return prompts[sourceId] || '';
} 