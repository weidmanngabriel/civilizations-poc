# Architecture

This file is the current architectural entry point. The previous detailed reference is preserved in [`architecture-detail.md`](./architecture-detail.md) and remains authoritative for unchanged subsystems. Read that file as well before substantial implementation work. If the two files conflict, this file describes the newer state.

## Technology and boundaries

The prototype is a browser-first TypeScript application using TypeScript, Vite and Phaser 4 and is deployed statically through GitHub Pages. The deterministic simulation remains independent from Phaser. Presentation reads simulation state and must not invent authoritative state.

```text
src/
  simulation/   deterministic world state and rules
  game/         Phaser rendering and map input
  ui/           DOM overlays and controls
  handbook/     player-facing Markdown help
  debug/        performance diagnostics
```

The fixed simulation still runs at 60 ticks per displayed real-time second at 1×. Rendering remains decoupled through `requestAnimationFrame`.

## Simulation core wrapper

The historical implementation of the simulation tick now lives in `src/simulation/simulationCore.ts`. `src/simulation/simulation.ts` is the public simulation entry point and re-exports the existing API while wrapping `tick()` with cross-cutting profession-experience bookkeeping.

This split keeps the existing economy, logistics, pathfinding, needs integration and production behavior unchanged while moving XP progression from elapsed work time to completed actions. New code should continue to import from `src/simulation/simulation.ts`, not directly from `simulationCore.ts`.

`src/simulation/experience.ts` owns XP values, profession labels and profession multipliers. Its old `gainProfessionExperience()` entry point is retained only as a compatibility no-op because the legacy core still calls it every work tick. Actual XP is granted through `awardProfessionExperience()` by the public simulation wrapper after it observes a completed action.

## Profession experience

Experience remains persistent per person and profession from 0 to 100. The progression rule is discrete:

```text
1 successfully completed professional action = +1 XP
100 completed actions = 100 XP
XP is capped at 100
aborted / incomplete actions = 0 XP
```

Completion detection is profession-specific:

- production worker: one finished production recipe cycle,
- wood / clay / stone extractor: one extracted resource unit,
- carrier / merchant: one successfully delivered transport trip,
- farmer: one successfully completed sow, fertilize or harvest task,
- builder: one completed construction work cycle of `CONFIG.duration` active construction ticks.

The simulation keeps the existing internal profession ids `woodcutter`, `clayDigger` and `stonecutter`; player-facing UI consistently labels them **Abbauer Holz**, **Abbauer Lehm** and **Abbauer Stein**. This avoids unnecessary simulation migration while presenting one coherent extractor profession family.

Builders keep transient per-profession action progress in `Person.experienceActionProgress`. That state is part of the simulation model so interruptions do not accidentally erase partial progress and save/load can preserve it later.

Profession effects are unchanged: normal production and builders scale up to 2× contribution/output, while extractors, carriers and merchants scale movement/work speed up to 1.5× without increasing carry capacity or raw-resource yield per action.

## Technology progression

`src/simulation/technology.ts` is the single source of truth for current technology unlock rules. Each implemented rule is data describing a target building technology, its source profession and the XP threshold. The current threshold is 10 XP for all implemented rules, but the rule shape intentionally carries the threshold per entry so future professions or technologies can differ without new unlock code.

The player-facing `World` stores permanent unlocks in `unlockedTechnologies`. `createDefaultGameWorld()` starts with only house, farm and well unlocked. Neutral `createWorld()` scenarios intentionally omit this field; absence means unrestricted sandbox/test behavior so low-level simulation tests do not need to reproduce player progression.

After profession XP is awarded, the public `tick()` calls `updateTechnologyUnlocks()`. The function scans the configured rules, uses the highest XP held by any current person in the relevant profession, and appends newly satisfied technologies to the permanent world list. Once written, an unlock is never removed even if the person who triggered it later changes profession or leaves the world.

Current rules are:

```text
carrier        10 XP -> warehouse
woodcutter     10 XP -> sawmill
sawmillWorker  10 XP -> carpenter
farmer         10 XP -> mill
miller         10 XP -> bakery
clayDigger     10 XP -> pottery
stonecutter    10 XP -> stonemason
```

`src/simulation/buildingPlacement.ts` enforces the same state in `canPlaceBuilding()`, `validBuildingAnchors()` and therefore `buildWithFootprint()`. Locked technologies expose no valid anchors and cannot be built even if another UI path attempts placement.

`src/ui/buildMenu.ts` and `src/ui/technologyTree.ts` only present this simulation-owned state. The build menu shows only currently unlocked buildings. The technology tree remains the place where locked technologies, XP progress and not-yet-implemented branches are visible. Its implemented resource chains follow the real progression order, e.g. Abbauer Holz → Sägewerk → Sägewerker → Schreinerei. `src/ui/technologyTreeLayout.ts` gives those chains dedicated horizontal lanes and recomputes connector geometry after the tree mounts so unrelated branches overlap less. Disabled nodes are visually greyed out without blur so labels and requirements remain readable. UI refresh while those overlays are open is observational only and does not own progression.

The historical statement in `architecture-detail.md` that the technology tree is presentation-only is superseded by this section.

## Fine-grid spatial model — Phase A

The active rework is tracked in [`FINE_GRID_RESOURCE_REWORK_PLAN.md`](./FINE_GRID_RESOURCE_REWORK_PLAN.md). Phase A refines the simulation grid by a linear factor of **5** while deliberately preserving the previous world scale in screen space and gameplay distances.

`src/simulation/spatial.ts` is the authoritative conversion layer:

```text
old logical world       41 × 25 coarse cells
refinement              5× per linear axis
current simulation      205 × 125 micro-cells
```

A micro-cell is therefore one fifth of the previous pathfinding step in world-scale terms. `CONFIG.movementPerTick`, warehouse collection radius, farm field radius and sleep search radius are expressed in micro-cell steps but scaled so the former physical distances remain approximately unchanged. Gameplay durations and the 60 Hz simulation cadence do not change.

Scenario terrain is not mapped back through naive 5 × 5 offset blocks. Hex rows are staggered, so each micro-cell is assigned the terrain of the nearest scaled coarse hex centre. This keeps rivers, mountains, forests and legacy resource positions spatially aligned.

Buildings keep approximately their former visible size by expanding each old footprint cell into a micro-cell region. The former one-cell clearance is likewise expanded to one former coarse-cell distance. Farm fields also occupy a micro-cell region rather than shrinking to a single tiny cell. Resource economy is intentionally still the legacy `NaturalResource.remaining/output` model during Phase A; individual resource objects and loose ground stacks belong to later phases.

`src/simulation/hex.ts` maintains a cached coordinate index for the stable `World.tiles` array and uses heap-backed A* for weighted routing. This replaces repeated full-array tile lookup and the former linear-open-list Dijkstra implementation, which would scale poorly at ~25,000 cells. `findPathBySteps()` retains BFS semantics for true step-radius checks.

`src/game/mapGeometry.ts` centralizes simulation-cell → Phaser world-coordinate projection. Cell spacing and hex radius are divided by the same refinement factor, keeping the visible map footprint close to the former size. Pointer hit-testing inverts the projection and checks only nearby coordinates instead of scanning all tiles. The micro-grid is not normally outlined, so terrain still reads as a continuous surface.

Building placement remains simulation-authoritative. On the fine grid, build mode validates the current ghost location directly rather than rendering every valid micro-cell anchor across the whole map; this avoids both visual grid noise and a large per-hover render cost. Desktop and touch continue to use their existing input-specific confirmation flows.

People remain continuous world-space markers independent from micro-cell size. Their marker, label and selection ring are slightly larger than before so residents remain readable against buildings and the denser spatial model.

This section supersedes the old 41 × 25 map, single-cell farm-field size, fixed 24/21 render spacing and old pathfinder descriptions in `architecture-detail.md`.

## Cross-platform interaction model

Desktop and touch are treated as two first-class input modes. Any player-facing interaction change must be checked in both directions: mobile work must not regress desktop behavior, and desktop work must not regress touch behavior. The interaction details may differ when that better matches the input device, but simulation rules and validation stay shared.

Building placement currently uses that split explicitly:

- touch keeps the existing map gesture model: a short tap chooses the build ghost position, dragging pans the map, and the DOM **Bauen** button confirms;
- desktop uses `src/game/desktopBuildPlacement.ts`: the ghost follows the mouse immediately while build mode is active, a short left click confirms a valid position, and Escape cancels;
- both paths still feed the same placement position state and `buildWithFootprint()` validation, so input adapters never own building legality.

The older touch-only placement wording in `architecture-detail.md` is superseded by this section. `src/game/mobileTouch.ts` remains the touch-specific map adapter; desktop-specific placement behavior should stay separate rather than being folded into mobile gesture code.

## Existing architecture

All other current architecture remains as documented in [`architecture-detail.md`](./architecture-detail.md), including:

- hunger and sleep state machines,
- event-driven food/sleep target selection,
- the temporary legacy natural-resource lifecycle until the physical-resource phases replace it,
- HQ storage adapter,
- organic roads,
- inventories, production and logistics,
- person selection and inspection,
- mobile controls,
- handbook and technology-tree presentation,
- PWA/update behavior,
- performance diagnostics,
- automated tests and GitHub Pages deployment.

## Testing and deployment

`npm test` remains the deterministic Node test suite and `npm run build` performs TypeScript checking plus the Vite production build. Experience regression coverage must verify that XP is granted only at action completion and never merely for elapsed movement or work ticks. Technology regression coverage must verify the exact threshold, permanence of unlocks, correct initial player-facing state and placement rejection for locked buildings.

Fine-grid regression coverage verifies the exact refinement factor, 205 × 125 tile count, preserved world-scale movement/radius semantics, expanded building footprints and spatial alignment of legacy natural-resource nodes.

Player-facing interaction changes must also be reviewed against both desktop mouse/keyboard and touch behavior, even when only one input mode motivated the change.

The deploy workflow runs test, build and GitHub Pages deployment only from `main` (or manual workflow dispatch). Changes should therefore be developed on a temporary branch and squash-merged to `main` once validated, leaving one meaningful commit per adjustment.
