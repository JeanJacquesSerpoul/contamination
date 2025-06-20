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
    
    // **OPTIMIZATION**: Maintain a list of only the infected individuals
    let infectedList = []; 

    let sirChart = null;

    // History for the chart (limited size for performance)
    let chartHistoryTicks = [];
    let chartHistoryHealthy = [];
    let chartHistoryInfected = [];
    let chartHistoryRecovered = [];
    let chartHistoryDead = [];
    const MAX_CHART_HISTORY_POINTS = 500;

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

    // --- Functions (Most functions are unchanged, only key ones are commented below) ---

    function exportDataToCsv() {
        if (fullHistoryTicks.length === 0) {
            alert("Aucune donnée à exporter. Lancez d'abord la simulation.");
            return;
        }
        let csvContent = "data:text/csv;charset=utf-8,";
        const header = ["Tick", "Sains", "Infectés", "Guéris", "Morts"];
        csvContent += header.join(";") + "\r\n";
        for (let i = 0; i < fullHistoryTicks.length; i++) {
            const row = [fullHistoryTicks[i], fullHistoryHealthy[i], fullHistoryInfected[i], fullHistoryRecovered[i], fullHistoryDead[i]];
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
        const minRaw = 10, maxRaw = 1000, speedMultiplier = 4.0;
        let baseDelay = (maxRaw + minRaw) - params.tickSpeedSetting;
        let targetDelay = baseDelay / speedMultiplier;
        const minActualDelayMs = 5, maxActualDelayMs = 1000 / speedMultiplier;
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
        if (count > size * size) { count = size * size; }
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
                if (grid[r][c].state === State.HEALTHY) { healthyIndividualsCoords.push({ r, c }); }
            }
        }
        healthyIndividualsCoords.sort(() => Math.random() - 0.5);
        const numToInfect = Math.min(initialInfectedCount, healthyIndividualsCoords.length);
        for (let i = 0; i < numToInfect; i++) {
            const coord = healthyIndividualsCoords[i];
            grid[coord.r][coord.c].state = State.INFECTED;
            grid[coord.r][coord.c].infectionTimer = 0;
            // **OPTIMIZATION**: Add to the infected list
            infectedList.push({ r: coord.r, c: coord.c });
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
        
        // **OPTIMIZATION**: Update infectedList when manually changing states
        if (currentCell.state === State.INFECTED) {
            // Remove from infected list before changing its state
            infectedList = infectedList.filter(p => p.r !== r || p.c !== c);
        }

        if (currentCell.state === State.EMPTY) {
            currentCell.state = State.HEALTHY;
        } else if (currentCell.state === State.HEALTHY) {
            currentCell.state = State.INFECTED;
            currentCell.infectionTimer = 0;
            // Add to infected list
            infectedList.push({r, c});
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
            let newClassName = 'cell' + (newStateClass ? ' ' + newStateClass : '');
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

    // **OPTIMIZATION**: Calculate squared distance to avoid Math.sqrt
    function calculateDistanceSquared(r1, c1, r2, c2) {
        return Math.pow(r1 - r2, 2) + Math.pow(c1 - c2, 2);
    }

    // **OPTIMIZATION**: Reworked to use squared distance
    function getNeighbors(r, c, radius) {
        const neighbors = [];
        const size = params.gridSize;
        const radiusSquared = radius * radius; // Pre-calculate squared radius
        const r_min = Math.max(0, r - Math.floor(radius));
        const r_max = Math.min(size - 1, r + Math.floor(radius));
        const c_min = Math.max(0, c - Math.floor(radius));
        const c_max = 'min' in Math ? Math.min(size - 1, c + Math.floor(radius)) : size - 1;


        for (let nr = r_min; nr <= r_max; nr++) {
            for (let nc = c_min; nc <= c_max; nc++) {
                if ((nr === r && nc === c) || !grid[nr]?.[nc] || grid[nr][nc].state !== State.HEALTHY) {
                    continue;
                }
                const distSquared = calculateDistanceSquared(r, c, nr, nc);
                if (distSquared <= radiusSquared) {
                    // We pass the sqrt of the squared distance to keep the original logic for probability calculation
                    neighbors.push({ r: nr, c: nc, distance: Math.sqrt(distSquared) });
                }
            }
        }
        return neighbors;
    }

    function showEndMessage(finalTick) { /* Unchanged */
        if (endMessageTimeout) clearTimeout(endMessageTimeout);
        endMessageDetails.textContent = `Arrêt au tick ${finalTick}.`;
        endMessageOverlay.classList.remove('hidden', 'opacity-0');
        endMessageBox.classList.remove('scale-95', 'opacity-0');
        endMessageBox.classList.add('scale-100', 'opacity-100');
        endMessageTimeout = setTimeout(hideEndMessage, 3000);
    }
    function hideEndMessage() { /* Unchanged */
        if (endMessageTimeout) { clearTimeout(endMessageTimeout); endMessageTimeout = null; }
        endMessageOverlay.classList.add('opacity-0');
        endMessageBox.classList.add('scale-95', 'opacity-0');
        endMessageBox.classList.remove('scale-100', 'opacity-100');
        setTimeout(() => { if (endMessageOverlay.classList.contains('opacity-0')) { endMessageOverlay.classList.add('hidden'); } }, 300);
    }
    
    // --- *** THE CORE OPTIMIZED FUNCTION *** ---
    function simulationStep() {
        if (infectedList.length === 0 && isRunning) {
            const finalTick = tickCount;
            pauseSimulation();
            console.log(`Simulation terminée au tick ${finalTick}: plus d'individus infectés.`);
            showEndMessage(finalTick);
            return;
        }

        const changes = []; // Store changes to apply at the end {r, c, newState, newTimer}
        const newlyInfected = []; // Store coords of newly infected people for the next tick's list
        const stillInfected = []; // Store coords of people who remain infected

        // 1. Iterate ONLY over infected individuals
        for (const infected of infectedList) {
            const { r, c } = infected;
            const currentCell = grid[r][c];

            currentCell.infectionTimer++;

            // 2. Check for recovery/death
            if (currentCell.infectionTimer >= params.infectionDuration) {
                let newState;
                if (Math.random() < params.mortalityRate) {
                    newState = State.DEAD;
                } else {
                    newState = (Math.random() < params.immunityLevel) ? State.RECOVERED : State.HEALTHY;
                }
                changes.push({ r, c, newState: newState, newTimer: 0 });
                // This person is no longer infected, so they are not added to `stillInfected`
            } else {
                // This person remains infected for the next tick
                stillInfected.push({ r, c });

                // 3. Try to infect neighbors
                const neighbors = getNeighbors(r, c, params.infectionRadius);
                neighbors.forEach(neighbor => {
                    // Check if neighbor has already been infected in this tick
                    if (changes.some(ch => ch.r === neighbor.r && ch.c === neighbor.c)) {
                        return;
                    }
                    
                    const distance = neighbor.distance;
                    let infectionProbability = params.infectionRate * Math.max(0, 1 - ((distance - 1) / Math.max(1, params.infectionRadius)));
                    infectionProbability = Math.min(params.infectionRate, Math.max(0, infectionProbability));

                    if (infectionProbability > 0 && Math.random() < infectionProbability) {
                        changes.push({ r: neighbor.r, c: neighbor.c, newState: State.INFECTED, newTimer: 0 });
                        newlyInfected.push({ r: neighbor.r, c: neighbor.c });
                    }
                });
            }
        }
        
        tickCount++;

        // 4. Apply all collected changes to the grid and render them
        changes.forEach(change => {
            const { r, c, newState, newTimer } = change;
            grid[r][c].state = newState;
            grid[r][c].infectionTimer = newTimer;
            renderGridCell(r, c);
        });
        
        // 5. Update the list of infected people for the next tick
        infectedList = stillInfected.concat(newlyInfected);

        // 6. Update stats (only needs to run once per tick)
        updateStats();
    }


    function initializeChart() { /* Unchanged */
        if (sirChart) { sirChart.destroy(); sirChart = null; }
        if (!chartCanvas) { console.error("Canvas element for chart not found!"); return; }
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
            options: { responsive: true, maintainAspectRatio: false, animation: { duration: 0 }, hover: { animationDuration: 0 }, responsiveAnimationDuration: 0, scales: { x: { title: { display: true, text: 'Temps (Ticks)' } }, y: { title: { display: true, text: 'Nombre d\'individus' }, beginAtZero: true, min: 0 } }, plugins: { legend: { position: 'top' }, title: { display: false } } }
        });
    }

    function updateStats() { /* Unchanged */
        let s = 0, i = 0, r_val = 0, d = 0, total = 0;
        const size = params.gridSize;
        for (let row = 0; row < size; row++) {
            for (let col = 0; col < size; col++) {
                if (grid[row]?.[col]) {
                    const state = grid[row][col].state;
                    if (state !== State.EMPTY) total++;
                    if (state === State.HEALTHY) s++; else if (state === State.INFECTED) i++; else if (state === State.RECOVERED) r_val++; else if (state === State.DEAD) d++;
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

    function updateHistoryAndChart(currentTick, s, i, r_val, d) { /* Unchanged */
        let updateChartNeeded = false;
        const lastFullTick = fullHistoryTicks.length > 0 ? fullHistoryTicks[fullHistoryTicks.length - 1] : -1;
        if (lastFullTick < currentTick) {
            fullHistoryTicks.push(currentTick); fullHistoryHealthy.push(s); fullHistoryInfected.push(i); fullHistoryRecovered.push(r_val); fullHistoryDead.push(d);
            updateChartNeeded = true;
        } else if (lastFullTick === currentTick) {
            if (fullHistoryHealthy[fullHistoryHealthy.length - 1] !== s || fullHistoryInfected[fullHistoryInfected.length - 1] !== i || fullHistoryRecovered[fullHistoryRecovered.length - 1] !== r_val || fullHistoryDead[fullHistoryDead.length - 1] !== d) {
                fullHistoryHealthy[fullHistoryHealthy.length - 1] = s; fullHistoryInfected[fullHistoryInfected.length - 1] = i; fullHistoryRecovered[fullHistoryRecovered.length - 1] = r_val; fullHistoryDead[fullHistoryDead.length - 1] = d;
                updateChartNeeded = true;
            }
        }
        const lastChartTick = chartHistoryTicks.length > 0 ? chartHistoryTicks[chartHistoryTicks.length - 1] : -1;
        if (lastChartTick < currentTick) {
            chartHistoryTicks.push(currentTick); chartHistoryHealthy.push(s); chartHistoryInfected.push(i); chartHistoryRecovered.push(r_val); chartHistoryDead.push(d);
            if (chartHistoryTicks.length > MAX_CHART_HISTORY_POINTS) {
                chartHistoryTicks.shift(); chartHistoryHealthy.shift(); chartHistoryInfected.shift(); chartHistoryRecovered.shift(); chartHistoryDead.shift();
            }
            updateChartNeeded = true;
        } else if (lastChartTick === currentTick) {
            if (chartHistoryHealthy[chartHistoryHealthy.length - 1] !== s || chartHistoryInfected[chartHistoryInfected.length - 1] !== i || chartHistoryRecovered[chartHistoryRecovered.length - 1] !== r_val || chartHistoryDead[chartHistoryDead.length - 1] !== d) {
                 chartHistoryHealthy[chartHistoryHealthy.length - 1] = s; chartHistoryInfected[chartHistoryInfected.length - 1] = i; chartHistoryRecovered[chartHistoryRecovered.length - 1] = r_val; chartHistoryDead[chartHistoryDead.length - 1] = d;
                 updateChartNeeded = true;
            }
        }
        if (updateChartNeeded && sirChart) {
            sirChart.data.labels = chartHistoryTicks; sirChart.data.datasets[0].data = chartHistoryHealthy; sirChart.data.datasets[1].data = chartHistoryInfected; sirChart.data.datasets[2].data = chartHistoryRecovered; sirChart.data.datasets[3].data = chartHistoryDead;
            sirChart.update('none');
        }
    }

    function startSimulation() { /* Unchanged except for check on infectedList */
        if (isRunning) return;
        updateParameterValues();
        if (infectedList.length === 0) {
             let populationExists = infectedList.length > 0;
             if (!populationExists) {
                for (let r = 0; r < params.gridSize; r++) { for (let c = 0; c < params.gridSize; c++) { if (grid[r]?.[c]?.state && grid[r][c].state !== State.EMPTY) { populationExists = true; break; } } if(populationExists) break; }
             }
             if (!populationExists) { alert("Veuillez placer des individus sur la grille (mode manuel) ou définir une population > 0 avant de démarrer."); return; }
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
        console.log(`Starting interval with delay: ${params.actualDelayMs} ms`);
        simulationInterval = setInterval(simulationStep, params.actualDelayMs);
        console.log("Simulation démarrée.");
    }

    function pauseSimulation() { /* Unchanged */
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

    function resetSimulation() { /* Modified to handle infectedList */
        pauseSimulation();
        hideEndMessage();
        tickCount = 0;
        updateParameterValues();
        chartHistoryTicks = []; chartHistoryHealthy = []; chartHistoryInfected = []; chartHistoryRecovered = []; chartHistoryDead = [];
        fullHistoryTicks = []; fullHistoryHealthy = []; fullHistoryInfected = []; fullHistoryRecovered = []; fullHistoryDead = [];
        
        // **OPTIMIZATION**: Clear the infected list
        infectedList = [];

        initializeGridData(params.gridSize);
        createGridDOM(params.gridSize);
        isManualPlacementMode = params.manualPlacement;
        manualPlacementInfo.classList.toggle('hidden', !isManualPlacementMode || isRunning);
        if (!isManualPlacementMode) {
            // populateGridRandomly now populates infectedList for us
            populateGridRandomly(params.gridSize, params.populationSize, params.initialInfected);
        }
        renderGrid();
        updateStats();
        if (!sirChart) {
            initializeChart();
        } else {
             sirChart.data.labels = chartHistoryTicks;
             sirChart.data.datasets[0].data = chartHistoryHealthy;
             sirChart.data.datasets[1].data = chartHistoryInfected;
             sirChart.data.datasets[2].data = chartHistoryRecovered;
             sirChart.data.datasets[3].data = chartHistoryDead;
             sirChart.update('none');
        }
        resetButton.disabled = false;
        startButton.disabled = false;
        pauseButton.disabled = true;
        setControlsDisabled(false);
        console.log("Simulation réinitialisée.");
    }

    function setControlsDisabled(disabled) { /* Unchanged */
        gridSizeInput.disabled = disabled; populationSizeInput.disabled = disabled; initialInfectedInput.disabled = disabled;
        infectionRadiusSlider.disabled = disabled; infectionRateSlider.disabled = disabled; infectionDurationSlider.disabled = disabled;
        mortalityRateSlider.disabled = disabled; immunityLevelSlider.disabled = disabled;
    }

    function init() { /* Unchanged */
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
                console.log(`Updating interval with delay: ${params.actualDelayMs} ms`);
                simulationInterval = setInterval(simulationStep, params.actualDelayMs);
            }
        });
        gridSizeInput.addEventListener('change', () => { updateParameterValues(); resetSimulation(); });
        populationSizeInput.addEventListener('change', () => { updateParameterValues(); resetSimulation(); });
        initialInfectedInput.addEventListener('change', () => { updateParameterValues(); resetSimulation(); });
        startButton.addEventListener('click', startSimulation);
        pauseButton.addEventListener('click', pauseSimulation);
        resetButton.addEventListener('click', resetSimulation);
        endMessageOverlay.addEventListener('click', (event) => { if (event.target === endMessageOverlay) { hideEndMessage(); } });
        initializeChart();
        resetSimulation();
    }
    
    init();
});
// --- END OF FILE script.js ---