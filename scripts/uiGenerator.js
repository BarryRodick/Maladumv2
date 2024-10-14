// scripts/uiGenerator.js

import { parseCardTypes, getSavedCardCount } from './helpers.js';
import { saveConfiguration } from './configManager.js';

export function generateGameSelection(games, selectedGames) {
    const gameCheckboxes = document.getElementById('gameCheckboxes');
    if (!gameCheckboxes) {
        console.error('Element with ID "gameCheckboxes" not found.');
        return;
    }
    gameCheckboxes.innerHTML = ''; // Clear existing checkboxes
    games.forEach(game => {
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.id = `game-${game}`;
        checkbox.value = game;
        checkbox.checked = selectedGames.length === 0 || selectedGames.includes(game); // Default to checked if no selection
        checkbox.classList.add('form-check-input', 'mr-2');

        const label = document.createElement('label');
        label.htmlFor = `game-${game}`;
        label.textContent = game;
        label.classList.add('form-check-label');

        const div = document.createElement('div');
        div.classList.add('form-check', 'mb-2');
        div.appendChild(checkbox);
        div.appendChild(label);

        gameCheckboxes.appendChild(div);
    });

    // If no games are selected yet, select all by default
    if (selectedGames.length === 0) {
        selectedGames.push(...games);
    }
}

export function generateCardTypeInputs(allCardTypes, deckDataByType, cardCounts, sentryCardTypes, corrupterCardTypes) {
    const cardTypeInputs = document.getElementById('cardTypeInputs');
    if (!cardTypeInputs) {
        console.error('Element with ID "cardTypeInputs" not found.');
        return;
    }
    cardTypeInputs.innerHTML = ''; // Clear previous inputs

    allCardTypes.sort(); // Sort the card types alphabetically

    allCardTypes.forEach(type => {
        // Adjust maxCount based on unique cards
        const uniqueCards = new Set(deckDataByType[type].map(card => card.id));
        const maxCount = uniqueCards.size; // Set max count to number of unique cards of this type

        const div = document.createElement('div');
        div.classList.add('card-type-input', 'col-12', 'col-md-6', 'mb-3');

        const imageName = type.replace(/\s/g, '');
        const cardHTML = `
            <div class="d-flex align-items-center">
                <img src="logos/${imageName}.jpg" alt="${type}" class="mr-2" style="width: 30px; height: 30px;">
                <span class="card-title mr-auto">${type} Cards</span>
                <button class="btn btn-sm btn-outline-secondary decrease-btn" data-type="${type}" style="margin-right: 5px;">-</button>
                <input type="number" id="type-${type}" min="0" max="${maxCount}" value="${getSavedCardCount(type)}" class="form-control form-control-sm input-count" style="width: 60px;">
                <button class="btn btn-sm btn-outline-secondary increase-btn" data-type="${type}" style="margin-left: 5px;">+</button>
            </div>
        `;

        div.innerHTML = cardHTML;
        cardTypeInputs.appendChild(div);
    });

    // Add event listeners for +/- buttons
    document.querySelectorAll('.increase-btn').forEach(button => {
        button.addEventListener('click', (e) => {
            const type = e.target.getAttribute('data-type');
            const input = document.getElementById(`type-${type}`);
            if (parseInt(input.value) < parseInt(input.max)) {
                input.value = parseInt(input.value) + 1;
                saveConfiguration(); // Save configuration after every change
            }
        });
    });

    document.querySelectorAll('.decrease-btn').forEach(button => {
        button.addEventListener('click', (e) => {
            const type = e.target.getAttribute('data-type');
            const input = document.getElementById(`type-${type}`);
            if (parseInt(input.value) > 0) {
                input.value = parseInt(input.value) - 1;
                saveConfiguration(); // Save configuration after every change
            }
        });
    });
}

export function populateDifficultySelection(difficultySettings, selectedDifficultyIndex) {
    const difficultySelect = document.getElementById('difficultyLevel');
    if (!difficultySelect) {
        console.error('Element with ID "difficultyLevel" not found.');
        return;
    }

    // Clear existing options
    difficultySelect.innerHTML = '';

    // Populate options
    difficultySettings.forEach((difficulty, index) => {
        const option = document.createElement('option');
        option.value = index; // Use index to reference the difficulty setting
        option.textContent = difficulty.name;
        option.setAttribute('data-novice', difficulty.novice);
        option.setAttribute('data-veteran', difficulty.veteran);
        difficultySelect.appendChild(option);
    });

    // Set the selected difficulty
    difficultySelect.selectedIndex = selectedDifficultyIndex;

    // Display the selected difficulty details
    updateDifficultyDetails();
}

function updateDifficultyDetails() {
    const difficultySelect = document.getElementById('difficultyLevel');
    const selectedOption = difficultySelect.options[difficultySelect.selectedIndex];
    const noviceCount = selectedOption.getAttribute('data-novice');
    const veteranCount = selectedOption.getAttribute('data-veteran');

    const difficultyDetails = document.getElementById('difficultyDetails');
    if (difficultyDetails) {
        difficultyDetails.textContent = `Novice Cards: ${noviceCount}, Veteran Cards: ${veteranCount}`;
    }

    // Update the counts for Novice and Veteran card types
    const noviceInput = document.getElementById('type-Novice');
    if (noviceInput) {
        noviceInput.value = noviceCount;
        // Add highlight class
        noviceInput.classList.add('highlight-input');

        // Remove the highlight after a short delay
        setTimeout(() => {
            noviceInput.classList.remove('highlight-input');
        }, 2000); // Highlight lasts for 2 seconds
    }

    const veteranInput = document.getElementById('type-Veteran');
    if (veteranInput) {
        veteranInput.value = veteranCount;
        // Add highlight class
        veteranInput.classList.add('highlight-input');

        // Remove the highlight after a short delay
        setTimeout(() => {
            veteranInput.classList.remove('highlight-input');
        }, 2000); // Highlight lasts for 2 seconds
    }

    // Save the updated counts
    saveConfiguration();
}
