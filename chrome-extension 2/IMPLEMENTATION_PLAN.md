# FestiFind Chrome Extension - Implementation Plan

## Overview

This document outlines the implementation plan for a Chrome extension that will allow users to scan websites for festival information (name, dates, location, emails) and save them directly to the FestiFind database via API.

## Core Requirements

- **Popup Interface**: Works on any website
- **Data Extraction**: Festival name, dates (start/end), location, emails (multiple)
- **Multi-language Support**: Dutch, German, English, French
- **API Integration**: Secure API endpoint with authentication
- **Editable Form**: Users can modify extracted data before saving
- **Notes Field**: Optional user notes

## Database Schema Changes Required

### 1. Add Emails Array Field
```sql
-- Add emails array field to festivals table
ALTER TABLE public.festivals ADD COLUMN IF NOT EXISTS emails TEXT[];

-- Create index for email searches
CREATE INDEX IF NOT EXISTS idx_festivals_emails ON public.festivals USING GIN(emails);
```

## API Development

### 1. Authentication System
Create API key authentication for Chrome extension access.

**File: `app/api/auth/extension/route.ts`**
```typescript
// API key validation endpoint
export async function POST(request: NextRequest) {
  const { apiKey } = await request.json();
  // Validate API key logic
}
```

### 2. Festival Creation Endpoint
**File: `app/api/festivals/create/route.ts`**
```typescript
export async function POST(request: NextRequest) {
  // Validate API key
  // Create new festival with emails array
  // Return created festival
}
```

## Chrome Extension Structure

```
chrome-extension/
├── manifest.json
├── popup/
│   ├── popup.html
│   ├── popup.css
│   └── popup.js
├── content/
│   └── content.js
├── background/
│   └── background.js
├── utils/
│   ├── extractor.js
│   ├── languages.js
│   └── api.js
└── assets/
    └── icons/
```

## Key Features Implementation

### 1. Data Extraction Engine (`utils/extractor.js`)

#### Festival Name Extraction
```javascript
function extractFestivalName() {
  // Priority order:
  // 1. Page title keywords
  // 2. H1/H2 headings with festival keywords
  // 3. Meta tags
  // 4. Schema.org markup
}
```

#### Date Extraction with Multi-language Support
```javascript
const DATE_PATTERNS = {
  dutch: [
    /(\d{1,2})\s+(januari|februari|maart|april|mei|juni|juli|augustus|september|oktober|november|december)\s+(\d{4})/gi,
    /(\d{1,2})-(\d{1,2})-(\d{4})/g
  ],
  german: [
    /(\d{1,2})\.\s*(Januar|Februar|März|April|Mai|Juni|Juli|August|September|Oktober|November|Dezember)\s+(\d{4})/gi
  ],
  english: [
    /(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2}),?\s+(\d{4})/gi
  ],
  french: [
    /(\d{1,2})\s+(janvier|février|mars|avril|mai|juin|juillet|août|septembre|octobre|novembre|décembre)\s+(\d{4})/gi
  ]
};
```

#### Location Extraction
```javascript
function extractLocation() {
  // Look for:
  // - Address patterns
  // - City, Country patterns
  // - Venue names
  // - Schema.org location markup
}
```

#### Email Extraction
```javascript
function extractEmails() {
  const emailRegex = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g;
  const pageText = document.body.innerText;
  const emails = [...new Set(pageText.match(emailRegex) || [])];
  return emails.filter(email => isValidEmail(email));
}
```

### 2. Popup Interface (`popup/popup.html`)

```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { width: 400px; padding: 20px; }
    .form-group { margin-bottom: 15px; }
    .btn-scan { background: #007cba; color: white; }
    .btn-save { background: #28a745; color: white; }
    .extracted-data { background: #f8f9fa; padding: 10px; margin: 10px 0; }
    .email-list { max-height: 100px; overflow-y: auto; }
  </style>
</head>
<body>
  <div class="container">
    <h2>FestiFind Scanner</h2>
    
    <button id="scanBtn" class="btn btn-scan">🔍 Scan Website</button>
    
    <div id="extractedData" class="extracted-data" style="display: none;">
      <h3>Extracted Information</h3>
      
      <div class="form-group">
        <label>Festival Name:</label>
        <input type="text" id="festivalName" placeholder="Enter festival name">
      </div>
      
      <div class="form-group">
        <label>Start Date:</label>
        <input type="date" id="startDate">
      </div>
      
      <div class="form-group">
        <label>End Date:</label>
        <input type="date" id="endDate">
      </div>
      
      <div class="form-group">
        <label>Location:</label>
        <input type="text" id="location" placeholder="City, Country">
      </div>
      
      <div class="form-group">
        <label>Emails Found:</label>
        <div id="emailList" class="email-list"></div>
      </div>
      
      <div class="form-group">
        <label>Notes:</label>
        <textarea id="notes" rows="3"></textarea>
      </div>
      
      <button id="saveBtn" class="btn btn-save">💾 Save to FestiFind</button>
    </div>
    
    <div id="status"></div>
  </div>
  
  <script src="popup.js"></script>
</body>
</html>
```

### 3. Content Script (`content/content.js`)

```javascript
// Listen for messages from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'extractData') {
    const extractedData = {
      name: extractFestivalName(),
      dates: extractDates(),
      location: extractLocation(),
      emails: extractEmails(),
      url: window.location.href
    };
    sendResponse(extractedData);
  }
});
```

### 4. API Communication (`utils/api.js`)

```javascript
const API_BASE_URL = 'https://your-festifind-app.com/api';
const API_KEY = 'your-extension-api-key'; // Store securely

async function saveFestival(festivalData) {
  try {
    const response = await fetch(`${API_BASE_URL}/festivals/create`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_KEY}`
      },
      body: JSON.stringify({
        name: festivalData.name,
        start_date: festivalData.startDate,
        end_date: festivalData.endDate,
        location: festivalData.location,
        emails: festivalData.emails,
        notes: festivalData.notes,
        url: festivalData.url,
        source: 'chrome-extension'
      })
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error saving festival:', error);
    throw error;
  }
}
```

## Implementation Steps

### Phase 1: Database & API Setup
1. ✅ Add emails array field to festivals table
2. ✅ Create API key authentication system
3. ✅ Implement festival creation endpoint with authentication
4. ✅ Test API endpoints

### Phase 2: Chrome Extension Core
1. ✅ Create manifest.json with required permissions
2. ✅ Implement basic popup interface
3. ✅ Create content script for data extraction
4. ✅ Implement background script for API communication

### Phase 3: Data Extraction Engine
1. ✅ Festival name detection algorithms
2. ✅ Multi-language date extraction
3. ✅ Location extraction patterns
4. ✅ Email extraction and validation
5. ✅ Language detection for better accuracy

### Phase 4: User Interface
1. ✅ Responsive popup design
2. ✅ Editable form fields
3. ✅ Email management (add/remove)
4. ✅ Success/error status messages
5. ✅ Loading states

### Phase 5: Testing & Optimization
1. ✅ Test on various festival websites
2. ✅ Optimize extraction accuracy
3. ✅ Error handling and edge cases
4. ✅ Performance optimization
5. ✅ Multi-language testing

### Phase 6: Security & Distribution
1. ✅ Secure API key storage
2. ✅ Input validation and sanitization
3. ✅ Chrome Web Store preparation
4. ✅ Documentation and user guide

## Technical Considerations

### Security
- API key stored in chrome.storage.sync (encrypted)
- Input sanitization for all extracted data
- HTTPS-only API communication
- Rate limiting on API endpoints

### Performance
- Lazy loading of extraction algorithms
- Debounced extraction to avoid excessive processing
- Minimal DOM manipulation
- Efficient regex patterns

### Usability
- Clear visual feedback during scanning
- Intuitive form editing
- Helpful error messages
- Quick access via browser toolbar

### Browser Compatibility
- Chrome Manifest V3 compliance
- Modern JavaScript features with fallbacks
- Responsive design for different screen sizes

## File Structure Details

### `manifest.json`
```json
{
  "manifest_version": 3,
  "name": "FestiFind Scanner",
  "version": "1.0",
  "description": "Extract festival information from websites",
  "permissions": [
    "activeTab",
    "storage"
  ],
  "action": {
    "default_popup": "popup/popup.html",
    "default_title": "FestiFind Scanner"
  },
  "content_scripts": [{
    "matches": ["<all_urls>"],
    "js": ["content/content.js"]
  }],
  "background": {
    "service_worker": "background/background.js"
  }
}
```

## Next Steps

1. **Review this plan** and provide feedback
2. **Database migration** - Add emails field
3. **API development** - Create secure endpoints
4. **Extension development** - Build core functionality
5. **Testing phase** - Test on real festival websites
6. **Deployment** - Chrome Web Store submission

This implementation plan provides a solid foundation for building a robust Chrome extension that integrates seamlessly with the existing FestiFind application while providing powerful festival data extraction capabilities across multiple languages and websites. 