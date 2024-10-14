// scripts/helpers.js

/**
 * Parses a complex type string into individual types.
 * Handles '+' (AND) and '/' (OR) separators.
 * @param {string} typeString - The type string from the card data.
 * @returns {string[]} - An array of unique types.
 */
export function parseCardTypes(typeString) {
    let andTypes = typeString.split('+').map(s => s.trim());
    let types = [];
    andTypes.forEach(part => {
        let orTypes = part.split('/').map(s => s.trim());
        types = types.concat(orTypes);
    });
    return [...new Set(types)];
}

/**
 * Shuffles an array of cards using the Fisher-Yates algorithm.
 * @param {Array} deck - The array of cards to shuffle.
 * @returns {Array} - The shuffled array of cards.
 */
export function shuffleDeck(deck) {
    let shuffled = [...deck];
    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
}

/**
 * Finds a card by its ID across all games in the data store.
 * @param {string} id - The unique identifier of the card.
 * @param {Object} dataStore - The data store containing all game data.
 * @returns {Object|null} - The card object if found, else null.
 */
export function findCardById(id, dataStore) {
    // Search in all games
    for (let game in dataStore.games) {
        const card = dataStore.games[game].find(card => card.id === id);
        if (card) return card;
    }
    console.error(`Card with ID ${id} not found.`);
    return null;
}

/**
 * Displays a Bootstrap toast notification with the given message.
 * @param {string} message - The message to display in the toast.
 */
export function showToast(message) {
    const toastContainer = document.getElementById('toastContainer');
    if (!toastContainer) {
        console.error('Element with ID "toastContainer" not found.');
        return;
    }

    const toast = document.createElement('div');
    toast.classList.add('toast', 'show', 'align-items-center', 'text-white', 'bg-secondary', 'border-0');
    toast.setAttribute('role', 'alert');
    toast.setAttribute('aria-live', 'assertive');
    toast.setAttribute('aria-atomic', 'true');

    const toastBody = document.createElement('div');
    toastBody.classList.add('d-flex');
    const toastMessage = document.createElement('div');
    toastMessage.classList.add('toast-body');
    toastMessage.textContent = message;
    toastBody.appendChild(toastMessage);

    const closeButton = document.createElement('button');
    closeButton.type = 'button';
    closeButton.classList.add('ml-auto', 'mb-1', 'close');
    closeButton.setAttribute('data-dismiss', 'toast');
    closeButton.setAttribute('aria-label', 'Close');
    closeButton.innerHTML = '<span aria-hidden="true">&times;</span>';
    toastBody.appendChild(closeButton);

    toast.appendChild(toastBody);
    toastContainer.appendChild(toast);

    // Automatically remove the toast after 3 seconds
    setTimeout(() => {
        $(toast).toast('hide');
        toast.addEventListener('hidden.bs.toast', () => {
            toast.remove();
        });
    }, 3000);
}
