const { JSDOM } = require('jsdom');
const TurndownService = require('turndown');
const logger = require('../config/logger');

class HTMLProcessor {
  constructor() {
    this.turndownService = new TurndownService({
      headingStyle: 'atx',
      codeBlockStyle: 'fenced',
      bulletListMarker: '-',
      emDelimiter: '_'
    });
    
    // Configure turndown to preserve important elements
    this.turndownService.addRule('preserveImportantAttributes', {
      filter: ['time', 'span', 'div'],
      replacement: function(content, node) {
        // Preserve datetime attributes and data attributes that might contain event info
        const attrs = [];
        if (node.getAttribute('datetime')) {
          attrs.push(`datetime="${node.getAttribute('datetime')}"`);
        }
        if (node.getAttribute('data-date')) {
          attrs.push(`data-date="${node.getAttribute('data-date')}"`);
        }
        if (node.getAttribute('data-time')) {
          attrs.push(`data-time="${node.getAttribute('data-time')}"`);
        }
        if (node.getAttribute('data-location')) {
          attrs.push(`data-location="${node.getAttribute('data-location')}"`);
        }
        
        if (attrs.length > 0) {
          return `${content} [${attrs.join(' ')}]`;
        }
        return content;
      }
    });
  }

  /**
   * Process HTML content and extract relevant information for event parsing
   * @param {string} html - Raw HTML content
   * @param {string} url - Source URL for context
   * @returns {Object} Processed data ready for Perplexity AI
   */
  processHTML(html, url) {
    try {
      logger.info('Processing HTML', { url, htmlLength: html.length });
      
      const dom = new JSDOM(html);
      const document = dom.window.document;
      
      // Extract structured data first
      const structuredData = this.extractStructuredData(document);
      
      // Find the main content area
      const mainContent = this.findMainContent(document);
      
      // Convert to markdown
      const markdown = this.convertToMarkdown(mainContent);
      
      // Extract metadata
      const metadata = this.extractMetadata(document);
      
      // Extract relevant links for crawling
      const relevantLinks = this.extractRelevantLinks(document, url);
      
      return {
        url,
        markdown,
        structuredData,
        metadata,
        relevantLinks,
        stats: {
          originalLength: html.length,
          markdownLength: markdown.length,
          compressionRatio: (1 - markdown.length / html.length).toFixed(2)
        }
      };
      
    } catch (error) {
      logger.error('Error processing HTML', { error: error.message, url });
      throw new Error(`HTML processing failed: ${error.message}`);
    }
  }

  /**
   * Find the main content area of the page
   */
  findMainContent(document) {
    // Priority order for content selection
    const selectors = [
      'main',
      '[role="main"]',
      '.main-content',
      '.content',
      '.event-details',
      '.festival-info',
      '.event-info',
      '.page-content',
      'article',
      '.post-content',
      '#content',
      '#main',
      'body'
    ];

    for (const selector of selectors) {
      const element = document.querySelector(selector);
      if (element && this.hasSignificantContent(element)) {
        logger.debug('Selected main content using selector', { selector });
        return element;
      }
    }

    // Fallback to body but remove navigation, header, footer
    const body = document.body;
    this.removeNonContentElements(body);
    return body;
  }

  /**
   * Check if element has significant content
   */
  hasSignificantContent(element) {
    const text = element.textContent.trim();
    return text.length > 100 && 
           !this.isNavigationElement(element) &&
           !this.isHeaderFooterElement(element);
  }

  /**
   * Remove navigation, header, footer elements
   */
  removeNonContentElements(element) {
    const removeSelectors = [
      'nav',
      'header',
      'footer',
      '.navigation',
      '.nav',
      '.header',
      '.footer',
      '.sidebar',
      '.menu',
      '.breadcrumb',
      '.social-share',
      '.comments',
      '.related-posts',
      '.advertisement',
      '.ads',
      'script',
      'style',
      'noscript'
    ];

    removeSelectors.forEach(selector => {
      const elements = element.querySelectorAll(selector);
      elements.forEach(el => el.remove());
    });
  }

  /**
   * Check if element is navigation
   */
  isNavigationElement(element) {
    const navKeywords = ['nav', 'menu', 'navigation', 'breadcrumb'];
    const className = element.className.toLowerCase();
    const id = element.id.toLowerCase();
    
    return navKeywords.some(keyword => 
      className.includes(keyword) || id.includes(keyword)
    );
  }

  /**
   * Check if element is header/footer
   */
  isHeaderFooterElement(element) {
    const keywords = ['header', 'footer'];
    const className = element.className.toLowerCase();
    const id = element.id.toLowerCase();
    
    return keywords.some(keyword => 
      className.includes(keyword) || id.includes(keyword)
    );
  }

  /**
   * Convert HTML to markdown
   */
  convertToMarkdown(element) {
    const html = element.innerHTML;
    const markdown = this.turndownService.turndown(html);
    
    // Clean up the markdown
    return this.cleanMarkdown(markdown);
  }

  /**
   * Clean and optimize markdown for AI processing
   */
  cleanMarkdown(markdown) {
    return markdown
      // Remove excessive whitespace
      .replace(/\n{3,}/g, '\n\n')
      // Remove empty links
      .replace(/\[]\(\)/g, '')
      // Remove excessive spaces
      .replace(/[ ]{2,}/g, ' ')
      // Trim each line
      .split('\n')
      .map(line => line.trim())
      .join('\n')
      .trim();
  }

  /**
   * Extract structured data (JSON-LD, microdata, etc.)
   */
  extractStructuredData(document) {
    const structuredData = {};

    // JSON-LD
    const jsonLdScripts = document.querySelectorAll('script[type="application/ld+json"]');
    const jsonLdData = [];
    jsonLdScripts.forEach(script => {
      try {
        const data = JSON.parse(script.textContent);
        jsonLdData.push(data);
      } catch (error) {
        logger.debug('Failed to parse JSON-LD', { error: error.message });
      }
    });
    if (jsonLdData.length > 0) {
      structuredData.jsonLd = jsonLdData;
    }

    // Microdata
    const microdataEvents = document.querySelectorAll('[itemtype*="Event"]');
    if (microdataEvents.length > 0) {
      structuredData.microdata = this.extractMicrodata(microdataEvents);
    }

    return structuredData;
  }

  /**
   * Extract microdata from elements
   */
  extractMicrodata(elements) {
    return Array.from(elements).map(element => {
      const data = {
        type: element.getAttribute('itemtype')
      };

      const props = element.querySelectorAll('[itemprop]');
      props.forEach(prop => {
        const name = prop.getAttribute('itemprop');
        const value = prop.getAttribute('content') || 
                     prop.getAttribute('datetime') || 
                     prop.textContent.trim();
        data[name] = value;
      });

      return data;
    });
  }

  /**
   * Extract page metadata
   */
  extractMetadata(document) {
    const metadata = {};

    // Basic metadata
    metadata.title = document.title;
    metadata.url = document.location?.href;

    // Meta tags
    const metaTags = {
      'description': 'meta[name="description"]',
      'keywords': 'meta[name="keywords"]',
      'ogTitle': 'meta[property="og:title"]',
      'ogDescription': 'meta[property="og:description"]',
      'ogType': 'meta[property="og:type"]',
      'ogUrl': 'meta[property="og:url"]',
      'twitterTitle': 'meta[name="twitter:title"]',
      'twitterDescription': 'meta[name="twitter:description"]'
    };

    Object.entries(metaTags).forEach(([key, selector]) => {
      const element = document.querySelector(selector);
      if (element) {
        metadata[key] = element.getAttribute('content');
      }
    });

    return metadata;
  }

  /**
   * Extract relevant links for crawling (Contact, FAQ, Privacy, etc.)
   */
  extractRelevantLinks(document, baseUrl) {
    const relevantKeywords = {
      en: ['contact', 'about', 'faq', 'privacy', 'policy', 'info', 'team', 'staff', 'organizer', 'booking', 'press', 'media'],
      nl: ['contact', 'over', 'faq', 'privacy', 'beleid', 'info', 'team', 'personeel', 'organisatie', 'boeken', 'pers', 'media'],
      de: ['kontakt', 'über', 'faq', 'datenschutz', 'impressum', 'info', 'team', 'personal', 'organisation', 'buchung', 'presse', 'medien'],
      fr: ['contact', 'propos', 'faq', 'confidentialité', 'politique', 'info', 'équipe', 'personnel', 'organisation', 'réservation', 'presse', 'médias']
    };

    const links = [];
    const allKeywords = Object.values(relevantKeywords).flat();
    
    // Get all links on the page
    const anchorElements = document.querySelectorAll('a[href]');
    
    anchorElements.forEach(anchor => {
      const href = anchor.getAttribute('href');
      const text = anchor.textContent.toLowerCase().trim();
      const title = anchor.getAttribute('title')?.toLowerCase() || '';
      
      if (!href || href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:')) {
        return;
      }
      
      // Check if link text or title contains relevant keywords
      const isRelevant = allKeywords.some(keyword => 
        text.includes(keyword) || title.includes(keyword) || href.toLowerCase().includes(keyword)
      );
      
      if (isRelevant) {
        try {
          // Convert relative URLs to absolute
          const absoluteUrl = new URL(href, baseUrl).href;
          
          // Skip external domains (optional - you might want to allow some)
          const baseHost = new URL(baseUrl).hostname;
          const linkHost = new URL(absoluteUrl).hostname;
          
          // Only include same domain or subdomains
          if (linkHost === baseHost || linkHost.endsWith('.' + baseHost)) {
            links.push({
              url: absoluteUrl,
              text: anchor.textContent.trim(),
              title: anchor.getAttribute('title') || '',
              keywords: allKeywords.filter(keyword => 
                text.includes(keyword) || title.includes(keyword) || href.toLowerCase().includes(keyword)
              )
            });
          }
        } catch (error) {
          logger.debug('Invalid URL found', { href, error: error.message });
        }
      }
    });
    
    // Remove duplicates and limit to most relevant
    const uniqueLinks = links.filter((link, index, self) => 
      index === self.findIndex(l => l.url === link.url)
    );
    
    // Sort by relevance (more keywords = higher priority)
    uniqueLinks.sort((a, b) => b.keywords.length - a.keywords.length);
    
    // Limit to top 5 most relevant links to avoid overwhelming the system
    return uniqueLinks.slice(0, 5);
  }

  /**
   * Calculate content statistics
   */
  calculateStats(original, processed) {
    return {
      originalSize: original.length,
      processedSize: processed.length,
      compressionRatio: ((original.length - processed.length) / original.length * 100).toFixed(2),
      estimatedTokens: Math.ceil(processed.length / 4) // Rough estimation
    };
  }
}

module.exports = HTMLProcessor; 