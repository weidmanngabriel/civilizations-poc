# Fine Grid & Physical Resources Rework

## Status

**Active implementation document.** Read this before changes to map scale, terrain, buildings, people rendering/scale, natural resources, loose goods, pathfinding, roads, placement, or resource logistics.

Current state: **Phases A, B, C and D complete. Terrain/resource separation and tree/bush normalization are complete. Phase E — visual/resource-density pass — is next.**

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
- Changes are made directly on `main` per current project instruction; deployment is gated by the full test suite and build.

## Spatial model

Phase A settled on a **5× linear refinement**:

```text
old logical world    41 × 25
current micro-grid   205 × 125
```

Visible world size remains approximately comparable. Buildings and fields expand to many micro-cells, movement/ranges are scaled to preserve world-space distances, and people remain larger than individual micro-cells.

## Terrain/resource separation

Terrain is only the underlying ground. Natural resources must not create special terrain types just because they occupy a location. A tree can therefore sit on grass today and potentially on another suitable ground type later.

Resource footprint and movement blocking are independent properties. Current authoritative rules are data-driven in `src/simulation/naturalResources.ts`:

| Resource | Logical footprint | Movement |
|---|---:|---|
| Tree | 1 micro-cell | blocking |
| Bush | 1 micro-cell | non-blocking |
| Mushroom | 1 micro-cell | non-blocking |
| Clay | compact 4 micro-cells | non-blocking |
| Stone | compact 4 micro-cells | blocking |
| Ore | target: about 4 micro-cells | blocking |

The start scenario no longer uses forest as player-facing terrain. Trees are individual resource objects on ordinary ground. `Tile.resourceBlocking` is a derived collision overlay synchronized from active blocking resource footprints; depletion removes only the resource/collision, not the terrain underneath.

Current extraction compatibility still permits a blocking resource anchor to be an explicit route endpoint. Normal transit cannot pass through its blocking footprint. A later cleanup may move extraction to explicit adjacent interaction cells.

## Target resource model

### Natural resource sources

A resource region is a collection of individual source objects. Forests consist of individual tree resources. Clay and stone use individual source objects with multi-cell logical footprints.

Each source object owns its position and depletion state. For all currently migrated raw resources, `NaturalResource.output` is no longer player-facing storage; it is only a transient compatibility field inside the legacy tick/transport adapter.

### Loose goods on the ground

A ground stack has a stable id, a concrete map cell, exactly one good type, an integer amount from 1 to 3 and an integer reservation count between 0 and the current amount.

Different good types do not share one cell. Empty stacks are removed.

**Permanent rule:** loose goods are never obstacles. They do not change terrain, collision, movement cost, or pathfinding and can always be walked over.

A new stack may not be created on blocked terrain, a building footprint, or any cell of an active natural-resource footprint. Existing compatible non-full stacks can be filled up to 3.

### Extractor behavior

For one completed physical extraction action:

1. choose/retain a concrete resource source,
2. reach the source or its interaction position,
3. extract one unit,
4. find a drop cell near the source,
5. prefer an existing non-full stack of the same good,
6. otherwise choose the nearest suitable free cell,
7. place the unit there,
8. only then count the action as completed for profession XP,
9. continue at the source or select a new source if depleted.

Wood, clay and rubble currently use a **5 micro-cell** drop radius, equal to one former coarse-grid step.

### Logistics behavior

Wood, clay and rubble are collected from ground stacks instead of source-local output. Reservations protect concrete units. Pickup reduces a stack from 3 → 2 → 1 → removed.

Building inventories remain normal inventories.

The historical `Trip` type still expects building/resource ids. Short-lived depleted `ground-*` resource proxies therefore remain as a compatibility adapter for physical raw stacks while a pickup is planned or active. `World.looseGoods` remains authoritative.

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

**Status: complete.**

### Phase B — Physical resource data model

Implemented:

- `LooseGoodStack` world model with stable ids,
- capacity exactly 3 units of one good type per cell,
- deterministic lookup, placement, reservation, release and pickup,
- empty-stack removal,
- deterministic local drop-position search,
- permanent non-blocking rule for loose goods,
- presentation-only Phaser overlay,
- focused regression coverage.

**Status: complete.**

### Phase C — Wood end-to-end reference chain

Implemented:

- woodcutters target concrete individual tree resources,
- every completed felling action produces one physical wood unit,
- wood is dropped within 5 micro-cells of the source,
- compatible partial stacks are preferred and remain capped at 3,
- sawmill workers, sawmill carriers and HQ carriers source wood from physical stacks,
- reservations prevent duplicate pickup,
- depleted trees disappear while dropped wood remains collectible,
- focused end-to-end coverage verifies tree → ground stack → sawmill input,
- one tree = one micro-cell resource object,
- one tree = exactly 3 wood,
- tree collision is separate from terrain,
- the start scenario no longer paints forest terrain under tree clusters,
- tree depletion restores walkability without rewriting the ground type,
- bush logical size is one micro-cell and bush rendering uses the shared fine-grid projection.

**Status: complete.**

### Phase D — Clay and stone migration

Implemented:

- clay extraction now produces physical `clay` ground stacks,
- stone extraction now produces physical `rubble` ground stacks,
- clay and stone use the same capacity/reservation/return-cargo compatibility flow as wood,
- real clay/stone source output is drained to the ground before public state is observed,
- clay uses a compact four-cell non-blocking footprint,
- stone uses a compact four-cell blocking footprint,
- footprint, blocking and raw-good mapping are centralized in `naturalResources.ts`,
- building placement and loose-good placement reserve the complete active resource footprint,
- depletion removes stone collision across the complete footprint while already dropped goods remain,
- focused tests cover physical extraction and four-cell collision semantics,
- the in-app logistics handbook documents physical clay/rubble piles.

The generic trip/source model itself is intentionally not redesigned yet; short-lived `ground-*` proxies remain until the Phase-F cleanup.

**Status: complete.**

### Phase E — Visual/resource-density pass

Next:

- irregular forest clusters made from many individual one-cell trees with intentional gaps,
- irregular clay/stone fields with visibly separate source pieces,
- tune 1/2/3-unit stack visuals,
- avoid exposing the micro-grid visually,
- tune resource/person visual scale against buildings and roads,
- confirm usability on iPhone 13 Mini and desktop.

**Status: not started.**

### Phase F — Cross-system cleanup and performance

Review at minimum:

- explicit adjacent interaction positions for blocking resources,
- hunger/sleep nature targeting,
- farms and fields,
- building clearance and demolition,
- roads and traffic thresholds,
- warehouse/HQ collection radius semantics,
- merchant behavior,
- construction material pickup,
- generic trip/source representation after physical-resource migration,
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
- Terrain and natural resources are separate systems.
- Forest is not a required terrain type; a forest is a spatial cluster of tree resource objects.
- Resource footprint and movement blocking are separate properties.
- Tree = 1 cell, blocking, 3 wood.
- Bush = 1 cell, non-blocking, visual may exceed the cell.
- Mushroom = 1 cell, non-blocking.
- Clay = compact 4 cells, non-blocking.
- Stone = compact 4 cells, blocking.
- Ore target remains about 4 cells, blocking.
- Buildings become many cells large instead of becoming visually tiny.
- People remain readable in screen space and are not shrunk to micro-cell size.
- Extracted raw resources become physical loose goods.
- Loose ground stacks hold at most 3 units of one good type.
- Loose ground stacks are always walkable and never obstacles.
- Reservations protect concrete units without removing them before pickup.
- Wood, clay and rubble currently use a 5-micro-cell / one-old-step drop radius.
- Active resource footprints reserve space against construction and new loose-good stacks even when the resource is non-blocking.

## Open decisions

Resolve these in the relevant phase rather than inventing them early:

- whether Phase E should vary four-cell clay/stone shape/orientation while preserving roughly the same occupied area,
- whether explicit adjacent interaction cells should replace the temporary targeted-blocker endpoint behavior,
- exact tree/resource cluster density and procedural distribution,
- whether different loose goods may later coexist on one cell (current rule: no),
- regeneration rules for future renewable resources.

## Handoff / next chat

Before continuing this rework:

1. read `agents.md`,
2. read this file,
3. read `architecture.md` and `architecture-detail.md`,
4. for product behavior also read `concept.md` and `concept-detail.md`,
5. confirm latest `main` CI is green.

Next start with **Phase E — visual/resource-density pass** unless the user requests another functional change first. Do not broaden it into the Phase-F generic transport/pathfinding cleanup without an explicit reason.

## Documentation rule

After every implementation phase or relevant spatial decision:

1. update this document's phase status and decisions,
2. update `architecture.md` / `architecture-detail.md` for architectural changes,
3. update `concept.md` / `concept-detail.md` for player-facing behavior changes,
4. check `src/handbook/*.md` for player-facing documentation changes,
5. keep `agents.md` pointing to this plan while the rework remains active.
