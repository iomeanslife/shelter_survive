// game.js

// --- 1. Game State Management ---
// This object holds all the dynamic data of your game.
const gameState = {
    // Core Game Properties
    currentDay: 0, // Starts at 0, increments to 1 on first day start
    actionPoints: 0,
    maxActionPoints: 20, // Initial AP for Day 1
    stationIntegrity: 100, // Percentage, Game Over if 0
    isGameOver: false,
    gameOverReason: '',

    // Resources
    resources: {
        salvagedAlloys: 50,
        recycledPolymers: 50,
        conduitWiring: 20,
        energyCells: 10,
        advancedCircuitry: 5,
        recycledWater: 30, // Critical for reactor cooling and player hydration
    },

    // Reactor Status
    reactor: {
        powerOutputTier: 'Low', // 'Low', 'Medium', 'High'
        heat: 0, // Current heat generated (0-100, or higher if overheating)
        maxHeatCapacity: 100, // Max heat before taking damage
        coolantRequired: 0, // Water needed for current power output
        health: 100, // Reactor health (0-100%), Game Over if 0
    },
    hydrationLevel: 100, // Player hydration (0-100%)

    // Station Layout & Exploration
    // Each module/sector has a type (Safe, Medium Risk, High Risk) and discovery status.
    // In a real game, you'd have more properties like defense slots, resource nodes, etc.
    modules: {
        'Command Center': { type: 'Safe', discovered: true, description: 'The central hub of the station.' },
        'Cargo Bay': { type: 'Medium Risk', discovered: false, description: 'A large storage area, potential salvage.' },
        'Reactor Core': { type: 'Safe', discovered: true, description: 'The heart of the station, power generator.' },
        'Life Support': { type: 'Safe', discovered: false, description: 'Manages air and water recycling.' },
        'Derelict Corridor': { type: 'High Risk', discovered: false, description: 'Unstable and dangerous, but rare finds possible.' },
        'Hydroponics Lab': { type: 'Safe', discovered: false, description: 'Former agricultural research, might find water.' },
    },

    // Defenses (simplified: just IDs and types for now)
    // Example: [{id: 'barricade_001', type: 'Reinforced Barricade', health: 100, location: 'Cargo Bay', powerSetting: 'Normal'}]
    defenses: [],

    // Issues
    // Example: [{id: 'issue_123', type: 'Plasma Conduit Fluctuation', location: 'Cargo Bay', penalty: 15, resolved: false}]
    activeIssues: [],

    // Threat System
    threatPoints: 0,
    threatLevelThreshold: 100, // Every 100 TP increases Threat Level by 1
    temporaryThreatBoost: 0, // Additional TP from active issues
};

// --- 2. UI Elements (References to HTML elements) ---
// Get references to your HTML elements by their IDs.
const UIElements = {
    dayCounter: document.getElementById('dayCounter'),
    apCounter: document.getElementById('apCounter'),
    stationIntegrity: document.getElementById('stationIntegrity'),
    hydrationLevel: document.getElementById('hydrationLevel'),
    threatLevelDisplay: document.getElementById('threatLevelDisplay'),
    reactorHealth: document.getElementById('reactorHealth'),
    reactorOutput: document.getElementById('reactorOutput'), // New element for reactor output tier
    resourcesList: document.getElementById('resourcesList'),
    moduleList: document.getElementById('moduleList'), // For displaying module names
    actionButtonsContainer: document.getElementById('actionButtonsContainer'), // Container for dynamic action buttons
    activeIssuesList: document.getElementById('activeIssuesList'),
    morningReportScreen: document.getElementById('morningReportScreen'), // The whole report div
    morningReportContent: document.getElementById('morningReportContent'), // Where report text goes
    gameOverScreen: document.getElementById('gameOverScreen'),
    gameOverReason: document.getElementById('gameOverReason'),
    startButton: document.getElementById('startButton'),
    endDayButton: document.getElementById('endDayButton'),
    morningReportContinueButton: document.getElementById('morningReportContinueButton'),
    newGameButton: document.getElementById('newGameButton'),
};

// --- Helper Functions (Globally accessible) ---

/**
 * Checks if the player's hydration level is below 50% for report impairment.
 * @returns {boolean} True if hydration is below 50%, false otherwise.
 */
function checkHydrationImpairment() {
    return gameState.hydrationLevel < 50;
}

/**
 * Helper to check if player can afford resources for an action.
 * @param {object} costs - Object with resource names and amounts.
 * @returns {boolean} True if player has enough resources, false otherwise.
 */
function canAffordResources(costs) {
    for (const res in costs) {
        if (gameState.resources[res] < costs[res]) {
            return false;
        }
    }
    return true;
}

// --- 3. Core Game Functions (Globally accessible) ---

/**
 * Initializes or resets the game state for a new game.
 */
function initializeGame() {
    console.log("Initializing new game...");
    // Reset all game state properties to initial values
    gameState.currentDay = 0; // Will become 1 when startDay() is called
    gameState.actionPoints = gameState.maxActionPoints;
    gameState.stationIntegrity = 100;
    gameState.isGameOver = false;
    gameState.gameOverReason = '';

    gameState.resources = {
        salvagedAlloys: 50,
        recycledPolymers: 50,
        conduitWiring: 20,
        energyCells: 10,
        advancedCircuitry: 5,
        recycledWater: 30,
    };

    gameState.reactor = {
        powerOutputTier: 'Low',
        heat: 0,
        maxHeatCapacity: 100,
        coolantRequired: 0,
        health: 100,
    };
    gameState.hydrationLevel = 100;

    // Reset module discovery state
    for (const key in gameState.modules) {
        gameState.modules[key].discovered = false;
    }
    // Command Center is always discovered at start
    gameState.modules['Command Center'].discovered = true;

    gameState.defenses = [];
    gameState.activeIssues = [];
    gameState.threatPoints = 0;
    gameState.temporaryThreatBoost = 0;

    // Hide start screen, show game UI, hide other screens
    document.getElementById('startScreen').style.display = 'none';
    document.getElementById('gameContainer').style.display = 'block';
    UIElements.gameOverScreen.style.display = 'none';
    UIElements.morningReportScreen.style.display = 'none';
    UIElements.endDayButton.disabled = false;
    
    startDay(); // Begin the first day
}

/**
 * Starts a new day. Resets AP, updates threat, handles daily upkeep.
 */
function startDay() {
    if (gameState.isGameOver) return;

    gameState.currentDay++;
    gameState.actionPoints = gameState.maxActionPoints; // Reset AP

    // Apply hydration penalty to AP if applicable
    if (checkHydrationImpairment()) { // Use the function here
        const apPenalty = Math.floor((50 - gameState.hydrationLevel) / 10); // -1 AP for every 10% below 50%
        gameState.actionPoints = Math.max(0, gameState.actionPoints - apPenalty);
        console.warn(`Day ${gameState.currentDay}: Low hydration! AP reduced by ${apPenalty}.`);
    }

    // Daily Threat Level increase
    gameState.threatPoints += 20;
    console.log(`Day ${gameState.currentDay} begins. Threat Points increased by 20.`);

    // Clear temporary threat boost from previous night's issues (if any were resolved)
    // Issues that persist carry their temporary boost into the next night.
    gameState.temporaryThreatBoost = 0; // Recalculate each day based on active issues
    gameState.activeIssues.forEach(issue => {
        if (!issue.resolved) { // Only count unresolved issues
           gameState.temporaryThreatBoost += issue.penalty;
        }
    });

    updateUI();
    console.log(`Day ${gameState.currentDay} started.`);
}

/**
 * Ends the current day and initiates the night phase.
 */
function endDay() {
    if (gameState.isGameOver) return;
    console.log("Day ends. Preparing for night...");
    UIElements.endDayButton.disabled = true; // Disable button to prevent multiple clicks

    simulateNightAttack();
    showMorningReport();
}

/**
 * Simulates the unseen alien attack during the night.
 * This is a highly simplified placeholder.
 */
function simulateNightAttack() {
    console.log("Night attack simulation begins...");

    // --- Hydration Impact during Night ---
    // Player consumes water for hydration during the night
    const dailyHydrationCost = 5; // Example water cost per night for hydration
    if (gameState.resources.recycledWater >= dailyHydrationCost) {
        gameState.resources.recycledWater -= dailyHydrationCost;
        gameState.hydrationLevel = 100; // Fully hydrated if enough water
    } else {
        gameState.resources.recycledWater = 0;
        gameState.hydrationLevel = Math.max(0, gameState.hydrationLevel - 20); // Lose hydration if no water
        console.warn("Insufficient water for hydration! Player hydration level dropped.");
    }

    // --- Reactor Cooling during Night ---
    let reactorHeatGenerated = 0;
    let reactorCoolantConsumed = 0;
    let reactorDamageFromHeat = 0;

    // Determine heat generation based on power output tier
    if (gameState.reactor.powerOutputTier === 'Low') reactorHeatGenerated = 10;
    else if (gameState.reactor.powerOutputTier === 'Medium') reactorHeatGenerated = 25;
    else if (gameState.reactor.powerOutputTier === 'High') reactorHeatGenerated = 40;

    // Calculate required coolant for this heat
    gameState.reactor.coolantRequired = Math.ceil(reactorHeatGenerated / 5); // Example: 1 water cools 5 heat

    if (gameState.resources.recycledWater >= gameState.reactor.coolantRequired) {
        reactorCoolantConsumed = gameState.reactor.coolantRequired;
        gameState.resources.recycledWater -= reactorCoolantConsumed;
        gameState.reactor.heat = Math.max(0, gameState.reactor.heat - (reactorCoolantConsumed * 5)); // Cooling effect
        console.log(`Reactor cooled, consumed ${reactorCoolantConsumed} water.`);
    } else {
        reactorCoolantConsumed = gameState.resources.recycledWater;
        gameState.resources.recycledWater = 0;
        const uncooledHeat = reactorHeatGenerated - (reactorCoolantConsumed * 5); // Heat that wasn't cooled
        gameState.reactor.heat += uncooledHeat;
        reactorDamageFromHeat = Math.floor(uncooledHeat / 10); // Reactor takes damage from overheating
        console.warn(`Insufficient coolant! Reactor heat increased. Reactor health reduced by ${reactorDamageFromHeat}.`);
    }
    // Ensure heat doesn't exceed max capacity
    gameState.reactor.heat = Math.min(gameState.reactor.heat, gameState.reactor.maxHeatCapacity);

    // --- Alien Attack Simulation ---
    const totalThreat = gameState.threatPoints + gameState.temporaryThreatBoost;
    const currentThreatLevel = Math.floor(totalThreat / gameState.threatLevelThreshold);
    console.log(`Effective Threat Level for Night: ${currentThreatLevel} (TP: ${totalThreat})`);

    let stationDamageTaken = 0;
    let defensesDestroyedCount = 0;
    let aliensNeutralized = 0;

    // Base damage/aliens based on Threat Level
    stationDamageTaken = currentThreatLevel * 5 + Math.floor(Math.random() * currentThreatLevel * 2);
    aliensNeutralized = currentThreatLevel * 10 + Math.floor(Math.random() * currentThreatLevel * 5);

    // Factor in defenses (simplified: each defense reduces damage, might be destroyed)
    const activeDefenses = gameState.defenses.filter(d => d.health > 0);
    activeDefenses.forEach(defense => {
        // Simple damage reduction from defenses
        stationDamageTaken = Math.max(0, stationDamageTaken - (defense.health / 5)); // Higher health = more reduction
        aliensNeutralized += Math.floor(defense.health / 10); // More aliens neutralized by healthy defenses

        // Chance for defense to take damage or be destroyed
        const defenseDamageChance = (currentThreatLevel / 10) + (defense.powerSetting === 'Overclocked' ? 0.2 : 0);
        if (Math.random() < defenseDamageChance) {
            const damageToDefense = Math.floor(Math.random() * 30) + 10;
            defense.health = Math.max(0, defense.health - damageToDefense);
            if (defense.health <= 0) {
                defensesDestroyedCount++;
                console.log(`${defense.type} at ${defense.location} was destroyed!`);
            } else {
                console.log(`${defense.type} at ${defense.location} took ${damageToDefense} damage.`);
            }
        }
    });

    // Factor in active issues' penalties that persist through night
    gameState.activeIssues.forEach(issue => {
        if (!issue.resolved) {
            // Apply issue-specific penalties
            if (issue.type === 'Plasma Conduit Fluctuation') {
                stationDamageTaken += 5; // Example penalty
            } else if (issue.type === 'Critical Structural Failure') {
                stationDamageTaken += 15; // Example penalty
            }
            // Add more specific penalties based on issue type as per GDD
        }
    });


    // Apply calculated damage to station and reactor
    gameState.stationIntegrity = Math.max(0, gameState.stationIntegrity - stationDamageTaken);
    gameState.reactor.health = Math.max(0, gameState.reactor.health - reactorDamageFromHeat);

    console.log(`Night Summary: Station Integrity -${stationDamageTaken}, Reactor Health -${reactorDamageFromHeat}. ${aliensNeutralized} aliens neutralized.`);

    // Check for Game Over conditions after night simulation
    if (gameState.stationIntegrity <= 0) {
        gameState.isGameOver = true;
        gameState.gameOverReason = "Station integrity compromised! Hull breached.";
    } else if (gameState.reactor.health <= 0) {
        gameState.isGameOver = true;
        gameState.gameOverReason = "Nuclear Reactor meltdown! Catastrophic failure.";
    } else if (gameState.hydrationLevel <= 0) { // Direct game over condition
        gameState.isGameOver = true;
        gameState.gameOverReason = "Critical dehydration! Station operations ceased.";
    }
}

/**
 * Displays the morning report after the night phase.
 */
function showMorningReport() {
    console.log("Displaying Morning Report...");
    UIElements.morningReportScreen.style.display = 'block';

    let reportHtml = `
        <h2>Morning Report - Day ${gameState.currentDay}</h2>
        <p><strong>Station Integrity:</strong> ${gameState.stationIntegrity}%</p>
        <p><strong>Reactor Health:</strong> ${gameState.reactor.health}% (${gameState.reactor.powerOutputTier} Power)</p>
        <p><strong>Hydration Level:</strong> ${gameState.hydrationLevel}%</p>
        <p><strong>Current Threat Level:</strong> ${Math.floor(gameState.threatPoints / gameState.threatLevelThreshold)} (TP: ${gameState.threatPoints})</p>
        <p><strong>Aliens Neutralized:</strong> ${Math.floor(Math.random() * 50) + 10} (Placeholder)</p>
        <h3>Resources Remaining:</h3>
        <ul>
            <li>Salvaged Alloys: ${gameState.resources.salvagedAlloys}</li>
            <li>Recycled Polymers: ${gameState.resources.recycledPolymers}</li>
            <li>Conduit Wiring: ${gameState.resources.conduitWiring}</li>
            <li>Energy Cells: ${gameState.resources.energyCells}</li>
            <li>Advanced Circuitry: ${gameState.resources.advancedCircuitry}</li>
            <li>Recycled Water: ${gameState.resources.recycledWater}</li>
        </ul>
    `;

    reportHtml += `<h3>Defenses Status:</h3><ul>`;
    if (gameState.defenses.length > 0) {
        gameState.defenses.forEach(defense => {
            reportHtml += `<li>${defense.type} at ${defense.location}: ${defense.health > 0 ? defense.health + '% Health' : 'DESTROYED!'} (Power: ${defense.powerSetting})</li>`;
        });
    } else {
        reportHtml += `<li>No defenses deployed.</li>`;
    }
    reportHtml += `</ul>`; // Close the ul for defenses

    reportHtml += `<h3>Unresolved Issues:</h3>`;
    if (gameState.activeIssues.length > 0) {
        gameState.activeIssues.forEach(issue => {
            if (!issue.resolved) { // Only show unresolved issues
                reportHtml += `<p>- ${issue.type} in ${issue.location}: Caused specific penalty last night. (Placeholder)</p>`;
            }
        });
    } else {
        reportHtml += `<p>No outstanding critical issues detected.</p>`;
    }

    reportHtml += `<h3>Observational Data / Damage Analysis:</h3>`;
    if (checkHydrationImpairment()) { // Use the function here
        reportHtml += `<p style="color: red;">[DATA CORRUPTED: Subject reported severe disorientation during night phase. Unable to process detailed analysis.]</p>`;
    } else {
        // Basic placeholder hints based on random chance or current threat profile
        // In a real game, these would be generated based on the actual alien types in the Threat Profile
        const hints = [
            "Heavy impact marks observed on reinforced plating.", // Breacher
            "Automated defense systems experienced intermittent power fluctuations.", // Disabler
            "Corrosive residue detected on several vital conduits.", // Corroder
            "Numerous small biological signatures neutralized.", // Skirmisher
            "Massive structural deformation detected near primary access.", // Apex
        ];
        reportHtml += `<p>${hints[Math.floor(Math.random() * hints.length)]}</p>`;
    }

    UIElements.morningReportContent.innerHTML = reportHtml;
    UIElements.morningReportContinueButton.style.display = 'block';
}

/**
 * Handles dismissing the morning report and proceeding to the next day or game over.
 */
function dismissMorningReport() {
    UIElements.morningReportScreen.style.display = 'none';
    UIElements.morningReportContinueButton.style.display = 'none';

    if (gameState.isGameOver) {
        showGameOverScreen();
    } else {
        startDay(); // Proceed to next day
        UIElements.endDayButton.disabled = false; // Re-enable end day button
    }
}

/**
 * Displays the game over screen.
 */
function showGameOverScreen() {
    console.log("Game Over! Reason:", gameState.gameOverReason);
    document.getElementById('gameContainer').style.display = 'none';
    UIElements.gameOverScreen.style.display = 'flex'; // Use flex to center
    UIElements.gameOverReason.textContent = gameState.gameOverReason;
}


// --- 4. Action Handlers (Functions for UI interaction - Globally accessible) ---

/**
 * Updates all UI elements based on the current game state.
 * This function should be called after any change to `gameState`.
 */
function updateUI() {
    UIElements.dayCounter.textContent = gameState.currentDay;
    UIElements.apCounter.textContent = `${gameState.actionPoints} / ${gameState.maxActionPoints}`;
    UIElements.stationIntegrity.textContent = `${gameState.stationIntegrity}%`;
    UIElements.hydrationLevel.textContent = `${gameState.hydrationLevel}%`;
    UIElements.reactorHealth.textContent = `${gameState.reactor.health}%`;
    UIElements.reactorOutput.textContent = gameState.reactor.powerOutputTier;

    const currentThreatLevelNum = Math.floor(gameState.threatPoints / gameState.threatLevelThreshold);
    UIElements.threatLevelDisplay.textContent = `${currentThreatLevelNum} (TP: ${gameState.threatPoints})`;

    // Update resources list
    let resHtml = '';
    for (const res in gameState.resources) {
        // Format resource names nicely (e.g., "salvagedAlloys" -> "Salvaged Alloys")
        const formattedName = res.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
        resHtml += `<li>${formattedName}: ${gameState.resources[res]}</li>`;
    }
    UIElements.resourcesList.innerHTML = resHtml;

    // Update module list and action buttons
    let moduleHtml = '';
    let actionButtonsHtml = `<h3>Available Actions:</h3>`;

    for (const moduleName in gameState.modules) {
        const module = gameState.modules[moduleName];
        moduleHtml += `<li>${moduleName} (${module.type}) - ${module.discovered ? 'Discovered' : 'Undiscovered'}</li>`;

        if (!module.discovered) {
            let apCost = 0;
            if (module.type === 'Safe') apCost = 2;
            else if (module.type === 'Medium Risk') apCost = 4;
            else if (module.type === 'High Risk') apCost = 6;

            actionButtonsHtml += `<button onclick="exploreSection('${moduleName}')" ${gameState.actionPoints < apCost ? 'disabled' : ''}>Explore ${moduleName} (${apCost} AP)</button>`;
        } else {
            // Only allow scavenging in discovered modules
            actionButtonsHtml += `<button onclick="scavenge('${moduleName}')" ${gameState.actionPoints < 2 ? 'disabled' : ''}>Scavenge ${moduleName} (2 AP)</button>`;
        }
    }
    UIElements.moduleList.innerHTML = moduleHtml;

    // Add general actions
    actionButtonsHtml += `
        <br>
        <button onclick="adjustReactorOutput('Low')" ${gameState.actionPoints < 1 ? 'disabled' : ''}>Set Reactor Low (1 AP)</button>
        <button onclick="adjustReactorOutput('Medium')" ${gameState.actionPoints < 1 ? 'disabled' : ''}>Set Reactor Medium (1 AP)</button>
        <button onclick="adjustReactorOutput('High')" ${gameState.actionPoints < 1 ? 'disabled' : ''}>Set Reactor High (1 AP)</button>
        <br>
        <button onclick="buildDefense('Reinforced Barricade')" ${gameState.actionPoints < 3 || !canAffordResources({salvagedAlloys: 10, recycledPolymers: 5}) ? 'disabled' : ''}>Build Barricade (3 AP, 10 Alloys, 5 Polymers)</button>
        <button onclick="buildDefense('Automated Turret')" ${gameState.actionPoints < 5 || !canAffordResources({salvagedAlloys: 15, conduitWiring: 5}) ? 'disabled' : ''}>Build Turret (5 AP, 15 Alloys, 5 Wiring)</button>
        <br>
        <button onclick="craftItem('Conduit Wiring')" ${gameState.actionPoints < 2 || !canAffordResources({recycledPolymers: 5}) || gameState.reactor.powerOutputTier === 'Low' ? 'disabled' : ''}>Craft Wiring (2 AP, 5 Polymers, Requires Medium/High Power)</button>
        <button onclick="craftItem('Energy Cell')" ${gameState.actionPoints < 3 || !canAffordResources({conduitWiring: 3, salvagedAlloys: 2}) || gameState.reactor.powerOutputTier === 'Low' ? 'disabled' : ''}>Craft Energy Cell (3 AP, 3 Wiring, 2 Alloys, Requires Medium/High Power)</button>
    `;

    UIElements.actionButtonsContainer.innerHTML = actionButtonsHtml;


    // Update active issues list
    let issuesHtml = '';
    if (gameState.activeIssues.length > 0) {
        gameState.activeIssues.forEach(issue => {
            if (!issue.resolved) { // Only display unresolved issues
               issuesHtml += `<li>${issue.type} in ${issue.location} (<button onclick="resolveIssue('${issue.id}')" ${gameState.actionPoints < issue.apCost || !canAffordResources(issue.resources) ? 'disabled' : ''}>Resolve (${issue.apCost} AP)</button>)</li>`;
            }
        });
    } else {
        issuesHtml = '<li>No active issues.</li>';
    }
    UIElements.activeIssuesList.innerHTML = issuesHtml;

    if (gameState.isGameOver) {
        showGameOverScreen();
    }
}

/**
 * Action: Explore a new section (module).
 * @param {string} moduleName - The name of the module to explore.
 */
function exploreSection(moduleName) {
    const module = gameState.modules[moduleName];
    if (module.discovered) {
        console.log("Module already discovered.");
        return;
    }

    let apCost = 0;
    let threatIncrease = 0;
    let issueRisk = null;

    if (module.type === 'Safe') {
        apCost = 2;
        threatIncrease = 5;
    } else if (module.type === 'Medium Risk') {
        apCost = 4;
        threatIncrease = 10;
        issueRisk = 'Medium';
    } else if (module.type === 'High Risk') {
        apCost = 6;
        threatIncrease = 20;
        issueRisk = 'High';
    }

    if (gameState.actionPoints < apCost) {
        console.warn(`Not enough AP (${apCost}) to explore ${moduleName}.`);
        return;
    }

    gameState.actionPoints -= apCost;
    gameState.modules[moduleName].discovered = true;
    gameState.threatPoints += threatIncrease;
    console.log(`Explored ${moduleName}. AP: ${gameState.actionPoints}. Threat +${threatIncrease}.`);

    if (issueRisk) {
        triggerIssue(moduleName, issueRisk);
    }

    updateUI();
}

/**
 * Action: Player scavenges resources in a discovered module.
 * @param {string} moduleName - The module to scavenge in.
 */
function scavenge(moduleName) {
    if (!gameState.modules[moduleName].discovered) {
        console.warn("Cannot scavenge in an undiscovered module.");
        return;
    }
    if (gameState.actionPoints < 2) {
        console.warn("Not enough AP to scavenge.");
        return;
    }

    gameState.actionPoints -= 2;
    gameState.threatPoints += 5; // Scavenging also increases threat

    const currentModuleType = gameState.modules[moduleName].type;
    let yieldMultiplier = 1;
    let resourceYields = {}; // Base yields

    if (currentModuleType === 'Safe') {
        resourceYields = { salvagedAlloys: 2, recycledPolymers: 2 };
    } else if (currentModuleType === 'Medium Risk') {
        yieldMultiplier = 1.5;
        resourceYields = { salvagedAlloys: 3, recycledPolymers: 3, conduitWiring: 1, recycledWater: 5 };
    } else if (currentModuleType === 'High Risk') {
        yieldMultiplier = 2;
        resourceYields = { salvagedAlloys: 4, recycledPolymers: 4, conduitWiring: 2, recycledWater: 10, energyCells: 1, advancedCircuitry: 0.5 };
    }

    console.log(`Scavenging in ${moduleName}. AP: ${gameState.actionPoints}. Threat +5.`);

    let foundResources = [];
    for (const res in resourceYields) {
        const amount = Math.floor(resourceYields[res] * yieldMultiplier + Math.random() * 2);
        gameState.resources[res] += amount;
        foundResources.push(`${amount} ${res.replace(/([A-Z])/g, ' $1').toLowerCase()}`);
    }
    console.log(`Found: ${foundResources.join(', ')}`);

    updateUI();
}

/**
 * Triggers a random issue from the appropriate pool.
 * @param {string} location - The module/sector where the issue occurs.
 * @param {'Medium'|'High'} riskType - The risk level of the issue.
 */
function triggerIssue(location, riskType) {
    const issueId = `issue_${Date.now()}`; // Unique ID for the issue
    let issueDetails;

    const mediumIssuePool = [
        { type: 'Plasma Conduit Fluctuation', penalty: 15, apCost: 3, resources: { conduitWiring: 5 } },
        { type: 'Minor Structural Stress', penalty: 10, apCost: 4, resources: { salvagedAlloys: 8 } },
        { type: 'Ventilation Malfunction', penalty: 5, apCost: 3, resources: { recycledPolymers: 6 } },
    ];

    const highIssuePool = [
        { type: 'Critical Plasma Conduit Breach', penalty: 30, apCost: 8, resources: { conduitWiring: 15, salvagedAlloys: 10, advancedCircuitry: 2 } },
        { type: 'Catastrophic Structural Failure', penalty: 40, apCost: 10, resources: { salvagedAlloys: 25, recycledPolymers: 10, advancedCircuitry: 3 } },
        { type: 'Severe Bio-Contamination', penalty: 25, apCost: 9, resources: { recycledPolymers: 20, advancedCircuitry: 5 } },
        { type: 'Reactor Coolant Leak', penalty: 50, apCost: 12, resources: { salvagedAlloys: 25, recycledWater: 15 } },
    ];

    if (riskType === 'Medium') {
        issueDetails = mediumIssuePool[Math.floor(Math.random() * mediumIssuePool.length)];
    } else if (riskType === 'High') {
        issueDetails = highIssuePool[Math.floor(Math.random() * highIssuePool.length)];
    } else {
        console.error("Invalid risk type for triggering issue.");
        return;
    }

    const newIssue = {
        id: issueId,
        type: issueDetails.type,
        location: location,
        penalty: issueDetails.penalty, // Temporary threat boost
        apCost: issueDetails.apCost,
        resources: issueDetails.resources,
        resolved: false,
    };
    gameState.activeIssues.push(newIssue);
    gameState.temporaryThreatBoost += newIssue.penalty; // Add temporary boost
    console.warn(`New ${riskType} Issue triggered: ${newIssue.type} in ${location}! Temporary Threat +${newIssue.penalty}.`);
    updateUI();
}

/**
 * Action: Resolves an active issue.
 * @param {string} issueId - The ID of the issue to resolve.
 */
function resolveIssue(issueId) {
    const issueIndex = gameState.activeIssues.findIndex(issue => issue.id === issueId);
    if (issueIndex === -1) {
        console.warn("Issue not found or already resolved.");
        return;
    }

    const issue = gameState.activeIssues[issueIndex];

    // Check AP cost
    if (gameState.actionPoints < issue.apCost) {
        console.warn(`Not enough AP (${issue.apCost}) to resolve this issue.`);
        return;
    }
    // Check resource costs
    if (!canAffordResources(issue.resources)) {
        console.warn(`Not enough resources to resolve ${issue.type}.`);
        return;
    }

    // Deduct costs
    gameState.actionPoints -= issue.apCost;
    for (const res in issue.resources) {
        gameState.resources[res] -= issue.resources[res];
    }

    // Remove temporary threat boost
    gameState.temporaryThreatBoost -= issue.penalty;

    // Apply permanent threat reduction as reward for resolving
    const permanentReduction = Math.floor(issue.penalty / 2); // Example: half of temporary boost
    gameState.threatPoints = Math.max(0, gameState.threatPoints - permanentReduction);
    console.log(`Resolved issue '${issue.type}'. AP: ${gameState.actionPoints}. Permanent Threat -${permanentReduction}.`);

    gameState.activeIssues.splice(issueIndex, 1); // Remove from active list
    updateUI();
}

/**
 * Action: Adjusts the reactor's power output tier.
 * @param {string} tier - 'Low', 'Medium', 'High'
 */
function adjustReactorOutput(tier) {
    if (gameState.actionPoints < 1) {
        console.warn("Not enough AP to adjust reactor output.");
        return;
    }
    if (gameState.reactor.powerOutputTier === tier) {
        console.log("Reactor already at this output tier.");
        return;
    }

    gameState.actionPoints -= 1;
    gameState.reactor.powerOutputTier = tier;
    console.log(`Reactor output set to ${tier}. AP: ${gameState.actionPoints}`);
    updateUI();
}

/**
 * Action: Builds a new defense.
 * @param {string} type - 'Reinforced Barricade', 'Automated Turret', etc.
 */
function buildDefense(type) {
    let apCost = 0;
    let resourceCosts = {};
    let powerSetting = 'Normal'; // Default power setting for new defenses

    if (type === 'Reinforced Barricade') {
        apCost = 3;
        resourceCosts = { salvagedAlloys: 10, recycledPolymers: 5 };
    } else if (type === 'Automated Turret') {
        apCost = 5;
        resourceCosts = { salvagedAlloys: 15, conduitWiring: 5 }; // Advanced Circuitry removed for simpler prototype, can add later
    } else {
        console.warn("Unknown defense type to build.");
        return;
    }

    if (gameState.actionPoints < apCost) {
        console.warn(`Not enough AP (${apCost}) to build ${type}.`);
        return;
    }
    // Check for resources
    if (!canAffordResources(resourceCosts)) {
        console.warn(`Not enough resources to build ${type}.`);
        return;
    }

    gameState.actionPoints -= apCost;
    for (const res in resourceCosts) {
        gameState.resources[res] -= resourceCosts[res];
    }

    const defenseId = `defense_${Date.now()}`;
    gameState.defenses.push({
        id: defenseId,
        type: type,
        health: 100,
        location: 'Main Corridor', // Placeholder location
        powerSetting: powerSetting // 'Normal', 'Overclocked', 'Underclocked'
    });
    console.log(`Built a ${type}. AP: ${gameState.actionPoints}`);
    updateUI();
}

/**
 * Action: Crafts an item using the Fabrication Unit.
 * @param {string} itemType - The type of item to craft (e.g., 'Conduit Wiring').
 */
function craftItem(itemType) {
    let apCost = 0;
    let resourceCosts = {};
    let energyRequirement = 0; // Energy required from reactor

    if (itemType === 'Conduit Wiring') {
        apCost = 2;
        resourceCosts = { recycledPolymers: 5 };
        energyRequirement = 5; // Example energy cost
    } else if (itemType === 'Energy Cell') {
        apCost = 3;
        resourceCosts = { conduitWiring: 3, salvagedAlloys: 2 };
        energyRequirement = 10; // Example energy cost
    } else {
        console.warn("Unknown item type to craft.");
        return;
    }

    if (gameState.actionPoints < apCost) {
        console.warn("Not enough AP to craft.");
        return;
    }
    // Check if reactor power is sufficient for crafting
    // For simplicity, assume 'Low' power can handle up to 5 energy cost, 'Medium' up to 15, 'High' up to 30.
    if (gameState.reactor.powerOutputTier === 'Low' && energyRequirement > 5) {
        console.warn("Reactor power too low to craft this item. Increase reactor output (Medium or High).");
        return;
    }
    // No check for 'High' as it's assumed to handle anything for now.

    // Check if enough raw resources
    if (!canAffordResources(resourceCosts)) {
        console.warn(`Not enough resources to craft ${itemType}.`);
        return;
    }

    gameState.actionPoints -= apCost;
    for (const res in resourceCosts) {
        gameState.resources[res] -= resourceCosts[res];
    }

    // Add the crafted item to resources (assuming it's a resource type)
    gameState.resources[itemType.replace(/\s+/g, '')] += 1; // Converts 'Conduit Wiring' to 'conduitWiring' for resource key

    console.log(`Crafted ${itemType}. AP: ${gameState.actionPoints}. Energy consumed: ${energyRequirement}.`);
    updateUI();
}


// --- 5. Event Listeners (Connect HTML buttons to JS functions) ---
// Ensures the script runs only after the entire HTML document is loaded.
document.addEventListener('DOMContentLoaded', () => {
    // Initial setup: Hide game elements, show start screen
    document.getElementById('gameContainer').style.display = 'none';
    UIElements.morningReportScreen.style.display = 'none';
    UIElements.gameOverScreen.style.display = 'none';
    document.getElementById('startScreen').style.display = 'block';

    // Attach event listeners to main control buttons
    UIElements.startButton.addEventListener('click', initializeGame);
    UIElements.endDayButton.addEventListener('click', endDay);
    UIElements.morningReportContinueButton.addEventListener('click', dismissMorningReport);
    UIElements.newGameButton.addEventListener('click', initializeGame); // For restarting from game over screen

    // Initial UI update to show starting values on the start screen (if any are visible)
    updateUI();
});