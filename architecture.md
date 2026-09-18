# Architecture

This file is the current architectural entry point. Detailed unchanged subsystems remain documented in [`architecture-detail.md`](./architecture-detail.md). If the two files conflict, this file describes the newer state.

The completed fine-grid/resource migration is recorded in [`FINE_GRID_RESOURCE_REWORK_PLAN.md`](./FINE_GRID_RESOURCE_REWORK_PLAN.md). It remains the reference for changes to map scale, terrain, resources, loose goods, movement, placement, roads or logistics.

Until version 1, backward compatibility is deliberately not maintained when it would require migrations, compatibility defaults, parallel legacy paths or special conditional logic. The current architecture and data formats are authoritative.

## Technology and boundaries

The prototype is a browser-first TypeScript application using TypeScript, Vite and Phaser 4, deployed statically through GitHub Pages.

```text
src/
  simulation/   deterministic authoritative world state and rules
  game/         Phaser rendering and map input
  buildings/    shared building visual/spatial contracts and registry
  assets/       runtime-ready building exports and other assets
  ui/           DOM overlays and controls
  handbook/     player-facing Markdown help
  debug/        performance diagnostics

building-editor/   desktop-first building authoring subpage
```

The deterministic simulation stays independent from Phaser. Presentation reads simulation state and never owns authoritative game state. The simulation runs at 60 ticks/s at displayed 1×; rendering is decoupled and driven by `requestAnimationFrame`.

## Simulation entry point

`src/simulation/simulation.ts` is the public simulation entry point and wraps/re-exports core behavior. `simulationCore.ts` is a scheduling/work-area facade around the historical core implementation in `simulationCoreEngine.ts`.

Autonomous target selection is event-driven where possible. Hunger, missing work and related fallback decisions use the existing one-second cadence instead of replanning every simulation tick.

## Fine-grid spatial model

The authoritative spatial grid is a 5× linear refinement of the former coarse map:

```text
old logical world       41 × 25 coarse cells
refinement              5× per linear axis
current simulation      205 × 125 micro-cells
```

`src/simulation/spatial.ts` owns scale conversions. `src/simulation/hex.ts` owns cached coordinate lookup, movement legality and heap-backed A*. `src/game/mapProjection.ts` owns the shared affine projection and visible hex geometry; the building editor consumes the same projection.

Buildings and fields occupy many micro-cells while preserving their intended world-space size. The fine grid is a simulation mechanism and should not visually dominate the game.

## Terrain, resources and physical goods

Terrain describes only underlying ground. Trees, clay and stone are independent natural-resource objects with their own footprints and movement blocking. Blocking resources are interacted with from reachable neighboring cells rather than entered.

`World.looseGoods` is authoritative for physical raw goods. Loose stacks contain one good type, 1–3 units plus reservations, never block movement, and survive the disappearance of their source.

The physical raw-resource chain is:

```text
natural source -> extractor -> loose ground stack -> pickup -> consumer/storage
```

There is no fake natural-resource mirror for loose goods and no hidden HQ storage proxy.

## Generic editor-authored building definitions

`src/buildings/buildingVisualDefinition.ts` defines version 3 of the shared editor/runtime spatial schema:

```text
sprite
spriteAnchor      normalized x/y inside the source image
spriteWorldWidth  rendered width in world pixels
footprint
blocked
entrance
```

Gameplay properties such as recipes, workers, inventory, costs and technology stay outside this schema.

Sprite placement is intentionally independent from source-image resolution. `spriteAnchor` is stored as a relative position in the image and `spriteWorldWidth` is the authoritative rendered width in world pixels. Replacing a sprite with the same artwork at a higher pixel resolution therefore does not require recalculating its world size or anchor. The editor exports the selected PNG/WebP bytes without dimensional downscaling; runtime quality is determined by the supplied source asset rather than by a generated low-resolution copy.

`src/buildings/buildingDefinitionRegistry.ts` is the runtime registry. It maps a gameplay `BuildingKind` to a validated visual/spatial definition and sprite URL. A registered definition is authoritative for every current instance of that building kind; there is no per-instance compatibility or migration gate. `visualDefinitionId` may still be present as runtime/save metadata, but it does not select an older definition or suppress the current registry entry.

Every current `BuildingKind`, including `field`, has a same-key asset slot under `src/assets/buildings/<key>/`. Each slot contains `building.json` plus a sprite file. Types without a finished editor export use an explicit `{"placeholder": true, ...}` JSON and a transparent placeholder image; the registry imports these slots but skips placeholder JSONs, so current gameplay remains unchanged until a real export replaces the two files. Future `BuildingKind`s must receive the same-key slot in the same implementation run. There is intentionally no CI/build failure just for a placeholder slot.

The currently active editor definitions are HQ, bakery, farm, well and mill. For a registered building, the editor placement coordinate is the **visual/spatial anchor**. The simulation stores `Building.position` as the gameplay **interaction coordinate**, which is the authored `entrance`. The visual anchor is recovered deterministically as `position - entrance`. This preserves the existing simulation convention that workers, carriers and other systems route to `Building.position`, while the sprite and footprint remain aligned exactly as authored.

The authoritative footprint and collision semantics for registered buildings are therefore:

- `footprint` comes from the current registered `building.json` translated by the visual anchor;
- `blocked` becomes the derived `Tile.buildingBlocking` overlay;
- footprint cells not in `blocked` remain walkable;
- the authored `entrance` must be inside the footprint and not blocked;
- building kinds with placeholder definitions continue to use their current hard-coded spatial fallback.

`src/game/buildingSprites.ts` is the generic Phaser renderer for registered definitions. It loads registered sprites once, creates one sprite per completed building instance of a registered kind, derives the visual anchor from the building interaction coordinate, applies the normalized Phaser origin, and sets the display size from `spriteWorldWidth` plus the source aspect ratio. The renderer does not own placement or collision state.

Activating another editor-authored runtime building now consists only of replacing `building.json` and the sprite inside the existing same-key asset slot. No additional registry edit is required for current kinds because every current kind is already wired through `register(...)`. When a new `BuildingKind` is introduced in code, its same-key asset slot and registry registration are added in that same implementation run.

## Placement, clearance and demolition

`src/simulation/buildingPlacement.ts` remains authoritative for placement legality. For registered kinds it uses the editor footprint; otherwise it uses the current hard-coded shape table. The placement clearance is a compact ring of two micro-cells around whichever footprint is authoritative.

Active natural-resource footprints reserve both the building footprint and the two-micro-cell clearance ring. Loose goods block only the actual footprint because they remain walkable and may stay in the surrounding clearance area.

For registered placeable buildings, construction stores the interaction position at the authored entrance, writes the authored footprint and `buildingBlocking` overlay, and otherwise preserves the existing construction/gameplay semantics.

Demolition restores the complete footprint, clears the building collision overlay and stale traffic state, and preserves the existing rule that a road covered by construction returns as grass rather than reappearing.

Construction requirements are centralized in `src/simulation/constructionRules.ts`. `buildingPlacement.ts` derives construction plans and durations from these shared requirements instead of owning a second cost table. The same module maps processed construction goods to the building type that produces them, so progression can derive prerequisites from actual construction costs.

## Storage and transport

HQ and warehouses use the same first-class storage semantics. Production workers/building carriers may fetch required goods from either storage type. Storage carriers deliver directly into their assigned warehouse/HQ inventory.

Automatic storage-to-storage collection remains forbidden. Warehouse merchants retain explicit warehouse-to-warehouse routes. Builders and production-building carriers retain their separate long-distance/demand-driven sourcing rules.

## Idle positions, indoor visibility and staffing markers

Idle positioning is authoritative simulation state through `Person.idleTarget`. Only final waiting positions are reserved; people may still cross the same cells while moving. Free people and idle builders wait outside the HQ, natural-resource workers wait around their personal work-area flag, and assigned building staff wait outside their workplace. A deterministic spread picks a reachable free stand position near the relevant anchor rather than stacking people at the entrance. Candidate stand positions are ranked cheaply first. Nearby idle moves use a bounded local search; only genuinely distant fallback movement uses normal A*. This prevents fresh-world idle placement from fanning out into expensive global path searches.

Building activities still use the authored entrance as their interaction coordinate. Presentation hides the person's normal world representation only while an actual building activity is underway there, such as production work, eating from a building or sleeping in a house. The body marker, name/activity labels and carried-good marker are hidden together. Existing person selection remains active and keeps only its selection ring at the entrance. Merely crossing a walkable footprint cell does not hide the person.

Assigned staffing is also visualized without changing simulation rules: completed buildings show small presentation-only flags next to the entrance, blue for workers and red for carriers. Multiple flags are stacked compactly.

Demolishing a building immediately cancels activities that depend on that building. Assigned people lose the removed workplace, indoor need actions are interrupted, and anyone who was hidden becomes visible immediately before normal replanning continues.

## Work areas

Woodcutters, clay diggers, stonecutters, warehouse carriers and HQ carriers use per-person `WorkArea` state. The shared radius remains 2.5 coarse world tiles / 12.5 micro-cells.

Extractor flags start at the first selected resource. Storage-carrier flags start at their storage workplace. Moving a flag invalidates an unpicked source outside the new area but does not discard already carried cargo. Production carriers are deliberately outside this system.

## Hunger, sleep, farms, roads and progression

Hunger and sleep retain their event-driven target planning. Both needs begin autonomous planning at 40%, while player-facing warning state is deliberately separate: yellow at 30% and red at 20%. Hunger is sampled once per simulated second while movement and production continue at 60 Hz. Entering sleep pauses activity without clearing profession, workplace, extractor role or current resource assignment.

Nature sleep targets are intentionally **not reserved** while a person is travelling. Trees and bushes enforce single occupancy only at arrival: if another person is already sleeping on the target, the arriving person replans from that position while excluding only the occupied target that was just reached. Ground sleep has no occupancy restriction.

Farm balance is unchanged. Field footprints must remain valid grass and cannot overwrite natural resources, loose goods, reservations or occupied cells.

Organic roads still require eight qualifying crossings within 32 simulated seconds and retain the 1.3× movement multiplier. Roads cannot cover active natural-resource footprints.

Profession experience remains persistent from 0–100, with +1 XP per completed professional action. Technology unlocks remain permanent and placement enforcement remains in the simulation layer.

`src/simulation/technology.ts` evaluates two independent prerequisite classes. Profession rules unlock the corresponding production building at the configured XP threshold. Separately, every building derives the producers required for its processed construction goods from `constructionRules.ts`. Such a building unlocks only after every required producer has at least one completed, non-retired building instance. An unfinished construction site does not count. For technologies that have both a profession rule and processed-material prerequisites, both conditions must be satisfied. Once added to `World.unlockedTechnologies`, the unlock is never revoked if the qualifying person disappears or the producer building is later demolished.

Player-facing worlds start with only the explicitly declared `STARTING_TECHNOLOGIES`; neutral test/sandbox worlds that omit `World.unlockedTechnologies` stay permissive. The simulation wrapper calls `updateTechnologyUnlocks` after each authoritative tick, so completion of a production building can unlock dependent construction immediately on that tick.

## Rendering and interaction

Rendering stays decoupled from simulation ticks. `IncrementalMainScene` caches map/person presentation state; natural resources, loose goods, work-area flags and registered building sprites are presentation layers over authoritative simulation state.

Camera zoom remains 0.7×–10× for mouse-wheel and pinch. Building assets intended to remain crisp at the upper zoom range should therefore retain substantially more source pixels than their normal world-space display size. Desktop and touch remain first-class input adapters, with the iPhone 13 Mini as the mobile baseline.

## Building editor

`building-editor/` is a separate Vite multi-page entry published at `/civilizations-poc/building-editor/`. It is an internal desktop-first authoring tool and does not start Phaser or own simulation state.

The editor is WYSIWYG against the runtime projection. A fixed editor-only preview zoom enlarges both grid and sprite together, so their size relationship matches the game. Sprite size is authored as world-space width rather than as a multiplier of source pixels, and the anchor is authored as a percentage/relative image position. Runtime-ready exports live under `src/assets/buildings/<id>/`.

The selected sprite file is exported unchanged; the editor does not downscale or recompress it. The current schema is authoritative and intentionally has no backward-compatibility layer for older visual-definition versions. During local development the editor can write validated exports directly into the runtime asset folder; the published editor downloads the JSON and sprite instead.

## Save/load persistence

`src/simulation/saveGame.ts` owns the versioned JSON save format. Saves remain anchor/interaction-point based rather than snapshotting derived geometry: `tiles`, entity footprints and underlying building terrain are not persisted.

For a registered editor-authored building, the save stores the building's gameplay interaction position (`Building.position`, i.e. its entrance) plus ordinary gameplay state. `visualDefinitionId` may be serialized as metadata, but load-time spatial behavior is derived from the current registry definition for the building kind rather than from a historical definition snapshot.

On load, registered kinds reconstruct the visual anchor, footprint and blocked collision overlay from the current registry definition. Building kinds with placeholder definitions reconstruct from their current code-defined shape rules. Static terrain is regenerated from the deterministic base map; roads, traffic history and bushes remain sparse persisted map state.

The save format remains `civilizations-save` **version 3**. The visual-definition schema version is separate from the save version. Before v1, older save versions or data shapes are not migrated when compatibility would require special handling; they may be rejected or break as the current model changes.

Loading and starting a new game still replace the contents of the existing shared `World` object instead of swapping its identity, so Phaser and UI modules keep valid references.

## Person status overview

`src/ui/personAlerts.ts` derives a single current alert per person from authoritative simulation state. Severity precedence is `critical > warning > info`, so one person contributes to at most one HUD/list count. The first rules cover critical/normal hunger and sleep plus truly free idle people. Need alerts reuse the same display-status helpers as the world icons, so the list, counters and filters stay aligned at 30% warning / 20% critical while simulation planning may already have started at 40%. The classifier deliberately does not infer missing-resource failures from generic inactivity.

`src/ui/personPanel.ts` caches this derived alert map and refreshes it once per second. The same cached result drives the compact counts on the People menu button, the three severity filters and the per-person reason shown in the browser. This remains presentation-derived state and is not persisted in `World`.

## Performance diagnostics

The debug profiler keeps short rolling in-memory timing windows for live inspection. `src/debug/performanceRecording.ts` adds an explicit user-started recording layer without changing simulation behavior: while active, it samples the existing profiler once per real second, adds compact world-size counters, and stores the samples only in browser memory. Stopping the recording produces a versioned `civilizations-performance-recording` JSON export with metadata, a per-second time series, and an automatically calculated summary of FPS, frame/tick costs, feature costs and pathfinding causes. The recorder deliberately does not emit per-tick logs or add new simulation scans.

## Existing architecture

All other unchanged systems remain documented in [`architecture-detail.md`](./architecture-detail.md), including production, inventories, merchants, person selection, handbook/PWA behavior and performance diagnostics. Where older detail text conflicts with this file, this file is authoritative.

## Testing and deployment

`npm test` is the deterministic Node suite. `npm run build` performs TypeScript checking and the Vite production build. Coverage includes building-visual schema validation, resolution-independent sprite metadata, registered-building entrance/footprint/blocking behavior, placement/demolition, physical goods, logistics, work areas, technology progression and save/load reconstruction.

Vite builds both the game root and `building-editor/index.html`. GitHub Pages publishes both from the same `dist` artifact.

Per `agents.md`, implementation work happens on a temporary branch and is transferred to `main` as one final squash commit. The main deployment workflow runs tests before the production build and deploys only after both succeed.
