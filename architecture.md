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

`src/ui/buildMenu.ts` and `src/ui/technologyTree.ts` only present this simulation-owned state. The build menu shows only currently unlocked buildings. The technology tree remains the place where locked technologies, XP progress and not-yet-implemented branches are visible. Its implemented resource chains are arranged as extractor profession → unlocked building → building worker profession → next technology, e.g. Abbauer Holz → Sägewerk → Sägewerker → Schreinerei. Disabled nodes are visually greyed out without blur so labels and requirements remain readable. UI refresh while those overlays are open is observational only and does not own progression.

The historical statement in `architecture-detail.md` that the technology tree is presentation-only is superseded by this section.

## Existing architecture

All other current architecture remains as documented in [`architecture-detail.md`](./architecture-detail.md), including:

- the 41 × 25 deterministic world and scenario configuration,
- hunger and sleep state machines,
- event-driven food/sleep target selection,
- natural-resource lifecycle,
- HQ storage adapter,
- weighted pathfinding and organic roads,
- multi-tile building placement and construction,
- inventories, production and logistics,
- farms and fields,
- person selection and inspection,
- mobile controls,
- handbook and technology-tree presentation,
- PWA/update behavior,
- performance diagnostics,
- automated tests and GitHub Pages deployment.

## Testing and deployment

`npm test` remains the deterministic Node test suite and `npm run build` performs TypeScript checking plus the Vite production build. Experience regression coverage must verify that XP is granted only at action completion and never merely for elapsed movement or work ticks. Technology regression coverage must verify the exact threshold, permanence of unlocks, correct initial player-facing state and placement rejection for locked buildings.

The deploy workflow runs test, build and GitHub Pages deployment only from `main` (or manual workflow dispatch). Changes should therefore be developed on a temporary branch and squash-merged to `main` once validated, leaving one meaningful commit per adjustment.
