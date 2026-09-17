# Architecture

This file is the current architectural entry point. Detailed unchanged subsystems remain documented in [`architecture-detail.md`](./architecture-detail.md). If the two files conflict, this file describes the newer state.

The completed fine-grid/resource migration is recorded in [`FINE_GRID_RESOURCE_REWORK_PLAN.md`](./FINE_GRID_RESOURCE_REWORK_PLAN.md). It remains the reference for changes to map scale, terrain, resources, loose goods, movement, placement, roads or logistics.

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

`src/buildings/buildingDefinitionRegistry.ts` is the runtime registry. It maps a gameplay `BuildingKind` to a validated visual/spatial definition and sprite URL. Registry availability and runtime use are deliberately separate:

- a kind may have a registered editor definition;
- a concrete `Building` uses that definition only when its `visualDefinitionId` is bound to the registered definition;
- this allows buildings to be migrated gradually without changing unrelated legacy fixtures or buildings.

The player-facing HQ is the first fully bound building. The neutral `createWorld()` test/sandbox world intentionally keeps its historical simplified HQ geometry, while `createDefaultGameWorld()` binds the player HQ to the editor export.

For a bound building, the editor placement coordinate is the **visual/spatial anchor**. The simulation stores `Building.position` as the gameplay **interaction coordinate**, which is the authored `entrance`. The visual anchor is recovered deterministically as `position - entrance`. This preserves the existing simulation convention that workers, carriers and other systems route to `Building.position`, while the sprite and footprint remain aligned exactly as authored.

The authoritative footprint and collision semantics for bound buildings are therefore:

- `footprint` comes from the registered `building.json` translated by the visual anchor;
- `blocked` becomes the derived `Tile.buildingBlocking` overlay;
- footprint cells not in `blocked` remain walkable;
- the authored `entrance` must be inside the footprint and not blocked;
- legacy/unbound buildings keep their existing hard-coded footprint fallback.

`src/game/buildingSprites.ts` is the generic Phaser renderer for bound definitions. It loads registered sprites once, creates one sprite per bound completed building instance, derives the visual anchor from the building interaction coordinate, applies the normalized Phaser origin, and sets the display size from `spriteWorldWidth` plus the source aspect ratio. The renderer does not own placement or collision state.

Adding another editor-authored runtime building therefore consists primarily of adding its validated asset export under `src/assets/buildings/<id>/`, registering it for the corresponding gameplay kind, and binding new runtime instances. Existing gameplay rules remain separate.

## Placement, clearance and demolition

`src/simulation/buildingPlacement.ts` remains authoritative for placement legality. For registered kinds it uses the editor footprint; otherwise it uses the legacy shape table. The existing one-coarse-tile clearance ring is computed around whichever footprint is authoritative.

Active natural-resource footprints reserve both the building footprint and clearance ring. Loose goods block only the actual footprint because they remain walkable and may stay in the surrounding clearance area.

For future registered placeable buildings, construction stores the interaction position at the authored entrance, binds the visual definition, writes the authored footprint and `buildingBlocking` overlay, and otherwise preserves the existing construction/gameplay semantics.

Demolition restores the complete footprint, clears the building collision overlay and stale traffic state, and preserves the existing rule that a road covered by construction returns as grass rather than reappearing.

## Storage and transport

HQ and warehouses use the same first-class storage semantics. Production workers/building carriers may fetch required goods from either storage type. Storage carriers deliver directly into their assigned warehouse/HQ inventory.

Automatic storage-to-storage collection remains forbidden. Warehouse merchants retain explicit warehouse-to-warehouse routes. Builders and production-building carriers retain their separate long-distance/demand-driven sourcing rules.

## Work areas

Woodcutters, clay diggers, stonecutters, warehouse carriers and HQ carriers use per-person `WorkArea` state. The shared radius remains 2.5 coarse world tiles / 12.5 micro-cells.

Extractor flags start at the first selected resource. Storage-carrier flags start at their storage workplace. Moving a flag invalidates an unpicked source outside the new area but does not discard already carried cargo. Production carriers are deliberately outside this system.

## Hunger, sleep, farms, roads and progression

Hunger and sleep retain their documented behavior and event-driven target planning. Hunger is sampled once per simulated second while movement and production continue at 60 Hz.

Farm balance is unchanged. Field footprints must remain valid grass and cannot overwrite natural resources, loose goods, reservations or occupied cells.

Organic roads still require eight qualifying crossings within 32 simulated seconds and retain the 1.3× movement multiplier. Roads cannot cover active natural-resource footprints.

Profession experience remains persistent from 0–100, with +1 XP per completed professional action. Technology unlocks remain permanent and placement enforcement remains in the simulation layer.

## Rendering and interaction

Rendering stays decoupled from simulation ticks. `IncrementalMainScene` caches map/person presentation state; natural resources, loose goods, work-area flags and registered building sprites are presentation layers over authoritative simulation state.

Camera zoom remains 0.7×–10× for mouse-wheel and pinch. Building assets intended to remain crisp at the upper zoom range should therefore retain substantially more source pixels than their normal world-space display size. Desktop and touch remain first-class input adapters, with the iPhone 13 Mini as the mobile baseline.

## Building editor

`building-editor/` is a separate Vite multi-page entry published at `/civilizations-poc/building-editor/`. It is an internal desktop-first authoring tool and does not start Phaser or own simulation state.

The editor is WYSIWYG against the runtime projection. A fixed editor-only preview zoom enlarges both grid and sprite together, so their size relationship matches the game. Sprite size is authored as world-space width rather than as a multiplier of source pixels, and the anchor is authored as a percentage/relative image position. Runtime-ready exports live under `src/assets/buildings/<id>/`.

The selected sprite file is exported unchanged; the editor does not downscale or recompress it. The current schema is authoritative and intentionally has no backward-compatibility layer for older visual-definition versions. During local development the editor can write validated exports directly into the runtime asset folder; the published editor downloads the JSON and sprite instead.

## Save/load persistence

`src/simulation/saveGame.ts` owns the versioned JSON save format. Saves remain anchor/interaction-point based rather than snapshotting derived geometry: `tiles`, entity footprints and underlying building terrain are not persisted.

For a bound editor-authored building, the save stores:

- the building's gameplay interaction position (`Building.position`, i.e. its entrance),
- `visualDefinitionId`,
- ordinary gameplay state.

On load, the registry reconstructs the visual anchor, footprint and blocked collision overlay from the bound definition. Unbound buildings reconstruct from their existing legacy shape rules. Static terrain is regenerated from the deterministic base map; roads, traffic history and bushes remain sparse persisted map state.

The save format remains `civilizations-save` **version 3**. The visual-definition schema version is separate from the save version; changing sprite-resolution metadata does not change authoritative saved gameplay state. Version 2 and older saves are rejected rather than guessed or migrated.

Loading and starting a new game still replace the contents of the existing shared `World` object instead of swapping its identity, so Phaser and UI modules keep valid references.

## Existing architecture

All other unchanged systems remain documented in [`architecture-detail.md`](./architecture-detail.md), including production, inventories, merchants, person selection, handbook/PWA behavior and performance diagnostics. Where older detail text conflicts with this file, this file is authoritative.

## Testing and deployment

`npm test` is the deterministic Node suite. `npm run build` performs TypeScript checking and the Vite production build. Coverage includes building-visual schema validation, resolution-independent sprite metadata, bound HQ entrance/footprint/blocking behavior, placement/demolition, physical goods, logistics, work areas and save/load reconstruction.

Vite builds both the game root and `building-editor/index.html`. GitHub Pages publishes both from the same `dist` artifact.

Per `agents.md`, implementation work happens on a temporary branch and is transferred to `main` as one final squash commit. The main deployment workflow runs tests before the production build and deploys only after both succeed.
