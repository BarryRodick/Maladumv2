// scripts/eventHandlers.js

import { saveConfiguration } from './configManager.js';
import { showToast, shuffleDeck } from './helpers.js';

/**
 * Sets up event listeners for various UI elements.
 * @param {DeckManager} deckManager - The instance of DeckManager.
 */
export function setupEventListeners(deckManager) {
    // Event listener for game selection changes
    const gameCheckboxes = document.getElementById('gameCheckboxes');
    if (gameCheckboxes) {
        gameCheckboxes.addEventListener('change', (event) => {
            if (event.target && event.target.matches('input[type="checkbox"]')) {
                // Update selectedGames based on checked boxes
                const checkedBoxes = Array.from(gameCheckboxes.querySelectorAll('input[type="checkbox"]:checked'));
                const selectedGames = checkedBoxes.map(checkbox => checkbox.value);
                deckManager.selectedGames = selectedGames;

                // Regenerate card types and save configuration
                deckManager.groupCardsByType();
                const cardCounts = getCurrentCardCounts();
                const specialCardCounts = getCurrentSpecialCardCounts();
                const sentryCardCounts = getCurrentSentryCardCounts();
                const isSentryEnabled = document.getElementById('enableSentryRules')?.checked || false;
                const isCorrupterEnabled = document.getElementById('enableCorrupterRules')?.checked || false;
                deckManager.generateDeck(cardCounts, specialCardCounts, sentryCardCounts, isSentryEnabled, isCorrupterEnabled);
                deckManager.saveCurrentConfiguration();
            }
        });
    }

    // Event listener for difficulty selection changes
    const difficultyLevel = document.getElementById('difficultyLevel');
    if (difficultyLevel) {
        difficultyLevel.addEventListener('change', () => {
            // Update difficulty details based on selection
            const selectedIndex = parseInt(difficultyLevel.value) || 0;
            deckManager.savedDifficultyIndex = selectedIndex;

            // Regenerate the deck with the new difficulty settings
            const cardCounts = getCurrentCardCounts();
            const specialCardCounts = getCurrentSpecialCardCounts();
            const sentryCardCounts = getCurrentSentryCardCounts();
            const isSentryEnabled = document.getElementById('enableSentryRules')?.checked || false;
            const isCorrupterEnabled = document.getElementById('enableCorrupterRules')?.checked || false;
            deckManager.generateDeck(cardCounts, specialCardCounts, sentryCardCounts, isSentryEnabled, isCorrupterEnabled);
            deckManager.saveCurrentConfiguration();

            showToast('Difficulty level changed. Deck regenerated.');
        });
    }

    // Event listener for Sentry Rules checkbox
    const sentryRulesCheckbox = document.getElementById('enableSentryRules');
    if (sentryRulesCheckbox) {
        sentryRulesCheckbox.addEventListener('change', () => {
            const isSentryEnabled = sentryRulesCheckbox.checked;
            const cardCounts = getCurrentCardCounts();
            const specialCardCounts = getCurrentSpecialCardCounts();
            const sentryCardCounts = getCurrentSentryCardCounts();
            const isCorrupterEnabled = document.getElementById('enableCorrupterRules')?.checked || false;
            deckManager.generateDeck(cardCounts, specialCardCounts, sentryCardCounts, isSentryEnabled, isCorrupterEnabled);
            deckManager.saveCurrentConfiguration();

            showToast('Sentry Rules toggled. Deck regenerated.');
        });
    }

    // Event listener for Corrupter Rules checkbox
    const corrupterRulesCheckbox = document.getElementById('enableCorrupterRules');
    if (corrupterRulesCheckbox) {
        corrupterRulesCheckbox.addEventListener('change', () => {
            const isCorrupterEnabled = corrupterRulesCheckbox.checked;
            const cardCounts = getCurrentCardCounts();
            const specialCardCounts = getCurrentSpecialCardCounts();
            const sentryCardCounts = getCurrentSentryCardCounts();
            const isSentryEnabled = document.getElementById('enableSentryRules')?.checked || false;
            deckManager.generateDeck(cardCounts, specialCardCounts, sentryCardCounts, isSentryEnabled, isCorrupterEnabled);
            deckManager.saveCurrentConfiguration();

            showToast('Corrupter Rules toggled. Deck regenerated.');
        });
    }

    // Event listener for Generate Deck button
    const generateDeckButton = document.getElementById('generateDeck');
    if (generateDeckButton) {
        generateDeckButton.addEventListener('click', () => {
            const cardCounts = getCurrentCardCounts();
            const specialCardCounts = getCurrentSpecialCardCounts();
            const sentryCardCounts = getCurrentSentryCardCounts();
            const isSentryEnabled = document.getElementById('enableSentryRules')?.checked || false;
            const isCorrupterEnabled = document.getElementById('enableCorrupterRules')?.checked || false;
            deckManager.generateDeck(cardCounts, specialCardCounts, sentryCardCounts, isSentryEnabled, isCorrupterEnabled);
        });
    }

    // Event listeners for navigation buttons
    const prevCardButton = document.getElementById('prevCard');
    if (prevCardButton) {
        prevCardButton.addEventListener('click', () => {
            if (deckManager.currentIndex > -1) {
                deckManager.discardPile.pop();
                deckManager.currentIndex--;
                deckManager.showCurrentCard();
                saveConfiguration();
            }
        });
    }

    const nextCardButton = document.getElementById('nextCard');
    if (nextCardButton) {
        nextCardButton.addEventListener('click', () => {
            // Move the current card to the discard pile if it's not the starting card
            if (deckManager.currentIndex >= 0 && deckManager.currentIndex < deckManager.currentDeck.length) {
                deckManager.discardPile.push(deckManager.currentDeck[deckManager.currentIndex]);
            }

            deckManager.currentIndex++;

            if (deckManager.currentIndex >= deckManager.currentDeck.length) {
                if (deckManager.discardPile.length > 0) {
                    // Reshuffle the discard pile to form a new deck
                    deckManager.currentDeck = shuffleDeck(deckManager.discardPile);
                    deckManager.initialDeckSize = deckManager.currentDeck.length;
                    deckManager.discardPile = [];
                    deckManager.currentIndex = -1; // Reset to start of new deck
                    showToast('Deck reshuffled from discard pile.');
                } else {
                    // No more cards left to draw
                    showToast('No more cards in the deck.');
                    deckManager.currentIndex--; // Stay at the last card
                    return;
                }
            }

            deckManager.showCurrentCard();
            saveConfiguration();
        });
    }

    // Event listener for "Clear In-Play Cards" button
    const clearInPlayCardsButton = document.getElementById('clearInPlayCards');
    if (clearInPlayCardsButton) {
        clearInPlayCardsButton.addEventListener('click', () => {
            deckManager.clearInPlayCards();
        });
    }

    // Event listener for Apply Card Action button
    const applyCardActionButton = document.getElementById('applyCardAction');
    if (applyCardActionButton) {
        applyCardActionButton.addEventListener('click', () => {
            const cardActionSelect = document.getElementById('cardAction');
            const selectedAction = cardActionSelect.value;
            const actionNInput = document.getElementById('actionN');
            let n = parseInt(actionNInput.value) || 0;

            if (selectedAction === '') {
                showToast('Please select a card action.');
                return;
            }

            deckManager.applyCardAction(selectedAction, n);
        });
    }

    // Event listener for Card Action selection changes
    const cardActionSelect = document.getElementById('cardAction');
    if (cardActionSelect) {
        cardActionSelect.addEventListener('change', () => {
            const selectedAction = cardActionSelect.value;
            const topNInput = document.getElementById('actionTopNInput');
            if (selectedAction === 'shuffleTopN') {
                if (topNInput) {
                    topNInput.style.display = 'block';
                }
            } else {
                if (topNInput) {
                    topNInput.style.display = 'none';
                }
            }
        });
    }

    // Event listener for card type input changes using event delegation
    const cardTypeInputsContainer = document.getElementById('cardTypeInputs');
    if (cardTypeInputsContainer) {
        cardTypeInputsContainer.addEventListener('input', (event) => {
            if (event.target && event.target.matches('.input-count')) {
                const type = event.target.id.replace('type-', '');
                const count = parseInt(event.target.value) || 0;
                // Optionally, you can implement methods in DeckManager to update counts dynamically
                // For simplicity, we'll regenerate the deck with updated counts
                const cardCounts = getCurrentCardCounts();
                const specialCardCounts = getCurrentSpecialCardCounts();
                const sentryCardCounts = getCurrentSentryCardCounts();
                const isSentryEnabled = document.getElementById('enableSentryRules')?.checked || false;
                const isCorrupterEnabled = document.getElementById('enableCorrupterRules')?.checked || false;
                deckManager.generateDeck(cardCounts, specialCardCounts, sentryCardCounts, isSentryEnabled, isCorrupterEnabled);
            }
        });
    }
}

/**
 * Retrieves current card counts from the UI.
 * @returns {Object} - Card counts by type.
 */
function getCurrentCardCounts() {
    const counts = {};
    const inputs = document.querySelectorAll('.input-count');
    inputs.forEach(input => {
        const type = input.id.replace('type-', '');
        const value = parseInt(input.value) || 0;
        counts[type] = value;
    });
    return counts;
}

/**
 * Retrieves current special card counts (Corrupters) from the UI.
 * @returns {Object} - Special card counts by type.
 */
function getCurrentSpecialCardCounts() {
    const counts = {};
    const inputs = document.querySelectorAll('.input-count');
    inputs.forEach(input => {
        const type = input.id.replace('type-', '');
        if (['Corrupter'].includes(type)) { // Adjust as per your actual special types
            const value = parseInt(input.value) || 0;
            counts[type] = value;
        }
    });
    return counts;
}

/**
 * Retrieves current sentry card counts from the UI.
 * @returns {Object} - Sentry card counts by type.
 */
function getCurrentSentryCardCounts() {
    const counts = {};
    const inputs = document.querySelectorAll('.input-count');
    inputs.forEach(input => {
        const type = input.id.replace('type-', '');
        if (['Sentry'].includes(type)) { // Adjust as per your actual sentry types
            const value = parseInt(input.value) || 0;
            counts[type] = value;
        }
    });
    return counts;
}
