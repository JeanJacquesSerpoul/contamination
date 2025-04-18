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
    let historyTicks = [];
    let historyHealthy = [];
    let historyInfected = [];
    let historyRecovered = [];
    let historyDead = [];
    const MAX_HISTORY_POINTS = 500;

    const gridElement = document.getElementById('grid');
    const gridContainerElement = document.getElementById('gridContainer'); // Référence conservée au cas où
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

    // --- Fonctions ---

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
                // On ajoute 'cell' pour le style de base, et la classe d'état initiale
                cell.className = `cell ${StateGridClasses[State.EMPTY]}`; // Utilisation de className pour remplacer toutes les classes initialement
                cell.dataset.r = r;
                cell.dataset.c = c;
                gridElement.appendChild(cell);
                gridCells[r][c] = cell;
            }
        }

        // --- LE BLOC DE DIMENSIONNEMENT JS EST SUPPRIMÉ ICI ---
        // La taille du gridContainer est maintenant gérée par CSS (Tailwind)

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
        if(attempts >= maxAttempts) console.warn("Could not place all individuals (random placement).");

        let infectedPlaced = 0;
        const healthyIndividualsCoords = [];
         for (let r = 0; r < size; r++) {
            for (let c = 0; c < size; c++) {
                if(grid[r][c].state === State.HEALTHY) {
                    healthyIndividualsCoords.push({r, c});
                }
            }
         }

        healthyIndividualsCoords.sort(() => Math.random() - 0.5);

        const numToInfect = Math.min(initialInfectedCount, healthyIndividualsCoords.length);
        for(let i=0; i < numToInfect; i++) {
            const coord = healthyIndividualsCoords[i];
            grid[coord.r][coord.c].state = State.INFECTED;
            grid[coord.r][coord.c].infectionTimer = 0;
            infectedPlaced++;
        }

        if(infectedPlaced < initialInfectedCount && numToInfect > 0) { // Ne pas avertir si initialInfectedCount était 0
             console.warn(`Could only place ${infectedPlaced} out of ${initialInfectedCount} initial infected individuals.`);
        }
    }

    function handleManualPlacementClick(event) {
        if (!isManualPlacementMode || isRunning) return;

        const cellElement = event.target.closest('.cell');
        if (!cellElement) return;

        const r = parseInt(cellElement.dataset.r);
        const c = parseInt(cellElement.dataset.c);

        // Vérifier les limites (sécurité)
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
        renderGridCell(r, c); // Mettre à jour seulement la cellule cliquée
        updateStats();
    }

    // Fonction optimisée pour rendre une seule cellule
    function renderGridCell(r, c) {
        if (grid[r] && grid[r][c] && gridCells[r] && gridCells[r][c]) {
            const cellData = grid[r][c];
            const cellElement = gridCells[r][c];
            const newStateClass = StateGridClasses[cellData.state];

            // Remplacement simple et efficace des classes d'état
            // On garde 'cell' et on remplace la classe d'état
            const stateClasses = Object.values(StateGridClasses);
            let newClassName = 'cell'; // Base class
            if(newStateClass) {
                newClassName += ' ' + newStateClass; // Add state class if not empty
            }

            // Appliquer seulement si différent pour éviter reflow inutile
            if (cellElement.className !== newClassName) {
                cellElement.className = newClassName;
            }
        }
    }


    function renderGrid() {
        // Appelle renderGridCell pour chaque cellule
        // (Moins performant que la version précédente si beaucoup de cellules ne changent pas,
        // mais plus simple et robuste, surtout après le placement manuel)
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
                 // Vérifier si les coordonnées sont valides (sécurité)
                if (!grid[nr] || !grid[nr][nc]) continue;

                const dist = calculateDistance(r, c, nr, nc);
                if (dist <= radius) {
                     if(grid[nr][nc].state === State.HEALTHY) {
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
        let changedCells = []; // Stocker les cellules qui changent d'état

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
                         if (nextCell.state !== newState) { // Vérifier si l'état change vraiment
                            nextCell.state = newState;
                            nextCell.infectionTimer = 0;
                            changedCells.push({r, c}); // Ajouter aux cellules modifiées
                        }
                    } else {
                         // L'infection continue, pas de changement d'état visible, mais hasInfected est true
                    }

                    const neighbors = getNeighbors(r, c, params.infectionRadius);
                    neighbors.forEach(neighbor => {
                        // Utiliser neighbor.r et neighbor.c pour accéder à nextGrid
                        const targetCellNext = nextGrid[neighbor.r][neighbor.c];
                        // On vérifie seulement targetCellNext car getNeighbors retourne seulement les HEALTHY de grid (état actuel)
                        // Et on s'assure qu'il n'a pas été infecté par un *autre* voisin dans ce même tick
                        if (targetCellNext.state === State.HEALTHY) {
                            const distance = neighbor.distance;
                            let infectionProbability = params.infectionRate * Math.max(0, 1 - ((distance - 1) / Math.max(1, params.infectionRadius))); // Eviter division par 0 si rayon < 1
                            infectionProbability = Math.min(params.infectionRate, Math.max(0, infectionProbability)); // Clamp entre 0 et taux max

                             if (infectionProbability > 0 && Math.random() < infectionProbability) {
                                 targetCellNext.state = State.INFECTED;
                                 targetCellNext.infectionTimer = 0;
                                 changedCells.push({r: neighbor.r, c: neighbor.c}); // Ajouter aux cellules modifiées
                                 hasInfected = true; // S'assurer que ça reste true si on vient d'infecter
                             }
                        }
                    });
                }
                // Si la cellule n'était pas infectée, son état dans nextGrid est le même que dans grid
                // sauf si elle vient d'être infectée par un voisin (géré ci-dessus)
            }
        }

        grid = nextGrid;
        tickCount++;

        // Optimisation: Rendre seulement les cellules modifiées
        changedCells.forEach(cell => renderGridCell(cell.r, cell.c));
        // Si aucune cellule n'a changé (rare mais possible), on ne fait rien visuellement

        updateStats();

        if (!hasInfected && isRunning) {
            pauseSimulation();
            console.log(`Simulation terminée au tick ${tickCount}: plus d'individus infectés.`);
             // Optionnel: afficher un message à l'utilisateur
             // alert(`Simulation terminée au tick ${tickCount}.`);
        }
    }

    function initializeChart() {
        if (sirChart) {
            sirChart.destroy();
            sirChart = null;
        }
        if(!chartCanvas) {
            console.error("Canvas element for chart not found!");
            return;
        }
        const ctx = chartCanvas.getContext('2d');
        sirChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: historyTicks,
                datasets: [
                    {
                        label: 'Sains (S)', data: historyHealthy,
                        borderColor: StateChartColors[State.HEALTHY], backgroundColor: StateChartColors[State.HEALTHY] + '33',
                        borderWidth: 2, fill: false, pointRadius: 0, tension: 0.1
                    },
                    {
                        label: 'Infectés (I)', data: historyInfected,
                        borderColor: StateChartColors[State.INFECTED], backgroundColor: StateChartColors[State.INFECTED] + '33',
                        borderWidth: 2, fill: false, pointRadius: 0, tension: 0.1
                    },
                    {
                        label: 'Guéris (R)', data: historyRecovered,
                        borderColor: StateChartColors[State.RECOVERED], backgroundColor: StateChartColors[State.RECOVERED] + '33',
                        borderWidth: 2, fill: false, pointRadius: 0, tension: 0.1
                    },
                    {
                        label: 'Morts (D)', data: historyDead,
                        borderColor: StateChartColors[State.DEAD], backgroundColor: StateChartColors[State.DEAD] + '33',
                        borderWidth: 2, fill: false, pointRadius: 0, tension: 0.1
                    }
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
                 if(grid[row] && grid[row][col]) {
                     const state = grid[row][col].state;
                     if(state !== State.EMPTY) total++;
                     if(state === State.HEALTHY) s++;
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

        if(isRunning || tickCount === 0) {
             updateHistoryAndChart(tickCount, s, i, r_val, d);
        }
    }

    function updateHistoryAndChart(currentTick, s, i, r_val, d) {
        if (historyTicks.length === 0 || historyTicks[historyTicks.length - 1] < currentTick) {
            historyTicks.push(currentTick);
            historyHealthy.push(s);
            historyInfected.push(i);
            historyRecovered.push(r_val);
            historyDead.push(d);

            if (historyTicks.length > MAX_HISTORY_POINTS) {
                historyTicks.shift(); historyHealthy.shift(); historyInfected.shift();
                historyRecovered.shift(); historyDead.shift();
            }
        } else if (historyTicks[historyTicks.length - 1] === currentTick) {
             historyHealthy[historyHealthy.length - 1] = s;
             historyInfected[historyInfected.length - 1] = i;
             historyRecovered[historyRecovered.length - 1] = r_val;
             historyDead[historyDead.length - 1] = d;
        }

        if (sirChart) {
            sirChart.data.labels = historyTicks;
            // Les données des datasets sont des références aux tableaux, pas besoin de les réassigner
            sirChart.update('none');
        }
    }

    function startSimulation() {
         if (isRunning) return;
         updateParameterValues(); // S'assurer que les params sont à jour

         let initialInfectedFound = false;
         let populationExists = false; // Vérifier s'il y a *au moins* un individu
         for (let r = 0; r < params.gridSize; r++) {
            for (let c = 0; c < params.gridSize; c++) {
                if(grid[r] && grid[r][c]) {
                    if(grid[r][c].state !== State.EMPTY) {
                        populationExists = true;
                    }
                    if(grid[r][c].state === State.INFECTED) {
                        initialInfectedFound = true;
                    }
                }
            }
         }

         // Conditions d'arrêt avant démarrage
         if (!populationExists) {
             alert("Veuillez placer des individus sur la grille (mode manuel) ou définir une population > 0 avant de démarrer.");
             return;
         }
         if (!initialInfectedFound) {
             alert("Veuillez placer au moins un individu infecté sur la grille (cliquez sur un individu sain) ou vérifier le paramètre 'Nb. Infectés Initiaux'.");
             return;
         }

         // Gérer le mode manuel
         if (isManualPlacementMode) {
             gridElement.removeEventListener('click', handleManualPlacementClick);
             manualPlacementInfo.classList.add('hidden');
         }

        isRunning = true;
        startButton.disabled = true;
        pauseButton.disabled = false;
        resetButton.disabled = true;
        setControlsDisabled(true); // Désactiver les inputs/sliders (sauf vitesse)

        updateStats(); // Assurer le point t=0 sur le graphique

        clearInterval(simulationInterval);
        simulationInterval = setInterval(simulationStep, params.tickSpeed);
        console.log("Simulation démarrée.");
    }

    function pauseSimulation() {
        if (!isRunning && !simulationInterval) return; // Ne rien faire si déjà arrêté

        isRunning = false;
        clearInterval(simulationInterval);
        simulationInterval = null;
        startButton.disabled = false;
        pauseButton.disabled = true;
        resetButton.disabled = false;
        setControlsDisabled(false);

        // Réactiver le clic seulement si on est en mode manuel (identifié par params.manualPlacement)
        if (params.manualPlacement) {
            isManualPlacementMode = true; // S'assurer que le flag est bien positionné
            gridElement.addEventListener('click', handleManualPlacementClick);
            manualPlacementInfo.classList.remove('hidden');
        } else {
            isManualPlacementMode = false; // S'assurer que le flag est bas
            manualPlacementInfo.classList.add('hidden'); // Cacher le message
        }
        console.log("Simulation en pause.");
    }

    function resetSimulation() {
        pauseSimulation(); // Arrête la sim, nettoie l'intervalle, gère les listeners de clic
        tickCount = 0;
        updateParameterValues(); // Lire les valeurs actuelles des contrôles

        historyTicks = []; historyHealthy = []; historyInfected = [];
        historyRecovered = []; historyDead = [];

        initializeGridData(params.gridSize);
        createGridDOM(params.gridSize); // Recrée la grille DOM (et gère le listener clic si manuel)

        // Le mode manuel est maintenant déterminé par params.manualPlacement
        isManualPlacementMode = params.manualPlacement;
        manualPlacementInfo.classList.toggle('hidden', !isManualPlacementMode);

        if (!isManualPlacementMode) {
             populateGridRandomly(params.gridSize, params.populationSize, params.initialInfected);
        }
        // Si manuel, la grille reste vide, l'utilisateur place via handleManualPlacementClick

        renderGrid(); // Afficher l'état initial (peuplé ou vide)
        updateStats(); // Mettre à jour compteurs et graphique à t=0

        // Assurer que le graphique est (ré)initialisé et affiche t=0
        if (!sirChart) {
             initializeChart();
        }
        // updateStats a déjà appelé updateHistoryAndChart, le graphique est à jour

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
        // tickSpeedSlider reste actif
    }

    // --- Initialisation et Écouteurs d'événements ---
    function init() {
        updateParameterValues();

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

        // 'change' est mieux que 'input' pour les champs number pour éviter reset à chaque chiffre tapé
        gridSizeInput.addEventListener('change', () => { updateParameterValues(); resetSimulation(); });
        populationSizeInput.addEventListener('change', () => { updateParameterValues(); resetSimulation(); });
        initialInfectedInput.addEventListener('change', () => { updateParameterValues(); resetSimulation(); });

        startButton.addEventListener('click', startSimulation);
        pauseButton.addEventListener('click', pauseSimulation);
        resetButton.addEventListener('click', resetSimulation);

        initializeChart(); // Initialiser le graphique une fois
        resetSimulation(); // Configurer l'état initial complet (grille, stats, etc.)
    }

    init();

});