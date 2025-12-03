// FestiFind Chrome Extension - Background Script (Service Worker)
// Handles persistent logic and API communication

console.log('FestiFind background script loaded');

// Configuration
const CONFIG = {
  API_BASE_URL: 'https://festifind2025.vercel.app/api', // Production Vercel URL
  API_KEY: 'festifind-extension-key-2025',
  STORAGE_KEYS: {
    API_KEY: 'festifind_api_key',
    USER_SETTINGS: 'festifind_settings'
  }
};

// Initialize extension
chrome.runtime.onInstalled.addListener(async (details) => {
  console.log('Extension installed/updated:', details.reason);
  
  if (details.reason === 'install') {
    // First time installation
    await initializeExtension();
  }
});

// Initialize extension settings
async function initializeExtension() {
  try {
    // Store default API key
    await chrome.storage.sync.set({
      [CONFIG.STORAGE_KEYS.API_KEY]: CONFIG.API_KEY,
      [CONFIG.STORAGE_KEYS.USER_SETTINGS]: {
        autoDetectLanguage: true,
        validateEmails: true,
        maxEmails: 10,
        installed: Date.now()
      }
    });
    
    console.log('Extension initialized successfully');
  } catch (error) {
    console.error('Error initializing extension:', error);
  }
}

// Listen for messages from content scripts and popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('Background received message:', request);
  
  if (request.action === 'contentScriptLoaded') {
    handleContentScriptLoaded(request, sender);
  }
  
  if (request.action === 'saveFestival') {
    handleSaveFestival(request.data, sendResponse);
    return true; // Will respond asynchronously
  }
  
  if (request.action === 'testApiConnection') {
    handleTestApiConnection(sendResponse);
    return true; // Will respond asynchronously
  }
});

// Handle content script loaded notification
function handleContentScriptLoaded(request, sender) {
  console.log(`Content script loaded on: ${request.url}`);
  
  // Update badge to indicate extension is active
  if (sender.tab && sender.tab.id) {
    chrome.action.setBadgeText({
      text: '✓',
      tabId: sender.tab.id
    });
    
    chrome.action.setBadgeBackgroundColor({
      color: '#007cba',
      tabId: sender.tab.id
    });
  }
}

// Handle festival saving
async function handleSaveFestival(festivalData, sendResponse) {
  try {
    console.log('Saving festival:', festivalData);
    
    // Get API key from storage
    const storage = await chrome.storage.sync.get([CONFIG.STORAGE_KEYS.API_KEY]);
    const apiKey = storage[CONFIG.STORAGE_KEYS.API_KEY] || CONFIG.API_KEY;
    
    // Prepare festival data
    const payload = {
      name: festivalData.name,
      start_date: festivalData.startDate || null,
      end_date: festivalData.endDate || null,
      location: festivalData.location || null,
      emails: festivalData.emails || [],
      notes: festivalData.notes || null,
      url: festivalData.url,
      source: 'chrome-extension',
      apiKey: apiKey
    };
    
    // Make API request
    const response = await fetch(`${CONFIG.API_BASE_URL}/festivals/create`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });
    
    const result = await response.json();
    
    if (response.ok) {
      console.log('Festival saved successfully:', result);
      sendResponse({
        success: true,
        data: result,
        message: 'Festival saved successfully!'
      });
    } else {
      console.error('Error saving festival:', result);
      sendResponse({
        success: false,
        error: result.error || 'Unknown error',
        details: result
      });
    }
    
  } catch (error) {
    console.error('Error in handleSaveFestival:', error);
    sendResponse({
      success: false,
      error: 'Network error: ' + error.message
    });
  }
}

// Handle API connection test
async function handleTestApiConnection(sendResponse) {
  try {
    console.log('Testing API connection...');
    
    // Get API key from storage
    const storage = await chrome.storage.sync.get([CONFIG.STORAGE_KEYS.API_KEY]);
    const apiKey = storage[CONFIG.STORAGE_KEYS.API_KEY] || CONFIG.API_KEY;
    
    // Test authentication endpoint
    const response = await fetch(`${CONFIG.API_BASE_URL}/auth/extension`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ apiKey })
    });
    
    const result = await response.json();
    
    if (response.ok) {
      console.log('API connection successful');
      sendResponse({
        success: true,
        message: 'API connection successful',
        data: result
      });
    } else {
      console.error('API connection failed:', result);
      sendResponse({
        success: false,
        error: result.error || 'Authentication failed'
      });
    }
    
  } catch (error) {
    console.error('Error testing API connection:', error);
    sendResponse({
      success: false,
      error: 'Network error: ' + error.message
    });
  }
}

// Update badge when tabs change
chrome.tabs.onActivated.addListener(async (activeInfo) => {
  try {
    // Clear badge on tab switch
    chrome.action.setBadgeText({
      text: '',
      tabId: activeInfo.tabId
    });
  } catch (error) {
    console.error('Error updating badge:', error);
  }
});

// Handle tab updates
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url) {
    // Page finished loading, clear badge
    chrome.action.setBadgeText({
      text: '',
      tabId: tabId
    });
  }
});

// Error handling
chrome.runtime.onSuspend.addListener(() => {
  console.log('Background script suspending...');
});

self.addEventListener('unhandledrejection', event => {
  console.error('Unhandled promise rejection:', event.reason);
});

console.log('FestiFind background script initialized'); 