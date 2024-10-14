// scripts/serviceWorkerRegistration.js

export function registerServiceWorker() {
    if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
            navigator.serviceWorker.register('/service-worker.js')
                .then(registration => {
                    console.log('Service Worker registered with scope:', registration.scope);

                    // Listen for updates to the service worker
                    registration.onupdatefound = () => {
                        const installingWorker = registration.installing;
                        installingWorker.onstatechange = () => {
                            if (installingWorker.state === 'installed') {
                                if (navigator.serviceWorker.controller) {
                                    // New update available
                                    showUpdateNotification();
                                }
                            }
                        };
                    };
                })
                .catch(err => {
                    console.error('Service Worker registration failed:', err);
                });
        });
    }
}

function showUpdateNotification() {
    const updateModal = `
        <div class="modal fade" id="updateModal" tabindex="-1" role="dialog" aria-labelledby="updateModalLabel" aria-hidden="true">
          <div class="modal-dialog modal-dialog-centered" role="document">
            <div class="modal-content">
              <div class="modal-header">
                <h5 class="modal-title" id="updateModalLabel">Update Available</h5>
              </div>
              <div class="modal-body">
                A new version of the app is available. Reload to update.
              </div>
              <div class="modal-footer">
                <button type="button" class="btn btn-primary" id="reloadButton">Reload</button>
              </div>
            </div>
          </div>
        </div>
    `;
    document.body.insertAdjacentHTML('beforeend', updateModal);
    $('#updateModal').modal('show');

    document.getElementById('reloadButton').addEventListener('click', () => {
        window.location.reload();
    });
}
