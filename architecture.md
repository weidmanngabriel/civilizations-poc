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

`src/simulation/simulationCore.ts` contains the historical simulation tick. `src/simulation/simulation.ts` is the public simulation entry point and wraps/re-exports the core behavior, including the physical-wood compatibility layer, profession-experience bookkeeping and technology progression. New callers should import from `simulation.ts`, not directly from `simulationCore.ts`.

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

## Physical resource model — Phase B complete

### Natural sources

`NaturalResource` remains the source object for forest/tree, clay and stone extraction targets. Sources have stable ids, positions and depletion state. `NaturalResource.output` is now a compatibility field only for resource types that have not yet completed their physical-resource migration.

### Loose ground goods

`src/simulation/model.ts` defines `LooseGoodStack`:

```text
id        stable stack id
position  concrete micro-cell
good      exactly one Good type
amount    integer 1..3
reserved  integer 0..amount
```

`World.looseGoods` and `World.nextLooseGoodId` are initialized lazily and deterministically by `src/simulation/looseGoods.ts`.

A cell may contain only one loose-good type. Compatible stacks can be filled up to exactly 3 units. A stack is removed when pickup reduces it to zero.

### Permanent walkability rule

Loose goods are **never obstacles**. They do not mutate tile terrain, do not participate in collision, do not change movement cost, and are never read by pathfinding. People can always walk over a loose stack.

Placement validity is separate from walkability: a new stack is not created on river/mountain terrain, a building footprint, or the position of an active natural-resource source. This restriction only controls where goods may be deposited; once present, a stack never blocks movement.

### Reservations and deterministic drop search

Reservations are concrete stack quantities. `availableLooseGoodAmount()` is `amount - reserved`. Reserving goods leaves them physically present until pickup. Empty stacks disappear.

`findLooseGoodDropPosition()` receives origin, good and an explicit maximum radius. Selection order is:

1. nearest compatible non-full stack of the same good within radius,
2. otherwise nearest valid empty cell,
3. deterministic tie-break by axial coordinates / stable id.

Empty-cell search expands locally by hex rings/BFS and uses the indexed tile map rather than scanning the entire 205 × 125 map.

### Rendering

`src/game/looseGoodsIndicators.ts` is a presentation-only Phaser overlay installed from `src/main.ts`. It reads `World.looseGoods`, renders 1/2/3 physical units as distinct markers, updates only changed stack visuals, and never mutates simulation state.

## Physical wood chain — Phase C complete

Wood is the first resource migrated end to end.

### Extraction

Real forest/tree `NaturalResource` objects remain the extraction targets. When a woodcutter completes one extraction cycle, the historical core temporarily increments the tree's compatibility `output`; the public `simulation.ts` wrapper immediately converts every whole wood unit into `World.looseGoods` and returns tree output to zero before the world is externally observed again.

Wood drop search uses `GRID_REFINEMENT` = **5 micro-cells**, equivalent to one former coarse-grid step. Existing non-full wood stacks are preferred; otherwise the closest legal empty cell is used. A full 3-unit stack does not block further felling if another valid drop cell exists.

Tree depletion still uses the existing natural-resource lifecycle: remaining yield reaches zero, the tree becomes depleted, its terrain returns to grass, and the woodcutter retargets. Already deposited wood remains independent and collectible.

### Transport adapter

The historical `Trip` model only understands building ids and natural-resource ids. Rewriting all transport, hunger interruption, cancellation, warehouse collection and production-input logic in Phase C would unnecessarily widen the migration.

Therefore `simulation.ts` creates short-lived **depleted synthetic natural-resource proxies** for physical wood stacks while the historical transport planner/pickup code is running:

- proxy id equals the physical stack id (`ground-*`),
- proxy position equals the stack position,
- proxy output mirrors the stack amount only inside the compatibility boundary,
- proxy is depleted, so extractors never target it,
- presentation ignores it,
- `World.looseGoods` remains the authoritative stock,
- after each core tick proxy changes are synchronized back to stacks,
- unused proxies are removed,
- an in-flight proxy may persist only so cancellation can restore carried cargo to the same physical ground source.

Reservations on physical stacks are recomputed from active unpicked trips. This prevents two workers/carriers from planning the same unit. Pickup removes a unit from the stack; cancelling a carried trip restores it to physical ground storage on the next public simulation tick.

This adapter is deliberately transitional. Phase F should review replacing `Trip.source` with a generic explicit source reference once clay/stone are also physical.

### Consumers

Sawmill workers, sawmill carriers and HQ carriers can collect wood from physical ground stacks through the shared transport rules. Warehouse inventory and sawmill input remain ordinary building inventory/input state.

Clay and stone are intentionally unchanged until Phase D and still use resource-local compatibility output.

## Build-mode highlighting

The fine grid made per-frame global placement highlighting too expensive, but removing it made build mode unreadable. `src/game/buildPlacementHighlights.ts` therefore computes `validBuildingAnchors()` once when a building type enters build mode and renders a presentation-only bright overlay above the map dim layer. The live ghost remains above that layer and still uses `canPlaceBuilding()` for authoritative green/red validation.

Layer order is dim overlay → valid-area highlight → live ghost. Desktop and touch use the same validity data.

## Performance FPS sampling

`src/debug/performanceProfiler.ts` calculates FPS from animation-frame timestamps. `src/main.ts` owns a continuous `requestAnimationFrame` sampler calling `performanceProfiler.recordAnimationFrame()`. This sampler is independent from `renderWorld()` coalescing, so the debug screen reports actual browser frame cadence even when world presentation does not need to rebuild on every frame.

## Cross-platform interaction model

Desktop and touch remain separate first-class adapters with shared simulation legality.

- touch: tap chooses build ghost, drag pans, pinch zooms, DOM **Bauen** button confirms;
- desktop: ghost follows mouse, short left click confirms a valid position, Escape cancels.

Both use `buildingPlacement.ts` for legality.

## Existing architecture

All other current architecture remains as documented in [`architecture-detail.md`](./architecture-detail.md), including hunger/sleep, bushes, HQ storage compatibility adapter, organic roads, production/inventories, construction, farms, merchants, person selection, mobile controls, handbook/PWA and performance diagnostics.

Where `architecture-detail.md` still says 41 × 25, fixed 24/21 render spacing, old Dijkstra, forest-local output as the live wood model, or omits the Phase-C wood-stack transport adapter, the newer Phase-A/B/C sections above supersede it.

## Testing and deployment

`npm test` is the deterministic Node suite. `npm run build` performs TypeScript checking and the Vite production build.

Fine-grid tests cover the 5× refinement, 205 × 125 map, scaled distances, footprints and resource alignment. Physical-resource tests cover stack capacity, one-good-per-cell behavior, reservation safety, zero-stack removal, deterministic drop choice and the invariant that loose goods never alter pathfinding. `physical-wood-chain.test.ts` verifies extraction → physical stack → sawmill pickup and delivery, while former forest-output tests now assert ground-stack behavior.

Per current project instruction, changes are made directly on `main` so they can be inspected live. The GitHub Pages workflow is the safety gate: it runs `npm test` before `npm run build`, and deployment runs only after that build job succeeds. No green tests/build means no deployment.
