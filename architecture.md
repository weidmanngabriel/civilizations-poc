# Architecture

## Technology stack

The prototype is built as a browser-first TypeScript application.

- **Language:** TypeScript
- **Build tooling:** Vite
- **Game framework:** Phaser 4
- **Target:** modern web browsers, deployable as a static site (for example via GitHub Pages)

## Architectural principle

The simulation core must stay independent from Phaser.

Phaser is responsible for presentation and interaction concerns such as rendering, camera, sprites, animation, input and scene handling. Product logic belongs in plain TypeScript modules so that it can be tested without rendering and replaced or reused independently of the game framework.

Preferred high-level split:

```text
src/
  simulation/   # world state, entities, economy, logistics, rules
  game/         # Phaser scenes, rendering, input, visual adapters
  ui/           # browser/game UI where useful
```

Dependencies should flow from presentation toward the simulation, not the other way around. Code in `simulation/` must not import Phaser.

## Why Phaser 4

Phaser 4 provides the browser-oriented 2D game infrastructure needed for the prototype without forcing simulation logic into a large engine-specific architecture. It gives us established solutions for rendering, camera, asset loading, animation and input while preserving a straightforward TypeScript codebase.

This fits the project's current goal: build a small, understandable proof of concept first and keep the path open for a substantially richer agent-based economy simulation later.

## Scope of this decision

This is an architectural baseline, not a commitment to model the final game around Phaser concepts. If requirements later justify a different renderer or runtime, the independent simulation layer should minimize migration cost.

## Implemented PoC 1

- `src/simulation/model.ts` defines generic people, assignments, transport trips, recipes, buildings and world state. Roles remain data, not subclasses. A person can additionally carry the global `woodcutter` job independently of a specific forest assignment.
- `scenario.ts` owns the fixed **21 × 13** offset-layout hex map, axial building coordinates, eight-person start and economy configuration. Buildings still occupy one tile, while the road network deliberately separates production stages by longer routes and includes branches/loops. The map starts with several small groups of walkable passive forest tiles and **no active forest building**.
- `hex.ts` provides axial neighbors and BFS over road, forest and building tiles. Grass, mountain and river tiles remain blocked.
- `simulation.ts` owns deterministic in-place ticks, assignment changes, population changes, global woodcutter appointment, reservations, recipes, finite forest depletion, forest claiming/relocation and status derivation. No timers or renderer imports occur in the core.
- Each tick moves every person at most once, handles arrivals and transfers, advances production once, retires depleted forests, assigns waiting woodcutters to available forests, then plans new transport trips. Stable person/building order resolves normal non-random ties.
- Trips represent reservations directly; no separate job queue exists. Unpicked trips reserve existing output, all trips reserve destination capacity, and picked trips retain a source output slot until delivery. Cancellation returns carried cargo to the original source without reviving a depleted forest.
- Production inputs are consumed at completion and remain in the building while work is in progress. No other system consumes input inventory. Cancelling work resets progress while preserving materials. In-progress work reserves output capacity.
- Production workers prioritize production whenever enough input and output capacity are available. They only plan their own input trips when production cannot currently proceed (for example because input is insufficient or output is full), and then continue filling free input slots up to capacity. Already incoming trips count against destination input capacity.
- Woodcutters are appointed globally rather than assigned manually to a forest. Each appointed woodcutter independently selects one nearest reachable unoccupied active forest or passive forest tile. Equal-distance choices use the seeded PRNG in `World.rngState`, preserving deterministic replay. A passive tile becomes a dynamic `forest-N` building when claimed.
- Every active forest starts with `CONFIG.forestYield` (= 10) units and has exactly one worker slot. At most one woodcutter can therefore work at a forest at a time. A vacated, non-depleted active forest can later be claimed by another woodcutter.
- Once a forest reaches zero remaining yield, it retires **immediately** and its tile becomes road even if produced wood remains there. The retired building record remains internally so local output and in-flight transport references stay valid. Retired forest output remains a legal logistics source until collected.
- If more woodcutters exist than available forests, the excess woodcutters remain appointed and wait/return toward HQ until a forest becomes available.
- `game/MainScene.ts` renders the 21 × 13 world into a 1000 × 570 Phaser canvas using a denser hex projection, plus numbered person markers and live input/output capacity slots. Passive forests, newly activated forests and retired road tiles redraw directly from world state. Active forest tree graphics use `max(0.35, remaining / forestYield)` opacity, so declining timber is visible without making the forest unreadable. Remaining wood from retired forests continues to render as resource slots at the old location.
- Phaser map labels use higher-resolution text textures (`setResolution(2)`) and practical minimum font sizes to avoid blurry small text when the responsive canvas is scaled.
- `ui/controls.ts` implements native DOM buttons and building/person panels. Rendering reads the same world after each user command. Woodcutters have a global +/- control; dynamic forest cards are informational rather than assignment controls.
- The optional autoplay repeatedly calls the same deterministic `tick()` used by the manual next-round button. The normal UI exposes **1–10 FPS** through an interval timer. A separate **Max FPS** toggle disables that slider and advances one simulation round per `requestAnimationFrame`, allowing the browser/display loop to drive the fastest interactive rate without changing simulation rules.
- TypeScript 5.9 is used because its JavaScript compiler also works in restricted runtimes that cannot run the native TypeScript 7 compiler.
- `npm test` uses Node's test runner through `tsx`. `npm run build` checks types then creates `dist/` with Vite. No external fonts or graphic assets are required.
- `.github/workflows/deploy.yml` tests and builds on pushes to `main`, then deploys the artifact to GitHub Pages. Branch pushes do not trigger this workflow. Pages must use the GitHub Actions publishing source. Vite's base is `/civilizations-poc/`.
