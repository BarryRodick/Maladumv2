// scripts/main.js

import { registerServiceWorker } from './serviceWorkerRegistration.js';
import { loadData } from './dataLoader.js';
import { generateGameSelection, generateCardTypeInputs, populateDifficultySelection } from './uiGenerator.js';
import { DeckManager } from './deckManager.js';
import { setupEventListeners } from './eventHandlers.js';
import { initializeConfiguration } from './configManager.js';
import { showToast } from './helpers.js';

(async () => {
    // Register Service Worker
    registerServiceWorker();

    // Initialize Configuration with Defaults if Needed
    const defaultConfig = {
        selectedGames: [],
        selectedDifficultyIndex: 0,
        cardCounts: {},
        specialCardCounts: {},
        sentryCardCounts: {},
        enableSentryRules: false,
        enableCorrupterRules: false,
        currentDeckIds: [],
        currentIndex: -1,
        discardPileIds: [],
        inPlayCardIds: [],
        initialDeckSize: 0,
        sentryDeckIds: []
    };
    initializeConfiguration(defaultConfig);

    // Load Data
    let data;
    let difficulties;
    try {
        const loadedData = await loadData();
        data = loadedData.cardsData;
        difficulties = loadedData.difficultiesData;
    } catch (error) {
        // Handle data loading failure
        showToast('Application data could not be loaded. Please refresh the page.');
        return;
    }

    // Initialize Deck Manager
    const deckManager = new DeckManager(data, difficulties.difficulties);
    const selectedGames = deckManager.loadSelectedGames();
    deckManager.initialize(selectedGames);

    // Generate Game Selection UI
    generateGameSelection(Object.keys(data.games), selectedGames);

    // Generate Card Type Inputs UI
    generateCardTypeInputs(deckManager.allCardTypes, deckManager.deckDataByType, deckManager.getCardCounts(), deckManager.sentryCardTypes, deckManager.corrupterCardTypes);

    // Populate Difficulty Selection
    populateDifficultySelection(difficulties, deckManager.savedDifficultyIndex || 0);

    // Setup Event Listeners
    setupEventListeners(deckManager);

    // Optionally, generate the initial deck if not loaded from configuration
    if (!deckManager.currentDeck.length) {
        const cardCounts = deckManager.getCardCounts();
        const specialCardCounts = deckManager.getSpecialCardCounts();
        const sentryCardCounts = deckManager.getSentryCardCounts();
        const isSentryEnabled = document.getElementById('enableSentryRules')?.checked || false;
        const isCorrupterEnabled = document.getElementById('enableCorrupterRules')?.checked || false;
        deckManager.generateDeck(cardCounts, specialCardCounts, sentryCardCounts, isSentryEnabled, isCorrupterEnabled);
    }
})();
