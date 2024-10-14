// scripts/deckManager.js

import { parseCardTypes, shuffleDeck, findCardById, showToast } from './helpers.js';
import { saveConfiguration, loadConfiguration } from './configManager.js';

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

    /**
     * Selects a specified number of cards by type.
     * @param {string} type - The type of cards to select.
     * @param {number} count - The number of cards to select.
     * @param {Object} cardCounts - The card counts by type.
     * @param {boolean} isSpecial - Flag indicating if selecting special cards.
     * @returns {Array} - The selected cards.
     */
    selectCardsByType(type, count, cardCounts, isSpecial) {
        let selected = [];

        let cardsOfType = this.availableCards.filter(card => {
            let types = parseCardTypes(card.type);
            return types.includes(type);
        });

        let shuffled = shuffleDeck(cardsOfType);

        for (let card of shuffled) {
            if (selected.length >= count) break;

            if (this.selectedCardsMap.has(card.id)) continue;

            // Handle '+' types
            let andTypes = card.type.split('+').map(s => s.trim());

            if (andTypes.length > 1) {
                let canSelect = true;
                for (let part of andTypes) {
                    let orTypes = part.split('/').map(s => s.trim());
                    if (!orTypes.some(t => cardCounts[t] > 0)) {
                        canSelect = false;
                        break;
                    }
                }

                if (canSelect) {
                    selected.push(card);
                    this.selectedCardsMap.set(card.id, true);

                    // Decrement counts
                    andTypes.forEach(part => {
                        let orTypes = part.split('/').map(s => s.trim());
                        for (let t of orTypes) {
                            if (cardCounts[t] > 0) {
                                cardCounts[t]--;
                                break;
                            }
                        }
                    });
                }
            } else {
                if (cardCounts[type] > 0) {
                    selected.push(card);
                    this.selectedCardsMap.set(card.id, true);
                    cardCounts[type]--;
                }
            }
        }

        return selected;
    }

    /**
     * Selects held back cards by type.
     * @param {string} type - The type of held back cards.
     * @param {number} count - The number of held back cards to select.
     * @returns {Array} - The selected held back cards.
     */
    selectHeldBackCardsByType(type, count) {
        let selected = [];

        let cardsOfType = this.setAsideCards.filter(card => {
            let types = parseCardTypes(card.type);
            return types.includes(type);
        });

        let shuffled = shuffleDeck(cardsOfType);

        for (let card of shuffled) {
            if (selected.length >= count) break;

            if (this.selectedCardsMap.has(card.id)) continue;

            selected.push(card);
            this.selectedCardsMap.set(card.id, true);
        }

        return selected;
    }

    /**
     * Retrieves special cards (Sentry or Corrupter) based on the type.
     * @param {number} count - The number of special cards to retrieve.
     * @param {Array} specialTypes - The list of special card types.
     * @returns {Array} - The selected special cards.
     */
    getSpecialCards(count, specialTypes) {
        let specialCards = [];
        specialTypes.forEach(type => {
            if (this.deckDataByType[type]) {
                specialCards = specialCards.concat(this.deckDataByType[type]);
            }
        });

        if (specialCards.length === 0) {
            showToast('No special cards available.');
            return [];
        }

        let shuffled = shuffleDeck([...specialCards]);
        return shuffled.slice(0, count);
    }

    /**
     * Displays the current card in the deck.
     */
    displayDeck() {
        const output = document.getElementById('deckOutput');
        const navButtons = document.getElementById('navigationButtons');
        const deckProgress = document.getElementById('deckProgress');

        if (!output || !navButtons || !deckProgress) {
            console.error('One or more required elements for deck display are missing.');
            return;
        }

        if (this.currentDeck.length === 0) {
            output.innerHTML = '<p>No cards selected.</p>';
            navButtons.style.display = 'none';
            deckProgress.style.display = 'none';
        } else {
            navButtons.style.display = 'block';
            deckProgress.style.display = 'block';
            this.showCurrentCard();
        }
    }

    /**
     * Shows the current card based on the currentIndex.
     */
    showCurrentCard() {
        const output = document.getElementById('deckOutput');
        if (!output) {
            console.error('Element with ID "deckOutput" not found.');
            return;
        }
        output.style.opacity = 0; // Start with transparent

        setTimeout(() => {
            output.innerHTML = ''; // Clear previous content

            let contentHTML = '';

            if (this.currentIndex === -1) {
                // Display back.jpg
                contentHTML = `
                    <div class="card-item text-center">
                        <strong>Start the Game</strong><br>
                        <img src="cardimages/back.jpg" alt="Card Back" class="card-image img-fluid mt-2">
                    </div>
                `;
            } else {
                const card = this.currentDeck[this.currentIndex];
                if (!card) {
                    contentHTML = `<p>Card not found.</p>`;
                } else {
                    const isSpecialCard = ((this.sentryCardTypes.includes(card.type) && document.getElementById('enableSentryRules').checked) ||
                                           (this.corrupterCardTypes.includes(card.type) && document.getElementById('enableCorrupterRules').checked));

                    // Use .png extension for card images
                    const imagePath = card.contents.replace(/\.\w+$/, '.png');
                    contentHTML = `
                        <div class="card-item text-center">
                            <strong>${card.card}</strong>${card.type ? ` (${card.type})` : ''}
                            ${isSpecialCard ? `<span class="badge badge-warning ml-2">Special</span>` : ''}
                            <br>
                            <img src="cardimages/${imagePath}" alt="${card.card}" class="card-image img-fluid mt-2">
                        </div>
                    `;

                    // Add "Mark as In Play" button if not already in play
                    if (!this.isCardInPlay(card)) {
                        contentHTML += `
                            <button id="markAsInPlay" class="btn btn-primary mt-2">Mark as In Play</button>
                        `;
                    }
                }
            }

            output.innerHTML = contentHTML;

            // Update progress bar
            this.updateProgressBar();

            // Fade in
            output.style.opacity = 1;

            // Scroll the card display area into view
            output.scrollIntoView({ behavior: 'smooth', block: 'center' });

            // Add event listener for "Mark as In Play" button
            if (document.getElementById('markAsInPlay')) {
                document.getElementById('markAsInPlay').addEventListener('click', () => {
                    this.markCardAsInPlay(this.currentDeck[this.currentIndex]);
                });
            }
        }, 200);
    }

    /**
     * Updates the progress bar based on the current card position.
     */
    updateProgressBar() {
        const progressBar = document.getElementById('progressBar');
        if (!progressBar) {
            console.error('Element with ID "progressBar" not found.');
            return;
        }

        let totalCards = this.initialDeckSize + 1; // Including the back card
        let currentCardNumber = this.currentIndex + 2; // +2 because currentIndex starts at -1

        if (currentCardNumber > totalCards) {
            currentCardNumber = totalCards;
        }

        let progressPercentage = (currentCardNumber / totalCards) * 100;

        progressBar.style.width = `${progressPercentage}%`;
        progressBar.setAttribute('aria-valuenow', progressPercentage.toFixed(0));

        progressBar.textContent = `Card ${currentCardNumber} of ${totalCards}`;
    }

    /**
     * Checks if a card is already in play.
     * @param {Object} card - The card to check.
     * @returns {boolean} - True if the card is in play, else false.
     */
    isCardInPlay(card) {
        return this.inPlayCards.some(inPlayCard => inPlayCard.id === card.id);
    }

    /**
     * Marks a card as in play.
     * @param {Object} card - The card to mark as in play.
     */
    markCardAsInPlay(card) {
        if (!this.isCardInPlay(card)) {
            this.inPlayCards.push(card);
            this.updateInPlayCardsDisplay();
            showToast(`Card "${card.card}" marked as in play.`);
            this.saveCurrentConfiguration();
        } else {
            showToast(`Card "${card.card}" is already in play.`);
        }
    }

    /**
     * Updates the display of in-play cards.
     */
    updateInPlayCardsDisplay() {
        const inPlayContainer = document.getElementById('inPlayCards');
        const inPlaySection = document.getElementById('inPlaySection');
        if (!inPlayContainer || !inPlaySection) {
            console.error('Elements with IDs "inPlayCards" or "inPlaySection" not found.');
            return;
        }
        inPlayContainer.innerHTML = ''; // Clear previous content

        if (this.inPlayCards.length === 0) {
            inPlayContainer.innerHTML = '<p>No cards in play.</p>';
            inPlaySection.style.display = 'none';
            return;
        }

        this.inPlayCards.forEach(card => {
            const cardDiv = document.createElement('div');
            cardDiv.classList.add('card', 'mb-2');
            cardDiv.style.width = '100%';

            const cardBody = document.createElement('div');
            cardBody.classList.add('card-body');

            const cardTitle = document.createElement('h5');
            cardTitle.classList.add('card-title');
            cardTitle.textContent = card.card;

            const cardImage = document.createElement('img');
            cardImage.src = `cardimages/${card.contents.replace(/\.\w+$/, '.png')}`;
            cardImage.alt = card.card;
            cardImage.classList.add('card-img-top', 'mb-2');

            const removeButton = document.createElement('button');
            removeButton.classList.add('btn', 'btn-danger', 'btn-sm');
            removeButton.textContent = 'Remove from Play';
            removeButton.addEventListener('click', () => {
                this.removeCardFromPlay(card);
            });

            cardBody.appendChild(cardTitle);
            cardBody.appendChild(cardImage);
            cardBody.appendChild(removeButton);
            cardDiv.appendChild(cardBody);
            inPlayContainer.appendChild(cardDiv);
        });

        // Show the In Play section
        inPlaySection.style.display = 'block';
    }

    /**
     * Removes a card from the in-play list.
     * @param {Object} card - The card to remove.
     */
    removeCardFromPlay(card) {
        this.inPlayCards = this.inPlayCards.filter(inPlayCard => inPlayCard.id !== card.id);
        this.updateInPlayCardsDisplay();
        showToast(`Card "${card.card}" removed from play.`);
        this.saveCurrentConfiguration();
    }

    /**
     * Clears all in-play cards.
     */
    clearInPlayCards() {
        this.inPlayCards = [];
        this.updateInPlayCardsDisplay();
        showToast('All in-play cards have been cleared.');
        this.saveCurrentConfiguration();
    }

    /**
     * Applies a selected action to the current card.
     * @param {string} action - The action to apply.
     * @param {number} n - The number parameter for certain actions.
     */
    applyCardAction(action, n) {
        if (this.currentIndex === -1) {
            showToast('No active card to perform action on.');
            return;
        }

        const activeCard = this.currentDeck[this.currentIndex];
        if (!activeCard) {
            showToast('Active card not found.');
            return;
        }

        switch (action) {
            case 'shuffleAnywhere':
                // Shuffle active card back into the remaining deck
                this.currentDeck.splice(this.currentIndex, 1);
                this.regularDeck.push(activeCard);
                this.regularDeck = shuffleDeck(this.regularDeck);
                this.currentDeck = this.regularDeck.concat(this.specialDeck);
                this.currentIndex--; // Move back to previous card
                showToast(`Card "${activeCard.card}" shuffled back into the deck.`);
                break;

            case 'shuffleTopN':
                if (n <= 0) {
                    showToast('Please enter a valid number for N.');
                    return;
                }

                const remainingCards = this.currentDeck.length - (this.currentIndex + 1);
                if (remainingCards <= 0) {
                    showToast('No cards ahead to shuffle into.');
                    return;
                }

                // Adjust n if necessary
                if (n > remainingCards) {
                    n = remainingCards;
                }

                // Remove active card from currentDeck
                const [removedCard] = this.currentDeck.splice(this.currentIndex, 1);

                // Get next N cards
                const nextNCards = this.currentDeck.slice(this.currentIndex, this.currentIndex + n);

                // Create tempDeck with activeCard and nextNCards
                let tempDeck = nextNCards.concat(removedCard);

                // Shuffle tempDeck
                tempDeck = shuffleDeck(tempDeck);

                // Replace next N cards in currentDeck with tempDeck
                this.currentDeck.splice(this.currentIndex, n, ...tempDeck);

                // Move currentIndex back to previous card
                this.currentIndex--;

                showToast(`Card "${activeCard.card}" shuffled into the next ${n} cards.`);
                break;

            case 'replaceSameType':
                // Replace active card with an unseen card of the same type
                const type = activeCard.type;
                const unseenCards = this.availableCards.filter(card => parseCardTypes(card.type).includes(type) && !this.selectedCardsMap.has(card.id));
                if (unseenCards.length === 0) {
                    showToast(`No unseen cards available of type "${type}".`);
                    return;
                }
                const replacementCard = unseenCards[Math.floor(Math.random() * unseenCards.length)];
                this.currentDeck[this.currentIndex] = replacementCard;
                this.selectedCardsMap.set(replacementCard.id, true); // Mark the replacement card as selected
                showToast(`Card "${activeCard.card}" replaced with "${replacementCard.card}".`);
                break;

            case 'introduceSentry':
                if (!this.sentryDeck || this.sentryDeck.length === 0) {
                    showToast('No Sentry cards available to introduce.');
                    return;
                }

                // Extract the remaining deck after the current card
                const remainingDeckAfterCurrent = this.currentDeck.slice(this.currentIndex + 1);

                // Merge sentryDeck with the remaining deck
                const mergedDeck = shuffleDeck([...remainingDeckAfterCurrent, ...this.sentryDeck]);

                // Update currentDeck by keeping cards up to currentIndex + 1 and appending the shuffled merged deck
                this.currentDeck = this.currentDeck.slice(0, this.currentIndex + 1).concat(mergedDeck);

                showToast(`All Sentry cards have been shuffled into the remaining deck.`);

                // Clear the sentryDeck as they have been introduced
                this.sentryDeck = [];

                break;

            default:
                showToast('Unknown card action selected.');
                break;
        }

        // Reset card action selection
        const cardActionSelect = document.getElementById('cardAction');
        if (cardActionSelect) {
            cardActionSelect.value = '';
        }
        const topNInput = document.getElementById('actionTopNInput');
        if (topNInput) {
            topNInput.style.display = 'none';
        }

        // Update deck display and save configuration
        this.displayDeck();
        this.updateInPlayCardsDisplay();
        this.saveCurrentConfiguration();
    }

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
