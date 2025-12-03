// FestiFind Chrome Extension - Popup Script
// Handles user interactions and data management

console.log('FestiFind popup script loaded');

// DOM elements
let elements = {};

// State management
let extractedData = null;
let currentEmails = [];

// Initialize popup
document.addEventListener('DOMContentLoaded', initializePopup);

async function initializePopup() {
  console.log('Initializing popup...');
  
  // Get DOM elements
  elements = {
    scanBtn: document.getElementById('scanBtn'),
    testBtn: document.getElementById('testBtn'),
    saveBtn: document.getElementById('saveBtn'),
    clearBtn: document.getElementById('clearBtn'),
    addEmailBtn: document.getElementById('addEmailBtn'),
    
    statusContainer: document.getElementById('statusContainer'),
    statusMessage: document.getElementById('statusMessage'),
    loadingIndicator: document.getElementById('loadingIndicator'),
    extractedDataContainer: document.getElementById('extractedDataContainer'),
    
    festivalName: document.getElementById('festivalName'),
    startDate: document.getElementById('startDate'),
    endDate: document.getElementById('endDate'),
    location: document.getElementById('location'),
    notes: document.getElementById('notes'),
    
    emailList: document.getElementById('emailList'),
    newEmail: document.getElementById('newEmail'),
    currentUrl: document.getElementById('currentUrl'),
    
    successContainer: document.getElementById('successContainer'),
    scanAnotherBtn: document.getElementById('scanAnotherBtn')
  };
  
  // Add event listeners
  setupEventListeners();
  
  // Load current tab URL
  await loadCurrentTabInfo();
  
  console.log('Popup initialized');
}

function setupEventListeners() {
  // Main action buttons
  elements.scanBtn.addEventListener('click', handleScanWebsite);
  elements.testBtn.addEventListener('click', handleTestConnection);
  elements.saveBtn.addEventListener('click', handleSaveFestival);
  elements.clearBtn.addEventListener('click', handleClearForm);
  
  // Email management
  elements.addEmailBtn.addEventListener('click', handleAddEmail);
  elements.newEmail.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      handleAddEmail();
    }
  });
  
  // Email removal using event delegation
  elements.emailList.addEventListener('click', (e) => {
    if (e.target.classList.contains('email-remove')) {
      const index = parseInt(e.target.getAttribute('data-index'));
      removeEmail(index);
    }
  });
  
  // Form validation
  elements.festivalName.addEventListener('input', validateForm);
  elements.startDate.addEventListener('change', validateForm);
  elements.endDate.addEventListener('change', validateForm);
  
  // Success screen
  elements.scanAnotherBtn.addEventListener('click', handleScanAnother);
}

async function loadCurrentTabInfo() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    if (tab && tab.url) {
      const url = new URL(tab.url);
      elements.currentUrl.textContent = url.hostname;
      elements.currentUrl.title = tab.url;
    } else {
      elements.currentUrl.textContent = 'Unknown';
    }
  } catch (error) {
    console.error('Error loading tab info:', error);
    elements.currentUrl.textContent = 'Error';
  }
}

async function handleScanWebsite() {
  console.log('Starting website scan...');
  
  try {
    // Show loading state
    showLoading('Scanning website...');
    hideStatus();
    hideForm();
    
    // Get active tab
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    if (!tab || !tab.url || tab.url.startsWith('chrome://')) {
      throw new Error('Cannot scan this page. Please navigate to a website first.');
    }
    
    console.log('Sending message to content script on tab:', tab.id);
    
    // First, test if content script is responsive
    try {
      const pingResponse = await chrome.tabs.sendMessage(tab.id, {
        action: 'ping'
      });
      console.log('Content script ping response:', pingResponse);
    } catch (pingError) {
      console.error('Content script ping failed:', pingError);
      throw new Error('Content script not responding. Please refresh the page and try again.');
    }
    
    // Send message to content script for data extraction
    const response = await chrome.tabs.sendMessage(tab.id, {
      action: 'extractData'
    });
    
    console.log('Content script response:', response);
    
    if (response && response.success) {
      extractedData = response.data;
      console.log('Data extracted successfully:', extractedData);
      
      // Populate form with extracted data
      populateForm(extractedData);
      
      // Display extraction info
      displayExtractionInfo(response.method, response.metadata);
      
      // Show form
      hideLoading();
      showForm();
      showStatus('Data extracted successfully! Please review and edit as needed.', 'success');
      
    } else {
      throw new Error(response?.error || 'Failed to extract data from the page');
    }
    
  } catch (error) {
    console.error('Error scanning website:', error);
    hideLoading();
    showStatus(`Error: ${error.message}`, 'error');
  }
}

async function handleTestConnection() {
  console.log('Testing Perplexity service connection...');
  
  try {
    showLoading('Testing connection...');
    hideStatus();
    hideForm();
    
    // Test the Perplexity service health
    const healthResponse = await fetch('https://festifind2025.vercel.app/api/perplexity/health', {
      method: 'GET'
    });
    
    if (!healthResponse.ok) {
      throw new Error(`Health check failed: ${healthResponse.status}`);
    }
    
    const healthData = await healthResponse.json();
    console.log('Health check passed:', healthData);
    
    // Test the Perplexity extraction endpoint with sample data
    const testHTML = `
      <html>
        <head><title>Test Festival 2025</title></head>
        <body>
          <h1>Test Festival 2025</h1>
          <p>Date: July 20-22, 2025</p>
          <p>Location: Amsterdam, Netherlands</p>
          <p>Contact: info@testfestival.com</p>
        </body>
      </html>
    `;

    const testResponse = await fetch('https://festifind2025.vercel.app/api/perplexity/extract/html', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer festifind-perplexity-service-2025'
      },
      body: JSON.stringify({
        html: testHTML,
        url: 'https://test.example.com'
      })
    });
    
    if (!testResponse.ok) {
      let errorMessage;
      const contentType = testResponse.headers.get('content-type');
      
      if (contentType && contentType.includes('application/json')) {
        const errorData = await testResponse.json();
        errorMessage = errorData.error || testResponse.statusText;
      } else {
        // Handle HTML error pages (like 404)
        errorMessage = `HTTP ${testResponse.status}: ${testResponse.statusText}`;
        if (testResponse.status === 404) {
          errorMessage += ' - Endpoint not found. Please check deployment.';
        }
      }
      
      throw new Error(`Extraction test failed: ${errorMessage}`);
    }
    
    const testData = await testResponse.json();
    console.log('Extraction test passed:', testData);
    
    if (!testData.success) {
      throw new Error(`Extraction failed: ${testData.error || 'Unknown error'}`);
    }
    
    hideLoading();
    showStatus('✅ Connection test successful! Perplexity AI extraction is working correctly.', 'success');
    
    // Show extraction info if available
    if (testData.metadata) {
      displayExtractionInfo('perplexity-ai-test', testData.metadata);
    }
    
  } catch (error) {
    console.error('Connection test failed:', error);
    hideLoading();
    showStatus(`❌ Connection test failed: ${error.message}`, 'error');
  }
}



async function handleSaveFestival() {
  console.log('Saving festival...');
  
  try {
    // Validate form
    if (!validateForm()) {
      showStatus('Please fill in the festival name and check your data.', 'error');
      return;
    }
    
    showLoading('Saving festival...');
    hideStatus();
    
    // Collect form data
    const festivalData = {
      name: elements.festivalName.value.trim(),
      startDate: elements.startDate.value || null,
      endDate: elements.endDate.value || null,
      location: elements.location.value.trim() || null,
      emails: currentEmails,
      notes: elements.notes.value.trim() || null,
      url: extractedData?.url || window.location.href
    };
    
    // Send to background script
    const response = await new Promise((resolve) => {
      chrome.runtime.sendMessage({
        action: 'saveFestival',
        data: festivalData
      }, resolve);
    });
    
    hideLoading();
    
    if (response && response.success) {
      // Show success confirmation screen
      showSuccessConfirmation();
      
    } else {
      const errorMessage = response?.error || 'Unknown error occurred';
      showStatus(`❌ Save failed: ${errorMessage}`, 'error');
    }
    
  } catch (error) {
    console.error('Error saving festival:', error);
    hideLoading();
    showStatus(`❌ Save error: ${error.message}`, 'error');
  }
}

function handleClearForm() {
  console.log('Clearing form...');
  
  // Clear form fields
  elements.festivalName.value = '';
  elements.startDate.value = '';
  elements.endDate.value = '';
  elements.location.value = '';
  elements.notes.value = '';
  elements.newEmail.value = '';
  
  // Clear emails
  currentEmails = [];
  
  // Hide extraction info
  hideExtractionInfo();
  updateEmailList();
  
  // Clear state
  extractedData = null;
  
  // Hide form and status
  hideForm();
  hideStatus();
  hideSuccessConfirmation();
  
  // Reset validation
  validateForm();
}

function handleAddEmail() {
  const email = elements.newEmail.value.trim();
  
  if (!email) {
    return;
  }
  
  if (!isValidEmail(email)) {
    showStatus('Please enter a valid email address.', 'error');
    return;
  }
  
  if (currentEmails.includes(email)) {
    showStatus('This email is already in the list.', 'error');
    return;
  }
  
  // Add email to list
  currentEmails.push(email);
  elements.newEmail.value = '';
  updateEmailList();
  hideStatus();
}

function populateForm(data) {
  console.log('Populating form with data:', data);
  
  // Fill basic fields
  elements.festivalName.value = data.name || '';
  elements.location.value = data.location || '';
  
  // Fill dates
  if (data.dates) {
    elements.startDate.value = data.dates.startDate || '';
    elements.endDate.value = data.dates.endDate || '';
  }
  
  // Set emails
  currentEmails = data.emails || [];
  updateEmailList();
  
  // Validate form
  validateForm();
}

function updateEmailList() {
  const emailList = elements.emailList;
  
  if (currentEmails.length === 0) {
    emailList.innerHTML = '<div class="email-placeholder">No email addresses found</div>';
  } else {
    emailList.innerHTML = currentEmails.map((email, index) => `
      <div class="email-item">
        <span class="email-text">${escapeHtml(email)}</span>
        <button class="email-remove" data-index="${index}">×</button>
      </div>
    `).join('');
  }
}

function removeEmail(index) {
  currentEmails.splice(index, 1);
  updateEmailList();
}

function validateForm() {
  const isValid = elements.festivalName.value.trim().length > 0;
  
  // Update save button state
  elements.saveBtn.disabled = !isValid;
  
  return isValid;
}

function isValidEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

function showLoading(text = 'Loading...') {
  elements.loadingIndicator.style.display = 'block';
  elements.loadingIndicator.querySelector('.loading-text').textContent = text;
}

function hideLoading() {
  elements.loadingIndicator.style.display = 'none';
}

function showForm() {
  elements.extractedDataContainer.style.display = 'block';
  elements.extractedDataContainer.classList.add('fade-in');
}

function hideForm() {
  elements.extractedDataContainer.style.display = 'none';
  elements.extractedDataContainer.classList.remove('fade-in');
}

function showStatus(message, type = 'info') {
  elements.statusContainer.style.display = 'block';
  elements.statusMessage.textContent = message;
  elements.statusMessage.className = `status-message status-${type}`;
  
  // Auto-hide success messages
  if (type === 'success') {
    setTimeout(() => {
      hideStatus();
    }, 5000);
  }
}

function hideStatus() {
  elements.statusContainer.style.display = 'none';
}

function showSuccessConfirmation() {
  // Hide other sections
  hideForm();
  hideStatus();
  hideLoading();
  
  // Show success screen
  elements.successContainer.style.display = 'block';
  elements.successContainer.classList.add('fade-in');
}

function hideSuccessConfirmation() {
  elements.successContainer.style.display = 'none';
  elements.successContainer.classList.remove('fade-in');
}

function handleScanAnother() {
  // Reset to initial state
  hideSuccessConfirmation();
  handleClearForm();
  hideExtractionInfo();
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// removeEmail function is now handled via event delegation

function displayExtractionInfo(method, metadata) {
  const extractionMethodEl = document.getElementById('extractionMethod');
  const extractionMethodValueEl = document.getElementById('extractionMethodValue');
  const extractionConfidenceEl = document.getElementById('extractionConfidence');
  const extractionConfidenceValueEl = document.getElementById('extractionConfidenceValue');
  
  if (!extractionMethodEl || !extractionMethodValueEl) return;
  
  // Display extraction method
  let methodText = '';
  let methodClass = '';
  
  switch (method) {
    case 'perplexity-ai':
      methodText = '🤖 Perplexity AI';
      methodClass = 'extraction-method-ai';
      break;
    case 'regex-fallback':
      methodText = '🔧 Regex Fallback';
      methodClass = 'extraction-method-regex';
      break;
    case 'error-fallback':
      methodText = '⚠️ Error Recovery';
      methodClass = 'extraction-method-error';
      break;
    default:
      methodText = '❓ Unknown';
      methodClass = 'extraction-method-error';
  }
  
  extractionMethodValueEl.innerHTML = `<span class="${methodClass}">${methodText}</span>`;
  extractionMethodEl.style.display = 'block';
  
  // Display confidence if available
  if (metadata && metadata.confidence !== undefined && extractionConfidenceEl && extractionConfidenceValueEl) {
    const confidence = metadata.confidence;
    let confidenceClass = '';
    
    if (confidence >= 80) {
      confidenceClass = 'confidence-high';
    } else if (confidence >= 60) {
      confidenceClass = 'confidence-medium';
    } else {
      confidenceClass = 'confidence-low';
    }
    
    extractionConfidenceValueEl.innerHTML = `<span class="${confidenceClass}">${confidence}%</span>`;
    extractionConfidenceEl.style.display = 'block';
  } else if (extractionConfidenceEl) {
    extractionConfidenceEl.style.display = 'none';
  }
}

function hideExtractionInfo() {
  const extractionMethodEl = document.getElementById('extractionMethod');
  const extractionConfidenceEl = document.getElementById('extractionConfidence');
  
  if (extractionMethodEl) {
    extractionMethodEl.style.display = 'none';
  }
  
  if (extractionConfidenceEl) {
    extractionConfidenceEl.style.display = 'none';
  }
}

// Handle extension errors
window.addEventListener('error', (event) => {
  console.error('Popup error:', event.error);
  hideLoading();
  showStatus('An unexpected error occurred. Please try again.', 'error');
});

console.log('FestiFind popup script ready'); 