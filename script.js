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

    // --- MODIFICATION: Separate History Arrays ---
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
    // --- END MODIFICATION ---

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

    // --- Fonctions ---

    function exportDataToCsv() {
        // --- MODIFICATION: Use full history for export ---
        if (fullHistoryTicks.length === 0) {
            alert("Aucune donnée à exporter. Lancez d'abord la simulation.");
            return;
        }

        // En-tête CSV
        let csvContent = "data:text/csv;charset=utf-8,";
        const header = ["Tick", "Sains", "Infectés", "Guéris", "Morts"];
        csvContent += header.join(";") + "\r\n"; // Ajoute l'en-tête et une nouvelle ligne

        // Lignes de données - Read from full history
        for (let i = 0; i < fullHistoryTicks.length; i++) {
            const row = [
                fullHistoryTicks[i],
                fullHistoryHealthy[i],
                fullHistoryInfected[i],
                fullHistoryRecovered[i],
                fullHistoryDead[i]
            ];
            csvContent += row.join(";") + "\r\n"; // Ajoute la ligne et une nouvelle ligne
        }
        // --- END MODIFICATION ---

        // Créer un lien caché pour déclencher le téléchargement
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", "simulation_epidemic_data_full.csv"); // Nom du fichier (ajouté _full)
        document.body.appendChild(link); // Nécessaire pour Firefox

        link.click(); // Simule le clic pour télécharger

        document.body.removeChild(link); // Nettoie le lien caché
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

        if (infectedPlaced < initialInfectedCount && numToInfect > 0) {
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
        } else if (currentCell.state === State.INFECTED) {
            currentCell.state = State.EMPTY;
            currentCell.infectionTimer = 0;
        } else if (currentCell.state === State.RECOVERED || currentCell.state === State.DEAD) {
            currentCell.state = State.EMPTY;
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
        const r_min = Math.max(0, r - Math.floor(radius));
        const r_max = Math.min(size - 1, r + Math.floor(radius));
        const c_min = Math.max(0, c - Math.floor(radius));
        const c_max = Math.min(size - 1, c + Math.floor(radius));

        for (let nr = r_min; nr <= r_max; nr++) {
            for (let nc = c_min; nc <= c_max; nc++) {
                if (nr === r && nc === c) continue;
                if (!grid[nr] || !grid[nr][nc]) continue;

                const dist = calculateDistance(r, c, nr, nc);
                if (dist <= radius) {
                    if (grid[nr][nc].state === State.HEALTHY) {
                        neighbors.push({ r: nr, c: nc, distance: dist });
                    }
                }
            }
        }
        return neighbors;
    }


    function simulationStep() {
        const size = params.gridSize;
        const nextGrid = JSON.parse(JSON.stringify(grid));
        let hasInfected = false;
        let changedCells = [];

        for (let r = 0; r < size; r++) {
            for (let c = 0; c < size; c++) {
                const currentCell = grid[r][c];
                const nextCell = nextGrid[r][c];

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
                        if (nextCell.state !== newState) {
                            nextCell.state = newState;
                            nextCell.infectionTimer = 0;
                            changedCells.push({ r, c });
                        }
                    }

                    const neighbors = getNeighbors(r, c, params.infectionRadius);
                    neighbors.forEach(neighbor => {
                        const targetCellNext = nextGrid[neighbor.r][neighbor.c];
                        if (targetCellNext.state === State.HEALTHY) {
                            const distance = neighbor.distance;
                            let infectionProbability = params.infectionRate * Math.max(0, 1 - ((distance - 1) / Math.max(1, params.infectionRadius)));
                            infectionProbability = Math.min(params.infectionRate, Math.max(0, infectionProbability));

                            if (infectionProbability > 0 && Math.random() < infectionProbability) {
                                targetCellNext.state = State.INFECTED;
                                targetCellNext.infectionTimer = 0;
                                changedCells.push({ r: neighbor.r, c: neighbor.c });
                                hasInfected = true;
                            }
                        }
                    });
                }
            }
        }

        grid = nextGrid;
        tickCount++;

        changedCells.forEach(cell => renderGridCell(cell.r, cell.c));

        updateStats(); // This will call updateHistoryAndChart

        if (!hasInfected && isRunning) {
            pauseSimulation();
            console.log(`Simulation terminée au tick ${tickCount}: plus d'individus infectés.`);
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
        // --- MODIFICATION: Use chart history for chart data ---
        sirChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: chartHistoryTicks, // Use chart history
                datasets: [
                    {
                        label: 'Sains (S)', data: chartHistoryHealthy, // Use chart history
                        borderColor: StateChartColors[State.HEALTHY], backgroundColor: StateChartColors[State.HEALTHY] + '33',
                        borderWidth: 2, fill: false, pointRadius: 0, tension: 0.1
                    },
                    {
                        label: 'Infectés (I)', data: chartHistoryInfected, // Use chart history
                        borderColor: StateChartColors[State.INFECTED], backgroundColor: StateChartColors[State.INFECTED] + '33',
                        borderWidth: 2, fill: false, pointRadius: 0, tension: 0.1
                    },
                    {
                        label: 'Guéris (R)', data: chartHistoryRecovered, // Use chart history
                        borderColor: StateChartColors[State.RECOVERED], backgroundColor: StateChartColors[State.RECOVERED] + '33',
                        borderWidth: 2, fill: false, pointRadius: 0, tension: 0.1
                    },
                    {
                        label: 'Morts (D)', data: chartHistoryDead, // Use chart history
                        borderColor: StateChartColors[State.DEAD], backgroundColor: StateChartColors[State.DEAD] + '33',
                        borderWidth: 2, fill: false, pointRadius: 0, tension: 0.1
                    }
                ]
            },
            // --- END MODIFICATION ---
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

        // Update history (both chart and full) regardless of whether simulation is running
        // This ensures manual placements or the initial state (tick 0) are recorded.
        updateHistoryAndChart(tickCount, s, i, r_val, d);

    }

    function updateHistoryAndChart(currentTick, s, i, r_val, d) {
        // --- MODIFICATION: Update both chart and full history ---
        let updateChart = false;

        // Update FULL History (always add)
        // Check if tick already exists (e.g., from manual placement update)
        const lastFullTick = fullHistoryTicks.length > 0 ? fullHistoryTicks[fullHistoryTicks.length - 1] : -1;
        if (lastFullTick < currentTick) {
            fullHistoryTicks.push(currentTick);
            fullHistoryHealthy.push(s);
            fullHistoryInfected.push(i);
            fullHistoryRecovered.push(r_val);
            fullHistoryDead.push(d);
            updateChart = true; // New tick, update chart
        } else if (lastFullTick === currentTick) {
            // Update the last entry for the current tick (e.g., after manual placement)
            fullHistoryHealthy[fullHistoryHealthy.length - 1] = s;
            fullHistoryInfected[fullHistoryInfected.length - 1] = i;
            fullHistoryRecovered[fullHistoryRecovered.length - 1] = r_val;
            fullHistoryDead[fullHistoryDead.length - 1] = d;
            updateChart = true; // Data changed, update chart
        }

        // Update CHART History (add and apply limit)
        const lastChartTick = chartHistoryTicks.length > 0 ? chartHistoryTicks[chartHistoryTicks.length - 1] : -1;
         if (lastChartTick < currentTick) {
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
        } else if (lastChartTick === currentTick) {
             // Update the last entry for the current tick if it exists in chart history
             chartHistoryHealthy[chartHistoryHealthy.length - 1] = s;
             chartHistoryInfected[chartHistoryInfected.length - 1] = i;
             chartHistoryRecovered[chartHistoryRecovered.length - 1] = r_val;
             chartHistoryDead[chartHistoryDead.length - 1] = d;
        }
        // --- END MODIFICATION ---


        // Update the chart display if needed and chart object exists
        if (updateChart && sirChart) {
            // Assign the (potentially limited) chart history arrays to the chart datasets
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
        updateParameterValues();

        let initialInfectedFound = false;
        let populationExists = false;
        for (let r = 0; r < params.gridSize; r++) {
            for (let c = 0; c < params.gridSize; c++) {
                if (grid[r] && grid[r][c]) {
                    if (grid[r][c].state !== State.EMPTY) {
                        populationExists = true;
                    }
                    if (grid[r][c].state === State.INFECTED) {
                        initialInfectedFound = true;
                    }
                }
                if (populationExists && initialInfectedFound) break; // Optimization
            }
             if (populationExists && initialInfectedFound) break; // Optimization
        }


        if (!populationExists) {
            alert("Veuillez placer des individus sur la grille (mode manuel) ou définir une population > 0 avant de démarrer.");
            return;
        }
        if (!initialInfectedFound) {
            alert("Veuillez placer au moins un individu infecté sur la grille (cliquez sur un individu sain) ou vérifier le paramètre 'Nb. Infectés Initiaux'.");
            return;
        }

        if (isManualPlacementMode) {
            gridElement.removeEventListener('click', handleManualPlacementClick);
            manualPlacementInfo.classList.add('hidden');
        }

        isRunning = true;
        startButton.disabled = true;
        pauseButton.disabled = false;
        resetButton.disabled = true;
        setControlsDisabled(true);

        // Ensure stats and chart show t=0 if it wasn't already added by reset/manual placement
        updateStats();

        clearInterval(simulationInterval);
        simulationInterval = setInterval(simulationStep, params.tickSpeed);
        console.log("Simulation démarrée.");
    }

    function pauseSimulation() {
        if (!isRunning && !simulationInterval) return;

        isRunning = false;
        clearInterval(simulationInterval);
        simulationInterval = null;
        startButton.disabled = false;
        pauseButton.disabled = true;
        resetButton.disabled = false;
        setControlsDisabled(false);

        if (params.manualPlacement) {
            isManualPlacementMode = true;
            gridElement.addEventListener('click', handleManualPlacementClick);
            manualPlacementInfo.classList.remove('hidden');
        } else {
            isManualPlacementMode = false;
            manualPlacementInfo.classList.add('hidden');
        }
        console.log("Simulation en pause.");
    }

    function resetSimulation() {
        pauseSimulation();
        tickCount = 0;
        updateParameterValues();

        // --- MODIFICATION: Clear both history sets ---
        chartHistoryTicks = []; chartHistoryHealthy = []; chartHistoryInfected = [];
        chartHistoryRecovered = []; chartHistoryDead = [];
        fullHistoryTicks = []; fullHistoryHealthy = []; fullHistoryInfected = [];
        fullHistoryRecovered = []; fullHistoryDead = [];
        // --- END MODIFICATION ---

        initializeGridData(params.gridSize);
        createGridDOM(params.gridSize);

        isManualPlacementMode = params.manualPlacement;
        manualPlacementInfo.classList.toggle('hidden', !isManualPlacementMode);

        if (!isManualPlacementMode) {
            populateGridRandomly(params.gridSize, params.populationSize, params.initialInfected);
        }

        renderGrid();
        updateStats(); // Update counts and add t=0 data to history arrays and chart

        // Ensure chart is initialized and points to the (now empty) chart history
        if (!sirChart) {
            initializeChart();
        } else {
            // Chart exists, just clear its data explicitly after reset
             sirChart.data.labels = chartHistoryTicks;
             sirChart.data.datasets[0].data = chartHistoryHealthy;
             sirChart.data.datasets[1].data = chartHistoryInfected;
             sirChart.data.datasets[2].data = chartHistoryRecovered;
             sirChart.data.datasets[3].data = chartHistoryDead;
             sirChart.update('none'); // Update display to show cleared chart
        }


        resetButton.disabled = false;
        startButton.disabled = false;
        pauseButton.disabled = true;
        setControlsDisabled(false);
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
        // tickSpeedSlider remains active
    }

    // --- Initialisation et Écouteurs d'événements ---
    function init() {
        updateParameterValues();

        exportCsvButton.addEventListener('click', exportDataToCsv);

        infectionRadiusSlider.addEventListener('input', updateParameterValues);
        infectionRateSlider.addEventListener('input', updateParameterValues);
        infectionDurationSlider.addEventListener('input', updateParameterValues);
        mortalityRateSlider.addEventListener('input', updateParameterValues);
        immunityLevelSlider.addEventListener('input', updateParameterValues);
        tickSpeedSlider.addEventListener('input', () => {
            updateParameterValues();
            if (isRunning) {
                clearInterval(simulationInterval);
                simulationInterval = setInterval(simulationStep, params.tickSpeed);
            }
        });

        gridSizeInput.addEventListener('change', () => { updateParameterValues(); resetSimulation(); });
        populationSizeInput.addEventListener('change', () => { updateParameterValues(); resetSimulation(); });
        initialInfectedInput.addEventListener('change', () => { updateParameterValues(); resetSimulation(); });

        startButton.addEventListener('click', startSimulation);
        pauseButton.addEventListener('click', pauseSimulation);
        resetButton.addEventListener('click', resetSimulation);

        // Initialiser le graphique et la simulation une fois
        initializeChart();
        resetSimulation(); // Setup initial state (calls updateStats, populates t=0 history)
    }

    init();

});
// --- END OF FILE script.js ---