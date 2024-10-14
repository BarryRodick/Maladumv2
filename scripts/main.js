// scripts/main.js

import { registerServiceWorker } from './serviceWorkerRegistration.js';
import { loadData } from './dataLoader.js';
import { generateGameSelection, generateCardTypeInputs, populateDifficultySelection } from './uiGenerator.js';
import { initializeDeckManager, showCurrentCard, applyCardAction } from './deckManager.js';
import { setupEventListeners } from './eventHandlers.js';
import { loadConfiguration } from './configManager.js';

(async () => {
    // Register Service Worker
    registerServiceWorker();

    // Load Data
    const { cardsData, difficultiesData } = await loadData();

    // Initialize Deck Manager
    const selectedGames = []; // Initialize as empty; will be populated by UI
    const deckManager = initializeDeckManager(cardsData, difficultiesData, Object.keys(cardsData.games));

    // Generate Game Selection UI
    generateGameSelection(Object.keys(cardsData.games), deckManager.selectedGames);

    // Generate Card Type Inputs UI
    deckManager.groupCardsByType();
    generateCardTypeInputs(deckManager.allCardTypes, deckManager.deckDataByType, deckManager.cardCounts, deckManager.sentryCardTypes, deckManager.corrupterCardTypes);

    // Populate Difficulty Selection
    populateDifficultySelection(difficultiesData.difficulties, deckManager.savedDifficultyIndex || 0);

    // Setup Event Listeners
    setupEventListeners(deckManager);
})();
