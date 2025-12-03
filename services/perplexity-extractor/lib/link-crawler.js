const fetch = require('node-fetch');
const logger = require('../config/logger');
const HTMLProcessor = require('./html-processor');

class LinkCrawler {
  constructor() {
    this.htmlProcessor = new HTMLProcessor();
    this.timeout = 10000; // 10 seconds per page
    this.maxConcurrent = 3; // Maximum concurrent requests
    this.userAgent = 'FestiFind-Crawler/1.0 (Festival Information Extractor)';
  }

  /**
   * Crawl relevant links and extract content
   * @param {Array} links - Array of link objects from HTML processor
   * @param {string} baseUrl - Base URL for context
   * @returns {Array} Array of processed page data
   */
  async crawlLinks(links, baseUrl) {
    if (!links || links.length === 0) {
      logger.info('No relevant links found for crawling', { baseUrl });
      return [];
    }

    logger.info('Starting link crawling', { 
      baseUrl, 
      linkCount: links.length,
      links: links.map(l => ({ url: l.url, keywords: l.keywords }))
    });

    const results = [];
    
    // Process links in batches to respect rate limits
    for (let i = 0; i < links.length; i += this.maxConcurrent) {
      const batch = links.slice(i, i + this.maxConcurrent);
      const batchPromises = batch.map(link => this.crawlSingleLink(link));
      
      const batchResults = await Promise.allSettled(batchPromises);
      
      batchResults.forEach((result, index) => {
        if (result.status === 'fulfilled' && result.value) {
          results.push(result.value);
        } else {
          logger.warn('Failed to crawl link', { 
            url: batch[index].url, 
            error: result.reason?.message 
          });
        }
      });
      
      // Small delay between batches to be respectful
      if (i + this.maxConcurrent < links.length) {
        await this.delay(1000);
      }
    }

    logger.info('Link crawling completed', { 
      baseUrl, 
      successful: results.length, 
      failed: links.length - results.length 
    });

    return results;
  }

  /**
   * Crawl a single link and extract its content
   * @param {Object} link - Link object with url, text, keywords
   * @returns {Object|null} Processed page data or null if failed
   */
  async crawlSingleLink(link) {
    try {
      logger.debug('Crawling link', { url: link.url, keywords: link.keywords });

      const response = await fetch(link.url, {
        headers: {
          'User-Agent': this.userAgent,
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en,nl,de,fr;q=0.9',
          'Accept-Encoding': 'gzip, deflate',
          'DNT': '1',
          'Connection': 'keep-alive',
          'Upgrade-Insecure-Requests': '1'
        },
        follow: 5, // Follow up to 5 redirects
        timeout: this.timeout
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const contentType = response.headers.get('content-type') || '';
      if (!contentType.includes('text/html')) {
        throw new Error(`Non-HTML content type: ${contentType}`);
      }

      const html = await response.text();
      
      if (html.length < 100) {
        throw new Error('Page content too short, likely empty or error page');
      }

      // Process the HTML content
      const processedData = this.htmlProcessor.processHTML(html, link.url);
      
      // Add link context
      processedData.linkContext = {
        sourceKeywords: link.keywords,
        linkText: link.text,
        linkTitle: link.title
      };

      logger.debug('Successfully crawled link', { 
        url: link.url, 
        contentLength: html.length,
        markdownLength: processedData.markdown.length
      });

      return processedData;

    } catch (error) {
      if (error.name === 'FetchError' && error.code === 'ETIMEDOUT') {
        logger.warn('Link crawling timed out', { url: link.url });
      } else {
        logger.warn('Error crawling link', { 
          url: link.url, 
          error: error.message 
        });
      }
      
      return null;
    }
  }

  /**
   * Delay execution for specified milliseconds
   * @param {number} ms - Milliseconds to delay
   * @returns {Promise} Promise that resolves after delay
   */
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Extract emails from crawled page content
   * @param {Array} crawledPages - Array of processed page data
   * @returns {Array} Array of unique email addresses found
   */
  extractEmailsFromCrawledPages(crawledPages) {
    const emails = new Set();
    
    crawledPages.forEach(page => {
      if (!page || !page.markdown) return;
      
      // Enhanced email regex pattern
      const emailRegex = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g;
      const foundEmails = page.markdown.match(emailRegex) || [];
      
      foundEmails.forEach(email => {
        // Clean and validate email
        const cleanEmail = email.toLowerCase().trim();
        if (this.isValidEmail(cleanEmail) && !this.isGenericEmail(cleanEmail)) {
          emails.add(cleanEmail);
        }
      });
    });
    
    return Array.from(emails);
  }

  /**
   * Validate email format
   * @param {string} email - Email to validate
   * @returns {boolean} True if valid email format
   */
  isValidEmail(email) {
    const emailRegex = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}$/;
    return emailRegex.test(email) && email.length <= 254;
  }

  /**
   * Check if email is too generic to be useful
   * @param {string} email - Email to check
   * @returns {boolean} True if email is too generic
   */
  isGenericEmail(email) {
    const genericPatterns = [
      'noreply@',
      'no-reply@',
      'donotreply@',
      'admin@example.',
      'test@',
      'example@',
      '@example.com',
      '@test.com',
      '@localhost'
    ];
    
    return genericPatterns.some(pattern => email.includes(pattern));
  }
}

module.exports = LinkCrawler; 