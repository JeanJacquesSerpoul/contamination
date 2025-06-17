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

    // Couleurs alignées sur le thème "coffee" de DaisyUI pour Chart.js
    const StateChartColors = {
        [State.HEALTHY]: 'rgb(25, 147, 51)',   // coffee theme 'success' (#199333)
        [State.INFECTED]: 'rgb(255, 0, 0)',      // coffee theme 'error' (#ff0000)
        [State.RECOVERED]: 'rgb(0, 145, 213)',  // coffee theme 'info' (#0091d5)
        [State.DEAD]: 'rgb(38, 23, 18)',       // coffee theme 'neutral' (#261712)
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
        actualDelayMs: 910, 
        tickSpeedSetting: 100, 
        manualPlacement: false
    };

    let grid = [];
    let gridCells = [];
    let simulationInterval = null;
    let tickCount = 0;
    let isRunning = false;
    let isManualPlacementMode = false;

    let sirChart = null;

    let chartHistoryTicks = [];
    let chartHistoryHealthy = [];
    let chartHistoryInfected = [];
    let chartHistoryRecovered = [];
    let chartHistoryDead = [];
    const MAX_CHART_HISTORY_POINTS = 500;

    let fullHistoryTicks = [];
    let fullHistoryHealthy = [];
    let fullHistoryInfected = [];
    let fullHistoryRecovered = [];
    let fullHistoryDead = [];

    // Element References
    const gridElement = document.getElementById('grid');
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

        params.tickSpeedSetting = parseInt(tickSpeedSlider.value);
        const minRaw = 10;
        const maxRaw = 1000;
        const speedMultiplier = 4.0;
        let baseDelay = (maxRaw + minRaw) - params.tickSpeedSetting;
        let targetDelay = baseDelay / speedMultiplier;
        const minActualDelayMs = 5;
        const maxActualDelayMs = 1000 / speedMultiplier;
        params.actualDelayMs = Math.max(minActualDelayMs, Math.min(maxActualDelayMs, targetDelay));

        infectionRadiusValueSpan.textContent = params.infectionRadius.toFixed(1);
        infectionRateValueSpan.textContent = params.infectionRate.toFixed(2);
        infectionDurationValueSpan.textContent = params.infectionDuration;
        mortalityRateValueSpan.textContent = (params.mortalityRate * 100).toFixed(0);
        immunityLevelValueSpan.textContent = (params.immunityLevel * 100).toFixed(0);
        tickSpeedValueSpan.textContent = params.tickSpeedSetting;

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
        } else {
             currentCell.state = State.EMPTY;
             currentCell.infectionTimer = 0;
        }
        renderGridCell(r, c);
        updateStats();
    }

    function renderGridCell(r, c) {
        if (grid[r]?.[c] && gridCells[r]?.[c]) {
            const cellData = grid[r][c];
            const cellElement = gridCells[r][c];
            const newStateClass = StateGridClasses[cellData.state];
            let newClassName = `cell ${newStateClass}`;
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
                if ((nr === r && nc === c) || !grid[nr]?.[nc]) continue;
                const dist = calculateDistance(r, c, nr, nc);
                if (dist <= radius && grid[nr][nc].state === State.HEALTHY) {
                   neighbors.push({ r: nr, c: nc, distance: dist });
                }
            }
        }
        return neighbors;
    }

    function showEndMessage(finalTick) {
        if (endMessageTimeout) clearTimeout(endMessageTimeout);
        endMessageDetails.textContent = `Arrêt au tick ${finalTick}.`;
        endMessageOverlay.classList.remove('hidden');
        void endMessageOverlay.offsetWidth;
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
        const size = params.gridSize;
        const nextGrid = [];
        for (let r = 0; r < size; r++) {
            nextGrid[r] = [];
            for (let c = 0; c < size; c++) {
                nextGrid[r][c] = { ...grid[r][c] };
            }
        }

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
                        let newState = (Math.random() < params.mortalityRate) ? State.DEAD :
                                       (Math.random() < params.immunityLevel) ? State.RECOVERED : State.HEALTHY;
                        if (nextCell.state !== newState) {
                             nextCell.state = newState;
                             nextCell.infectionTimer = 0;
                             changedCells.push({ r, c });
                        }
                    } else {
                        const neighbors = getNeighbors(r, c, params.infectionRadius);
                        neighbors.forEach(neighbor => {
                            const targetCellNext = nextGrid[neighbor.r][neighbor.c];
                            if (targetCellNext.state === State.HEALTHY) {
                                const distance = neighbor.distance;
                                let infectionProbability = params.infectionRate * Math.max(0, 1 - ((distance - 1) / Math.max(1, params.infectionRadius)));
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
        }

        grid = nextGrid;
        tickCount++;

        changedCells.forEach(cell => renderGridCell(cell.r, cell.c));
        updateStats();

        if (!hasInfected && isRunning) {
            const finalTick = tickCount;
            pauseSimulation();
            console.log(`Simulation terminée au tick ${finalTick}: plus d'individus infectés.`);
            showEndMessage(finalTick);
        }
    }

    function initializeChart() {
        if (sirChart) {
            sirChart.destroy();
            sirChart = null;
        }
        if (!chartCanvas) return;
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
                scales: {
                    x: { title: { display: true, text: 'Temps (Ticks)', color: 'hsl(var(--bc))' }, ticks: { color: 'hsl(var(--bc))' }, grid: { color: 'hsl(var(--b3))' } },
                    y: { title: { display: true, text: 'Nombre d\'individus', color: 'hsl(var(--bc))' }, beginAtZero: true, min: 0, ticks: { color: 'hsl(var(--bc))' }, grid: { color: 'hsl(var(--b3))' } }
                },
                plugins: { legend: { position: 'top', labels: { color: 'hsl(var(--bc))' } }, title: { display: false } }
            }
        });
    }

    function updateStats() {
        let s = 0, i = 0, r_val = 0, d = 0, total = 0;
        const size = params.gridSize;
        for (let row = 0; row < size; row++) {
            for (let col = 0; col < size; col++) {
                if (grid[row]?.[col]) {
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

        fullHistoryTicks.push(currentTick);
        fullHistoryHealthy.push(s);
        fullHistoryInfected.push(i);
        fullHistoryRecovered.push(r_val);
        fullHistoryDead.push(d);
        
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
        updateChartNeeded = true;
        
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
        updateParameterValues();

        let populationExists = false;
        let initialInfectedFound = false;
        for (let r = 0; r < params.gridSize; r++) {
            for (let c = 0; c < params.gridSize; c++) {
                 if (grid[r]?.[c]?.state && grid[r][c].state !== State.EMPTY) {
                    populationExists = true;
                    if (grid[r][c].state === State.INFECTED) {
                        initialInfectedFound = true;
                        break;
                    }
                 }
            }
            if (initialInfectedFound) break;
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
        updateStats();
        clearInterval(simulationInterval);
        simulationInterval = setInterval(simulationStep, params.actualDelayMs);
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
        }
    }

    function resetSimulation() {
        pauseSimulation();
        hideEndMessage();
        tickCount = 0;
        updateParameterValues();

        chartHistoryTicks = []; chartHistoryHealthy = []; chartHistoryInfected = [];
        chartHistoryRecovered = []; chartHistoryDead = [];
        fullHistoryTicks = []; fullHistoryHealthy = []; fullHistoryInfected = [];
        fullHistoryRecovered = []; fullHistoryDead = [];

        initializeGridData(params.gridSize);
        createGridDOM(params.gridSize);

        isManualPlacementMode = params.manualPlacement;
        manualPlacementInfo.classList.toggle('hidden', !isManualPlacementMode || isRunning);

        if (!isManualPlacementMode) {
            populateGridRandomly(params.gridSize, params.populationSize, params.initialInfected);
        }

        renderGrid();
        updateStats();

        if (!sirChart) {
            initializeChart();
        } else {
             sirChart.data.labels = chartHistoryTicks;
             sirChart.data.datasets.forEach(dataset => dataset.data = []);
             sirChart.update('none');
        }

        resetButton.disabled = false;
        startButton.disabled = false;
        pauseButton.disabled = true;
        setControlsDisabled(false);
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
    }
    
    // --- BUG FIX START ---
    // La fonction `handleResize` est appelée lorsque la fenêtre change de taille.
    // L'ancienne version recréait les cellules de la grille (`createGridDOM`) mais oubliait
    // de leur réappliquer leur état actuel (sain, infecté, etc.).
    // En ajoutant `renderGrid()`, on force la mise à jour visuelle des nouvelles cellules
    // pour qu'elles correspondent à l'état de la simulation, rendant ainsi la grille visible à nouveau.
    function handleResize() {
        if (params.gridSize > 0) {
            createGridDOM(params.gridSize); // Recrée les éléments HTML de la grille
            renderGrid(); // APPLIQUE L'ÉTAT ACTUEL : Cette ligne corrige le bug.
        }
    }
    // --- BUG FIX END ---

    // --- Initialisation ---
    function init() {
        updateParameterValues();

        exportCsvButton.addEventListener('click', exportDataToCsv);
        [infectionRadiusSlider, infectionRateSlider, infectionDurationSlider, mortalityRateSlider, immunityLevelSlider].forEach(slider => {
            slider.addEventListener('input', updateParameterValues);
        });
        tickSpeedSlider.addEventListener('input', () => {
            updateParameterValues();
            if (isRunning) {
                clearInterval(simulationInterval);
                simulationInterval = setInterval(simulationStep, params.actualDelayMs);
            }
        });
        [gridSizeInput, populationSizeInput, initialInfectedInput].forEach(input => {
            input.addEventListener('change', () => { updateParameterValues(); resetSimulation(); });
        });
        
        startButton.addEventListener('click', startSimulation);
        pauseButton.addEventListener('click', pauseSimulation);
        resetButton.addEventListener('click', resetSimulation);
        endMessageOverlay.addEventListener('click', (event) => {
            if (event.target === endMessageOverlay) hideEndMessage();
        });
        
        window.addEventListener('resize', handleResize);
        initializeChart();
        resetSimulation();
    }

    init();

}); // End of DOMContentLoaded
// --- END OF FILE script.js ---