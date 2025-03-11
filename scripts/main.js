// scripts/main.js

import { registerServiceWorker } from './serviceWorkerRegistration.js';
import { loadData } from './dataLoader.js';
import { DeckManager } from './deckManager.js';
import { showToast } from './helpers.js';

// Check if storage is available
function isStorageAvailable() {
    try {
        const storage = window.localStorage;
        const x = '__storage_test__';
        storage.setItem(x, x);
        storage.removeItem(x);
        return true;
    } catch (e) {
        return false;
    }
}

// Safe storage operations
const storage = {
    get: (key) => {
        if (!isStorageAvailable()) return null;
        try {
            const item = localStorage.getItem(key);
            return item ? JSON.parse(item) : null;
        } catch (e) {
            console.error('Error reading from storage:', e);
            return null;
        }
    },
    set: (key, value) => {
        if (!isStorageAvailable()) return false;
        try {
            localStorage.setItem(key, JSON.stringify(value));
            return true;
        } catch (e) {
            console.error('Error writing to storage:', e);
            return false;
        }
    },
    remove: (key) => {
        if (!isStorageAvailable()) return;
        try {
            localStorage.removeItem(key);
        } catch (e) {
            console.error('Error removing from storage:', e);
        }
    }
};

document.addEventListener('DOMContentLoaded', async () => {
    // Register Service Worker
    await registerServiceWorker();

    try {
        // Load Data
        const { cardsData, difficultiesData } = await loadData();
        
        // Initialize Deck Manager
        const deckManager = new DeckManager(cardsData, difficultiesData.difficulties);
        
        // Initialize UI
        initializeUI(deckManager);
        
        // Load saved state if exists
        loadSavedState(deckManager);
        
    } catch (error) {
        console.error('Error initializing application:', error);
        showToast('Failed to initialize the application. Please refresh the page.');
    }
});

function initializeUI(deckManager) {
    const difficultySelect = document.getElementById('difficultyLevel');
    if (difficultySelect) {
        // Initialize difficulty options
        deckManager.difficulties.forEach((difficulty, index) => {
            const option = document.createElement('option');
            option.value = index;
            option.textContent = difficulty.name;
            difficultySelect.appendChild(option);
        });

        // Set saved difficulty if exists
        const savedState = storage.get('deckState');
        if (savedState && savedState.difficulty !== undefined) {
            difficultySelect.value = savedState.difficulty;
        }
    } else {
        console.warn('Difficulty selector not found');
    }

    // Initialize game selection
    const gameSelection = document.getElementById('gameCheckboxes');
    if (gameSelection && deckManager.games) {
        Object.keys(deckManager.games).forEach(gameId => {
            const game = deckManager.games[gameId];
            const checkbox = createGameCheckbox(gameId, game.name);
            gameSelection.appendChild(checkbox);
        });
    } else {
        console.warn('Game selection container not found or no games available');
    }
}

function createGameCheckbox(gameId, gameName) {
    const container = document.createElement('div');
    container.className = 'form-check';

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.id = `game-${gameId}`;
    checkbox.className = 'form-check-input';
    checkbox.value = gameId;

    const label = document.createElement('label');
    label.className = 'form-check-label';
    label.htmlFor = `game-${gameId}`;
    label.textContent = gameName;

    container.appendChild(checkbox);
    container.appendChild(label);

    // Set saved state if exists
    const savedState = storage.get('deckState');
    if (savedState && savedState.selectedGames) {
        checkbox.checked = savedState.selectedGames.includes(gameId);
    }

    return container;
}

function loadSavedState(deckManager) {
    const savedState = storage.get('deckState');
    if (savedState) {
        try {
            deckManager.restoreState(savedState);
            // Update UI to reflect restored state
            updateUIFromState(savedState);
        } catch (error) {
            console.error('Error restoring saved state:', error);
            storage.remove('deckState'); // Clear potentially corrupted state
        }
    }
}

function updateUIFromState(state) {
    // Update difficulty
    const difficultySelect = document.getElementById('difficultyLevel');
    if (difficultySelect && state.difficulty !== undefined) {
        difficultySelect.value = state.difficulty;
    }

    // Update game selections
    if (state.selectedGames) {
        state.selectedGames.forEach(gameId => {
            const checkbox = document.getElementById(`game-${gameId}`);
            if (checkbox) {
                checkbox.checked = true;
            }
        });
    }

    // Update other UI elements based on state...
}
