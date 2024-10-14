// service-worker.js

const CACHE_NAME = 'deck-builder-cache-v1';
const urlsToCache = [
    '/',
    '/index.html',
    '/scripts/main.js',
    '/scripts/helpers.js',
    '/scripts/configManager.js',
    '/scripts/dataLoader.js',
    '/scripts/deckManager.js',
    '/scripts/eventHandlers.js',
    '/scripts/uiGenerator.js',
    '/scripts/serviceWorkerRegistration.js',
    '/data/maladumcards.json',
    '/data/difficulties.json',
    // Add other assets like CSS, images, etc.
];

// Install event - caching assets
self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => {
                console.log('Opened cache');
                return cache.addAll(urlsToCache);
            })
            .catch(error => {
                console.error('Failed to cache during install:', error);
            })
    );
});

// Fetch event - serving cached assets
self.addEventListener('fetch', event => {
    // Only handle GET requests
    if (event.request.method !== 'GET') return;

    event.respondWith(
        caches.match(event.request)
            .then(response => {
                // Cache hit - return the response
                if (response) {
                    return response;
                }
                // Clone the request as it's a stream and can only be consumed once
                const fetchRequest = event.request.clone();

                return fetch(fetchRequest).then(
                    networkResponse => {
                        // Check for a valid response
                        if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
                            return networkResponse;
                        }

                        // Clone the response as it's a stream and can only be consumed once
                        const responseToCache = networkResponse.clone();

                        caches.open(CACHE_NAME)
                            .then(cache => {
                                cache.put(event.request, responseToCache);
                            })
                            .catch(error => {
                                console.error('Failed to cache the fetched resource:', error);
                            });

                        return networkResponse;
                    }
                ).catch(error => {
                    console.error('Fetch failed:', error);
                    // Optionally, return a fallback page or resource
                });
            })
    );
});

// Activate event - cleaning up old caches
self.addEventListener('activate', event => {
    const cacheWhitelist = [CACHE_NAME];
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cacheName => {
                    if (!cacheWhitelist.includes(cacheName)) {
                        console.log('Deleting old cache:', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
});
