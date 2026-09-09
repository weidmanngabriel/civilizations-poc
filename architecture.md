# Architecture

## Technology stack

The prototype is a browser-first TypeScript application.

- **Language:** TypeScript
- **Build tooling:** Vite
- **Game framework:** Phaser 4
- **Target:** modern web browsers, deployed as a static site through GitHub Pages
- **Mobile baseline:** iPhone 13 Mini (375 × 812 CSS px)

## Architectural principle

The simulation core stays independent from Phaser.

```text
src/
  simulation/   # world state, entities, economy, logistics, rules
  game/         # Phaser rendering, camera, map input
  ui/           # DOM controls and information panels
```

Dependencies flow from presentation toward the simulation. `src/simulation/` must not import Phaser. Product rules therefore remain deterministic and testable without a renderer.

## Simulation core

`src/simulation/model.ts` defines people, assignments, transport trips, merchant routes, recipes, buildings, local inventories, terrain and world state. Buildings have stable string IDs plus a separate `kind`, so multiple warehouses, sawmills and carpenter shops can coexist.

`scenario.ts` owns the fixed **21 × 13** map and central balance constants. The initial world contains eight people, one HQ, passive forest groups, water and mountains. There are **no initial roads**.

`simulation.ts` owns deterministic in-place simulation steps, assignment changes, reservations, production, forest claiming/depletion, building placement/demolition, road editing, organic road formation, merchant routes and status derivation. No renderer imports or real-time timers occur in the core.

`movement.ts` derives each person's continuous fractional world position from deterministic simulation state: the last reached tile centre, the next tile waypoint and `Person.movement`. Phaser consumes that position but does not invent frame-time interpolation.

## Fixed simulation time

The simulation quantum is **1/60 simulated second**. `tick()` always advances exactly this fixed amount and increments the internal `World.round` counter. The counter is technical state and is not shown as a game round.

At **1×**:

- 60 `tick()` calls = 1 simulated second;
- normal production duration is 60 ticks ≈ 1 second;
- base movement earns `5 / 60` tile-distance per tick = 5 tiles/second on normal terrain.

The UI uses a `requestAnimationFrame` accumulator. Real frame time is multiplied by the selected simulation speed (`0.5`, `1`, `2`, `3`) and consumed in fixed 1/60-second simulation quanta. This keeps game rules independent of monitor/render FPS. Pausing stops simulation advancement while Phaser continues to render and accept camera input.

There is no FPS slider, Max-FPS mode or single-step button anymore.

## Navigation and movement

`src/simulation/hex.ts` provides axial neighbors and two navigation modes:

- `findPath()` uses weighted Dijkstra routing and minimizes **travel time**;
- `findPathBySteps()` uses unweighted BFS and measures **physical reachable tile steps**.

Walkable terrain:

- grass,
- road,
- forest,
- building.

Blocked terrain:

- mountain,
- river.

Tiles are navigation waypoints, not the visible movement unit. `Person.position` is the last reached tile centre, `Person.path[0]` is the next waypoint and `Person.movement` is the already travelled partial distance along that edge. `personWorldPosition()` converts those values into a fractional axial coordinate every simulation refresh, so people move continuously between tile centres while pathfinding and arrivals stay grid-based.

Normal terrain costs `1.0` movement. A road costs `1 / 1.3`, producing a **30% speed increase** without changing the fixed simulation tick. Because the same edge cost controls both route choice and fractional progress, road movement is visibly faster as well as logically faster.

Weighted paths are used for normal movement and source choice so established roads can outweigh a slightly shorter grass route. The warehouse collection radius deliberately uses `findPathBySteps()` so its five-tile rule is not enlarged by road speed.

## Organic roads

Grass records recent traversal timestamps in `Tile.trafficTicks`.

- threshold: **8 traversals**;
- rolling window: **8 simulated seconds / 480 ticks**;
- on threshold: grass becomes road immediately;
- the traffic history is then discarded;
- current tasks are rerouted so agents can exploit the newly faster terrain.

Roads are persistent. Manual road build/remove remains available for the PoC. Removing a road is still blocked while a person stands on the tile.

The map therefore begins as landscape and develops routes from repeated actual traffic instead of starting with a designed road network.

## Simulation order

Each deterministic tick executes roughly:

1. add partial edge movement and complete waypoint crossings when enough distance has accumulated;
2. record grass traversals and create roads when thresholds are reached;
3. reroute current tasks if a new road changed navigation costs;
4. process arrivals, pickup and delivery;
5. advance/complete production;
6. retire exhausted forests and reassign waiting woodcutters;
7. plan new input and merchant trips.

Stable entity order and seeded randomness keep replay behavior deterministic.

## Production and reservations

Trips represent reservations directly. Unpicked trips reserve source stock; planned deliveries reserve destination capacity. A picked trip physically carries one unit. Cancelling a carried trip returns it to the original source when that source still exists.

Production inputs remain inside the building until completion. In-progress production reserves output capacity. Production workers prioritize production and fetch inputs themselves only when blocked. Carriers assigned to production buildings only fetch that building's required input.

Current recipes at 1×:

- forest: 1 wood / ~1 second;
- sawmill: 2 wood → 1 plank / ~1 second;
- carpenter: 2 plank → 1 wooden tool / ~1 second.

## Warehouse and logistics model

Warehouses have a local inventory keyed by good type. Capacity is **20 units per good type** (`wood`, `plank`, `woodenTool`).

Warehouse carriers collect output from non-warehouse sources only when the source lies within **5 reachable tile steps** of the warehouse. The radius is measured by unweighted BFS, not geometric distance and not road travel time.

Warehouses remain valid sources for production demand without this five-step restriction. Warehouse carriers never create warehouse-to-warehouse trips.

### Merchant routes

Merchants are a separate warehouse role and the only automatic mechanism that intentionally moves goods between warehouses. Each warehouse currently supports up to two merchants.

A merchant has one destination and one good type. The route uses the normal `Trip`, reservation and weighted movement systems.

```text
wait at source
→ reserve one configured good + destination capacity
→ pick up
→ travel to destination
→ deliver
→ return empty to source
→ repeat
```

The route has no five-tile radius. There is currently no return cargo, price or barter system.

## Dynamic buildings and terrain

Buildable kinds are **warehouse, sawmill and carpenter**. Building is instant and free for the PoC. A building can be placed on empty grass or road; the underlying terrain is stored and restored on demolition.

HQ and active forests are not player-demolishable. Demolishing a normal building removes its local goods, cancels affected transports, frees assigned people and restores its underlying terrain.

Manual grass↔road editing remains supported alongside organic road formation.

## Forest logic

Woodcutters are appointed globally. Each chooses the quickest reachable unoccupied active or passive forest; ties use the seeded PRNG in `World.rngState`.

A passive forest tile becomes a dynamic `forest-N` building when claimed. Every active forest starts with `CONFIG.forestYield = 10`, has one worker slot and produces one wood per production duration. Forest opacity follows `max(0.35, remaining / forestYield)`.

At zero yield the forest retires immediately and its tile becomes **grass**. Residual produced wood remains collectible at the retired forest location. The woodcutter then searches for another forest without teleporting. A road at the old site can only arise through normal traffic.

## Map rendering and interaction

`game/MainScene.ts` renders the world through Phaser. `Phaser.Scale.RESIZE` keeps the canvas fitted to the full browser viewport.

People are drawn at the continuous fractional position supplied by `simulation/movement.ts`. There is no Phaser tween or renderer-owned movement timer; pause and simulation speed therefore affect movement exactly like production and logistics.

The Phaser camera owns map navigation:

- desktop: wheel zoom and pointer drag;
- mobile: one-finger pan and two-finger pinch through non-passive touch handling for iOS Safari;
- camera zoom: **0.7×–3.5×**.

The page itself does not scroll or zoom inside the app.

Map interaction is selection-first. A short click/tap selects a building or tile; drag/pinch does not. Phaser emits selection events while the DOM UI owns building, road, assignment and demolition actions.

Merchant destination selection is a dedicated modal map state. It pauses simulation, stores camera state, dims the map, highlights valid warehouses, permits pan/zoom, and restores the previous camera and running state after selection or cancel.

## DOM UI

`ui/controls.ts` owns overlays and the real-time simulation accumulator.

- top: build/version and core metrics;
- bottom: pause/resume, `0.5×`, `1×`, `2×`, `3×`, debug;
- HQ: population and woodcutter controls;
- production buildings: recipe, inventory, worker/carrier controls, demolition;
- warehouse: local stocks, carriers, merchants, route configuration, demolition;
- active forest: remaining yield/output;
- empty grass/road tile: building choices and manual road action;
- debug overlay: people and transport tasks.

During merchant target selection the normal controls are hidden and only the target-selection overlay remains.

## Presentation performance

Phaser's renderer continues on the browser animation loop, normally up to the display's 60 Hz. Simulation advancement is decoupled through the fixed-step accumulator described above.

A frame delta is capped before entering the accumulator to avoid a large burst of catch-up work after a suspended/backgrounded tab. A frame also caps the number of fixed simulation steps processed at once.

## Build and deployment

Vite injects `process.env.BUILD_TIME` as an ISO timestamp. `main.ts` renders it in the `Europe/Berlin` timezone in the top HUD.

TypeScript 5.9 is used in the project toolchain. `npm test` runs Node tests through `tsx`; `npm run build` performs type checking and the Vite production build.

`.github/workflows/deploy.yml` tests and builds pushes to `main`, then deploys GitHub Pages. Branch pushes do not deploy. Vite base path is `/civilizations-poc/`.
