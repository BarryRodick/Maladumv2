/**
 * web-client-content-script.js - Content script for web client interactions
 * Handles safe storage access and DOM manipulation
 */

// Initialize when the DOM is fully loaded
document.addEventListener('DOMContentLoaded', () => {
  console.log('[WebClientContentScript] Initialized');
  initializeContentScript();
});

/**
 * Initializes the content script functionality
 */
function initializeContentScript() {
  // Set up message passing with the background script
  setupMessagePassing();
  
  // Handle storage access safely through message passing
  setupStorageAccess();
}

/**
 * Sets up message passing with the background script
 */
function setupMessagePassing() {
  try {
    // Check if we're in a valid extension context
    if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.id) {
      // Listen for messages from the background script
      chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        if (!message || !message.action) return false;
        
        switch (message.action) {
          case 'getPageInfo':
            sendResponse({
              url: window.location.href,
              title: document.title,
              readyState: document.readyState
            });
            return true;
            
          case 'storageResult':
            // Handle storage data received from background
            handleStorageResult(message.data);
            return false;
            
          default:
            return false;
        }
      });
    }
  } catch (error) {
    console.warn('[WebClientContentScript] Message passing setup error:', error.message);
  }
}

/**
 * Sets up safe storage access through the background script
 */
function setupStorageAccess() {
  try {
    // Check if we're in a valid extension context
    if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.id) {
      // Use message passing to request storage data from the service worker
      chrome.runtime.sendMessage({
        action: 'getStorageData',
        keys: ['deckbuilderState', 'deckbuilderConfig']
      }, (response) => {
        // Check for runtime errors first
        if (chrome.runtime.lastError) {
          console.warn('[WebClientContentScript] Error requesting storage:', chrome.runtime.lastError.message);
          fallbackToLocalStorage();
          return;
        }
        
        // Process the response
        if (response && response.success) {
          handleStorageResult(response.data);
        } else {
          console.warn('[WebClientContentScript] Invalid response from service worker');
          fallbackToLocalStorage();
        }
      });
    } else {
      // Not in a valid extension context, use localStorage
      console.warn('[WebClientContentScript] Not in a valid extension context');
      fallbackToLocalStorage();
    }
  } catch (error) {
    console.warn('[WebClientContentScript] Storage access error:', error.message);
    // Don't throw the error, just log it and fall back
    fallbackToLocalStorage();
  }
}

/**
 * Fallback to localStorage when chrome.storage is not available
 */
function fallbackToLocalStorage() {
  console.log('[WebClientContentScript] Falling back to localStorage');
  try {
    // Only attempt localStorage access if we're in a page context
    if (window.location.protocol !== 'chrome-extension:') {
      const data = {
        deckbuilderState: localStorage.getItem('deckbuilderState') ? 
          JSON.parse(localStorage.getItem('deckbuilderState')) : null,
        deckbuilderConfig: localStorage.getItem('deckbuilderConfig') ? 
          JSON.parse(localStorage.getItem('deckbuilderConfig')) : null
      };
      handleStorageResult(data);
    } else {
      // We're in a content script context where localStorage might not be accessible
      console.warn('[WebClientContentScript] Cannot access localStorage in this context');
      // Dispatch event with empty data to allow the app to initialize with defaults
      handleStorageResult({});
    }
  } catch (error) {
    console.warn('[WebClientContentScript] LocalStorage fallback failed:', error.message);
    // Silently fail - the app will initialize with default values
    handleStorageResult({});
  }
}

/**
 * Handles storage data received from the background script
 * @param {Object} data - The storage data
 */
function handleStorageResult(data) {
  // Ensure we have at least an empty object
  const safeData = data || {};
  
  // Make data available to the page through a custom event
  const storageEvent = new CustomEvent('storageDataAvailable', { detail: safeData });
  document.dispatchEvent(storageEvent);
  
  console.log('[WebClientContentScript] Storage data made available to page');
}

// Export for module usage if needed
if (typeof module !== 'undefined') {
  module.exports = {
    initializeContentScript
  };
} 