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

- `src/simulation/model.ts` defines a generic person, assignment, transport trip, recipe, building and world state. Roles are data, not subclasses.
- `scenario.ts` owns the fixed **21 × 13** offset-layout hex map, axial building coordinates, eight-person start and economy configuration. Buildings still occupy one tile, while the road network deliberately separates production stages by longer routes and includes branches/loops.
- `hex.ts` provides axial neighbors and BFS over road/building tiles only.
- `simulation.ts` owns deterministic in-place ticks, assignment changes, population changes, reservations, recipes and status derivation. No timers or renderer imports occur in the core.
- Each tick moves every person at most once, handles arrivals and transfers, advances production once, then plans new transport trips. Stable person/building order resolves ties.
- Trips represent reservations directly; no separate job queue exists. Unpicked trips reserve existing output, all trips reserve destination capacity, and picked trips retain a source output slot until delivery. Cancellation can therefore return cargo without loss or overflow.
- Production inputs are consumed at completion and remain in the building while work is in progress. No other system consumes input inventory. Cancelling work resets progress while preserving materials. In-progress work reserves output capacity.
- Production workers prioritize production whenever enough input and output capacity are available. They only plan their own input trips when production cannot currently proceed (for example because input is insufficient or output is full), and then continue filling free input slots up to capacity. Already incoming trips count against destination input capacity.
- `game/MainScene.ts` renders the 21 × 13 world into a 1000 × 570 Phaser canvas using a denser hex projection, plus numbered person markers and live input/output capacity slots. The slots are presentation-only and read existing building inventories and configured capacities.
- Phaser map labels use higher-resolution text textures (`setResolution(2)`) and practical minimum font sizes to avoid blurry small text when the responsive canvas is scaled.
- `ui/controls.ts` implements native DOM buttons and building/person panels. Rendering reads the same world after each user command. The optional autoplay timer also lives here and repeatedly calls the same deterministic `tick()` used by the manual next-round button. Its UI exposes **1–10 FPS**, interpreted as 1–10 regular simulation rounds per real second; changing FPS never changes simulation rules.
- TypeScript 5.9 is used because its JavaScript compiler also works in restricted runtimes that cannot run the native TypeScript 7 compiler.
- `npm test` uses Node's test runner through `tsx`. `npm run build` checks types then creates `dist/` with Vite. No external fonts or graphic assets are required.
- `.github/workflows/deploy.yml` tests and builds on pushes to `main`, then deploys the artifact to GitHub Pages. Branch pushes do not trigger this workflow. Pages must use the GitHub Actions publishing source. Vite's base is `/civilizations-poc/`.
