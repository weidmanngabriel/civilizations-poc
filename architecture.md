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

Dependencies flow from presentation toward the simulation. `src/simulation/` must not import Phaser.

Phaser is responsible for presentation and map interaction. Product logic remains in plain TypeScript modules so it can be tested independently and reused if the renderer changes later.

## Simulation core

`src/simulation/model.ts` defines generic people, assignments, transport trips, recipes, buildings and world state. Roles remain data rather than subclasses. A person may carry the global `woodcutter` job independently of a specific forest assignment.

`scenario.ts` owns the fixed **21 × 13** offset-layout hex map, building positions, eight-person start and economy configuration. Buildings occupy one tile. The map starts with several small groups of passive forest tiles and no active forest building.

`hex.ts` provides axial neighbors and BFS pathfinding over road, forest and building tiles. Grass, mountain and river are blocked.

`simulation.ts` owns deterministic in-place ticks, assignment changes, population changes, global woodcutter appointment, reservations, recipes, finite forest depletion, forest claiming/relocation and status derivation. No timers or renderer imports occur in the core.

Each tick moves each person at most once, handles arrivals and transfers, advances production, retires depleted forests, reallocates waiting woodcutters and finally plans new transport trips. Stable person/building order plus seeded randomness keep replay deterministic.

Trips represent reservations directly. Unpicked trips reserve source output; all trips reserve destination capacity; picked trips retain their source output slot until delivery. Cancelling a carried trip returns the cargo to its original source without reviving retired forests.

Production inputs remain inside the building until completion. In-progress production reserves output capacity. Production workers prioritize production and only fetch inputs themselves when production is blocked. Carriers only fetch inputs for their assigned workplace.

## Forest logic

Woodcutters are appointed globally. Each independently chooses the nearest reachable unoccupied active or passive forest. Equal-distance choices use the seeded PRNG in `World.rngState`.

A passive forest tile becomes a dynamic `forest-N` building when claimed. Every active forest starts with `CONFIG.forestYield = 10`, has one worker slot and produces one wood after five work rounds. Forest opacity follows `max(0.35, remaining / forestYield)`.

At zero yield the forest retires immediately and its tile becomes road. The retired building record remains internally while residual output or transport references exist. The woodcutter then seeks another forest without teleporting.

## Map rendering and interaction

`game/MainScene.ts` renders the 21 × 13 world into a logical **1000 × 570** Phaser canvas. Passive forests, active forests, retired road tiles, people and resource slots are derived directly from world state.

The Phaser camera owns map navigation. Desktop uses wheel zoom and pointer drag. Mobile uses `game/mobileTouch.ts`, which installs native non-passive `TouchEvent` listeners on the canvas so one-finger pan and two-finger pinch work reliably on iOS Safari. Camera zoom is clamped to **0.7×–3.5×**.

Browser/page zoom is intentionally suppressed inside the app while normal page scrolling outside the map remains available.

Building interaction is map-first. A short click/tap on a visible building performs hit detection in world coordinates and selects that building; drag/pan and pinch gestures do not select. The selected building is highlighted on the map. Phaser emits only the selected `BuildingId`; the DOM UI owns all controls and status rendering.

## DOM UI

`ui/controls.ts` owns the top metrics, simulation controls, selected-building panel and debug people table.

The former permanent population controls and building cards below the map are removed. Instead:

- selecting the **HQ** opens global population and woodcutter controls;
- selecting **Sägewerk**, **Schreinerei** or **Lager** shows recipe/inventory/status and worker/carrier assignment controls where applicable;
- selecting an **active forest** shows remaining yield, local output and status without manual assignment buttons;
- the global people/transport table remains below the map as a development/debug aid.

The selected-building panel is a compact DOM panel attached directly to the map area and remains usable on the iPhone 13 Mini baseline.

During autoplay the large DOM structures are not rebuilt every animation frame. Lightweight metrics, selection values and disabled states are updated in place while the map redraw follows the presentation loop. Full panel/table reconstruction happens on user commands, pause or a new selection. This avoids replacing buttons while the user is interacting with them.

## Time and presentation

Simulation ticks and presentation refreshes are decoupled.

- Manual step: one deterministic `tick()`.
- Normal autoplay: **1–10 FPS** through an interval timer.
- Max FPS: one simulation round per `requestAnimationFrame`.
- Presentation refresh: its own `requestAnimationFrame` loop, capped at an average **60 FPS** with a dirty flag.

The rules do not change with speed.

## Build and deployment

Vite injects `process.env.BUILD_TIME` as an ISO timestamp. `main.ts` renders it in the `Europe/Berlin` timezone beside the PoC label so the live deployment can be identified immediately.

TypeScript 5.9 is used in the project toolchain. `npm test` runs Node tests through `tsx`; `npm run build` performs type checking and the Vite production build.

`.github/workflows/deploy.yml` tests and builds pushes to `main`, then deploys GitHub Pages. Branch pushes do not deploy. Vite base path is `/civilizations-poc/`.
