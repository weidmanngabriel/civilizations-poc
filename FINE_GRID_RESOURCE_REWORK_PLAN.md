# Fine Grid & Physical Resources Rework

## Status

**Active implementation document.** Read this before changes to map scale, terrain, buildings, people rendering/scale, natural resources, loose goods, pathfinding, roads, placement, or resource logistics.

Current state: **Phases A, B, C, D and E complete. Phase F — cross-system cleanup and performance — is in progress.**

## Goal

Move the prototype from a coarse grid with abstract resource output to a finer spatial model with physical resources, visible logistics and locally meaningful worker movement. The grid is authoritative for simulation but should not become visually dominant.

## Guiding constraints

- Keep deterministic simulation independent from Phaser.
- Rendering stays decoupled from simulation ticks.
- Desktop and touch are first-class input modes.
- Each slice leaves `main` playable.
- Avoid repeated full-map scans on the fine grid.
- Preserve unrelated behavior unless explicitly changed.
- Work on a temporary branch and squash one final commit to `main`.

## Established spatial/resource model

The world uses a 205 × 125 micro-grid, a 5× refinement of the former 41 × 25 logical world. Terrain and natural resources are separate. Resource footprint and movement blocking are separate properties.

Trees are one-cell blocking resources with three wood. Clay and stone use compact four-cell footprints; clay is walkable and stone blocking. Blocking targets are interacted with from reachable neighboring walkable cells rather than being entered.

Physical wood, clay and rubble lie in walkable `LooseGoodStack`s of 1–3 units. Reservations protect concrete units. The historical `Trip` representation still uses short-lived `ground-*` compatibility proxies while those stacks are collected.

## Phase F: local work areas

The current Phase-F slice adds **per-person work flags** for local resource work without redesigning the entire economy.

Current scope:

- woodcutters,
- clay diggers,
- stonecutters,
- warehouse carriers,
- HQ carriers.

The work-area radius is **5 coarse world tiles / 25 micro-cells**.

Natural-resource workers get their initial flag at the first reachable resource selected by the existing planner. After that they only choose matching unclaimed sources inside their flag. When the area is exhausted they wait and retry locally instead of roaming globally. Extractor flags are rendered red and never move through autonomous worker logic; only explicit player input changes an established flag center.

Warehouse/HQ carriers get their initial flag at their storage workplace and only auto-collect non-storage sources inside their personal flag. Storage-to-storage automatic movement remains forbidden. A moved flag cancels an unpicked source outside the new area while already carried goods still finish delivery.

Production-building carriers deliberately remain outside this first slice and retain their current demand-driven sourcing behavior. Merchants and builders also retain their existing separate sourcing semantics.

`src/simulation/workAreas.ts` remains the authoritative local target filter around the historical planner/`Trip` model. During Phase F, `simulationCore.ts` suppresses the historical whole-map extractor replanning that would otherwise run during resource depletion or idle retry and then be discarded by the work-area filter. Local retries are handled by `syncWorkAreas()` instead.

Work flags and future wayposts are separate: flags restrict **eligible local targets**; wayposts will later restrict **long-distance navigation**.

## Phase F: needs/planning performance

Hunger decay, hunger threshold checks and food-target planning now run **once per simulated second** rather than on every 60-Hz simulation tick. Movement and the rest of the fixed-step simulation remain at 60 Hz.

Food-source selection no longer calculates an A* route to every available bread source and bush up front. Candidates are ordered by a cheap spatial lower bound, then exact paths are calculated only while a candidate can still beat the best reachable route already found.

## Previous completed phases

### Phase A — Spatial rework

Complete: fine grid, preserved world scale, scaled building/field footprints, movement/camera/input adaptation and optimized path lookup.

### Phase B — Physical resource data model

Complete: physical loose-good stacks, deterministic placement/reservation/pickup, capacity three and non-blocking semantics.

### Phase C — Wood chain

Complete: individual blocking trees, three wood per tree, physical wood piles, consumer pickup and depletion collision cleanup.

### Phase D — Clay and stone

Complete: physical clay/rubble piles, four-cell footprints and shared raw-good flow.

### Phase E — Visual/resource-density pass

Complete: denser walkable tree clusters, multi-piece resource presentation and distinct 1/2/3-unit loose-good visuals.

## Other Phase-F cleanup already completed

- autonomous work planning is event-driven with per-person one-second retry fallback,
- hunger planning and decay run at 1 Hz while movement remains 60 Hz,
- food-target A* is pruned by spatial lower bounds,
- hunger/sleep retain selected destinations while travelling,
- extractor depletion/idle retries do not launch discarded whole-map resource planning,
- person markers are compact and camera zoom reaches 10×,
- blocking targets use explicit adjacent interaction positions,
- storage-to-storage, merchant and builder sourcing semantics are covered by regressions,
- natural-resource depletion retirement is event-driven rather than a periodic full resource-list scan,
- performance diagnostics split planning costs.

## Still review

- HQ legacy carrier planner cleanup,
- farms and fields,
- building clearance/demolition,
- roads and traffic thresholds,
- generic trip/source representation after physical-resource migration,
- remaining pathfinding cost/performance,
- future waypost/high-level navigation,
- save/load assumptions,
- remaining detail-document cleanup and regression coverage.

## Decisions

- Fine grid is a simulation mechanism, not a visual board.
- Work areas are per person, not per building.
- Initial flag radius is five coarse world tiles.
- Extractor flags begin at the first reachable source and are shown in red.
- Extractors never move their own flags; established flag centers change only via player input.
- Warehouse/HQ carrier flags begin at the storage workplace.
- Moving a flag invalidates unpicked outside targets but not carried cargo.
- Production carriers, merchants and builders are not governed by this first work-area slice.
- Hunger/food planning cadence is one simulated second, not every simulation tick.
- Work flags and future wayposts are separate systems.

## Open decisions

- whether later work-area radii differ by profession/upgrades,
- whether production-building carriers receive flags in a later slice,
- whether flags can be shared by multiple workers,
- exact waypost connection ranges and local-navigation radius,
- future resource regeneration and procedural cluster rules.

## Handoff

Before continuing: read `agents.md`, this file, `architecture.md` / `architecture-detail.md`, and for product behavior `concept.md` / `concept-detail.md`; confirm latest `main` CI is green.

After relevant changes update this plan, current architecture/concept entry points and player-facing handbook text.
