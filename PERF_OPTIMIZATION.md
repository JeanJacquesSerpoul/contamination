# Plan d'Optimisation des Performances pour la Simulation de Contamination

## 1. Objectifs
- Supporter des grilles jusqu'à 1000x1000 sur desktop
- Optimiser pour les appareils mobiles (écrans < 6", processeurs limités)
- Maintenir 30 FPS sur 85% des devices mobiles
- Réduire la consommation mémoire de 50% pour les grandes grilles

## 2. Analyse de Performance Actuelle
### Points critiques :
- **Rendu DOM** : 2500 éléments pour 50x50 (25ms/frame)
- **Copie de grille** : 65ms pour 100x100
- **Voisinage** : Complexité O(n²) avec le rayon
- **Mémoire** : ~2MB pour 100x100

### Limitations mobiles :
- Rendu > 100ms/frame sur mid-range
- Crash mémoire > 300x300 sur iOS
- UX non adaptée au touch

## 3. Stratégies d'Optimisation

### 3.1 Migration vers Canvas
- **Implémentation** :
  - Création d'un système de rendu par tiles
  - Utilisation de WebGL via Three.js si disponible
  - Niveaux de détail (LOD) pour zoom
- **Avantages** :
  - Rendu 10x plus rapide
  - Support jusqu'à 1000x1000
  - Meilleure gestion GPU

### 3.2 Structure de Données Optimisée
- **TypedArrays** :
  ```javascript
  // Nouvelle structure
  const gridData = new Uint8Array(gridSize * gridSize);
  // États: 0=VIDE, 1=SAIN, 2=INFECTE, etc.
  ```
- **Mémoire** : 1 octet/cellule vs 200+ objets
- **Accès** : Indexation directe `[y * size + x]`

### 3.3 Algorithmes Performants
- **Double Buffering** :
  - Deux grilles pour éviter les copies
  - Échange à chaque tick
- **Voisinage Optimisé** :
  - Pré-calcul des offsets :
  ```javascript
  const neighborOffsets = [];
  for (let dr = -radius; dr <= radius; dr++) {
    for (let dc = -radius; dc <= radius; dc++) {
      if (dr !== 0 || dc !== 0) {
        const dist = Math.sqrt(dr*dr + dc*dc);
        if (dist <= radius) neighborOffsets.push([dr, dc]);
      }
    }
  }
  ```

### 3.4 Optimisations Mobiles
- **Responsive Design** :
  - Contrôles réorganisés pour petits écrans
  - Mode portrait/paysage
- **Performance** :
  - Détection automatique des capacités
  - Mode basse consommation (réduction FPS)
- **UX Mobile** :
  - Gestes : pincer pour zoomer, glisser pour naviguer
  - Feedback haptique pour interactions
  - Chargement progressif

## 4. Plan de Mise en Œuvre

### Phase 1 : Fondations (3 jours)
- [ ] Migration vers TypedArrays
- [ ] Implémentation du double buffering
- [ ] Benchmark mémoire/CPU

### Phase 2 : Rendu (5 jours)
- [ ] Système Canvas de base
- [ ] Optimisation WebGL
- [ ] Intégration LOD

### Phase 3 : Mobile (4 jours)
- [ ] Adaptation responsive
- [ ] Gestes tactiles
- [ ] Optimisations spécifiques iOS/Android

### Phase 4 : Tests (3 jours)
- [ ] Suite de performance
- [ ] Tests sur devices réels
- [ ] Ajustements finaux

## 5. Métriques de Succès
| Métrique | Actuel | Cible |
|----------|--------|-------|
| Taille max. grille | 100x100 | 1000x1000 |
| Mémoire (100x100) | 2MB | 0.1MB |
| FPS mobile moyen | 8 | 30 |
| Temps calcul/tick | 65ms | 15ms |

## 6. Risques et Atténuation
- **Risque** : Perte d'interactivité avec Canvas  
  *Atténuation* : Système de sélection hybride DOM/Canvas

- **Risque** : Compatibilité WebGL  
  *Atténuation* : Fallback sur Canvas 2D

- **Risque** : Performance iOS limitée  
  *Atténuation* : Optimisations spécifiques Safari