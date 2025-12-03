const logger = require('../config/logger');

/**
 * Simple API key authentication middleware
 */
function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;
  const apiKey = req.headers['x-api-key'];
  
  const providedKey = authHeader?.replace('Bearer ', '') || apiKey;
  const expectedKey = process.env.API_KEY;
  
  if (!providedKey) {
    logger.warn('Authentication failed: No API key provided', {
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      path: req.path
    });
    
    return res.status(401).json({
      success: false,
      error: 'Authentication required',
      message: 'Please provide an API key via Authorization header or x-api-key header'
    });
  }
  
  if (providedKey !== expectedKey) {
    logger.warn('Authentication failed: Invalid API key', {
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      path: req.path,
      providedKey: providedKey.substring(0, 8) + '...' // Log partial key for debugging
    });
    
    return res.status(401).json({
      success: false,
      error: 'Invalid API key',
      message: 'The provided API key is not valid'
    });
  }
  
  logger.debug('Authentication successful', {
    ip: req.ip,
    path: req.path
  });
  
  next();
}

/**
 * CORS middleware specifically for the extraction service
 */
function corsMiddleware(req, res, next) {
  const allowedOrigins = process.env.ALLOWED_ORIGINS 
    ? process.env.ALLOWED_ORIGINS.split(',')
    : ['http://localhost:3000'];
  
  const origin = req.headers.origin;
  
  // Allow Chrome extension origins, localhost origins, HTTPS origins, and null origins (local files)
  const isChromeExtension = origin && origin.startsWith('chrome-extension://');
  const isLocalhost = origin && (origin.includes('localhost') || origin.includes('127.0.0.1'));
  const isHttps = origin && origin.startsWith('https://');
  const isAllowedOrigin = allowedOrigins.includes(origin);
  const isNullOrigin = origin === 'null' || !origin;
  
  if (isAllowedOrigin || isChromeExtension || isLocalhost || isHttps || isNullOrigin) {
    res.header('Access-Control-Allow-Origin', origin || '*');
  }
  
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization, x-api-key');
  res.header('Access-Control-Allow-Credentials', true);
  
  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
  } else {
    next();
  }
}

/**
 * Request logging middleware
 */
function requestLogger(req, res, next) {
  const start = Date.now();
  
  // Log the request
  logger.info('Incoming request', {
    method: req.method,
    path: req.path,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    contentLength: req.get('Content-Length'),
    timestamp: new Date().toISOString()
  });
  
  // Log the response when it finishes
  res.on('finish', () => {
    const duration = Date.now() - start;
    logger.info('Request completed', {
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      duration: `${duration}ms`,
      ip: req.ip
    });
  });
  
  next();
}

/**
 * Error handling middleware
 */
function errorHandler(err, req, res, next) {
  logger.error('Unhandled error', {
    error: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method,
    ip: req.ip
  });
  
  // Don't expose internal errors in production
  const isDevelopment = process.env.NODE_ENV === 'development';
  
  res.status(500).json({
    success: false,
    error: 'Internal server error',
    message: isDevelopment ? err.message : 'An unexpected error occurred',
    ...(isDevelopment && { stack: err.stack })
  });
}

/**
 * 404 handler
 */
function notFoundHandler(req, res) {
  logger.warn('Route not found', {
    path: req.path,
    method: req.method,
    ip: req.ip
  });
  
  res.status(404).json({
    success: false,
    error: 'Not found',
    message: `Route ${req.method} ${req.path} not found`
  });
}

module.exports = {
  authenticate,
  corsMiddleware,
  requestLogger,
  errorHandler,
  notFoundHandler
}; 