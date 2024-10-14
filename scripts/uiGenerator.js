// scripts/uiGenerator.js

import { getSavedCardCount, getSavedSpecialCardCount, getSavedSentryCardCount } from './configManager.js';
import { showToast } from './helpers.js';

/**
 * Creates a Bootstrap form-check element.
 * @param {string} type - The type of the card.
 * @param {boolean} isSentry - Whether the card type is a Sentry.
 * @param {boolean} isCorrupter - Whether the card type is a Corrupter.
 * @param {boolean} isChecked - Whether the checkbox is checked.
 * @returns {HTMLElement} - The form-check div element.
 */
function createFormCheck(type, isSentry, isCorrupter, isChecked) {
    const div = document.createElement('div');
    div.classList.add('form-check');

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.id = `game-${type}`;
    checkbox.value = type;
    checkbox.checked = isChecked;
    checkbox.classList.add('form-check-input');

    const label = document.createElement('label');
    label.htmlFor = `game-${type}`;
    label.classList.add('form-check-label');
    label.textContent = type;

    div.appendChild(checkbox);
    div.appendChild(label);

    return div;
}

/**
 * Generates the game selection checkboxes.
 * @param {Array} games - List of available games.
 * @param {Array} selectedGames - List of games selected by the user.
 */
export function generateGameSelection(games, selectedGames) {
    const container = document.getElementById('gameCheckboxes');
    if (!container) {
        console.error('Element with ID "gameCheckboxes" not found.');
        return;
    }

    container.innerHTML = ''; // Clear existing content

    const fragment = document.createDocumentFragment();

    games.forEach(game => {
        const isChecked = selectedGames.includes(game);
        const formCheck = createFormCheck(game, false, false, isChecked);
        fragment.appendChild(formCheck);
    });

    container.appendChild(fragment);
}

/**
 * Generates input fields for card types and their counts.
 * Differentiates between regular, Sentry, and Corrupter card types.
 *
 * @param {Array} cardTypes - List of all card types.
 * @param {Object} deckDataByType - Deck data grouped by card type.
 * @param {Object} cardCounts - Current counts for each card type.
 * @param {Array} sentryCardTypes - List of Sentry card types.
 * @param {Array} corrupterCardTypes - List of Corrupter card types.
 */
export function generateCardTypeInputs(cardTypes, deckDataByType, cardCounts, sentryCardTypes, corrupterCardTypes) {
    const container = document.getElementById('cardTypeInputs');
    if (!container) {
        console.error('Element with ID "cardTypeInputs" not found.');
        return;
    }

    container.innerHTML = ''; // Clear existing content

    const fragment = document.createDocumentFragment();

    cardTypes.forEach(type => {
        const isSentry = sentryCardTypes.includes(type);
        const isCorrupter = corrupterCardTypes.includes(type);

        const cardCount = isSentry
            ? getSavedSentryCardCount(type)
            : isCorrupter
            ? getSavedSpecialCardCount(type)
            : getSavedCardCount(type);

        // Create row for input
        const row = document.createElement('div');
        row.classList.add('row', 'mb-3');

        // Create label column
        const labelCol = document.createElement('div');
        labelCol.classList.add('col-sm-4');

        const label = document.createElement('label');
        label.htmlFor = `type-${type}`;
        label.classList.add('form-label');
        label.textContent = `${type}${isSentry ? ' (Sentry)' : isCorrupter ? ' (Corrupter)' : ''}`;
        labelCol.appendChild(label);

        // Create input column
        const inputCol = document.createElement('div');
        inputCol.classList.add('col-sm-8');

        const input = document.createElement('input');
        input.type = 'number';
        input.id = `type-${type}`;
        input.classList.add('form-control', 'input-count');
        input.value = cardCount;
        input.min = '0';
        input.max = deckDataByType[type].length;
        input.setAttribute('aria-label', `Number of ${type} cards`);

        // Add event listener for real-time validation
        input.addEventListener('input', (e) => {
            const max = deckDataByType[type].length;
            let value = parseInt(e.target.value) || 0;
            if (value > max) {
                showToast(`Maximum available ${type} cards: ${max}`);
                e.target.value = max;
                value = max;
            } else if (value < 0) {
                e.target.value = 0;
                value = 0;
            }
            // Optionally, update the DeckManager or configuration here
            // deckManager.updateCardCount(type, value);
        });

        inputCol.appendChild(input);
        row.appendChild(labelCol);
        row.appendChild(inputCol);
        fragment.appendChild(row);
    });

    container.appendChild(fragment);
}

/**
 * Populates the difficulty selection dropdown.
 * @param {Array} difficulties - List of difficulty levels.
 * @param {number} selectedIndex - The index of the selected difficulty.
 */
export function populateDifficultySelection(difficulties, selectedIndex) {
    const select = document.getElementById('difficultyLevel');
    if (!select) {
        console.error('Element with ID "difficultyLevel" not found.');
        return;
    }

    select.innerHTML = ''; // Clear existing options

    const fragment = document.createDocumentFragment();

    const validIndex = (selectedIndex >= 0 && selectedIndex < difficulties.length) ? selectedIndex : 0;

    difficulties.forEach((difficulty, index) => {
        const option = document.createElement('option');
        option.value = index;
        option.textContent = difficulty.name;
        if (index === validIndex) {
            option.selected = true;
        }
        fragment.appendChild(option);
    });

    select.appendChild(fragment);
}
