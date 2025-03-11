// service-worker.js for Chrome Extension (Manifest V3)

const CACHE_NAME = 'maladum-v2-cache';
const APP_SHELL_FILES = [
    '/Maladumv2/',
    '/Maladumv2/index.html',
    '/Maladumv2/deckbuilder.js',
    '/Maladumv2/styles.css',
    '/Maladumv2/data/maladumcards.json',
    '/Maladumv2/data/difficulties.json',
    '/Maladumv2/logos/logo-32.png',
    '/Maladumv2/logos/logo-64.png',
    '/Maladumv2/logos/logo-128.png',
    '/Maladumv2/logos/logo-256.png',
    '/Maladumv2/logos/logo-512.png'
];

// Safely check for chrome APIs
const isExtensionContext = typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.id;

// Install event - cache app shell files
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                console.log('[Service Worker] Caching app shell files');
                return cache.addAll(APP_SHELL_FILES)
                    .catch(error => {
                        console.error('[Service Worker] Cache addAll failed:', error);
                        // Continue installation even if some files fail to cache
                        return Promise.resolve();
                    });
            })
            .then(() => {
                console.log('[Service Worker] Installation complete');
                return self.skipWaiting();
            })
    );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys()
            .then((cacheNames) => {
                return Promise.all(
                    cacheNames.map((cacheName) => {
                        if (cacheName !== CACHE_NAME) {
                            console.log('[Service Worker] Removing old cache:', cacheName);
                            return caches.delete(cacheName);
                        }
                    })
                );
            })
            .then(() => {
                console.log('[Service Worker] Activation complete');
                return self.clients.claim();
            })
    );
});

// Fetch event - serve from cache, falling back to network
self.addEventListener('fetch', (event) => {
    event.respondWith(
        caches.match(event.request)
            .then((response) => {
                if (response) {
                    // Return cached response
                    return response;
                }

                // Clone the request because it can only be used once
                const fetchRequest = event.request.clone();

                return fetch(fetchRequest)
                    .then((response) => {
                        // Check if response is valid
                        if (!response || response.status !== 200 || response.type !== 'basic') {
                            return response;
                        }

                        // Clone the response because it can only be used once
                        const responseToCache = response.clone();

                        // Cache the new resource
                        caches.open(CACHE_NAME)
                            .then((cache) => {
                                cache.put(event.request, responseToCache);
                            })
                            .catch(error => {
                                console.error('[Service Worker] Cache put failed:', error);
                            });

                        return response;
                    })
                    .catch(error => {
                        console.error('[Service Worker] Fetch failed:', error);
                        // You could return a custom offline page here
                        return new Response('Network error occurred', {
                            status: 503,
                            statusText: 'Service Unavailable'
                        });
                    });
            })
    );
});

// Handle messages from the client
self.addEventListener('message', (event) => {
    if (event.data.action === 'skipWaiting') {
        self.skipWaiting();
    }
});

// Message handling based on context
if (isExtensionContext) {
    // Extension context message handling
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        console.log('[Service Worker] Message received:', message);
        
        if (!message || !message.action) {
            sendResponse({ success: false, error: 'Invalid message format' });
            return false;
        }
        
        switch (message.action) {
            case 'GET_VERSION':
                sendResponse({ success: true, version: CACHE_NAME });
                return false;
                
            case 'getStorageData':
                handleStorageRequest(message, sender, sendResponse);
                return true; // Keep the message channel open for async response
                
            case 'setStorageData':
                handleStorageUpdate(message, sender, sendResponse);
                return true; // Keep the message channel open for async response
                
            default:
                sendResponse({ success: false, error: 'Unknown action' });
                return false;
        }
    });
} else {
    // Web context message handling
    self.addEventListener('message', (event) => {
        const message = event.data;
        
        if (message.type === 'GET_VERSION') {
            event.ports[0].postMessage({
                success: true,
                version: CACHE_NAME
            });
        }
    });
}

/**
 * Handles storage data requests
 * @param {Object} message - The message object
 * @param {Object} sender - The sender information
 * @param {Function} sendResponse - The response callback
 */
function handleStorageRequest(message, sender, sendResponse) {
    if (!isExtensionContext) {
        sendResponse({ success: false, error: 'Storage API not available in web context' });
        return;
    }

    const keys = message.keys || null;
    
    try {
        chrome.storage.local.get(keys, (data) => {
            if (chrome.runtime.lastError) {
                console.error('[Service Worker] Storage get error:', chrome.runtime.lastError.message);
                sendResponse({ 
                    success: false, 
                    error: chrome.runtime.lastError.message 
                });
                return;
            }
            
            console.log('[Service Worker] Storage data retrieved successfully');
            sendResponse({ success: true, data: data });
        });
    } catch (error) {
        console.error('[Service Worker] Storage request error:', error.message);
        sendResponse({ 
            success: false, 
            error: error.message 
        });
    }
}

/**
 * Handles storage data updates
 * @param {Object} message - The message object
 * @param {Object} sender - The sender information
 * @param {Function} sendResponse - The response callback
 */
function handleStorageUpdate(message, sender, sendResponse) {
    if (!isExtensionContext) {
        sendResponse({ success: false, error: 'Storage API not available in web context' });
        return;
    }

    const data = message.data || {};
    
    if (Object.keys(data).length === 0) {
        sendResponse({ 
            success: false, 
            error: 'No data provided for storage' 
        });
        return;
    }
    
    try {
        chrome.storage.local.set(data, () => {
            if (chrome.runtime.lastError) {
                console.error('[Service Worker] Storage set error:', chrome.runtime.lastError.message);
                sendResponse({ 
                    success: false, 
                    error: chrome.runtime.lastError.message 
                });
                return;
            }
            
            console.log('[Service Worker] Storage data updated successfully');
            sendResponse({ success: true });
            
            // Notify all tabs about the storage update
            if (chrome.tabs) {
                chrome.tabs.query({}, (tabs) => {
                    tabs.forEach(tab => {
                        chrome.tabs.sendMessage(tab.id, {
                            action: 'storageResult',
                            data: data
                        }).catch(error => {
                            // Ignore errors from tabs that can't receive messages
                            console.log('[Service Worker] Could not notify tab:', tab.id);
                        });
                    });
                });
            }
        });
    } catch (error) {
        console.error('[Service Worker] Storage update error:', error.message);
        sendResponse({ 
            success: false, 
            error: error.message 
        });
    }
}
