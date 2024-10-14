// scripts/uiGenerator.js

import { getSavedCardCount, getSavedSpecialCardCount, getSavedSentryCardCount } from './configManager.js';

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

    games.forEach(game => {
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.id = `game-${game}`;
        checkbox.value = game;
        checkbox.checked = selectedGames.includes(game);

        const label = document.createElement('label');
        label.htmlFor = `game-${game}`;
        label.textContent = game;

        const div = document.createElement('div');
        div.classList.add('form-check');

        div.appendChild(checkbox);
        div.appendChild(label);

        container.appendChild(div);
    });
}

/**
 * Generates input fields for card types and their counts.
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

    cardTypes.forEach(type => {
        const isSentry = sentryCardTypes.includes(type);
        const isCorrupter = corrupterCardTypes.includes(type);

        const cardCount = isSentry
            ? getSavedSentryCardCount(type)
            : isCorrupter
            ? getSavedSpecialCardCount(type)
            : getSavedCardCount(type);

        const div = document.createElement('div');
        div.classList.add('card-type-input', 'd-flex', 'align-items-center', 'justify-content-between');

        const label = document.createElement('label');
        label.htmlFor = `type-${type}`;
        label.classList.add('card-title');
        label.textContent = type;

        const input = document.createElement('input');
        input.type = 'number';
        input.id = `type-${type}`;
        input.classList.add('form-control', 'input-count');
        input.value = cardCount;
        input.min = '0';

        div.appendChild(label);
        div.appendChild(input);

        container.appendChild(div);
    });
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

    difficulties.forEach((difficulty, index) => {
        const option = document.createElement('option');
        option.value = index;
        option.textContent = difficulty.name;
        if (index === selectedIndex) {
            option.selected = true;
        }
        select.appendChild(option);
    });
}
