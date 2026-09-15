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

`src/simulation/simulationCore.ts` contains the historical simulation tick. `src/simulation/simulation.ts` is the public simulation entry point and wraps/re-exports the core behavior, including the physical-wood compatibility layer, resource-collision synchronization, profession-experience bookkeeping and technology progression. New callers should import from `simulation.ts`, not directly from `simulationCore.ts`.

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

Collision is also independent from terrain. `Tile.resourceBlocking` is a derived spatial overlay synchronized from active natural resources by `simulation.ts`:

- trees block movement on their one micro-cell,
- stone currently blocks movement on its resource cell,
- clay remains non-blocking,
- depleted resources no longer contribute collision,
- physical loose goods remain non-blocking.

`hex.ts` excludes blocking resource cells from normal transit. An explicitly targeted blocking resource may still be used as a route endpoint by the current extraction compatibility flow; generic routes do not pass through it. A later cleanup may introduce explicit adjacent interaction positions instead of sharing the resource cell at the final interaction step.

The intended resource-footprint rules for the next migration are data-oriented rather than terrain-oriented: tree 1 cell/blocking, clay about 4 cells/non-blocking, stone and ore about 4 cells/blocking, mushrooms 1 cell/non-blocking. Phase D will finalize multi-cell clay/stone footprints while migrating their output to physical ground stacks.

## Physical resource model — Phase B complete

`src/simulation/model.ts` defines `LooseGoodStack` with a stable id, concrete micro-cell, one good type, amount 1..3 and a reservation count. `World.looseGoods` is authoritative for migrated loose goods.

Loose goods never mutate terrain or collision and are always walkable. New stack placement still rejects blocked terrain, building footprints and active natural-resource source cells. `findLooseGoodDropPosition()` searches locally and deterministically, preferring a compatible partial stack before a free cell.

`src/game/looseGoodsIndicators.ts` is presentation-only and never mutates simulation state.

## Physical wood chain — Phase C complete

Wood is the first resource migrated end to end. Each tree is an individual `NaturalResource`. A tree now contains exactly **3 wood**. A completed felling action produces one physical wood unit, which is moved from the transitional resource output into `World.looseGoods` before the public world state is observed.

Wood drop search uses `GRID_REFINEMENT` = 5 micro-cells, equivalent to one former coarse-grid step. Existing non-full stacks are preferred and stacks remain capped at 3 units.

Sawmill workers, sawmill carriers and HQ carriers source wood from physical ground stacks through the existing transport compatibility adapter. The short-lived depleted `ground-*` natural-resource proxies exist only because the historical `Trip` model still expects building/resource ids. They are not rendered or selectable and do not contribute resource collision.

When a tree reaches zero remaining yield it is depleted. Its underlying terrain stays unchanged and its collision overlay disappears; already deposited wood remains collectible.

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

## Building placement

Building legality is authoritative in `buildingPlacement.ts`. Fine-grid footprints and clearance rings must fit valid terrain. Active natural-resource cells are not valid building or clearance cells even when the ground underneath is grass. This is separate from movement blocking: a non-blocking clay resource can still reserve physical space against construction.

The build-mode highlight layer computes valid anchors once on mode entry and shares the same legality with desktop and touch ghost validation.

## Rendering and interaction

Rendering stays decoupled from simulation ticks. `IncrementalMainScene` caches map state and persistent person markers. Natural resources are drawn as overlays at their resource positions; terrain is drawn independently beneath them.

Desktop and touch remain separate first-class adapters with shared simulation legality:

- touch: tap chooses build ghost, drag pans, pinch zooms, DOM **Bauen** button confirms;
- desktop: ghost follows mouse, short left click confirms a valid position, Escape cancels.

The iPhone 13 Mini remains the mobile baseline.

## Existing architecture

All other current architecture remains as documented in [`architecture-detail.md`](./architecture-detail.md), including hunger/sleep, HQ storage compatibility, organic roads, production/inventories, construction, farms, merchants, person selection, handbook/PWA and performance diagnostics.

Where `architecture-detail.md` still describes forest as terrain, 10 wood per tree, old 41 × 25 geometry, fixed 24/21 render spacing, old Dijkstra, or forest-local output as the live wood model, this file supersedes it.

## Testing and deployment

`npm test` is the deterministic Node suite. `npm run build` performs TypeScript checking and the Vite production build.

Fine-grid/resource regression coverage must verify at least: 205 × 125 geometry, terrain/resource separation, tree yield of 3, tree/stone blocking versus clay non-blocking, collision removal after depletion, physical wood stacks, stack capacity/reservations and the invariant that loose goods never affect routing.

Per current project instruction, changes are made directly on `main`. The GitHub Pages workflow runs tests before the production build and deploys only after both succeed.
