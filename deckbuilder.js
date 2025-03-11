// deckbuilder.js

// ============================
// 1. Service Worker Registration
// ============================

if ('serviceWorker' in navigator) {
    window.addEventListener('load', async () => {
        try {
            const registration = await navigator.serviceWorker.register('/Maladumv2/service-worker.js', {
                scope: '/Maladumv2/'
            });
            console.log('Service Worker registered with scope:', registration.scope);

            // Listen for updates to the service worker
            registration.addEventListener('updatefound', () => {
                const installingWorker = registration.installing;
                if (installingWorker) {
                    installingWorker.addEventListener('statechange', () => {
                        if (installingWorker.state === 'installed' && navigator.serviceWorker.controller) {
                            // New update available
                            showUpdateNotification();
                        }
                    });
                }
            });
        } catch (error) {
            console.error('Service Worker registration failed:', error);
            // Continue without service worker functionality
            initializeWithoutServiceWorker();
        }
    });

    navigator.serviceWorker.addEventListener('message', (event) => {
        if (event.data.type === 'NEW_VERSION') {
            showUpdateNotification(event.data.version);
        }
    });
} else {
    console.log('Service Workers are not supported in this browser');
    initializeWithoutServiceWorker();
}

function initializeWithoutServiceWorker() {
    // Initialize the app without service worker features
    document.addEventListener('DOMContentLoaded', () => {
        // Enable dark mode by default
        document.body.classList.add('dark-mode');
        
        // Load saved configuration
        const savedConfig = loadConfiguration();
        
        // Load saved state
        const savedState = loadState();
        
        // Initialize UI elements
        initializeUI();
        
        // Load data directly without service worker caching
        Promise.all([
            fetch('data/maladumcards.json').then(response => response.json()),
            fetch('data/difficulties.json').then(response => response.json())
        ])
        .then(([cardsData, difficultiesData]) => {
            // Initialize with loaded data
            initializeWithData(cardsData, difficultiesData, savedConfig, savedState);
        })
        .catch(error => {
            console.error('Error loading data:', error);
            showErrorMessage('Failed to load game data. Please check your connection and refresh the page.');
        });
    });
}

// Function to show an update notification to the user
function showUpdateNotification(newVersion) {
    const updateModal = `
        <div class="modal fade" id="updateModal" tabindex="-1" role="dialog" aria-labelledby="updateModalLabel" aria-hidden="true">
            <div class="modal-dialog modal-dialog-centered" role="document">
                <div class="modal-content bg-dark text-white">
                    <div class="modal-header">
                        <h5 class="modal-title" id="updateModalLabel">New Version Available</h5>
                        <button type="button" class="close text-white" data-dismiss="modal" aria-label="Close">
                            <span aria-hidden="true">&times;</span>
                        </button>
                    </div>
                    <div class="modal-body">
                        <p>A new version (${newVersion}) of the app is available.</p>
                        <p>Update now to get the latest features and improvements.</p>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" data-dismiss="modal">Later</button>
                        <button type="button" class="btn btn-primary" id="updateNowButton">Update Now</button>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    // Remove existing update modal if present
    const existingModal = document.getElementById('updateModal');
    if (existingModal) {
        existingModal.remove();
    }
    
    document.body.insertAdjacentHTML('beforeend', updateModal);
    const modal = $('#updateModal');
    modal.modal('show');

    document.getElementById('updateNowButton').addEventListener('click', () => {
        // Clear cache and reload
        if ('caches' in window) {
            caches.keys().then(cacheNames => {
                return Promise.all(
                    cacheNames.map(cacheName => caches.delete(cacheName))
                );
            }).then(() => {
                window.location.reload(true);
            });
        } else {
            window.location.reload(true);
        }
    });
}

// ============================
// 1. Constants and Configuration
// ============================

// Define a single storage key for consistency
const STORAGE_KEYS = {
  CONFIG: 'deckbuilderConfig',
  STATE: 'deckbuilderState',
  VERSION: 'deckbuilderVersion'
};

// Current state version for migration handling
const CURRENT_STATE_VERSION = '1.0';

// Configuration defaults
const CONFIG = {
  defaultDifficulty: 0,
  storage: {
    enabled: true
  }
};

// ============================
// 2. State Management
// ============================

// Single unified state object
const state = {
  version: CURRENT_STATE_VERSION,
  deck: {
    main: [],           // Regular cards
    special: [],        // Special cards
    sentry: [],         // Sentry cards (when using Sentry rules)
    combined: [],       // Combined deck (main + special)
    discard: [],        // Discarded cards
    inPlay: []          // Cards currently in play
  },
  currentIndex: -1,
  selectedGames: [],
  cardCounts: {},
  specialCardCounts: {},
  sentryCardCounts: {},
  corrupterCardCounts: {},
  settings: {
    enableSentryRules: false,
    enableCorrupterRules: false,
    selectedDifficultyIndex: 0
  },
  ui: {
    darkMode: true
  },
  dataLoaded: false
};

// Data store for card information
let dataStore = {
  games: {},
  sentryTypes: [],
  corrupterTypes: [],
  heldBackCardTypes: []
};

// Settings for difficulty levels
let difficultySettings = [];

// Flag for deferred restoration
let deferredRestoration = null;

// ============================
// 3. Storage Utilities
// ============================

/**
 * Checks if localStorage is available and working
 * @returns {boolean} True if storage is available
 */
function isStorageAvailable() {
  if (!CONFIG.storage.enabled) return false;
  
  try {
    const storage = window.localStorage;
    const x = '__storage_test__';
    storage.setItem(x, x);
    storage.removeItem(x);
    return true;
  } catch (e) {
    console.warn('Local storage is not available:', e);
    // Distinguish between different error types
    if (e instanceof DOMException && (
      e.code === 22 || // quota exceeded
      e.code === 1014 || // Safari private mode
      e.name === 'QuotaExceededError' ||
      e.name === 'NS_ERROR_DOM_QUOTA_REACHED'
    )) {
      console.error('Storage quota exceeded');
    } else {
      console.error('Storage is disabled');
    }
    return false;
  }
}

/**
 * Saves the current state to localStorage
 * @returns {boolean} True if save was successful
 */
function saveState() {
  if (!isStorageAvailable()) return false;
  
  try {
    const stateToSave = {
      version: state.version,
      deck: {
        main: state.deck.main,
        special: state.deck.special,
        sentry: state.deck.sentry,
        combined: state.deck.combined,
        discard: state.deck.discard,
        inPlay: state.deck.inPlay
      },
      currentIndex: state.currentIndex,
      selectedGames: state.selectedGames,
      cardCounts: state.cardCounts,
      specialCardCounts: state.specialCardCounts,
      sentryCardCounts: state.sentryCardCounts,
      corrupterCardCounts: state.corrupterCardCounts,
      settings: {
        enableSentryRules: state.settings.enableSentryRules,
        enableCorrupterRules: state.settings.enableCorrupterRules,
        selectedDifficultyIndex: state.settings.selectedDifficultyIndex
      },
      ui: {
        darkMode: state.ui.darkMode
      }
    };
    
    localStorage.setItem(STORAGE_KEYS.STATE, JSON.stringify(stateToSave));
    return true;
  } catch (e) {
    console.error('Error saving state:', e);
    return false;
  }
}

/**
 * Loads state from localStorage
 * @returns {Object|null} The loaded state or null if not available
 */
function loadState() {
  if (!isStorageAvailable()) return null;
  
  try {
    const savedState = localStorage.getItem(STORAGE_KEYS.STATE);
    if (!savedState) return null;
    
    const parsedState = JSON.parse(savedState);
    
    // Version check for migrations
    if (!parsedState.version || parsedState.version !== CURRENT_STATE_VERSION) {
      console.log(`Migrating state from ${parsedState.version || 'unknown'} to ${CURRENT_STATE_VERSION}`);
      // Implement migration logic here if needed
    }
    
    return parsedState;
  } catch (e) {
    console.error('Error loading state:', e);
    // Create backup of corrupted state for recovery
    if (localStorage.getItem(STORAGE_KEYS.STATE)) {
      localStorage.setItem(`${STORAGE_KEYS.STATE}_backup_${Date.now()}`, 
                          localStorage.getItem(STORAGE_KEYS.STATE));
    }
    return null;
  }
}

/**
 * Saves configuration settings
 * @returns {boolean} True if save was successful
 */
function saveConfiguration() {
  if (!isStorageAvailable()) return false;
  
  try {
    const config = {
      selectedGames: state.selectedGames,
      cardCounts: state.cardCounts,
      specialCardCounts: state.specialCardCounts,
      sentryCardCounts: state.sentryCardCounts,
      corrupterCardCounts: state.corrupterCardCounts,
      settings: {
        enableSentryRules: state.settings.enableSentryRules,
        enableCorrupterRules: state.settings.enableCorrupterRules,
        selectedDifficultyIndex: state.settings.selectedDifficultyIndex
      }
    };
    
    localStorage.setItem(STORAGE_KEYS.CONFIG, JSON.stringify(config));
    return true;
  } catch (e) {
    console.error('Error saving configuration:', e);
    return false;
  }
}

/**
 * Loads configuration from localStorage
 * @returns {Object|null} The loaded configuration or null if not available
 */
function loadConfiguration() {
  if (!isStorageAvailable()) return null;
  
  try {
    const savedConfig = localStorage.getItem(STORAGE_KEYS.CONFIG);
    if (!savedConfig) return null;
    
    return JSON.parse(savedConfig);
  } catch (e) {
    console.error('Error loading configuration:', e);
    return null;
  }
}

// ============================
// 4. Initialization and Data Loading
// ============================

/**
 * Initializes UI elements
 */
function initializeUI() {
  // Initialize event listeners for UI elements
  
  // Dark mode toggle
  const darkModeToggle = document.getElementById('darkModeToggle');
  if (darkModeToggle) {
    darkModeToggle.addEventListener('change', () => {
      state.ui.darkMode = darkModeToggle.checked;
      if (state.ui.darkMode) {
        document.body.classList.add('dark-mode');
      } else {
        document.body.classList.remove('dark-mode');
      }
      saveState();
    });
  }
  
  // Sentry rules toggle
  const sentryRulesCheckbox = document.getElementById('enableSentryRules');
  if (sentryRulesCheckbox) {
    sentryRulesCheckbox.addEventListener('change', () => {
      state.settings.enableSentryRules = sentryRulesCheckbox.checked;
      updateCardTypeSelectors();
      saveConfiguration();
    });
  }
  
  // Corrupter rules toggle
  const corrupterRulesCheckbox = document.getElementById('enableCorrupterRules');
  if (corrupterRulesCheckbox) {
    corrupterRulesCheckbox.addEventListener('change', () => {
      state.settings.enableCorrupterRules = corrupterRulesCheckbox.checked;
      updateCardTypeSelectors();
      saveConfiguration();
    });
  }
  
  // Generate deck button
  const generateButton = document.getElementById('generateDeck');
  if (generateButton) {
    generateButton.addEventListener('click', generateDeck);
  }
  
  // Reset button
  const resetButton = document.getElementById('resetAll');
  if (resetButton) {
    resetButton.addEventListener('click', resetAll);
  }
  
  // Set up card actions
  setupCardActions();
  
  // Set up navigation buttons
  setupNavigationButtons();
}

/**
 * Updates UI elements based on current state
 */
function updateUI() {
  // Update game checkboxes
  state.selectedGames.forEach(game => {
    const checkbox = document.getElementById(`game-${game}`);
    if (checkbox) checkbox.checked = true;
  });
  
  // Update card type selectors
  updateCardTypeSelectors();
  
  // Update difficulty selector
  const difficultySelect = document.getElementById('difficultySelect');
  if (difficultySelect && state.settings.selectedDifficultyIndex !== undefined) {
    difficultySelect.selectedIndex = state.settings.selectedDifficultyIndex;
    updateDifficultyDescription(state.settings.selectedDifficultyIndex);
  }
  
  // Update rules checkboxes
  const sentryRulesCheckbox = document.getElementById('enableSentryRules');
  if (sentryRulesCheckbox) {
    sentryRulesCheckbox.checked = state.settings.enableSentryRules;
  }
  
  const corrupterRulesCheckbox = document.getElementById('enableCorrupterRules');
  if (corrupterRulesCheckbox) {
    corrupterRulesCheckbox.checked = state.settings.enableCorrupterRules;
  }
  
  // Update dark mode toggle
  const darkModeToggle = document.getElementById('darkModeToggle');
  if (darkModeToggle) {
    darkModeToggle.checked = state.ui.darkMode;
  }
  
  // Display deck if available
  if (state.deck.combined.length > 0) {
    displayDeck();
    showGameControls();
    updateProgressIndicators();
  }
}

/**
 * Initializes game checkboxes based on available games
 */
function initializeGameCheckboxes() {
  const gameSelectionContainer = document.getElementById('gameSelection');
  if (!gameSelectionContainer) {
    console.warn('Game selection container not found');
    return;
  }
  
  // Clear existing content
  gameSelectionContainer.innerHTML = '';
  
  // Get available games from dataStore
  const games = dataStore?.games || {};
  
  if (Object.keys(games).length === 0) {
    showErrorMessage('No games found in the data store');
    return;
  }
  
  // Create checkbox for each game
  Object.keys(games).forEach(gameId => {
    const game = games[gameId];
    
    const gameDiv = document.createElement('div');
    gameDiv.className = 'form-check game-checkbox';
    
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.className = 'form-check-input game-selector';
    checkbox.id = `game-${gameId}`;
    checkbox.value = gameId;
    checkbox.dataset.gameName = game.name;
    
    const label = document.createElement('label');
    label.className = 'form-check-label';
    label.htmlFor = `game-${gameId}`;
    label.textContent = game.name;
    
    gameDiv.appendChild(checkbox);
    gameDiv.appendChild(label);
    gameSelectionContainer.appendChild(gameDiv);
    
    // Add event listener
    checkbox.addEventListener('change', function() {
      saveConfiguration();
      updateUI();
    });
  });
}

/**
 * Shows an error message to the user
 * @param {string} message - The error message to display
 */
function showErrorMessage(message) {
  // Create or use an existing error container
  let errorContainer = document.getElementById('errorContainer');
  
  if (!errorContainer) {
    errorContainer = document.createElement('div');
    errorContainer.id = 'errorContainer';
    errorContainer.style.position = 'fixed';
    errorContainer.style.bottom = '20px';
    errorContainer.style.right = '20px';
    errorContainer.style.maxWidth = '300px';
    errorContainer.style.zIndex = '9999';
    document.body.appendChild(errorContainer);
  }
  
  // Create error message element
  const errorElement = document.createElement('div');
  errorElement.className = 'error-message';
  errorElement.style.backgroundColor = '#f44336';
  errorElement.style.color = 'white';
  errorElement.style.padding = '10px 15px';
  errorElement.style.marginTop = '10px';
  errorElement.style.borderRadius = '4px';
  errorElement.style.boxShadow = '0 2px 5px rgba(0,0,0,0.2)';
  errorElement.style.position = 'relative';
  
  // Add error content
  errorElement.innerHTML = `
    <div style="margin-bottom: 5px;">${message}</div>
    <button style="position: absolute; top: 5px; right: 5px; background: none; border: none; color: white; cursor: pointer; font-size: 16px;">×</button>
  `;
  
  // Add close button functionality
  const closeButton = errorElement.querySelector('button');
  closeButton.addEventListener('click', () => {
    errorElement.remove();
  });
  
  // Auto-remove after 10 seconds
  setTimeout(() => {
    if (errorElement.parentNode) {
      errorElement.remove();
    }
  }, 10000);
  
  // Add to container
  errorContainer.appendChild(errorElement);
  
  // Log to console as well
  console.error(message);
}

/**
 * Initializes the difficulty selector dropdown
 */
function initializeDifficultySelector() {
    const difficultySelect = document.getElementById('difficultyLevel');
    if (!difficultySelect) {
        console.warn('Difficulty selector not found - waiting for element');
        // Set up a mutation observer to watch for the element
        const observer = new MutationObserver((mutations, obs) => {
            const selector = document.getElementById('difficultyLevel');
            if (selector) {
                setupDifficultySelector(selector);
                obs.disconnect();
            }
        });
        
        observer.observe(document.body, {
            childList: true,
            subtree: true
        });
        return;
    }
    
    setupDifficultySelector(difficultySelect);
}

function setupDifficultySelector(selector) {
    // Clear existing options
    selector.innerHTML = '';
    
    // Add default option
    const defaultOption = document.createElement('option');
    defaultOption.value = '';
    defaultOption.textContent = 'Select Difficulty...';
    selector.appendChild(defaultOption);
    
    // Add options for each difficulty level
    difficultySettings.forEach((difficulty, index) => {
        const option = document.createElement('option');
        option.value = index;
        option.textContent = difficulty.name;
        selector.appendChild(option);
    });
    
    // Set default selection
    if (difficultySettings.length > 0) {
        selector.selectedIndex = state.settings.selectedDifficultyIndex || 0;
        updateDifficultyDescription(state.settings.selectedDifficultyIndex || 0);
    }
    
    // Add event listener
    selector.addEventListener('change', function() {
        const selectedIndex = parseInt(this.value);
        state.settings.selectedDifficultyIndex = selectedIndex;
        updateDifficultyDescription(selectedIndex);
        saveConfiguration();
    });
}

/**
 * Updates the difficulty description based on selected index
 * @param {number} index - The selected difficulty index
 */
function updateDifficultyDescription(index) {
  const descriptionElement = document.getElementById('difficultyDescription');
  if (!descriptionElement) return;
  
  if (index >= 0 && index < difficultySettings.length) {
    const difficulty = difficultySettings[index];
    descriptionElement.textContent = difficulty.description || '';
    descriptionElement.style.display = 'block';
  } else {
    descriptionElement.textContent = '';
    descriptionElement.style.display = 'none';
  }
}

/**
 * Generates a new deck based on current settings
 * This function handles the creation of the main deck, special cards, and sentry cards
 */
function generateDeck() {
  // Clear existing deck
  state.deck = {
    main: [],           // Regular cards
    special: [],        // Special cards
    sentry: [],         // Sentry cards (when using Sentry rules)
    combined: [],       // Combined deck (main + special)
    discard: [],        // Discarded cards
    inPlay: []          // Cards currently in play
  };
  
  // Reset current index
  state.currentIndex = -1;
  
  // Get selected games
  state.selectedGames = [];
  document.querySelectorAll('.game-selector:checked').forEach(checkbox => {
    state.selectedGames.push(checkbox.value);
  });
  
  // Get card counts
  state.cardCounts = {};
  document.querySelectorAll('[id^="count-"]').forEach(input => {
    const type = input.id.replace('count-', '');
    const count = parseInt(input.value) || 0;
    if (count > 0) {
      state.cardCounts[type] = count;
    }
  });
  
  // Get special card counts
  state.specialCardCounts = {};
  document.querySelectorAll('[id^="special-count-"]').forEach(input => {
    const type = input.id.replace('special-count-', '');
    const count = parseInt(input.value) || 0;
    if (count > 0) {
      state.specialCardCounts[type] = count;
    }
  });
  
  // Get sentry card counts if sentry rules are enabled
  state.sentryCardCounts = {};
  if (state.settings.enableSentryRules) {
    document.querySelectorAll('[id^="sentry-count-"]').forEach(input => {
      const type = input.id.replace('sentry-count-', '');
      const count = parseInt(input.value) || 0;
      if (count > 0) {
        state.sentryCardCounts[type] = count;
      }
    });
  }
  
  // Get corrupter card counts if corrupter rules are enabled
  state.corrupterCardCounts = {};
  if (state.settings.enableCorrupterRules) {
    document.querySelectorAll('[id^="corrupter-count-"]').forEach(input => {
      const type = input.id.replace('corrupter-count-', '');
      const count = parseInt(input.value) || 0;
      if (count > 0) {
        state.corrupterCardCounts[type] = count;
      }
    });
  }
  
  // Save configuration
  saveConfiguration();
  
  // Generate main deck
  generateMainDeck();
  
  // Generate special cards
  generateSpecialCards();
  
  // Generate sentry cards if sentry rules are enabled
  if (state.settings.enableSentryRules) {
    generateSentryCards();
  }
  
  // Apply corrupter rules if enabled
  if (state.settings.enableCorrupterRules) {
    applyCorrupterRules();
  }
  
  // Combine main and special decks
  combineDeck();
  
  // Save state
  saveState();
  
  // Display the deck
  displayDeck();
  
  // Show game controls
  showGameControls();
  
  // Update progress indicators
  updateProgressIndicators();
}

/**
 * Generates the main deck based on selected card types and counts
 */
function generateMainDeck() {
  // Get all available cards from selected games
  const availableCards = [];
  
  state.selectedGames.forEach(gameId => {
    const game = dataStore.games[gameId];
    if (game && game.cards) {
      game.cards.forEach(card => {
        // Skip cards that are sentry types if sentry rules are enabled
        if (state.settings.enableSentryRules && isCardSentryType(card)) {
          return;
        }
        
        // Skip cards that are corrupter types if corrupter rules are enabled
        if (state.settings.enableCorrupterRules && isCardCorrupterType(card)) {
          return;
        }
        
        availableCards.push({...card, gameId});
      });
    }
  });
  
  // Select cards based on type counts
  const selectedCards = [];
  const selectedCardsMap = new Map(); // Track selected cards to avoid duplicates
  
  Object.entries(state.cardCounts).forEach(([type, count]) => {
    // Get cards of this type
    const cardsOfType = availableCards.filter(card => matchesCardType(card, type));
    
    // Randomly select cards up to the count
    for (let i = 0; i < count; i++) {
      if (cardsOfType.length === 0) break;
      
      // Select a random card
      const randomIndex = Math.floor(Math.random() * cardsOfType.length);
      const selectedCard = cardsOfType[randomIndex];
      
      // Add to selected cards
      selectedCards.push(selectedCard);
      
      // Remove from available cards to avoid duplicates
      cardsOfType.splice(randomIndex, 1);
    }
  });
  
  // Shuffle the selected cards
  state.deck.main = shuffleArray(selectedCards);
}

/**
 * Generates special cards based on selected special card types and counts
 */
function generateSpecialCards() {
  // Get all available cards from selected games
  const availableCards = [];
  
  state.selectedGames.forEach(gameId => {
    const game = dataStore.games[gameId];
    if (game && game.cards) {
      game.cards.forEach(card => {
        availableCards.push({...card, gameId});
      });
    }
  });
  
  // Select special cards based on type counts
  const selectedSpecialCards = [];
  
  Object.entries(state.specialCardCounts).forEach(([type, count]) => {
    // Get cards of this type
    const cardsOfType = availableCards.filter(card => matchesCardType(card, type));
    
    // Randomly select cards up to the count
    for (let i = 0; i < count; i++) {
      if (cardsOfType.length === 0) break;
      
      // Select a random card
      const randomIndex = Math.floor(Math.random() * cardsOfType.length);
      const selectedCard = cardsOfType[randomIndex];
      
      // Add to selected special cards
      selectedSpecialCards.push(selectedCard);
      
      // Remove from available cards to avoid duplicates
      cardsOfType.splice(randomIndex, 1);
    }
  });
  
  // Shuffle the selected special cards
  state.deck.special = shuffleArray(selectedSpecialCards);
}

/**
 * Generates sentry cards based on selected sentry card types and counts
 */
function generateSentryCards() {
  // Get all available cards from selected games
  const availableCards = [];
  
  state.selectedGames.forEach(gameId => {
    const game = dataStore.games[gameId];
    if (game && game.cards) {
      game.cards.forEach(card => {
        // Only include cards that are sentry types
        if (isCardSentryType(card)) {
          availableCards.push({...card, gameId});
        }
      });
    }
  });
  
  // Select sentry cards based on type counts
  const selectedSentryCards = [];
  const selectedCardsMap = new Map(); // Track selected cards to avoid duplicates
  
  Object.entries(state.sentryCardCounts).forEach(([type, count]) => {
    // Get cards of this type
    const cardsOfType = availableCards.filter(card => matchesCardType(card, type));
    
    // Randomly select cards up to the count
    for (let i = 0; i < count; i++) {
      if (cardsOfType.length === 0) break;
      
      // Select a random card
      const randomIndex = Math.floor(Math.random() * cardsOfType.length);
      const selectedCard = cardsOfType[randomIndex];
      
      // Check if this card has already been selected
      const cardKey = `${selectedCard.id}-${selectedCard.gameId}`;
      if (selectedCardsMap.has(cardKey)) {
        // Skip this card and try again
        i--;
        continue;
      }
      
      // Add to selected sentry cards
      selectedSentryCards.push(selectedCard);
      
      // Mark as selected
      selectedCardsMap.set(cardKey, true);
      
      // Remove from available cards to avoid duplicates
      cardsOfType.splice(randomIndex, 1);
    }
  });
  
  // Shuffle the selected sentry cards
  state.deck.sentry = shuffleArray(selectedSentryCards);
}

/**
 * Applies corrupter rules by replacing random cards with corrupter cards
 */
function applyCorrupterRules() {
  // Only apply if there are at least 5 cards in the main deck
  if (state.deck.main.length < 5) {
    console.warn('Not enough cards in the main deck to apply Corrupter rules');
    return;
  }
  
  // Get corrupter cards
  const corrupterCards = getCorrupterCards();
  
  // If there are no corrupter cards, skip
  if (corrupterCards.length === 0) {
    console.warn('No Corrupter cards available');
    return;
  }
  
  // Replace 5 random cards with corrupter cards
  for (let i = 0; i < 5; i++) {
    if (corrupterCards.length === 0) break;
    
    // Select a random card from the main deck
    const randomIndex = Math.floor(Math.random() * state.deck.main.length);
    
    // Remove the card
    state.deck.main.splice(randomIndex, 1);
    
    // Add a corrupter card
    const corrupterIndex = Math.floor(Math.random() * corrupterCards.length);
    const corrupterCard = corrupterCards[corrupterIndex];
    
    state.deck.main.push(corrupterCard);
    
    // Remove the corrupter card from the available list
    corrupterCards.splice(corrupterIndex, 1);
  }
  
  // Shuffle the main deck again
  state.deck.main = shuffleArray(state.deck.main);
}

/**
 * Gets corrupter cards from the available cards
 * @returns {Array} Array of corrupter cards
 */
function getCorrupterCards() {
  const corrupterCards = [];
  
  state.selectedGames.forEach(gameId => {
    const game = dataStore.games[gameId];
    if (game && game.cards) {
      game.cards.forEach(card => {
        // Only include cards that are corrupter types
        if (isCardCorrupterType(card)) {
          corrupterCards.push({...card, gameId});
        }
      });
    }
  });
  
  return corrupterCards;
}

/**
 * Combines the main and special decks
 */
function combineDeck() {
  // Combine main and special decks
  state.deck.combined = [...state.deck.main, ...state.deck.special];
  
  // Shuffle the combined deck
  state.deck.combined = shuffleArray(state.deck.combined);
}

/**
 * Checks if a card is a sentry type
 * @param {Object} card - The card to check
 * @returns {boolean} True if the card is a sentry type
 */
function isCardSentryType(card) {
  if (!card.type || !dataStore.sentryTypes || dataStore.sentryTypes.length === 0) {
    return false;
  }
  
  // Check if any of the card's types match a sentry type
  const cardTypes = card.type.split(/[+/]/).map(t => t.trim());
  
  return cardTypes.some(type => dataStore.sentryTypes.includes(type));
}

/**
 * Checks if a card is a corrupter type
 * @param {Object} card - The card to check
 * @returns {boolean} True if the card is a corrupter type
 */
function isCardCorrupterType(card) {
  if (!card.type || !dataStore.corrupterTypes || dataStore.corrupterTypes.length === 0) {
    return false;
  }
  
  // Check if any of the card's types match a corrupter type
  const cardTypes = card.type.split(/[+/]/).map(t => t.trim());
  
  return cardTypes.some(type => dataStore.corrupterTypes.includes(type));
}

/**
 * Checks if a card matches a specified type
 * @param {Object} card - The card to check
 * @param {string} typeToMatch - The type to match
 * @returns {boolean} True if the card matches the type
 */
function matchesCardType(card, typeToMatch) {
  if (!card.type) return false;
  
  // Split the card type by + and / operators
  const cardTypeString = card.type;
  
  // Check for AND operator (+)
  if (cardTypeString.includes('+')) {
    const types = cardTypeString.split('+').map(t => t.trim());
    return typeToMatch.includes('+') 
      ? cardTypeString === typeToMatch // Exact match for complex types
      : types.includes(typeToMatch); // Check if one of the AND types matches
  }
  
  // Check for OR operator (/)
  if (cardTypeString.includes('/')) {
    const types = cardTypeString.split('/').map(t => t.trim());
    return typeToMatch.includes('/') 
      ? cardTypeString === typeToMatch // Exact match for complex types
      : types.includes(typeToMatch); // Check if one of the OR types matches
  }
  
  // Simple type comparison
  return cardTypeString === typeToMatch;
}

/**
 * Shuffles an array using Fisher-Yates algorithm
 * @param {Array} array - The array to shuffle
 * @returns {Array} The shuffled array
 */
function shuffleArray(array) {
  const newArray = [...array];
  
  for (let i = newArray.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
  }
  
  return newArray;
}

/**
 * Introduces sentry cards into the remaining deck
 * This function implements the Sentry rules as described in the documentation
 */
function introduceSentryCards() {
  // Check if there are sentry cards to introduce
  if (!state.deck.sentry || state.deck.sentry.length === 0) {
    showErrorMessage('No Sentry cards available to introduce');
    return false;
  }
  
  // Check if there are cards remaining in the deck after the current card
  if (state.currentIndex >= state.deck.combined.length - 1) {
    showErrorMessage('No cards remaining in the deck to introduce Sentry cards');
    return false;
  }
  
  // Get the cards before and including the current card
  const cardsBeforeCurrent = state.deck.combined.slice(0, state.currentIndex + 1);
  
  // Get the cards after the current card
  const cardsAfterCurrent = state.deck.combined.slice(state.currentIndex + 1);
  
  // Add sentry cards to the remaining cards
  const remainingCards = [...cardsAfterCurrent, ...state.deck.sentry];
  
  // Shuffle the remaining cards
  const shuffledRemainingCards = shuffleArray(remainingCards);
  
  // Update the combined deck
  state.deck.combined = [...cardsBeforeCurrent, ...shuffledRemainingCards];
  
  // Clear the sentry deck
  state.deck.sentry = [];
  
  // Save state
  saveState();
  
  // Update display
  displayDeck();
  updateProgressIndicators();
  
  return true;
}

/**
 * Displays the current deck and card
 */
function displayDeck() {
  const cardContainer = document.getElementById('currentCard');
  if (!cardContainer) return;
  
  // Clear the container
  cardContainer.innerHTML = '';
  
  // If there's no deck or it's empty, show a message
  if (!state.deck.combined || state.deck.combined.length === 0) {
    cardContainer.innerHTML = '<div class="text-center p-5">No cards in the deck. Generate a deck to begin.</div>';
    return;
  }
  
  // If the current index is invalid, reset it
  if (state.currentIndex < 0 || state.currentIndex >= state.deck.combined.length) {
    state.currentIndex = 0;
  }
  
  // Get the current card
  const currentCard = state.deck.combined[state.currentIndex];
  
  // Create card element
  const cardElement = document.createElement('div');
  cardElement.className = 'card event-card mx-auto';
  
  // Add card content
  cardElement.innerHTML = `
    <div class="card-header d-flex justify-content-between align-items-center">
      <span class="card-title">${currentCard.card || 'Unknown Card'}</span>
      <span class="card-type badge badge-secondary">${currentCard.type || 'Unknown Type'}</span>
    </div>
    <div class="card-body text-center">
      <img src="cardimages/${currentCard.contents}" class="card-image img-fluid" alt="${currentCard.card}">
    </div>
    <div class="card-footer text-center">
      <button id="addToInPlay" class="btn btn-outline-primary btn-sm">
        <i class="fas fa-plus-circle"></i> Add to In-Play
      </button>
    </div>
  `;
  
  // Add the card to the container
  cardContainer.appendChild(cardElement);
  
  // Add event listener for the "Add to In-Play" button
  const addToInPlayButton = document.getElementById('addToInPlay');
  if (addToInPlayButton) {
    addToInPlayButton.addEventListener('click', () => {
      addCardToInPlay(currentCard);
    });
  }
}

/**
 * Updates the progress indicators (progress bar and card count)
 */
function updateProgressIndicators() {
  const progressBar = document.getElementById('deckProgressBar');
  const cardCountDisplay = document.getElementById('cardCount');
  
  if (!progressBar || !cardCountDisplay) return;
  
  // If there's no deck or it's empty, reset indicators
  if (!state.deck.combined || state.deck.combined.length === 0) {
    progressBar.style.width = '0%';
    cardCountDisplay.textContent = '0/0';
    return;
  }
  
  // Calculate progress percentage
  const totalCards = state.deck.combined.length;
  const currentPosition = state.currentIndex + 1;
  const progressPercentage = (currentPosition / totalCards) * 100;
  
  // Update progress bar
  progressBar.style.width = `${progressPercentage}%`;
  
  // Update card count display
  cardCountDisplay.textContent = `${currentPosition}/${totalCards}`;
}

/**
 * Adds a card to the in-play area
 * @param {Object} card - The card to add to in-play
 */
function addCardToInPlay(card) {
  if (!card) return;
  
  // Add the card to the in-play array
  state.deck.inPlay.push(card);
  
  // Save state
  saveState();
  
  // Update the in-play display
  displayInPlayCards();
}

/**
 * Displays the cards in the in-play area
 */
function displayInPlayCards() {
  const inPlayContainer = document.getElementById('inPlayCards');
  if (!inPlayContainer) return;
  
  // Clear the container
  inPlayContainer.innerHTML = '';
  
  // If there are no in-play cards, show a message
  if (!state.deck.inPlay || state.deck.inPlay.length === 0) {
    inPlayContainer.innerHTML = '<div class="text-center p-3">No cards in play.</div>';
    return;
  }
  
  // Create a card element for each in-play card
  state.deck.inPlay.forEach((card, index) => {
    const cardElement = document.createElement('div');
    cardElement.className = 'card in-play-card m-2';
    
    // Add card content
    cardElement.innerHTML = `
      <div class="card-header d-flex justify-content-between align-items-center">
        <span class="card-title small">${card.card || 'Unknown Card'}</span>
        <span class="card-type badge badge-secondary">${card.type || 'Unknown Type'}</span>
      </div>
      <div class="card-body p-2 text-center">
        <img src="cardimages/${card.contents}" class="card-image-small img-fluid" alt="${card.card}">
      </div>
      <div class="card-footer p-1 text-center">
        <button class="btn btn-outline-danger btn-sm remove-in-play" data-index="${index}">
          <i class="fas fa-times"></i>
        </button>
      </div>
    `;
    
    // Add the card to the container
    inPlayContainer.appendChild(cardElement);
  });
  
  // Add event listeners for the remove buttons
  document.querySelectorAll('.remove-in-play').forEach(button => {
    button.addEventListener('click', (event) => {
      const index = parseInt(event.currentTarget.dataset.index);
      removeCardFromInPlay(index);
    });
  });
}

/**
 * Removes a card from the in-play area
 * @param {number} index - The index of the card to remove
 */
function removeCardFromInPlay(index) {
  if (index < 0 || index >= state.deck.inPlay.length) return;
  
  // Remove the card from the in-play array
  state.deck.inPlay.splice(index, 1);
  
  // Save state
  saveState();
  
  // Update the in-play display
  displayInPlayCards();
}

/**
 * Sets up event listeners for card actions
 */
function setupCardActions() {
  const cardActionSelect = document.getElementById('cardAction');
  const applyActionButton = document.getElementById('applyCardAction');
  const actionTopNInput = document.getElementById('actionTopNInput');
  
  if (!cardActionSelect || !applyActionButton) return;
  
  // Add event listener for action selection change
  cardActionSelect.addEventListener('change', () => {
    const selectedAction = cardActionSelect.value;
    
    // Show/hide the top N input based on the selected action
    if (selectedAction === 'shuffleTopN') {
      actionTopNInput.style.display = 'block';
    } else {
      actionTopNInput.style.display = 'none';
    }
  });
  
  // Add event listener for apply action button
  applyActionButton.addEventListener('click', () => {
    const selectedAction = cardActionSelect.value;
    
    if (!selectedAction) {
      showErrorMessage('Please select an action');
      return;
    }
    
    // Apply the selected action
    switch (selectedAction) {
      case 'shuffleAnywhere':
        shuffleCurrentCardAnywhere();
        break;
        
      case 'shuffleTopN':
        const n = parseInt(document.getElementById('actionN').value) || 3;
        shuffleCurrentCardTopN(n);
        break;
        
      case 'replaceSameType':
        replaceWithSameType();
        break;
        
      case 'introduceSentry':
        introduceSentryCards();
        break;
        
      default:
        showErrorMessage('Unknown action');
        break;
    }
    
    // Reset the action select
    cardActionSelect.value = '';
    actionTopNInput.style.display = 'none';
  });
}

/**
 * Shuffles the current card into the remaining deck
 */
function shuffleCurrentCardAnywhere() {
  if (state.currentIndex < 0 || state.currentIndex >= state.deck.combined.length) {
    showErrorMessage('Invalid card index');
    return;
  }
  
  // Get the current card
  const currentCard = state.deck.combined[state.currentIndex];
  
  // Remove the current card from the deck
  state.deck.combined.splice(state.currentIndex, 1);
  
  // If this was the last card, move to the previous card
  if (state.currentIndex >= state.deck.combined.length) {
    state.currentIndex = state.deck.combined.length - 1;
  }
  
  // Get a random position after the current index
  const randomPosition = Math.floor(Math.random() * (state.deck.combined.length - state.currentIndex)) + state.currentIndex;
  
  // Insert the card at the random position
  state.deck.combined.splice(randomPosition, 0, currentCard);
  
  // Save state
  saveState();
  
  // Update display
  displayDeck();
  updateProgressIndicators();
}

/**
 * Shuffles the current card into the top N cards
 * @param {number} n - The number of cards to shuffle into
 */
function shuffleCurrentCardTopN(n) {
  if (state.currentIndex < 0 || state.currentIndex >= state.deck.combined.length) {
    showErrorMessage('Invalid card index');
    return;
  }
  
  // Ensure n is at least 1
  n = Math.max(1, n);
  
  // Get the current card
  const currentCard = state.deck.combined[state.currentIndex];
  
  // Remove the current card from the deck
  state.deck.combined.splice(state.currentIndex, 1);
  
  // If this was the last card, move to the previous card
  if (state.currentIndex >= state.deck.combined.length) {
    state.currentIndex = state.deck.combined.length - 1;
  }
  
  // Calculate the maximum position to insert the card
  const maxPosition = Math.min(state.currentIndex + n, state.deck.combined.length);
  
  // Get a random position between the current index and the maximum position
  const randomPosition = Math.floor(Math.random() * (maxPosition - state.currentIndex)) + state.currentIndex;
  
  // Insert the card at the random position
  state.deck.combined.splice(randomPosition, 0, currentCard);
  
  // Save state
  saveState();
  
  // Update display
  displayDeck();
  updateProgressIndicators();
}

/**
 * Replaces the current card with another card of the same type
 */
function replaceWithSameType() {
  if (state.currentIndex < 0 || state.currentIndex >= state.deck.combined.length) {
    showErrorMessage('Invalid card index');
    return;
  }
  
  // Get the current card
  const currentCard = state.deck.combined[state.currentIndex];
  
  // Get all available cards from selected games
  const availableCards = [];
  
  state.selectedGames.forEach(gameId => {
    const game = dataStore.games[gameId];
    if (game && game.cards) {
      game.cards.forEach(card => {
        // Only include cards that match the current card's type
        if (card.type === currentCard.type) {
          availableCards.push({...card, gameId});
        }
      });
    }
  });
  
  // If there are no available cards of the same type, show an error
  if (availableCards.length === 0) {
    showErrorMessage('No cards available of the same type');
    return;
  }
  
  // Select a random card
  const randomIndex = Math.floor(Math.random() * availableCards.length);
  const replacementCard = availableCards[randomIndex];
  
  // Replace the current card
  state.deck.combined[state.currentIndex] = replacementCard;
  
  // Save state
  saveState();
  
  // Update display
  displayDeck();
  updateProgressIndicators();
}

/**
 * Sets up event listeners for navigation buttons
 */
function setupNavigationButtons() {
  const prevButton = document.getElementById('prevCard');
  const nextButton = document.getElementById('nextCard');
  
  if (!prevButton || !nextButton) return;
  
  // Add event listener for previous button
  prevButton.addEventListener('click', () => {
    if (state.currentIndex <= 0) {
      showErrorMessage('Already at the first card');
      return;
    }
    
    state.currentIndex--;
    saveState();
    displayDeck();
    updateProgressIndicators();
  });
  
  // Add event listener for next button
  nextButton.addEventListener('click', () => {
    if (state.currentIndex >= state.deck.combined.length - 1) {
      showErrorMessage('Already at the last card');
      return;
    }
    
    state.currentIndex++;
    saveState();
    displayDeck();
    updateProgressIndicators();
  });
}

/**
 * Shows or hides game control elements based on whether a deck exists
 */
function showGameControls() {
  const gameControls = document.getElementById('gameControls');
  const navigationButtons = document.getElementById('navigationButtons');
  const progressBarContainer = document.getElementById('progressBarContainer');
  const cardActionsSection = document.getElementById('cardActionsSection');
  const inPlaySection = document.getElementById('inPlaySection');
  
  if (!gameControls || !navigationButtons || !progressBarContainer || !cardActionsSection || !inPlaySection) {
    console.error('One or more game control elements not found');
    return;
  }
  
  // Show controls if we have a deck with cards
  const hasCards = state.deck && state.deck.combined && state.deck.combined.length > 0;
  
  gameControls.style.display = hasCards ? 'block' : 'none';
  navigationButtons.style.display = hasCards ? 'flex' : 'none';
  progressBarContainer.style.display = hasCards ? 'block' : 'none';
  cardActionsSection.style.display = hasCards ? 'block' : 'none';
  inPlaySection.style.display = hasCards ? 'block' : 'none';
  
  // Update the in-play cards display
  if (hasCards) {
    displayInPlayCards();
  }
}

/**
 * Updates card type selectors based on selected games and rules
 */
function updateCardTypeSelectors() {
    const cardTypeContainer = document.getElementById('cardTypeInputs');
    const specialCardTypeContainer = document.getElementById('specialCardTypeInputs');
    
    if (!cardTypeContainer || !specialCardTypeContainer) {
        console.warn('Card type containers not found - waiting for elements');
        // Set up a mutation observer to watch for the elements
        const observer = new MutationObserver((mutations, obs) => {
            const mainContainer = document.getElementById('cardTypeInputs');
            const specialContainer = document.getElementById('specialCardTypeInputs');
            
            if (mainContainer && specialContainer) {
                setupCardTypeSelectors(mainContainer, specialContainer);
                obs.disconnect();
            }
        });
        
        observer.observe(document.body, {
            childList: true,
            subtree: true
        });
        return;
    }
    
    setupCardTypeSelectors(cardTypeContainer, specialCardTypeContainer);
}

function setupCardTypeSelectors(mainContainer, specialContainer) {
    // Clear existing content
    mainContainer.innerHTML = '';
    specialContainer.innerHTML = '';
    
    // Get selected games
    const selectedGames = Array.from(document.querySelectorAll('.game-selector:checked')).map(cb => cb.value);
    state.selectedGames = selectedGames;
    
    // If no games selected, return
    if (selectedGames.length === 0) {
        return;
    }
    
    // Get all card types from selected games
    const cardTypes = new Set();
    const specialCardTypes = new Set();
    
    selectedGames.forEach(gameId => {
        const game = dataStore?.games?.[gameId];
        if (!game) return;
        
        // Add regular card types
        game.cardTypes?.forEach(type => cardTypes.add(type));
        
        // Add special card types
        game.specialCardTypes?.forEach(type => specialCardTypes.add(type));
    });
    
    // Create inputs for each card type
    cardTypes.forEach(type => {
        createCardTypeInput(mainContainer, type, 'count', state.cardCounts[type] || 0);
    });
    
    // Create inputs for each special card type
    specialCardTypes.forEach(type => {
        createCardTypeInput(specialContainer, type, 'special-count', state.specialCardCounts[type] || 0);
    });
}

/**
 * Creates an input for a card type
 * @param {HTMLElement} container - The container to add the input to
 * @param {string} type - The card type
 * @param {string} prefix - The prefix for the input ID
 * @param {number} defaultValue - The default value for the input
 */
function createCardTypeInput(container, type, prefix, defaultValue) {
  const formGroup = document.createElement('div');
  formGroup.className = 'form-group card-type-input';
  
  const label = document.createElement('label');
  label.htmlFor = `${prefix}-${type}`;
  label.textContent = type;
  
  const input = document.createElement('input');
  input.type = 'number';
  input.className = 'form-control';
  input.id = `${prefix}-${type}`;
  input.min = '0';
  input.value = defaultValue;
  
  // Add event listener to update state
  input.addEventListener('change', function() {
    const value = parseInt(this.value, 10) || 0;
    
    // Update the appropriate state object based on prefix
    if (prefix === 'count') {
      state.cardCounts[type] = value;
    } else if (prefix === 'special-count') {
      state.specialCardCounts[type] = value;
    }
    
    saveConfiguration();
  });
  
  formGroup.appendChild(label);
  formGroup.appendChild(input);
  container.appendChild(formGroup);
}

/**
 * Resets all settings and clears the deck
 */
function resetAll() {
  if (!confirm('Are you sure you want to reset all settings and clear the deck?')) {
    return;
  }
  
  // Reset state to initial values
  state = {
    version: CURRENT_STATE_VERSION,
    dataLoaded: state.dataLoaded,
    deck: {
      main: [],
      special: [],
      sentry: [],
      combined: [],
      discard: [],
      inPlay: []
    },
    currentIndex: 0,
    selectedGames: [],
    cardCounts: {},
    specialCardCounts: {},
    sentryCardCounts: {},
    corrupterCardCounts: {},
    settings: {
      enableSentryRules: false,
      enableCorrupterRules: false,
      selectedDifficultyIndex: 0
    },
    ui: {
      darkMode: state.ui.darkMode // Preserve dark mode setting
    }
  };
  
  // Clear localStorage
  if (isStorageAvailable()) {
    localStorage.removeItem(STORAGE_KEYS.STATE);
    localStorage.removeItem(STORAGE_KEYS.CONFIG);
  }
  
  // Reset UI elements
  
  // Uncheck all game checkboxes
  document.querySelectorAll('.game-selector').forEach(checkbox => {
    checkbox.checked = false;
  });
  
  // Reset rules checkboxes
  const sentryRulesCheckbox = document.getElementById('enableSentryRules');
  if (sentryRulesCheckbox) {
    sentryRulesCheckbox.checked = false;
  }
  
  const corrupterRulesCheckbox = document.getElementById('enableCorrupterRules');
  if (corrupterRulesCheckbox) {
    corrupterRulesCheckbox.checked = false;
  }
  
  // Reset difficulty selector
  const difficultySelect = document.getElementById('difficultySelect');
  if (difficultySelect) {
    difficultySelect.selectedIndex = 0;
    updateDifficultyDescription(0);
  }
  
  // Clear card type selectors
  updateCardTypeSelectors();
  
  // Hide game controls
  const gameControls = document.getElementById('gameControls');
  if (gameControls) {
    gameControls.style.display = 'none';
  }
  
  const navigationButtons = document.getElementById('navigationButtons');
  if (navigationButtons) {
    navigationButtons.style.display = 'none';
  }
  
  const progressBarContainer = document.getElementById('progressBarContainer');
  if (progressBarContainer) {
    progressBarContainer.style.display = 'none';
  }
  
  const cardActionsSection = document.getElementById('cardActionsSection');
  if (cardActionsSection) {
    cardActionsSection.style.display = 'none';
  }
  
  const inPlaySection = document.getElementById('inPlaySection');
  if (inPlaySection) {
    inPlaySection.style.display = 'none';
  }
  
  // Clear card display
  const cardContainer = document.getElementById('cardContainer');
  if (cardContainer) {
    cardContainer.innerHTML = '<p class="text-center">No deck generated yet. Select games and card types, then click "Generate Deck".</p>';
  }
  
  // Clear in-play cards
  const inPlayContainer = document.getElementById('inPlayContainer');
  if (inPlayContainer) {
    inPlayContainer.innerHTML = '<p class="text-center">No cards in play.</p>';
  }
  
  // Reset progress indicators
  updateProgressIndicators();
  
  // Show success message
  showSuccessMessage('All settings have been reset.');
}

/**
 * Shows a success message to the user
 * @param {string} message - The success message to display
 */
function showSuccessMessage(message) {
  // Create or use an existing success container
  let successContainer = document.getElementById('successContainer');
  
  if (!successContainer) {
    successContainer = document.createElement('div');
    successContainer.id = 'successContainer';
    successContainer.className = 'alert-container';
    document.body.appendChild(successContainer);
  }
  
  // Create success message element
  const successElement = document.createElement('div');
  successElement.className = 'alert alert-success';
  successElement.textContent = message;
  
  // Add close button
  const closeButton = document.createElement('button');
  closeButton.type = 'button';
  closeButton.className = 'close';
  closeButton.innerHTML = '&times;';
  closeButton.addEventListener('click', () => {
    successContainer.removeChild(successElement);
  });
  
  successElement.appendChild(closeButton);
  successContainer.appendChild(successElement);
  
  // Auto-remove after 5 seconds
  setTimeout(() => {
    if (successElement.parentNode === successContainer) {
      successContainer.removeChild(successElement);
    }
  }, 5000);
}

// Listen for deck state restoration
document.addEventListener('deckStateRestored', function(event) {
    try {
        const savedState = event.detail;
        
        // Restore the deck state
        if (savedState.deck) {
            // Update internal deck state
            state.deck = savedState.deck;
            
            // Update UI elements
            displayDeck();
            updateProgressIndicators();
            
            // Dispatch state changed event
            document.dispatchEvent(new CustomEvent('deckStateChanged', {
                detail: savedState
            }));
        }
    } catch (error) {
        console.error('Error handling deck state restoration:', error);
    }
});

// Wait for DOM to be fully loaded before initializing
document.addEventListener('DOMContentLoaded', () => {
    // Initialize UI elements
    initializeUI();
    
    // Initialize difficulty selector
    const difficultyLevelElement = document.getElementById('difficultyLevel');
    if (!difficultyLevelElement) {
        console.warn('Difficulty selector not found, creating element');
        const container = document.querySelector('.section:nth-child(2)');
        if (container) {
            const select = document.createElement('select');
            select.id = 'difficultyLevel';
            select.className = 'form-control';
            container.appendChild(select);
            initializeDifficultySelector();
        }
    } else {
        initializeDifficultySelector();
    }
    
    // Initialize card type containers
    const cardTypeContainer = document.getElementById('cardTypeInputs');
    const specialCardTypeContainer = document.getElementById('specialCardTypeInputs');
    
    if (!cardTypeContainer || !specialCardTypeContainer) {
        console.warn('Card type containers not found, creating elements');
        createCardTypeContainers();
    }
    
    updateCardTypeSelectors();
});

function createCardTypeContainers() {
    const sections = document.querySelectorAll('.section');
    sections.forEach(section => {
        const title = section.querySelector('h3');
        if (title) {
            if (title.textContent === 'Card Types' && !document.getElementById('cardTypeInputs')) {
                const container = document.createElement('div');
                container.id = 'cardTypeInputs';
                container.className = 'card-type-inputs';
                section.appendChild(container);
            } else if (title.textContent === 'Special Card Types' && !document.getElementById('specialCardTypeInputs')) {
                const container = document.createElement('div');
                container.id = 'specialCardTypeInputs';
                container.className = 'card-type-inputs';
                section.appendChild(container);
            }
        }
    });
}

// Add this function after the existing initialization functions
async function loadGameData() {
    try {
        // Use the correct paths for GitHub Pages
        const basePath = '/Maladumv2';
        const [cardsResponse, difficultiesResponse] = await Promise.all([
            fetch(`${basePath}/data/maladumcards.json`),
            fetch(`${basePath}/data/difficulties.json`)
        ]);

        if (!cardsResponse.ok) {
            throw new Error(`Failed to load cards data: ${cardsResponse.status} ${cardsResponse.statusText}`);
        }
        if (!difficultiesResponse.ok) {
            throw new Error(`Failed to load difficulties data: ${difficultiesResponse.status} ${difficultiesResponse.statusText}`);
        }

        const cardsData = await cardsResponse.json();
        const difficultiesData = await difficultiesResponse.json();

        console.log('Loaded cards data:', cardsData);
        console.log('Loaded difficulties data:', difficultiesData);

        // Store the data in our dataStore
        dataStore = {
            games: {},
            sentryTypes: cardsData.sentryTypes || [],
            corrupterTypes: cardsData.corrupterTypes || [],
            heldBackCardTypes: cardsData.heldBackCardTypes || []
        };

        // Process games data
        if (cardsData.games) {
            Object.entries(cardsData.games).forEach(([gameName, cards]) => {
                dataStore.games[gameName] = {
                    name: gameName,
                    cards: cards,
                    cardTypes: new Set(cards.map(card => card.type)),
                    specialCardTypes: new Set(cards.filter(card => 
                        dataStore.heldBackCardTypes.includes(card.type)
                    ).map(card => card.type))
                };
            });
        }

        // Store difficulties
        difficultySettings = difficultiesData.difficulties || [];

        // Initialize UI with loaded data
        initializeGameCheckboxes();
        initializeDifficultySelector();
        updateCardTypeSelectors();

        state.dataLoaded = true;
        console.log('Game data loaded successfully');
    } catch (error) {
        console.error('Error loading game data:', error);
        showErrorMessage(`Failed to load game data: ${error.message}`);
    }
}

// Modify the DOMContentLoaded event listener
document.addEventListener('DOMContentLoaded', () => {
    // Initialize UI elements
    initializeUI();
    
    // Load game data
    loadGameData().catch(error => {
        console.error('Failed to load game data:', error);
        showErrorMessage('Failed to load game data. Please refresh the page.');
    });
});
