const { OpenAI } = require('openai');
const logger = require('../config/logger');
const LinkCrawler = require('./link-crawler');

class PerplexityClient {
  constructor() {
    this.client = new OpenAI({
      apiKey: process.env.PERPLEXITY_API_KEY,
      baseURL: process.env.PERPLEXITY_BASE_URL || 'https://api.perplexity.ai'
    });
    
    this.defaultModel = process.env.DEFAULT_MODEL || 'sonar-pro';
    this.maxTokens = parseInt(process.env.MAX_TOKENS) || 2000;
    this.temperature = parseFloat(process.env.TEMPERATURE) || 0.1;
    this.linkCrawler = new LinkCrawler();
    
    logger.info('PerplexityClient initialized', {
      model: this.defaultModel,
      maxTokens: this.maxTokens,
      temperature: this.temperature
    });
  }

  /**
   * Extract event information from processed HTML content
   * @param {Object} processedData - Processed HTML data from HTMLProcessor
   * @returns {Object} Extracted event information
   */
  async extractEventData(processedData) {
    try {
      logger.info('Starting event extraction', { 
        url: processedData.url,
        markdownLength: processedData.markdown.length,
        relevantLinksFound: processedData.relevantLinks?.length || 0
      });

      // Step 1: Extract from main page
      const prompt = this.buildExtractionPrompt(processedData);
      
      const response = await this.client.chat.completions.create({
        model: this.defaultModel,
        messages: prompt,
        max_tokens: this.maxTokens,
        temperature: this.temperature
      });

      const extractedData = this.parseResponse(response);
      
      // Step 2: Crawl additional pages for more emails if relevant links found
      let additionalEmails = [];
      if (processedData.relevantLinks && processedData.relevantLinks.length > 0) {
        try {
          logger.info('Starting link crawling for additional emails', { 
            url: processedData.url,
            linkCount: processedData.relevantLinks.length 
          });
          
          const crawledPages = await this.linkCrawler.crawlLinks(
            processedData.relevantLinks, 
            processedData.url
          );
          
          if (crawledPages.length > 0) {
            // Extract emails from crawled pages using both regex and AI
            additionalEmails = await this.extractEmailsFromCrawledPages(crawledPages);
            
            logger.info('Link crawling completed', {
              url: processedData.url,
              crawledPages: crawledPages.length,
              additionalEmails: additionalEmails.length
            });
          }
        } catch (crawlError) {
          logger.warn('Link crawling failed, continuing with main page results', {
            url: processedData.url,
            error: crawlError.message
          });
        }
      }
      
      // Step 3: Combine emails from main page and crawled pages
      const allEmails = this.combineEmails(extractedData.emails || [], additionalEmails);
      extractedData.emails = allEmails;
      
      // Step 4: Enhance with additional data from structured sources
      const enhancedData = this.enhanceWithStructuredData(extractedData, processedData);
      
      logger.info('Event extraction completed', {
        url: processedData.url,
        success: true,
        eventName: enhancedData.name,
        totalEmails: enhancedData.emails.length,
        crawledPages: processedData.relevantLinks?.length || 0
      });

      return enhancedData;

    } catch (error) {
      logger.error('Event extraction failed', {
        url: processedData.url,
        error: error.message,
        stack: error.stack
      });
      throw new Error(`Event extraction failed: ${error.message}`);
    }
  }

  /**
   * Build the extraction prompt for Perplexity AI
   */
  buildExtractionPrompt(processedData) {
    const systemPrompt = `You are an expert event data extractor specializing in festivals, concerts, and cultural events. 
Your task is to extract structured event information from website content.

IMPORTANT INSTRUCTIONS:
1. Extract data ONLY from the provided content
2. Return valid JSON format only
3. Be precise with dates - use ISO format (YYYY-MM-DD) when possible
4. If information is not found or unclear, use null or empty values
5. Focus on the primary event, ignore secondary or related events
6. For locations, extract both venue name and city/address if available
7. COMPREHENSIVE EMAIL EXTRACTION: Search thoroughly for ALL email addresses including:
   - General contact emails (info@, contact@, hello@)
   - Specific department emails (booking@, press@, media@, tickets@, sales@)
   - Personal emails of organizers/staff
   - Email addresses in footer, contact sections, about pages
   - Email addresses mentioned in text content
   - Email addresses in mailto: links
   - Email addresses in any language (English, Dutch, German, French)
8. Include ALL unique email addresses found, even if they seem secondary`;

    const userPrompt = `Extract event information from the following website content and return it in JSON format.

SPECIAL FOCUS ON EMAIL ADDRESSES:
- Search the ENTIRE content thoroughly for all email addresses
- Look in contact sections, footers, about pages, and inline text
- Common email patterns: info@, contact@, booking@, press@, media@, tickets@, sales@, hello@, support@
- Include organizer emails, venue emails, and any business emails related to the event
- Do NOT miss emails that appear in different languages or contexts
- Return ALL unique emails found, prioritizing event-specific ones first

REQUIRED JSON STRUCTURE:
{
  "name": "Event/Festival name",
  "startDate": "YYYY-MM-DD or null",
  "endDate": "YYYY-MM-DD or null", 
  "location": {
    "venue": "Venue name or null",
    "city": "City name or null",
    "address": "Full address or null",
    "country": "Country or null"
  },
  "emails": ["primary@example.com", "booking@example.com", "info@example.com"],
  "description": "Brief event description or null",
  "website": "Event website URL or null",
  "ticketInfo": {
    "ticketUrl": "Ticket purchase URL or null",
    "price": "Price information or null"
  },
  "organizer": "Event organizer name or null",
  "category": "Event category (festival, concert, etc.) or null",
  "additionalInfo": {
    "socialMedia": ["social media URLs"],
    "phone": "Contact phone number or null",
    "lineup": ["artist names if this is a music event"],
    "genres": ["music genres if applicable"]
  }
}

WEBSITE CONTENT TO ANALYZE:

URL: ${processedData.url}
Page Title: ${processedData.metadata?.title || 'Not available'}

${processedData.structuredData?.jsonLd ? 
  `STRUCTURED DATA (JSON-LD):\n${JSON.stringify(processedData.structuredData.jsonLd, null, 2)}\n\n` : 
  ''
}

${processedData.structuredData?.microdata ? 
  `MICRODATA:\n${JSON.stringify(processedData.structuredData.microdata, null, 2)}\n\n` : 
  ''
}

MAIN CONTENT (MARKDOWN):
${processedData.markdown}

Extract the event information and return ONLY the JSON object.`;

    return [
      {
        role: "system",
        content: systemPrompt
      },
      {
        role: "user", 
        content: userPrompt
      }
    ];
  }

  /**
   * Parse the response from Perplexity AI
   */
  parseResponse(response) {
    try {
      const content = response.choices[0].message.content;
      
      // Try to parse as JSON directly
      try {
        return JSON.parse(content);
      } catch (jsonError) {
        // If direct parsing fails, try to extract JSON from markdown code blocks
        const jsonMatch = content.match(/```json\s*(\{[\s\S]*?\})\s*```/);
        if (jsonMatch) {
          return JSON.parse(jsonMatch[1]);
        }
        
        // Try to find JSON object in the response
        const objectMatch = content.match(/\{[\s\S]*\}/);
        if (objectMatch) {
          return JSON.parse(objectMatch[0]);
        }
        
        throw new Error('No valid JSON found in response');
      }
    } catch (error) {
      logger.error('Failed to parse Perplexity response', { error: error.message });
      // Return default structure if parsing fails
      return this.getDefaultEventStructure();
    }
  }

  /**
   * Enhance extracted data with information from structured data sources
   */
  enhanceWithStructuredData(extractedData, processedData) {
    // Start with extracted data
    const enhanced = { ...extractedData };
    
    // Enhance with JSON-LD data
    if (processedData.structuredData?.jsonLd) {
      for (const data of processedData.structuredData.jsonLd) {
        if (data['@type'] === 'Event' || data.type === 'Event') {
          // Enhance event name
          if (!enhanced.name && data.name) {
            enhanced.name = data.name;
          }
          
          // Enhance dates
          if (!enhanced.startDate && data.startDate) {
            enhanced.startDate = this.formatDate(data.startDate);
          }
          if (!enhanced.endDate && data.endDate) {
            enhanced.endDate = this.formatDate(data.endDate);
          }
          
          // Enhance location
          if (data.location) {
            if (typeof data.location === 'string') {
              enhanced.location = enhanced.location || {};
              enhanced.location.venue = enhanced.location.venue || data.location;
            } else if (typeof data.location === 'object') {
              enhanced.location = {
                venue: enhanced.location?.venue || data.location.name,
                address: enhanced.location?.address || data.location.address,
                city: enhanced.location?.city || data.location.addressLocality,
                country: enhanced.location?.country || data.location.addressCountry
              };
            }
          }
          
          // Enhance description
          if (!enhanced.description && data.description) {
            enhanced.description = data.description;
          }
          
          // Enhance organizer
          if (!enhanced.organizer && data.organizer) {
            enhanced.organizer = typeof data.organizer === 'string' ? 
              data.organizer : data.organizer.name;
          }
        }
      }
    }
    
    // Enhance with microdata
    if (processedData.structuredData?.microdata) {
      for (const data of processedData.structuredData.microdata) {
        if (data.type && data.type.includes('Event')) {
          if (!enhanced.name && data.name) {
            enhanced.name = data.name;
          }
          if (!enhanced.startDate && data.startDate) {
            enhanced.startDate = this.formatDate(data.startDate);
          }
          if (!enhanced.endDate && data.endDate) {
            enhanced.endDate = this.formatDate(data.endDate);
          }
        }
      }
    }
    
    // Add metadata
    enhanced.metadata = {
      sourceUrl: processedData.url,
      extractedAt: new Date().toISOString(),
      method: 'perplexity-ai',
      confidence: this.calculateConfidence(enhanced),
      stats: processedData.stats
    };
    
    return enhanced;
  }

  /**
   * Format date string to ISO format
   */
  formatDate(dateString) {
    if (!dateString) return null;
    
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return null;
      
      return date.toISOString().split('T')[0]; // Return YYYY-MM-DD format
    } catch (error) {
      logger.debug('Date formatting failed', { dateString, error: error.message });
      return null;
    }
  }

  /**
   * Calculate confidence score based on extracted data completeness
   */
  calculateConfidence(data) {
    let score = 0;
    const weights = {
      name: 25,
      startDate: 20,
      location: 20,
      emails: 20,  // Increased weight for email extraction
      description: 10,
      organizer: 5
    };
    
    Object.entries(weights).forEach(([field, weight]) => {
      if (field === 'location') {
        if (data.location && (data.location.venue || data.location.city)) {
          score += weight;
        }
      } else if (field === 'emails') {
        if (data.emails && data.emails.length > 0) {
          score += weight;
          // Bonus points for multiple emails (up to 10 extra points)
          if (data.emails.length > 1) {
            score += Math.min(data.emails.length - 1, 2) * 5;
          }
        }
      } else if (data[field]) {
        score += weight;
      }
    });
    
    return Math.min(score, 100); // Cap at 100%
  }

  /**
   * Get default event structure for fallback
   */
  getDefaultEventStructure() {
    return {
      name: null,
      startDate: null,
      endDate: null,
      location: {
        venue: null,
        city: null,
        address: null,
        country: null
      },
      emails: [],
      description: null,
      website: null,
      ticketInfo: {
        ticketUrl: null,
        price: null
      },
      organizer: null,
      category: null,
      additionalInfo: {
        socialMedia: [],
        phone: null,
        lineup: [],
        genres: []
      }
    };
  }

  /**
   * Extract emails from crawled pages using AI analysis
   * @param {Array} crawledPages - Array of processed page data
   * @returns {Array} Array of extracted email addresses
   */
  async extractEmailsFromCrawledPages(crawledPages) {
    const allEmails = new Set();
    
    // First, use regex extraction from the link crawler
    const regexEmails = this.linkCrawler.extractEmailsFromCrawledPages(crawledPages);
    regexEmails.forEach(email => allEmails.add(email));
    
    // Then, use AI extraction for more sophisticated parsing
    for (const page of crawledPages) {
      if (!page || !page.markdown) continue;
      
      try {
        const emailPrompt = this.buildEmailExtractionPrompt(page);
        
        const response = await this.client.chat.completions.create({
          model: this.defaultModel,
          messages: emailPrompt,
          max_tokens: 500,
          temperature: 0.1
        });
        
        const aiEmails = this.parseEmailResponse(response);
        aiEmails.forEach(email => allEmails.add(email.toLowerCase()));
        
      } catch (error) {
        logger.debug('AI email extraction failed for crawled page', { 
          url: page.url, 
          error: error.message 
        });
      }
    }
    
    return Array.from(allEmails);
  }

  /**
   * Build prompt for email extraction from crawled pages
   * @param {Object} page - Processed page data
   * @returns {Array} Chat messages for AI
   */
  buildEmailExtractionPrompt(page) {
    const systemPrompt = `You are an expert email extractor. Extract ALL valid email addresses from the provided content.

INSTRUCTIONS:
1. Find ALL email addresses in the content
2. Include contact emails, booking emails, staff emails, etc.
3. Exclude generic/spam emails (noreply@, no-reply@, etc.)
4. Return as JSON array: ["email1@domain.com", "email2@domain.com"]
5. Return empty array if no valid emails found`;

    const userPrompt = `Extract all email addresses from this ${page.linkContext?.sourceKeywords?.join(', ') || 'contact'} page:

URL: ${page.url}
Link Context: ${page.linkContext?.linkText || ''} (${page.linkContext?.sourceKeywords?.join(', ') || ''})

CONTENT:
${page.markdown.substring(0, 2000)}

Return ONLY a JSON array of email addresses.`;

    return [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt }
    ];
  }

  /**
   * Parse email extraction response from AI
   * @param {Object} response - AI response
   * @returns {Array} Array of email addresses
   */
  parseEmailResponse(response) {
    try {
      const content = response.choices[0].message.content;
      
      // Try to parse as JSON array
      let emails = JSON.parse(content);
      
      if (!Array.isArray(emails)) {
        emails = [];
      }
      
      // Validate and filter emails
      return emails.filter(email => 
        typeof email === 'string' && 
        this.linkCrawler.isValidEmail(email) && 
        !this.linkCrawler.isGenericEmail(email)
      );
      
    } catch (error) {
      logger.debug('Failed to parse email extraction response', { error: error.message });
      return [];
    }
  }

  /**
   * Combine and deduplicate emails from different sources
   * @param {Array} mainEmails - Emails from main page
   * @param {Array} additionalEmails - Emails from crawled pages
   * @returns {Array} Combined unique emails
   */
  combineEmails(mainEmails, additionalEmails) {
    const allEmails = new Set();
    
    // Add main page emails first (higher priority)
    (mainEmails || []).forEach(email => {
      if (typeof email === 'string' && email.trim()) {
        allEmails.add(email.toLowerCase().trim());
      }
    });
    
    // Add additional emails from crawled pages
    (additionalEmails || []).forEach(email => {
      if (typeof email === 'string' && email.trim()) {
        allEmails.add(email.toLowerCase().trim());
      }
    });
    
    return Array.from(allEmails);
  }

  /**
   * Test the connection to Perplexity AI
   */
  async testConnection() {
    try {
      const response = await this.client.chat.completions.create({
        model: this.defaultModel,
        messages: [
          {
            role: "user",
            content: "Hello, please respond with a simple JSON object containing 'status': 'ok'"
          }
        ],
        max_tokens: 50,
        temperature: 0
      });
      
      logger.info('Perplexity connection test successful');
      return { success: true, response: response.choices[0].message.content };
      
    } catch (error) {
      logger.error('Perplexity connection test failed', { error: error.message });
      return { success: false, error: error.message };
    }
  }
}

module.exports = PerplexityClient; 