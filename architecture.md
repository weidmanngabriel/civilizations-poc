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

`src/simulation/spatial.ts` owns scale conversions. Buildings and fields preserve approximately their former world-space size by expanding to many micro-cells. The former one-cell building clearance remains one former coarse-cell distance.

`src/simulation/hex.ts` uses a cached coordinate index and heap-backed A* for weighted routing. Avoid new per-tick full-map scans. `src/game/mapGeometry.ts` owns micro-cell → Phaser projection, so the micro-grid remains a simulation mechanism rather than a visual board.

## Terrain and natural resources

Terrain describes only the underlying ground. Trees, clay deposits, stone deposits and future natural resources are independent world objects placed on top of terrain.

Resource footprint and collision are data-driven in `src/simulation/naturalResources.ts`:

- tree: 1 micro-cell, blocking, output good `wood`,
- clay: compact 4-micro-cell footprint, non-blocking, output good `clay`,
- stone: compact 4-micro-cell footprint, blocking, output good `rubble`.

`Tile.resourceBlocking` is a derived overlay synchronized from active blocking footprints. Depleted resources no longer contribute collision. Physical loose goods remain non-blocking.

Building placement and loose-good placement reserve the complete active resource footprint independently from movement blocking. A clay footprint can therefore be walked over but cannot be silently built over or used for a new loose-good stack.

### Explicit interaction cells for blocking targets

Blocking resource cells are never entered simply because they are the explicit endpoint of a route. `src/simulation/hex.ts` resolves a blocking route target to the quickest reachable walkable neighboring micro-cell. Weighted A* and step-count routing share this rule.

The chosen arrival coordinate carries an internal, non-serialized logical target marker, allowing existing simulation checks such as “person is at resource” to succeed while the person's physical coordinates remain on walkable ground. This keeps interaction-position handling below the economy/task layer.

## Physical resource model

`src/simulation/model.ts` defines `LooseGoodStack` with a stable id, concrete micro-cell, one good type, amount 1..3 and a reservation count. `World.looseGoods` is authoritative for migrated loose goods.

Loose goods never mutate terrain or collision and are always walkable. New stack placement rejects blocked terrain, building footprints and active natural-resource footprints. `findLooseGoodDropPosition()` searches locally and deterministically, preferring a compatible partial stack before a free cell.

Wood, clay and rubble use the same physical flow:

```text
natural source -> extractor -> loose ground stack -> pickup -> consumer/storage
```

Each completed extraction action first appears in the historical resource output field inside the core tick, then `simulation.ts` moves whole units to `World.looseGoods` before public state is observed. The current drop search radius is `GRID_REFINEMENT` = 5 micro-cells and stacks remain capped at 3 units.

The historical `Trip` model still expects building/resource ids. `simulation.ts` exposes short-lived depleted `ground-*` natural-resource proxies for raw stacks while a legacy pickup is planned or active. Real stock remains exclusively in `World.looseGoods`; proxies are not rendered, selectable, or blocking.

## Resource specifics

Each tree is an individual `NaturalResource` with exactly **3 wood**. A completed felling action produces one physical wood unit near the tree. When the tree is depleted, its underlying terrain stays unchanged and its collision disappears while deposited wood remains collectible.

Clay and stone deposits retain the finite 10-unit yield. Clay occupies four logical cells but stays walkable. Stone occupies four logical cells and blocks all four. Extraction produces nearby physical `clay` or `rubble` units.

The start scenario expands each historical forest seed into three deterministic one-cell tree positions with deliberate gaps. Clay and stone keep fixed authoritative four-cell footprints while their presentation can be visually irregular.

## Arbeitsflaggen und lokale Arbeitsbereiche

`src/simulation/workAreas.ts` owns the authoritative local work-area rule. Eligible people carry a per-person `WorkArea { center, radius, retryAfterTick? }` in simulation state. The first implementation applies to woodcutters, clay diggers, stonecutters and every person assigned as a carrier.

The current radius is **5 coarse world tiles = 25 micro-cells**. This is measured from the flag center, not from the person's current position.

- A newly planned natural-resource worker receives the initial flag at the first reachable resource selected by the existing planner.
- A newly assigned carrier receives the initial flag at its workplace.
- Subsequent extractor/resource selection is restricted to unclaimed matching resources inside that person's area.
- Carrier pickup source selection is restricted to sources inside that person's area. Normal storage carriers still do not move goods automatically from storage to storage.
- A carried item may finish its delivery after the flag is moved; an unpicked source outside the new area is cancelled.
- If no valid local target exists, only that person retries at the existing one-second fallback cadence. The flag does not migrate automatically.

`simulationCore.ts` invokes `syncWorkAreas()` around the historical tick so legacy planners cannot make an out-of-area target authoritative for the next movement step. This is intentionally a compatibility layer rather than a rewrite of `Trip` or the historical planner during Phase F.

`setWorkAreaCenter()` is the simulation command used by presentation. `src/game/workAreaInteraction.ts` renders the flags and the active radius, and converts a short desktop click or touch tap into a flag move. Dragging continues to pan and pinch continues to zoom. `src/ui/workAreaControls.ts` exposes the command from the selected-person panel. Presentation never owns the work-area state.

Wayposts are deliberately separate and are not part of this implementation. A future waypost graph can constrain long-distance navigation without changing the local question answered by a work flag: which targets may this worker use?

## Bushes

Bushes remain lightweight tile metadata and non-blocking. Their logical footprint is one micro-cell, while their visual may extend beyond that cell. `src/game/bushIndicators.ts` uses the shared `mapGeometry.pixel()` projection. Detailed hunger/regrowth behavior remains documented in `architecture-detail.md`.

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

Player-triggered profession assignment performs cheap role state synchronously. Expensive target comparison and A* routing are flushed at the start of the next fixed simulation tick.

If a planner cannot find a valid task or source, only that waiting person receives a retry deadline. The one-second cadence is a fallback rather than a global re-plan. Movement, need decay and active production still advance at 60 Hz.

Natural-resource depletion cleanup is event-driven: an extraction that reaches zero retires that concrete resource immediately. There is no periodic full resource-list consistency scan.

## Building placement

Building legality is authoritative in `buildingPlacement.ts`. Fine-grid footprints and clearance rings must fit valid terrain. Every cell of an active natural-resource footprint is unavailable for building or clearance even when the resource is non-blocking for movement.

The build-mode highlight layer computes valid anchors once on mode entry and shares the same legality with desktop and touch ghost validation.

## Rendering and interaction

Rendering stays decoupled from simulation ticks. `IncrementalMainScene` caches map state and persistent person markers. Natural resources, loose goods and work-area flags are presentation layers over authoritative simulation state.

Person markers remain larger than micro-cells but intentionally compact. Camera zoom is clamped to 0.7×–10× for mouse-wheel and pinch input. Desktop and touch remain separate first-class adapters with shared simulation legality.

The iPhone 13 Mini remains the mobile baseline.

## Existing architecture

All other architecture remains as documented in [`architecture-detail.md`](./architecture-detail.md), including hunger/sleep, HQ storage compatibility, organic roads, production/inventories, construction, farms, merchants, person selection, handbook/PWA and performance diagnostics.

Where `architecture-detail.md` still describes forest as terrain, 10 wood per tree, clay/stone source-local output as player-facing storage, one-cell clay/stone deposits, old 41 × 25 geometry, fixed 24/21 render spacing, old Dijkstra, targeted blocking resources as directly enterable endpoints, globally roaming extractors, or a building-centered fixed carrier collection radius as the current rule, this file supersedes it.

## Testing and deployment

`npm test` is the deterministic Node suite. `npm run build` performs TypeScript checking and the Vite production build.

Fine-grid/resource regression coverage verifies geometry, terrain/resource separation, resource footprints/collision, physical ground stacks, reservations and blocked-target interaction positions. Work-area regression coverage verifies initial flags, local extractor retargeting and carrier source constraints.

Per `agents.md`, work is performed on a temporary branch and transferred to `main` as one final squash commit. The GitHub Pages workflow runs tests before the production build and deploys only after both succeed.
