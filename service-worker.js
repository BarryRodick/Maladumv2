// service-worker.js for Chrome Extension (Manifest V3)

const CACHE_NAME = 'maladum-cache-v1';
const BASE_PATH = '/Maladumv2';
const ASSETS_TO_CACHE = [
    `${BASE_PATH}/`,
    `${BASE_PATH}/index.html`,
    `${BASE_PATH}/styles.css`,
    `${BASE_PATH}/scripts/main.js`,
    `${BASE_PATH}/scripts/dataLoader.js`,
    `${BASE_PATH}/scripts/helpers.js`,
    `${BASE_PATH}/scripts/deckManager.js`,
    `${BASE_PATH}/data/maladumcards.json`,
    `${BASE_PATH}/data/difficulties.json`
];

// Install event handler
self.addEventListener('install', (event) => {
    console.log('[Service Worker] Install Event');
    self.skipWaiting();
    
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                console.log('[Service Worker] Caching resources');
                return cache.addAll(ASSETS_TO_CACHE);
            })
            .catch((error) => {
                console.error('[Service Worker] Failed to cache resources', error);
            })
    );
});

// Activate event handler
self.addEventListener('activate', (event) => {
    console.log('[Service Worker] Activate Event');
    event.waitUntil(
        Promise.all([
            clients.claim(),
            caches.keys().then((cacheNames) => {
                return Promise.all(
                    cacheNames.map((cacheName) => {
                        if (cacheName !== CACHE_NAME) {
                            console.log('[Service Worker] Deleting old cache:', cacheName);
                            return caches.delete(cacheName);
                        }
                    })
                );
            })
        ])
    );
});

// Fetch event handler
self.addEventListener('fetch', (event) => {
    if (event.request.method !== 'GET') return;

    // Handle JSON file requests specifically
    if (event.request.url.endsWith('.json')) {
        event.respondWith(
            fetch(event.request)
                .then(response => {
                    if (!response.ok) {
                        throw new Error('Network response was not ok');
                    }
                    const clonedResponse = response.clone();
                    caches.open(CACHE_NAME).then(cache => {
                        cache.put(event.request, clonedResponse);
                    });
                    return response;
                })
                .catch(error => {
                    console.error('Error fetching JSON:', error);
                    return caches.match(event.request);
                })
        );
        return;
    }

    event.respondWith(
        caches.match(event.request)
            .then(response => {
                if (response) {
                    return response;
                }
                return fetch(event.request)
                    .then(networkResponse => {
                        if (!networkResponse || networkResponse.status !== 200) {
                            return networkResponse;
                        }
                        const responseToCache = networkResponse.clone();
                        caches.open(CACHE_NAME)
                            .then(cache => {
                                cache.put(event.request, responseToCache);
                            });
                        return networkResponse;
                    });
            })
    );
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
