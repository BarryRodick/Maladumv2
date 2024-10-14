// scripts/main.js

import { registerServiceWorker } from './serviceWorkerRegistration.js';
import { loadData } from './dataLoader.js';
import { generateGameSelection, generateCardTypeInputs, populateDifficultySelection } from './uiGenerator.js';
import { DeckManager } from './deckManager.js';
import { setupEventListeners } from './eventHandlers.js';

(async () => {
    // Register Service Worker
    registerServiceWorker();

    // Load Data
    let data;
    let difficulties;
    try {
        const loadedData = await loadData();
        data = loadedData.cardsData;
        difficulties = loadedData.difficultiesData;
    } catch (error) {
        // Handle data loading failure
        return;
    }

    // Initialize Deck Manager
    const deckManager = new DeckManager(data, difficulties.difficulties);

    // Generate Game Selection UI
    const selectedGames = deckManager.loadSelectedGames(); // Implement this method in DeckManager if needed
    generateGameSelection(Object.keys(data.games), selectedGames);

    // Generate Card Type Inputs UI
    generateCardTypeInputs(deckManager.allCardTypes, deckManager.deckDataByType, deckManager.getCardCounts(), deckManager.sentryCardTypes, deckManager.corrupterCardTypes);

    // Populate Difficulty Selection
    populateDifficultySelection(difficulties.difficulties, deckManager.savedDifficultyIndex || 0);

    // Setup Event Listeners
    setupEventListeners(deckManager);
})();
