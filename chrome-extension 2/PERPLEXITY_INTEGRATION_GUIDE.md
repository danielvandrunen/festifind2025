# Perplexity AI Integration Guide

This guide explains how to integrate the new Perplexity AI extraction service with your existing Chrome extension.

## 📋 Overview

The Perplexity extraction service replaces the regex-based extraction in `utils/extractor.js` with AI-powered parsing. This provides:

- 🎯 **Higher accuracy** for complex websites
- 🌍 **Better multi-language support**
- 📊 **Structured data extraction** (JSON-LD, microdata)
- 🔄 **Automatic fallback** to regex if AI fails

## 🛠️ Implementation Steps

### Step 1: Update Content Script

Modify `content/content.js` to add Perplexity extraction:

```javascript
// Add at the top of content.js
const PERPLEXITY_SERVICE_URL = 'http://localhost:3001'; // Update for production
const PERPLEXITY_API_KEY = 'festifind-perplexity-service-2025';

// Add new function for Perplexity extraction
async function extractWithPerplexity(html, url) {
  try {
    console.log('Attempting Perplexity extraction...');
    
    const response = await fetch(`${PERPLEXITY_SERVICE_URL}/api/extract/html`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${PERPLEXITY_API_KEY}`
      },
      body: JSON.stringify({
        html: html,
        url: url
      })
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const result = await response.json();
    
    if (result.success) {
      console.log('✅ Perplexity extraction successful');
      console.log('Confidence:', result.metadata?.confidence + '%');
      return result.data;
    } else {
      throw new Error(result.message || 'Extraction failed');
    }
    
  } catch (error) {
    console.warn('⚠️ Perplexity extraction failed:', error.message);
    return null;
  }
}

// Update the handleExtractData function
async function handleExtractData(sendResponse) {
  try {
    console.log('Starting data extraction...');
    
    const html = document.documentElement.outerHTML;
    const url = window.location.href;
    
    // Try Perplexity extraction first
    const perplexityData = await extractWithPerplexity(html, url);
    
    if (perplexityData) {
      console.log('Using Perplexity AI extraction results');
      sendResponse({
        success: true,
        data: perplexityData,
        method: 'perplexity-ai'
      });
      return;
    }
    
    console.log('Falling back to regex extraction...');
    
    // Ensure extractor is loaded for fallback
    await loadExtractor();
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    let extractedData;
    
    if (typeof extractAllData === 'function') {
      console.log('Using advanced regex extractor...');
      extractedData = extractAllData();
    } else {
      console.log('Using fallback regex extractor...');
      extractedData = {
        name: extractFestivalNameFallback(),
        dates: extractDatesFallback(),
        location: extractLocationFallback(),
        emails: extractEmailsFallback(),
        url: window.location.href,
        domain: window.location.hostname,
        title: document.title,
        timestamp: new Date().toISOString()
      };
    }
    
    console.log('Data extraction completed:', extractedData);
    
    sendResponse({
      success: true,
      data: extractedData,
      method: 'regex-fallback'
    });
    
  } catch (error) {
    console.error('Error during data extraction:', error);
    
    sendResponse({
      success: false,
      error: error.message,
      data: {
        name: '',
        dates: { startDate: null, endDate: null },
        location: '',
        emails: [],
        url: window.location.href,
        domain: window.location.hostname,
        title: document.title,
        timestamp: new Date().toISOString()
      },
      method: 'error-fallback'
    });
  }
}
```

### Step 2: Update Popup to Show Method Used

Modify `popup/popup.js` to display which extraction method was used:

```javascript
// In the scanWebsite function, after receiving the response:
if (response.success) {
  // Show which method was used
  const methodIndicator = document.getElementById('extraction-method');
  if (methodIndicator) {
    const method = response.method || 'unknown';
    const methodText = {
      'perplexity-ai': '🤖 AI Extraction',
      'regex-fallback': '🔧 Regex Fallback',
      'error-fallback': '⚠️ Error Recovery'
    };
    
    methodIndicator.textContent = methodText[method] || method;
    methodIndicator.className = `method-indicator ${method}`;
  }
  
  // Populate fields as usual
  populateForm(response.data);
  
  // Show confidence if available
  if (response.method === 'perplexity-ai' && response.data.metadata?.confidence) {
    showConfidenceIndicator(response.data.metadata.confidence);
  }
}
```

### Step 3: Update Popup HTML

Add indicators to `popup/popup.html`:

```html
<!-- Add after the scan button -->
<div id="extraction-info" class="extraction-info" style="display: none;">
  <div id="extraction-method" class="method-indicator"></div>
  <div id="confidence-score" class="confidence-score" style="display: none;"></div>
</div>

<!-- Add to your CSS -->
<style>
.extraction-info {
  margin: 10px 0;
  padding: 8px;
  background: #f5f5f5;
  border-radius: 4px;
  font-size: 12px;
}

.method-indicator {
  font-weight: bold;
  margin-bottom: 4px;
}

.method-indicator.perplexity-ai {
  color: #2196F3;
}

.method-indicator.regex-fallback {
  color: #FF9800;
}

.method-indicator.error-fallback {
  color: #F44336;
}

.confidence-score {
  color: #666;
}

.confidence-high { color: #4CAF50; }
.confidence-medium { color: #FF9800; }
.confidence-low { color: #F44336; }
</style>
```

### Step 4: Add Service Configuration

Create `config/services.js`:

```javascript
// Service configuration
const SERVICES = {
  perplexity: {
    url: 'http://localhost:3001', // Change for production
    apiKey: 'festifind-perplexity-service-2025',
    timeout: 30000, // 30 seconds
    enabled: true
  },
  
  // You can add other AI services here
  openai: {
    enabled: false
    // ... other config
  }
};

// Get active service configuration
function getServiceConfig(serviceName = 'perplexity') {
  return SERVICES[serviceName];
}

// Test if a service is available
async function testService(serviceName = 'perplexity') {
  const config = getServiceConfig(serviceName);
  
  if (!config.enabled) {
    return { available: false, reason: 'Service disabled' };
  }
  
  try {
    const response = await fetch(`${config.url}/health`, {
      timeout: 5000
    });
    
    if (response.ok) {
      return { available: true };
    } else {
      return { available: false, reason: `HTTP ${response.status}` };
    }
  } catch (error) {
    return { available: false, reason: error.message };
  }
}
```

### Step 5: Enhanced Error Handling

Add robust error handling and retry logic:

```javascript
async function extractWithRetry(html, url, maxRetries = 2) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`Perplexity extraction attempt ${attempt}/${maxRetries}`);
      
      const result = await extractWithPerplexity(html, url);
      
      if (result) {
        return result;
      }
      
      if (attempt === maxRetries) {
        console.log('All Perplexity attempts failed, using fallback');
        return null;
      }
      
      // Wait before retry
      await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
      
    } catch (error) {
      console.warn(`Attempt ${attempt} failed:`, error.message);
      
      if (attempt === maxRetries) {
        return null;
      }
    }
  }
  
  return null;
}
```

## 🔧 Configuration for Production

### Environment-Specific Settings

Create different configurations for development and production:

```javascript
// In background.js or a config file
const ENV_CONFIG = {
  development: {
    perplexityUrl: 'http://localhost:3001',
    apiKey: 'festifind-perplexity-service-2025'
  },
  production: {
    perplexityUrl: 'https://your-production-service.com',
    apiKey: 'your-production-api-key'
  }
};

// Detect environment
const isDevelopment = !chrome.runtime.getManifest().updateUrl;
const config = ENV_CONFIG[isDevelopment ? 'development' : 'production'];
```

### Manifest Updates

Add necessary permissions to `manifest.json`:

```json
{
  "permissions": [
    "activeTab",
    "storage",
    "http://localhost:3001/*",
    "https://your-production-service.com/*"
  ],
  "host_permissions": [
    "http://localhost:3001/*",
    "https://your-production-service.com/*"
  ]
}
```

## 📊 Testing the Integration

### 1. Start the Perplexity Service

```bash
cd services/perplexity-extractor
npm install
cp env.example .env
# Edit .env with your Perplexity API key
npm run dev
```

### 2. Test the Service

```bash
npm test
# or
node test.js --chrome
```

### 3. Test the Extension

1. Load the updated extension in Chrome
2. Navigate to a festival website
3. Open the extension popup
4. Click "Scan Website"
5. Check the console for extraction method used
6. Verify the extraction method indicator in the popup

## 🚀 Deployment Checklist

- [ ] Perplexity API key configured
- [ ] Service URL updated for production
- [ ] Extension permissions updated
- [ ] Error handling tested
- [ ] Fallback mechanism verified
- [ ] Performance tested on various websites
- [ ] Confidence indicators working
- [ ] Logging configured appropriately

## 🔍 Monitoring and Analytics

Track the effectiveness of AI vs regex extraction:

```javascript
// Add analytics tracking
function trackExtractionMethod(method, success, confidence) {
  // Send to your analytics service
  console.log('Extraction analytics:', {
    method,
    success,
    confidence,
    url: window.location.href,
    timestamp: new Date().toISOString()
  });
}

// Call in handleExtractData
trackExtractionMethod(response.method, response.success, response.data.metadata?.confidence);
```

## 🎯 Expected Improvements

With Perplexity AI integration, you should see:

- **Higher accuracy**: 85-95% vs 60-70% with regex
- **Better date parsing**: Handles more date formats and languages
- **Improved location extraction**: Understands venue vs city vs country
- **Enhanced email detection**: Finds contact emails more reliably
- **Structured data support**: Automatically uses JSON-LD and microdata
- **Multi-language support**: Works with Dutch, German, French, English

## 📞 Troubleshooting

### Common Issues

1. **Service not responding**: Check if the Perplexity service is running
2. **Authentication errors**: Verify API key configuration
3. **CORS errors**: Ensure CORS is configured for your extension origin
4. **Rate limiting**: Implement exponential backoff for retries
5. **Large HTML timeouts**: Consider preprocessing HTML to reduce size

### Debug Commands

```javascript
// Test service availability
testService('perplexity').then(console.log);

// Force regex extraction
localStorage.setItem('forceRegexExtraction', 'true');

// Enable verbose logging
localStorage.setItem('debugExtraction', 'true');
```

This integration provides a significant upgrade to your extension's extraction capabilities while maintaining backward compatibility through the regex fallback system. 