const express = require('express');
const { RateLimiterMemory } = require('rate-limiter-flexible');
const HTMLProcessor = require('../lib/html-processor');
const PerplexityClient = require('../lib/perplexity-client');
const logger = require('../config/logger');

const router = express.Router();

// Initialize processors
const htmlProcessor = new HTMLProcessor();
const perplexityClient = new PerplexityClient();

// Rate limiting
const rateLimiter = new RateLimiterMemory({
  keyGenerator: (req) => req.ip,
  points: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
  duration: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 60, // Per 60 seconds
});

/**
 * Rate limiting middleware
 */
async function rateLimitMiddleware(req, res, next) {
  try {
    await rateLimiter.consume(req.ip);
    next();
  } catch (rejRes) {
    const totalHits = rejRes.totalPoints;
    const remainingPoints = rejRes.remainingPoints || 0;
    const msBeforeNext = rejRes.msBeforeNext || 1000;

    logger.warn('Rate limit exceeded', {
      ip: req.ip,
      totalHits,
      remainingPoints,
      msBeforeNext
    });

    res.status(429).json({
      success: false,
      error: 'Rate limit exceeded',
      message: `Too many requests. Try again in ${Math.round(msBeforeNext / 1000)} seconds.`,
      retryAfter: Math.round(msBeforeNext / 1000)
    });
  }
}

/**
 * POST /extract/url - Extract event data from a URL
 */
router.post('/url', rateLimitMiddleware, async (req, res) => {
  try {
    const { url, html } = req.body;

    if (!url) {
      return res.status(400).json({
        success: false,
        error: 'Missing required parameter',
        message: 'URL is required'
      });
    }

    logger.info('Processing URL extraction request', { url });

    let htmlContent = html;

    // If HTML is not provided, we would need to fetch it
    // For security reasons, we'll require HTML to be provided by the client
    if (!htmlContent) {
      return res.status(400).json({
        success: false,
        error: 'Missing HTML content',
        message: 'HTML content must be provided for security reasons'
      });
    }

    // Process HTML content
    const processedData = htmlProcessor.processHTML(htmlContent, url);
    
    // Extract event data using Perplexity AI
    const extractedData = await perplexityClient.extractEventData(processedData);

    // Transform to match existing extension format
    const extensionFormat = transformToExtensionFormat(extractedData);

    logger.info('Extraction completed successfully', {
      url,
      eventName: extractedData.name,
      confidence: extractedData.metadata?.confidence
    });

    res.json({
      success: true,
      data: extensionFormat,
      metadata: {
        confidence: extractedData.metadata?.confidence,
        method: 'perplexity-ai',
        extractedAt: extractedData.metadata?.extractedAt,
        stats: extractedData.metadata?.stats
      }
    });

  } catch (error) {
    logger.error('URL extraction failed', {
      url: req.body.url,
      error: error.message,
      stack: error.stack
    });

    res.status(500).json({
      success: false,
      error: 'Extraction failed',
      message: error.message
    });
  }
});

/**
 * POST /extract/html - Extract event data from raw HTML
 */
router.post('/html', rateLimitMiddleware, async (req, res) => {
  try {
    const { html, url } = req.body;

    if (!html) {
      return res.status(400).json({
        success: false,
        error: 'Missing required parameter',
        message: 'HTML content is required'
      });
    }

    const sourceUrl = url || 'unknown';
    logger.info('Processing HTML extraction request', { 
      sourceUrl,
      htmlLength: html.length 
    });

    // Process HTML content
    const processedData = htmlProcessor.processHTML(html, sourceUrl);
    
    // Extract event data using Perplexity AI
    const extractedData = await perplexityClient.extractEventData(processedData);

    // Transform to match existing extension format
    const extensionFormat = transformToExtensionFormat(extractedData);

    logger.info('HTML extraction completed successfully', {
      sourceUrl,
      eventName: extractedData.name,
      confidence: extractedData.metadata?.confidence
    });

    res.json({
      success: true,
      data: extensionFormat,
      metadata: {
        confidence: extractedData.metadata?.confidence,
        method: 'perplexity-ai',
        extractedAt: extractedData.metadata?.extractedAt,
        stats: extractedData.metadata?.stats
      }
    });

  } catch (error) {
    logger.error('HTML extraction failed', {
      error: error.message,
      stack: error.stack
    });

    res.status(500).json({
      success: false,
      error: 'Extraction failed',
      message: error.message
    });
  }
});

/**
 * GET /test - Test the service and Perplexity connection
 */
router.get('/test', async (req, res) => {
  try {
    // Test Perplexity connection
    const connectionTest = await perplexityClient.testConnection();
    
    if (!connectionTest.success) {
      return res.status(503).json({
        success: false,
        error: 'Perplexity connection failed',
        message: connectionTest.error
      });
    }

    res.json({
      success: true,
      message: 'Perplexity extraction service is operational',
      service: 'festifind-perplexity-extractor',
      version: '1.0.0',
      timestamp: new Date().toISOString(),
      perplexity: {
        connected: true,
        model: process.env.DEFAULT_MODEL || 'sonar-pro'
      }
    });

  } catch (error) {
    logger.error('Service test failed', { error: error.message });
    
    res.status(503).json({
      success: false,
      error: 'Service test failed',
      message: error.message
    });
  }
});

/**
 * Transform Perplexity AI output to match the existing extension format
 */
function transformToExtensionFormat(extractedData) {
  // Create location string from structured location data
  let locationString = '';
  if (extractedData.location) {
    const parts = [];
    if (extractedData.location.venue) parts.push(extractedData.location.venue);
    if (extractedData.location.city) parts.push(extractedData.location.city);
    if (extractedData.location.country && extractedData.location.country !== extractedData.location.city) {
      parts.push(extractedData.location.country);
    }
    locationString = parts.join(', ');
  }

  // Format dates to match extension expectations
  const dates = {
    startDate: extractedData.startDate || null,
    endDate: extractedData.endDate || extractedData.startDate || null
  };

  return {
    name: extractedData.name || '',
    dates: dates,
    location: locationString,
    emails: extractedData.emails || [],
    url: extractedData.metadata?.sourceUrl || extractedData.website || '',
    domain: extractedData.metadata?.sourceUrl ? 
      new URL(extractedData.metadata.sourceUrl).hostname : '',
    title: extractedData.name || '',
    timestamp: new Date().toISOString(),
    
    // Additional data that might be useful
    description: extractedData.description,
    organizer: extractedData.organizer,
    category: extractedData.category,
    ticketInfo: extractedData.ticketInfo,
    additionalInfo: extractedData.additionalInfo,
    
    // Structured location data for advanced use
    structuredLocation: extractedData.location
  };
}

/**
 * Validation middleware for extraction requests
 */
function validateExtractionRequest(req, res, next) {
  const { html, url } = req.body;
  
  if (!html && !url) {
    return res.status(400).json({
      success: false,
      error: 'Missing required parameters',
      message: 'Either HTML content or URL must be provided'
    });
  }
  
  if (html && typeof html !== 'string') {
    return res.status(400).json({
      success: false,
      error: 'Invalid HTML parameter',
      message: 'HTML must be a string'
    });
  }
  
  if (url && typeof url !== 'string') {
    return res.status(400).json({
      success: false,
      error: 'Invalid URL parameter',
      message: 'URL must be a string'
    });
  }
  
  next();
}

// Apply validation to extraction routes
router.use('/url', validateExtractionRequest);
router.use('/html', validateExtractionRequest);

module.exports = router; 