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

`src/simulation/simulationCore.ts` is now a thin scheduling facade around the historical core implementation in `simulationCoreEngine.ts`. UI-triggered autonomous profession changes can update cheap role state immediately while deferring expensive target/path planning until the next simulation tick. `src/simulation/simulation.ts` remains the public simulation entry point and wraps/re-exports core behavior, including the physical raw-resource compatibility layer, resource-collision synchronization, profession-experience bookkeeping and technology progression. New callers should import from `simulation.ts`, not directly from either core module.

## Fine-grid spatial model — Phase A complete

The authoritative spatial grid uses a linear refinement factor of 5:

```text
old logical world       41 × 25 coarse cells
refinement              5× per linear axis
current simulation      205 × 125 micro-cells
```

`src/simulation/spatial.ts` owns scale conversions. One micro-cell is one fifth of the previous world-scale path step. Buildings and fields preserve approximately their former visible/world-space size by expanding to many micro-cells. The former one-cell building clearance remains one former coarse-cell distance.

`src/simulation/hex.ts` uses a cached coordinate index and heap-backed A* for weighted routing. Avoid new per-tick full-map scans. `src/game/mapGeometry.ts` owns micro-cell → Phaser projection, so the micro-grid does not become visually dominant.

## Terrain and natural resources are separate

Terrain describes only the underlying ground. A tree, clay deposit, stone deposit or future ore/mushroom resource is a world object placed on top of terrain; the resource must not redefine the terrain type below it.

The old player-facing forest terrain is therefore no longer used by the start scenario. Current tree cells have ordinary grass underneath. This allows the same resource type to be placed on other suitable terrain later without creating a separate terrain category.

Resource footprint and collision are data-driven in `src/simulation/naturalResources.ts`. The current authoritative definitions are:

- tree: 1 micro-cell, blocking, output good `wood`,
- clay: compact 4-micro-cell footprint, non-blocking, output good `clay`,
- stone: compact 4-micro-cell footprint, blocking, output good `rubble`.

`Tile.resourceBlocking` is a derived overlay synchronized from every active blocking footprint. Depleted resources no longer contribute collision. Physical loose goods remain non-blocking.

`hex.ts` excludes blocking resource cells from normal transit. An explicitly targeted blocking resource may still be used as a route endpoint by the current extraction compatibility flow; generic routes do not pass through it. A later cleanup may introduce explicit adjacent interaction positions instead of sharing the resource anchor cell at the final interaction step.

Building placement and loose-good placement reserve the complete active resource footprint, independent of movement blocking. A non-blocking clay footprint can therefore be walked over but cannot be silently built over or used as a new loose-good drop cell.

## Physical resource model — Phases B–D complete

`src/simulation/model.ts` defines `LooseGoodStack` with a stable id, concrete micro-cell, one good type, amount 1..3 and a reservation count. `World.looseGoods` is authoritative for migrated loose goods.

Loose goods never mutate terrain or collision and are always walkable. New stack placement rejects blocked terrain, building footprints and every cell of an active natural-resource footprint. `findLooseGoodDropPosition()` searches locally and deterministically, preferring a compatible partial stack before a free cell.

`src/game/looseGoodsIndicators.ts` is presentation-only and never mutates simulation state.

Wood, clay and rubble now use the same physical flow:

```text
natural source -> extractor -> loose ground stack -> pickup -> consumer/storage
```

Each completed extraction action first appears in the historical resource output field inside the core tick, then `simulation.ts` moves whole units to `World.looseGoods` before public state is observed. This transitional field is therefore no longer player-facing storage for any currently migrated raw resource.

The current drop search radius is `GRID_REFINEMENT` = 5 micro-cells for wood, clay and rubble. Existing non-full stacks are preferred and stacks remain capped at 3 units.

The historical `Trip` model still expects building/resource ids. `simulation.ts` therefore exposes short-lived depleted `ground-*` natural-resource proxies for wood, clay and rubble stacks while a legacy pickup is planned or active. The real stock remains exclusively in `World.looseGoods`; proxies are not rendered, selectable, or blocking. Pickup/cancellation synchronizes proxy output back to the corresponding physical stack.

Extractor XP is credited only when the extracted unit is no longer stuck in transitional source output, i.e. after it has successfully reached the physical-ground flow.

## Physical wood chain — Phase C complete

Each tree is an individual `NaturalResource` with exactly **3 wood**. A completed felling action produces one physical wood unit near the tree. When a tree reaches zero remaining yield it is depleted; its underlying terrain stays unchanged and its collision overlay disappears while deposited wood remains collectible.

## Clay and stone chain — Phase D complete

Clay and stone deposits now use the same physical-stack economy as trees:

- each deposit contains the existing finite 10-unit yield,
- clay occupies four logical cells but stays walkable,
- stone occupies four logical cells and blocks all four,
- extraction produces one nearby physical `clay` or `rubble` unit per action,
- source-local output is drained into ground stacks before public state is observed,
- depleted deposits release their complete footprint/collision while already dropped goods remain,
- consumers and carriers reach the raw goods through the same ground-stack compatibility adapter used by wood.

## Resource density and presentation — Phase E complete

The start scenario expands each historical forest seed into three deterministic one-cell tree positions with deliberate gaps. Forests therefore read as clusters of many independent blocking trees without turning every micro-cell into a trunk.

Clay and stone keep their authoritative compact four-cell footprints from Phase D. Their start positions are selected by a deterministic spatial hash rather than by map scan order, producing less regular distribution around rivers and mountains without changing resource yield or collision rules.

`src/game/naturalResourceIndicators.ts` is a presentation-only overlay that renders the non-anchor cells of clay and stone footprints as separate visible pieces with small deterministic offsets. It never mutates world state. The original anchor drawing remains in `MainScene`, so the combined result represents the full four-cell source.

`src/game/looseGoodsIndicators.ts` now gives wood, clay and rubble distinct piece silhouettes. One-, two- and three-unit stacks have visibly different arrangements, while reservations are indicated presentation-only and do not affect collision.

## Bush rendering and lifecycle

Bushes remain lightweight tile metadata and non-blocking. Their logical footprint is one micro-cell, while their visual may extend beyond that cell for readability. `src/game/bushIndicators.ts` uses the shared `mapGeometry.pixel()` projection; it must not maintain a second coarse-grid pixel transform.

The detailed hunger/regrowth behavior remains documented in `architecture-detail.md`.

## Profession experience and technologies

Experience is persistent per person and profession from 0–100. One successfully completed professional action gives exactly +1 XP; aborted or partial actions give none.

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

## Event-driven person planning

Expensive autonomous target selection is event-driven. A person keeps the selected hunger, sleep or work destination while travelling and does not continuously re-evaluate alternatives. Arrival, delivery, completed production/extraction, invalidated targets and similar task boundaries trigger the next decision immediately.

Player-triggered profession assignment follows the same boundary: clicking Holzfäller, Lehmgräber, Steinbrecher or Bauarbeiter performs only cheap role/reservation state synchronously. The expensive target comparison, A* routing and builder source planning are flushed at the start of the next fixed simulation tick. This keeps the input handler free of pathfinding work while retaining deterministic simulation ordering.

If a work planner cannot find a valid task or source, only that waiting person receives a retry deadline. The one-second decision cadence is therefore a fallback for waiting persons rather than a global re-plan of all idle workers. Running movement, need decay and active production still advance on the fixed 60 Hz simulation tick.

Hunger already uses the same rule: a selected food source is trusted while travelling; if no source exists it retries after one second. Sleep likewise retains its selected destination while travelling and validates it at the destination/task boundary rather than continuously searching for a better one.

## Building placement

Building legality is authoritative in `buildingPlacement.ts`. Fine-grid footprints and clearance rings must fit valid terrain. Every cell of an active natural-resource footprint is unavailable for building or clearance even when the resource itself is non-blocking for movement.

The build-mode highlight layer computes valid anchors once on mode entry and shares the same legality with desktop and touch ghost validation.

## Rendering and interaction

Rendering stays decoupled from simulation ticks. `IncrementalMainScene` caches map state and persistent person markers. Natural resources are drawn independently from terrain; clay and stone use a supplemental resource overlay for their complete multi-cell visual footprint. Loose-goods indicators remain presentation-only and update incrementally from world state.

Person markers are intentionally smaller than before so the fine grid stays readable. Camera zoom is clamped to 0.7×–10× for both mouse-wheel and pinch input.

Desktop and touch remain separate first-class adapters with shared simulation legality:

- touch: tap chooses build ghost, drag pans, pinch zooms, DOM **Bauen** button confirms;
- desktop: ghost follows mouse, short left click confirms a valid position, Escape cancels.

The iPhone 13 Mini remains the mobile baseline.

## Existing architecture

All other current architecture remains as documented in [`architecture-detail.md`](./architecture-detail.md), including hunger/sleep, HQ storage compatibility, organic roads, production/inventories, construction, farms, merchants, person selection, handbook/PWA and performance diagnostics.

Where `architecture-detail.md` still describes forest as terrain, 10 wood per tree, clay/stone source-local output as player-facing storage, one-cell clay/stone deposits, old 41 × 25 geometry, fixed 24/21 render spacing, old Dijkstra, or forest-local output as the live wood model, this file supersedes it.

## Testing and deployment

`npm test` is the deterministic Node suite. `npm run build` performs TypeScript checking and the Vite production build.

Fine-grid/resource regression coverage verifies 205 × 125 geometry, terrain/resource separation, tree yield of 3, dense multi-tree forest clusters with walkable gaps, four-cell clay/stone footprints, tree/stone blocking versus clay non-blocking, collision removal after depletion, physical wood/clay/rubble stacks, stack capacity/reservations and the invariant that loose goods never affect routing.

Decision-cadence coverage verifies that waiting autonomous work retries at one-second intervals while arrival and delivery trigger immediate follow-up planning. Assignment regressions additionally verify that player-triggered autonomous professions do not start pathfinding inside the assignment call.

Per current project instruction, changes are made directly on `main`. The GitHub Pages workflow runs tests before the production build and deploys only after both succeed.
