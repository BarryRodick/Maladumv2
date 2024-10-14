// scripts/dataLoader.js

import { showToast } from './helpers.js';

/**
 * Loads JSON data for cards and difficulties.
 * @returns {Promise<{cardsData: Object, difficultiesData: Object}>}
 */
export async function loadData() {
    try {
        const [cardsResponse, difficultiesResponse] = await Promise.all([
            fetch('../data/maladumcards.json'),
            fetch('../data/difficulties.json')
        ]);

        if (!cardsResponse.ok || !difficultiesResponse.ok) {
            throw new Error('Failed to fetch data files.');
        }

        const cardsData = await cardsResponse.json();
        const difficultiesData = await difficultiesResponse.json();

        return { cardsData, difficultiesData };
    } catch (error) {
        console.error('Error loading data:', error);
        showToast('Failed to load application data. Please try again later.');
        throw error;
    }
}
