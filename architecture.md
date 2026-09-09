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
  simulation/   # world state, entities, economy, logistics, placement rules
  game/         # Phaser rendering, camera, map input
  ui/           # DOM controls and information panels
```

Dependencies flow from presentation toward the simulation. `src/simulation/` must not import Phaser. Product rules remain deterministic and testable without a renderer.

## Simulation core

`src/simulation/model.ts` defines people, assignments, transport trips, merchant routes, recipes, buildings, local inventories, terrain and world state. Buildings have stable string IDs plus a separate `kind`, so multiple warehouses, sawmills and carpenter shops can coexist.

Buildings may additionally carry a `footprint` containing all occupied Hex positions and `baseTerrains` used to restore every occupied tile on demolition. Their logical `position` remains the anchor used by jobs, inventory and transport routing.

`scenario.ts` owns the fixed **41 × 25** map and central balance constants. The initial world contains eight people, one multi-tile HQ, passive forest groups, water and mountains. There are no initial roads.

`simulation.ts` owns deterministic in-place simulation steps, assignment changes, reservations, production, forest claiming/depletion, low-level building creation/removal, road editing, organic road formation, merchant routes and status derivation.

`buildingPlacement.ts` owns user-facing multi-tile placement rules. It defines per-building footprints, calculates the one-tile clearance ring, validates placement, wraps building creation so every footprint tile is occupied, and restores all saved terrain on demolition. This keeps spatial placement policy out of Phaser and the DOM UI.

`movement.ts` derives each person's continuous fractional world position from deterministic simulation state. Phaser consumes that position but does not invent renderer-owned movement.

## Fixed simulation time

At displayed 1×, the simulation keeps its fixed **60 Hz** update cadence. `tick()` is still called about 60 times per real second, so movement receives a fresh deterministic state every display frame on a typical 60 Hz screen.

The slower game pace is implemented in the balance constants instead of reducing tick cadence:

- normal production duration: 240 ticks, about 4 real seconds at 1×,
- base movement: `2.5 / 60` tile-distance per tick, or 2.5 tiles/second at 1×,
- organic-road traffic window: 1920 ticks, or 32 seconds at 1×.

These values are exactly one quarter of the previous movement rate / four times the previous durations, so gameplay remains 75% slower while the state update frequency remains fine-grained.

Autonomous planning is intentionally slower than the fixed simulation step. `CONFIG.decisionIntervalTicks` is 60, so idle source selection, merchant planning and retries for waiting woodcutters run once per simulated second. The first fixed tick is also a decision tick so newly configured actors can react immediately at startup. Event-driven transitions bypass that cadence: arriving at an assigned workplace, completing a delivery and completing production mark the affected person for an immediate follow-up decision in the same tick. Forest depletion directly reassigns its woodcutter. Movement, pickup, delivery, production progress and reservation state therefore remain responsive without performing expensive path/source searches 60 times per second.

The UI still uses a `requestAnimationFrame` accumulator and the relative speed choices `0.5`, `1`, `2`, `3`. Rendering stays on the browser animation loop and is independent from simulation speed. Pausing stops simulation advancement while Phaser continues to render and accept camera input.

## Navigation and movement

`src/simulation/hex.ts` provides axial neighbors and two navigation modes:

- `findPath()` uses weighted Dijkstra routing and minimizes travel time,
- `findPathBySteps()` uses unweighted BFS and measures reachable tile steps.

Walkable terrain: grass, road, forest, building.
Blocked terrain: mountain, river.

Tiles are navigation waypoints, not the visible movement unit. `Person.position` is the last reached tile centre, `Person.path[0]` is the next waypoint and `Person.movement` is fractional progress along that edge.

Normal terrain costs 1.0 movement. Roads cost `1 / 1.3`, giving a 30% speed increase. The same costs drive both route choice and visible movement.

The warehouse collection radius uses `findPathBySteps()` so faster roads do not enlarge the radius.

## Organic roads

Grass records recent traversal timestamps in `Tile.trafficTicks`.

- threshold: 8 traversals,
- rolling window: 32 seconds at 1× / 1920 ticks,
- on threshold: grass becomes road immediately,
- current tasks reroute so agents can exploit new roads.

Roads persist. Manual road editing remains available.

## Multi-tile buildings

User-facing buildable kinds are warehouse, sawmill and carpenter. The HQ is also multi-tile in the initial scenario.

Current footprints:

```text
HQ          4 tiles
Warehouse   4 tiles
Sawmill     6 tiles
Carpenter   4 tiles
```

A footprint is expressed as absolute axial Hex positions once placed. The anchor remains the building's transport/job target.

### Placement validation

`buildingPlacement.ts` applies one authoritative rule before a building can be created:

- every footprint tile must exist,
- every footprint tile must currently be grass or road,
- no person may occupy a footprint tile,
- every neighboring tile in the ring around the complete footprint must exist,
- every ring tile must be grass or road.

This means a full one-tile free border is mandatory. Buildings therefore cannot touch other buildings, forests, water, mountains or the map edge.

The rule is intentionally enforced in the simulation layer. Phaser only visualizes `canPlaceBuilding()` and cannot create a placement that the core would reject.

### Building and demolition

`buildWithFootprint()` first stores the original grass/road terrain for all footprint cells, delegates logical building creation, assigns the footprint to the building, then marks every occupied cell as `building`.

`removeBuildingWithFootprint()` delegates the existing entity/assignment/transport cleanup and then restores every saved footprint tile. HQ and forests remain non-demolishable.

Building tiles are still walkable. This avoids introducing entrance or collision semantics before the product rules require them.

## Production and reservations

Trips represent reservations directly. Unpicked trips reserve source stock; planned deliveries reserve destination capacity. A picked trip physically carries one unit. Cancelling a carried trip returns it to the original source when that source still exists.

Production inputs remain inside the building until completion. In-progress production reserves output capacity. Production workers prioritize production and fetch inputs themselves only when blocked. Carriers assigned to production buildings fetch only required input.

Current recipes at 1×:

- forest: 1 wood / ~4 seconds,
- sawmill: 2 wood → 1 plank / ~4 seconds,
- carpenter: 2 plank → 1 wooden tool / ~4 seconds.

## Warehouse and logistics model

Warehouses have local inventory keyed by good type. Capacity is 20 units per good type.

Warehouse carriers collect output from non-warehouse sources only when the source lies within **10 reachable tile steps**. This doubles the old five-step value to preserve approximately the same physical world radius after doubling grid density.

Warehouses remain valid sources for production demand without this radius restriction. Warehouse carriers never create warehouse-to-warehouse trips.

### Merchant routes

Merchants are a separate warehouse role and the only automatic mechanism that intentionally moves goods between warehouses. Each warehouse supports up to two merchants.

```text
wait at source
→ reserve configured good + destination capacity
→ pick up
→ travel to destination
→ deliver
→ return empty to source
→ repeat
```

The route has no collection-radius restriction.

## Forest logic

Woodcutters are appointed globally. Each chooses the quickest reachable unoccupied active or passive forest; ties use seeded PRNG state.

A passive forest tile becomes a dynamic one-tile forest building when claimed. Every active forest starts with 10 yield, has one worker slot and produces one wood per production duration.

At zero yield the forest retires immediately and its tile becomes grass. Residual produced wood remains collectible. The woodcutter then searches for another forest without teleporting.

## Map rendering and interaction

`game/MainScene.ts` renders the world through Phaser. `Phaser.Scale.RESIZE` keeps the canvas fitted to the browser viewport.

The visual Hex geometry is denser than before:

- horizontal spacing: 24 px,
- vertical spacing: 21 px,
- Hex radius: 14 px.

People are drawn from continuous simulation positions.

Camera navigation:

- desktop: wheel zoom and pointer drag,
- mobile: one-finger pan and two-finger pinch,
- camera zoom: 0.7×–3.5×.

The page itself does not scroll or zoom inside the app.

Selection checks every tile in a building footprint, so tapping any occupied cell selects the same building.

## Building placement mode

Building placement is a dedicated modal map state controlled through DOM/Phaser custom events.

Flow:

```text
UI chooses building kind
→ BUILD_MODE_EVENT
→ MainScene shows the initial ghost at the previously selected tile
→ desktop pointer hover or a short map tap updates the ghost position
→ BUILD_POSITION_SELECTED_EVENT reports the preview position to the DOM UI
→ simulation canPlaceBuilding() validates footprint + ring
→ Phaser draws dim layer + green/red ghost + clearance ring
→ UI enables "Bauen" only for a currently valid position
→ "Bauen" calls buildWithFootprint()
→ success exits mode and selects building
```

Input responsibilities are deliberately separated:

- desktop hover may move the ghost,
- a short touch tap moves the ghost to the tapped tile,
- one-finger touch drag pans the camera and never moves the ghost,
- two-finger touch gestures zoom/pan and never move the ghost,
- tapping/clicking the map never creates the building directly,
- only the DOM `Bauen` button confirms placement,
- `Abbrechen` exits without changing the world.

The `Bauen` button is recalculated against `canPlaceBuilding()` as the preview or world changes, and `buildWithFootprint()` validates once more when confirmation occurs. This prevents presentation state from bypassing simulation rules.

The existing merchant destination mode remains separate. It pauses simulation, stores camera state, dims the map, highlights valid warehouses and restores camera/running state after selection or cancel.

## DOM UI

`ui/controls.ts` owns overlays and the real-time simulation accumulator.

- top: build/version and core metrics,
- bottom: pause/resume, 0.5×, 1×, 2×, 3×, debug,
- HQ: population and woodcutter controls,
- production buildings: recipe, inventory, worker/carrier controls, demolition,
- warehouse: local stocks, carriers, merchants and route configuration,
- active forest: remaining yield/output,
- empty grass/road tile: building choices and manual road action,
- debug overlay: people and transport tasks.

When the player chooses a building type, the normal selection panel and bottom controls are hidden and a compact placement overlay is shown. The overlay explicitly says **“Tippen, um das Gebäude zu verschieben.”** and contains `Bauen` plus `Abbrechen` actions.

## Presentation performance

Phaser's renderer continues on the browser animation loop, normally up to display refresh. Simulation advancement is decoupled through the fixed-step accumulator.

At 1× the accumulator consumes fixed steps at the full 60 Hz cadence. Slower gameplay is expressed through smaller per-tick movement and longer tick-based durations, avoiding the visible 15 Hz stepping that occurred when the 0.25 factor was applied to the accumulator itself.

A frame delta is capped before entering the accumulator to avoid large catch-up bursts after suspended/backgrounded tabs. A frame also caps the number of fixed simulation steps processed at once.

Placement hover currently scans the fixed grid to find the nearest Hex. At 41 × 25 this remains small enough for the PoC; a spatial lookup can replace it if map size grows substantially.

## Testing

`npm test` runs deterministic Node tests through `tsx`.

Placement has dedicated coverage for:

- multi-tile footprints,
- mandatory one-tile free ring,
- rejection when the ring contains blocked terrain,
- restoration of every footprint tile after demolition.

Decision-cadence coverage verifies that idle autonomous planning does not re-run between one-second decision boundaries and that a delivery can trigger its required follow-up decision immediately without waiting for the next boundary.

Other simulation tests continue to cover movement, production, forest relocation, merchant routes, reservations and logistics invariants.

## Build and deployment

Vite injects `process.env.BUILD_TIME` as an ISO timestamp. `main.ts` renders it in the `Europe/Berlin` timezone in the top HUD.

TypeScript 5.9 is used in the project toolchain. `npm test` runs tests; `npm run build` performs type checking and the Vite production build.

`.github/workflows/deploy.yml` tests and builds pushes to `main`, then deploys GitHub Pages. Branch pushes do not deploy. Vite base path is `/civilizations-poc/`.
