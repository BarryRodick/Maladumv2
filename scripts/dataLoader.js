// scripts/dataLoader.js

import { showToast } from './helpers.js';

/**
 * Loads JSON data for cards and difficulties.
 * @param {string} cardsPath - Path to the cards JSON file.
 * @param {string} difficultiesPath - Path to the difficulties JSON file.
 * @returns {Promise<{cardsData: Object, difficultiesData: Object}>}
 */
export async function loadData(cardsPath = '../data/maladumcards.json', difficultiesPath = '../data/difficulties.json') {
    try {
        const [cardsResponse, difficultiesResponse] = await Promise.all([
            fetch(cardsPath),
            fetch(difficultiesPath)
        ]);

        if (!cardsResponse.ok || !difficultiesResponse.ok) {
            throw new Error('Failed to fetch data files.');
        }

        const cardsData = await cardsResponse.json();
        const difficultiesData = await difficultiesResponse.json();

        // Confirmation messages
        console.log('Successfully loaded maladumcards.json');
        console.log('Successfully loaded difficulties.json');

        return { cardsData, difficultiesData };
    } catch (error) {
        console.error('Error loading data:', error);
        showToast('Failed to load application data. Please try again later.');
        throw error;
    }
}
