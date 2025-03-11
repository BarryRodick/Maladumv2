/**
 * ContentMain.js - Main content script for the Maladum Event Cards extension
 * Handles content script initialization and communication with the background service worker
 */

const ContentService = {
    initialized: false,
    
    init() {
        if (this.initialized) return;
        
        console.log('[ContentMain]');
        this.setupContentScript();
        this.initialized = true;
    },
    
    setupContentScript() {
        // Log readyState for debugging
        console.log('[ContentService] document.readyState:', document.readyState);
        
        // Set initial content data
        this.setContentInitData();
        
        // Wait for DOM to be ready
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.onDOMReady());
        } else {
            this.onDOMReady();
        }
    },
    
    setContentInitData() {
        const target = {
            TabId: chrome?.runtime?.id ? Date.now() : 0,
            FrameId: 0
        };
        console.log('[ContentService.SetContentInitData] target:', target);
    },
    
    onDOMReady() {
        // Initialize storage access
        this.initializeStorage();
    },
    
    async initializeStorage() {
        try {
            // Check if we're in extension context
            if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.id) {
                await this.initializeExtensionStorage();
            } else {
                this.initializeLocalStorage();
            }
        } catch (error) {
            console.warn('[ContentService] Storage initialization error:', error);
            this.initializeLocalStorage();
        }
    },
    
    async initializeExtensionStorage() {
        return new Promise((resolve, reject) => {
            chrome.runtime.sendMessage({
                action: 'getStorageData',
                keys: ['deckbuilderState', 'deckbuilderConfig']
            }, (response) => {
                if (chrome.runtime.lastError) {
                    reject(chrome.runtime.lastError);
                    return;
                }
                resolve(response);
            });
        });
    },
    
    initializeLocalStorage() {
        // Use localStorage when not in extension context
        const storageEvent = new CustomEvent('storageDataAvailable', {
            detail: {
                deckbuilderState: localStorage.getItem('deckbuilderState'),
                deckbuilderConfig: localStorage.getItem('deckbuilderConfig')
            }
        });
        document.dispatchEvent(storageEvent);
    }
};

// Initialize the content script
ContentService.init();

// Export for module usage if needed
if (typeof module !== 'undefined') {
  module.exports = {
    contentInitData: ContentService.setContentInitData()
  };
} 