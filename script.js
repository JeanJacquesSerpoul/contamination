// --- START OF FILE script.js ---

document.addEventListener('DOMContentLoaded', () => {
    // --- Configuration et États ---
    const State = {
        EMPTY: 0,
        HEALTHY: 1,
        INFECTED: 2,
        RECOVERED: 3,
        DEAD: 4,
    };

    const StateChartColors = {
        [State.HEALTHY]: 'rgb(74, 222, 128)', // green-400
        [State.INFECTED]: 'rgb(248, 113, 113)', // red-400
        [State.RECOVERED]: 'rgb(96, 165, 250)', // blue-400
        [State.DEAD]: 'rgb(113, 113, 122)', // zinc-500
    };

    const StateGridClasses = {
        [State.EMPTY]: 'vide',
        [State.HEALTHY]: 'sain',
        [State.INFECTED]: 'infecte',
        [State.RECOVERED]: 'gueri',
        [State.DEAD]: 'mort',
    };

    let params = {
        gridSize: 50,
        populationSize: 400,
        initialInfected: 5,
        infectionRadius: 2,
        infectionRate: 0.1,
        infectionDuration: 50,
        mortalityRate: 0.05,
        immunityLevel: 0.90,
        tickSpeed: 100,
        manualPlacement: false
    };

    let grid = [];
    let gridCells = [];
    let simulationInterval = null;
    let tickCount = 0;
    let isRunning = false;
    let isManualPlacementMode = false;

    let sirChart = null;

    // History for the chart (limited size for performance)
    let chartHistoryTicks = [];
    let chartHistoryHealthy = [];
    let chartHistoryInfected = [];
    let chartHistoryRecovered = [];
    let chartHistoryDead = [];
    const MAX_CHART_HISTORY_POINTS = 500; // Limit for the chart

    // Complete history for CSV export (unlimited)
    let fullHistoryTicks = [];
    let fullHistoryHealthy = [];
    let fullHistoryInfected = [];
    let fullHistoryRecovered = [];
    let fullHistoryDead = [];

    // Element References
    const gridElement = document.getElementById('grid');
    const gridContainerElement = document.getElementById('gridContainer');
    const gridSizeInput = document.getElementById('gridSize');
    const populationSizeInput = document.getElementById('populationSize');
    const initialInfectedInput = document.getElementById('initialInfected');
    const infectionRadiusSlider = document.getElementById('infectionRadius');
    const infectionRateSlider = document.getElementById('infectionRate');
    const infectionDurationSlider = document.getElementById('infectionDuration');
    const mortalityRateSlider = document.getElementById('mortalityRate');
    const immunityLevelSlider = document.getElementById('immunityLevel');
    const tickSpeedSlider = document.getElementById('tickSpeed');

    const infectionRadiusValueSpan = document.getElementById('infectionRadiusValue');
    const infectionRateValueSpan = document.getElementById('infectionRateValue');
    const infectionDurationValueSpan = document.getElementById('infectionDurationValue');
    const mortalityRateValueSpan = document.getElementById('mortalityRateValue');
    const immunityLevelValueSpan = document.getElementById('immunityLevelValue');
    const tickSpeedValueSpan = document.getElementById('tickSpeedValue');

    const startButton = document.getElementById('startButton');
    const pauseButton = document.getElementById('pauseButton');
    const resetButton = document.getElementById('resetButton');
    const manualPlacementInfo = document.getElementById('manualPlacementInfo');

    const tickCountSpan = document.getElementById('tickCount');
    const sainCountSpan = document.getElementById('sainCount');
    const infecteCountSpan = document.getElementById('infecteCount');
    const gueriCountSpan = document.getElementById('gueriCount');
    const mortCountSpan = document.getElementById('mortCount');
    const totalCountSpan = document.getElementById('totalCount');
    const chartCanvas = document.getElementById('sirChartCanvas');
    const exportCsvButton = document.getElementById('exportCsvButton');

    // References for end message
    const endMessageOverlay = document.getElementById('endMessageOverlay');
    const endMessageBox = document.getElementById('endMessageBox');
    const endMessageDetails = document.getElementById('endMessageDetails');
    let endMessageTimeout = null;

    // --- Functions ---

    function exportDataToCsv() {
        if (fullHistoryTicks.length === 0) {
            alert("Aucune donnée à exporter. Lancez d'abord la simulation.");
            return;
        }

        let csvContent = "data:text/csv;charset=utf-8,";
        const header = ["Tick", "Sains", "Infectés", "Guéris", "Morts"];
        csvContent += header.join(";") + "\r\n";

        for (let i = 0; i < fullHistoryTicks.length; i++) {
            const row = [
                fullHistoryTicks[i],
                fullHistoryHealthy[i],
                fullHistoryInfected[i],
                fullHistoryRecovered[i],
                fullHistoryDead[i]
            ];
            csvContent += row.join(";") + "\r\n";
        }

        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", "simulation_epidemic_data_full.csv");
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        console.log("Données complètes exportées en CSV.");
    }


    function updateParameterValues() {
        params.gridSize = parseInt(gridSizeInput.value) || 50;
        params.populationSize = parseInt(populationSizeInput.value) || 0;
        params.initialInfected = parseInt(initialInfectedInput.value) || 1;
        params.infectionRadius = parseFloat(infectionRadiusSlider.value);
        params.infectionRate = parseFloat(infectionRateSlider.value);
        params.infectionDuration = parseInt(infectionDurationSlider.value);
        params.mortalityRate = parseInt(mortalityRateSlider.value) / 100;
        params.immunityLevel = parseInt(immunityLevelSlider.value) / 100;
        params.tickSpeed = parseInt(tickSpeedSlider.value);

        infectionRadiusValueSpan.textContent = params.infectionRadius.toFixed(1);
        infectionRateValueSpan.textContent = params.infectionRate.toFixed(2);
        infectionDurationValueSpan.textContent = params.infectionDuration;
        mortalityRateValueSpan.textContent = (params.mortalityRate * 100).toFixed(0);
        immunityLevelValueSpan.textContent = (params.immunityLevel * 100).toFixed(0);
        tickSpeedValueSpan.textContent = params.tickSpeed;

        params.manualPlacement = (params.populationSize === 0);
        manualPlacementInfo.classList.toggle('hidden', !params.manualPlacement || isRunning);
    }

    function createGridDOM(size) {
        gridElement.innerHTML = '';
        gridElement.style.gridTemplateColumns = `repeat(${size}, minmax(0, 1fr))`;
        gridCells = [];

        for (let r = 0; r < size; r++) {
            gridCells[r] = [];
            for (let c = 0; c < size; c++) {
                const cell = document.createElement('div');
                cell.className = `cell ${StateGridClasses[State.EMPTY]}`;
                cell.dataset.r = r;
                cell.dataset.c = c;
                gridElement.appendChild(cell);
                gridCells[r][c] = cell;
            }
        }

        gridElement.removeEventListener('click', handleManualPlacementClick);
        if (params.manualPlacement && !isRunning) {
            gridElement.addEventListener('click', handleManualPlacementClick);
        }
    }

    function initializeGridData(size) {
        grid = [];
        for (let r = 0; r < size; r++) {
            grid[r] = [];
            for (let c = 0; c < size; c++) {
                grid[r][c] = { state: State.EMPTY, infectionTimer: 0 };
            }
        }
    }

    function populateGridRandomly(size, count, initialInfectedCount) {
        if (count <= 0) return;
        if (count > size * size) {
            console.warn("Population size exceeds grid capacity.");
            count = size * size;
        }

        let placed = 0;
        let attempts = 0;
        const maxAttempts = size * size * 2;

        while (placed < count && attempts < maxAttempts) {
            const r = Math.floor(Math.random() * size);
            const c = Math.floor(Math.random() * size);
            if (grid[r][c].state === State.EMPTY) {
                grid[r][c].state = State.HEALTHY;
                placed++;
            }
            attempts++;
        }
        if (attempts >= maxAttempts) console.warn("Could not place all individuals (random placement).");

        let infectedPlaced = 0;
        const healthyIndividualsCoords = [];
        for (let r = 0; r < size; r++) {
            for (let c = 0; c < size; c++) {
                if (grid[r][c].state === State.HEALTHY) {
                    healthyIndividualsCoords.push({ r, c });
                }
            }
        }

        healthyIndividualsCoords.sort(() => Math.random() - 0.5);

        const numToInfect = Math.min(initialInfectedCount, healthyIndividualsCoords.length);
        for (let i = 0; i < numToInfect; i++) {
            const coord = healthyIndividualsCoords[i];
            grid[coord.r][coord.c].state = State.INFECTED;
            grid[coord.r][coord.c].infectionTimer = 0;
            infectedPlaced++;
        }

        if (infectedPlaced < initialInfectedCount && numToInfect > 0 && !params.manualPlacement) {
            console.warn(`Could only place ${infectedPlaced} out of ${initialInfectedCount} initial infected individuals.`);
        }
    }

    function handleManualPlacementClick(event) {
        if (!isManualPlacementMode || isRunning) return;

        const cellElement = event.target.closest('.cell');
        if (!cellElement) return;

        const r = parseInt(cellElement.dataset.r);
        const c = parseInt(cellElement.dataset.c);

        if (r < 0 || r >= params.gridSize || c < 0 || c >= params.gridSize) return;

        const currentCell = grid[r][c];

        if (currentCell.state === State.EMPTY) {
            currentCell.state = State.HEALTHY;
        } else if (currentCell.state === State.HEALTHY) {
            currentCell.state = State.INFECTED;
            currentCell.infectionTimer = 0;
        } else { // Infected, Recovered, or Dead go back to Empty
             currentCell.state = State.EMPTY;
             currentCell.infectionTimer = 0; // Reset timer just in case
        }
        renderGridCell(r, c);
        updateStats(); // Update stats and chart for the manual change
    }

    function renderGridCell(r, c) {
        if (grid[r] && grid[r][c] && gridCells[r] && gridCells[r][c]) {
            const cellData = grid[r][c];
            const cellElement = gridCells[r][c];
            const newStateClass = StateGridClasses[cellData.state];

            let newClassName = 'cell';
            if (newStateClass) {
                newClassName += ' ' + newStateClass;
            }

            if (cellElement.className !== newClassName) {
                cellElement.className = newClassName;
            }
        }
    }

    function renderGrid() {
        for (let r = 0; r < params.gridSize; r++) {
            for (let c = 0; c < params.gridSize; c++) {
                renderGridCell(r, c);
            }
        }
    }

    function calculateDistance(r1, c1, r2, c2) {
        return Math.sqrt(Math.pow(r1 - r2, 2) + Math.pow(c1 - c2, 2));
    }

    function getNeighbors(r, c, radius) {
        const neighbors = [];
        const size = params.gridSize;
        // Optimization: Calculate bounds once
        const r_min = Math.max(0, r - Math.floor(radius));
        const r_max = Math.min(size - 1, r + Math.floor(radius));
        const c_min = Math.max(0, c - Math.floor(radius));
        const c_max = Math.min(size - 1, c + Math.floor(radius));

        for (let nr = r_min; nr <= r_max; nr++) {
            for (let nc = c_min; nc <= c_max; nc++) {
                if (nr === r && nc === c) continue; // Skip self
                // Grid boundary check (belt-and-suspenders, should be covered by r_min/max etc.)
                 if (!grid[nr] || !grid[nr][nc]) continue;

                const dist = calculateDistance(r, c, nr, nc);
                if (dist <= radius) {
                    // Only consider neighbors who are currently healthy for infection
                    if (grid[nr][nc].state === State.HEALTHY) {
                        neighbors.push({ r: nr, c: nc, distance: dist });
                    }
                }
            }
        }
        return neighbors;
    }

    // --- End Message Functions ---
    function showEndMessage(finalTick) {
        if (endMessageTimeout) {
            clearTimeout(endMessageTimeout);
        }

        endMessageDetails.textContent = `Arrêt au tick ${finalTick}.`;
        endMessageOverlay.classList.remove('hidden');

        // Force reflow to apply initial transition state
        void endMessageOverlay.offsetWidth;

        // Apply visible/animated state classes
        endMessageOverlay.classList.remove('opacity-0');
        endMessageBox.classList.remove('scale-95', 'opacity-0');
        endMessageBox.classList.add('scale-100', 'opacity-100');

        endMessageTimeout = setTimeout(hideEndMessage, 3000); // 3 seconds
    }

    function hideEndMessage() {
         if (endMessageTimeout) {
            clearTimeout(endMessageTimeout);
            endMessageTimeout = null;
        }

        // Apply hidden/animated state classes
        endMessageOverlay.classList.add('opacity-0');
        endMessageBox.classList.add('scale-95', 'opacity-0');
        endMessageBox.classList.remove('scale-100', 'opacity-100');


        // Hide completely after transition
        setTimeout(() => {
             if (endMessageOverlay.classList.contains('opacity-0')) { // Check if still meant to be hidden
                 endMessageOverlay.classList.add('hidden');
             }
        }, 300); // Match transition duration
    }

    function simulationStep() {
        const size = params.gridSize;
        // Deep copy is crucial here to avoid modifying the grid while iterating
        const nextGrid = JSON.parse(JSON.stringify(grid));
        let hasInfected = false; // Track if any infected individuals exist this tick
        let changedCells = []; // Track cells that changed state for optimized rendering

        for (let r = 0; r < size; r++) {
            for (let c = 0; c < size; c++) {
                const currentCell = grid[r][c];
                const nextCell = nextGrid[r][c]; // Operate on the copy

                if (currentCell.state === State.INFECTED) {
                    hasInfected = true; // Mark that infection is ongoing
                    nextCell.infectionTimer++;

                    // Check for recovery or death
                    if (nextCell.infectionTimer >= params.infectionDuration) {
                        let newState;
                        if (Math.random() < params.mortalityRate) {
                            newState = State.DEAD;
                        } else {
                            // Recovered: check for immunity gain
                            newState = (Math.random() < params.immunityLevel) ? State.RECOVERED : State.HEALTHY;
                        }
                        if (nextCell.state !== newState) {
                             nextCell.state = newState;
                             nextCell.infectionTimer = 0; // Reset timer on state change
                             changedCells.push({ r, c });
                        }
                    } else {
                        // Still infected, try to infect neighbors
                        const neighbors = getNeighbors(r, c, params.infectionRadius);
                        neighbors.forEach(neighbor => {
                            // Check the state in the *next* grid to prevent double infection in one tick
                            const targetCellNext = nextGrid[neighbor.r][neighbor.c];
                            if (targetCellNext.state === State.HEALTHY) {
                                const distance = neighbor.distance;
                                // Calculate infection probability based on distance (linear falloff)
                                let infectionProbability = params.infectionRate * Math.max(0, 1 - ((distance - 1) / Math.max(1, params.infectionRadius)));
                                // Clamp probability between 0 and base rate
                                infectionProbability = Math.min(params.infectionRate, Math.max(0, infectionProbability));

                                if (infectionProbability > 0 && Math.random() < infectionProbability) {
                                    targetCellNext.state = State.INFECTED;
                                    targetCellNext.infectionTimer = 0;
                                    changedCells.push({ r: neighbor.r, c: neighbor.c });
                                    hasInfected = true; // Ensure flag stays true if new infection occurs
                                }
                            }
                        });
                    }
                }
                // No else needed: Healthy, Recovered, Dead, Empty states don't change unless infected by neighbor
            }
        }

        grid = nextGrid; // Update the main grid state
        tickCount++;

        // Optimized rendering: only update changed cells
        changedCells.forEach(cell => renderGridCell(cell.r, cell.c));

        updateStats(); // Update UI stats and history arrays

        // Check simulation end condition
        if (!hasInfected && isRunning) {
            const finalTick = tickCount;
            pauseSimulation(); // Stop the simulation loop first
            console.log(`Simulation terminée au tick ${finalTick}: plus d'individus infectés.`);
            showEndMessage(finalTick); // Display the end message
        }
    }

    function initializeChart() {
        if (sirChart) {
            sirChart.destroy();
            sirChart = null;
        }
        if (!chartCanvas) {
            console.error("Canvas element for chart not found!");
            return;
        }
        const ctx = chartCanvas.getContext('2d');
        sirChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: chartHistoryTicks, // Use chart history for display
                datasets: [
                    { label: 'Sains (S)', data: chartHistoryHealthy, borderColor: StateChartColors[State.HEALTHY], backgroundColor: StateChartColors[State.HEALTHY] + '33', borderWidth: 2, fill: false, pointRadius: 0, tension: 0.1 },
                    { label: 'Infectés (I)', data: chartHistoryInfected, borderColor: StateChartColors[State.INFECTED], backgroundColor: StateChartColors[State.INFECTED] + '33', borderWidth: 2, fill: false, pointRadius: 0, tension: 0.1 },
                    { label: 'Guéris (R)', data: chartHistoryRecovered, borderColor: StateChartColors[State.RECOVERED], backgroundColor: StateChartColors[State.RECOVERED] + '33', borderWidth: 2, fill: false, pointRadius: 0, tension: 0.1 },
                    { label: 'Morts (D)', data: chartHistoryDead, borderColor: StateChartColors[State.DEAD], backgroundColor: StateChartColors[State.DEAD] + '33', borderWidth: 2, fill: false, pointRadius: 0, tension: 0.1 }
                ]
            },
            options: {
                responsive: true, maintainAspectRatio: false, animation: { duration: 0 },
                hover: { animationDuration: 0 }, responsiveAnimationDuration: 0,
                scales: {
                    x: { title: { display: true, text: 'Temps (Ticks)' } },
                    y: { title: { display: true, text: 'Nombre d\'individus' }, beginAtZero: true, min: 0 }
                },
                plugins: { legend: { position: 'top' }, title: { display: false } }
            }
        });
    }

    function updateStats() {
        let s = 0, i = 0, r_val = 0, d = 0, total = 0;
        const size = params.gridSize;
        for (let row = 0; row < size; row++) {
            for (let col = 0; col < size; col++) {
                // Check if cell exists before accessing state
                if (grid[row] && grid[row][col]) {
                    const state = grid[row][col].state;
                    if (state !== State.EMPTY) total++;
                    if (state === State.HEALTHY) s++;
                    else if (state === State.INFECTED) i++;
                    else if (state === State.RECOVERED) r_val++;
                    else if (state === State.DEAD) d++;
                }
            }
        }
        tickCountSpan.textContent = tickCount;
        sainCountSpan.textContent = s;
        infecteCountSpan.textContent = i;
        gueriCountSpan.textContent = r_val;
        mortCountSpan.textContent = d;
        totalCountSpan.textContent = total;

        // Update history (both sets) and chart display
        updateHistoryAndChart(tickCount, s, i, r_val, d);
    }

    function updateHistoryAndChart(currentTick, s, i, r_val, d) {
        let updateChartNeeded = false;

        // --- Update FULL History (for CSV) ---
        const lastFullTick = fullHistoryTicks.length > 0 ? fullHistoryTicks[fullHistoryTicks.length - 1] : -1;
        if (lastFullTick < currentTick) { // New tick data
            fullHistoryTicks.push(currentTick);
            fullHistoryHealthy.push(s);
            fullHistoryInfected.push(i);
            fullHistoryRecovered.push(r_val);
            fullHistoryDead.push(d);
            updateChartNeeded = true;
        } else if (lastFullTick === currentTick) { // Update data for the current tick (e.g., after manual placement)
            fullHistoryHealthy[fullHistoryHealthy.length - 1] = s;
            fullHistoryInfected[fullHistoryInfected.length - 1] = i;
            fullHistoryRecovered[fullHistoryRecovered.length - 1] = r_val;
            fullHistoryDead[fullHistoryDead.length - 1] = d;
            updateChartNeeded = true;
        }

        // --- Update CHART History (limited for performance) ---
        const lastChartTick = chartHistoryTicks.length > 0 ? chartHistoryTicks[chartHistoryTicks.length - 1] : -1;
         if (lastChartTick < currentTick) { // New tick data for chart
            chartHistoryTicks.push(currentTick);
            chartHistoryHealthy.push(s);
            chartHistoryInfected.push(i);
            chartHistoryRecovered.push(r_val);
            chartHistoryDead.push(d);

            // Apply limit ONLY to chart history
            if (chartHistoryTicks.length > MAX_CHART_HISTORY_POINTS) {
                chartHistoryTicks.shift();
                chartHistoryHealthy.shift();
                chartHistoryInfected.shift();
                chartHistoryRecovered.shift();
                chartHistoryDead.shift();
            }
        } else if (lastChartTick === currentTick) { // Update chart data for the current tick
             chartHistoryHealthy[chartHistoryHealthy.length - 1] = s;
             chartHistoryInfected[chartHistoryInfected.length - 1] = i;
             chartHistoryRecovered[chartHistoryRecovered.length - 1] = r_val;
             chartHistoryDead[chartHistoryDead.length - 1] = d;
        }

        // --- Update Chart Display ---
        if (updateChartNeeded && sirChart) {
            // Point chart datasets to the potentially limited chart history arrays
            sirChart.data.labels = chartHistoryTicks;
            sirChart.data.datasets[0].data = chartHistoryHealthy;
            sirChart.data.datasets[1].data = chartHistoryInfected;
            sirChart.data.datasets[2].data = chartHistoryRecovered;
            sirChart.data.datasets[3].data = chartHistoryDead;

            sirChart.update('none'); // Redraw chart without animation
        }
    }

    function startSimulation() {
        if (isRunning) return;
        updateParameterValues(); // Ensure params are current

        // Check if there's a population and at least one infected individual
        let initialInfectedFound = false;
        let populationExists = false;
        outerLoop: // Label for early exit
        for (let r = 0; r < params.gridSize; r++) {
            for (let c = 0; c < params.gridSize; c++) {
                if (grid[r]?.[c]?.state !== State.EMPTY) { // Optional chaining for safety
                    populationExists = true;
                    if (grid[r][c].state === State.INFECTED) {
                        initialInfectedFound = true;
                        break outerLoop; // Found both, no need to check further
                    }
                }
            }
        }

        if (!populationExists) {
            alert("Veuillez placer des individus sur la grille (mode manuel) ou définir une population > 0 avant de démarrer.");
            return;
        }
        if (!initialInfectedFound) {
            alert("Veuillez placer au moins un individu infecté sur la grille (cliquez sur un individu sain) ou vérifier le paramètre 'Nb. Infectés Initiaux'.");
            return;
        }

        // Disable manual placement during run
        if (isManualPlacementMode) {
            gridElement.removeEventListener('click', handleManualPlacementClick);
            manualPlacementInfo.classList.add('hidden');
        }

        isRunning = true;
        startButton.disabled = true;
        pauseButton.disabled = false;
        resetButton.disabled = true;
        setControlsDisabled(true); // Disable parameter inputs (except speed)

        // Ensure stats and chart show t=0 correctly if simulation starts immediately after reset/load
        updateStats();

        // Start the simulation loop
        clearInterval(simulationInterval); // Clear any existing interval just in case
        simulationInterval = setInterval(simulationStep, params.tickSpeed);
        console.log("Simulation démarrée.");
    }

    function pauseSimulation() {
        // Only act if the simulation is actually running or interval exists
        if (!isRunning && !simulationInterval) return;

        isRunning = false;
        clearInterval(simulationInterval);
        simulationInterval = null; // Clear the interval ID

        // Update button states
        startButton.disabled = false;
        pauseButton.disabled = true;
        resetButton.disabled = false;
        setControlsDisabled(false); // Re-enable parameter inputs

        // Re-enable manual placement click handler *if* in manual mode
        if (params.manualPlacement) {
            isManualPlacementMode = true; // Ensure flag is set
            gridElement.addEventListener('click', handleManualPlacementClick);
            manualPlacementInfo.classList.remove('hidden');
        } else {
            isManualPlacementMode = false; // Ensure flag is unset
            manualPlacementInfo.classList.add('hidden');
        }
        console.log("Simulation en pause.");
    }

    function resetSimulation() {
        pauseSimulation(); // Stop simulation, clear interval, handle listeners/buttons
        hideEndMessage(); // Ensure end message is hidden
        tickCount = 0;
        updateParameterValues(); // Read current control values

        // Clear both history sets
        chartHistoryTicks = []; chartHistoryHealthy = []; chartHistoryInfected = [];
        chartHistoryRecovered = []; chartHistoryDead = [];
        fullHistoryTicks = []; fullHistoryHealthy = []; fullHistoryInfected = [];
        fullHistoryRecovered = []; fullHistoryDead = [];

        // Rebuild grid data and DOM
        initializeGridData(params.gridSize);
        createGridDOM(params.gridSize); // This also handles the click listener setup based on params.manualPlacement

        isManualPlacementMode = params.manualPlacement; // Set mode based on params
        manualPlacementInfo.classList.toggle('hidden', !isManualPlacementMode || isRunning); // Show/hide info text

        // Populate grid if not in manual mode
        if (!isManualPlacementMode) {
            populateGridRandomly(params.gridSize, params.populationSize, params.initialInfected);
        }
        // If manual, grid remains empty for user clicks

        renderGrid(); // Display the initial state (populated or empty)
        updateStats(); // Update UI counts and add t=0 data to history/chart

        // Ensure chart is initialized and reflects the cleared state
        if (!sirChart) {
            initializeChart();
        } else {
            // Chart exists, explicitly update its data to the empty arrays
             sirChart.data.labels = chartHistoryTicks;
             sirChart.data.datasets.forEach(dataset => dataset.data = []); // Clear data for all datasets
             sirChart.data.datasets[0].data = chartHistoryHealthy; // Reassign (though empty)
             sirChart.data.datasets[1].data = chartHistoryInfected;
             sirChart.data.datasets[2].data = chartHistoryRecovered;
             sirChart.data.datasets[3].data = chartHistoryDead;
             sirChart.update('none'); // Update display
        }

        // Reset button states (pause is disabled initially)
        resetButton.disabled = false;
        startButton.disabled = false;
        pauseButton.disabled = true;
        setControlsDisabled(false); // Ensure controls are enabled
        console.log("Simulation réinitialisée.");
    }

    function setControlsDisabled(disabled) {
        gridSizeInput.disabled = disabled;
        populationSizeInput.disabled = disabled;
        initialInfectedInput.disabled = disabled;
        infectionRadiusSlider.disabled = disabled;
        infectionRateSlider.disabled = disabled;
        infectionDurationSlider.disabled = disabled;
        mortalityRateSlider.disabled = disabled;
        immunityLevelSlider.disabled = disabled;
        // tickSpeedSlider remains active always
    }

    // --- Initialisation ---
    function init() {
        updateParameterValues(); // Read initial values from HTML

        // Attach event listeners
        exportCsvButton.addEventListener('click', exportDataToCsv);

        // Parameter sliders/inputs
        infectionRadiusSlider.addEventListener('input', updateParameterValues);
        infectionRateSlider.addEventListener('input', updateParameterValues);
        infectionDurationSlider.addEventListener('input', updateParameterValues);
        mortalityRateSlider.addEventListener('input', updateParameterValues);
        immunityLevelSlider.addEventListener('input', updateParameterValues);
        tickSpeedSlider.addEventListener('input', () => {
            updateParameterValues();
            // If simulation is running, update the interval speed
            if (isRunning) {
                clearInterval(simulationInterval);
                simulationInterval = setInterval(simulationStep, params.tickSpeed);
            }
        });

        // Inputs that trigger a full reset on change
        gridSizeInput.addEventListener('change', () => { updateParameterValues(); resetSimulation(); });
        populationSizeInput.addEventListener('change', () => { updateParameterValues(); resetSimulation(); });
        initialInfectedInput.addEventListener('change', () => { updateParameterValues(); resetSimulation(); });

        // Control buttons
        startButton.addEventListener('click', startSimulation);
        pauseButton.addEventListener('click', pauseSimulation);
        resetButton.addEventListener('click', resetSimulation);

        // Listener for the end message overlay
        endMessageOverlay.addEventListener('click', (event) => {
            event.stopPropagation(); // Prevent click from reaching elements underneath (like the grid)
            hideEndMessage();       // Hide the message when the overlay is clicked
        });

        // Initial setup
        initializeChart(); // Create the chart instance
        resetSimulation(); // Set up the initial grid state, stats, and chart data for t=0
    }

    // Run initialisation
    init();

}); // End of DOMContentLoaded
// --- END OF FILE script.js ---