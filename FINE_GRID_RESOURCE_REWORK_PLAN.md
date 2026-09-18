# Fine Grid & Physical Resources Rework

## Status

**Implementation complete.** Phases A–F are finished. This file remains the historical/reference document for the fine-grid and physical-resource migration, but there is no active migration phase after Phase F.

Future work that builds on these systems should still preserve the established spatial/resource rules documented here and in `architecture.md` / `concept.md`.

## Goal

Move the prototype from a coarse grid with abstract resource output to a finer spatial model with physical resources, visible logistics and locally meaningful worker movement. The grid is authoritative for simulation but should not become visually dominant.

## Guiding constraints

- Keep deterministic simulation independent from Phaser.
- Rendering stays decoupled from simulation ticks.
- Desktop and touch are first-class input modes.
- Avoid repeated full-map scans on the fine grid.
- Preserve unrelated behavior unless explicitly changed.
- Work on a temporary branch and squash one final commit to `main`.

## Established spatial/resource model

The world uses a 205 × 125 micro-grid, a 5× refinement of the former 41 × 25 logical world. Terrain and natural resources are separate. Resource footprint and movement blocking are separate properties.

Trees are one-cell blocking resources with three wood. Clay and stone use compact four-cell footprints; clay is walkable and stone blocking. Blocking targets are interacted with from reachable neighboring walkable cells rather than being entered.

Physical wood, clay and rubble lie in walkable `LooseGoodStack`s of 1–3 units. Each newly extracted unit is first carried individually by its outdoor worker to that person's work flag and only then becomes a loose stack near the flag. Reservations protect concrete units. `Trip` can point directly at a building, natural resource or loose-good stack; physical stacks are no longer mirrored as temporary fake natural resources.

The HQ and warehouses share the same real storage semantics in the transport core. The old hidden HQ storage proxy and its separate carrier planner are removed. Automatic storage-to-storage collection remains forbidden; explicit warehouse merchant routes remain separate.

## Phase A — Spatial rework

Complete: fine grid, preserved world scale, scaled building/field footprints, movement/camera/input adaptation and optimized path lookup.

## Phase B — Physical resource data model

Complete: physical loose-good stacks, deterministic placement/reservation/pickup, capacity three and non-blocking semantics.

## Phase C — Wood chain

Complete: individual blocking trees, three wood per tree, physical wood piles, consumer pickup and depletion collision cleanup.

## Phase D — Clay and stone

Complete: physical clay/rubble piles, four-cell footprints and shared raw-good flow.

## Phase E — Visual/resource-density pass

Complete: denser walkable tree clusters, multi-piece resource presentation and distinct 1/2/3-unit loose-good visuals.

## Phase F — Cross-system cleanup and performance

Complete.

### Local work areas

Per-person work flags apply to woodcutters, clay diggers, stonecutters, fishers, warehouse carriers and HQ carriers. The shared radius is **2.5 coarse world tiles / 12.5 micro-cells**.

Natural-resource workers receive their initial flag at the first reachable resource and subsequently choose only matching unclaimed sources inside it. Empty areas cause local waiting/retry rather than global roaming. Extractor flags are red and never move autonomously.

Warehouse/HQ carriers receive their initial flag at their storage workplace and auto-collect only non-storage sources inside their own area. Moving a flag cancels an unpicked outside source while already carried goods still finish delivery.

Production-building carriers, merchants and builders keep their separate sourcing semantics. Work flags and wayposts remain separate systems.

### Wayposts

High-level navigation is implemented as a separate `World.wayposts` graph. Player-facing worlds start with one valid waypost roughly two coarse tiles in front of HQ. Orientation radius and minimum spacing are each 2.5 coarse world tiles; the maximum direct connection distance is 5 coarse world tiles. These are separate waypost constants and are not derived from work-area balance.

Reachable posts in range receive reciprocal stored connections. Each connection is shown by its own projected directional sign. Travel prefers a connected waypost sequence when both endpoints fall within suitable orientation areas; each graph edge still resolves to normal micro-grid A*, and global A* remains the fallback when the network cannot serve the route.

### Physical transport-source cleanup

- `Trip` directly represents loose-good stack sources with a stable pickup position.
- Loose-good reservations are owned by the physical stack through planning, cancellation and pickup.
- Hunger/sleep interruptions resume an existing physical pickup instead of depending on a proxy entity.
- HQ storage is first-class; `hq-storage-proxy` and the needs-layer HQ carrier planner are gone.
- Completed extractor output is converted into one unit of person-carried outdoor cargo and deposited as a `LooseGoodStack` only at the worker's personal flag.

### Farms and fields

Farm rules and balance remain unchanged. Field placement now obeys the physical world model: the full refined field footprint must be grass and cannot overwrite natural-resource footprints, loose goods, other reserved sow footprints or occupied cells. Demolishing a farm still removes its active fields.

### Building clearance and demolition

Building placement now keeps the authoritative footprint plus a compact two-micro-cell clearance ring; this supersedes the earlier one-coarse-world-tile spacing from the original migration. Active natural-resource footprints reserve both placement and clearance space. Loose goods block only the actual building footprint because they are walkable and may remain in the clearance ring.

Demolition restores every occupied footprint cell and clears stale traffic state across the full former footprint. Roads under a constructed building do not return after demolition; the cleared footprint becomes grass as before.

### Roads and traffic

The existing balance is unchanged: eight qualifying traversals within 32 simulated seconds create a permanent road and roads provide the existing 30% movement-speed bonus.

Road placement and organic road creation now respect the **entire active natural-resource footprint**, not only a resource anchor cell. Traffic state is cleared when a cell changes role through construction, field use or demolition.

### Performance cleanup

- autonomous work planning remains event-driven with a one-second fallback retry,
- hunger planning/decay remains at 1 Hz while movement remains 60 Hz,
- food-source A* remains pruned by spatial lower bounds,
- extractor depletion retirement remains event-driven,
- local work areas use geometric eligibility before route planning,
- road movement builds the active-resource footprint set once per movement tick rather than per crossing,
- farm action validation builds the physical-obstacle set once per farm-system tick rather than once per footprint cell,
- placement anchor enumeration reuses indexed terrain/resource/loose-good lookups.

No additional cache hierarchy was introduced; the current diagnostics should guide later optimization if measured load requires it.

## Regression coverage added/retained

- direct physical loose-good pickup and reservation,
- no fake natural-resource mirror for loose goods,
- HQ carrier direct collection into real HQ inventory with no proxy building,
- shared warehouse/HQ work-area radius,
- storage-to-storage automatic movement remains forbidden,
- merchant and builder long-distance sourcing semantics remain separate,
- physical goods block building footprints,
- multi-tile demolition and road replacement behavior.

## Decisions retained

- Fine grid is a simulation mechanism, not a visual board.
- Work areas are per person, not per building.
- Shared flag radius is 2.5 coarse world tiles.
- Extractor flags begin at the first reachable source and are shown in red.
- Extractors never move their own flags; established flag centers change only via player input.
- Warehouse/HQ carrier flags begin at the storage workplace.
- Moving a flag invalidates unpicked outside targets but not carried cargo.
- Production carriers, merchants and builders are not governed by the local storage/extractor work-area slice.
- Hunger/food planning cadence is one simulated second, not every simulation tick.
- Work flags and wayposts are separate systems.

## Future follow-ups — not part of the completed migration

- decide whether work-area radii later differ by profession or upgrades,
- decide whether production-building carriers receive flags,
- decide whether flags can be shared by multiple workers,
- define future resource regeneration/procedural cluster rules,
- add save/load only once its product scope is chosen; no migration-specific save format is introduced here,
- use performance diagnostics before further pathfinding optimization instead of adding speculative complexity.

## Handoff

Before changes to these systems, read `agents.md`, `architecture.md` / `architecture-detail.md`, `concept.md` / `concept-detail.md` and this reference document. Confirm latest `main` CI is green.

After relevant changes update current architecture/concept entry points and player-facing handbook text. Reopen this plan only if a new fine-grid/resource migration phase is intentionally started.
