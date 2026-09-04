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
