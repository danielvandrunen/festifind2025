/**
 * OpenAI client utility for FestiFind
 * Used for the festival research feature
 */

import OpenAI from 'openai';

// Lazy initialization to avoid build-time errors when OPENAI_API_KEY is not set
let _openai = null;

function getOpenAIClient() {
  if (!_openai) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error('OPENAI_API_KEY environment variable is not set');
    }
    _openai = new OpenAI({
      apiKey,
      maxRetries: 2,
      timeout: 60 * 1000, // 60 seconds timeout
    });
  }
  return _openai;
}

/**
 * Default research prompt template for festival research
 * Placeholders:
 * - {{festivalName}} - The name of the festival
 * - {{festivalDate}} - The date of the festival (if available)
 * - {{festivalLocation}} - The location of the festival (if available)
 */
const DEFAULT_RESEARCH_PROMPT = `
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
 * Generate festival research using OpenAI's GPT-4o model
 * 
 * @param {Object|string} festivalData - Either festival name as string or object containing festival details
 * @param {string} customPrompt - Optional custom prompt template (uses default if not provided)
 * @returns {Promise<string>} - Markdown formatted research results
 */
export async function generateFestivalResearch(festivalData, customPrompt = null) {
  const openai = getOpenAIClient();
  
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
    let promptTemplate = customPrompt || DEFAULT_RESEARCH_PROMPT;
    
    // Replace placeholders with actual festival data
    const prompt = promptTemplate
      .replace(/\{\{festivalName\}\}/g, festivalInfo.name || 'Unknown')
      .replace(/\{\{festivalDate\}\}/g, festivalInfo.date || 'Unknown')
      .replace(/\{\{festivalLocation\}\}/g, festivalInfo.location || 'Unknown');
    
    console.log(`Generating research for festival: ${festivalInfo.name}`);
    
    // Call OpenAI API with GPT-4o model
    const response = await openai.chat.completions.create({
      model: 'gpt-4o', // Using GPT-4o as specified in the plan
      messages: [
        {
          role: 'system',
          content: 'You are a professional festival researcher who creates clear, structured business reports. Your primary goal is to highlight the most important business contact information prominently, with a focus on decision makers, contact emails, and organization details. Format your information with clean spacing, clear visual hierarchy, and excellent readability. Always follow the exact structure provided in the prompt without deviation.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.7, // Slightly creative but mostly factual
      max_tokens: 2000, // Generous token limit for comprehensive research
    });
    
    // Extract and return the research content
    if (response.choices && response.choices.length > 0) {
      return response.choices[0].message.content;
    } else {
      throw new Error('No research content generated by OpenAI');
    }
  } catch (error) {
    console.error('Error generating festival research:', error);
    throw error;
  }
}

/**
 * Simple test function to verify OpenAI API connectivity
 * @returns {Promise<boolean>} - Whether the API connection is working
 */
export async function testOpenAIConnection() {
  try {
    const openai = getOpenAIClient();
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'user',
          content: 'Hello, this is a test message. Please respond with "OpenAI connection successful".'
        }
      ],
      max_tokens: 20,
    });
    
    if (response.choices && response.choices.length > 0) {
      const content = response.choices[0].message.content;
      const isSuccessful = content.includes('OpenAI connection successful');
      
      console.log('OpenAI API test result:', isSuccessful ? 'Success' : 'Failed');
      return isSuccessful;
    }
    
    return false;
  } catch (error) {
    console.error('OpenAI connection test failed:', error);
    return false;
  }
}

// Export a getter instead of direct instance to enable lazy initialization
export const openai = { get: getOpenAIClient };
export default { get: getOpenAIClient };
