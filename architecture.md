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

`src/simulation/model.ts` defines people, assignments, trips, buildings, fields, inventories, terrain and hunger state.

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

## Scenario creation

`src/simulation/scenario.ts` owns the fixed **41 × 25** map and central balance values.

Two creation entry points are intentionally separated:

- `createWorld(population = CONFIG.population)` creates the neutral deterministic world used by existing low-level tests and isolated simulation scenarios. It uses the configured population count but no bushes, starting food or assigned roles.
- `createDefaultGameWorld()` creates the real player-facing PoC start and is the function used by `src/main.ts`.

The real game start uses 12 people:

- one HQ carrier,
- two builders,
- two woodcutters,
- seven free people.

The HQ starts with 10 bread. Passive forests and bushes are seeded at fixed map positions so replay remains deterministic.

## Fixed simulation time

At displayed 1× the simulation advances at 60 fixed ticks per real second. Rendering remains independent on `requestAnimationFrame`.

Important values:

```text
production cycle         240 ticks / ~4 s
base movement            2.5 tiles / s
normal decision cadence  60 ticks / 1 s
road traffic window      1920 ticks / 32 s
farm sow/harvest         600 ticks / 10 s
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

Food candidates are evaluated with the normal weighted pathfinder and sorted by travel cost. Bread and bushes therefore compete in one list.

Bread can come from a finished warehouse or from the HQ inventory and restores hunger to 100. A bush restores 40 points, capped at 100.

Reservations are person-local: bread uses the source building id, bushes use a hex position. Other hungry people exclude an already reserved portion/source while planning.

Critical interruption leaves `progress`, `farmTask` and `trip` intact. After eating, the target is reconstructed in this order:

1. farm task,
2. current transport source/target,
3. workplace assignment,
4. HQ.

## Bush lifecycle

Bush lifecycle also lives in `needs.ts` because it advances in simulation time.

A full bush becomes empty immediately when eaten. Its regrowth tick is chosen through the existing deterministic world RNG between 120 and 180 seconds in the future.

Before each needs step, bush metadata is cleaned up if the underlying tile is no longer grass. This is intentional: construction, fields or organic roads permanently destroy the bush.

`buildingPlacement.ts` explicitly clears bush metadata on every footprint tile when a building is placed. The stored restoration terrain remains grass/road only, so demolition restores ordinary grass rather than resurrecting a bush.

## HQ as initial warehouse

The HQ owns a normal inventory and acts as a bread source directly.

The generic transport delivery code currently recognizes `kind === "warehouse"` as the inventory delivery endpoint. To keep that mature transport path unchanged, `needs.ts` creates an internal retired `hq-storage-proxy` only when the HQ carrier has something to collect. The proxy:

- sits at the HQ position,
- is not rendered or selectable because it is retired,
- shares the exact same inventory object as the HQ,
- is used only as the technical target of the existing whole-unit trip delivery path.

From product state there is still one storage location: the HQ. The adapter is an implementation detail until warehouse behavior is generalized to a shared storage capability.

The HQ carrier planner follows the normal warehouse constraints:

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

User-buildable kinds are warehouse, farm, sawmill, carpenter, mill, bakery and well. The HQ is a four-tile initial building.

Footprints:

```text
HQ          4
Warehouse   4
Farm        4
Sawmill     6
Carpenter   4
Mill        4
Bakery      4
Well        4
```

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

Warehouses and HQ use 20 units per good. Ordinary warehouse carriers and the initial HQ carrier collect only non-warehouse sources within 10 reachable steps. Merchants remain the mechanism for warehouse-to-warehouse routes.

## Profession experience

Experience is persistent per person and profession, 0–100.

The target curve reaches roughly 50 at 10 active minutes, 80 at 30, 95 at 60 and 100 at 90.

Normal production and builders can reach 2× output/work contribution. Woodcutters instead reach at most 1.5× work speed while keeping exactly one wood per cycle. Carriers and merchants also reach at most 1.5× movement speed while carrying exactly one unit.

## Farm subsystem

`farm.ts` owns spatial field behavior. A farm worker maintains at most four active fields inside three hex steps of the farm footprint.

Priority is harvest -> sow until four fields -> fertilize. Sowing and harvesting take 10 seconds. Natural stage growth takes 30 seconds; fertilizing makes remaining stage growth run at 3× speed.

Harvest returns one physical wheat to the farm through the existing trip primitive; any fractional experience bonus is credited at farm arrival.

## Rendering

`game/MainScene.ts` renders the authoritative map and people.

`game/hungerIndicators.ts` wraps scene creation and adds presentation-only hunger badges above people.

`game/bushIndicators.ts` uses the same safe scene-lifecycle pattern. It draws a small green bush above grass tiles with `bush === true`; full bushes show berry dots while empty bushes remain muted green. It never changes simulation state.

Both overlays rebuild their small containers on `POST_UPDATE`. At the current PoC scale this remains inexpensive.

## UI and mobile

The DOM UI owns simulation speed controls, building dialogs, build mode, merchant target mode and debug output. The map remains fullscreen.

Reference mobile behavior:

- page zoom suppressed,
- one-finger pan,
- two-finger map zoom/pan,
- map zoom 0.7×–3.5×,
- build ghost selected by short tap and confirmed only by the DOM build button.

## Testing and deployment

`npm test` runs deterministic Node tests through `tsx`. `npm run build` performs TypeScript checking plus the Vite production build.

Coverage includes movement, placement, construction, production, farms, forests, merchants, inventory integer rules, profession experience, hunger and the new start/bush rules.

The start/bush suite verifies:

- 12-person player start and initial roles,
- 10 bread in HQ,
- HQ bread consumption,
- +40 berry nutrition,
- 2–3 minute bush regrowth,
- permanent bush destruction by building placement,
- HQ carrier collection into the HQ inventory.

`.github/workflows/deploy.yml` runs tests and production build on pushes to `main`, then deploys GitHub Pages. Branch pushes do not deploy.
