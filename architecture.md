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

`src/simulation/model.ts` defines people, assignments, transport trips, merchant routes, farm tasks, recipes, buildings, fields, local inventories, terrain and world state. Buildings have stable string IDs plus a separate `kind`. Goods currently include wood, plank, woodenTool, wheat, flour, water and bread. Recipes support both the existing single-input representation and a multi-input map for chains such as flour + water → bread.

Buildable buildings may carry a `footprint` and `baseTerrains` for demolition restoration. Their logical `position` remains the anchor used by jobs and routing. Buildable buildings can additionally carry a `construction` state while unfinished.

People can carry persistent `woodcutter` and `builder` pool flags. Normal workplace roles continue to use `assignment`. Farm workers use a normal worker assignment to the farm plus a transient `farmTask` for sowing, fertilizing or harvesting a specific field position. Each person also stores persistent experience per profession in `experience`; switching jobs does not erase previously earned experience. Hunger state is stored on the person as `hunger`, fractional `hungerAccumulator` and transient `hungerState` while food is being sought.

`scenario.ts` owns the fixed **41 × 25** map and central balance constants, including farm radius, field limit, action duration and growth duration. It creates the initial world and wraps that world with the deterministic needs hook from `needs.ts`.

`simulation.ts` owns the global deterministic tick, assignments, reservations, production, construction, profession pools, forest lifecycle, low-level building creation/removal, roads, merchant routes and status derivation. Farm-specific behavior is delegated to `farm.ts` rather than expanding the generic recipe loop with special cases.

`needs.ts` owns hunger decay, food-source selection, bread reservation between hungry people, interruption at critical hunger and restoration of the paused task. `attachNeeds()` wraps the world in a `Proxy` that observes the simulation round increment at the beginning of each deterministic tick and advances hunger exactly once before movement and work for that tick. This keeps the existing `simulation.ts` tick entry point unchanged while making needs part of simulation time rather than rendering time.

`experience.ts` owns profession-XP progression and the resulting production, construction and logistics modifiers. It also owns the woodcutter-specific work-speed multiplier, keeping profession balance formulas out of the simulation loop.

`farm.ts` owns field selection, seeded random field placement, field lifecycle, growth, fertilizing acceleration, harvest and cleanup when a farm is demolished.

`buildingPlacement.ts` owns user-facing multi-tile placement rules and construction plans. Farm uses the same placement flow as the other buildable buildings. The exported `CONSTRUCTION_PLANS` are also the authoritative source for the construction costs displayed in the build menu.

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

## Hunger and needs

Hunger runs on the same deterministic 60 Hz simulation clock. Each person starts at 100 hunger points. A fractional accumulator converts activity-dependent rates into whole hunger-point losses:

```text
idle / waiting        1 point / 4 s
walking               1 point / 2 s
active work           1 point / 1 s
carrying picked cargo 1 point / 1 s
```

Active farm actions count as work only after the person has reached the field; walking to the field remains walking. A picked transport counts as active load even while the person is moving.

Two thresholds drive autonomous eating:

- `hunger <= 40`: eat at the next task boundary; current work is allowed to finish,
- `hunger <= 20`: pause immediately and seek food.

Food sources are completed warehouses with at least one whole bread. Candidate warehouses are routed with the same weighted pathfinder used for normal movement and sorted by travel cost. A hungry person reserves one bread logically through `HungerState.foodSource`; other hungry people account for these reservations when choosing a warehouse. Normal warehouse logistics does not yet know about hunger reservations, so if another logistics action removes the bread first the hungry person re-plans on the next needs tick.

Critical interruption does not destroy the existing job state. `progress`, `farmTask` and `trip` remain intact while `active` is temporarily disabled and the path is redirected to food. Picked cargo stays on the person. After consuming one bread, hunger resets to 100 and the current task target is reconstructed in this order: farm task, transport source/target, workplace assignment, HQ. The person then routes back and continues with preserved progress. If no bread is reachable at critical hunger, the person remains paused and retries every tick.

## Profession experience

Experience is stored per person and profession from 0 to 100. Only active profession work contributes; ordinary idle time does not. The current prototype uses a piecewise-linear curve that deliberately slows with increasing skill:

```text
0 → 50     10 minutes active work
50 → 80    next 20 minutes
80 → 95    next 30 minutes
95 → 100   next 30 minutes
```

Thus an uninterrupted profession can reach 100 after about 90 minutes of active work. Experience remains when a person changes profession and later returns.

Normal production professions use `1 + experience / 100` as their output multiplier, so 100 experience doubles output. Woodcutters are deliberately excluded from that rule: they always create exactly one wood per completed felling cycle and instead use `1 + 0.5 × experience / 100` as a work-speed multiplier, capped at 1.5× at 100 experience. Builders use the production curve for their personal construction contribution. Carrier and merchant load size remains exactly one unit; their active logistics movement also uses `1 + 0.5 × experience / 100`, capped naturally at 1.5× at 100 experience.

The profession-specific effects are deterministic and based entirely on simulation ticks. Roads multiply movement independently, so an experienced carrier or merchant also benefits from the normal road speed bonus.

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

Fields are not treated as grass traffic counters while they exist. After harvest the tile becomes ordinary grass again. Manual road editing remains in low-level simulation code for compatibility but is no longer exposed through the player UI; roads are created through movement only.

## Multi-tile buildings

User-facing buildable kinds are warehouse, farm, sawmill, carpenter, mill, bakery and well. The HQ is multi-tile in the initial scenario.

```text
HQ          4 tiles
Warehouse   4 tiles
Farm        4 tiles
Sawmill     6 tiles
Carpenter   4 tiles
Mill        4 tiles
Bakery      4 tiles
Well        4 tiles
```

Placement requires all footprint and one-tile clearance-ring cells to exist and currently be grass or road. A person may not occupy a footprint tile. Therefore active fields block building placement just like forests or other non-free terrain.

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

Build duration remains `(3 + 2 × required resource units) × simulationHz`. Up to two builders work on a site. Their individual construction contributions are added each tick: two inexperienced builders therefore build exactly twice as fast as one inexperienced builder, while experience can raise each builder's own contribution up to 2×. When a builder is assigned, construction input is planned immediately from the builder's current position. If material can be reserved, the first route goes directly to that source; only builders without available material route to the site and wait there.

Demolishing a farm additionally removes its still-active field entities and restores their tiles to grass. Retired harvested field sources containing loose wheat are intentionally not removed with the farm because the product rule says already produced physical goods remain in the world.

## Production and reservations

Generic production still uses recipes and local input/output capacities. Recipes may define an output amount greater than one. Only local production-output quantities may contain fractions; production inputs and warehouse inventories remain whole-number quantities. A completed production cycle may push a local output above its nominal capacity because its experience multiplier is applied at completion. No new production cycle starts while the current output is at or above the nominal capacity.

Forests use the same three-unit output-capacity gate. Each felling cycle adds exactly one wood. Once three wood are stored locally, the woodcutter pauses until collection frees at least one slot; the finite ten-cycle forest reserve therefore depletes only as logistics makes output space available.

Trips deliberately remain whole-unit logistics. An unpicked trip reserves exactly one unit of source stock, an incoming trip reserves exactly one unit of destination capacity and a picked trip physically carries exactly one unit. A trip can only be planned when at least 1.0 unit is available at the source and at least 1.0 unit fits at the destination. Thus a production source with 4.7 units becomes 3.7 after pickup, while the destination receives exactly one whole unit. A residual 0.7 cannot be transported until production raises it to at least 1.0. For multi-input recipes, procurement prioritizes ingredients still missing for the next complete batch before topping up already-sufficient inputs; if no prioritized source is reachable, normal top-up remains available.

Current generic recipes:

- forest: exactly 1 wood per cycle, ~4 seconds base duration and up to 1.5× faster with woodcutter experience,
- sawmill: 2 wood → 1 plank / ~4 seconds,
- carpenter: 2 plank → 1 wooden tool / ~4 seconds,
- mill: 1 wheat → 1 flour / ~4 seconds,
- bakery: 2 flour + 1 water → 2 bread / ~4 seconds,
- well: infinite water source with no worker and no production timer.

The base output of normal production professions is multiplied by worker experience. Woodcutters are the exception: their output stays fixed at one wood and experience increases felling progress per simulation tick instead. Production time itself remains unchanged for the other generic professions.

Farm production deliberately does **not** use the generic recipe loop because it is spatial and multi-stage. The farmer works on separate field entities, picks up one physical wheat when harvest completes and transports it through the existing trip primitive back to the farm. Any fractional experience bonus from that harvest is credited to the farm output when the farmer arrives, so the trip primitive itself still carries exactly one unit. The farm then acts as the normal wheat source for warehouse collection.

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
  experience            # persistent XP per profession
  pendingFarmBonus?     # fractional harvest yield awaiting return to farm
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

Sowing and harvesting are different: both always require 600 ticks / 10 seconds once the farmer has arrived. Active sowing, fertilizing and harvesting all contribute farmer experience.

### Harvest and physical wheat

Harvest completion marks the field retired and restores its tile to grass. The harvest yield is `1 × farmer production multiplier`. At that moment the farmer immediately carries the physical base unit using a picked `Trip` whose source is the retired field and whose target is the farm. On arrival, one wheat plus the fractional experience bonus are added to the farm's local output. The farmer cannot start another field task while this trip is active. Farm output uses the normal nominal output capacity of three units; a completed harvest may overflow it, and ripe fields then wait while that output plus incoming wheat is full.

Warehouse carriers collect wheat from the farm with the same whole-unit source reservation logic used for other produced goods. No global wheat counter is authoritative; HUD totals are derived from completed warehouse inventories.

## Warehouse and logistics model

Warehouses have local per-good inventory with capacity 20 for wood, planks, wooden tools, wheat, flour, water and bread. Warehouse inventories are always whole-number quantities because every inbound and outbound trip transfers exactly 1.0 unit. Fractional quantities remain only at production outputs.

Warehouse carriers collect output from non-warehouse sources only when the source lies within **10 reachable tile steps**. Farm output is a valid wheat source. Retired fields are not normal wheat sources after a successful harvest return. Warehouse carriers still never create warehouse-to-warehouse trips.

Merchants remain the only automatic warehouse-to-warehouse mechanism and can select wheat as their configured good. Carrier and merchant profession experience speeds up active logistics movement by up to 50% without changing load size.

## Forest logic

Woodcutters are appointed globally. Each chooses the quickest reachable unoccupied active or passive forest; ties use seeded PRNG state.

A passive forest tile becomes a dynamic one-tile forest building when claimed. Every active forest starts with ten finite felling cycles. Each completed cycle creates exactly one wood and decrements that finite count by one. Woodcutter experience does not change yield; it increases felling progress with `1 + 0.5 × experience / 100`, reaching 1.5× work speed at 100 experience. Forest output uses the normal three-unit production-output gate, so a woodcutter pauses at three stored wood until collection frees a slot. At zero remaining cycles the forest retires immediately and its tile becomes grass. Residual produced wood remains collectible from the retired forest entity.

The farm implementation intentionally follows the same useful separation between terrain lifecycle and physical produced output, but field lifecycle is driven by a farm worker rather than a persistent resource node.

## Map rendering and interaction

`game/MainScene.ts` renders the world through Phaser. `Phaser.Scale.RESIZE` keeps the canvas fitted to the viewport.

Current Hex geometry:

- horizontal spacing: 24 px,
- vertical spacing: 21 px,
- Hex radius: 14 px.

Fields are rendered from the tile plus their associated active field entity. The visible number/height of simple crop strokes increases with `fieldStage`. Retired harvested fields are not drawn as buildings; wheat output slots can remain visible at their former position until collection.

Farm is available in the same modal placement mode as other buildings. Touch behavior remains unchanged: one-finger drag pans, two-finger gesture zooms/pans, a short tap moves the placement ghost and only the DOM `Bauen` button confirms.

`game/hungerIndicators.ts` is presentation-only. It reads deterministic hunger state and continuous world positions, then renders a small fork-and-knife badge above people with hunger <= 40. The badge background is yellow for normal hunger demand and red at the critical <= 20 threshold. It does not own or mutate product logic.

## DOM UI

`ui/controls.ts` owns overlays and the real-time accumulator.

`ui/buildMenu.ts` owns the left-side main menu. It currently exposes only **Bauen**. The building list reads construction costs from `CONSTRUCTION_PLANS` and starts the existing placement flow rather than duplicating placement logic. Normal tile-selection events are intercepted before `ui/controls.ts`, so clicking or tapping an empty tile no longer opens the legacy tile action panel. The adapter permits one synchronous internal tile-selection event only when a build-menu item is chosen, then immediately enters placement mode and clears that temporary tile selection.

- farm, mill, bakery and well are offered in the building choices,
- a finished farm exposes one worker slot labelled Farmer; mill and bakery expose Müller and Bäcker worker labels; well has no worker slot,
- farm status reports sowing, fertilizing, harvesting or active-field count,
- warehouse inventory includes wheat,
- merchant goods include wheat, flour, water and bread,
- top metrics include total wheat and bread stored in completed warehouses,
- production outputs are displayed with one decimal place; production inputs, warehouse inventories and warehouse HUD totals are displayed as whole numbers,
- goods use emoji markers alongside labels/counts where appropriate; building controls and headings use shared inline SVG icons; map people use role markers plus their numeric ID,
- debug rows expose the current farmer action and current profession experience.

Fields themselves are not normal selectable production buildings. Tapping an active field is treated as tapping its tile rather than opening a worker-management panel.

## Presentation performance

Phaser continues to render on the browser animation loop. Simulation advancement stays deterministic through fixed steps. Field growth is a constant-time update per active field; each farm has at most four active fields, so the new system does not introduce broad spatial scans every rendering frame.

Candidate sow selection and new farmer decisions run on decision events rather than continuously. At current PoC map size, scanning the fixed tile list for valid candidates remains inexpensive and keeps the implementation simple.

Experience updates are constant-time arithmetic on the currently active profession and add no spatial scans.

Hunger decay itself is O(number of people) per simulation tick. Food-source path searches happen only when a person wants to eat, loses its selected food source or is critically hungry without food; they are not performed for every person on every render frame.

## Testing

`npm test` runs deterministic Node tests through `tsx`; `npm run build` performs TypeScript checking plus the Vite production build.

Farm coverage verifies:

- a farmer autonomously establishes no more than four fields,
- fields are chosen inside the configured radius,
- fertilizing divides remaining stage time by three,
- harvesting takes ten seconds,
- harvest restores the tile to grass and leaves one wheat,
- warehouse carriers can collect wheat from a retired harvested field.

Experience coverage verifies the 10/30/60/90-minute progression targets, 2× production cap, 1.5× logistics-speed cap, fractional production overflow, exact whole-unit pickup from fractional stocks and refusal to transport remainders below 1.0.

Forest coverage additionally verifies fixed one-unit yield per felling cycle, the three-unit local output gate and resume-after-collection behavior, immediate retirement after the tenth completed cycle, leftover-wood collection and the 1.5× maximum woodcutting-speed modifier at 100 experience.

Inventory coverage additionally verifies that fractional production outputs enter both production inputs and warehouses only as whole units, so input and warehouse quantities remain integer-valued.

Hunger coverage verifies the three activity-dependent decay rates, deferred eating at the 40-point threshold, immediate interruption at 20, preserved work progress and the blocked critical state when no bread is reachable.

Existing suites continue to cover placement, construction, movement, decision cadence, forest relocation, merchant routes, worker input, reservations and deterministic replay.

## Build and deployment

Vite injects `process.env.BUILD_TIME` and the UI formats it in the `Europe/Berlin` timezone.

`.github/workflows/deploy.yml` runs tests and a production build for pushes to `main`, then deploys GitHub Pages. Branch pushes do not deploy. Vite base path remains `/civilizations-poc/`.