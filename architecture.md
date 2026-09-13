# Architecture

## Technology stack

The prototype is a browser-first TypeScript application using TypeScript, Vite and Phaser 4. It is deployed statically through GitHub Pages. Mobile behavior is validated against an iPhone 13 Mini baseline of 375 × 812 CSS px.

## Architectural principle

The deterministic simulation core is independent from Phaser.

```text
src/
  simulation/   world state, rules, economy, logistics, needs, placement
  game/         Phaser rendering and map input
  ui/           DOM overlays and controls
  handbook/     player-facing Markdown help pages
  debug/        performance diagnostics
```

Presentation reads simulation state and must not invent authoritative game state.

## Core model

`src/simulation/model.ts` defines people, assignments, trips, buildings, fields, inventories, terrain, hunger and sleep state.

People keep persistent work state while needs temporarily redirect them. Hunger uses `HungerState`; sleep uses `SleepState`. Sleep state stores interrupted assignment/pool data, current phase progress and recovery per five-second phase. Hunger state stores the selected food source or bush plus retry timing when no food is reachable.

The world stores deterministic RNG state and `nextBushRegrowTick`, allowing bush regrowth to be event-driven instead of scanning the complete map each tick.

`BuildingKind` includes `house`. Placement uses `PlaceableBuildingKind`, while older production management keeps the narrower `BuildableBuildingKind` where possible.

## Scenario creation

`src/simulation/scenario.ts` owns the fixed **41 × 25** map and central balance values.

`createWorld()` creates a neutral deterministic test world. `createDefaultGameWorld()` creates the player-facing start with 12 people, HQ, 10 bread, passive forests and 42 bushes.

The player-facing world starts with two builders, two woodcutters, eight free people and no HQ carrier assigned. New people start at hunger 100 and sleep 100.

The world is wrapped by sleep and hunger proxies. Hunger runs before sleep on each simulation round increment so hunger wins if both needs become due together.

## Fixed simulation time

At displayed 1× the simulation advances at 60 fixed ticks per real second. Rendering is independent on `requestAnimationFrame`.

Important values:

```text
production cycle         240 ticks / ~4 s
base movement            2.5 tiles / s
normal decision cadence  60 ticks / 1 s
road traffic window      1920 ticks / 32 s
farm sow/harvest         600 ticks / 10 s
sleep phase              300 ticks / 5 s
sleep action             600 ticks / 10 s
field growth stage       1800 ticks / 30 s
bush regrowth            7200–10800 ticks / 120–180 s
```

## Hunger and food selection

`src/simulation/needs.ts` owns hunger decay and food selection.

Decay at 1×:

```text
idle / waiting           1 point / 4 s
walking                  1 point / 2 s
active work              1 point / 1 s
picked cargo             1 point / 1 s
```

Hunger <= 40 blocks starting a new task after the current atomic activity. Hunger <= 20 interrupts immediately. Progress, farm tasks and transport state are preserved and resumed afterwards.

Food candidates are evaluated with the normal weighted pathfinder and sorted by travel cost. Current bread sources are:

- completed warehouse inventory,
- HQ inventory,
- completed bakery local bread output.

Bushes remain direct food sources and restore 40 hunger points. Bread restores hunger to 100.

Bread reservations use the source building id, regardless of whether the bread is in storage or bakery output. Bush reservations use tile position. This prevents multiple people planning the same portion.

Food routing is event-driven. One source and route are selected when eating becomes due. While travelling, the source is not revalidated. On arrival it is checked again; if invalid, a new candidate is selected. When no food is reachable, the expensive global search is retried at most once per normal one-second decision interval.

## Sleep need and sleep-place selection

`src/simulation/sleep.ts` owns sleep decay, local sleep-place selection, two-phase recovery and task restoration.

Decay at 1×:

```text
idle / waiting           1 point / 8 s
walking                  1 point / 4 s
active work              1 point / 2 s
picked cargo             1 point / 2 s
```

Sleep <= 40 blocks starting a new task after the current activity. Sleep <= 20 interrupts immediately. Hunger has priority if both are due.

Sleep candidates are limited to eight reachable steps. Quality order is fixed:

```text
completed house          -> recover missing amount to 100
forest tile / bush tile  -> +40 total
no local option           -> current ground tile, +20 total
```

The ten-second action consists of two five-second phases. A house credits half the missing amount after each phase; nature gives +20/+20 and ground +10/+10. Recovery already credited after phase one remains if another system later interrupts sleep.

Sleep target selection is event-driven like hunger. The target and route are trusted while travelling and validated only when the path ends. During sleep, assignment and builder/woodcutter pool flags are stored in `SleepState` and removed from the live person so ordinary planners cannot reactivate the sleeper.

## Bush lifecycle

Bushes are lightweight metadata on grass tiles, not buildings or transportable goods. A full bush contains one portion. Eating schedules deterministic regrowth 120–180 simulated seconds later.

`World.nextBushRegrowTick` stores the earliest due regrowth. A map scan occurs only when that event is due. Terrain cleanup runs on the normal one-second decision cadence so roads, fields or construction permanently remove invalidated bushes without per-tick full-map work.

## HQ storage adapter

The HQ is product-level storage from the start, but mature transport code treats `kind === "warehouse"` as the generic inventory pickup/delivery endpoint. `src/simulation/needs.ts` therefore maintains a hidden retired `hq-storage-proxy` that shares the exact same inventory object as the HQ.

The adapter is created lazily on the first simulation tick, so the initial world still contains only the visible HQ. It is retired and therefore not rendered or selectable.

The adapter serves two technical purposes:

1. HQ carriers can deliver collected goods through the existing warehouse delivery path.
2. Production workers can fetch required ingredients from HQ inventory through the same generic source-selection, reservation, pickup and return-cargo path used for normal warehouses.

Because the generic production planner skips retired sources with no output before checking warehouse inventory, the internal adapter keeps a one-unit output sentinel. Actual source stock still comes exclusively from the shared inventory; the sentinel is never transported or shown as product state. This is intentionally a compatibility adapter until storage becomes a shared capability rather than a building-kind special case.

HQ carriers themselves still collect only non-storage production/raw-material sources within the configured warehouse collection radius. Merchants remain the only automatic warehouse-to-warehouse mechanism.

## Movement and roads

`hex.ts` provides weighted Dijkstra routing and step-count BFS. Grass, roads, forests, fields and building tiles are walkable; mountains and rivers block movement.

Road movement cost is `1 / 1.3`, corresponding to a 30% speed increase. Eight traversals of one grass tile inside 32 seconds permanently create a road.

Person movement is visually continuous while the grid remains authoritative for pathfinding.

## Buildings and placement

User-placeable buildings are warehouse, house, farm, sawmill, carpenter, mill, bakery and well. The HQ is the initial four-tile building.

```text
HQ          4 tiles
Warehouse   4
House       4
Farm        4
Sawmill     6
Carpenter   4
Mill        4
Bakery      4
Well        4
Pottery     4
Stonemason  4
```

Footprint and a complete one-tile clearance ring must fit valid terrain. Bushes count as grass for placement; footprint cells destroy them permanently.

Construction duration is `(3 + 2 × required units) × 60` ticks. Up to two builders may work on one construction site.

## Production, inventories and logistics

Current goods are wood, plank, woodenTool, wheat, flour, water, bread, clay, rubble, brick and stoneBlock. Clay and rubble come from finite natural resource nodes next to rivers and mountains; each node contains 10 units and retires after the last extraction while already produced local output remains collectible.

```text
forest      -> 1 wood / cycle
sawmill     2 wood -> 1 plank
carpenter   2 plank -> 1 woodenTool
mill        1 wheat -> 1 flour
bakery      2 flour + 1 water -> 2 bread
pottery     1 clay + 1 wood -> 1 brick
stonemason  2 rubble -> 1 stoneBlock
well        infinite water source
```

Normal production outputs may be fractional because of profession experience. Production inputs, storage inventory and individual transport trips remain whole-unit. Every transport trip carries exactly one unit.

Normal production buildings and farms hold 10 local output units; forests keep their separate cap of 3 wood. Warehouse and HQ inventory capacity is 20 per good.

Production workers may source required inputs from reachable production outputs, wells, farms, normal warehouse inventory and HQ inventory. Sources are reserved before pickup so one physical unit cannot be claimed twice.

## Profession experience

Experience is persistent per person and profession from 0–100. Normal production and builders can reach 2× output/work contribution. Woodcutters, carriers and merchants instead gain up to 1.5× speed while yield/carry capacity remains fixed.

## Farm subsystem

`farm.ts` owns spatial field behavior. One farmer maintains up to four fields within three hex steps of the farm footprint.

Priority is harvest -> sow until four fields -> fertilize. Sowing and harvesting take 10 seconds. Natural growth stages take 30 seconds; fertilizing makes the remaining stage progress run at 3× speed. Harvested wheat is physically carried back to the farm.

## Rendering

`game/MainScene.ts` owns map drawing, selection and camera/input rules. `game/IncrementalMainScene.ts` caches terrain/building state and keeps persistent person markers so normal frames do not rebuild the scene graph.

Hunger and sleep use separate persistent presentation-only indicators. Bush indicators are also persistent and only redraw when availability changes.

`src/main.ts` coalesces render requests to at most one `requestAnimationFrame`, keeping rendering independent from simulation speed.

## Performance diagnostics

`src/debug/performanceProfiler.ts` stores rolling 30-second observational samples and never mutates authoritative state.

The debug panel separates hunger, sleep, movement, transport/logistics, construction, farm, production and planning. Remaining cost appears as simulation other/unaccounted. Pathfinding attribution separately distinguishes hunger, sleep, woodcutter, builder, logistics, merchant, farm, reroute and other.

Because hunger and sleep target validation is event-driven, their pathfinding counts should rise mainly when the need starts or an arrival discovers an invalid target.

## UI and mobile

The DOM UI owns simulation speed controls, building dialogs, build mode, merchant target mode, handbook and debug output. The map remains fullscreen.

The in-app handbook is presentation-only. `src/handbook/*.md` contains the player-facing source text. `src/ui/handbook.ts` imports these files as raw Markdown, renders the intentionally small supported subset (headings, paragraphs, lists and bold text) and owns page navigation/open/close behavior. `src/handbook.css` provides the responsive desktop/mobile layout. The handbook does not mutate authoritative simulation state.

The question-mark handbook button is part of the existing left menu and sits above the build button. On desktop the handbook is a centered modal with page navigation; on mobile it fills the viewport and uses horizontally scrollable page tabs.

Reference mobile behavior:

- page zoom suppressed,
- one-finger pan,
- two-finger map zoom/pan,
- map zoom 0.7×–3.5×,
- build ghost selected by short tap and confirmed only by the DOM build button.

## Testing and deployment

`npm test` runs deterministic Node tests through `tsx`. `npm run build` performs TypeScript checking plus the Vite production build.

Coverage includes movement, placement, construction, production, farms, forests, merchants, inventories, profession experience, hunger, sleep, performance diagnostics, HQ logistics and start/bush rules.

HQ supply coverage verifies that sawmill, carpenter, mill and bakery workers can source their required goods directly from HQ inventory. Food coverage verifies direct bakery eating and reservation of bakery bread portions.

`.github/workflows/deploy.yml` runs tests and the production build on pushes to `main`, then deploys GitHub Pages. Branch pushes do not deploy.
