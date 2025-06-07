// game.js

// --- Game State ---
const gameState = {
    currentDay: 0,
    actionPoints: 0,
    baseMaxActionPoints: 20,
    maxActionPoints: 20,
    hydrationLevel: 100,
    resources: { // Initialize all resources
        salvagedAlloys: 50,
        recycledPolymers: 50,
        conduitWiring: 20,
        energyCells: 10,
        advancedCircuitry: 5,
        recycledWater: 30,
    },
    // Simplified module tracking for now. In M3.2, this will be a graph.
    // Each module will have a unique ID, known risk, and discovered status.
    stationModules: {
        'Module-001': { name: 'Command Center', risk: 'Safe', discovered: true },
        'Module-002': { name: 'Cargo Bay', risk: 'Medium', discovered: false },
        'Module-003': { name: 'Reactor Core', risk: 'Safe', discovered: true },
        'Module-004': { name: 'Life Support', risk: 'Medium', discovered: false },
        'Module-005': { name: 'Derelict Corridor', risk: 'High', discovered: false },
        // ... (up to 20 modules will be randomly generated for a full game)
    },
    // Placeholder for reactor details for water consumption
    reactor: {
        heat: 0, // Current heat
        maxHeatCapacity: 100, // Max heat before damage
        // For this task, we just need a heat value to consume water for.
        // The detailed energy/heat calculation comes in M2.1 Task 3.
        // For now, let's assume a fixed heat generation per night that needs cooling.
    }
};

// --- Resource Yield Definitions (for scavenging) ---
const resourceYields = {
    Safe: {
        min: { salvagedAlloys: 2, recycledPolymers: 2, recycledWater: 1 },
        max: { salvagedAlloys: 4, recycledPolymers: 4, recycledWater: 2 }
    },
    Medium: {
        min: { salvagedAlloys: 3, recycledPolymers: 3, conduitWiring: 1, recycledWater: 2 },
        max: { salvagedAlloys: 6, recycledPolymers: 6, conduitWiring: 2, recycledWater: 4 }
    },
    High: {
        min: { salvagedAlloys: 5, recycledPolymers: 5, conduitWiring: 2, energyCells: 1, advancedCircuitry: 0, recycledWater: 3 }, // Adv Circuitry can be 0-1
        max: { salvagedAlloys: 10, recycledPolymers: 10, conduitWiring: 4, energyCells: 2, advancedCircuitry: 1, recycledWater: 6 }
    }
};

// --- Specific Action Costs (including resource costs) ---
const actionDefinitions = {
    explore: { name: "Explore", apCost: 2 }, // AP cost will vary by module risk in GDD, simplifying here for now.
    scavenge: { name: "Scavenge", apCost: 3 },
    adjustReactor: { name: "Adjust Reactor", apCost: 1 },
    buildDefense: {
        name: "Build Defense",
        apCost: 5,
        resourceCosts: { salvagedAlloys: 10, recycledPolymers: 5 } // Example cost
    },
    craftItem: {
        name: "Craft Item",
        apCost: 4,
        resourceCosts: { conduitWiring: 3, energyCells: 1 } // Example cost
    },
    resolveIssue: {
        name: "Resolve Issue",
        apCost: 6,
        resourceCosts: { advancedCircuitry: 2, recycledPolymers: 5 } // Example cost
    },
    research: { name: "Research", apCost: 1 },
};

// --- UI Elements (cached for performance) ---
const ui = {
    dayDisplay: null,
    apDisplay: null,
    hydrationDisplay: null,
    log: null,
    actionButtons: {},
    endDayBtn: null,
    resourcesList: null, // New UI element for resources
    moduleList: null, // New UI element for modules
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
    ui.resourcesList = document.getElementById('resourcesList'); // Get new element
    ui.moduleList = document.getElementById('moduleList'); // Get new element

    // Dynamically set up action buttons based on actionDefinitions
    for (const actionId in actionDefinitions) {
        if (actionDefinitions.hasOwnProperty(actionId)) {
            const button = document.getElementById(`${actionId}Btn`);
            if (button) {
                const definition = actionDefinitions[actionId];
                // Update button text to include resource costs if they exist
                let buttonText = `${definition.name} (${definition.apCost} AP)`;
                if (definition.resourceCosts) {
                    const costs = Object.entries(definition.resourceCosts).map(([res, qty]) => `${qty} ${formatResourceName(res)}`).join(', ');
                    buttonText += `, ${costs}`;
                }
                button.textContent = buttonText;
                button.dataset.apCost = definition.apCost;
                button.onclick = () => performAction(actionId);
                ui.actionButtons[actionId] = button;
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
 * Fulfills: "...see all my resource quantities clearly displayed..."
 */
function updateUI() {
    ui.dayDisplay.textContent = gameState.currentDay;
    ui.apDisplay.textContent = `${gameState.actionPoints} / ${gameState.maxActionPoints}`;
    ui.hydrationDisplay.textContent = `${gameState.hydrationLevel}%`;

    // Update resources list display
    let resourcesHtml = '';
    for (const res in gameState.resources) {
        resourcesHtml += `<li>${formatResourceName(res)}: ${gameState.resources[res]}</li>`;
    }
    ui.resourcesList.innerHTML = resourcesHtml;

    // Update module list display
    let moduleHtml = '';
    for (const moduleId in gameState.stationModules) {
        const module = gameState.stationModules[moduleId];
        moduleHtml += `<li>${module.name} (${module.risk} Risk) - ${module.discovered ? 'Discovered' : 'Undiscovered'}</li>`;
    }
    ui.moduleList.innerHTML = moduleHtml;

    // Enable/disable action buttons based on AP and Resources
    for (const actionId in ui.actionButtons) {
        if (ui.actionButtons.hasOwnProperty(actionId)) {
            const button = ui.actionButtons[actionId];
            const definition = actionDefinitions[actionId];
            const apCost = definition.apCost;
            
            let canAfford = gameState.actionPoints >= apCost;

            if (definition.resourceCosts) {
                canAfford = canAfford && canAffordResources(definition.resourceCosts);
            }
            // Special case for Scavenge button, needs a discovered module
            if (actionId === 'scavenge') {
                canAfford = canAfford && Object.values(gameState.stationModules).some(m => m.discovered);
            }
            // Special case for Explore button, needs an undiscovered module
            if (actionId === 'explore') {
                canAfford = canAfford && Object.values(gameState.stationModules).some(m => !m.discovered);
            }

            button.disabled = !canAfford;
        }
    }

    ui.endDayBtn.disabled = false; // Always allow ending day unless game over, handled by separate logic later
}

/**
 * Starts a new game day.
 * Includes daily Recycled Water consumption for hydration.
 */
function startNewDay() {
    gameState.currentDay++;

    // --- Daily Hydration Consumption ---
    const DAILY_HYDRATION_WATER_COST = 5; // Fixed daily water cost for player hydration
    const HYDRATION_PENALTY_THRESHOLD = 80; // New threshold for hydration penalty
    const MIN_AP = 5; // Minimum AP allowed after penalties

    if (gameState.resources.recycledWater >= DAILY_HYDRATION_WATER_COST) {
        gameState.resources.recycledWater -= DAILY_HYDRATION_WATER_COST;
        gameState.hydrationLevel = 100; // Fully hydrated if enough water
        logMessage(`Consumed ${DAILY_HYDRATION_WATER_COST} Recycled Water for hydration. Hydration level: ${gameState.hydrationLevel}%.`);
    } else {
        gameState.resources.recycledWater = 0;
        // Reduce hydration more significantly if no water
        gameState.hydrationLevel = Math.max(0, gameState.hydrationLevel - 20);
        logMessage(`Insufficient Recycled Water for full hydration! Hydration level: ${gameState.hydrationLevel}%.`);
        console.warn("Insufficient water for hydration! Player hydration level dropped.");
    }

    // Calculate max AP for the day, applying hydration penalty from the *previous* night's effective hydration
    let effectiveMaxAP = gameState.baseMaxActionPoints;
    if (gameState.currentDay > 1) { // Only apply penalty from Day 2 onwards
        if (gameState.hydrationLevel < HYDRATION_PENALTY_THRESHOLD) {
            const hydrationDeficit = HYDRATION_PENALTY_THRESHOLD - gameState.hydrationLevel;
            const hydrationPenalty = Math.floor(hydrationDeficit / 10);
            effectiveMaxAP = Math.max(MIN_AP, gameState.baseMaxActionPoints - hydrationPenalty);
            logMessage(`Hydration was low last night (${gameState.hydrationLevel}% < ${HYDRATION_PENALTY_THRESHOLD}%). Max AP reduced to ${effectiveMaxAP}.`);
        } else {
            effectiveMaxAP = gameState.baseMaxActionPoints;
        }
    } else {
        effectiveMaxAP = gameState.baseMaxActionPoints; // For Day 1, use base maxAP
    }
    
    gameState.actionPoints = effectiveMaxAP;
    gameState.maxActionPoints = effectiveMaxAP;
    
    logMessage(`Day ${gameState.currentDay} begins. AP: ${gameState.actionPoints}.`);
    updateUI();
}

/**
 * Generic function to perform an action, deducting AP and checking for day end.
 * Now also handles resource deduction.
 * @param {string} actionId - The ID of the selflessAction (e.g., 'explore', 'scavenge').
 */
function performAction(actionId) {
    const definition = actionDefinitions[actionId];
    if (!definition) {
        console.error(`Unknown action: ${actionId}`);
        return false;
    }

    const actionCost = definition.apCost;
    const actionName = definition.name;
    const resourceCosts = definition.resourceCosts || {}; // Get resource costs, default to empty object

    // Check AP first
    if (gameState.actionPoints < actionCost) {
        logMessage(`Insufficient AP to ${actionName}! Requires ${actionCost}, have ${gameState.actionPoints}.`);
        console.warn(`Attempted to perform ${actionName} without enough AP.`);
        return false;
    }

    // Check resources
    if (!canAffordResources(resourceCosts)) {
        let neededResources = [];
        for (const res in resourceCosts) {
            if (gameState.resources[res] < resourceCosts[res]) {
                neededResources.push(`${resourceCosts[res]} ${formatResourceName(res)}`);
            }
        }
        logMessage(`Insufficient resources to ${actionName}! Need: ${neededResources.join(', ')}.`);
        console.warn(`Attempted to perform ${actionName} without enough resources.`);
        return false;
    }

    // Deduct AP
    gameState.actionPoints -= actionCost;

    // Deduct resources
    for (const res in resourceCosts) {
        gameState.resources[res] -= resourceCosts[res];
    }
    
    logMessage(`Performed: ${actionName}. AP remaining: ${gameState.actionPoints}.`);
    // Add specific action effects here (e.g., gain resources for scavenge, build defense for buildDefense)
    switch(actionId) {
        case 'scavenge':
            // For now, let's assume scavenging happens in the first discovered module
            // In a real game, player would select a module.
            const targetModule = Object.values(gameState.stationModules).find(m => m.discovered);
            if (targetModule) {
                scavengeResources(targetModule.risk);
            } else {
                logMessage("No discovered modules to scavenge in!");
            }
            break;
        case 'explore':
            // For now, let's just "discover" the next undiscovered module.
            const nextUndiscoveredModule = Object.values(gameState.stationModules).find(m => !m.discovered);
            if (nextUndiscoveredModule) {
                nextUndiscoveredModule.discovered = true;
                logMessage(`Discovered: ${nextUndiscoveredModule.name} (${nextUndiscoveredModule.risk} Risk)!`);
            } else {
                logMessage("No more modules to explore!");
            }
            break;
        // Other actions don't have immediate, simple resource gains in this demo
        // and their specific effects (building, crafting, resolving) will be implemented later.
    }

    updateUI(); // Update UI after all state changes

    if (gameState.actionPoints === 0) {
        logMessage("Action Points depleted! Day ends.");
        endDay();
    }
    return true;
}

/**
 * Ends the current day, transitioning to the night cycle.
 * Includes Recycled Water consumption for reactor cooling.
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

    // --- Reactor Cooling Consumption (simplified for now) ---
    const NIGHTLY_REACTOR_HEAT_GENERATED = 30; // Example fixed heat generated by reactor per night
    const WATER_PER_HEAT_UNIT = 5; // 1 water cools 5 heat units (from GDD)
    const REACTOR_COOLANT_REQUIRED = Math.ceil(NIGHTLY_REACTOR_HEAT_GENERATED / WATER_PER_HEAT_UNIT);

    if (gameState.resources.recycledWater >= REACTOR_COOLANT_REQUIRED) {
        gameState.resources.recycledWater -= REACTOR_COOLANT_REQUIRED;
        gameState.reactor.heat = 0; // Assume full cooling for now
        logMessage(`Consumed ${REACTOR_COOLANT_REQUIRED} Recycled Water for reactor cooling.`);
    } else {
        const actualWaterUsed = gameState.resources.recycledWater;
        gameState.resources.recycledWater = 0;
        const uncooledHeat = NIGHTLY_REACTOR_HEAT_GENERATED - (actualWaterUsed * WATER_PER_HEAT_UNIT);
        gameState.reactor.heat += uncooledHeat; // Accumulate uncooled heat
        logMessage(`Insufficient Recycled Water for reactor cooling! Uncooled heat: ${uncooledHeat}.`);
        // In a later task, this heat would damage the reactor.
    }
    
    // Simulate night passage (e.g., show a 'Night Active' screen, run calculations)
    setTimeout(() => {
        logMessage("Night Cycle complete. Awaiting Morning Report...");
        // In a real game, this would lead to a Morning Report screen.
        // For this demo, we'll just go straight to the next day.
        startNewDay();
    }, 2000); // Simulate 2-second night
}


// --- Specific Action Logic ---

/**
 * Handles resource gain from scavenging based on module risk.
 * Fulfills: "...gain specific resources when I successfully perform a "Scavenge" action..."
 * @param {string} riskType - 'Safe', 'Medium', or 'High'
 */
function scavengeResources(riskType) {
    const yieldRange = resourceYields[riskType];
    if (!yieldRange) {
        console.error(`Invalid riskType for scavenging: ${riskType}`);
        return;
    }

    let foundResources = [];
    for (const res in yieldRange.min) {
        const min = yieldRange.min[res];
        const max = yieldRange.max[res];
        // Generate a random amount between min and max (inclusive)
        const amount = Math.floor(Math.random() * (max - min + 1)) + min;
        
        if (amount > 0) {
            gameState.resources[res] += amount;
            foundResources.push(`${amount} ${formatResourceName(res)}`);
        }
    }
    if (foundResources.length > 0) {
        logMessage(`Scavenged: ${foundResources.join(', ')}.`);
    } else {
        logMessage(`Scavenged, but found nothing useful in ${riskType} module.`);
    }
}


// --- Utility Functions ---

/**
 * Helper to check if player can afford resources for an action.
 * Fulfills: "...be prevented from performing actions if I do not have enough of the required resources..."
 * @param {object} costs - Object with resource names and amounts.
 * @returns {boolean} True if player has enough resources, false otherwise.
 */
function canAffordResources(costs) {
    for (const res in costs) {
        if (gameState.resources[res] === undefined || gameState.resources[res] < costs[res]) {
            return false;
        }
    }
    return true;
}

/**
 * Formats a camelCase resource name into a more readable string.
 * @param {string} name - The resource name (e.g., 'salvagedAlloys').
 * @returns {string} Formatted name (e.g., 'Salvaged Alloys').
 */
function formatResourceName(name) {
    return name.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
}

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
        // Re-generate button text with potentially updated AP cost and existing resource costs
        let buttonText = `${actionDefinitions[actionId].name} (${newCost} AP)`;
        if (actionDefinitions[actionId].resourceCosts) {
            const costs = Object.entries(actionDefinitions[actionId].resourceCosts)
                                .map(([res, qty]) => `${qty} ${formatResourceName(res)}`)
                                .join(', ');
            buttonText += `, ${costs}`;
        }
        button.textContent = buttonText;
        button.dataset.apCost = newCost; // Update data attribute too
    }
    
    updateUI(); // Re-evaluate button disabled states based on new cost
}


// Initial call to start the game after the DOM is fully loaded.
document.addEventListener('DOMContentLoaded', initializeGame);