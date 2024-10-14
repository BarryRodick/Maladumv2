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
        this.savedDifficultyIndex = 0;
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
     * Retrieves special card counts (Corrupters) from localStorage or UI.
     * @returns {Object} - Special card counts by type.
     */
    getSpecialCardCounts() {
        const counts = {};
        this.corrupterCardTypes.forEach(type => {
            counts[type] = getSavedSpecialCardCount(type);
        });
        return counts;
    }

    /**
     * Retrieves sentry card counts from localStorage or UI.
     * @returns {Object} - Sentry card counts by type.
     */
    getSentryCardCounts() {
        const counts = {};
        this.sentryCardTypes.forEach(type => {
            counts[type] = getSavedSentryCardCount(type);
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
    generateDeck(cardCounts = this.getCardCounts(), specialCardCounts = this.getSpecialCardCounts(), sentryCardCounts = this.getSentryCardCounts(), isSentryEnabled = false, isCorrupterEnabled = false) {
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
        this.corrupterCardTypes.forEach(type => {
            if (isCorrupterEnabled) {
                const count = specialCardCounts[type];
                if (count > 0) {
                    const selected = this.selectCardsByType(type, count, specialCardCounts, true);
                    this.specialDeck = this.specialDeck.concat(selected);
                }
            }
        });

        // Select Sentry cards
        this.sentryCardTypes.forEach(type => {
            if (isSentryEnabled) {
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
        this.currentDeck = this.regularDeck.concat(this.specialDeck).concat(this.sentryDeck);

        this.initialDeckSize = this.currentDeck.length;

        // Save configuration
        this.saveCurrentConfiguration();

        // Display the deck
        this.displayDeck();
    }

    /**
     * Selects a specified number of cards from a given type.
     * @param {string} type - The card type.
     * @param {number} count - Number of cards to select.
     * @param {Object} counts - The current counts object.
     * @param {boolean} isSpecial - Flag indicating if the card is special.
     * @returns {Array} - Array of selected cards.
     */
    selectCardsByType(type, count, counts, isSpecial = false) {
        const available = this.deckDataByType[type] || [];
        if (available.length < count) {
            showToast(`Not enough cards available for type: ${type}`);
            return [];
        }
        // Shuffle available cards before selection
        const shuffled = shuffleDeck(available);
        const selected = shuffled.slice(0, count);
        // Remove selected cards from availableCards to prevent duplicates
        this.availableCards = this.availableCards.filter(card => !selected.includes(card));
        // Update selectedCardsMap
        selected.forEach(card => this.selectedCardsMap.set(card.id, card));
        return selected;
    }

    /**
     * Selects held-back cards by type.
     * @param {string} type - The held-back card type.
     * @param {number} count - Number of cards to select.
     * @returns {Array} - Array of selected held-back cards.
     */
    selectHeldBackCardsByType(type, count) {
        const available = this.deckDataByType[type] || [];
        if (available.length < count) {
            showToast(`Not enough held-back cards available for type: ${type}`);
            return [];
        }
        const shuffled = shuffleDeck(available);
        const selected = shuffled.slice(0, count);
        // These cards are set aside and not part of the current deck
        this.setAsideCards = this.setAsideCards.concat(selected);
        return selected;
    }

    /**
     * Retrieves a specified number of special cards from given types.
     * @param {number} count - Number of special cards to retrieve.
     * @param {Array} specialTypes - Array of special card types.
     * @returns {Array} - Array of selected special cards.
     */
    getSpecialCards(count, specialTypes) {
        let specialCards = [];
        specialTypes.forEach(type => {
            const available = this.deckDataByType[type] || [];
            specialCards = specialCards.concat(available);
        });
        if (specialCards.length < count) {
            showToast('Not enough special cards available.');
            return [];
        }
        return shuffleDeck(specialCards).slice(0, count);
    }

    /**
     * Saves the current configuration to localStorage.
     */
    saveCurrentConfiguration() {
        const config = {
            selectedGames: this.selectedGames,
            selectedDifficultyIndex: this.savedDifficultyIndex || 0,
            cardCounts: this.getCardCounts(),
            specialCardCounts: this.getSpecialCardCounts(),
            sentryCardCounts: this.getSentryCardCounts(),
            enableSentryRules: document.getElementById('enableSentryRules')?.checked || false,
            enableCorrupterRules: document.getElementById('enableCorrupterRules')?.checked || false,
            currentDeckIds: this.currentDeck.map(card => card.id),
            currentIndex: this.currentIndex,
            discardPileIds: this.discardPile.map(card => card.id),
            inPlayCardIds: this.inPlayCards.map(card => card.id),
            initialDeckSize: this.initialDeckSize,
            sentryDeckIds: this.sentryDeck.map(card => card.id)
        };

        // Save to localStorage
        saveConfiguration(config);
    }

    /**
     * Loads the configuration from localStorage.
     */
    loadConfiguration() {
        const savedConfig = loadConfiguration();
        if (savedConfig) {
            this.selectedGames = savedConfig.selectedGames || this.selectedGames;
            this.savedDifficultyIndex = savedConfig.selectedDifficultyIndex || 0;
            this.currentDeck = savedConfig.currentDeckIds.map(id => findCardById(id, this.dataStore)).filter(card => card) || [];
            this.currentIndex = savedConfig.currentIndex || -1;
            this.discardPile = savedConfig.discardPileIds.map(id => findCardById(id, this.dataStore)).filter(card => card) || [];
            this.inPlayCards = savedConfig.inPlayCardIds.map(id => findCardById(id, this.dataStore)).filter(card => card) || [];
            this.initialDeckSize = savedConfig.initialDeckSize || this.currentDeck.length;
            this.sentryDeck = savedConfig.sentryDeckIds.map(id => findCardById(id, this.dataStore)).filter(card => card) || [];

            // Display the deck and current card
            this.displayDeck();
            this.showCurrentCard();
            this.updateInPlayCardsDisplay();
        }
    }

    /**
     * Displays the entire deck in the UI.
     */
    displayDeck() {
        const deckContainer = document.getElementById('deckContainer');
        if (deckContainer) {
            deckContainer.innerHTML = ''; // Clear existing deck display
            this.currentDeck.forEach((card, index) => {
                const cardElement = document.createElement('div');
                cardElement.classList.add('card-item', 'mb-2', 'p-2', 'border', 'rounded');
                cardElement.textContent = `${index + 1}. ${card.name} - ${card.type}`;
                deckContainer.appendChild(cardElement);
            });
        }
    }

    /**
     * Displays the current card based on the current index.
     */
    showCurrentCard() {
        const currentCardDisplay = document.getElementById('currentCardDisplay');
        if (currentCardDisplay) {
            if (this.currentIndex >= 0 && this.currentIndex < this.currentDeck.length) {
                const currentCard = this.currentDeck[this.currentIndex];
                currentCardDisplay.textContent = `Card ${this.currentIndex + 1}/${this.currentDeck.length}: ${currentCard.name} - ${currentCard.description}`;
            } else {
                currentCardDisplay.textContent = 'No current card to display.';
            }
        }
    }

    /**
     * Applies a selected action to the deck.
     * @param {string} action - The action to apply.
     * @param {number} n - The number associated with the action (if applicable).
     */
    applyCardAction(action, n) {
        switch(action) {
            case 'shuffleTopN':
                if (n > 0 && n <= this.currentDeck.length) {
                    const topNCards = this.currentDeck.slice(0, n);
                    const shuffledTop = shuffleDeck(topNCards);
                    this.currentDeck = shuffledTop.concat(this.currentDeck.slice(n));
                    showToast(`Top ${n} cards shuffled.`);
                    this.displayDeck();
                } else {
                    showToast('Invalid number of cards to shuffle.');
                }
                break;
            // Implement other actions as needed
            default:
                showToast('Selected action is not implemented.');
        }
        this.saveCurrentConfiguration();
    }

    /**
     * Marks a card as in play.
     * @param {Object} card - The card to mark as in play.
     */
    markCardAsInPlay(card) {
        if (!this.inPlayCards.includes(card)) {
            this.inPlayCards.push(card);
            this.saveCurrentConfiguration();
            this.updateInPlayCardsDisplay();
        }
    }

    /**
     * Clears all in-play cards.
     */
    clearInPlayCards() {
        this.inPlayCards = [];
        this.saveCurrentConfiguration();
        this.updateInPlayCardsDisplay();
        showToast('All in-play cards have been cleared.');
    }

    /**
     * Updates the in-play cards display in the UI.
     */
    updateInPlayCardsDisplay() {
        const inPlayContainer = document.getElementById('inPlayContainer');
        if (inPlayContainer) {
            inPlayContainer.innerHTML = '';
            this.inPlayCards.forEach(card => {
                const cardElement = document.createElement('div');
                cardElement.classList.add('in-play-card', 'mb-2', 'p-2', 'border', 'rounded');
                cardElement.textContent = `${card.name} - ${card.type}`;
                inPlayContainer.appendChild(cardElement);
            });
        }
    }
}
