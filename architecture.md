# Architecture

## Technology stack

The prototype is a browser-first TypeScript application.

- TypeScript
- Vite
- Phaser 4
- Static deployment through GitHub Pages
- Mobile baseline: iPhone 13 Mini, 375 × 812 CSS px

## Architectural principle

The deterministic simulation core stays independent from Phaser.

```text
src/
  simulation/   world state, rules, economy, logistics, needs, placement
  game/         Phaser rendering and map input
  ui/           DOM overlays and controls
```

Presentation reads simulation state; it must not invent authoritative game state.

## Core model

`src/simulation/model.ts` defines people, assignments, trips, buildings, fields, inventories, terrain, hunger and sleep state.

A tile keeps its normal terrain plus optional bush state:

```text
Tile
  terrain
  bush?
  bushAvailable?
  bushRegrowTick?
```

Bushes deliberately remain a lightweight feature on top of grass rather than becoming buildings or transportable goods. This lets normal grass pathfinding and placement rules continue to work.

Each person stores hunger from 0 to 100, a fractional hunger accumulator and optional `HungerState`. `HungerState` can reserve either a bread source building or one bush position while preserving the interrupted work state.

Each person also stores sleep from 0 to 100, a fractional sleep accumulator and optional `SleepState`. `SleepState` stores the selected sleep quality and target plus the interrupted assignment/pool state. During sleep the normal assignment and builder/woodcutter pool flags are temporarily removed so existing production, transport and planning code cannot reactivate the person. They are restored after waking if the referenced workplace still exists.

`BuildingKind` includes `house`. To avoid widening older building-management code unnecessarily, `PlaceableBuildingKind` adds `house` on top of the existing `BuildableBuildingKind` union and is used by placement/build-menu code.

## Scenario creation

`src/simulation/scenario.ts` owns the fixed **41 × 25** map and central balance values.

Two creation entry points are intentionally separated:

- `createWorld(population = CONFIG.population)` creates the neutral deterministic world used by existing low-level tests and isolated simulation scenarios. It uses the configured population count but no bushes, starting food or assigned roles.
- `createDefaultGameWorld()` creates the real player-facing PoC start and is the function used by `src/main.ts`.

The real game start uses 12 people:

- zero assigned HQ carriers at start, while the HQ supports up to two,
- two builders,
- two woodcutters,
- eight free people.

The HQ starts with 10 bread. Passive forests and 42 bushes are seeded at fixed map positions so replay remains deterministic. New people start with hunger 100 and sleep 100.

The deterministic world is wrapped by both needs hooks. Hunger is the outer hook and therefore runs first on each `round` increment; sleep runs immediately afterwards before movement/work for that simulation tick.

## Fixed simulation time

At displayed 1× the simulation advances at 60 fixed ticks per real second. Rendering remains independent on `requestAnimationFrame`.

Important values:

```text
production cycle         240 ticks / ~4 s
base movement            2.5 tiles / s
normal decision cadence  60 ticks / 1 s
road traffic window      1920 ticks / 32 s
farm sow/harvest         600 ticks / 10 s
sleep action             600 ticks / 10 s
field growth stage       1800 ticks / 30 s
bush regrowth            7200–10800 ticks / 120–180 s
```

## Hunger and food selection

`src/simulation/needs.ts` owns hunger decay and food choice.

Decay rates:

```text
idle / waiting           1 point / 4 s
walking                  1 point / 2 s
active work              1 point / 1 s
picked cargo             1 point / 1 s
```

Thresholds:

- hunger <= 40: eat at the next task boundary,
- hunger <= 20: interrupt immediately.

Task planning in `simulation.ts` also respects the <=40 threshold. Once a current work cycle, transport or other atomic activity has finished, no new assignment, resupply trip, farm action, merchant trip, builder target or forest target may start until eating has been handled.

Food candidates are evaluated with the normal weighted pathfinder and sorted by travel cost. Bread and bushes therefore compete in one list.

Bread can come from a finished warehouse or from the HQ inventory and restores hunger to 100. A bush restores 40 points, capped at 100.

Reservations are person-local: bread uses the source building id, bushes use a hex position. Other hungry people exclude an already reserved portion/source while planning. Once a reserved food source and its route remain valid, the existing path is reused across simulation ticks. Pathfinding runs again only when the source becomes invalid, the route no longer targets the reserved source, or a new source must be selected.

Critical interruption leaves `progress`, `farmTask` and `trip` intact. After eating, the target is reconstructed in this order:

1. farm task,
2. current transport source/target,
3. workplace assignment,
4. HQ.

## Sleep need and sleep-place selection

`src/simulation/sleep.ts` owns sleep decay, sleep-place selection, the fixed 10-second sleep action and task restoration.

Decay rates:

```text
idle / waiting           1 point / 8 s
walking                  1 point / 4 s
active work              1 point / 2 s
picked cargo             1 point / 2 s
```

Thresholds mirror hunger:

- sleep <= 40: sleep at the next task boundary,
- sleep <= 20: interrupt immediately.

When hunger and sleep are due together, hunger has priority. Sleep selection is intentionally local: candidates must be within eight reachable steps according to the step-count pathfinder. Quality is prioritized before distance:

```text
completed house          -> sleep = 100
forest tile / bush tile  -> +40
no local option           -> current ground tile, +20
```

Within one quality class the weighted route with the lowest travel cost wins. The selected house/nature target is revalidated while travelling; demolition or terrain changes cause a new local choice. Ground sleep never requires pathfinding.

A sleeping person keeps `progress`, `farmTask`, `trip` and merchant configuration. The normal assignment plus builder/woodcutter pool flags are temporarily stored in `SleepState` and removed from the live person so existing simulation planners skip the sleeper. On wake they are restored and the task target is reconstructed with the same priority used for hunger. Partial recovery gets a one-tick wake grace before another sleep request can begin.

Housing is deliberately minimal in this PoC stage: a completed house is a shared sleep destination with no resident assignment, family model or capacity yet.

## Bush lifecycle

Bush lifecycle also lives in `needs.ts` because it advances in simulation time.

A full bush becomes empty immediately when eaten. Its regrowth tick is chosen through the existing deterministic world RNG between 120 and 180 seconds in the future.

Before each needs step, bush metadata is cleaned up if the underlying tile is no longer grass. This is intentional: construction, fields or organic roads permanently destroy the bush.

`buildingPlacement.ts` explicitly clears bush metadata on every footprint tile when a building is placed. The stored restoration terrain remains grass/road only, so demolition restores ordinary grass rather than resurrecting a bush.

## HQ as initial warehouse

The HQ owns a normal inventory and acts as a bread source directly.

The generic transport delivery code currently recognizes `kind === "warehouse"` as the inventory delivery endpoint. To keep that mature transport path unchanged, `needs.ts` creates an internal retired `hq-storage-proxy` only when an assigned HQ carrier has something to collect. The proxy:

- sits at the HQ position,
- is not rendered or selectable because it is retired,
- shares the exact same inventory object as the HQ,
- is used only as the technical target of the existing whole-unit trip delivery path.

From product state there is still one storage location: the HQ. The adapter is an implementation detail until warehouse behavior is generalized to a shared storage capability.

The HQ has capacity for up to two assigned carriers but starts with none. Assigned HQ carriers follow the normal warehouse constraints:

- sources must be non-warehouse production/raw-material sources,
- source must lie within 10 reachable tile steps of HQ,
- exactly one whole unit is reserved and transported,
- per-good HQ capacity is 20.

The planner runs on the existing one-second decision cadence. Standard simulation movement, pickup and warehouse delivery finish the physical trip.

## Movement and roads

`hex.ts` provides weighted Dijkstra routing and step-count BFS. Grass, roads, forests, fields and building tiles are walkable; mountains and rivers are blocked.

Road movement cost is `1 / 1.3`, corresponding to a 30% speed increase.

Eight traversals of one grass tile within 32 seconds turn it into a road. On the next needs step any bush metadata on that now-non-grass tile is removed permanently.

## Buildings and placement

User-placeable kinds are warehouse, house, farm, sawmill, carpenter, mill, bakery and well. The HQ is a four-tile initial building.

Footprints:

```text
HQ          4
Warehouse   4
House       4
Farm        4
Sawmill     6
Carpenter   4
Mill        4
Bakery      4
Well        4
```

The house currently costs four wood, has no workers, inventory or recipe, and becomes a valid sleep target only when construction is complete.

Footprint and one-tile clearance ring must lie on grass/road. Because bushes are stored as metadata on grass, they are valid placement cells. Only footprint cells destroy bushes; bushes in the clearance ring stay untouched.

Construction duration remains `(3 + 2 × required units) × 60` ticks. Up to two builders work on one site.

## Production, inventories and logistics

Current goods are wood, plank, woodenTool, wheat, flour, water and bread.

Normal production outputs may be fractional because of experience. Inputs, warehouse/HQ inventory and individual transport trips remain whole-unit.

Generic recipes:

```text
forest      -> 1 wood / cycle
sawmill     2 wood -> 1 plank
carpenter   2 plank -> 1 woodenTool
mill        1 wheat -> 1 flour
bakery      2 flour + 1 water -> 2 bread
well        infinite water source
```

Normal production buildings and farms have a local output capacity of 10. Forests deliberately keep their separate local output cap of 3 wood. `simulation.ts` resolves the applicable capacity per building before starting production or resupply decisions.

Warehouses and HQ use 20 units per good. Ordinary warehouse carriers and assigned HQ carriers collect only non-warehouse sources within 10 reachable steps. Merchants remain the mechanism for warehouse-to-warehouse routes.

## Profession experience

Experience is persistent per person and profession, 0–100.

The target curve reaches roughly 50 at 10 active minutes, 80 at 30, 95 at 60 and 100 at 90.

Normal production and builders can reach 2× output/work contribution. Woodcutters instead reach at most 1.5× work speed while keeping exactly one wood per cycle. Carriers and merchants also reach at most 1.5× movement speed while carrying exactly one unit.

## Farm subsystem

`farm.ts` owns spatial field behavior. A farm worker maintains at most four active fields inside three hex steps of the farm footprint.

Priority is harvest -> sow until four fields -> fertilize. Sowing and harvesting take 10 seconds. Natural stage growth takes 30 seconds; fertilizing makes remaining stage growth run at 3× speed.

Harvest returns one physical wheat to the farm through the existing trip primitive; any fractional experience bonus is credited at farm arrival.

## Rendering

`game/MainScene.ts` remains the source of map drawing rules, selection rendering and camera/input behavior. `game/IncrementalMainScene.ts` extends it with a presentation cache so normal animation frames do not rebuild the complete Phaser display tree.

The incremental scene separates presentation work into three layers:

- map terrain, building labels and selection outlines redraw only when a compact signature of terrain/building/selection state changes,
- inventory slot graphics and labels redraw only when displayed input/output values change,
- person markers are persistent Phaser objects; normal frames update their position, color, role icon and cargo visibility instead of destroying and recreating them.

Build-mode and merchant-target highlights are also signature-cached and redraw only when their relevant mode/hover/world state changes. `src/main.ts` coalesces all `renderWorld()` requests to at most one `requestAnimationFrame`, so faster simulation speeds can perform multiple deterministic ticks without multiplying presentation renders within the same browser frame.

`game/hungerIndicators.ts` keeps a presentation-only hunger indicator per person once that person first becomes hungry. The bubble and icon stay alive until scene shutdown; normal `POST_UPDATE` work only updates visibility, status color and position.

`game/sleepIndicators.ts` follows the same persistent presentation-only pattern for sleep. It renders a separate `💤` badge to the right of the hunger badge, yellow at <=40 sleep and red at <=20. It does not mutate simulation state.

`game/bushIndicators.ts` keeps at most one `Graphics` object per bush seeded at scene creation. The current product never creates new bush locations after start, so later bush lifecycle only changes availability or permanently removes the bush. Each `POST_UPDATE` checks those seeded bush references, toggles visibility and redraws only when a bush changes between full and empty.

## Performance diagnostics

Performance diagnostics are observational only. `src/debug/performanceProfiler.ts` stores timestamped samples in a rolling 30-second window and never writes authoritative game state.

The global probes measure browser frame duration/FPS, deterministic tick cost and rate, scheduler backlog, pathfinding cost/call rate, incremental render cost and world counts.

Simulation feature timings remain deliberately coarse: hunger/food, movement, transport/logistics, construction, farm/fields, production and planning are measured explicitly; remaining work appears as **simulation other / unaccounted**. Sleep currently falls into this remainder rather than introducing a second needs-specific profiler category.

Pathfinding attribution remains cross-cutting and is not added twice to feature cost. Hunger, woodcutter, builder, logistics, merchant, farm, reroute and other are the current attribution reasons; sleep route searches currently use the generic pathfinder without adding a new profiler reason.

The Debug panel refreshes at 4 Hz only while visible. It keeps its existing rolling summaries and preserves table scrolling behavior on touch devices.

## UI and mobile

The DOM UI owns simulation speed controls, building dialogs, build mode, merchant target mode and debug output. The map remains fullscreen.

Reference mobile behavior:

- page zoom suppressed,
- one-finger pan,
- two-finger map zoom/pan,
- map zoom 0.7×–3.5×,
- build ghost selected by short tap and confirmed only by the DOM build button.

The left build menu includes the Wohnhaus. The existing generic placement flow is reused rather than introducing a separate housing placement mode.

## Testing and deployment

`npm test` runs deterministic Node tests through `tsx`. `npm run build` performs TypeScript checking plus the Vite production build.

Coverage includes movement, placement, construction, production, farms, forests, merchants, inventory integer rules, profession experience, hunger, sleep, performance-profiler invariants and start/bush rules.

Sleep coverage verifies idle/walking/work decay, deferred and critical interruption, house/nature/ground recovery, the eight-step locality limit and hunger priority.

The needs/performance suites additionally verify that a valid reserved hunger route is reused across ticks and that feature timing is normalized into per-tick cost without applying that normalization to presentation-only features.

`.github/workflows/deploy.yml` runs tests and production build on pushes to `main`, then deploys GitHub Pages. Branch pushes do not deploy.
