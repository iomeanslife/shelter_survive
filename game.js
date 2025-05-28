// game.js

// --- Game State ---
const gameState = {
    currentDay: 0,
    actionPoints: 0,
    baseMaxActionPoints: 20, // Renamed for clarity: this is the *initial* max AP
    maxActionPoints: 20, // This will be the *effective* max AP for the current day
    hydrationLevel: 100, // Percentage (0-100)
    // Add other game state variables as needed (e.g., resources, reactor health)
};

// --- Action Definitions (Single Source of Truth for AP Costs) ---
// This object centralizes all action-related data, including AP costs.
const actionDefinitions = {
    explore: { name: "Explore", apCost: 2 },
    scavenge: { name: "Scavenge", apCost: 3 },
    adjustReactor: { name: "Adjust Reactor", apCost: 1 },
    buildDefense: { name: "Build Defense", apCost: 5 },
    craftItem: { name: "Craft Item", apCost: 4 },
    resolveIssue: { name: "Resolve Issue", apCost: 6 },
    research: { name: "Research", apCost: 1 },
    // Note: The 'End Day' button doesn't have an AP cost, so it's not here.
};


// --- UI Elements (cached for performance) ---
const ui = {
    dayDisplay: null,
    apDisplay: null,
    hydrationDisplay: null,
    log: null,
    actionButtons: {}, // Now an object to hold buttons by their action ID
    endDayBtn: null,
};

// --- Core Game Functions ---

/**
 * Initializes the game when the DOM is loaded.
 * Sets up initial UI elements and game state.
 */
function initializeGame() {
    // Cache UI elements
    ui.dayDisplay = document.getElementById('dayDisplay');
    ui.apDisplay = document.getElementById('apDisplay');
    ui.hydrationDisplay = document.getElementById('hydrationDisplay');
    ui.log = document.getElementById('log');
    ui.endDayBtn = document.getElementById('endDayBtn');

    // Dynamically set up action buttons based on actionDefinitions
    // This makes the button text data-driven and adds data-ap-cost attributes
    for (const actionId in actionDefinitions) {
        if (actionDefinitions.hasOwnProperty(actionId)) {
            const button = document.getElementById(`${actionId}Btn`); // e.g., 'exploreBtn'
            if (button) {
                const definition = actionDefinitions[actionId];
                button.textContent = `${definition.name} (${definition.apCost} AP)`;
                button.dataset.apCost = definition.apCost; // Store cost in a data attribute for quick reference if needed
                button.onclick = () => performAction(actionId); // Link to generic performAction
                ui.actionButtons[actionId] = button; // Store reference in ui.actionButtons object
            } else {
                console.warn(`Button with ID '${actionId}Btn' not found in HTML.`);
            }
        }
    }

    // Initialize gameState's maxActionPoints for Day 1
    gameState.maxActionPoints = gameState.baseMaxActionPoints;

    // Start the first day
    startNewDay();
    logMessage("Station systems online. Welcome back, Commander.");
}

/**
 * Updates the UI to reflect the current game state.
 * This fulfills the user story: "...see my current Action Points (AP) clearly displayed..."
 */
function updateUI() {
    ui.dayDisplay.textContent = gameState.currentDay;
    ui.apDisplay.textContent = `${gameState.actionPoints} / ${gameState.maxActionPoints}`;
    ui.hydrationDisplay.textContent = `${gameState.hydrationLevel}%`;

    // Enable/disable action buttons based on AP, using actionDefinitions
    // This fulfills the user story: "...be prevented from performing an action if I do not have enough Action Points..."
    for (const actionId in ui.actionButtons) {
        if (ui.actionButtons.hasOwnProperty(actionId)) {
            const button = ui.actionButtons[actionId];
            // Get AP cost from the source of truth, actionDefinitions
            const apCost = actionDefinitions[actionId].apCost; 
            button.disabled = gameState.actionPoints < apCost;
        }
    }

    // End Day button is always enabled unless game over or during night transition
    if (gameState.actionPoints === 0 && gameState.currentDay > 0) {
        ui.endDayBtn.disabled = true; // Will be re-enabled by startNewDay
    } else {
        ui.endDayBtn.disabled = false;
    }
}

/**
 * Starts a new game day.
 * This fulfills the user stories:
 * "...have my Action Points reset to maximum at the start of each new day..."
 * "...see my maximum Action Points potentially reduced if my hydration was low..."
 * And now: "...not reduce max AP any further than 5..."
 * And updated: "...deficit penalty when hydration is under 80 instead of 50."
 */
function startNewDay() {
    gameState.currentDay++;

    // Calculate max AP for the day, applying hydration penalty from the *previous* night
    let effectiveMaxAP = gameState.baseMaxActionPoints; // Start with the base value
    const HYDRATION_PENALTY_THRESHOLD = 80; // New threshold for hydration penalty
    const MIN_AP = 5; // Minimum AP allowed after penalties

    if (gameState.currentDay > 1) { // Only apply penalty from Day 2 onwards
        // Hydration penalty: -1 AP for every 10% hydration below the threshold
        if (gameState.hydrationLevel < HYDRATION_PENALTY_THRESHOLD) {
            const hydrationDeficit = HYDRATION_PENALTY_THRESHOLD - gameState.hydrationLevel;
            const hydrationPenalty = Math.floor(hydrationDeficit / 10);
            
            // Apply penalty, but ensure it doesn't drop below MIN_AP
            effectiveMaxAP = Math.max(MIN_AP, gameState.baseMaxActionPoints - hydrationPenalty); 
            logMessage(`Hydration was low last night (${gameState.hydrationLevel}% < ${HYDRATION_PENALTY_THRESHOLD}%). Max AP reduced to ${effectiveMaxAP}.`);
        } else {
             // If hydration is good, ensure max AP is restored to base
            effectiveMaxAP = gameState.baseMaxActionPoints; 
        }
    }
    
    gameState.actionPoints = effectiveMaxAP;
    gameState.maxActionPoints = effectiveMaxAP; // Update max AP for the current day's display
    
    logMessage(`Day ${gameState.currentDay} begins. AP: ${gameState.actionPoints}.`);
    updateUI();
}

/**
 * Generic function to perform an action, deducting AP and checking for day end.
 * Now takes actionId and looks up cost from actionDefinitions.
 * @param {string} actionId - The ID of the action (e.g., 'explore', 'scavenge').
 */
function performAction(actionId) {
    const definition = actionDefinitions[actionId];
    if (!definition) {
        console.error(`Unknown action: ${actionId}`);
        return false;
    }

    const actionCost = definition.apCost;
    const actionName = definition.name;

    if (gameState.actionPoints < actionCost) {
        logMessage(`Insufficient AP to ${actionName}! Requires ${actionCost}, have ${gameState.actionPoints}.`);
        console.warn(`Attempted to perform ${actionName} without enough AP.`);
        return false;
    }

    gameState.actionPoints -= actionCost;
    logMessage(`Performed: ${actionName}. AP remaining: ${gameState.actionPoints}.`);
    updateUI();

    if (gameState.actionPoints === 0) {
        logMessage("Action Points depleted! Day ends.");
        endDay();
    }
    return true;
}

/**
 * Ends the current day, transitioning to the night cycle.
 */
function endDay() {
    // Disable all buttons to prevent interaction during night transition
    for (const actionId in ui.actionButtons) {
        if (ui.actionButtons.hasOwnProperty(actionId)) {
            ui.actionButtons[actionId].disabled = true;
        }
    }
    ui.endDayBtn.disabled = true;

    logMessage("Initiating Night Cycle protocols...");
    // Simulate night passage (e.g., show a 'Night Active' screen, run calculations)
    // For this example, we'll just log and then start a new day after a delay.
    setTimeout(() => {
        logMessage("Night Cycle complete. Awaiting Morning Report...");
        // In a real game, this would lead to a Morning Report screen.
        // For this demo, we'll just go straight to the next day.
        startNewDay();
    }, 2000); // Simulate 2-second night
}


// --- Utility Functions ---

/**
 * Logs a message to the game log UI.
 */
function logMessage(message) {
    const timestamp = new Date().toLocaleTimeString();
    ui.log.textContent += `[${timestamp}] ${message}\n`;
    ui.log.scrollTop = ui.log.scrollHeight; // Auto-scroll to bottom
}

// --- Debug Functions ---

/**
 * Debug function to manually set the player's hydration level.
 * Call this from the browser console: setHydrationLevel(value)
 * @param {number} level - The desired hydration level (0-100).
 */
function setHydrationLevel(level) {
    if (typeof level !== 'number' || level < 0 || level > 100) {
        logMessage("DEBUG: Invalid hydration level. Please provide a number between 0 and 100.");
        console.error("Invalid hydration level provided to setHydrationLevel.");
        return;
    }
    gameState.hydrationLevel = level;
    logMessage(`DEBUG: Hydration level set to ${level}%.`);
    updateUI();
}

/**
 * Debug function to change the AP cost of a specific action.
 * Call this from the browser console: setActionCost(actionId, newCost)
 * @param {string} actionId - The ID of the action (e.g., 'explore', 'scavenge').
 * @param {number} newCost - The new integer AP cost for the action (must be >= 0).
 */
function setActionCost(actionId, newCost) {
    if (!actionDefinitions.hasOwnProperty(actionId)) {
        logMessage(`DEBUG: Action ID '${actionId}' not found.`);
        console.error(`Action ID '${actionId}' not found in actionDefinitions.`);
        return;
    }
    if (typeof newCost !== 'number' || !Number.isInteger(newCost) || newCost < 0) {
        logMessage(`DEBUG: Invalid cost for '${actionId}'. Cost must be a non-negative integer.`);
        console.error(`Invalid cost '${newCost}' provided for action '${actionId}'.`);
        return;
    }

    actionDefinitions[actionId].apCost = newCost;
    logMessage(`DEBUG: AP cost for '${actionId}' set to ${newCost}.`);

    // Update the button text to reflect the new cost
    const button = ui.actionButtons[actionId];
    if (button) {
        button.textContent = `${actionDefinitions[actionId].name} (${newCost} AP)`;
        button.dataset.apCost = newCost; // Update data attribute too
    }
    
    updateUI(); // Re-evaluate button disabled states based on new cost
}


// Initial call to start the game after the DOM is fully loaded.
// This is typically placed at the end of your script or in an <script> tag in HTML.
// document.addEventListener('DOMContentLoaded', initializeGame); // This is in index.html for demo