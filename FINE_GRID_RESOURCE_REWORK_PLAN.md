# Fine Grid & Physical Resources Rework

## Status

**Active planning document.** This document must be read before changes to map scale, terrain, buildings, people rendering/scale, natural resources, loose goods, pathfinding, roads, placement, or resource logistics.

Current state: **Planning complete, implementation not started.**

## Goal

Move the prototype from a coarse grid with resource nodes that hold abstract local output to a much finer spatial model inspired by the original game:

- much smaller simulation cells while keeping the visible world approximately the same size,
- buildings occupy substantially more cells while keeping roughly their current screen-space size,
- people remain continuously animated and become slightly larger in screen space relative to the new micro-grid,
- trees and other natural resources are individual world objects,
- extracted raw materials are physical loose goods placed on the ground,
- one ground cell may hold 1–3 units of the same loose good,
- extractors search for a nearby valid drop position instead of writing output into an abstract resource pool,
- carriers and production workers collect physical goods from those positions.

The grid is authoritative for spatial simulation. It should not become visually dominant; terrain should still read as a continuous landscape rather than a board game.

## Guiding constraints

- Keep the deterministic simulation independent from Phaser.
- Rendering stays decoupled from simulation ticks and movement remains visually continuous.
- Desktop and touch must both remain first-class interaction modes.
- Each phase must leave `main` playable and testable on its own.
- Do not combine multiple large migrations into one phase just to avoid temporary compatibility code.
- Avoid full-map scans on the fine grid. Prefer event-driven updates and spatial indexing where necessary.
- Existing behavior outside the active phase should remain unchanged unless explicitly documented here.

## Target scale

Working hypothesis for Phase A: reduce the linear cell size to roughly **1/5 of the current grid scale** while keeping the visible map footprint approximately comparable.

The exact factor is not considered final until Phase A is playable and performance-tested. A 5× linear refinement would turn the current 41 × 25 logical world into roughly 205 × 125 cells (~25,000 cells), so algorithms that scan all tiles frequently must be reviewed.

Buildings should keep approximately their current perceived size and therefore gain much larger footprints in cell counts. People should **not** be scaled by the same factor as the grid; their sprites/markers should instead be adjusted slightly upward in screen space so they remain readable and proportionate to buildings.

## Target resource model

### Natural resource sources

A forest is not one resource node. It is a spatial cluster of individual tree objects. The same principle applies to clay, stone and later ore or other extractable resources.

Each source object has its own position and depletion state. Resource regions may be irregular and differ in density.

### Loose goods on the ground

Extracted raw materials are represented independently from their source.

A ground stack has:

- a concrete map cell,
- one good type,
- an integer amount from 1 to 3.

Different good types do not initially share one cell. A stack disappears when its amount reaches zero.

### Extractor behavior

For one completed extraction action:

1. choose/retain a concrete resource source,
2. reach the source,
3. extract one unit,
4. find a drop cell near the source,
5. prefer an existing non-full stack of the same good,
6. otherwise choose the nearest suitable free cell,
7. place the unit there,
8. only then count the action as completed for profession XP,
9. continue at the source or select a new source if depleted.

### Logistics behavior

Carriers and production workers collect raw materials from loose ground stacks rather than from `NaturalResource.output`. Reservations must therefore protect concrete available units on stacks. Collection reduces a stack from 3 → 2 → 1 → removed.

Building inventories remain normal inventories for now. This rework concerns loose goods outside buildings first.

## Phases

### Phase A — Spatial rework

**Purpose:** establish and validate the finer spatial scale without changing the resource economy.

Planned work:

- refine the map grid,
- preserve approximately the current visible world size,
- scale building footprints and their clearance rules to the new spatial model,
- keep buildings approximately their current screen-space size,
- slightly increase person sprite/marker size relative to the new micro-grid,
- adapt camera bounds, zoom assumptions and map rendering,
- adapt pathfinding and movement units while keeping continuous movement,
- adapt organic-road generation to the finer grid,
- adapt building placement, ghost display and validation,
- verify desktop mouse interaction and touch pan/tap/pinch interaction,
- review performance for algorithms that currently scan the complete map,
- keep the existing natural-resource model temporarily functional.

**Done when:** the game is playable with the finer grid, buildings/people read at sensible visual scale, existing logistics still function, placement works on desktop and touch, and automated tests/build pass.

Status: **not started**.

### Phase B — Physical resource data model

**Purpose:** add the new source/ground-stack representation without yet migrating the whole economy.

Planned work:

- replace the assumption that a resource source owns produced local output,
- model individual extractable source objects suitable for trees, clay, stone and future resources,
- introduce loose ground-good stacks with capacity 3,
- introduce deterministic helpers for stack lookup, placement, reservation and removal,
- add spatial lookup/indexing as needed to avoid repeated whole-map scans,
- add rendering support for individual source objects and 1/2/3-unit ground stacks,
- preserve compatibility with old extraction flow until Phase C completes the first end-to-end chain.

**Done when:** sources and loose goods can exist, render and be queried deterministically, with focused tests, while the existing playable economy still works.

Status: **not started**.

### Phase C — Wood end-to-end reference chain

**Purpose:** prove the complete new model with wood before generalizing it.

Planned work:

- forests become clusters of individual trees,
- wood extractors target concrete trees,
- each completed extraction produces one physical wood unit,
- extractors place wood into nearby stacks of max. 3,
- drop-position search prefers compatible non-full stacks before empty cells,
- carriers and sawmill workers source wood from those stacks,
- reservations operate on stack quantities,
- depletion removes the individual tree and triggers target selection,
- profession XP is awarded only after successful ground placement,
- remove the old forest-local-output path once no longer required.

**Done when:** tree → extraction → ground stack → pickup → sawmill works without an abstract forest output pool.

Status: **not started**.

### Phase D — Clay and stone migration

**Purpose:** generalize the proven wood behavior.

Planned work:

- migrate clay sources and clay extractors,
- migrate stone sources and stone extractors,
- use the same ground-stack and reservation rules,
- remove obsolete generic resource-output compatibility paths,
- keep the model data-driven for later ore and other resource types.

**Done when:** wood, clay and stone all use the same physical source → ground goods → logistics model.

Status: **not started**.

### Phase E — Visual/resource-density pass

**Purpose:** make the new model visually useful rather than merely technically correct.

Planned work:

- irregular forest clusters with individual trees,
- irregular clay/stone fields with visibly separate source pieces,
- clear 1/2/3-unit stack representations,
- avoid exposing the micro-grid visually in normal play,
- tune resource and person visual scale against buildings and roads,
- confirm selection/hit targets remain usable on iPhone 13 Mini and desktop.

Status: **not started**.

### Phase F — Cross-system cleanup and performance

**Purpose:** remove compatibility code and validate all systems against the new spatial/resource model.

Review at minimum:

- hunger/sleep nature targeting,
- farms and fields,
- building clearance and demolition,
- roads and traffic thresholds,
- warehouse/HQ collection radius semantics,
- merchant behavior,
- construction material pickup,
- pathfinding cost/performance,
- person selection and camera focus,
- save/load assumptions when introduced,
- handbook text,
- concept and architecture documentation,
- automated regression coverage.

Status: **not started**.

## Decisions already made

- The fine grid is a simulation/spatial mechanism, not a visual tile aesthetic.
- Buildings become many cells large instead of becoming visually tiny.
- People are scaled slightly in screen space; they are not shrunk to match micro-cells.
- Natural resource regions are collections of individual sources rather than one large pool.
- Extracted raw resources exist as physical loose goods.
- Loose ground stacks hold at most 3 units of one good type.
- Extractors choose real drop positions and prefer nearby compatible stacks with free capacity.
- Phases A and B are intentionally separate so spatial regressions can be isolated from resource-model regressions.

## Open decisions

Resolve these during the relevant phase rather than inventing them early:

- exact final grid refinement factor after Phase A play/performance testing,
- exact building footprint dimensions on the fine grid,
- exact person sprite scale increase,
- whether trees occupy one cell or a small collision footprint while rendering larger than their logical footprint,
- maximum drop search radius and tie-breaking rules,
- whether loose stacks block movement or remain walkable,
- whether different loose goods may later coexist on one cell,
- exact resource cluster density and regeneration rules for future renewable resources.

## Documentation rule

After every implementation phase:

1. update this document's phase status and record relevant decisions,
2. update `architecture.md` / `architecture-detail.md` for architectural changes,
3. update `concept.md` / `concept-detail.md` for player-facing behavior changes,
4. check `src/handbook/*.md` for player-facing documentation changes,
5. keep `agents.md` pointing to this plan while the rework remains active.
