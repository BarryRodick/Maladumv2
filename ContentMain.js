/**
 * ContentMain.js - Main content script for the Maladum Event Cards extension
 * Handles content script initialization and communication with the background service worker
 */

// Log initialization with document state
console.log('[ContentService] document.readyState:', document.readyState);

// Initialize content script data
const contentInitData = {
  TabId: chrome.runtime.id ? parseInt(chrome.runtime.id.replace(/\D/g, '')) : 0,
  FrameId: 0
};

// Log initialization data
console.log('[ContentService.SetContentInitData] target:', contentInitData);

// Wait for DOM to be fully loaded before performing operations
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeContent);
} else {
  initializeContent();
}

/**
 * Initializes the content script functionality
 */
function initializeContent() {
  // Set up message listener for communication with background script
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'getPageInfo') {
      const pageInfo = {
        url: window.location.href,
        title: document.title
      };
      sendResponse(pageInfo);
      return true;
    }
  });

  // Handle storage access safely through the service worker
  try {
    if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.id) {
      // Request storage data from service worker instead of accessing directly
      chrome.runtime.sendMessage(
        { action: 'getStorageData' },
        (response) => {
          if (chrome.runtime.lastError) {
            console.warn('[ContentService] Storage request error:', chrome.runtime.lastError.message);
            return;
          }
          
          if (response && response.success) {
            console.log('[ContentService] Storage data loaded successfully');
          }
        }
      );
    } else {
      console.warn('[ContentService] Not in a valid extension context');
    }
  } catch (error) {
    console.warn('[ContentService] Storage access error:', error.message);
    // Don't throw error, just log it
  }
}

// Export for module usage if needed
if (typeof module !== 'undefined') {
  module.exports = {
    contentInitData
  };
} 