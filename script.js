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
        actualDelayMs: 910, // Initial default delay (will be overwritten by updateParameterValues)
        tickSpeedSetting: 100, // Default slider setting
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

        // --- MODIFIED Tick Speed Handling (4x Faster) ---
        params.tickSpeedSetting = parseInt(tickSpeedSlider.value);
        const minRaw = 10; // Slider min value
        const maxRaw = 1000; // Slider max value
        const speedMultiplier = 4.0; // Factor to increase speed by

        // Calculate the base delay based on the slider (inversely related)
        // Original range: 10ms (for slider=1000) to 1000ms (for slider=10)
        let baseDelay = (maxRaw + minRaw) - params.tickSpeedSetting;

        // Apply the speed multiplier to reduce the delay
        let targetDelay = baseDelay / speedMultiplier;
        // New target range: 2.5ms (for slider=1000) to 250ms (for slider=10)

        // Define new clamping limits for the *actual* interval delay
        const minActualDelayMs = 5; // Set a minimum reasonable interval (e.g., 5ms)
        const maxActualDelayMs = 1000 / speedMultiplier; // Max delay is now 250ms

        // Clamp the calculated target delay
        params.actualDelayMs = Math.max(minActualDelayMs, Math.min(maxActualDelayMs, targetDelay));
        // --- End Speed Handling Modification ---

        infectionRadiusValueSpan.textContent = params.infectionRadius.toFixed(1);
        infectionRateValueSpan.textContent = params.infectionRate.toFixed(2);
        infectionDurationValueSpan.textContent = params.infectionDuration;
        mortalityRateValueSpan.textContent = (params.mortalityRate * 100).toFixed(0);
        immunityLevelValueSpan.textContent = (params.immunityLevel * 100).toFixed(0);
        tickSpeedValueSpan.textContent = params.tickSpeedSetting; // Still show the slider value

        params.manualPlacement = (params.populationSize === 0);
        manualPlacementInfo.classList.toggle('hidden', !params.manualPlacement || isRunning);
    }

    function createGridDOM(size) {
        gridElement.innerHTML = '';
        
        // Calculer la taille des cellules en fonction de la largeur du conteneur
        const containerWidth = gridContainerElement.clientWidth;
        const cellSize = Math.max(2, Math.floor(containerWidth / size));
        gridElement.style.gridTemplateColumns = `repeat(${size}, ${cellSize}px)`;
        
        gridCells = [];

        for (let r = 0; r < size; r++) {
            gridCells[r] = [];
            for (let c = 0; c < size; c++) {
                const cell = document.createElement('div');
                cell.className = `cell ${StateGridClasses[State.EMPTY]}`;
                cell.dataset.r = r;
                cell.dataset.c = c;
                
                // Définir la largeur et la hauteur pour chaque cellule
                cell.style.width = `${cellSize}px`;
                cell.style.height = `${cellSize}px`;
                
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
        // Check if cell exists before accessing state/elements
        if (grid[r]?.[c] && gridCells[r]?.[c]) {
            const cellData = grid[r][c];
            const cellElement = gridCells[r][c];
            const newStateClass = StateGridClasses[cellData.state];

            let newClassName = 'cell';
            if (newStateClass) {
                newClassName += ' ' + newStateClass;
            }

            // Optimization: Only update className if it actually changed
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
        const r_min = Math.max(0, r - Math.floor(radius));
        const r_max = Math.min(size - 1, r + Math.floor(radius));
        const c_min = Math.max(0, c - Math.floor(radius));
        const c_max = Math.min(size - 1, c + Math.floor(radius));

        for (let nr = r_min; nr <= r_max; nr++) {
            for (let nc = c_min; nc <= c_max; nc++) {
                if (nr === r && nc === c) continue;
                if (!grid[nr]?.[nc]) continue; // Check cell exists

                const dist = calculateDistance(r, c, nr, nc);
                if (dist <= radius) {
                     // Consider only HEALTHY neighbors for infection target
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
        void endMessageOverlay.offsetWidth; // Reflow

        endMessageOverlay.classList.remove('opacity-0');
        endMessageBox.classList.remove('scale-95', 'opacity-0');
        endMessageBox.classList.add('scale-100', 'opacity-100');

        endMessageTimeout = setTimeout(hideEndMessage, 3000);
    }

    function hideEndMessage() {
         if (endMessageTimeout) {
            clearTimeout(endMessageTimeout);
            endMessageTimeout = null;
        }

        endMessageOverlay.classList.add('opacity-0');
        endMessageBox.classList.add('scale-95', 'opacity-0');
        endMessageBox.classList.remove('scale-100', 'opacity-100');

        setTimeout(() => {
             if (endMessageOverlay.classList.contains('opacity-0')) {
                 endMessageOverlay.classList.add('hidden');
             }
        }, 300);
    }

    function simulationStep() {
        // console.time("simulationStep Duration"); // Optional: Uncomment to measure step time
        const size = params.gridSize;
        const nextGrid = JSON.parse(JSON.stringify(grid));
        let hasInfected = false;
        let changedCells = []; // Track cells that actually changed state this tick

        for (let r = 0; r < size; r++) {
            for (let c = 0; c < size; c++) {
                const currentCell = grid[r][c];
                const nextCell = nextGrid[r][c]; // Operate on the copy

                if (currentCell.state === State.INFECTED) {
                    hasInfected = true;
                    nextCell.infectionTimer++;

                    if (nextCell.infectionTimer >= params.infectionDuration) {
                        let newState;
                        if (Math.random() < params.mortalityRate) {
                            newState = State.DEAD;
                        } else {
                            newState = (Math.random() < params.immunityLevel) ? State.RECOVERED : State.HEALTHY;
                        }
                        // Only record change if state actually differs
                        if (nextCell.state !== newState) {
                             nextCell.state = newState;
                             nextCell.infectionTimer = 0;
                             changedCells.push({ r, c });
                        }
                    } else {
                        const neighbors = getNeighbors(r, c, params.infectionRadius);
                        neighbors.forEach(neighbor => {
                            const targetCellNext = nextGrid[neighbor.r][neighbor.c];
                            // Check target in NEXT grid is still healthy (prevent double infection)
                            if (targetCellNext.state === State.HEALTHY) {
                                const distance = neighbor.distance;
                                // Calculate infection probability based on distance (closer = higher chance, up to base rate)
                                let infectionProbability = params.infectionRate * Math.max(0, 1 - ((distance - 1) / Math.max(1, params.infectionRadius)));
                                infectionProbability = Math.min(params.infectionRate, Math.max(0, infectionProbability)); // Clamp probability

                                if (infectionProbability > 0 && Math.random() < infectionProbability) {
                                    // Only record change if state actually differs (it will here)
                                    targetCellNext.state = State.INFECTED;
                                    targetCellNext.infectionTimer = 0;
                                    changedCells.push({ r: neighbor.r, c: neighbor.c });
                                    // Keep hasInfected = true (even if already true)
                                    hasInfected = true;
                                }
                            }
                        });
                    }
                }
                 // Note: No need to explicitly add unchanged cells to changedCells
            }
        }

        grid = nextGrid;
        tickCount++;

        // Optimized rendering: only update cells that actually changed
        changedCells.forEach(cell => renderGridCell(cell.r, cell.c));

        updateStats();

        if (!hasInfected && isRunning) {
            const finalTick = tickCount;
            pauseSimulation();
            console.log(`Simulation terminée au tick ${finalTick}: plus d'individus infectés.`);
            showEndMessage(finalTick);
        }
        // console.timeEnd("simulationStep Duration"); // Optional: Uncomment to measure step time
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
                labels: chartHistoryTicks,
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
                if (grid[row]?.[col]) { // Check cell exists
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

        updateHistoryAndChart(tickCount, s, i, r_val, d);
    }

    function updateHistoryAndChart(currentTick, s, i, r_val, d) {
        let updateChartNeeded = false;

        // Full History
        const lastFullTick = fullHistoryTicks.length > 0 ? fullHistoryTicks[fullHistoryTicks.length - 1] : -1;
        if (lastFullTick < currentTick) {
            fullHistoryTicks.push(currentTick);
            fullHistoryHealthy.push(s);
            fullHistoryInfected.push(i);
            fullHistoryRecovered.push(r_val);
            fullHistoryDead.push(d);
            updateChartNeeded = true;
        } else if (lastFullTick === currentTick) {
            // Only update if counts have changed (e.g., manual placement)
            if (fullHistoryHealthy[fullHistoryHealthy.length - 1] !== s ||
                fullHistoryInfected[fullHistoryInfected.length - 1] !== i ||
                fullHistoryRecovered[fullHistoryRecovered.length - 1] !== r_val ||
                fullHistoryDead[fullHistoryDead.length - 1] !== d)
            {
                fullHistoryHealthy[fullHistoryHealthy.length - 1] = s;
                fullHistoryInfected[fullHistoryInfected.length - 1] = i;
                fullHistoryRecovered[fullHistoryRecovered.length - 1] = r_val;
                fullHistoryDead[fullHistoryDead.length - 1] = d;
                updateChartNeeded = true;
            }
        }

        // Chart History (Limited)
        const lastChartTick = chartHistoryTicks.length > 0 ? chartHistoryTicks[chartHistoryTicks.length - 1] : -1;
         if (lastChartTick < currentTick) {
            chartHistoryTicks.push(currentTick);
            chartHistoryHealthy.push(s);
            chartHistoryInfected.push(i);
            chartHistoryRecovered.push(r_val);
            chartHistoryDead.push(d);

            if (chartHistoryTicks.length > MAX_CHART_HISTORY_POINTS) {
                chartHistoryTicks.shift();
                chartHistoryHealthy.shift();
                chartHistoryInfected.shift();
                chartHistoryRecovered.shift();
                chartHistoryDead.shift();
            }
            // Ensure updateChartNeeded is true if we added a point
            updateChartNeeded = true;
        } else if (lastChartTick === currentTick) {
             // Only update chart data if values changed
            if (chartHistoryHealthy[chartHistoryHealthy.length - 1] !== s ||
                chartHistoryInfected[chartHistoryInfected.length - 1] !== i ||
                chartHistoryRecovered[chartHistoryRecovered.length - 1] !== r_val ||
                chartHistoryDead[chartHistoryDead.length - 1] !== d)
            {
                 chartHistoryHealthy[chartHistoryHealthy.length - 1] = s;
                 chartHistoryInfected[chartHistoryInfected.length - 1] = i;
                 chartHistoryRecovered[chartHistoryRecovered.length - 1] = r_val;
                 chartHistoryDead[chartHistoryDead.length - 1] = d;
                 updateChartNeeded = true;
             }
        }

        // Update Chart Display only if needed
        if (updateChartNeeded && sirChart) {
            sirChart.data.labels = chartHistoryTicks;
            sirChart.data.datasets[0].data = chartHistoryHealthy;
            sirChart.data.datasets[1].data = chartHistoryInfected;
            sirChart.data.datasets[2].data = chartHistoryRecovered;
            sirChart.data.datasets[3].data = chartHistoryDead;
            sirChart.update('none');
        }
    }

    function startSimulation() {
        if (isRunning) return;
        updateParameterValues(); // Ensure params are current

        // --- Population check ---
        let populationExists = false;
        let initialInfectedFound = false;
        outerLoop:
        for (let r = 0; r < params.gridSize; r++) {
            for (let c = 0; c < params.gridSize; c++) {
                 if (grid[r]?.[c]?.state && grid[r][c].state !== State.EMPTY) {
                    populationExists = true;
                    if (grid[r][c].state === State.INFECTED) {
                        initialInfectedFound = true;
                        break outerLoop; // No need to check further if infected found
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
        // --- End Population check ---


        if (isManualPlacementMode) {
            gridElement.removeEventListener('click', handleManualPlacementClick);
            manualPlacementInfo.classList.add('hidden');
        }

        isRunning = true;
        startButton.disabled = true;
        pauseButton.disabled = false;
        resetButton.disabled = true;
        setControlsDisabled(true); // Disable parameter controls

        // Ensure stats are correct at T=0 before first step
        updateStats();

        clearInterval(simulationInterval);
        console.log(`Starting interval with delay: ${params.actualDelayMs} ms`);
        simulationInterval = setInterval(simulationStep, params.actualDelayMs);
        console.log("Simulation démarrée.");
    }

    function pauseSimulation() {
        if (!isRunning && !simulationInterval) return; // Prevent pausing if already paused or never started

        isRunning = false;
        clearInterval(simulationInterval);
        simulationInterval = null; // Clear interval ID

        startButton.disabled = false;
        pauseButton.disabled = true;
        resetButton.disabled = false;
        setControlsDisabled(false); // Re-enable parameter controls

        // Re-enable manual placement click listener ONLY if in manual mode
        if (params.manualPlacement) {
            isManualPlacementMode = true; // Ensure this flag is correct
            gridElement.addEventListener('click', handleManualPlacementClick);
            manualPlacementInfo.classList.remove('hidden');
        } else {
            isManualPlacementMode = false;
            manualPlacementInfo.classList.add('hidden');
        }
        console.log("Simulation en pause.");
    }

    function resetSimulation() {
        pauseSimulation(); // Ensures interval is stopped and buttons are in correct state
        hideEndMessage();
        tickCount = 0;
        updateParameterValues(); // Read latest control values

        // Clear history arrays
        chartHistoryTicks = []; chartHistoryHealthy = []; chartHistoryInfected = [];
        chartHistoryRecovered = []; chartHistoryDead = [];
        fullHistoryTicks = []; fullHistoryHealthy = []; fullHistoryInfected = [];
        fullHistoryRecovered = []; fullHistoryDead = [];

        // Rebuild grid backend and frontend
        initializeGridData(params.gridSize);
        createGridDOM(params.gridSize); // Will also attach click listener if needed

        isManualPlacementMode = params.manualPlacement; // Set based on latest param
        manualPlacementInfo.classList.toggle('hidden', !isManualPlacementMode || isRunning);

        if (!isManualPlacementMode) {
            populateGridRandomly(params.gridSize, params.populationSize, params.initialInfected);
        }

        // Update UI immediately
        renderGrid();
        updateStats(); // Update UI counts and chart for t=0

        // Reset chart data display
        if (!sirChart) {
            initializeChart(); // Create chart if it doesn't exist
        } else {
             // Ensure chart reflects the empty history
             sirChart.data.labels = chartHistoryTicks;
             sirChart.data.datasets[0].data = chartHistoryHealthy;
             sirChart.data.datasets[1].data = chartHistoryInfected;
             sirChart.data.datasets[2].data = chartHistoryRecovered;
             sirChart.data.datasets[3].data = chartHistoryDead;
             sirChart.update('none');
        }

        // Ensure correct button states after reset
        resetButton.disabled = false;
        startButton.disabled = false;
        pauseButton.disabled = true;
        setControlsDisabled(false); // Ensure controls are enabled after reset

        console.log("Simulation réinitialisée.");
    }

    function setControlsDisabled(disabled) {
        // Disables/Enables parameter inputs (except speed slider)
        gridSizeInput.disabled = disabled;
        populationSizeInput.disabled = disabled;
        initialInfectedInput.disabled = disabled;
        infectionRadiusSlider.disabled = disabled;
        infectionRateSlider.disabled = disabled;
        infectionDurationSlider.disabled = disabled;
        mortalityRateSlider.disabled = disabled;
        immunityLevelSlider.disabled = disabled;
        // tickSpeedSlider remains active so speed can be changed during run
    }
    
    // Handle window resize for mobile responsiveness
    function handleResize() {
        if (gridSize > 0) {
            createGridDOM(gridSize);
            renderGrid();
        }
    }

    // --- Initialisation ---
    function init() {
        // Read initial values from controls and update internal state
        updateParameterValues();

        // Setup Event listeners for controls
        exportCsvButton.addEventListener('click', exportDataToCsv);

        infectionRadiusSlider.addEventListener('input', updateParameterValues);
        infectionRateSlider.addEventListener('input', updateParameterValues);
        infectionDurationSlider.addEventListener('input', updateParameterValues);
        mortalityRateSlider.addEventListener('input', updateParameterValues);
        immunityLevelSlider.addEventListener('input', updateParameterValues);

        // Listener for Tick Speed Slider (handles interval update if running)
        tickSpeedSlider.addEventListener('input', () => {
            updateParameterValues(); // Updates params.actualDelayMs based on slider
            if (isRunning) {
                clearInterval(simulationInterval);
                console.log(`Updating interval with delay: ${params.actualDelayMs} ms`);
                simulationInterval = setInterval(simulationStep, params.actualDelayMs);
            }
        });

        // Listeners for controls that require a full reset
        gridSizeInput.addEventListener('change', () => { updateParameterValues(); resetSimulation(); });
        populationSizeInput.addEventListener('change', () => { updateParameterValues(); resetSimulation(); });
        initialInfectedInput.addEventListener('change', () => { updateParameterValues(); resetSimulation(); });

        // Listeners for simulation control buttons
        startButton.addEventListener('click', startSimulation);
        pauseButton.addEventListener('click', pauseSimulation);
        resetButton.addEventListener('click', resetSimulation);

        // Listener to hide end message on click
        endMessageOverlay.addEventListener('click', (event) => {
            if (event.target === endMessageOverlay) { // Only hide if clicking overlay itself
                hideEndMessage();
            }
        });
        
        // Add resize handler for mobile responsiveness
        window.addEventListener('resize', handleResize);

        // Initial setup actions
        initializeChart(); // Create the chart instance
        resetSimulation(); // Setup the grid, stats, chart for time t=0 based on initial params
    }

    // Run initialisation when the DOM is fully loaded
    init();

}); // End of DOMContentLoaded
// --- END OF FILE script.js ---