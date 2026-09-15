# Architecture

This file is the current architectural entry point. Detailed unchanged subsystems remain documented in [`architecture-detail.md`](./architecture-detail.md). If the two files conflict, this file describes the newer state.

The active spatial/resource migration is tracked in [`FINE_GRID_RESOURCE_REWORK_PLAN.md`](./FINE_GRID_RESOURCE_REWORK_PLAN.md) and must be read before changes to map scale, terrain, resources, loose goods, movement, placement, roads, or logistics.

## Technology and boundaries

The prototype is a browser-first TypeScript application using TypeScript, Vite and Phaser 4, deployed statically through GitHub Pages.

```text
src/
  simulation/   deterministic authoritative world state and rules
  game/         Phaser rendering and map input
  ui/           DOM overlays and controls
  handbook/     player-facing Markdown help
  debug/        performance diagnostics
```

The deterministic simulation remains independent from Phaser. Presentation reads simulation state and never owns authoritative game state. The fixed simulation runs at 60 ticks/s at displayed 1×; rendering stays independent on `requestAnimationFrame`.

## Simulation entry point

`src/simulation/simulationCore.ts` is a scheduling facade around the historical core implementation in `simulationCoreEngine.ts`. UI-triggered autonomous profession changes can update cheap role state immediately while deferring expensive target/path planning until the next simulation tick.

`src/simulation/simulation.ts` is the public simulation entry point and wraps/re-exports core behavior, including the physical raw-resource compatibility layer, resource-collision synchronization, profession-experience bookkeeping and technology progression. New callers should import from `simulation.ts`.

## Fine-grid spatial model

The authoritative spatial grid uses a linear refinement factor of 5:

```text
old logical world       41 × 25 coarse cells
refinement              5× per linear axis
current simulation      205 × 125 micro-cells
```

`src/simulation/spatial.ts` owns scale conversions. Buildings and fields preserve approximately their former world-space size by expanding to many micro-cells. `src/simulation/hex.ts` uses cached lookup and heap-backed A*; `src/game/mapGeometry.ts` owns projection.

## Terrain, resources and physical goods

Terrain describes only the underlying ground. Trees, clay deposits, stone deposits and future natural resources are independent world objects. Resource footprint and movement blocking are separate properties.

Blocking resource cells are never entered just because they are explicit route targets. Routing resolves a blocking target to the quickest reachable walkable neighboring micro-cell while retaining logical target identity for interaction checks.

`World.looseGoods` is authoritative for migrated physical raw goods. Loose stacks contain one good type, 1–3 units plus reservations, never block movement, and avoid blocked terrain, buildings and active resource footprints when created.

Wood, clay and rubble use:

```text
natural source -> extractor -> loose ground stack -> pickup -> consumer/storage
```

The historical `Trip` model still uses short-lived `ground-*` resource proxies as a compatibility adapter while a physical stack is being collected. Real stock remains in `World.looseGoods`.

Trees are one-cell blocking resources with three wood. Clay and stone have finite ten-unit yields and four-cell footprints; clay is walkable, stone blocking.

## Arbeitsflaggen und lokale Arbeitsbereiche

`src/simulation/workAreas.ts` owns the authoritative local work-area rule. Eligible people carry a per-person `WorkArea { center, radius, retryAfterTick? }` in simulation state.

The first implementation applies to **woodcutters, clay diggers, stonecutters, warehouse carriers and HQ carriers**. Production-building carriers deliberately keep their existing demand-driven sourcing behavior in this stage.

The shared radius is **2.5 coarse world tiles = 12.5 micro-cells**, measured from the flag center. Because hex-cell distances are discrete, target eligibility is determined by the existing `hexDistance <= radius` rule while the rendered boundary may use the fractional radius directly.

- A newly planned natural-resource worker receives the initial flag at the first reachable resource selected by the existing planner.
- A warehouse/HQ carrier receives the initial flag at its storage workplace.
- Subsequent extractor/resource selection is restricted to matching unclaimed resources inside that person's area.
- Warehouse/HQ pickup selection is restricted to non-storage sources inside that person's area; automatic storage-to-storage transfer remains forbidden.
- A carried item may finish delivery after the flag moves; an unpicked outside source is cancelled.
- If no valid local target exists, only that person retries at the existing one-second fallback cadence. The flag never migrates automatically.

Natural-resource workers no longer need the historical global resource search when a source is exhausted or while a local area is empty. `simulationCore.ts` suppresses those legacy global planner entries and lets `syncWorkAreas()` perform the authoritative local retry. This avoids computing whole-map A* candidates that would immediately be rejected by the work-area rule.

`setWorkAreaCenter()` is the simulation command. `src/game/workAreaInteraction.ts` renders extractor flags in red and storage-carrier flags separately; it maps a short click/tap to a new center while drag continues to pan and pinch to zoom. Only player input changes an established work-area center; worker planning never moves the flag itself. `src/ui/workAreaControls.ts` exposes the command from the selected-person panel. Presentation never owns work-area state.

Wayposts are separate and not part of this implementation. A future waypost graph can constrain long-distance navigation without changing the local target eligibility represented by a flag.

## Hunger cadence and food planning

The world still advances at 60 simulation ticks/s, but hunger decay, hunger threshold checks and food-target planning are intentionally sampled only **once per simulated second**. Movement, production, transport and other 60-Hz systems remain unchanged.

`src/simulation/needs.ts` performs food search in two stages: cheap spatial lower bounds order possible bread/bush targets, then A* is evaluated only while a remaining candidate can still beat the best reachable route found so far. A selected food destination and route remain stable while travelling.

## Profession experience and technologies

Experience is persistent per person and profession from 0–100. One successfully completed professional action gives exactly +1 XP; aborted or partial actions give none. Permanent unlock rules remain authoritative in `src/simulation/technology.ts`; placement enforcement remains in `buildingPlacement.ts`.

## Event-driven person planning

Expensive autonomous target selection is event-driven. A person retains selected hunger, sleep or work destinations while travelling and normally re-evaluates at task boundaries. Hunger is checked once per simulated second. Missing work receives a per-person one-second retry deadline rather than a global re-plan.

Natural-resource depletion retirement is event-driven; there is no periodic full resource-list cleanup scan. Work-area extractors do not launch global resource A* during depletion cleanup.

## Building placement

Building legality is authoritative in `buildingPlacement.ts`. Fine-grid footprints and clearance rings must fit valid terrain, and active natural-resource footprints reserve their occupied area even when non-blocking.

## Rendering and interaction

Rendering stays decoupled from simulation ticks. `IncrementalMainScene` caches map/person state; natural resources, loose goods and work-area flags are presentation layers over authoritative state. Camera zoom is 0.7×–10× for mouse-wheel and pinch. Desktop and touch remain first-class input adapters. The iPhone 13 Mini remains the mobile baseline.

## Existing architecture

All other architecture remains as documented in [`architecture-detail.md`](./architecture-detail.md), including hunger/sleep, HQ storage compatibility, organic roads, production/inventories, construction, farms, merchants, person selection, handbook/PWA and performance diagnostics.

Where `architecture-detail.md` still describes old grid/resource semantics, directly entering blocking targets, globally roaming extractors, tick-wise hunger planning, or a building-centered storage-carrier collection radius as the current rule, this file supersedes it.

## Testing and deployment

`npm test` is the deterministic Node suite. `npm run build` performs TypeScript checking and the Vite production build. Regressions cover the one-second hunger cadence, the shared 2.5-world-tile work-area radius, initial/local work flags and storage-carrier source constraints.

Per `agents.md`, work is performed on a temporary branch and transferred to `main` as one final squash commit. The GitHub Pages workflow runs tests before the production build and deploys only after both succeed.
