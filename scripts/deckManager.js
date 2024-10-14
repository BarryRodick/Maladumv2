// scripts/deckManager.js

import { parseCardTypes, shuffleDeck, findCardById, showToast } from './helpers.js';
import { saveConfiguration, loadConfiguration, getSavedCardCount, getSavedSpecialCardCount, getSavedSentryCardCount } from './configManager.js';

/**
 * Deck Manager Module
 * Handles deck generation, shuffling, and navigation.
 */
export class DeckManager {
    constructor(dataStore, difficultySettings) {
        this.dataStore = dataStore;
        this.difficultySettings = difficultySettings;
        this.selectedGames = [];
        this.allCardTypes = [];
        this.deckDataByType = {};
        this.regularDeck = [];
        this.specialDeck = [];
        this.sentryDeck = [];
        this.currentDeck = [];
        this.currentIndex = -1;
        this.discardPile = [];
        this.availableCards = [];
        this.inPlayCards = [];
        this.setAsideCards = [];
        this.initialDeckSize = 0;
        this.selectedCardsMap = new Map();
        this.sentryCardTypes = ['Sentry']; // Define your Sentry types
        this.corrupterCardTypes = ['Corrupter']; // Define your Corrupter types
        this.heldBackCardTypes = ['HeldBack']; // Define your Held Back types
    }

    /**
     * Initializes the Deck Manager with selected games.
     * @param {Array} selectedGames - The list of selected games.
     */
    initialize(selectedGames) {
        this.selectedGames = selectedGames.length > 0 ? selectedGames : Object.keys(this.dataStore.games);
        this.groupCardsByType();
        this.loadConfiguration();
    }

    /**
     * Groups cards by their types.
     */
    groupCardsByType() {
        this.deckDataByType = {};
        this.allCardTypes = [];

        let allCards = [];
        this.selectedGames.forEach(game => {
            if (this.dataStore.games[game]) {
                allCards = allCards.concat(this.dataStore.games[game]);
            }
        });

        this.availableCards = [...allCards];

        allCards.forEach(card => {
            let types = parseCardTypes(card.type);
            types.forEach(type => {
                if (!this.deckDataByType[type]) {
                    this.deckDataByType[type] = [];
                    this.allCardTypes.push(type);
                }
                this.deckDataByType[type].push({ ...card });
            });
        });

        this.allCardTypes = [...new Set(this.allCardTypes)];
    }

    /**
     * Retrieves selected games from localStorage or returns an empty array.
     * @returns {Array} - The list of selected games.
     */
    loadSelectedGames() {
        const config = loadConfiguration();
        if (config && config.selectedGames) {
            return config.selectedGames;
        }
        return [];
    }

    /**
     * Retrieves card counts from localStorage or returns default counts.
     * @returns {Object} - The card counts by type.
     */
    getCardCounts() {
        const counts = {};
        this.allCardTypes.forEach(type => {
            if (this.sentryCardTypes.includes(type)) {
                counts[type] = getSavedSentryCardCount(type);
            } else if (this.corrupterCardTypes.includes(type)) {
                counts[type] = getSavedSpecialCardCount(type);
            } else {
                counts[type] = getSavedCardCount(type);
            }
        });
        return counts;
    }

    /**
     * Generates the deck based on user-selected counts and rules.
     * @param {Object} cardCounts - Regular card counts by type.
     * @param {Object} specialCardCounts - Special card counts by type (Corrupter).
     * @param {Object} sentryCardCounts - Sentry card counts by type.
     * @param {boolean} isSentryEnabled - Flag to enable Sentry rules.
     * @param {boolean} isCorrupterEnabled - Flag to enable Corrupter rules.
     */
    generateDeck(cardCounts, specialCardCounts, sentryCardCounts, isSentryEnabled, isCorrupterEnabled) {
        if (this.selectedGames.length === 0) {
            showToast('Please select at least one game.');
            return;
        }

        this.currentIndex = -1;
        this.regularDeck = [];
        this.specialDeck = [];
        this.sentryDeck = [];
        this.discardPile = [];
        this.selectedCardsMap.clear();
        this.setAsideCards = [];

        // Set aside held back cards
        this.availableCards = this.availableCards.filter(card => {
            let types = parseCardTypes(card.type);
            if (types.some(type => this.heldBackCardTypes.includes(type))) {
                this.setAsideCards.push(card);
                return false;
            }
            return true;
        });

        // Select regular cards
        this.allCardTypes.forEach(type => {
            if (this.sentryCardTypes.includes(type) && isSentryEnabled) return;
            if (this.corrupterCardTypes.includes(type) && isCorrupterEnabled) return;
            if (this.heldBackCardTypes.includes(type)) return;

            const count = cardCounts[type];
            if (count > 0) {
                const selected = this.selectCardsByType(type, count, cardCounts, false);
                this.regularDeck = this.regularDeck.concat(selected);
            }
        });

        // Select Corrupter cards
        this.allCardTypes.forEach(type => {
            if (this.corrupterCardTypes.includes(type) && isCorrupterEnabled) {
                const count = specialCardCounts[type];
                if (count > 0) {
                    const selected = this.selectCardsByType(type, count, specialCardCounts, true);
                    this.specialDeck = this.specialDeck.concat(selected);
                }
            }
        });

        // Select Sentry cards
        this.allCardTypes.forEach(type => {
            if (this.sentryCardTypes.includes(type) && isSentryEnabled) {
                const count = sentryCardCounts[type];
                if (count > 0) {
                    const selected = this.selectCardsByType(type, count, sentryCardCounts, true);
                    this.sentryDeck = this.sentryDeck.concat(selected);
                }
            }
        });

        // Select held back cards
        this.heldBackCardTypes.forEach(type => {
            const count = cardCounts[type];
            if (count > 0) {
                const selected = this.selectHeldBackCardsByType(type, count);
                this.regularDeck = this.regularDeck.concat(selected);
            }
        });

        // Apply Corrupter Rules
        if (isCorrupterEnabled && this.regularDeck.length >= 5) {
            // Remove 5 random cards
            const removed = [];
            for (let i = 0; i < 5; i++) {
                const index = Math.floor(Math.random() * this.regularDeck.length);
                removed.push(this.regularDeck.splice(index, 1)[0]);
            }

            // Replace with Corrupter cards
            const corrupterCards = this.getSpecialCards(5, this.corrupterCardTypes);
            this.regularDeck = this.regularDeck.concat(corrupterCards);
        } else if (isCorrupterEnabled) {
            showToast('Not enough cards to apply Corrupter Rules.');
        }

        // Shuffle the regular deck
        this.regularDeck = shuffleDeck(this.regularDeck);

        // Combine decks
        this.currentDeck = this.regularDeck.concat(this.specialDeck);

        this.initialDeckSize = this.currentDeck.length;

        // Save configuration
        this.saveCurrentConfiguration();

        // Display the deck
        this.displayDeck();
    }

    // ... [Rest of the DeckManager class methods as previously provided] ...

    /**
     * Saves the current configuration to localStorage.
     */
    saveCurrentConfiguration() {
        const config = {
            selectedGames: this.selectedGames,
            selectedDifficultyIndex: this.savedDifficultyIndex || 0,
            cardCounts: {}, // Populate based on UI or internal state
            specialCardCounts: {}, // Populate based on UI or internal state
            sentryCardCounts: {}, // Populate based on UI or internal state
            enableSentryRules: document.getElementById('enableSentryRules')?.checked || false,
            enableCorrupterRules: document.getElementById('enableCorrupterRules')?.checked || false,
            currentDeckIds: this.currentDeck.map(card => card.id),
            currentIndex: this.currentIndex,
            discardPileIds: this.discardPile.map(card => card.id),
            inPlayCardIds: this.inPlayCards.map(card => card.id),
            initialDeckSize: this.initialDeckSize,
            sentryDeckIds: this.sentryDeck.map(card => card.id)
        };

        // Populate cardCounts, specialCardCounts, sentryCardCounts based on UI inputs
        const cardTypeInputs = document.querySelectorAll('.input-count');
        cardTypeInputs.forEach(input => {
            const type = input.id.replace('type-', '');
            const value = parseInt(input.value) || 0;
            if (this.sentryCardTypes.includes(type) && config.enableSentryRules) {
                config.sentryCardCounts[type] = value;
            } else if (this.corrupterCardTypes.includes(type) && config.enableCorrupterRules) {
                config.specialCardCounts[type] = value;
            } else {
                config.cardCounts[type] = value;
            }
        });

        // Save to localStorage
        saveConfiguration(config);
    }

    /**
     * Loads the configuration from localStorage.
     */
    loadConfiguration() {
        const savedConfig = loadConfiguration();
        if (savedConfig) {
            this.selectedGames = savedConfig.selectedGames || [];
            this.savedDifficultyIndex = savedConfig.selectedDifficultyIndex || 0;
            this.currentDeck = savedConfig.currentDeckIds.map(id => findCardById(id, this.dataStore)) || [];
            this.currentIndex = savedConfig.currentIndex || -1;
            this.discardPile = savedConfig.discardPileIds.map(id => findCardById(id, this.dataStore)) || [];
            this.inPlayCards = savedConfig.inPlayCardIds.map(id => findCardById(id, this.dataStore)) || [];
            this.initialDeckSize = savedConfig.initialDeckSize || 0;
            this.sentryDeck = savedConfig.sentryDeckIds.map(id => findCardById(id, this.dataStore)) || [];
        }
    }

    // ... [Continue with other DeckManager methods as needed] ...



    /**
     * Resets available cards without affecting user inputs.
     */
    resetAvailableCards() {
        let allCards = [];
        this.selectedGames.forEach(game => {
            if (this.dataStore.games[game]) {
                allCards = allCards.concat(this.dataStore.games[game]);
            }
        });

        this.availableCards = [...allCards];
    }

    /**
     * Shuffles the entire regular deck.
     */
    shuffleRegularDeck() {
        this.regularDeck = shuffleDeck(this.regularDeck);
    }
}
