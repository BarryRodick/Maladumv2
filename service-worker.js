// service-worker.js for Chrome Extension (Manifest V3)

const EXTENSION_VERSION = '1.0.0';
const CACHE_NAME = 'maladum-event-cards-v1';

// Cache resources for offline use
const urlsToCache = [
    './index.html',
    './styles.css',
    './deckbuilder.js',
    './maladumcards.json',
    './difficulties.json',
    './about.html',
    './dungeons_of_enveron.html',
    './forbidden_creed.html',
    './logos/gameicon.jpg'
];

// Install event handler
self.addEventListener('install', (event) => {
    console.log('[Service Worker] Install Event');
    
    // Skip waiting to become active immediately
    self.skipWaiting();
    
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                console.log('[Service Worker] Caching resources');
                return cache.addAll(urlsToCache);
            })
            .catch((error) => {
                console.error('[Service Worker] Failed to cache resources', error);
            })
    );
});

// Activate event handler - clean up old caches
self.addEventListener('activate', (event) => {
    console.log('[Service Worker] Activate Event');
    event.waitUntil(
        Promise.all([
            clients.claim(),
            caches.keys().then((cacheNames) => {
                return Promise.all(
                    cacheNames.filter(cacheName => cacheName !== CACHE_NAME).map(cacheName => {
                        console.log('[Service Worker] Deleting old cache:', cacheName);
                        return caches.delete(cacheName);
                    })
                );
            })
        ])
    );
});

// Fetch event handler - serve from cache, fall back to network
self.addEventListener('fetch', (event) => {
    // Skip non-GET requests
    if (event.request.method !== 'GET') return;
    
    // Skip cross-origin requests
    if (!event.request.url.startsWith(self.location.origin)) return;
    
    // For HTML documents, use a network-first strategy
    if (event.request.url.endsWith('.html') || event.request.url.endsWith('/')) {
        event.respondWith(
            fetch(event.request)
                .then(response => {
                    // Clone the response because it's a one-time use stream
                    const responseToCache = response.clone();
                    
                    // Update the cache with the fresh response
                    caches.open(CACHE_NAME)
                        .then(cache => {
                            cache.put(event.request, responseToCache);
                        });
                    
                    return response;
                })
                .catch(() => {
                    // If network fails, fall back to cache
                    return caches.match(event.request);
                })
        );
    } else {
        // For other resources, use cache-first strategy
        event.respondWith(
            caches.match(event.request)
                .then((response) => {
                    // Cache hit - return the response from the cached version
                    if (response) {
                        return response;
                    }
                    
                    // Not in cache - return the result from the live server
                    return fetch(event.request.clone())
                        .then((response) => {
                            // Check if we received a valid response
                            if (!response || response.status !== 200) {
                                return response;
                            }
                            
                            // Clone the response because it's a one-time use stream
                            const responseToCache = response.clone();
                            
                            // Add the response to the cache
                            caches.open(CACHE_NAME)
                                .then((cache) => {
                                    cache.put(event.request, responseToCache);
                                });
                                
                            return response;
                        });
                })
                .catch((error) => {
                    console.error('[Service Worker] Fetch failed:', error);
                })
        );
    }
});

// Message event handler
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log('[Service Worker] Message received:', message);
    
    if (!message || !message.action) {
        sendResponse({ success: false, error: 'Invalid message format' });
        return false;
    }
    
    switch (message.action) {
        case 'GET_VERSION':
            sendResponse({ success: true, version: EXTENSION_VERSION });
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

/**
 * Handles storage data requests
 * @param {Object} message - The message object
 * @param {Object} sender - The sender information
 * @param {Function} sendResponse - The response callback
 */
function handleStorageRequest(message, sender, sendResponse) {
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
        });
    } catch (error) {
        console.error('[Service Worker] Storage update error:', error.message);
        sendResponse({ 
            success: false, 
            error: error.message 
        });
    }
}
