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

Phase A settled on a **5× linear refinement**:

```text
old logical world    41 × 25
current micro-grid   205 × 125
```

Visible world size remains approximately comparable. Buildings and fields expand to many micro-cells, movement/ranges are scaled to preserve world-space distances, and people remain larger than individual micro-cells.

## Terrain/resource separation

Terrain is only the underlying ground. Natural resources do not create special terrain types merely because they occupy a location.

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

### Blocking-resource interaction positions

Blocking cells are never entered merely because they are an explicit route target. When pathfinding is asked to reach a blocking target cell, it deterministically chooses the quickest reachable **walkable neighboring micro-cell** as the physical interaction position. The arrival point retains a logical reference to the blocked target, so existing work, pickup and need logic can still recognize that the person has reached the intended object without moving onto it.

This rule applies equally to weighted routing and step-count routing. Normal transit therefore never crosses or terminates on a blocking resource cell.

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
2. reach its valid interaction position,
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

Warehouse carriers and HQ carriers automatically collect only non-storage sources within **5 coarse world tiles**, equal to 25 micro-steps at the current refinement. Normal carriers never move goods automatically from one warehouse/storage inventory to another.

Production workers and builders may fetch needed inputs/materials from any reachable valid source; the local warehouse/HQ collection radius does not limit those demand-driven trips. Configured merchants are the explicit warehouse-to-warehouse transport mechanism and are likewise not limited by the local collection radius.

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
- one tree = one micro-cell resource object,
- one tree = exactly 3 wood,
- tree collision is separate from terrain,
- dense forest clusters retain walkable gaps.

**Status: complete.**

### Phase D — Clay and stone migration

Implemented:

- clay extraction produces physical `clay` ground stacks,
- stone extraction produces physical `rubble` ground stacks,
- clay and stone share the wood capacity/reservation/return-cargo compatibility flow,
- clay uses a compact four-cell non-blocking footprint,
- stone uses a compact four-cell blocking footprint,
- footprint, blocking and raw-good mapping are centralized in `naturalResources.ts`,
- placement reserves complete active resource footprints,
- depletion removes complete stone collision while dropped goods remain.

The generic trip/source model itself remains intentionally compatible through short-lived `ground-*` proxies until later Phase-F cleanup.

**Status: complete.**

### Phase E — Visual/resource-density pass

Implemented:

- every historical forest seed expands into three deterministic one-cell trees,
- tree patterns leave intentional walkable micro-cell gaps,
- clay and stone keep their four-cell logical footprints,
- clay/stone source anchors use deterministic spatial scoring,
- clay and stone render as multiple visible pieces,
- loose wood, clay and rubble have distinct silhouettes,
- 1/2/3-unit ground stacks use visibly different arrangements,
- reserved ground stacks receive a presentation-only highlight,
- the micro-grid remains hidden as a simulation mechanism.

**Status: complete.**

### Phase F — Cross-system cleanup and performance

Implemented in the current cleanup slices:

- autonomous work planning is event-driven instead of globally re-planning every idle worker once per second,
- arrival, delivery and completed work trigger immediate follow-up decisions,
- a worker that cannot find a valid task/source gets an individual one-second retry deadline,
- hunger and sleep retain their selected targets while travelling and re-evaluate at task boundaries,
- person markers are substantially smaller while remaining readable,
- desktop wheel and touch pinch zoom share a maximum camera zoom of 10×,
- explicit blocked-target interaction positions: pathfinding now stops on the quickest reachable walkable neighboring cell instead of entering a blocking resource cell,
- weighted and step-count routing share the same blocked-target interaction rule,
- regression coverage verifies that a woodcutter reaches and works a blocking tree while physically remaining on walkable ground,
- warehouse and HQ carrier collection is explicitly limited to five coarse world tiles / 25 micro-steps,
- normal carrier collection continues to exclude storage-to-storage transfer,
- configured merchant routes are explicitly independent from the local storage collection radius,
- construction-material pickup is explicitly independent from the local storage collection radius,
- regression coverage locks these logistics semantics across warehouse, HQ, merchant and builder flows,
- natural-resource depletion retirement is event-driven on actual extraction instead of scanning every resource on every 60-Hz simulation tick,
- the full depleted-resource scan is retained only as a one-second consistency fallback,
- performance diagnostics split work planning into resource cleanup, waiting profession pools and per-person decisions instead of one residual `planning` bucket.

Still review at minimum:

- hunger/sleep nature targeting as a product/behavior pass beyond the new generic blocked-target routing,
- farms and fields,
- building clearance and demolition,
- roads and traffic thresholds,
- generic trip/source representation after physical-resource migration,
- pathfinding cost/performance,
- person selection and camera focus,
- future save/load assumptions,
- handbook text beyond the completed resource/logistics updates,
- concept and architecture documentation beyond the completed resource/logistics updates,
- automated regression coverage for the remaining cleanup areas.

**Status: in progress.**

## Decisions already made

- The fine grid is a simulation/spatial mechanism, not a visual tile aesthetic.
- The final Phase-A refinement factor is 5× per axis.
- Terrain and natural resources are separate systems.
- Forest is a cluster of tree resource objects, not a required terrain type.
- Resource footprint and movement blocking are separate properties.
- Tree = 1 cell, blocking, 3 wood.
- Bush = 1 cell, non-blocking; the visual may exceed the cell.
- Mushroom = 1 cell, non-blocking.
- Clay = compact 4 cells, non-blocking.
- Stone = compact 4 cells, blocking.
- Ore target remains about 4 cells, blocking.
- Buildings become many cells large instead of visually tiny.
- People remain readable and are not shrunk to micro-cell size.
- Extracted raw resources become physical loose goods.
- Loose ground stacks hold at most 3 units of one good type and never block movement.
- Reservations protect concrete units without removing them before pickup.
- Wood, clay and rubble use a 5-micro-cell / one-old-step drop radius.
- Active resource footprints reserve construction/drop space even when non-blocking.
- Current forest density uses three trees per historical forest seed with deterministic variation.
- Clay/stone visual irregularity does not change their authoritative footprint.
- Autonomous target selection is retained while travelling; missing work targets retry per person at most once per second.
- Blocking route targets are interacted with from a walkable adjacent cell; the blocking target cell itself is not entered.
- Warehouse/HQ automatic carrier collection radius is 5 coarse world tiles / 25 micro-steps; production sourcing, construction sourcing and configured merchants are not constrained by this local radius.
- Camera zoom supports up to 10× on desktop and touch.

## Open decisions

Resolve these in the relevant phase rather than inventing them early:

- whether future maps should procedurally generate resource cluster density rather than use the current deterministic scenario seeds,
- whether different loose goods may later coexist on one cell (current rule: no),
- regeneration rules for future renewable resources.

## Handoff / next chat

Before continuing this rework:

1. read `agents.md`,
2. read this file,
3. read `architecture.md` and `architecture-detail.md`,
4. for product behavior also read `concept.md` and `concept-detail.md`,
5. confirm latest `main` CI is green.

Continue with **Phase F — cross-system cleanup and performance** unless the user requests another functional change first. Do not redesign unrelated economy/product systems as part of cleanup.

## Documentation rule

After every implementation phase or relevant spatial decision:

1. update this document's phase status and decisions,
2. update `architecture.md` / `architecture-detail.md` for architectural changes,
3. update `concept.md` / `concept-detail.md` for player-facing behavior changes,
4. check `src/handbook/*.md` for player-facing documentation changes,
5. keep `agents.md` pointing to this plan while the rework remains active.
