// scripts/configManager.js

export function saveConfiguration(config) {
    localStorage.setItem('savedConfig', JSON.stringify(config));
    console.log('Configuration Saved:', config);
}

export function loadConfiguration() {
    const savedConfig = JSON.parse(localStorage.getItem('savedConfig'));
    if (savedConfig) {
        console.log('Loaded Configuration:', savedConfig);
        return savedConfig;
    }
    return null;
}
