/**
 * Perplexity client utility for FestiFind
 * Used as a secondary AI service for festival research
 */

// Perplexity API configuration
const PERPLEXITY_CONFIG = {
  apiKey: 'YOUR_PERPLEXITY_API_KEY',
  baseURL: 'https://api.perplexity.ai',
  timeout: 60 * 1000, // 60 seconds timeout
  maxRetries: 2
};

/**
 * Default research prompt template for festival research with Perplexity
 * Placeholders:
 * - {{festivalName}} - The name of the festival
 * - {{festivalDate}} - The date of the festival (if available)
 * - {{festivalLocation}} - The location of the festival (if available)
 */
const DEFAULT_PERPLEXITY_RESEARCH_PROMPT = `
Research the following festival and provide detailed information in a clean, highly readable markdown format:

Festival Name: {{festivalName}}
Date: {{festivalDate}}
Location: {{festivalLocation}}

Create your response following this EXACT structure and formatting:

# {{festivalName}}

> A concise one-line description of the festival (music type, cultural focus, etc.)

## KEY BUSINESS INFORMATION

- 📧 **Contact Email**: [contact email]
- 🏢 **Organization**: [company organizing the festival]
- 👤 **Decision Maker**: [founder/director/key decision maker name]
- 🌐 **Website**: [official website URL]
- 📞 **Phone**: [contact phone]
- 🎟️ **Ticketing Provider**: [ticketing platform used]

---

### Quick Facts

- **Festival Type**: [music/cultural/food/etc.]
- **Dates**: [specific event dates]
- **Location**: [venue, city, country]
- **Price Range**: [ticket price range]
- **Target Audience**: [demographic information]
- **Estimated Attendance**: [number of attendees]

### About

A 2-3 sentence overview of what the festival is and what attendees can expect.

### History

Brief information about when and how the festival started.

### Musical/Cultural Focus

- Key genres or cultural elements featured
- Notable past performers or participants
- What makes this festival unique

### Business Details

- Major sponsors
- Industry partnerships
- Revenue model

IMPORTANT FORMATTING INSTRUCTIONS:
1. Ensure the main title (festival name) is prominently displayed at the top
2. Make the KEY BUSINESS INFORMATION section clearly stand out and contain ONLY the essential contact details
3. Use emoji icons consistently in the KEY BUSINESS INFORMATION section
4. Maintain a clean hierarchy with clear headings
5. Use brief, concise bullet points rather than long paragraphs where possible
6. Include a horizontal rule (---) between the key information and the detailed sections
7. Format links properly as [text](url)
8. If information is not available, indicate with "Not available" rather than leaving blank
`;

/**
 * Make a request to Perplexity API with retry logic
 * 
 * @param {Object} payload - The request payload
 * @returns {Promise<Object>} - The API response
 */
async function makePerplexityRequest(payload) {
  let lastError;
  
  for (let attempt = 1; attempt <= PERPLEXITY_CONFIG.maxRetries; attempt++) {
    try {
      console.log(`Making Perplexity API request (attempt ${attempt}/${PERPLEXITY_CONFIG.maxRetries})`);
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), PERPLEXITY_CONFIG.timeout);
      
      const response = await fetch(`${PERPLEXITY_CONFIG.baseURL}/chat/completions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${PERPLEXITY_CONFIG.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Perplexity API error: ${response.status} ${response.statusText} - ${errorText}`);
      }
      
      const data = await response.json();
      return data;
    } catch (error) {
      lastError = error;
      console.error(`Perplexity API attempt ${attempt} failed:`, error);
      
      if (attempt < PERPLEXITY_CONFIG.maxRetries) {
        // Wait before retrying (exponential backoff)
        const waitTime = Math.pow(2, attempt) * 1000;
        console.log(`Waiting ${waitTime}ms before retry...`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }
    }
  }
  
  throw lastError;
}

/**
 * Generate festival research using Perplexity API
 * 
 * @param {Object|string} festivalData - Either festival name as string or object containing festival details
 * @param {string} customPrompt - Optional custom prompt template (uses default if not provided)
 * @returns {Promise<string>} - Markdown formatted research results
 */
export async function generateFestivalResearchWithPerplexity(festivalData, customPrompt = null) {
  try {
    // Convert string input to object if needed
    let festivalInfo = festivalData;
    if (typeof festivalData === 'string') {
      festivalInfo = {
        name: festivalData,
        date: 'Unknown',
        location: 'Unknown'
      };
    }
    
    // Use default prompt if no custom prompt is provided
    let promptTemplate = customPrompt || DEFAULT_PERPLEXITY_RESEARCH_PROMPT;
    
    // Replace placeholders with actual festival data
    const prompt = promptTemplate
      .replace(/\{\{festivalName\}\}/g, festivalInfo.name || 'Unknown')
      .replace(/\{\{festivalDate\}\}/g, festivalInfo.date || 'Unknown')
      .replace(/\{\{festivalLocation\}\}/g, festivalInfo.location || 'Unknown');
    
    console.log(`Generating research for festival: ${festivalInfo.name} using Perplexity API`);
    
    // Prepare the request payload for Perplexity
    const payload = {
      model: 'sonar-pro', // Use Perplexity's search-augmented model
      messages: [
        {
          role: 'system',
          content: 'You are a professional festival researcher who creates clear, structured business reports with real-time web information. Your primary goal is to highlight the most important business contact information prominently, with a focus on decision makers, contact emails, and organization details. Format your information with clean spacing, clear visual hierarchy, and excellent readability. Always follow the exact structure provided in the prompt without deviation. Use your web search capabilities to find the most current and accurate information.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.7, // Slightly creative but mostly factual
      max_tokens: 2000, // Generous token limit for comprehensive research
      // Perplexity-specific parameters for better search results
      search_recency_filter: 'month', // Focus on recent information
      return_related_questions: false,
      return_images: false
    };
    
    // Call Perplexity API
    const response = await makePerplexityRequest(payload);
    
    // Extract and return the research content
    if (response.choices && response.choices.length > 0) {
      const content = response.choices[0].message.content;
      
      // Add a note that this was generated by Perplexity
      const researchWithSource = content + '\n\n---\n*Research generated by Perplexity AI with real-time web search*';
      
      return researchWithSource;
    } else {
      throw new Error('No research content generated by Perplexity API');
    }
  } catch (error) {
    console.error('Error generating festival research with Perplexity:', error);
    throw error;
  }
}

/**
 * Simple test function to verify Perplexity API connectivity
 * @returns {Promise<boolean>} - Whether the API connection is working
 */
export async function testPerplexityConnection() {
  try {
    const payload = {
      model: 'sonar-pro',
      messages: [
        {
          role: 'user',
          content: 'Hello, this is a test message. Please respond with "Perplexity connection successful".'
        }
      ],
      max_tokens: 20,
    };
    
    const response = await makePerplexityRequest(payload);
    
    if (response.choices && response.choices.length > 0) {
      const content = response.choices[0].message.content;
      const isSuccessful = content.includes('Perplexity connection successful');
      
      console.log('Perplexity API test result:', isSuccessful ? 'Success' : 'Failed');
      return isSuccessful;
    }
    
    return false;
  } catch (error) {
    console.error('Perplexity connection test failed:', error);
    return false;
  }
}

export default { generateFestivalResearchWithPerplexity, testPerplexityConnection }; 