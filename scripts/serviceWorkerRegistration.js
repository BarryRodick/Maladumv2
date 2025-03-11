// scripts/serviceWorkerRegistration.js

/**
 * Registers the service worker.
 */
export async function registerServiceWorker() {
    if ('serviceWorker' in navigator) {
        try {
            const registration = await navigator.serviceWorker.register('/Maladumv2/service-worker.js', {
                scope: '/Maladumv2/'
            });
            console.log('Service Worker registered with scope:', registration.scope);

            registration.addEventListener('updatefound', () => {
                const installingWorker = registration.installing;
                if (installingWorker) {
                    installingWorker.addEventListener('statechange', () => {
                        if (installingWorker.state === 'installed' && navigator.serviceWorker.controller) {
                            console.log('New content is available; please refresh.');
                        }
                    });
                }
            });
        } catch (error) {
            console.error('Service Worker registration failed:', error);
        }
    } else {
        console.log('Service Workers are not supported in this browser.');
    }
}
