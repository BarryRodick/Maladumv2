// scripts/configManager.js

/**
 * Saves the current configuration to localStorage.
 * @param {Object} config - The configuration object to save.
 */
export function saveConfiguration(config) {
    try {
        localStorage.setItem('deckBuilderConfig', JSON.stringify(config));
    } catch (error) {
        console.error('Error saving configuration:', error);
    }
}

/**
 * Loads the configuration from localStorage.
 * @returns {Object|null} - The loaded configuration object or null if not found.
 */
export function loadConfiguration() {
    try {
        const configString = localStorage.getItem('deckBuilderConfig');
        if (configString) {
            return JSON.parse(configString);
        }
        return null;
    } catch (error) {
        console.error('Error loading configuration:', error);
        return null;
    }
}

/**
 * Initializes the configuration with default values if not present.
 * @param {Object} defaultConfig - The default configuration to initialize.
 */
export function initializeConfiguration(defaultConfig) {
    if (!loadConfiguration()) {
        saveConfiguration(defaultConfig);
    }
}

/**
 * Retrieves the saved card count for a specific type from the configuration.
 * @param {string} type - The card type.
 * @returns {number} - The saved count or 0 if not found.
 */
export function getSavedCardCount(type) {
    const config = loadConfiguration();
    if (config && config.cardCounts && config.cardCounts[type] !== undefined) {
        return config.cardCounts[type];
    }
    return 0;
}

/**
 * Retrieves the saved special card count for a specific type from the configuration.
 * @param {string} type - The special card type (e.g., Sentry, Corrupter).
 * @returns {number} - The saved count or 0 if not found.
 */
export function getSavedSpecialCardCount(type) {
    const config = loadConfiguration();
    if (config && config.specialCardCounts && config.specialCardCounts[type] !== undefined) {
        return config.specialCardCounts[type];
    }
    return 0;
}

/**
 * Retrieves the saved Sentry card count for a specific type from the configuration.
 * @param {string} type - The Sentry card type.
 * @returns {number} - The saved count or 0 if not found.
 */
export function getSavedSentryCardCount(type) {
    const config = loadConfiguration();
    if (config && config.sentryCardCounts && config.sentryCardCounts[type] !== undefined) {
        return config.sentryCardCounts[type];
    }
    return 0;
}
