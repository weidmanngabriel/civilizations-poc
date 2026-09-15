# Fine Grid & Physical Resources Rework

## Status

**Active implementation document.** Read this before changes to map scale, terrain, buildings, people rendering/scale, natural resources, loose goods, pathfinding, roads, placement, or resource logistics.

Current state: **Phases A, B, C, D and E complete. Phase F — cross-system cleanup and performance — is in progress.**

## Goal

Move the prototype from a coarse grid with resource nodes that hold abstract local output to a finer spatial model inspired by the original game:

- small simulation cells while keeping the visible world approximately the same size,
- buildings occupy many cells while keeping roughly their current screen-space size,
- people remain continuously animated and readable,
- terrain describes only ground, while natural resources are independent world objects on top,
- trees and other natural resources are individual source objects,
- extracted raw materials become physical loose goods placed on the ground,
- one ground cell holds 1–3 units of one loose-good type,
- extractors choose real drop positions,
- carriers and production workers collect from those positions.

The grid is authoritative for spatial simulation but should not become visually dominant.

## Guiding constraints

- Keep the deterministic simulation independent from Phaser.
- Rendering stays decoupled from simulation ticks and movement remains visually continuous.
- Desktop and touch are both first-class interaction modes.
- Each phase must leave `main` playable and testable.
- Do not combine multiple large migrations just to avoid temporary compatibility code.
- Avoid repeated full-map scans on the fine grid.
- Existing behavior outside the active phase remains unchanged unless explicitly documented.
- Changes are developed on a temporary branch and squash-merged to `main`; deployment is gated by the full test suite and build.

## Spatial model

Phase A settled on a **5× linear refinement**: 41 × 25 old logical cells became 205 × 125 micro-cells while visible world size remained approximately comparable. Buildings and fields expand to many micro-cells, movement/ranges are scaled, and people remain larger than individual micro-cells.

## Terrain/resource separation

Terrain is only the underlying ground. Natural resources do not create special terrain types merely because they occupy a location. Resource footprint and movement blocking are independent properties.

| Resource | Logical footprint | Movement |
|---|---:|---|
| Tree | 1 micro-cell | blocking |
| Bush | 1 micro-cell | non-blocking |
| Mushroom | 1 micro-cell | non-blocking |
| Clay | compact 4 micro-cells | non-blocking |
| Stone | compact 4 micro-cells | blocking |
| Ore | target: about 4 micro-cells | blocking |

Blocking cells are never entered merely because they are an explicit route target. Pathfinding deterministically resolves such a target to the quickest reachable walkable neighboring micro-cell while retaining the logical target identity for interaction checks.

## Target resource model

### Natural resource sources

A resource region is a collection of individual source objects. Forests consist of individual tree resources. Clay and stone use individual source objects with multi-cell logical footprints. `NaturalResource.output` is transitional compatibility state for migrated raw resources, not player-facing storage.

### Loose goods on the ground

A ground stack has a stable id, concrete map cell, exactly one good type, amount 1–3 and reservation count. Loose goods are always walkable and never alter terrain or routing. New stacks avoid blocked terrain, buildings and active resource footprints.

### Extractor behavior

A physical extraction action reaches a valid resource interaction position, extracts one unit, drops it locally, awards XP only after it enters the physical-ground flow, and then either continues or selects another valid source.

Wood, clay and rubble use a 5-micro-cell drop radius.

### Logistics and work areas

Wood, clay and rubble are collected from ground stacks through the existing compatibility adapter. Reservations protect concrete units.

Woodcutters, clay diggers, stonecutters and carriers now use **per-person work areas**. A work area is centered on a visible flag and currently has a radius of **5 coarse world tiles / 25 micro-cells**.

- Natural-resource workers receive their first flag at the first reachable source selected by the existing planner and subsequently choose only matching unclaimed sources inside that flag.
- Carrier flags begin at the assigned workplace; pickup sources must lie inside that carrier's flag.
- The flag is persistent and does not follow the worker automatically.
- If no valid local source exists, that person waits and retries at the existing one-second fallback cadence rather than roaming across the map.
- Moving the flag cancels an unpicked source outside the new area; already carried goods still finish delivery.
- Normal storage carriers still never auto-transfer storage-to-storage. Merchants remain the explicit long-range warehouse route mechanism.
- Production workers and builders keep their separate demand-driven sourcing behavior; only people in the carrier role use carrier work flags.

The current implementation is a compatibility layer in `workAreas.ts` around the historical planner/`Trip` model. A later waypost system is deliberately separate: work areas constrain eligible local targets, while wayposts will constrain long-distance navigation.

## Completed phases

### Phase A — Spatial rework

Complete: 205 × 125 micro-grid, preserved world scale, scaled footprints/ranges, continuous people, camera/input adaptation, optimized tile/path lookup and regression coverage.

### Phase B — Physical resource data model

Complete: `LooseGoodStack`, deterministic placement/reservation/pickup, capacity three, non-blocking semantics and rendering overlay.

### Phase C — Wood end-to-end reference chain

Complete: individual blocking trees, three wood per tree, physical wood stacks, consumer/carrier pickup, collision removal on depletion and dense walkable forest clusters.

### Phase D — Clay and stone migration

Complete: physical clay/rubble stacks, four-cell footprints, clay non-blocking, stone blocking, shared raw-good compatibility flow and depletion cleanup.

### Phase E — Visual/resource-density pass

Complete: denser deterministic tree clusters, irregular resource presentation, distinct raw-good pile silhouettes and visible 1/2/3-unit stack arrangements.

### Phase F — Cross-system cleanup and performance

Implemented in current slices:

- autonomous target selection is event-driven with per-person one-second retry fallback,
- hunger/sleep retain selected destinations while travelling,
- compact person markers and 10× camera zoom,
- explicit adjacent interaction positions for blocking targets,
- warehouse/HQ local collection semantics and storage-to-storage exclusions were clarified,
- construction and merchant sourcing semantics were separated from local storage collection,
- natural-resource depletion retirement is event-driven rather than periodically scanning every resource,
- performance diagnostics split planning costs,
- **per-person work flags** replace the old fixed building-centered collection radius as the authoritative local source boundary for carriers,
- woodcutters, clay diggers and stonecutters stop searching globally after their initial assignment and retarget only inside their own work flag,
- work flags can be repositioned from the selected-person UI on desktop and touch without sacrificing drag-to-pan or pinch zoom,
- focused regression coverage locks local extractor and carrier behavior.

Still review at minimum:

- HQ legacy carrier planner cleanup so the work-area compatibility layer can become simpler,
- farms and fields,
- building clearance and demolition,
- roads and traffic thresholds,
- generic trip/source representation after physical-resource migration,
- pathfinding cost/performance,
- future waypost/high-level navigation design,
- person selection and camera focus,
- future save/load assumptions,
- remaining handbook/detail-document cleanup,
- automated regression coverage for remaining cleanup areas.

**Status: in progress.**

## Decisions already made

- Fine grid is a simulation mechanism, not a visual tile aesthetic.
- Refinement is 5× per axis.
- Terrain and natural resources are separate systems.
- Forest is a cluster of tree objects.
- Resource footprint and blocking are separate.
- Tree = 1 cell, blocking, 3 wood; clay = 4 cells non-blocking; stone = 4 cells blocking.
- Loose stacks hold at most 3 units of one good and never block movement.
- Wood/clay/rubble drop radius is 5 micro-cells.
- Autonomous targets are retained while travelling; missing work retries per person at most once per second.
- Blocking targets are interacted with from a walkable adjacent cell.
- Local work areas are per person, not per building.
- Initial work-area radius is 5 coarse world tiles / 25 micro-cells for extractors and carriers.
- Extractor flags begin at the first reachable resource; carrier flags begin at the workplace.
- A flag never auto-migrates when its local resources are exhausted.
- A moved flag invalidates unpicked outside targets but does not discard carried goods.
- Merchants are not governed by carrier work flags.
- Work flags and future wayposts are separate systems.
- Camera zoom supports up to 10× on desktop and touch.

## Open decisions

Resolve these in the relevant phase rather than inventing them early:

- whether work-area radii should later differ by profession or upgrades,
- whether flags may later be shared by multiple workers,
- exact waypost minimum/maximum connection ranges and local-navigation radius,
- whether future maps should procedurally generate resource cluster density,
- whether different loose goods may later coexist on one cell,
- regeneration rules for future renewable resources.

## Handoff / next chat

Before continuing this rework:

1. read `agents.md`,
2. read this file,
3. read `architecture.md` and `architecture-detail.md`,
4. for product behavior also read `concept.md` and `concept-detail.md`,
5. confirm latest `main` CI is green.

Continue with Phase F unless the user requests another functional change first.

## Documentation rule

After every implementation phase or relevant spatial decision:

1. update this document's phase status and decisions,
2. update `architecture.md` / relevant architecture details,
3. update `concept.md` / relevant concept details,
4. check `src/handbook/*.md`,
5. keep `agents.md` pointing to this plan while the rework remains active.
