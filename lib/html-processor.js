// FestiFind Perplexity Service - HTML Processing Module
// Converts HTML to clean Markdown for cost-optimized AI processing

import TurndownService from 'turndown';
import { JSDOM } from 'jsdom';

// Configure Turndown for optimal conversion
const turndownService = new TurndownService({
  headingStyle: 'atx',
  hr: '---',
  bulletListMarker: '-',
  codeBlockStyle: 'fenced',
  fence: '```',
  emDelimiter: '*',
  strongDelimiter: '**',
  linkStyle: 'inlined',
  linkReferenceStyle: 'full'
});

// Remove unnecessary elements that don't help with event extraction
turndownService.remove([
  'script',
  'style', 
  'nav',
  'footer',
  'header',
  'aside',
  'iframe',
  'form',
  'input',
  'button',
  'select',
  'textarea',
  'canvas',
  'svg',
  'noscript'
]);

/**
 * Process HTML content to optimize for AI extraction
 * @param {string} html - Raw HTML content
 * @returns {string} Processed content optimized for AI
 */
export function processHTML(html) {
  try {
    if (!html || typeof html !== 'string') {
      throw new Error('Invalid HTML input');
    }

    console.log(`📄 Starting HTML processing (${html.length} chars)`);
    
    // Parse HTML with JSDOM
    const dom = new JSDOM(html);
    const document = dom.window.document;
    
    // Remove problematic elements
    const elementsToRemove = [
      'script', 'style', 'nav', 'footer', 'header', 'aside', 
      'iframe', 'form', 'input', 'button', 'select', 'textarea',
      'canvas', 'svg', 'noscript', '.cookie', '.gdpr', '.popup'
    ];
    
    elementsToRemove.forEach(selector => {
      const elements = document.querySelectorAll(selector);
      elements.forEach(el => el.remove());
    });

    // Look for structured data (JSON-LD, microdata)
    let structuredData = '';
    
    // Extract JSON-LD
    const jsonLdScripts = document.querySelectorAll('script[type="application/ld+json"]');
    jsonLdScripts.forEach(script => {
      try {
        const data = JSON.parse(script.textContent);
        if (data['@type'] && (data['@type'].includes('Event') || data['@type'].includes('Festival'))) {
          structuredData += `\n\n**Structured Event Data:**\n${JSON.stringify(data, null, 2)}\n`;
        }
      } catch (e) {
        // Ignore invalid JSON-LD
      }
    });

    // Extract microdata
    const microdataEvents = document.querySelectorAll('[itemtype*="Event"]');
    if (microdataEvents.length > 0) {
      structuredData += '\n\n**Microdata Event Information:**\n';
      microdataEvents.forEach((event, index) => {
        structuredData += `Event ${index + 1}:\n`;
        const props = event.querySelectorAll('[itemprop]');
        props.forEach(prop => {
          const name = prop.getAttribute('itemprop');
          const value = prop.textContent.trim();
          if (value) {
            structuredData += `- ${name}: ${value}\n`;
          }
        });
      });
    }

    // Get the cleaned HTML
    const cleanedHtml = document.documentElement.outerHTML;
    
    // Convert to Markdown
    let markdown = turndownService.turndown(cleanedHtml);
    
    // Clean up the markdown
    markdown = markdown
      // Remove excessive newlines
      .replace(/\n{3,}/g, '\n\n')
      // Remove empty list items
      .replace(/^[-*+]\s*$/gm, '')
      // Remove excessive spaces
      .replace(/ {2,}/g, ' ')
      // Clean up headers
      .replace(/^#{7,}/gm, '######')
      // Remove empty sections
      .replace(/#{1,6}\s*\n\n/g, '')
      .trim();

    // Add structured data if found
    if (structuredData) {
      markdown = structuredData + '\n\n' + markdown;
    }

    // Limit length if too long (Perplexity has context limits)
    const maxLength = 50000; // Conservative limit
    if (markdown.length > maxLength) {
      console.log(`⚠️ Content too long (${markdown.length} chars), truncating to ${maxLength}`);
      markdown = markdown.substring(0, maxLength) + '\n\n[Content truncated for AI processing]';
    }

    const reductionPercent = Math.round((1 - markdown.length / html.length) * 100);
    console.log(`✅ HTML processed: ${markdown.length} chars (${reductionPercent}% reduction)`);
    
    return markdown;
    
  } catch (error) {
    console.error('❌ HTML processing error:', error);
    // Fallback: return cleaned text content
    try {
      const dom = new JSDOM(html);
      const textContent = dom.window.document.body?.textContent || html;
      return textContent.replace(/\s+/g, ' ').trim();
    } catch (fallbackError) {
      console.error('❌ Fallback processing failed:', fallbackError);
      return html; // Last resort: return original
    }
  }
}

/**
 * Extract text content only (fallback method)
 * @param {string} html - HTML content
 * @returns {string} Plain text content
 */
export function extractTextContent(html) {
  try {
    const dom = new JSDOM(html);
    const document = dom.window.document;
    
    // Remove script and style elements
    const elementsToRemove = document.querySelectorAll('script, style, nav, footer, header');
    elementsToRemove.forEach(el => el.remove());
    
    return document.body?.textContent?.replace(/\s+/g, ' ').trim() || '';
  } catch (error) {
    console.error('Text extraction error:', error);
    return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  }
}

export default {
  processHTML,
  extractTextContent
}; 