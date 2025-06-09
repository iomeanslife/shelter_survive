// game.js

// --- Game State ---
const gameState = {
    currentDay: 0,
    actionPoints: 0,
    baseMaxActionPoints: 20,
    maxActionPoints: 20, // This will be the *effective* max AP for the current day
    hydrationLevel: 100, // Percentage (0-100)
    resources: { // Initialize all resources
        salvagedAlloys: 50,
        recycledPolymers: 50,
        conduitWiring: 20,
        energyCells: 10,
        advancedCircuitry: 5,
        recycledWater: 30, // Crucial for reactor cooling and hydration
    },
    // Simplified module tracking for now. In M3.2, this will be a graph.
    stationModules: {
        'Module-001': { id: 'Module-001', name: 'Command Center', risk: 'Safe', discovered: true },
        'Module-002': { id: 'Module-002', name: 'Cargo Bay', risk: 'Medium', discovered: false },
        'Module-003': { id: 'Module-003', name: 'Reactor Core', risk: 'Safe', discovered: true },
        'Module-004': { id: 'Module-004', name: 'Life Support', risk: 'Medium', discovered: false },
        'Module-005': { id: 'Module-005', name: 'Derelict Corridor', risk: 'High', discovered: false },
        'Module-006': { id: 'Module-006', name: 'Maintenance Bay', risk: 'Safe', discovered: false },
        'Module-007': { id: 'Module-007', name: 'Science Lab', risk: 'High', discovered: false },
        'Module-008': { id: 'Module-008', name: 'Crew Quarters', risk: 'Medium', discovered: false },
    },
    reactor: {
        health: 100, // Percentage (0-100)
        currentHeat: 0, // Heat accumulated during the night (resets after calculation)
        optimalOperatingTemperature: 10, // Target heat level; minimal health loss if below this
        heatGenerationPerEnergy: 0.5, // 0.5 heat per 1 energy unit produced (GDD: 1 heat per 2 energy -> 0.5 heat/energy)
        maxPowerCapacity: 100, // Maximum energy the reactor can stably provide per night
        currentPowerOutput: 0, // Actual energy drawn by systems/defenses this night
        coolantPerWaterUnit: 5, // 1 Recycled Water unit cools 5 heat units
    },
    // --- Systems and Defenses that consume energy ---
    // Placeholder for deployed defenses. In a real game, these would be added dynamically.
    deployedDefenses: [
        { id: 'def-001', type: 'automatedTurret', active: true, overclocked: false },
        { id: 'def-002', type: 'forceFieldEmitter', active: true, overclocked: true },
        // More defenses can be added here for testing energy demand
    ],
    // Placeholder for crafting queue. Items consume energy during the night to progress.
    craftingQueue: [
        { id: 'item-001', type: 'energyCellPack', progress: 0, totalAPNeeded: 10, energyCost: 20 },
    ],
    // Core systems
    lifeSupportSystem: {
        active: true, // For now, assume it's always active
        energyCost: 10, // Constant nightly energy draw
    },
    fabricationUnit: {
        active: true, // Assume active unless explicitly damaged
        baseEnergyCost: 5, // Base energy cost even when idle/not crafting
        energyCostPerCraftingItem: 15,
    },
    // Game over flag
    isGameOver: false,
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
        min: { salvagedAlloys: 5, recycledPolymers: 5, conduitWiring: 2, energyCells: 1, advancedCircuitry: 0, recycledWater: 3 },
        max: { salvagedAlloys: 10, recycledPolymers: 10, conduitWiring: 4, energyCells: 2, advancedCircuitry: 1, recycledWater: 6 }
    }
};

// --- Energy Consumption Definitions for Systems/Defenses ---
const systemDefinitions = {
    lifeSupportSystem: {
        energyCost: 10,
    },
    fabricationUnit: {
        baseEnergyCost: 5,
    }
};


const defenseDefinitions = {
    automatedTurret: {
        baseEnergyCost: 5,
        overclockEnergyMultiplier: 1.5,
        underclockEnergyMultiplier: 0.5,
    },
    forceFieldEmitter: {
        baseEnergyCost: 15,
        overclockEnergyMultiplier: 1.5,
        underclockEnergyMultiplier: 0.5,
    }
};

// --- Action Definitions (Single Source of Truth for AP Costs and Resource Costs) ---
const actionDefinitions = {
    explore: { name: "Explore", apCost: 2 }, // AP cost will vary by module risk in GDD, simplifying here for now.
    scavenge: { name: "Scavenge", apCost: 3 },
    repairReactor: {
        name: "Repair Reactor",
        apCost: 4,
        resourceCosts: { salvagedAlloys: 8, advancedCircuitry: 2 },
        repairAmount: 20 // Health restored
    },
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
    resourcesList: null,
    moduleList: null,
    reactorHealthDisplay: null, // New UI element
    reactorHeatDisplay: null,   // New UI element
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
    ui.resourcesList = document.getElementById('resourcesList');
    ui.moduleList = document.getElementById('moduleList');
    ui.reactorHealthDisplay = document.getElementById('reactorHealthDisplay');
    ui.reactorHeatDisplay = document.getElementById('reactorHeatDisplay');


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
                button.dataset.apCost = definition.apCost; // Store cost in a data attribute for quick reference
                button.onclick = () => performAction(actionId); // Link to generic performAction
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
 */
function updateUI() {
    if (gameState.isGameOver) return; // Prevent UI updates if game is over

    ui.dayDisplay.textContent = gameState.currentDay;
    ui.apDisplay.textContent = `${gameState.actionPoints} / ${gameState.maxActionPoints}`;
    ui.hydrationDisplay.textContent = `${gameState.hydrationLevel}%`;

    // Update reactor stats
    ui.reactorHealthDisplay.textContent = `${gameState.reactor.health}%`;
    ui.reactorHeatDisplay.textContent = `${gameState.reactor.currentHeat}`;


    // Update resources list display
    let resourcesHtml = '';
    for (const res in gameState.resources) {
        resourcesHtml += `<li>${formatResourceName(res)}: ${gameState.resources[res]}</li>`;
    }
    ui.resourcesList.innerHTML = resourcesHtml;

    // Update module list display (simplified for this demo)
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
            // Special case for Repair Reactor button, only if reactor is damaged
            if (actionId === 'repairReactor') {
                canAfford = canAfford && gameState.reactor.health < 100;
            }

            button.disabled = !canAfford;
        }
    }

    // End Day button is always enabled unless game is over (handled by onclick directly)
    ui.endDayBtn.disabled = gameState.isGameOver;
}

/**
 * Starts a new game day.
 * Includes daily Recycled Water consumption for hydration.
 */
function startNewDay() {
    if (gameState.isGameOver) return;

    gameState.currentDay++;

    // --- Daily Hydration Consumption ---
    const DAILY_HYDRATION_WATER_COST = 5;
    const HYDRATION_PENALTY_THRESHOLD = 80;
    const MIN_AP = 5;

    if (gameState.resources.recycledWater >= DAILY_HYDRATION_WATER_COST) {
        gameState.resources.recycledWater -= DAILY_HYDRATION_WATER_COST;
        gameState.hydrationLevel = 100; // Fully hydrated if enough water
        logMessage(`Consumed ${DAILY_HYDRATION_WATER_COST} Recycled Water for hydration. Hydration level: ${gameState.hydrationLevel}%.`);
    } else {
        gameState.resources.recycledWater = 0;
        gameState.hydrationLevel = Math.max(0, gameState.hydrationLevel - 20); // Significant drop
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
    }
    
    gameState.actionPoints = effectiveMaxAP;
    gameState.maxActionPoints = effectiveMaxAP; // Update max AP for the current day's display
    
    logMessage(`Day ${gameState.currentDay} begins. AP: ${gameState.actionPoints}.`);
    updateUI();
}

/**
 * Generic function to perform an action, deducting AP and checking for day end.
 * Now also handles resource deduction and specific action logic.
 * @param {string} actionId - The ID of the action (e.g., 'explore', 'scavenge').
 */
function performAction(actionId) {
    if (gameState.isGameOver) {
        logMessage("Game Over. Cannot perform actions.");
        return false;
    }

    const definition = actionDefinitions[actionId];
    if (!definition) {
        console.error(`Unknown action: ${actionId}`);
        return false;
    }

    const actionCost = definition.apCost;
    const actionName = definition.name;
    const resourceCosts = definition.resourceCosts || {};

    // Check AP first
    if (gameState.actionPoints < actionCost) {
        logMessage(`Insufficient AP to ${actionName}! Requires ${actionCost}, have ${gameState.actionPoints}.`);
        console.warn(`Attempted to perform ${actionName} without enough AP.`);
        return false;
    }

    // Check resources
    if (definition.resourceCosts && !canAffordResources(resourceCosts)) {
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

    // --- Specific Action Effects ---
    switch(actionId) {
        case 'scavenge':
            // For now, let's assume scavenging happens in the first discovered module
            const targetModule = Object.values(gameState.stationModules).find(m => m.discovered);
            if (targetModule) {
                scavengeResources(targetModule.risk);
            } else {
                logMessage("No discovered modules to scavenge in! Explore first.");
            }
            break;
        case 'explore':
            const nextUndiscoveredModule = Object.values(gameState.stationModules).find(m => !m.discovered);
            if (nextUndiscoveredModule) {
                nextUndiscoveredModule.discovered = true;
                logMessage(`Discovered: ${nextUndiscoveredModule.name} (${nextUndiscoveredModule.risk} Risk)!`);
                // In a later task: trigger issues based on risk, add Threat Points
            } else {
                logMessage("No more modules to explore!");
            }
            break;
        case 'repairReactor':
            const repairAmount = definition.repairAmount;
            gameState.reactor.health = Math.min(100, gameState.reactor.health + repairAmount);
            logMessage(`Reactor repaired! Health is now ${gameState.reactor.health}%.`);
            break;
        case 'buildDefense':
            logMessage(`You built a defense. (Implementation pending)`);
            // This would later add a defense object to gameState.deployedDefenses
            // For now, just resources and AP are deducted.
            break;
        case 'craftItem':
            logMessage(`You crafted an item. (Implementation pending)`);
            // This would later add items to inventory or queue them
            break;
        case 'resolveIssue':
            logMessage(`You resolved an issue. (Implementation pending)`);
            // This would later remove an issue from activeIssues
            break;
        case 'research':
            logMessage(`You conducted research. (Implementation pending)`);
            // This would later add research points
            break;
    }

    updateUI(); // Update UI after all state changes
    checkGameOver(); // Check for game over after each action

    if (gameState.actionPoints === 0 && !gameState.isGameOver) {
        logMessage("Action Points depleted! Day ends.");
        endDay();
    }
    return true;
}

/**
 * Ends the current day, transitioning to the night cycle.
 * Includes Recycled Water consumption for reactor cooling and reactor health effects.
 */
function endDay() {
    if (gameState.isGameOver) return;

    // Disable all buttons to prevent interaction during night transition
    for (const actionId in ui.actionButtons) {
        if (ui.actionButtons.hasOwnProperty(actionId)) {
            ui.actionButtons[actionId].disabled = true;
        }
    }
    ui.endDayBtn.disabled = true;

    logMessage("Initiating Night Cycle protocols...");

    // --- REACTOR MANAGEMENT FOR NIGHT CYCLE ---
    
    // 1. Calculate total energy demand for active systems and defenses
    let totalEnergyDemand = calculateTotalEnergyDemand();
    gameState.reactor.currentPowerOutput = totalEnergyDemand; // Set actual output

    // 2. Apply reactor health penalties to heat generation
    let effectiveHeatGenerationPerEnergy = gameState.reactor.heatGenerationPerEnergy;
    effectiveHeatGenerationPerEnergy = applyReactorHealthPenalties(effectiveHeatGenerationPerEnergy);

    // 3. Calculate raw heat generated based on energy demand
    let rawHeatGenerated = totalEnergyDemand * effectiveHeatGenerationPerEnergy;
    gameState.reactor.currentHeat = rawHeatGenerated; // Store generated heat for display/report

    logMessage(`Reactor generated ${rawHeatGenerated.toFixed(1)} heat from ${totalEnergyDemand} energy demand.`);

    // 4. Calculate required coolant water and consume it
    const waterNeededToCoolAllHeat = Math.ceil(rawHeatGenerated / gameState.reactor.coolantPerWaterUnit);
    let actualWaterUsedForCooling = 0;
    let uncooledHeat = 0;

    if (gameState.resources.recycledWater >= waterNeededToCoolAllHeat) {
        actualWaterUsedForCooling = waterNeededToCoolAllHeat;
        gameState.resources.recycledWater -= actualWaterUsedForCooling;
        gameState.reactor.currentHeat = 0; // All heat cooled
        logMessage(`Consumed ${actualWaterUsedForCooling} Recycled Water for reactor cooling. Heat stable.`);
    } else {
        actualWaterUsedForCooling = gameState.resources.recycledWater;
        gameState.resources.recycledWater = 0;
        const cooledHeat = actualWaterUsedForCooling * gameState.reactor.coolantPerWaterUnit;
        uncooledHeat = rawHeatGenerated - cooledHeat;
        gameState.reactor.currentHeat = uncooledHeat; // Remaining heat
        logMessage(`Insufficient Recycled Water for reactor cooling! Uncooled heat: ${uncooledHeat.toFixed(1)}.`);
    }

    // 5. Apply reactor health degradation from uncooled heat/overheating
    if (gameState.reactor.currentHeat > gameState.reactor.optimalOperatingTemperature || uncooledHeat > 0) {
        const excessHeat = Math.max(0, gameState.reactor.currentHeat - gameState.reactor.optimalOperatingTemperature);
        const damageAmount = Math.ceil((excessHeat + uncooledHeat) / 10);
        gameState.reactor.health = Math.max(0, gameState.reactor.health - damageAmount);
        logMessage(`Reactor health reduced by ${damageAmount} due to overheating! Health: ${gameState.reactor.health}%.`);
    } else {
        logMessage("Reactor temperature maintained. No health loss from heat.");
    }

    // --- End REACTOR MANAGEMENT ---

    // Simulate night passage (e.g., show a 'Night Active' screen, run calculations)
    setTimeout(() => {
        logMessage("Night Cycle complete. Awaiting Morning Report...");
        startNewDay();
        checkGameOver(); // Check game over conditions after night calculations and before next day actions
    }, 2000); // Simulate 2-second night
}

/**
 * Checks all game over conditions.
 */
function checkGameOver() {
    let gameOverReason = null;

    if (gameState.reactor.health <= 0) {
        gameOverReason = "Reactor Meltdown! The station is gone.";
    }
    // Check for Dehydration Game Over (Milestone 2.1 Task 4)
    if (gameState.hydrationLevel <= 0) {
        gameOverReason = "Dehydration claimed you. You succumbed to the harsh realities of space.";
    }
    // Add other game over conditions as they are implemented:
    // if (gameState.stationIntegrity <= 0) { gameOverReason = "Station integrity compromised!"; }
    
    if (gameOverReason) {
        gameOver(gameOverReason);
    }
}

/**
 * Sets the game to a Game Over state.
 * @param {string} reason - The reason for the game over.
 */
function gameOver(reason) {
    gameState.isGameOver = true;
    logMessage(`--- GAME OVER ---`);
    logMessage(`Reason: ${reason}`);
    logMessage("Refresh the page to start a new game.");

    // Disable all buttons definitively
    for (const actionId in ui.actionButtons) {
        if (ui.actionButtons.hasOwnProperty(actionId)) {
            ui.actionButtons[actionId].disabled = true;
        }
    }
    ui.endDayBtn.disabled = true;

    // Potentially show a dedicated Game Over screen (UI element)
}


// --- Specific Action Logic ---

/**
 * Handles resource gain from scavenging based on module risk.
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

/**
 * Calculates the total energy demand from all active systems and deployed defenses.
 * @returns {number} The total energy units required.
 */
function calculateTotalEnergyDemand() {
    let totalDemand = 0;

    // Life Support System
    if (gameState.lifeSupportSystem.active) {
        totalDemand += systemDefinitions.lifeSupportSystem.energyCost;
    }

    // Fabrication Unit (base cost + cost for items in queue)
    if (gameState.fabricationUnit.active) {
        totalDemand += gameState.fabricationUnit.baseEnergyCost;
        totalDemand += gameState.craftingQueue.length * gameState.fabricationUnit.energyCostPerCraftingItem;
    }

    // Deployed Defenses
    gameState.deployedDefenses.forEach(defense => {
        if (defense.active) {
            let defenseEnergy = defenseDefinitions[defense.type].baseEnergyCost;
            if (defense.overclocked) {
                defenseEnergy *= defenseDefinitions[defense.type].overclockEnergyMultiplier;
            } else if (defense.underclocked) {
                defenseEnergy *= defenseDefinitions[defense.type].underclockEnergyMultiplier;
            }
            totalDemand += defenseEnergy;
        }
    });

    // Cap demand at max power capacity
    return Math.min(totalDemand, gameState.reactor.maxPowerCapacity);
}

/**
 * Applies penalties to heat generation based on reactor health.
 * @param {number} baseHeatGenRate - The initial heat generation rate.
 * @returns {number} The adjusted heat generation rate.
 */
function applyReactorHealthPenalties(baseHeatGenRate) {
    let multiplier = 1;
    if (gameState.reactor.health < 100) {
        const healthLost = 100 - gameState.reactor.health;
        multiplier += (healthLost / 5) * 0.01;
        logMessage(`Reactor health (${gameState.reactor.health}%) applies a heat generation penalty. Multiplier: ${multiplier.toFixed(2)}x`);
    }
    return baseHeatGenRate * multiplier;
}


// --- Utility Functions ---

/**
 * Helper to check if player can afford resources for an action.
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

    const button = ui.actionButtons[actionId];
    if (button) {
        let buttonText = `${actionDefinitions[actionId].name} (${newCost} AP)`;
        if (actionDefinitions[actionId].resourceCosts) {
            const costs = Object.entries(actionDefinitions[actionId].resourceCosts)
                                .map(([res, qty]) => `${qty} ${formatResourceName(res)}`)
                                .join(', ');
            buttonText += `, ${costs}`;
        }
        button.textContent = buttonText;
        button.dataset.apCost = newCost;
    }
    
    updateUI();
}

/**
 * Debug function to set a resource quantity.
 * Call this from the browser console: setResource('salvagedAlloys', 100)
 * @param {string} resourceId - The camelCase ID of the resource (e.g., 'recycledWater').
 * @param {number} amount - The new amount for the resource.
 */
function setResource(resourceId, amount) {
    if (gameState.resources.hasOwnProperty(resourceId)) {
        if (typeof amount === 'number' && amount >= 0) {
            gameState.resources[resourceId] = amount;
            logMessage(`DEBUG: ${formatResourceName(resourceId)} set to ${amount}.`);
            updateUI();
        } else {
            logMessage(`DEBUG: Invalid amount for resource '${resourceId}'.`);
        }
    } else {
        logMessage(`DEBUG: Resource '${resourceId}' not found.`);
    }
}

/**
 * Debug function to set reactor health.
 * Call this from the browser console: setReactorHealth(value)
 * @param {number} health - The desired reactor health (0-100).
 */
function setReactorHealth(health) {
    if (typeof health !== 'number' || health < 0 || health > 100) {
        logMessage("DEBUG: Invalid reactor health. Provide a number between 0 and 100.");
        return;
    }
    gameState.reactor.health = health;
    logMessage(`DEBUG: Reactor health set to ${health}%.`);
    updateUI();
}

// Initial call to start the game after the DOM is fully loaded.
document.addEventListener('DOMContentLoaded', initializeGame);