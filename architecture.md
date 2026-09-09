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

Dependencies flow from presentation toward the simulation. `src/simulation/` must not import Phaser. Phaser is responsible for presentation and map interaction; product logic remains in plain TypeScript modules so it can be tested independently.

## Simulation core

`src/simulation/model.ts` defines generic people, assignments, transport trips, recipes, buildings, building kinds, local inventories and world state. Buildings have stable string IDs plus a separate `kind`, so multiple warehouses, sawmills and carpenter shops can exist without special-case IDs.

`scenario.ts` owns the fixed **21 × 13** offset-layout hex map, initial buildings, eight-person start and economy configuration. Buildings occupy one tile. The map starts with several small groups of passive forest tiles and no active forest building.

`hex.ts` provides axial neighbors and BFS pathfinding over road, forest and building tiles. Grass, mountain and river are blocked.

`simulation.ts` owns deterministic in-place ticks, assignment changes, population changes, global woodcutter appointment, reservations, recipes, finite forest depletion, forest claiming/relocation, building placement/demolition, road editing and status derivation. No timers or renderer imports occur in the core.

Each tick moves each person at most once, handles arrivals and transfers, advances production, retires depleted forests, reallocates waiting woodcutters and finally plans new transport trips. Stable person/building order plus seeded randomness keep replay deterministic.

Trips represent reservations directly. Unpicked trips reserve source stock; planned deliveries reserve destination capacity. A picked trip physically carries one unit. Cancelling a carried trip returns it to the original source when that source still exists.

Production inputs remain inside the building until completion. In-progress production reserves output capacity. Production workers prioritize production and only fetch inputs themselves when production is blocked. Carriers assigned to production buildings only fetch that building's required input.

## Warehouse and logistics model

Warehouses have a local inventory keyed by good type rather than a single output counter. Current capacity is **20 units per good type** (`wood`, `plank`, `woodenTool`). Capacity reservations are tracked per good.

Warehouse carriers collect available output from non-warehouse sources. They never create warehouse-to-warehouse trips. Warehouses are nevertheless valid sources for production demand: a sawmill or carpenter worker/carrier may fetch the required input from a warehouse when it is the chosen reachable source.

This keeps warehouses as physical buffers in the logistics network without creating meaningless stock shuffling between warehouses.

## Dynamic buildings and terrain editing

Buildable kinds are currently **warehouse, sawmill and carpenter**. Building is instant and free for the PoC. A new building may be placed on an empty grass or road tile; the underlying terrain is remembered so demolition can restore it.

The HQ and active forests are not player-demolishable. Demolishing a normal building removes its local goods, cancels affected transport tasks, frees assigned people and restores the underlying terrain. People formerly assigned to the building return toward the HQ.

Grass can be changed to road and road back to grass. A road tile occupied by a person cannot be removed, preventing an agent from being stranded on a newly blocked tile. Terrain mutations re-plan affected/current paths against the changed navigation graph.

## Forest logic

Woodcutters are appointed globally. Each independently chooses the nearest reachable unoccupied active or passive forest. Equal-distance choices use the seeded PRNG in `World.rngState`.

A passive forest tile becomes a dynamic `forest-N` building when claimed. Every active forest starts with `CONFIG.forestYield = 10`, has one worker slot and produces one wood after five simulation steps. Forest opacity follows `max(0.35, remaining / forestYield)`.

At zero yield the forest retires immediately and its tile becomes road. The retired building record remains internally while residual output or transport references exist. The woodcutter then seeks another forest without teleporting.

## Map rendering and interaction

`game/MainScene.ts` renders the 21 × 13 world. The Phaser game uses `Phaser.Scale.RESIZE`, so the canvas follows the full browser viewport.

The app is a fullscreen game surface: `html`, `body`, `#app`, `main` and `#game` fill the viewport and the page itself does not scroll. UI is layered over the map.

The Phaser camera owns map navigation. Desktop uses wheel zoom and pointer drag. Mobile uses native non-passive touch listeners so one-finger pan and two-finger pinch work reliably on iOS Safari. Camera zoom is clamped to **0.7×–3.5×**. Browser/page zoom is suppressed inside the app.

Map interaction is selection-first. A short click/tap selects a building when one occupies the hit tile; otherwise it selects the tile itself. Drag/pan and pinch do not select. Phaser emits building/tile selection events while the DOM UI owns build, road, assignment and demolition controls.

## DOM UI

`ui/controls.ts` owns all HUD and overlay controls.

- top overlay: build/version and core metrics;
- bottom overlay: pause/resume, FPS and Max-FPS controls;
- while paused: **Nächster Schritt** for one deterministic tick;
- HQ selection: population and woodcutter controls;
- production building selection: recipe, inventory, worker/carrier controls and demolition;
- warehouse selection: all three local good stocks, carriers and demolition;
- active forest selection: remaining yield/output only;
- empty grass/road tile selection: instant building choices plus road build/remove where applicable;
- debug overlay: people and transport tasks.

Demolition uses a browser confirmation dialog before the destructive mutation is executed.

During autoplay large DOM structures are not rebuilt every animation frame. Lightweight metrics, selection values and disabled states are updated in place while the map redraw follows the presentation loop. Full panel/table reconstruction happens on user commands, pause or a new selection.

## Time and presentation

Simulation ticks and presentation refreshes are decoupled.

- Default state: running at **5 FPS**.
- Normal autoplay: **1–10 FPS** through an interval timer.
- Pause: stops simulation timers and exposes a single-step control.
- Single step: exactly one deterministic `tick()` while paused.
- Max FPS: one simulation tick per `requestAnimationFrame`.
- Presentation refresh: its own `requestAnimationFrame` loop, capped at an average **60 FPS** with a dirty flag.

The rules do not change with speed.

## Build and deployment

Vite injects `process.env.BUILD_TIME` as an ISO timestamp. `main.ts` renders it in the `Europe/Berlin` timezone in the top HUD.

TypeScript 5.9 is used in the project toolchain. `npm test` runs Node tests through `tsx`; `npm run build` performs type checking and the Vite production build.

`.github/workflows/deploy.yml` tests and builds pushes to `main`, then deploys GitHub Pages. Branch pushes do not deploy. Vite base path is `/civilizations-poc/`.
