// FestiFind Perplexity Service - Authentication Module
// Handles API key authentication for Perplexity endpoints

const VALID_API_KEYS = [
  'festifind-perplexity-service-2025',
  process.env.PERPLEXITY_SERVICE_API_KEY
].filter(Boolean);

/**
 * Authenticate incoming requests
 * @param {Object} req - Next.js request object
 * @returns {Object} Authentication result
 */
export function authenticateRequest(req) {
  try {
    // Handle both Express-style and Next.js App Router request objects
    const authHeader = req.headers?.get ? req.headers.get('authorization') : req.headers?.authorization;
    
    if (!authHeader) {
      return {
        success: false,
        error: 'Authorization header required'
      };
    }
    
    // Extract token from "Bearer TOKEN" format
    const token = authHeader.startsWith('Bearer ') 
      ? authHeader.slice(7) 
      : authHeader;
    
    if (!token) {
      return {
        success: false,
        error: 'API key required'
      };
    }
    
    // Check if token is valid
    const isValid = VALID_API_KEYS.includes(token);
    
    if (!isValid) {
      return {
        success: false,
        error: 'Invalid API key'
      };
    }
    
    return {
      success: true,
      apiKey: token
    };
    
  } catch (error) {
    console.error('Authentication error:', error);
    return {
      success: false,
      error: 'Authentication failed'
    };
  }
}

/**
 * Add a new valid API key (for dynamic key management)
 * @param {string} newKey - New API key to add
 */
export function addValidApiKey(newKey) {
  if (newKey && !VALID_API_KEYS.includes(newKey)) {
    VALID_API_KEYS.push(newKey);
  }
}

export default {
  authenticateRequest,
  addValidApiKey
}; 