# FestiFind Chrome Extension

A powerful Chrome extension that automatically extracts festival information from websites and saves it to your FestiFind database.

## Features

- 🔍 **Smart Data Extraction**: Automatically detects festival names, dates, locations, and email addresses
- 🌍 **Multi-language Support**: Works with Dutch, German, English, and French websites
- ✉️ **Email Collection**: Finds and validates contact email addresses
- ✏️ **Editable Forms**: Review and modify extracted data before saving
- 🔐 **Secure API**: Protected API endpoints with authentication
- 💾 **Direct Integration**: Saves directly to your FestiFind database

## Installation

### Option 1: Development Installation

1. **Clone the repository**:
   ```bash
   git clone [your-repo-url]
   cd FestiFind2025/chrome-extension
   ```

2. **Open Chrome Extensions page**:
   - Go to `chrome://extensions/`
   - Enable "Developer mode" (toggle in top right)

3. **Load the extension**:
   - Click "Load unpacked"
   - Select the `chrome-extension` folder

4. **Configure API endpoint**:
   - Edit `background/background.js`
   - Update `API_BASE_URL` to your FestiFind app URL

### Option 2: Chrome Web Store (Coming Soon)

The extension will be available on the Chrome Web Store once approved.

## Setup Requirements

### 1. Database Migration

First, apply the database migration to add the emails field:

```sql
-- Run this migration in your Supabase database
-- File: database/migrations/20250101_add_emails_field.sql

ALTER TABLE public.festivals ADD COLUMN IF NOT EXISTS emails TEXT[];
CREATE INDEX IF NOT EXISTS idx_festivals_emails ON public.festivals USING GIN(emails);
```

### 2. API Configuration

Ensure your FestiFind app has the following API endpoints:

- `POST /api/auth/extension` - Authentication
- `POST /api/festivals/create` - Create festival
- `GET /api/festivals/create` - List festivals (for testing)

### 3. Environment Variables

Add to your `.env` file:

```bash
CHROME_EXTENSION_API_KEY=festifind-extension-key-2025
```

## Usage

### Basic Workflow

1. **Navigate** to a festival website
2. **Click** the FestiFind extension icon in the toolbar
3. **Press** "Scan Website" to extract information
4. **Review** and edit the extracted data
5. **Click** "Save to FestiFind" to add to your database

### Supported Websites

The extension works on any website but is optimized for:

- Festival websites with structured data
- Event pages with Schema.org markup
- Sites with clear date and location information
- Pages containing contact information

### Data Extraction

The extension extracts:

- **Festival Name**: From page titles, headings, and meta tags
- **Dates**: Start and end dates in multiple formats and languages
- **Location**: Venue names, addresses, and cities
- **Emails**: Contact addresses from text and mailto links
- **URL**: Source page for reference

## Testing

### 1. Test API Connection

1. Open the extension popup
2. Click "Test Connection"
3. Should show "✅ API connection successful!"

### 2. Test Data Extraction

Try these test websites:

- **Dutch**: `https://www.pinkpop.nl/`
- **German**: `https://www.rock-am-ring.com/`
- **English**: `https://coachella.com/`
- **French**: `https://www.hellfest.fr/`

### 3. Test Full Workflow

1. Navigate to a festival website
2. Open extension popup
3. Click "Scan Website"
4. Verify extracted data
5. Edit if necessary
6. Click "Save to FestiFind"
7. Check your FestiFind database

## Development

### File Structure

```
chrome-extension/
├── manifest.json              # Extension configuration
├── popup/
│   ├── popup.html            # Popup interface
│   ├── popup.css             # Styling
│   └── popup.js              # Popup logic
├── content/
│   └── content.js            # Content script (runs on pages)
├── background/
│   └── background.js         # Background service worker
├── utils/
│   └── extractor.js          # Data extraction engine
└── assets/
    └── icons/                # Extension icons (to be added)
```

### Debugging

1. **Extension Console**:
   - Go to `chrome://extensions/`
   - Click "Details" on FestiFind extension
   - Click "Inspect views: background page"

2. **Content Script Console**:
   - Open DevTools on any webpage (F12)
   - Look for FestiFind logs in Console

3. **Popup Console**:
   - Right-click extension icon → "Inspect popup"

### Common Issues

**"Cannot scan this page"**
- Make sure you're on a regular website (not chrome:// pages)
- Check that content script is loaded

**"Connection failed"**
- Verify API_BASE_URL in background.js
- Check that your FestiFind app is running
- Ensure API endpoints are accessible

**"No data extracted"**
- The website might not have recognizable festival information
- Try adjusting extraction patterns in utils/extractor.js

## API Reference

### Authentication

```javascript
POST /api/auth/extension
{
  "apiKey": "festifind-extension-key-2025"
}
```

### Create Festival

```javascript
POST /api/festivals/create
{
  "name": "Festival Name",
  "start_date": "2025-06-15",
  "end_date": "2025-06-17", 
  "location": "Amsterdam, Netherlands",
  "emails": ["info@festival.com", "booking@festival.com"],
  "notes": "User notes",
  "url": "https://festival.com",
  "source": "chrome-extension",
  "apiKey": "festifind-extension-key-2025"
}
```

## Security

- API keys are stored securely using Chrome's storage API
- All API communication uses HTTPS
- Input validation prevents injection attacks
- Minimal permissions requested

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## Changelog

### Version 1.0.0
- Initial release
- Multi-language data extraction
- Email collection and validation
- Direct FestiFind integration
- Secure API authentication

## Support

For issues and support:

1. Check the [troubleshooting guide](#common-issues)
2. Review the browser console for errors
3. Open an issue on GitHub
4. Contact the FestiFind team

## License

This project is part of the FestiFind application suite.

---

**Made with ❤️ for the festival community**

# FestiFind Chrome Extension - Installation & Testing Guide

## Quick Installation

1. **Open Chrome Extensions Page**
   - Go to `chrome://extensions/`
   - Enable "Developer mode" (toggle in top right)

2. **Load the Extension**
   - Click "Load unpacked"
   - Select the `chrome-extension` folder from your FestiFind project
   - The extension should appear in your extensions list

3. **Test the Extension**
   - Open the included `test.html` file in Chrome
   - Click the FestiFind extension icon in the toolbar
   - Click "Scan Current Page" to test data extraction

## Debugging Steps

### If you get "Could not establish connection" error:

1. **Check Console Logs**
   - Open Developer Tools (F12)
   - Check the Console tab for error messages
   - Look for "FestiFind content script loaded" message

2. **Refresh the Page**
   - Content scripts may not load on already-open tabs
   - Refresh the page after installing the extension

3. **Check Extension Popup Console**
   - Right-click the extension icon → "Inspect popup"
   - Check for JavaScript errors in popup console

4. **Verify Content Script Loading**
   - In page console, check if `window.festifindContentScriptLoaded` is `true`
   - If false, the content script didn't load properly

### Common Issues:

1. **"Receiving end does not exist"**
   - Content script not loaded/responding
   - Try refreshing the page
   - Check if URL is supported (not chrome:// pages)

2. **Manifest errors**
   - Check chrome://extensions/ for error messages
   - Reload the extension after any code changes

3. **API Connection failures**
   - Make sure FestiFind API is running
   - Check settings in extension popup
   - Verify API key configuration

## Configuration

### API Settings (in extension popup):
- **API URL**: `http://localhost:3000` (for local development)
- **API Key**: `festifind-extension-key-2025`

### For Production:
- **API URL**: `https://festifind.vercel.app`
- **API Key**: Use your production API key

## Testing Checklist

- [ ] Extension loads without errors
- [ ] Content script loads on web pages
- [ ] Ping test works (check popup console)
- [ ] Data extraction works on test.html
- [ ] Form populates with extracted data
- [ ] Email management works
- [ ] API connection test passes
- [ ] Festival saving works
- [ ] Data appears in FestiFind database

## Files Structure

```
chrome-extension/
├── manifest.json          # Extension configuration
├── popup/
│   ├── popup.html         # Extension popup interface
│   ├── popup.css          # Popup styling
│   └── popup.js           # Popup functionality
├── content/
│   └── content.js         # Content script (runs on web pages)
├── background/
│   └── background.js      # Background service worker
├── utils/
│   └── extractor.js       # Data extraction utilities
├── test.html              # Test page for debugging
└── README.md              # This file
```

## Development Tips

1. **Reload Extension**: Click reload button in chrome://extensions/ after changes
2. **View Logs**: Check both popup console and page console
3. **Test on Real Sites**: Try festival websites after basic testing works
4. **API Testing**: Use curl commands to test API endpoints directly

## Next Steps

Once basic functionality works:
1. Test on real festival websites
2. Refine data extraction patterns
3. Improve error handling
4. Add more language support
5. Package for Chrome Web Store 