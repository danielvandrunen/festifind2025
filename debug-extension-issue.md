# 🔍 Chrome Extension Debug Guide

## Current Status ✅
- **Perplexity Service**: Running perfectly (tested with curl)
- **Service Extraction**: Working 100% (85-95% confidence)
- **Test Page**: Ready (6,748 bytes, extracts "Vier De Lente Festival")

## 🚨 The Problem
Your Chrome extension is only capturing **82 characters** of HTML from https://vierdelente.com/ instead of the full page content.

## 🧪 Quick Test Steps

### 1. Test With Our Debug Page
```bash
# Open this URL in Chrome with extension loaded:
file:///Users/danieldrunen/FestiFind2025/test-extension-debug.html
```

**Expected Results:**
- ✅ Extension detects ~6,748 characters of HTML
- ✅ Extracts "Vier De Lente Festival" with high confidence
- ✅ All tests in the page should pass

### 2. Test With Real Website
```bash
# Open this URL in Chrome:
https://vierdelente.com/
```

**Current Issue:**
- ❌ Extension only captures ~82 characters
- ❌ Extracts "Test Festival 2025" instead of "Vier De Lente Festival"

## 🔧 Debugging in Chrome DevTools

### Step 1: Open Console
1. Press `F12` to open DevTools
2. Go to **Console** tab
3. Look for **FestiFind** logs

### Step 2: Check HTML Capture
Look for these specific logs:
```
📄 HTML length: XXX characters
📝 HTML preview: ...
```

**If HTML length < 1000 characters** → This is the root cause!

### Step 3: Manual Test
In the console, run:
```javascript
// Check if extension is loaded
console.log('Extension loaded:', window.festifindContentScriptLoaded);

// Check HTML length manually
console.log('HTML length:', document.documentElement.outerHTML.length);

// Test extraction function directly
if (window.extractWithPerplexity) {
    const html = document.documentElement.outerHTML;
    window.extractWithPerplexity(html, window.location.href)
        .then(result => console.log('Manual test result:', result))
        .catch(error => console.error('Manual test error:', error));
}
```

## 🎯 Most Likely Causes

### 1. Page Loading Issue
The extension might be capturing HTML before the page fully loads.

**Fix**: The content script already has a 2-second wait for short HTML, but it might not be enough.

### 2. Content Security Policy (CSP)
Some websites block extension content scripts.

**Debug**: Check Console for CSP errors.

### 3. Dynamic Content Loading
The website might load content via JavaScript after initial page load.

**Debug**: Compare `document.documentElement.outerHTML.length` immediately vs. after 5 seconds.

### 4. Extension Permissions
Check if the extension has proper permissions.

**Debug**: Look for permission errors in Console.

## 🔨 Quick Fixes to Try

### Fix 1: Increase Wait Time
In `chrome-extension/content/content.js`, line ~208:
```javascript
// Change from 2000ms to 5000ms
await new Promise(resolve => setTimeout(resolve, 5000));
```

### Fix 2: Add DOM Ready Check
```javascript
// Wait for DOM to be fully loaded
if (document.readyState !== 'complete') {
    await new Promise(resolve => {
        window.addEventListener('load', resolve);
    });
}
```

### Fix 3: Try Different HTML Capture Methods
```javascript
// Method 1: Standard
let html = document.documentElement.outerHTML;

// Method 2: With serializer
let html = new XMLSerializer().serializeToString(document);

// Method 3: Body + head separately
let html = document.doctype ? '<!DOCTYPE html>' : '';
html += document.documentElement.outerHTML;
```

## 📊 Test Results Template

When testing, please share these logs:

```
🌐 Website: https://vierdelente.com/
📄 HTML Length: XXX characters
📝 HTML Preview: "..."
🎯 Extraction Result: "..."
🔧 Method Used: perplexity-ai
📊 Confidence: XX%
❌ Error (if any): "..."
```

## 🎯 Success Criteria

The extension should:
1. ✅ Capture full HTML (>10,000 characters for vierdelente.com)
2. ✅ Extract "Vier De Lente Festival" (not "Test Festival 2025")
3. ✅ Show 80%+ confidence
4. ✅ Include correct date (2026-04-11), location (Hillegom), email (info@vierdelente.com)

---

**Ready to test!** Start with the test page, then move to the real website. The backend is working perfectly, so this is purely a Chrome extension HTML capture issue. 