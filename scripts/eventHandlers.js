// scripts/eventHandlers.js

import { saveConfiguration } from './configManager.js';
import { showToast } from './helpers.js';
import { markCardAsInPlay, clearInPlayCards } from './deckManager.js';

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
                deckManager.generateDeck(); // Pass necessary parameters
                saveConfiguration();
            }
        });
    }

    // Event listener for difficulty selection changes
    const difficultyLevel = document.getElementById('difficultyLevel');
    if (difficultyLevel) {
        difficultyLevel.addEventListener('change', () => {
            // Update difficulty details
            // This should be handled by uiGenerator
            // Here, we just regenerate the deck
            deckManager.generateDeck(); // Pass necessary parameters
            showToast('Difficulty level changed. Deck regenerated.');
        });
    }

    // Event listener for Sentry Rules checkbox
    const sentryRulesCheckbox = document.getElementById('enableSentryRules');
    if (sentryRulesCheckbox) {
        sentryRulesCheckbox.addEventListener('change', () => {
            deckManager.generateDeck(); // Pass necessary parameters
            showToast('Sentry Rules toggled. Deck regenerated.');
        });
    }

    // Event listener for Corrupter Rules checkbox
    const corrupterRulesCheckbox = document.getElementById('enableCorrupterRules');
    if (corrupterRulesCheckbox) {
        corrupterRulesCheckbox.addEventListener('change', () => {
            deckManager.generateDeck(); // Pass necessary parameters
            showToast('Corrupter Rules toggled. Deck regenerated.');
        });
    }

    // Event listener for Generate Deck button
    const generateDeckButton = document.getElementById('generateDeck');
    if (generateDeckButton) {
        generateDeckButton.addEventListener('click', () => {
            deckManager.generateDeck(); // Pass necessary parameters
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
            clearInPlayCards();
            showToast('All in-play cards have been cleared.');
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
}

export function updateInPlayCardsDisplay() {
    // This function can be implemented to update the UI for in-play cards
    // It can be similar to what was in deckManager.js
}
