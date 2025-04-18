document.addEventListener('DOMContentLoaded', () => {
    // --- Configuration et États ---
    const State = {
        EMPTY: 0, // Optionnel si la grille n'est pas entièrement remplie
        HEALTHY: 1, // Sain (Susceptible)
        INFECTED: 2,
        RECOVERED: 3, // Guéri / Immunisé
        DEAD: 4,
    };

    // Utiliser les couleurs RGB directes pour le graphique (basées sur Tailwind)
    const StateChartColors = {
        [State.HEALTHY]: 'rgb(74, 222, 128)', // green-400
        [State.INFECTED]: 'rgb(248, 113, 113)', // red-400
        [State.RECOVERED]: 'rgb(96, 165, 250)', // blue-400
        [State.DEAD]: 'rgb(113, 113, 122)', // zinc-500
    };
    // Garder les classes CSS pour la grille
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
        infectionRate: 0.1, // Probabilité de base à distance 1
        infectionDuration: 50, // en ticks
        mortalityRate: 0.05, // 5%
        immunityLevel: 0.90, // 90%
        tickSpeed: 100, // ms
        manualPlacement: false
    };

    let grid = []; // Contiendra les objets { state, infectionTimer }
    let gridCells = []; // Références aux éléments DOM des cellules
    let simulationInterval = null;
    let tickCount = 0;
    let isRunning = false;
    let isManualPlacementMode = false;

    // --- Variables pour le graphique ---
    let sirChart = null;
    let historyTicks = [];
    let historyHealthy = [];
    let historyInfected = [];
    let historyRecovered = [];
    let historyDead = [];
    const MAX_HISTORY_POINTS = 500; // Limiter le nombre de points pour la performance

    // --- Références DOM ---
    const gridElement = document.getElementById('grid');
    const gridContainerElement = document.getElementById('gridContainer');
    const gridSizeInput = document.getElementById('gridSize');
    const populationSizeInput = document.getElementById('populationSize');
    const initialInfectedInput = document.getElementById('initialInfected');
    // ***** LA LIGNE SUIVANTE ÉTAIT MANQUANTE *****
    const infectionRadiusSlider = document.getElementById('infectionRadius');
    // ******************************************
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
    // Référence au canvas du graphique
    const chartCanvas = document.getElementById('sirChartCanvas');

    // --- Fonctions ---

    function updateParameterValues() {
        params.gridSize = parseInt(gridSizeInput.value) || 50;
        params.populationSize = parseInt(populationSizeInput.value) || 0; // 0 signifie manuel
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
        manualPlacementInfo.classList.toggle('hidden', !params.manualPlacement || isRunning); // Cacher aussi si la sim tourne
    }

    function createGridDOM(size) {
        gridElement.innerHTML = ''; // Vider la grille existante
        gridElement.style.gridTemplateColumns = `repeat(${size}, minmax(0, 1fr))`;
        gridCells = []; // Réinitialiser les références DOM

        for (let r = 0; r < size; r++) {
            gridCells[r] = [];
            for (let c = 0; c < size; c++) {
                const cell = document.createElement('div');
                cell.classList.add('cell', StateGridClasses[State.EMPTY]); // Utiliser les classes ici
                cell.dataset.r = r; // Stocker les coordonnées pour les clics
                cell.dataset.c = c;
                gridElement.appendChild(cell);
                gridCells[r][c] = cell; // Stocker la référence DOM
            }
        }
        // Ajuster la taille du conteneur (optionnel, mais utile pour éviter le scroll inutile)
        const cellSize = 10; // Doit correspondre au CSS .cell width/height
        const borderSize = 1 * 2; // Correspond au CSS .cell border
        const containerSize = size * (cellSize + borderSize);
        // Limiter la taille max pour éviter que ça devienne trop grand sur écran large
        const maxSizeVh = 85; // 85% de la hauteur de la vue
        const availableHeight = window.innerHeight * (maxSizeVh / 100);
        const finalSize = Math.min(containerSize, availableHeight);

        gridContainerElement.style.width = `${finalSize}px`;
        gridContainerElement.style.height = `${finalSize}px`;

         // Ajouter/Retirer le listener pour le placement manuel
         gridElement.removeEventListener('click', handleManualPlacementClick); // Enlever au cas où
         if (params.manualPlacement && !isRunning) { // Actif seulement si mode manuel ET non démarré
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
        if (count <= 0) return; // Ne rien faire si population 0
        if (count > size * size) {
            console.warn("Population size exceeds grid capacity.");
            count = size * size;
        }

        let placed = 0;
        let attempts = 0; // Pour éviter boucle infinie si grille pleine
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


        // Placer les infectés initiaux parmi les individus sains placés
        let infectedPlaced = 0;
        attempts = 0; // Reset attempts counter
        const healthyIndividualsCoords = []; // Trouver les coordonnées des sains
         for (let r = 0; r < size; r++) {
            for (let c = 0; c < size; c++) {
                if(grid[r][c].state === State.HEALTHY) {
                    healthyIndividualsCoords.push({r, c});
                }
            }
         }

        // Mélanger les coordonnées des sains pour choisir aléatoirement
        healthyIndividualsCoords.sort(() => Math.random() - 0.5);

        // Infecter les premiers de la liste mélangée
        const numToInfect = Math.min(initialInfectedCount, healthyIndividualsCoords.length);
        for(let i=0; i < numToInfect; i++) {
            const coord = healthyIndividualsCoords[i];
            grid[coord.r][coord.c].state = State.INFECTED;
            grid[coord.r][coord.c].infectionTimer = 0;
            infectedPlaced++;
        }

        if(infectedPlaced < initialInfectedCount) {
             console.warn(`Could only place ${infectedPlaced} initial infected individuals.`);
        }
    }

    function handleManualPlacementClick(event) {
        if (!isManualPlacementMode || isRunning) return; // Ne rien faire si la sim est en cours ou pas en mode manuel actif

        const cellElement = event.target.closest('.cell');
        if (!cellElement) return;

        const r = parseInt(cellElement.dataset.r);
        const c = parseInt(cellElement.dataset.c);

        const currentCell = grid[r][c];

        if (currentCell.state === State.EMPTY) {
            currentCell.state = State.HEALTHY;
        } else if (currentCell.state === State.HEALTHY) {
            currentCell.state = State.INFECTED;
            currentCell.infectionTimer = 0;
        } else if (currentCell.state === State.INFECTED) {
            // Optionnel: Retour à Sain ou Vide ? Ici on supprime l'individu.
            currentCell.state = State.EMPTY; // Ou State.HEALTHY pour cycle
            currentCell.infectionTimer = 0;
        } else if (currentCell.state === State.RECOVERED || currentCell.state === State.DEAD) {
             // Optionnel: Permettre de réinitialiser une case morte/guérie
             currentCell.state = State.EMPTY;
        }
        renderGrid(); // Mettre à jour visuellement la cellule cliquée
        updateStats(); // Mettre à jour les compteurs (et le graphique à tick 0)
    }


    function renderGrid() {
    for (let r = 0; r < params.gridSize; r++) {
        for (let c = 0; c < params.gridSize; c++) {
            // Sécurité : Vérifier que les références existent
            if (grid[r] && grid[r][c] && gridCells[r] && gridCells[r][c]) {
                const cellData = grid[r][c];
                const cellElement = gridCells[r][c];
                const newStateClass = StateGridClasses[cellData.state]; // Ex: 'sain', 'infecte', 'vide'

                // --- Logique de mise à jour des classes ---
                // L'approche la plus sûre est de toujours nettoyer et réappliquer si nécessaire.
                // Vérifions si la classe correcte est déjà présente ET qu'aucune autre classe d'état n'est présente.

                let currentClasses = cellElement.classList;
                let needsUpdate = false;

                if (!currentClasses.contains(newStateClass)) {
                    // Si la classe correcte manque, il faut mettre à jour.
                    needsUpdate = true;
                } else {
                    // Si la classe correcte est là, vérifier s'il y a des classes d'état incorrectes en plus.
                    for (const stateKey in StateGridClasses) {
                        const className = StateGridClasses[stateKey];
                        if (className !== newStateClass && currentClasses.contains(className)) {
                            needsUpdate = true; // Une classe incorrecte est présente
                            break;
                        }
                    }
                }

                // Si une mise à jour est nécessaire...
                if (needsUpdate) {
                    // 1. Enlever TOUTES les classes d'état possibles.
                    Object.values(StateGridClasses).forEach(cls => {
                        cellElement.classList.remove(cls);
                    });
                    // 2. Ajouter la SEULE classe correcte.
                    cellElement.classList.add(newStateClass);
                }
                // --- Fin de la logique de mise à jour ---

            } else {
                // Log d'erreur si une référence manque (devrait pas arriver normalement)
                // console.warn(`Missing reference at grid[${r}][${c}] or gridCells[${r}][${c}]`);
            }
        }
    }
}

    function calculateDistance(r1, c1, r2, c2) {
        return Math.sqrt(Math.pow(r1 - r2, 2) + Math.pow(c1 - c2, 2));
    }

    function getNeighbors(r, c, radius) {
        const neighbors = [];
        const size = params.gridSize;
        // Optimisation: Itérer seulement dans le carré englobant le rayon
        const r_min = Math.max(0, r - Math.floor(radius));
        const r_max = Math.min(size - 1, r + Math.floor(radius));
        const c_min = Math.max(0, c - Math.floor(radius));
        const c_max = Math.min(size - 1, c + Math.floor(radius));

        for (let nr = r_min; nr <= r_max; nr++) {
            for (let nc = c_min; nc <= c_max; nc++) {
                if (nr === r && nc === c) continue; // Exclure soi-même
                const dist = calculateDistance(r, c, nr, nc);
                if (dist <= radius) {
                    // Vérifier si la cellule cible contient un individu susceptible
                    // (On le fait ici pour ne pas retourner des voisins inutiles)
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
        // Utiliser une copie pour calculer le prochain état basé sur l'état actuel
        const nextGrid = JSON.parse(JSON.stringify(grid));
        let hasInfected = false; // Pour détecter la fin de l'épidémie

        for (let r = 0; r < size; r++) {
            for (let c = 0; c < size; c++) {
                const currentCell = grid[r][c]; // Etat actuel pour la logique

                // --- Logique pour les cellules INFECTÉES ---
                if (currentCell.state === State.INFECTED) {
                    hasInfected = true; // Il reste au moins un infecté

                    // 1. Evolution de l'infecté actuel (dans nextGrid)
                    const nextCell = nextGrid[r][c]; // Modification pour l'état suivant
                    nextCell.infectionTimer++;

                    if (nextCell.infectionTimer >= params.infectionDuration) {
                        // Fin de l'infection : Mort ou Guérison/Immunité?
                        if (Math.random() < params.mortalityRate) {
                            nextCell.state = State.DEAD;
                        } else {
                            // Guérison avec chance d'immunité
                            nextCell.state = (Math.random() < params.immunityLevel) ? State.RECOVERED : State.HEALTHY;
                        }
                        nextCell.infectionTimer = 0; // Réinitialiser timer pour la nouvelle cellule
                    }

                    // 2. Propagation aux voisins Sains (basé sur l'état *actuel* `grid`)
                    const neighbors = getNeighbors(r, c, params.infectionRadius); // Ne retourne que les voisins sains
                    neighbors.forEach(neighbor => {
                        const targetCellCurrent = grid[neighbor.r][neighbor.c]; // Voisin dans l'état actuel
                        const targetCellNext = nextGrid[neighbor.r][neighbor.c]; // Voisin dans l'état suivant

                         // Vérifier si le voisin est Sain ET pas déjà infecté dans *ce tour* (précaution)
                        if (targetCellCurrent.state === State.HEALTHY && targetCellNext.state === State.HEALTHY) {
                            const distance = neighbor.distance;
                            // Probabilité d'infection diminue avec la distance (linéaire)
                            // Le rayon 0 ou 1 donne pleine proba, au max du rayon la proba est 0.
                             let infectionProbability = params.infectionRate * Math.max(0, 1 - ((distance - 1) / params.infectionRadius)); // -1 car dist 1 = pleine proba
                             // Assurer que la probabilité ne dépasse pas le taux de base
                             infectionProbability = Math.min(params.infectionRate, infectionProbability);

                             if (infectionProbability > 0 && Math.random() < infectionProbability) {
                                 targetCellNext.state = State.INFECTED;
                                 targetCellNext.infectionTimer = 0; // Démarre le timer pour le nouvel infecté
                             }
                        }
                    });
                }
                // --- Autres états (HEALTHY, RECOVERED, DEAD) ---
                // Pas d'évolution spontanée pour eux dans ce modèle simplifié (sauf guérison -> healthy si pas immunité)
            }
        }

        grid = nextGrid; // Mettre à jour la grille principale avec le nouvel état calculé
        tickCount++;

        renderGrid();
        updateStats(); // Ceci mettra à jour les compteurs ET le graphique

        // Arrêter la simulation si plus d'infectés actifs
        if (!hasInfected && isRunning) { // Vérifier isRunning pour éviter la pause si déjà en pause/reset
            pauseSimulation();
            console.log(`Simulation terminée au tick ${tickCount}: plus d'individus infectés.`);
        }
    }

    // --- Initialisation du graphique ---
    function initializeChart() {
        if (sirChart) {
            sirChart.destroy(); // Détruire l'ancien graphique si existant
            sirChart = null; // S'assurer que la référence est nulle
        }
        if(!chartCanvas) {
            console.error("Canvas element for chart not found!");
            return;
        }
        const ctx = chartCanvas.getContext('2d');
        sirChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: historyTicks, // Axe X: ticks
                datasets: [
                    {
                        label: 'Sains (S)',
                        data: historyHealthy,
                        borderColor: StateChartColors[State.HEALTHY],
                        backgroundColor: StateChartColors[State.HEALTHY] + '33', // Légère transparence
                        borderWidth: 2,
                        fill: false,
                        pointRadius: 0, // Pas de points pour alléger
                        tension: 0.1 // Ligne légèrement courbe
                    },
                    {
                        label: 'Infectés (I)',
                        data: historyInfected,
                        borderColor: StateChartColors[State.INFECTED],
                         backgroundColor: StateChartColors[State.INFECTED] + '33',
                        borderWidth: 2,
                        fill: false,
                        pointRadius: 0,
                        tension: 0.1
                    },
                    {
                        label: 'Guéris (R)',
                        data: historyRecovered,
                        borderColor: StateChartColors[State.RECOVERED],
                        backgroundColor: StateChartColors[State.RECOVERED] + '33',
                        borderWidth: 2,
                        fill: false,
                        pointRadius: 0,
                        tension: 0.1
                    },
                    {
                        label: 'Morts (D)',
                        data: historyDead,
                        borderColor: StateChartColors[State.DEAD],
                        backgroundColor: StateChartColors[State.DEAD] + '33',
                        borderWidth: 2,
                        fill: false,
                        pointRadius: 0,
                        tension: 0.1
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false, // Important pour utiliser la taille du conteneur
                animation: {
                    duration: 0 // Désactiver l'animation pour la fluidité temps réel
                },
                hover: {
                    animationDuration: 0 // Désactiver l'animation au survol
                },
                responsiveAnimationDuration: 0, // Désactiver l'animation au redimensionnement
                scales: {
                    x: {
                        title: {
                            display: true,
                            text: 'Temps (Ticks)'
                        }
                    },
                    y: {
                        title: {
                            display: true,
                            text: 'Nombre d\'individus'
                        },
                        beginAtZero: true, // Commencer l'axe Y à 0
                        min: 0 // Forcer le minimum à 0
                    }
                },
                plugins: {
                    legend: {
                        position: 'top',
                    },
                    title: {
                         display: false, // On a déjà un titre au dessus du bloc graphique
                    }
                }
            }
        });
    }

    // --- Mettre à jour les stats ET l'historique ---
    function updateStats() {
        let s = 0, i = 0, r_val = 0, d = 0, total = 0; // Renommer r en r_val
        const size = params.gridSize;
        for (let row = 0; row < size; row++) {
            for (let col = 0; col < size; col++) {
                 // Vérifier l'existence de la cellule avant d'accéder à state (sécurité)
                 if(grid[row] && grid[row][col]) {
                     const state = grid[row][col].state;
                     if(state !== State.EMPTY) total++;
                     if(state === State.HEALTHY) s++;
                     else if (state === State.INFECTED) i++;
                     else if (state === State.RECOVERED) r_val++; // Utiliser r_val
                     else if (state === State.DEAD) d++;
                 }
            }
        }
        // Mettre à jour les spans d'affichage
        tickCountSpan.textContent = tickCount;
        sainCountSpan.textContent = s;
        infecteCountSpan.textContent = i;
        gueriCountSpan.textContent = r_val; // Utiliser r_val
        mortCountSpan.textContent = d;
        totalCountSpan.textContent = total;

        // Mettre à jour l'historique et le graphique (seulement si la sim a démarré ou au reset initial)
        // En mode manuel, on ajoute le point 0 seulement au premier calcul de stats
        if(isRunning || tickCount === 0) {
             updateHistoryAndChart(tickCount, s, i, r_val, d); // Utiliser r_val
        }
    }

     // --- Fonction pour gérer l'historique et la mise à jour du graphique ---
    function updateHistoryAndChart(currentTick, s, i, r_val, d) {
        // Ajouter les nouvelles données seulement si elles ne sont pas déjà présentes pour ce tick
        // (évite doublons si updateStats est appelé plusieurs fois au tick 0)
        if (historyTicks.length === 0 || historyTicks[historyTicks.length - 1] < currentTick) {
            historyTicks.push(currentTick);
            historyHealthy.push(s);
            historyInfected.push(i);
            historyRecovered.push(r_val); // Utiliser r_val
            historyDead.push(d);

            // Limiter la taille de l'historique pour éviter les problèmes de performance
            if (historyTicks.length > MAX_HISTORY_POINTS) {
                historyTicks.shift(); // Enlever le plus ancien tick
                historyHealthy.shift();
                historyInfected.shift();
                historyRecovered.shift(); // Utiliser r_val
                historyDead.shift();
            }
        } else if (historyTicks[historyTicks.length - 1] === currentTick) {
             // Si on est sur le même tick (ex: placement manuel), mettre à jour la dernière valeur
             historyHealthy[historyHealthy.length - 1] = s;
             historyInfected[historyInfected.length - 1] = i;
             historyRecovered[historyRecovered.length - 1] = r_val; // Utiliser r_val
             historyDead[historyDead.length - 1] = d;
        }


        // Mettre à jour le graphique s'il est initialisé
        if (sirChart) {
            sirChart.data.labels = historyTicks; // Mettre à jour les labels (ticks)
            // Les données des datasets sont déjà mises à jour car ce sont des références aux arrays
            sirChart.update('none'); // Redessiner le graphique sans animation
        }
    }

    function startSimulation() {
         if (isRunning) return;

         // S'assurer que les paramètres sont à jour
         updateParameterValues();

         // Vérifier s'il y a des infectés pour démarrer
         let initialInfectedFound = false;
         for (let r = 0; r < params.gridSize; r++) {
            for (let c = 0; c < params.gridSize; c++) {
                if(grid[r] && grid[r][c] && grid[r][c].state === State.INFECTED) {
                    initialInfectedFound = true;
                    break;
                }
            }
            if(initialInfectedFound) break;
         }

         if (!initialInfectedFound && !isManualPlacementMode) {
             console.warn("Démarrage impossible: Aucun individu infecté initialement.");
             alert("Veuillez placer au moins un individu infecté (en mode manuel) ou vérifier les paramètres d'infection initiale.");
             // Optionnel: Mettre en mode manuel si pop > 0 mais infectés initiaux = 0 ?
             return; // Ne pas démarrer
         }
          if (isManualPlacementMode && totalCountSpan.textContent === '0') {
             console.warn("Démarrage impossible: Aucun individu placé en mode manuel.");
             alert("Veuillez placer des individus sur la grille avant de démarrer.");
             return; // Ne pas démarrer
         }


         // Désactiver le placement manuel si actif
         if (isManualPlacementMode) {
             gridElement.removeEventListener('click', handleManualPlacementClick);
             manualPlacementInfo.classList.add('hidden');
             // isManualPlacementMode reste true pour savoir qu'on vient de ce mode au reset
         }

        isRunning = true;
        startButton.disabled = true;
        pauseButton.disabled = false;
        resetButton.disabled = true; // Désactiver reset pendant l'exécution
        setControlsDisabled(true); // Désactiver les sliders/inputs (sauf vitesse)

        // S'assurer que le point initial (t=0) est bien dans le graphique
        updateStats();

        clearInterval(simulationInterval); // Nettoyer au cas où
        simulationInterval = setInterval(simulationStep, params.tickSpeed);
        console.log("Simulation démarrée.");
    }

    function pauseSimulation() {
        // Ne rien faire si pas en cours, sauf si simulationInterval existe (cas arrêt auto)
        if (!isRunning && !simulationInterval) return;

        isRunning = false;
        clearInterval(simulationInterval);
        simulationInterval = null; // Important de le mettre à null
        startButton.disabled = false;
        pauseButton.disabled = true;
        resetButton.disabled = false; // Réactiver reset quand en pause
        setControlsDisabled(false); // Réactiver les contrôles

        // Réactiver le listener de clic seulement si on était en mode manuel AVANT de démarrer
        if (params.manualPlacement) {
            gridElement.addEventListener('click', handleManualPlacementClick);
             manualPlacementInfo.classList.remove('hidden');
        }
        console.log("Simulation en pause.");
    }

    function resetSimulation() {
        pauseSimulation(); // Assure que tout est arrêté et les contrôles/listeners réactivés si besoin
        tickCount = 0;
        updateParameterValues(); // Lire les dernières valeurs des contrôles

        // Vider l'historique du graphique
        historyTicks = [];
        historyHealthy = [];
        historyInfected = [];
        historyRecovered = [];
        historyDead = [];

        initializeGridData(params.gridSize); // Réinitialise la structure de données grid
        createGridDOM(params.gridSize); // Recrée le DOM de la grille (et réattache le listener si manuel)

        if (params.manualPlacement) {
            isManualPlacementMode = true; // Indiquer qu'on est en mode manuel
            manualPlacementInfo.classList.remove('hidden');
            // Le listener de clic est déjà ajouté par createGridDOM si params.manualPlacement est true
            // La grille est initialement vide, l'utilisateur place les individus
        } else {
             isManualPlacementMode = false; // Pas en mode manuel
             manualPlacementInfo.classList.add('hidden');
             populateGridRandomly(params.gridSize, params.populationSize, params.initialInfected);
        }

        renderGrid(); // Afficher la grille initiale (vide ou peuplée)
        updateStats(); // Mettre à jour les compteurs ET le graphique avec l'état initial (tick 0)

        // Assurer que le graphique est prêt et affiche l'état initial (même si c'est tout à 0)
        if (sirChart) {
             sirChart.data.labels = historyTicks;
             sirChart.data.datasets[0].data = historyHealthy;
             sirChart.data.datasets[1].data = historyInfected;
             sirChart.data.datasets[2].data = historyRecovered;
             sirChart.data.datasets[3].data = historyDead;
             sirChart.update('none'); // Mettre à jour sans animation
        } else {
             initializeChart(); // Créer le graphique s'il n'existait pas
             // Rappeler updateStats pour peupler le graphique nouvellement créé si nécessaire
             updateStats();
        }

        // Réinitialiser l'état des boutons
        resetButton.disabled = false;
        startButton.disabled = false; // On peut démarrer après reset
        pauseButton.disabled = true;
        setControlsDisabled(false); // S'assurer que les contrôles sont actifs
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
        // On laisse la vitesse modifiable même pendant l'exécution pour ajuster dynamiquement
        // tickSpeedSlider.disabled = disabled;
    }


    // --- Initialisation et Écouteurs d'événements ---
    function init() {
        // Lire les valeurs initiales des contrôles HTML vers params
        updateParameterValues();

        // Lier les sliders et inputs à la mise à jour des paramètres et des spans
        infectionRadiusSlider.addEventListener('input', updateParameterValues);
        infectionRateSlider.addEventListener('input', updateParameterValues);
        infectionDurationSlider.addEventListener('input', updateParameterValues);
        mortalityRateSlider.addEventListener('input', updateParameterValues);
        immunityLevelSlider.addEventListener('input', updateParameterValues);
        tickSpeedSlider.addEventListener('input', () => {
            updateParameterValues();
            // Si la simulation tourne, ajuster l'intervalle immédiatement
            if (isRunning) {
                clearInterval(simulationInterval);
                simulationInterval = setInterval(simulationStep, params.tickSpeed);
            }
        });

        // Lier les inputs numériques (déclenchent reset implicitement via updateParameterValues + resetSimulation)
        gridSizeInput.addEventListener('change', () => { updateParameterValues(); resetSimulation(); });
        populationSizeInput.addEventListener('change', () => { updateParameterValues(); resetSimulation(); });
        initialInfectedInput.addEventListener('change', () => { updateParameterValues(); resetSimulation(); });


        // Lier les boutons
        startButton.addEventListener('click', startSimulation);
        pauseButton.addEventListener('click', pauseSimulation);
        resetButton.addEventListener('click', resetSimulation);

        // Initialiser le graphique une fois le DOM prêt
        initializeChart();

        // Configurer l'état initial (création grille, population, stats, graphique à t=0)
        resetSimulation();
    }

    // Lancer l'initialisation globale une fois le DOM chargé
    init();

});