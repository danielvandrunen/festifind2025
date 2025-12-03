// FestiFind AI Client - Perplexity Extraction for Vercel
// This module handles interaction with Perplexity AI for intelligent event data extraction

/**
 * Extract event information using Perplexity AI
 * @param {string} content - Processed HTML/Markdown content
 * @param {string} url - Source URL for context
 * @returns {Promise<Object>} Extracted event data
 */
export async function extractWithPerplexity(content, url = null) {
  try {
    console.log('🤖 Starting Perplexity AI extraction...');
    console.log(`📄 Content length: ${content.length} characters`);
    console.log(`🌐 Source URL: ${url || 'N/A'}`);
    
    const prompt = createExtractionPrompt(content, url);
    
    console.log('🚀 Sending request to Perplexity AI...');
    const startTime = Date.now();
    
    const requestBody = {
      model: 'sonar', // Cost-effective model with real-time search
      messages: [
        {
          role: 'system',
          content: `You are FestiFind AI, an expert at extracting event and festival information from web content. 

CRITICAL INSTRUCTIONS:
1. You MUST respond with ONLY valid JSON - no explanations, no markdown, no additional text
2. Extract festival/event information with high accuracy
3. Focus on festivals, concerts, music events, cultural events, and similar gatherings
4. If no clear event is found, return null values but maintain JSON structure
5. Always provide confidence scores for your extractions
6. Support multiple languages: Dutch, German, English, French

RESPONSE FORMAT (JSON only):
{
  "name": "Festival/Event Name or null",
  "dates": {
    "startDate": "YYYY-MM-DD or null",
    "endDate": "YYYY-MM-DD or null"
  },
  "location": "City, Country or venue name or null", 
  "emails": ["email1@domain.com", "email2@domain.com"] or [],
  "confidence": 85,
  "extraction_details": {
    "name_confidence": 90,
    "dates_confidence": 80,
    "location_confidence": 85,
    "emails_confidence": 70
  }
}`
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.1, // Low temperature for consistent extractions
      max_tokens: 1000,
      stream: false
    };

    // Check if API key is available
    const apiKey = process.env.PERPLEXITY_API_KEY || process.env.PPLX_API_KEY;
    if (!apiKey) {
      throw new Error('Perplexity API key not found in environment variables (PERPLEXITY_API_KEY or PPLX_API_KEY)');
    }

    console.log('🔑 Using API key:', apiKey.substring(0, 10) + '...');

    // Use fetch instead of OpenAI SDK for Vercel compatibility
    const response = await fetch('https://api.perplexity.ai/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'User-Agent': 'FestiFind/1.0 (+https://festifind2025.vercel.app)'
      },
      body: JSON.stringify(requestBody)
    });

    console.log(`📡 Response status: ${response.status} ${response.statusText}`);
    console.log(`📡 Response headers:`, Object.fromEntries(response.headers.entries()));

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Perplexity API error response:', errorText);
      
      // Provide more specific error messages
      let errorMessage;
      switch (response.status) {
        case 401:
          errorMessage = 'Authentication failed - invalid API key';
          break;
        case 403:
          errorMessage = 'Access forbidden - check API permissions or account status';
          break;
        case 429:
          errorMessage = 'Rate limit exceeded - please try again later';
          break;
        case 500:
          errorMessage = 'Perplexity service internal error';
          break;
        default:
          errorMessage = `Perplexity API error ${response.status}: ${response.statusText}`;
      }
      
      throw new Error(`${errorMessage} - ${errorText}`);
    }

    const completion = await response.json();
    const duration = Math.round((Date.now() - startTime) / 1000);
    console.log(`⏱️ Perplexity API responded in ${duration} seconds`);
    
    const aiResponse = completion.choices?.[0]?.message?.content;
    
    if (!aiResponse) {
      throw new Error('Empty response from Perplexity AI');
    }

    console.log('📝 Raw AI response:', aiResponse);
    
    // Parse JSON response
    let extractedData;
    try {
      // Clean the response in case there's extra text
      const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
      const jsonString = jsonMatch ? jsonMatch[0] : aiResponse;
      extractedData = JSON.parse(jsonString);
    } catch (parseError) {
      console.error('❌ Failed to parse AI response as JSON:', parseError);
      throw new Error(`Invalid JSON response from AI: ${parseError.message}`);
    }

    // Validate and enhance the extracted data
    const processedData = processExtractionResult(extractedData, url);
    
    console.log('✅ Perplexity extraction successful');
    console.log('📊 Processed data:', processedData);
    
    return {
      success: true,
      data: processedData.data,
      metadata: {
        confidence: processedData.confidence,
        extraction_method: 'perplexity-ai',
        api_response_time: duration,
        model_used: 'sonar',
        source_url: url,
        content_length: content.length,
        timestamp: new Date().toISOString(),
        stats: {
          name_confidence: processedData.details?.name_confidence || 0,
          dates_confidence: processedData.details?.dates_confidence || 0,
          location_confidence: processedData.details?.location_confidence || 0,
          emails_confidence: processedData.details?.emails_confidence || 0
        }
      }
    };
    
  } catch (error) {
    console.error('❌ Perplexity extraction failed:', error);
    
    // Return structured error
    return {
      success: false,
      error: error.message,
      metadata: {
        extraction_method: 'perplexity-ai',
        error_type: error.constructor.name,
        source_url: url,
        timestamp: new Date().toISOString()
      }
    };
  }
}

/**
 * Create extraction prompt for Perplexity AI
 * @param {string} content - Content to analyze
 * @param {string} url - Source URL
 * @returns {string} Formatted prompt
 */
function createExtractionPrompt(content, url) {
  const sourceInfo = url ? `\nSource URL: ${url}` : '';
  
  return `Extract festival/event information from this web content. Look for:
- Festival or event name
- Start and end dates (convert to YYYY-MM-DD format)
- Location (city, venue, country)
- Contact email addresses
- Return confidence scores for each field

Respond with ONLY JSON in the exact format specified.${sourceInfo}

CONTENT TO ANALYZE:
${content}`;
}

/**
 * Process and validate extraction results
 * @param {Object} rawData - Raw extraction data from AI
 * @param {string} url - Source URL
 * @returns {Object} Processed extraction result
 */
function processExtractionResult(rawData, url) {
  try {
    // Initialize default structure
    const defaultData = {
      name: null,
      dates: {
        startDate: null,
        endDate: null
      },
      location: null,
      emails: [],
      url: url || null
    };

    // Merge with extracted data
    const data = {
      ...defaultData,
      ...rawData,
      dates: {
        ...defaultData.dates,
        ...rawData.dates
      }
    };

    // Clean and validate data
    if (data.name && typeof data.name === 'string') {
      data.name = data.name.trim();
      if (data.name.toLowerCase() === 'null' || data.name === '') {
        data.name = null;
      }
    }

    if (data.location && typeof data.location === 'string') {
      data.location = data.location.trim();
      if (data.location.toLowerCase() === 'null' || data.location === '') {
        data.location = null;
      }
    }

    // Validate dates
    if (data.dates.startDate && typeof data.dates.startDate === 'string') {
      data.dates.startDate = validateDate(data.dates.startDate);
    }
    if (data.dates.endDate && typeof data.dates.endDate === 'string') {
      data.dates.endDate = validateDate(data.dates.endDate);
    }

    // Validate emails
    if (Array.isArray(data.emails)) {
      data.emails = data.emails
        .filter(email => typeof email === 'string' && isValidEmail(email))
        .map(email => email.trim().toLowerCase());
    } else {
      data.emails = [];
    }

    // Calculate overall confidence
    const details = rawData.extraction_details || {};
    const confidence = rawData.confidence || calculateConfidence(data, details);

    return {
      data,
      confidence: Math.max(0, Math.min(100, confidence)), // Clamp between 0-100
      details
    };

  } catch (error) {
    console.error('Error processing extraction result:', error);
    return {
      data: {
        name: null,
        dates: { startDate: null, endDate: null },
        location: null,
        emails: [],
        url: url || null
      },
      confidence: 0,
      details: {}
    };
  }
}

/**
 * Validate date string
 * @param {string} dateStr - Date string to validate
 * @returns {string|null} Valid date string or null
 */
function validateDate(dateStr) {
  if (!dateStr || typeof dateStr !== 'string') return null;
  
  const cleaned = dateStr.trim();
  if (cleaned.toLowerCase() === 'null' || cleaned === '') return null;
  
  // Check if it's already in YYYY-MM-DD format
  const isoRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (isoRegex.test(cleaned)) {
    const date = new Date(cleaned + 'T00:00:00Z');
    if (!isNaN(date.getTime())) {
      return cleaned;
    }
  }
  
  return null;
}

/**
 * Validate email address
 * @param {string} email - Email to validate
 * @returns {boolean} True if valid email
 */
function isValidEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Calculate confidence score based on extracted data
 * @param {Object} data - Extracted data
 * @param {Object} details - Confidence details
 * @returns {number} Overall confidence score
 */
function calculateConfidence(data, details) {
  let score = 0;
  let factors = 0;

  // Name confidence (30% weight)
  if (data.name) {
    score += (details.name_confidence || 70) * 0.3;
    factors += 0.3;
  }

  // Dates confidence (25% weight)
  if (data.dates.startDate || data.dates.endDate) {
    score += (details.dates_confidence || 60) * 0.25;
    factors += 0.25;
  }

  // Location confidence (20% weight)
  if (data.location) {
    score += (details.location_confidence || 50) * 0.2;
    factors += 0.2;
  }

  // Emails confidence (15% weight)
  if (data.emails.length > 0) {
    score += (details.emails_confidence || 40) * 0.15;
    factors += 0.15;
  }

  // General content confidence (10% weight)
  score += 50 * 0.1; // Base confidence for having some content
  factors += 0.1;

  return factors > 0 ? Math.round(score / factors) : 0;
}

export default {
  extractWithPerplexity
}; 