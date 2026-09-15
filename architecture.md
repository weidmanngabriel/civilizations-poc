# Architecture

This file is the current architectural entry point. Detailed unchanged subsystems remain documented in [`architecture-detail.md`](./architecture-detail.md). If the two files conflict, this file describes the newer state.

The completed fine-grid/resource migration is recorded in [`FINE_GRID_RESOURCE_REWORK_PLAN.md`](./FINE_GRID_RESOURCE_REWORK_PLAN.md). It remains a reference for changes to map scale, terrain, resources, loose goods, movement, placement, roads or logistics.

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

`src/simulation/simulationCore.ts` is a scheduling/work-area facade around the historical core implementation in `simulationCoreEngine.ts`. UI-triggered autonomous profession changes can update cheap role state immediately while deferring expensive target/path planning until the next simulation tick.

`src/simulation/simulation.ts` is the public simulation entry point and wraps/re-exports core behavior, including resource-collision synchronization, conversion of completed extraction output into physical ground stacks, profession-experience bookkeeping and technology progression. New callers should import from `simulation.ts`.

There is no longer a fake `hq-storage-proxy` building and no fake natural-resource mirror for loose goods.

## Fine-grid spatial model

The authoritative spatial grid uses a linear refinement factor of 5:

```text
old logical world       41 × 25 coarse cells
refinement              5× per linear axis
current simulation      205 × 125 micro-cells
```

`src/simulation/spatial.ts` owns scale conversions. Buildings and fields preserve approximately their former world-space size by expanding to many micro-cells. `src/simulation/hex.ts` uses cached coordinate lookup and heap-backed A*; `src/game/mapGeometry.ts` owns projection.

## Terrain, resources and physical goods

Terrain describes only the underlying ground. Trees, clay deposits, stone deposits and future natural resources are independent world objects. Resource footprint and movement blocking are separate properties.

Blocking resource cells are never entered just because they are explicit route targets. Routing resolves a blocking target to the quickest reachable walkable neighboring micro-cell while retaining logical target identity for interaction checks.

`World.looseGoods` is authoritative for migrated physical raw goods. Loose stacks contain one good type, 1–3 units plus reservations, never block movement, and avoid blocked terrain, buildings and active resource footprints when created.

Wood, clay and rubble use:

```text
natural source -> extractor -> loose ground stack -> pickup -> consumer/storage
```

The extractor's `NaturalResource.output` is only short-lived staging within a simulation step if physical placement cannot happen immediately. Real ground stock is `World.looseGoods`.

`Trip` can directly reference three source categories:

```text
building      default source kind
resource      explicit natural-resource source where legacy/internal flows still need it
looseGood     physical LooseGoodStack with stable sourcePosition
```

Loose-good reservations remain on the concrete stack from planning through pickup. Cancellation releases an unpicked reservation; cancellation after pickup returns the carried unit to a valid nearby ground position. Hunger and sleep preserve `sourcePosition`, so interrupted physical pickups can resume without compatibility entities.

Trees are one-cell blocking resources with three wood. Clay and stone have finite ten-unit yields and four-cell footprints; clay is walkable, stone blocking.

## Storage and transport

HQ and warehouse inventories now use the same first-class storage semantics in the transport core. Production workers/building carriers may fetch required goods from either storage type, while storage carriers deliver directly into the assigned warehouse/HQ inventory.

Automatic storage-to-storage collection remains forbidden. Warehouse merchants retain their explicit warehouse-to-warehouse route semantics. Builders retain long-distance material sourcing and production-building carriers retain demand-driven sourcing.

## Arbeitsflaggen und lokale Arbeitsbereiche

`src/simulation/workAreas.ts` owns the authoritative local work-area rule. Eligible people carry a per-person `WorkArea { center, radius, retryAfterTick? }` in simulation state.

It applies to **woodcutters, clay diggers, stonecutters, warehouse carriers and HQ carriers**. Production-building carriers deliberately keep demand-driven sourcing behavior.

The shared radius is **2.5 coarse world tiles = 12.5 micro-cells**, measured from the flag center. Target eligibility uses `hexDistance <= radius`; exact pathfinding is performed only for eligible candidates.

- A newly planned natural-resource worker receives the initial flag at the first reachable resource selected by the existing planner.
- A warehouse/HQ carrier receives the initial flag at its storage workplace.
- Subsequent extractor/resource selection is restricted to matching unclaimed resources inside that person's area.
- Warehouse/HQ pickup selection is restricted to non-storage building outputs and physical loose-good stacks inside that person's area.
- A carried item may finish delivery after the flag moves; an unpicked outside source is cancelled and any physical reservation released.
- If no valid local target exists, only that person retries at the existing one-second fallback cadence. The flag never migrates automatically.

`simulationCore.ts` still suppresses the historical whole-map extractor replanning paths during depletion/idle retry; `syncWorkAreas()` owns the authoritative local retry.

`setWorkAreaCenter()` is the simulation command. `src/game/workAreaInteraction.ts` maps short click/tap to a new center while drag pans and pinch zooms. Presentation never owns work-area state.

Wayposts are separate and not implemented.

## Hunger cadence and food planning

The world advances at 60 simulation ticks/s, but hunger decay, threshold checks and food-target planning are intentionally sampled once per simulated second. Movement, production and transport remain 60 Hz.

`src/simulation/needs.ts` orders food candidates by a cheap spatial lower bound and evaluates A* only while a candidate can still beat the best reachable route. Selected destinations stay stable while travelling.

## Farms and fields

Farm balance is unchanged. `farm.ts` expands each logical field to a refined physical footprint. Sow planning and final creation require every footprint cell to remain valid grass and reject active natural-resource cells, loose-good stacks, conflicting sow reservations and occupied cells.

Farm demolition removes active fields and restores their cells to grass. Field/terrain role changes clear stale traffic counters.

## Buildings, clearance and demolition

Building legality is authoritative in `buildingPlacement.ts`. Fine-grid footprints and the existing one-coarse-tile clearance ring must fit valid terrain. Active natural-resource footprints reserve both footprint and clearance even when the resource itself is walkable.

Loose goods block the actual building footprint so construction cannot delete physical stock. They are allowed in the clearance ring because they remain walkable.

Demolition restores the complete multi-cell footprint, not only the anchor, clears stale traffic state and reroutes people whose current route crossed the removed footprint. A road covered by construction is restored as grass after demolition, preserving existing product behavior.

## Roads and traffic

Organic-road balance remains unchanged: eight qualifying crossings within 32 simulated seconds create a permanent road; roads use the existing 1.3× movement-speed multiplier.

Manual and organic road creation reject every cell covered by an active natural-resource footprint, not only resource anchors. The movement pass builds the active-resource cell set once per tick and shares it across all crossing checks.

## Profession experience and technologies

Experience is persistent per person and profession from 0–100. One successfully completed professional action gives exactly +1 XP; aborted or partial actions give none. Permanent unlock rules remain authoritative in `src/simulation/technology.ts`; placement enforcement remains in `buildingPlacement.ts`.

## Event-driven planning and performance

Expensive autonomous target selection is event-driven. A person retains selected hunger, sleep or work destinations while travelling and normally re-evaluates at task boundaries. Missing work receives a per-person one-second retry deadline rather than a global re-plan.

Natural-resource depletion retirement is event-driven; there is no periodic full resource-list cleanup scan. Farm physical-obstacle state is built once per farm-system tick, and road resource footprints once per movement tick. Placement anchor enumeration reuses indexed lookups. Further optimization should be driven by `src/debug/performanceProfiler.ts`, not speculative cache layers.

## Rendering and interaction

Rendering stays decoupled from simulation ticks. `IncrementalMainScene` caches map/person state; natural resources, loose goods and work-area flags are presentation layers over authoritative state. Camera zoom is 0.7×–10× for mouse-wheel and pinch. Desktop and touch remain first-class input adapters. The iPhone 13 Mini remains the mobile baseline.

## Existing architecture

All other architecture remains as documented in [`architecture-detail.md`](./architecture-detail.md), including sleep, beeren/food behavior, production/inventories, construction, merchants, person selection, handbook/PWA and performance diagnostics.

Where `architecture-detail.md` still describes old grid/resource semantics, fake HQ storage, loose-good resource proxies, directly entering blocking targets, globally roaming extractors, tick-wise hunger planning or a building-centered storage-carrier collection radius as current behavior, this file supersedes it.

## Testing and deployment

`npm test` is the deterministic Node suite. `npm run build` performs TypeScript checking and the Vite production build. Regressions cover physical loose-good pickup/reservation, HQ direct storage collection, shared work areas, storage-to-storage restrictions, placement/demolition and existing farm/road behavior.

Per `agents.md`, work is performed on a temporary branch and transferred to `main` as one final squash commit. The GitHub Pages workflow runs tests before the production build and deploys only after both succeed.
