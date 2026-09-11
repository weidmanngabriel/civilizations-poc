# Architecture

## Technology stack

The prototype is a browser-first TypeScript application.

- Language: TypeScript
- Build tooling: Vite
- Game framework: Phaser 4
- Target: modern web browsers, deployed as a static site through GitHub Pages
- Mobile baseline: iPhone 13 Mini (375 × 812 CSS px)

## Architectural principle

The simulation core stays independent from Phaser.

```text
src/
  simulation/   # deterministic world state, economy, logistics and placement rules
  game/         # Phaser rendering, camera and map input
  ui/           # DOM controls, menus and information panels
```

Dependencies flow from presentation toward the simulation. `src/simulation/` must not import Phaser. Product rules remain deterministic and testable without a renderer.

## Simulation core

`model.ts` defines people, assignments, transport trips, merchant routes, farm tasks, recipes, buildings, fields, local inventories, terrain and world state.

`scenario.ts` owns the fixed 41 × 25 map and central balance constants.

`simulation.ts` owns the deterministic simulation tick, assignments, reservations, generic production, construction, profession pools, forest lifecycle, organic roads, merchant routes and status derivation.

`experience.ts` owns profession XP and its production, construction and logistics modifiers.

`farm.ts` owns field selection, field lifecycle, growth, fertilizing, harvest and farm cleanup.

`buildingPlacement.ts` owns multi-tile placement rules, footprints, clearance rings and construction plans. The exported `CONSTRUCTION_PLANS` are also the authoritative source for construction costs shown by the UI.

`movement.ts` derives continuous fractional world positions from deterministic simulation state. Phaser renders these positions but does not own gameplay movement.

## Simulation time and movement

At displayed 1×, simulation updates run at a fixed 60 Hz. Rendering remains on `requestAnimationFrame` and is independent from simulation speed.

People move continuously between Hex centers. Weighted pathfinding accounts for terrain travel cost. Roads have movement cost `1 / 1.3`, producing a 30 % speed advantage.

Organic roads are generated from recent traversal history on grass tiles. Eight traversals inside a 32-second rolling simulation-time window turn grass into road and trigger relevant route reassessment. There is no player-facing manual road editing UI.

## Buildings and construction

User-buildable kinds are warehouse, farm, sawmill, carpenter, mill, bakery and well. Buildings occupy multi-tile footprints and require a one-tile free clearance ring.

Current construction plans:

```text
Warehouse   4 wood    → 11 s base build time
Farm        4 wood    → 11 s base build time
Sawmill     6 wood    → 15 s base build time
Carpenter   4 planks  → 11 s base build time
Mill        4 wood    → 11 s base build time
Bakery      4 planks  → 11 s base build time
Well        4 wood    → 11 s base build time
```

Build duration is `(3 + 2 × required resource units) × simulationHz`. Up to two builders contribute simultaneously. A placed construction immediately occupies its footprint; normal building functionality remains disabled until completion.

## Production and inventories

Generic production uses local inputs and outputs. Only production outputs may contain fractional quantities from experience multipliers. Production inputs, warehouse inventories, reservations and trips remain whole-unit.

A trip reserves and transports exactly one unit. Warehouse carriers collect only from non-warehouse sources within 10 reachable tile steps. Warehouse-to-warehouse automation is reserved for merchants.

Current generic chains include forest → wood, sawmill → planks, carpenter → wooden tools, mill → flour and bakery → bread. The well is an infinite water source. Farm production is handled separately because it is spatial and multi-stage.

## Farm and fields

Fields are lightweight one-tile building entities owned by a farm. A farmer maintains at most four active fields within three Hex steps of the farm footprint. Sowing and harvesting take 10 seconds; natural growth stages take 30 seconds; fertilizing advances remaining growth at triple speed.

Harvest returns the tile to grass immediately. The farmer physically carries one wheat back to the farm before starting the next task. Warehouse carriers then collect wheat from the farm.

## DOM UI

`ui/controls.ts` owns the existing overlays, building detail panels, placement confirmation/cancellation, merchant target mode, simulation-speed controls and the real-time simulation accumulator.

`ui/buildMenu.ts` owns the left-side main menu. It currently exposes one entry, **Bauen**, and renders the available building list from the authoritative construction plans. Selecting a building starts the existing placement mode rather than duplicating placement logic.

Normal tile-selection events are intercepted before `ui/controls.ts`, so tapping or clicking an empty tile no longer opens a tile action panel. The build-menu adapter permits one internal tile-selection event only long enough to invoke the existing building-selection entry point synchronously; the selection is immediately cleared when placement mode starts. This keeps the current placement implementation unchanged while the PoC transitions away from tile-driven build menus.

The left menu is a DOM overlay with its own responsive stylesheet (`build-menu.css`). It is positioned inside mobile safe-area constraints and remains compact on the iPhone 13 Mini baseline.

Map building selection remains unchanged: clicking any occupied footprint cell selects the building and opens its compact control panel. Active fields are not normal selectable production buildings.

## Rendering and interaction

`game/MainScene.ts` renders the world through Phaser. `Phaser.Scale.RESIZE` keeps the canvas fitted to the viewport.

Build placement remains modal: valid anchors are highlighted, the ghost is initially absent, short tap/click chooses or moves the ghost, dragging pans the camera, pinch zoom remains active, and only the DOM **Bauen** button confirms placement.

Merchant target selection remains a separate modal map mode that pauses simulation and restores the previous state afterward.

## Testing

`npm test` runs deterministic Node tests through `tsx`. `npm run build` performs TypeScript checking and the Vite production build.

Core regression coverage includes placement, construction, movement, decision cadence, forest relocation, merchant routes, worker inputs, reservations, deterministic replay, farm lifecycle and profession experience.

## Build and deployment

Vite injects `process.env.BUILD_TIME`; the UI displays it in the `Europe/Berlin` timezone.

`.github/workflows/deploy.yml` runs tests and a production build for pushes to `main`, then deploys GitHub Pages. Branch pushes do not deploy. Vite base path remains `/civilizations-poc/`.
