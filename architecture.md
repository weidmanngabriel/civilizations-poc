# Architecture

This file is the current architectural entry point. Detailed unchanged subsystems remain documented in [`architecture-detail.md`](./architecture-detail.md). Read that file as well before substantial implementation work. If the two files conflict, this file describes the newer state.

The active spatial/resource migration is tracked in [`FINE_GRID_RESOURCE_REWORK_PLAN.md`](./FINE_GRID_RESOURCE_REWORK_PLAN.md) and must be read before changes to map scale, resources, loose goods, movement, placement, roads, or logistics.

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

`src/simulation/simulationCore.ts` contains the historical simulation tick. `src/simulation/simulation.ts` is the public simulation entry point and wraps/re-exports the core behavior, including profession-experience bookkeeping and technology progression. New callers should import from `simulation.ts`, not directly from `simulationCore.ts`.

## Profession experience and technologies

Experience is persistent per person and profession from 0–100. One successfully completed professional action gives exactly +1 XP; aborted or partial actions give none.

Current action completions:

- production worker: completed recipe cycle,
- wood/clay/stone extractor: completed extracted unit,
- carrier/merchant: successful delivery,
- farmer: completed sow/fertilize/harvest action,
- builder: completed construction work cycle.

Current permanent unlock rules at 10 XP are:

```text
carrier        -> warehouse
woodcutter     -> sawmill
sawmillWorker  -> carpenter
farmer         -> mill
miller         -> bakery
clayDigger     -> pottery
stonecutter    -> stonemason
```

`src/simulation/technology.ts` is authoritative. `buildingPlacement.ts` enforces unlocks, while UI only presents them.

## Fine-grid spatial model — Phase A complete

Phase A refined the authoritative spatial grid by a linear factor of 5:

```text
old logical world       41 × 25 coarse cells
refinement              5× per linear axis
current simulation      205 × 125 micro-cells
```

`src/simulation/spatial.ts` owns scale conversions. One micro-cell is one fifth of the previous world-scale path step. Movement, warehouse collection radius, farm radius and sleep radius are stored in micro-cell steps but scaled to preserve approximately the same player-facing distance.

Scenario terrain is mapped by nearest scaled coarse-hex centre rather than naive 5 × 5 offset blocks, preserving river/mountain/forest alignment across staggered rows.

Buildings and fields preserve approximately their former visible/world-space size by expanding to many micro-cells. The former one-cell building clearance similarly remains one former coarse-cell distance.

`src/simulation/hex.ts` uses a cached coordinate index for the stable tile array and heap-backed A* for weighted routing; step-radius checks retain BFS semantics. Avoid new per-tick full-map scans.

`src/game/mapGeometry.ts` owns micro-cell → Phaser projection. Rendering divides geometric spacing by the same refinement factor, so the visible world remains comparable and the micro-grid is not visually emphasized.

## Physical resource model — Phase B

Phase B introduces a second, future-facing physical-resource layer without yet migrating the live wood/clay/stone economy end to end.

### Natural sources

`NaturalResource` remains the source object for forest/tree, clay and stone extraction targets. Sources already have stable ids, positions and depletion state. The historical `NaturalResource.output` field is now explicitly a **compatibility field only**; new physical extraction paths are expected to deposit goods onto ground stacks instead.

The old extraction flow remains active until Phase C migrates wood end to end.

### Loose ground goods

`src/simulation/model.ts` defines `LooseGoodStack`:

```text
id        stable stack id
position  concrete micro-cell
good      exactly one Good type
amount    integer 1..3
reserved  integer 0..amount
```

`World.looseGoods` and `World.nextLooseGoodId` are optional/lazy during the compatibility period so older neutral test fixtures do not need immediate migration. `src/simulation/looseGoods.ts` initializes them deterministically when first used.

A cell may contain only one loose-good type. Compatible stacks can be filled up to exactly 3 units. A stack is removed when pickup reduces it to zero.

### Permanent walkability rule

Loose goods are **never obstacles**. They do not mutate tile terrain, do not participate in collision, do not change movement cost, and are never read by pathfinding. People can always walk over a loose stack.

Placement validity is separate from walkability: a *new* stack is not created on river/mountain terrain, a building footprint, or the position of an active natural-resource source. This restriction only controls where goods may be deposited; once present, a stack never blocks movement.

### Reservations and pickup

Reservations are concrete stack quantities. `availableLooseGoodAmount()` is `amount - reserved`. Reserving goods leaves them physically present until pickup. `pickupReservedLooseGood()` consumes both reservation and physical amount; zero amount removes the stack.

This is deliberately independent from the legacy `Trip` source model until Phase C connects wood logistics to stack ids.

### Deterministic drop search

`findLooseGoodDropPosition()` receives origin, good and an explicit maximum radius. The radius is intentionally supplied by the caller because its gameplay value belongs to Phase C.

Selection order:

1. nearest compatible non-full stack of the same good within radius,
2. otherwise nearest valid empty cell,
3. deterministic tie-break by axial coordinates / stable id.

Empty-cell search expands locally by hex rings/BFS and uses the indexed tile map rather than scanning the entire 205 × 125 map.

### Rendering

`src/game/looseGoodsIndicators.ts` is a presentation-only Phaser overlay installed from `src/main.ts`. It reads `World.looseGoods`, renders 1/2/3 physical units as distinct markers, updates only changed stack visuals, and never mutates simulation state.

Visual/resource-density polish remains Phase E; Phase B only establishes readable functional stack rendering.

## Cross-platform interaction model

Desktop and touch remain separate first-class adapters with shared simulation legality.

- touch: tap chooses build ghost, drag pans, pinch zooms, DOM **Bauen** button confirms;
- desktop: ghost follows mouse, short left click confirms a valid position, Escape cancels.

Both use `buildingPlacement.ts` for legality.

## Existing architecture

All other current architecture remains as documented in [`architecture-detail.md`](./architecture-detail.md), including hunger/sleep, bushes, HQ storage compatibility adapter, organic roads, production/inventories, construction, farms, merchants, person selection, mobile controls, handbook/PWA and performance diagnostics.

Where `architecture-detail.md` still says 41 × 25, fixed 24/21 render spacing, old Dijkstra, or natural-resource output as the intended long-term physical model, the newer Phase-A/Phase-B sections above supersede it.

## Testing and deployment

`npm test` is the deterministic Node suite. `npm run build` performs TypeScript checking and the Vite production build.

Fine-grid tests cover the 5× refinement, 205 × 125 map, scaled distances, footprints and resource alignment. Physical-resource tests cover stack capacity, one-good-per-cell behavior, reservation safety, zero-stack removal, deterministic drop choice and the invariant that loose goods never alter pathfinding.

Per current project instruction, changes are made directly on `main` so they can be inspected live. The GitHub Pages workflow is the safety gate: it runs `npm test` before `npm run build`, and deployment runs only after that build job succeeds. No green tests/build means no deployment.
