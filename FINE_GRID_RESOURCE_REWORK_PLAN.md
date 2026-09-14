# Fine Grid & Physical Resources Rework

## Status

**Active implementation document.** Read this before changes to map scale, terrain, buildings, people rendering/scale, natural resources, loose goods, pathfinding, roads, placement, or resource logistics.

Current state: **Phases A, B and C complete. Phase D — clay and stone migration — is next.**

## Goal

Move the prototype from a coarse grid with resource nodes that hold abstract local output to a finer spatial model inspired by the original game:

- small simulation cells while keeping the visible world approximately the same size,
- buildings occupy many cells while keeping roughly their current screen-space size,
- people remain continuously animated and readable,
- trees and other natural resources are individual world objects,
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
- Changes are made directly on `main` per current project instruction; deployment is gated by the full test suite and build.

## Spatial model

Phase A settled on a **5× linear refinement**:

```text
old logical world    41 × 25
current micro-grid   205 × 125
```

Visible world size remains approximately comparable. Buildings and fields expand to many micro-cells, movement/ranges are scaled to preserve world-space distances, and people remain larger than individual micro-cells.

## Target resource model

### Natural resource sources

A resource region is a collection of individual source objects. Forests already consist of individual tree resources. Clay and stone use individual source objects as well, but their extracted output remains on the compatibility path until Phase D.

Each source object owns its position and depletion state. `NaturalResource.output` is no longer player-facing storage for wood; it remains only as a compatibility field for resource types that have not yet been migrated.

### Loose goods on the ground

A ground stack has:

- a stable id,
- a concrete map cell,
- exactly one good type,
- an integer amount from 1 to 3,
- an integer reservation count between 0 and the current amount.

Different good types do not share one cell. Empty stacks are removed.

**Permanent rule:** loose goods are never obstacles. They do not change terrain, collision, movement cost, or pathfinding and can always be walked over.

A new stack may not be created on blocked terrain, a building footprint, or an active natural-resource source. Existing compatible non-full stacks can be filled up to 3.

### Extractor behavior

For one completed physical extraction action:

1. choose/retain a concrete resource source,
2. reach the source,
3. extract one unit,
4. find a drop cell near the source,
5. prefer an existing non-full stack of the same good,
6. otherwise choose the nearest suitable free cell,
7. place the unit there,
8. only then count the action as completed for profession XP,
9. continue at the source or select a new source if depleted.

For wood, the drop search radius is **5 micro-cells**, equal to one former coarse-grid step. This is the Phase-C prototype value and can be revisited during balancing.

### Logistics behavior

For migrated raw materials, carriers and production workers collect from ground stacks instead of source-local output. Reservations protect concrete units. Pickup reduces a stack from 3 → 2 → 1 → removed.

Building inventories remain normal inventories.

## Phases

### Phase A — Spatial rework

Implemented:

- map refined to 205 × 125 micro-cells,
- visible world scale preserved,
- building footprints, clearance rings and farm fields scaled,
- person presentation and movement adapted,
- camera/map geometry and build placement adapted,
- pathfinding and tile lookup optimized for the larger grid,
- gameplay radii converted to micro-cell units,
- fine-grid regression tests added,
- legacy resource economy intentionally preserved.

**Status: complete and deployed after green tests/build.**

### Phase B — Physical resource data model

Implemented:

- `LooseGoodStack` world model with stable ids,
- capacity exactly 3 units of one good type per cell,
- deterministic helpers for lookup, placement, reservation, release and reserved pickup,
- empty-stack removal,
- deterministic drop-position search that prefers compatible partial stacks before empty cells,
- local radius search using indexed tile lookup instead of a complete map scan,
- permanent non-blocking/non-collision rule for all loose goods,
- presentation-only Phaser overlay for 1/2/3-unit ground stacks,
- focused regression tests for capacity, good-type isolation, reservations, removal, deterministic drop choice and pathfinding non-interference.

Individual natural-resource objects already existed before Phase B; Phase B formalized them as the future source objects while removing the architectural assumption that produced goods must live on the source.

**Status: complete.**

### Phase C — Wood end-to-end reference chain

Implemented:

- woodcutters continue to target concrete individual tree resources,
- every completed felling action produces one physical wood unit,
- tree-local `output` is immediately migrated to physical ground storage and remains zero during normal play,
- wood is dropped within 5 micro-cells of the source,
- compatible partial stacks are preferred and every stack remains capped at 3,
- additional nearby stacks are created instead of treating 3 units as a total forest capacity,
- sawmill workers, sawmill carriers and HQ carriers can source wood from the physical stacks,
- one physical unit cannot be reserved by two people,
- carried-cargo cancellation restores the unit to physical ground storage,
- depleted trees disappear while already dropped wood remains collectible,
- focused end-to-end coverage verifies tree → ground stack → sawmill input,
- legacy tests were migrated from forest-output assertions to physical-stack assertions.

The existing transport core still identifies stack pickup through a short-lived internal depleted-resource adapter while a trip is planned or in flight. The authoritative stock remains `World.looseGoods`; the adapter is not rendered, cannot be selected for extraction, and does not reintroduce tree-local storage. This keeps the Phase-C change isolated from the larger generic-trip redesign that can happen during cleanup.

**Done when:** tree → extraction → ground stack → pickup → sawmill works without an abstract forest output pool.

**Status: complete; full tests and production build green on main before this documentation update.**

### Phase D — Clay and stone migration

Next:

- migrate clay sources/extractors,
- migrate stone sources/extractors,
- use the same ground-stack and reservation rules,
- remove obsolete generic resource-output compatibility paths,
- keep the model data-driven for later resources.

**Status: not started.**

### Phase E — Visual/resource-density pass

- irregular forest clusters with individual trees,
- irregular clay/stone fields with visibly separate source pieces,
- tune 1/2/3-unit stack visuals,
- avoid exposing the micro-grid visually,
- tune resource/person visual scale against buildings and roads,
- confirm usability on iPhone 13 Mini and desktop.

**Status: not started.**

### Phase F — Cross-system cleanup and performance

Review at minimum:

- hunger/sleep nature targeting,
- farms and fields,
- building clearance and demolition,
- roads and traffic thresholds,
- warehouse/HQ collection radius semantics,
- merchant behavior,
- construction material pickup,
- generic trip/source representation after the physical-resource migration,
- pathfinding cost/performance,
- person selection and camera focus,
- future save/load assumptions,
- handbook text,
- concept and architecture documentation,
- automated regression coverage.

**Status: not started.**

## Decisions already made

- The fine grid is a simulation/spatial mechanism, not a visual tile aesthetic.
- The final Phase-A refinement factor is 5× per axis.
- Buildings become many cells large instead of becoming visually tiny.
- People remain readable in screen space and are not shrunk to micro-cell size.
- Natural-resource regions are collections of individual source objects.
- Extracted raw resources become physical loose goods.
- Loose ground stacks hold at most 3 units of one good type.
- Loose ground stacks are **always walkable and never obstacles**.
- Reservations protect concrete units without removing them before pickup.
- Extractors choose real drop positions and prefer nearby compatible stacks with capacity.
- Wood uses a 5-micro-cell / one-old-step drop radius for the current prototype.
- A full 3-unit wood stack does not stop extraction if another valid nearby stack position exists.
- Lehm and Stein remain on the compatibility path until Phase D.

## Open decisions

Resolve these in the relevant phase rather than inventing them early:

- whether tree/source collision footprints are one micro-cell or larger while visuals extend beyond them,
- whether the 5-micro-cell wood drop radius needs later balance tuning,
- whether different loose goods may later coexist on one cell (current rule: no),
- exact resource-cluster density,
- regeneration rules for future renewable resources.

## Handoff / next chat

Before continuing this rework:

1. read `agents.md`,
2. read this file,
3. read `architecture.md` and `architecture-detail.md`,
4. for product behavior also read `concept.md` and `concept-detail.md`,
5. confirm latest `main` CI is green.

Next start with **Phase D — clay and stone migration**. Do not broaden that phase into visual-density work unless explicitly requested.

## Documentation rule

After every implementation phase:

1. update this document's phase status and decisions,
2. update `architecture.md` / `architecture-detail.md` for architectural changes,
3. update `concept.md` / `concept-detail.md` for player-facing behavior changes,
4. check `src/handbook/*.md` for player-facing documentation changes,
5. keep `agents.md` pointing to this plan while the rework remains active.
