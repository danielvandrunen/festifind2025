const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
require('dotenv').config();

const logger = require('./config/logger');
const { 
  authenticate, 
  corsMiddleware, 
  requestLogger, 
  errorHandler, 
  notFoundHandler 
} = require('./middleware/auth');
const extractRoutes = require('./routes/extract');

const app = express();
const PORT = process.env.PORT || 3001;

// Security middleware
app.use(helmet());

// CORS configuration
app.use(corsMiddleware);

// Request parsing
app.use(express.json({ limit: '10mb' })); // Increased limit for HTML content
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request logging
app.use(requestLogger);

// Health check endpoint (no auth required)
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'festifind-perplexity-extractor',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// API routes with authentication
app.use('/api/extract', authenticate, extractRoutes);

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    service: 'FestiFind Perplexity Extractor',
    version: '1.0.0',
    description: 'AI-powered event data extraction service using Perplexity AI',
    endpoints: {
      health: 'GET /health',
      test: 'GET /api/extract/test',
      extractFromUrl: 'POST /api/extract/url',
      extractFromHtml: 'POST /api/extract/html'
    },
    documentation: 'https://github.com/your-repo/festifind-extractor',
    timestamp: new Date().toISOString()
  });
});

// Error handling
app.use(notFoundHandler);
app.use(errorHandler);

// Graceful shutdown handling
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  logger.info('SIGINT received, shutting down gracefully');
  process.exit(0);
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  logger.error('Uncaught exception', { error: error.message, stack: error.stack });
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled rejection', { reason, promise });
  process.exit(1);
});

// Start server
app.listen(PORT, () => {
  logger.info('Server started successfully', {
    port: PORT,
    environment: process.env.NODE_ENV || 'development',
    timestamp: new Date().toISOString()
  });
  
  // Log configuration
  logger.info('Service configuration', {
    perplexityModel: process.env.DEFAULT_MODEL || 'sonar-pro',
    maxTokens: process.env.MAX_TOKENS || '2000',
    rateLimit: `${process.env.RATE_LIMIT_MAX_REQUESTS || 100} requests per ${process.env.RATE_LIMIT_WINDOW_MS || 60}s`,
    logLevel: process.env.LOG_LEVEL || 'info'
  });
});

module.exports = app; 