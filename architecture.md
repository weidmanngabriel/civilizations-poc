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

`src/simulation/model.ts` defines people, assignments, transport trips, merchant routes, farm tasks, recipes, buildings, fields, local inventories, terrain and world state. Buildings have stable string IDs plus a separate `kind`. Goods currently include wood, plank, woodenTool and wheat.

Buildable buildings may carry a `footprint` and `baseTerrains` for demolition restoration. Their logical `position` remains the anchor used by jobs and routing. Buildable buildings can additionally carry a `construction` state while unfinished.

People can carry persistent `woodcutter` and `builder` pool flags. Normal workplace roles continue to use `assignment`. Farm workers use a normal worker assignment to the farm plus a transient `farmTask` for sowing, fertilizing or harvesting a specific field position.

`scenario.ts` owns the fixed **41 × 25** map and central balance constants, including farm radius, field limit, action duration and growth duration.

`simulation.ts` owns the global deterministic tick, assignments, reservations, production, construction, profession pools, forest lifecycle, low-level building creation/removal, roads, merchant routes and status derivation. Farm-specific behavior is delegated to `farm.ts` rather than expanding the generic recipe loop with special cases.

`farm.ts` owns field selection, seeded random field placement, field lifecycle, growth, fertilizing acceleration, harvest and cleanup when a farm is demolished.

`buildingPlacement.ts` owns user-facing multi-tile placement rules and construction plans. Farm uses the same placement flow as the other buildable buildings.

`movement.ts` derives each person's continuous fractional world position from deterministic simulation state. Phaser consumes that position but does not invent renderer-owned movement.

## Fixed simulation time

At displayed 1×, the simulation keeps a fixed **60 Hz** update cadence. Rendering remains on `requestAnimationFrame` and is independent from simulation speed.

Important balance constants at 1×:

- normal production duration: 240 ticks / about 4 seconds,
- base movement: `2.5 / 60` tile-distance per tick,
- autonomous decision interval: 60 ticks / 1 second,
- organic-road traffic window: 1920 ticks / 32 seconds,
- sow and harvest action: 600 ticks / 10 seconds,
- one natural field-growth stage: 1800 ticks / 30 seconds.

Event-driven transitions bypass the 1-Hz planning cadence. Arrivals, deliveries, production completion, farm-action completion, field-stage completion and construction completion can cause an immediate follow-up decision.

## Navigation and movement

`src/simulation/hex.ts` provides weighted Dijkstra routing and an unweighted BFS for tile-step range checks.

Walkable terrain: grass, road, forest, field, building.
Blocked terrain: mountain, river.

Tiles are navigation waypoints, not the visible movement unit. Roads cost `1 / 1.3`, giving a 30% speed increase. The warehouse collection radius continues to use reachable tile steps rather than travel time.

## Organic roads

Grass records recent traversal timestamps in `Tile.trafficTicks`.

- threshold: 8 traversals,
- rolling window: 32 seconds at 1×,
- on threshold: grass becomes road immediately,
- current tasks reroute so agents can exploit the new road.

Fields are not treated as grass traffic counters while they exist. After harvest the tile becomes ordinary grass again.

## Multi-tile buildings

User-facing buildable kinds are warehouse, farm, sawmill and carpenter. The HQ is multi-tile in the initial scenario.

```text
HQ          4 tiles
Warehouse   4 tiles
Farm        4 tiles
Sawmill     6 tiles
Carpenter   4 tiles
```

Placement requires all footprint and one-tile clearance-ring cells to exist and currently be grass or road. A person may not occupy a footprint tile. Therefore active fields block building placement just like forests or other non-free terrain.

Current construction plans:

```text
Warehouse   4 wood    → 11 s base build time
Farm        4 wood    → 11 s base build time
Sawmill     6 wood    → 15 s base build time
Carpenter   4 planks  → 11 s base build time
```

Build duration remains `(3 + 2 × required resource units) × simulationHz`. Up to two builders work on a site and the second builder exactly doubles progress while both are present. When a builder is assigned, construction input is planned immediately from the builder's current position. If material can be reserved, the first route goes directly to that source; only builders without available material route to the site and wait there.

Demolishing a farm additionally removes its still-active field entities and restores their tiles to grass. Retired harvested field sources containing loose wheat are intentionally not removed with the farm because the product rule says already produced physical goods remain in the world.

## Production and reservations

Generic production still uses recipes and local input/output capacities. Trips represent reservations directly: an unpicked trip reserves source stock, an incoming trip reserves destination capacity and a picked trip physically carries one unit.

Current generic recipes:

- forest: 1 wood / ~4 seconds,
- sawmill: 2 wood → 1 plank / ~4 seconds,
- carpenter: 2 plank → 1 wooden tool / ~4 seconds.

Farm production deliberately does **not** use the generic recipe loop because it is spatial and multi-stage. The farmer works on separate field entities, picks up wheat when harvest completes and transports it through the existing trip primitive back to the farm. The farm then acts as the normal wheat source for warehouse collection.

## Farm and field model

Farm fields are represented as lightweight one-tile `Building` entities with `kind === "field"`. They reuse stable entity IDs and the existing local-output/reservation infrastructure without becoming player-buildable buildings.

Relevant state:

```text
Building(kind = field)
  farmId
  position
  fieldStage: 1 | 2 | 3 | 4
  fieldGrowthProgress
  output              # wheat after harvest
  retired

Person
  assignment           # worker at farm
  farmTask:
    kind: sow | fertilize | harvest
    target
    fieldId?
    progress
```

An active field changes its map tile to terrain `field`. It is walkable but not valid for normal building placement or road editing. A harvested field is marked retired and the tile immediately returns to grass. The retired field entity remains only while its wheat output is relevant to logistics; it is excluded from active-field counting and rendering as a building.

### Field choice

A farm worker may maintain at most four active fields. Candidate sow tiles must:

- currently be grass,
- be reachable,
- lie within three axial Hex steps from at least one farm-footprint cell,
- not currently contain a person,
- not already be reserved by another farmer's sow task.

The candidate is selected with the existing deterministic seeded RNG. Reserving the target inside `Person.farmTask` prevents two farmers from choosing the same grass tile while walking there.

### Farmer planner

The farmer planner runs through the normal decision system with this priority:

```text
ripe field available     → harvest
active fields < 4         → sow random valid grass tile
otherwise                 → fertilize random non-ripe field
```

The farmer does not need to return to the farm between field actions. Each task stores its target and the normal pathfinder moves the person physically to it.

### Growth and fertilizing

Each non-ripe field advances one growth-progress unit per simulation tick. One stage therefore takes 1800 ticks / 30 seconds naturally.

While its farmer is physically present and executing a fertilize task, the same field advances three units per tick total. Thus the remaining natural time is divided by three. Examples:

- 30 seconds remaining → 10 seconds fertilizing,
- 15 seconds remaining → 5 seconds fertilizing,
- 6 seconds remaining → 2 seconds fertilizing.

The fertilize task ends immediately when the next field stage is reached, rather than always consuming a fixed 10 seconds. This implements the product requirement that partially grown fields need proportionally less work.

Sowing and harvesting are different: both always require 600 ticks / 10 seconds once the farmer has arrived.

### Harvest and physical wheat

Harvest completion marks the field retired and restores its tile to grass. At that moment the farmer immediately carries one wheat using a picked `Trip` whose source is the retired field and whose target is the farm. On arrival, wheat is added to the farm's local output. The farmer cannot start another field task while this trip is active. Farm output uses the normal output capacity of three units, and ripe fields wait while that output plus incoming wheat is full.

Warehouse carriers collect wheat from the farm with the same source reservation logic used for other produced goods. No global wheat counter is authoritative; HUD totals are derived from completed warehouse inventories.

## Warehouse and logistics model

Warehouses have local per-good inventory with capacity 20 for wood, planks, wooden tools and wheat.

Warehouse carriers collect output from non-warehouse sources only when the source lies within **10 reachable tile steps**. Farm output is a valid wheat source. Retired fields are not normal wheat sources after a successful harvest return. Warehouse carriers still never create warehouse-to-warehouse trips.

Merchants remain the only automatic warehouse-to-warehouse mechanism and can select wheat as their configured good.

## Forest logic

Woodcutters are appointed globally. Each chooses the quickest reachable unoccupied active or passive forest; ties use seeded PRNG state.

A passive forest tile becomes a dynamic one-tile forest building when claimed. Every active forest starts with 10 yield. At zero yield the forest retires immediately and its tile becomes grass. Residual produced wood remains collectible.

The farm implementation intentionally follows the same useful separation between terrain lifecycle and physical produced output, but field lifecycle is driven by a farm worker rather than a persistent resource node.

## Map rendering and interaction

`game/MainScene.ts` renders the world through Phaser. `Phaser.Scale.RESIZE` keeps the canvas fitted to the viewport.

Current Hex geometry:

- horizontal spacing: 24 px,
- vertical spacing: 21 px,
- Hex radius: 14 px.

Fields are rendered from the tile plus their associated active field entity. The visible number/height of simple crop strokes increases with `fieldStage`. Retired harvested fields are not drawn as buildings; wheat output slots can remain visible at their former position until collection.

Farm is available in the same modal placement mode as other buildings. Touch behavior remains unchanged: one-finger drag pans, two-finger gesture zooms/pans, a short tap moves the placement ghost and only the DOM `Bauen` button confirms.

## DOM UI

`ui/controls.ts` owns overlays and the real-time accumulator.

- farm is offered in the building choices,
- a finished farm exposes one worker slot labelled Farmer,
- farm status reports sowing, fertilizing, harvesting or active-field count,
- warehouse inventory includes wheat,
- merchant goods include wheat,
- top metrics include total wheat stored in completed warehouses,
- debug rows expose the current farmer action.

Fields themselves are not normal selectable production buildings. Tapping an active field is treated as tapping its tile rather than opening a worker-management panel.

## Presentation performance

Phaser continues to render on the browser animation loop. Simulation advancement stays deterministic through fixed steps. Field growth is a constant-time update per active field; each farm has at most four active fields, so the new system does not introduce broad spatial scans every rendering frame.

Candidate sow selection and new farmer decisions run on decision events rather than continuously. At current PoC map size, scanning the fixed tile list for valid candidates remains inexpensive and keeps the implementation simple.

## Testing

`npm test` runs deterministic Node tests through `tsx`; `npm run build` performs TypeScript checking plus the Vite production build.

Farm coverage verifies:

- a farmer autonomously establishes no more than four fields,
- fields are chosen inside the configured radius,
- fertilizing divides remaining stage time by three,
- harvesting takes ten seconds,
- harvest restores the tile to grass and leaves one wheat,
- warehouse carriers can collect wheat from a retired harvested field.

Existing suites continue to cover placement, construction, movement, decision cadence, forest relocation, merchant routes, worker input, reservations and deterministic replay.

## Build and deployment

Vite injects `process.env.BUILD_TIME` and the UI formats it in the `Europe/Berlin` timezone.

`.github/workflows/deploy.yml` runs tests and a production build for pushes to `main`, then deploys GitHub Pages. Branch pushes do not deploy. Vite base path remains `/civilizations-poc/`.