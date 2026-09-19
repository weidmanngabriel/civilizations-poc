# Architecture

This file is the current architectural entry point. Detailed unchanged subsystems remain documented in [`architecture-detail.md`](./architecture-detail.md). If the two files conflict, this file describes the newer state.

The completed fine-grid/resource migration is recorded in [`FINE_GRID_RESOURCE_REWORK_PLAN.md`](./FINE_GRID_RESOURCE_REWORK_PLAN.md). It remains the reference for changes to map scale, terrain, resources, loose goods, movement, placement, roads or logistics.

Until version 1, backward compatibility is deliberately not maintained when it would require migrations, compatibility defaults, parallel legacy paths or special conditional logic. The current architecture and data formats are authoritative.

## Technology and boundaries

The prototype is a browser-first TypeScript application using TypeScript, Vite and Phaser 4, deployed statically through GitHub Pages.

```text
src/
  simulation/   deterministic authoritative world state and rules
  game/         Phaser rendering and map input
  buildings/    shared building visual/spatial contracts and registry
  assets/       runtime-ready building exports and other assets
  ui/           DOM overlays and controls
  handbook/     player-facing Markdown help
  debug/        performance diagnostics

building-editor/   desktop-first building authoring subpage
```

The deterministic simulation stays independent from Phaser. Presentation reads simulation state and never owns authoritative game state. The simulation runs at 60 ticks/s at displayed 1×; rendering is decoupled and driven by `requestAnimationFrame`.

## Simulation entry point

`src/simulation/simulation.ts` is the public simulation entry point and wraps/re-exports core behavior. `simulationCore.ts` is a scheduling/work-area facade around the historical core implementation in `simulationCoreEngine.ts`.

Autonomous target selection is event-driven where possible. Hunger, missing work and related fallback decisions use the existing one-second cadence instead of replanning every simulation tick. Hunger and sleep decay use the reduced early-game balance: their previous decay rate is halved while thresholds and recovery values remain unchanged. Generic path rerouting follows the currently authoritative task state rather than profession-specific fallback behavior; for fishing, an existing `fishingSpot` remains the movement target until that task state changes. Active routes are not recalculated merely because a road is created, removed or becomes organically established; road-cost changes apply when the next route is planned.

## Fine-grid spatial model

The authoritative spatial grid is a 5× linear refinement of the former coarse map:

```text
old logical world       41 × 25 coarse cells
refinement              5× per linear axis
current simulation      205 × 125 micro-cells
```

`src/simulation/spatial.ts` owns scale conversions. `src/simulation/hex.ts` owns cached coordinate lookup, movement legality and heap-backed A*. `src/game/mapProjection.ts` owns the shared affine projection and visible hex geometry; the building editor consumes the same projection.

Buildings and fields occupy many micro-cells while preserving their intended world-space size. The fine grid is a simulation mechanism and should not visually dominate the game.

## Terrain, resources and physical goods

Terrain describes only underlying ground. Trees, clay and stone are independent natural-resource objects with their own footprints and movement blocking. Blocking resources are interacted with from reachable neighboring cells rather than entered.

`World.looseGoods` is authoritative for physical raw goods. Loose stacks contain one good type, 1–3 units plus reservations, never block movement, and survive the disappearance of their source.

The physical raw-resource chain is:

```text
natural source -> extractor carries one unit -> personal work flag -> loose ground stack -> pickup -> consumer/storage
```

There is no fake natural-resource mirror for loose goods and no hidden HQ storage proxy.

## Generic editor-authored building definitions

`src/buildings/buildingVisualDefinition.ts` defines version 3 of the shared editor/runtime spatial schema:

```text
sprite
spriteAnchor      normalized x/y inside the source image
spriteWorldWidth  rendered width in world pixels
footprint
blocked
entrance
```

Gameplay properties such as recipes, workers, inventory, costs and technology stay outside this schema.

Sprite placement is intentionally independent from source-image resolution. `spriteAnchor` is stored as a relative position in the image and `spriteWorldWidth` is the authoritative rendered width in world pixels. Replacing a sprite with the same artwork at a higher pixel resolution therefore does not require recalculating its world size or anchor. The editor exports the selected PNG/WebP bytes without dimensional downscaling; runtime quality is determined by the supplied source asset rather than by a generated low-resolution copy.

`src/buildings/buildingDefinitionRegistry.ts` is the runtime registry. It maps a gameplay `BuildingKind` to a validated visual/spatial definition and sprite URL. A registered definition is authoritative for every current instance of that building kind; there is no per-instance compatibility or migration gate. `visualDefinitionId` may still be present as runtime/save metadata, but it does not select an older definition or suppress the current registry entry.

Every current `BuildingKind`, including `field`, has a same-key asset slot under `src/assets/buildings/<key>/`. Each slot contains `building.json` plus a sprite file. Types without a finished editor export use an explicit `{"placeholder": true, ...}` JSON and a transparent placeholder image; the registry imports these slots but skips placeholder JSONs, so current gameplay remains unchanged until a real export replaces the two files. Future `BuildingKind`s must receive the same-key slot in the same implementation run. There is intentionally no CI/build failure just for a placeholder slot.

The currently active editor definitions are HQ, bakery, farm, well and mill. For a registered building, the editor placement coordinate is the **visual/spatial anchor**. The simulation stores `Building.position` as the gameplay **interaction coordinate**, which is the authored `entrance`. The visual anchor is recovered deterministically as `position - entrance`. This preserves the existing simulation convention that workers, carriers and other systems route to `Building.position`, while the sprite and footprint remain aligned exactly as authored.

The authoritative footprint and collision semantics for registered buildings are therefore:

- `footprint` comes from the current registered `building.json` translated by the visual anchor;
- `blocked` becomes the derived `Tile.buildingBlocking` overlay;
- footprint cells not in `blocked` remain walkable;
- the authored `entrance` must be inside the footprint and not blocked;
- building kinds with placeholder definitions continue to use their current hard-coded spatial fallback.

`src/game/buildingSprites.ts` is the generic Phaser renderer for registered definitions. It loads registered sprites once, creates one sprite per completed building instance of a registered kind, derives the visual anchor from the building interaction coordinate, applies the normalized Phaser origin, and sets the display size from `spriteWorldWidth` plus the source aspect ratio. The renderer does not own placement or collision state.

Activating another editor-authored runtime building now consists only of replacing `building.json` and the sprite inside the existing same-key asset slot. No additional registry edit is required for current kinds because every current kind is already wired through `register(...)`. When a new `BuildingKind` is introduced in code, its same-key asset slot and registry registration are added in that same implementation run.

## Placement, clearance and demolition

`src/simulation/buildingPlacement.ts` remains authoritative for placement legality. For registered kinds it uses the editor footprint; otherwise it uses the current hard-coded shape table. The placement clearance is a compact ring of two micro-cells around whichever footprint is authoritative.

Every placeable building additionally requires its gameplay interaction coordinate / entrance to lie within the **3.5 coarse-world-tile orientation radius of at least one placed waypost**. Connectivity of that waypost to any other waypost is deliberately irrelevant: separate logistics networks may exist, for example on different islands. This rule is enforced by the same authoritative placement predicate used by both placement highlights and construction. Neutral low-level test worlds that deliberately omit the waypost subsystem retain unrestricted placement semantics.

Active natural-resource footprints reserve both the building footprint and the two-micro-cell clearance ring. Loose goods block only the actual footprint because they remain walkable and may stay in the surrounding clearance area.

For registered placeable buildings, construction stores the interaction position at the authored entrance, writes the authored footprint and `buildingBlocking` overlay, and otherwise preserves the existing construction/gameplay semantics.

Demolition restores the complete footprint, clears the building collision overlay and stale traffic state, and preserves the existing rule that a road covered by construction returns as grass rather than reappearing.

Construction requirements are centralized in `src/simulation/constructionRules.ts`. `buildingPlacement.ts` derives construction plans and durations from these shared requirements instead of owning a second cost table. The same module maps processed construction goods to the building type that produces them, so progression can derive prerequisites from actual construction costs.

## Fishing

Fishing reuses the personal work-area system rather than introducing a building or a separate water-resource entity. A fisher owns the same **2.5-world-tile work flag** used by outdoor resource workers. Valid fishing spots are walkable land cells adjacent to river terrain and inside that work area.

The simulation stores the current fishing spot, adjacent water target, cycle start tick and absolute end tick on the person. One fishing cycle lasts exactly five simulated seconds. Presentation derives a roughly 0.5-second cast, four-second hold and 0.5-second reel animation from those authoritative ticks. The deterministic catch roll is resolved only when the line is reeled in. Catch probability is derived from fisherman profession XP, from 0.30 at zero XP to 0.80 at 100 XP. Fisher profession XP is awarded only for a successful catch; failed cycles do not advance experience.

A successful cast sets exactly one `fish` unit as outdoor cargo on the fisherman. The fisherman carries that unit back to the personal work flag, where it becomes a normal loose-good stack. Completing a fishing cycle is also an explicit hunger task boundary: at or below the normal eat threshold, the fisher starts food planning immediately after reeling in, whether the cast succeeded or failed. A caught fish remains in `outdoorCarry` during that interruption and is routed to the work flag after eating. Natural-resource extractors use the same one-unit outdoor-cargo state: every completed wood, clay or rubble unit is carried to the worker's personal flag before becoming loose ground stock. This keeps the work flag as the authoritative outdoor collection point without introducing a second logistics system.

## Profession qualification

Profession XP and qualification rules are centralized in `src/simulation/experience.ts`. Basic professions are always selectable. Advanced production professions require 10 XP in their direct predecessor profession: woodcutter → sawmill worker → carpenter, clay digger → potter, stonecutter → stonemason, and farmer → miller → baker.

`setPersonProfession` is the authoritative mutation boundary and rejects profession changes that do not satisfy these person-specific prerequisites. UI surfaces must use the same qualification predicate rather than duplicating progression logic. The person context menu lists only professions currently available to that person, while building staffing filters out people who cannot qualify for the building's required profession.

## Storage and transport

HQ and warehouses use the same first-class storage semantics. Production workers/building carriers may fetch required goods from either storage type. Storage carriers deliver directly into their assigned warehouse/HQ inventory.

Automatic storage-to-storage collection remains forbidden. Warehouse merchants retain explicit warehouse-to-warehouse routes. Builders and production-building carriers retain their separate long-distance/demand-driven sourcing rules.

Physical pickup and dropoff are timed simulation interactions. Picking up a loose good from the ground takes one simulated second; building pickups, natural-resource pickups and all dropoffs take three simulated seconds before the inventory mutation occurs. The deadline is stored on the active trip, so pause and simulation-speed changes affect the interaction consistently and save/load preserves an in-progress transfer.

## Idle positions, indoor visibility and staffing markers

Idle positioning is authoritative simulation state through `Person.idleTarget`. Only final waiting positions are reserved; people may still cross the same cells while moving. Free people and idle builders wait outside the HQ, while natural-resource workers are owned by their work-area state and wait exactly at their personal flag when no local resource is available. Assigned building staff wait outside their workplace. A deterministic spread picks a reachable free stand position near the relevant anchor rather than stacking people at the entrance. Candidate stand positions are ranked cheaply first. Nearby idle moves use a bounded local search; only genuinely distant fallback movement uses normal A*. This prevents fresh-world idle placement from fanning out into expensive global path searches. Generic rerouting preserves an existing idle target instead of sending an otherwise free person back through the HQ first. UI activity text treats a reached idle target as "Wartet"; the internal `active` flag alone is not interpreted as actual work.

Building activities still use the authored entrance as their interaction coordinate. Presentation hides the person's normal world representation only while an actual building activity is underway inside a **completed** building, such as production work, eating from a building, sleeping in a house, or the timed pickup/dropoff phase of a trip at a building. Unfinished construction sites never count as indoor space, so builders and other people remain visible there during construction and material transfers. Pickups from loose goods or natural-resource sources remain visible because they happen outside buildings. Well interactions also remain visible because residents use the well from outside rather than entering it. The body marker, name/activity labels and carried-good marker are hidden together. Existing person selection remains active and keeps only its selection ring at the entrance. Merely crossing a walkable footprint cell does not hide the person.

Assigned staffing is also visualized without changing simulation rules: completed buildings show small presentation-only flags next to the entrance, blue for workers and red for carriers. Multiple flags are stacked compactly.

Demolishing a building immediately cancels activities that depend on that building. Assigned people lose the removed workplace, indoor need actions are interrupted, and anyone who was hidden becomes visible immediately before normal replanning continues.

## Work areas

Woodcutters, clay diggers, stonecutters, fishers, warehouse carriers and HQ carriers use per-person `WorkArea` state. The shared radius remains 2.5 coarse world tiles / 12.5 micro-cells.

Extractor flags start at the first selected resource. Storage-carrier flags start at their storage workplace. A personal flag acts as a private local navigation node for that person: once the person is inside its radius, movement to work targets that are also inside the radius uses local micro-grid A* and bypasses the global waypost graph. Moving a flag does not create a local shortcut from the old location: if the person is outside the newly positioned work area, reaching the new node still requires normal global waypost navigation first. Moving a flag invalidates an unpicked source outside the new area but does not discard already carried cargo. Extractors already return every produced unit to their flag before choosing more work. Fishers return to the flag only after a successful catch because the carried fish must be deposited there; failed casts may immediately replan another local fishing spot. Storage carriers finish their collection trip at their storage workplace. Production carriers are deliberately outside this system.

Farms use the same local-node abstraction without a visible personal flag. The farm is the local node and its configured field radius defines the local work environment. A farmer outside that environment must reach the farm through the global waypost network. Once inside, field work uses local navigation. After sowing or fertilizing, the farmer returns to the farm before selecting another task; harvesting already ends with the carried wheat returning to the farm. Builders are intentionally excluded: construction sites never grant a local navigation node.

## Wayposts and high-level navigation

Wayposts are first-class navigation objects in `World.wayposts`; they are not buildings and remain independent from per-person work flags. Player-facing worlds start with one waypost on valid terrain roughly one coarse world tile in front of the HQ entrance.

Waypost balance is intentionally owned by separate constants even where current values match work-area balance. A waypost has a **3.5 coarse-world-tile orientation radius**. Minimum center-to-center spacing is coupled to the same **3.5 coarse world tiles**. The maximum direct connection distance is coupled to twice that radius, **7 coarse world tiles**. Each stored connection is rendered as its own directional sign using the shared isometric projection.

Placement reuses the building-placement interaction model without treating a waypost as a `Building`: desktop uses a hover ghost plus left-click placement and right-click/Escape cancellation; touch uses tap-to-position plus an explicit confirmation button. Entering waypost placement immediately highlights every currently valid anchor while the dimmed map makes invalid anchors visible by contrast. After choosing a position, the ghost additionally shows the orientation area and spacing constraint. A waypost reserves its own micro-cell plus the six directly adjacent micro-cells against building footprints; conversely, new wayposts cannot be placed in that one-cell clearance around an existing building footprint. Wayposts remain walkable. Clicking/tapping one opens a waypost panel with demolition; removal cleans reciprocal connections and advances the waypost-network revision.

Player-facing navigation requires the waypost graph for high-level reachability, but waypost cells are never physical checkpoints. If start and destination are covered by the same waypost or by directly neighboring connected wayposts, movement uses one ordinary direct micro-cell A* route. For journeys whose selected high-level chain contains three or more wayposts, the graph first chooses a cheap node chain and the micro-cell A* search is then restricted to the union of those wayposts' orientation areas. This keeps long searches bounded while allowing the person to cross each area wherever terrain and roads make sense instead of walking through the signpost centers. Terrain, blocking and road speed therefore remain authoritative locally. There is no direct fallback that bypasses missing waypost connectivity in player worlds. Neutral low-level test worlds without a waypost system retain unrestricted direct A* semantics. Failed required destinations are cached per person for the current waypost-network revision, so they are not repeatedly replanned; placing or removing a waypost increments the revision and re-enables one fresh search. A failed required route sets a person warning state that is cleared on a successful route or task cancellation.

## Hunger, sleep, farms, roads and progression

Hunger and sleep retain their event-driven target planning. Both needs begin autonomous planning at 40%, while player-facing warning state is deliberately separate: yellow at 30% and red at 20%. Hunger is sampled once per simulated second while movement and production continue at 60 Hz. Need decay uses the original seconds-per-point intervals. Food and sleep recovery are capped at 100; bread restores 80 hunger, fish 60 and bushes 40. Fish can be consumed from HQ/warehouse inventory or directly from a reserved loose fish stack. The two sleep phases restore 50/15/5 points each for house/nature/ground respectively. Entering sleep pauses activity without clearing profession, workplace, extractor role or current resource assignment.

Nature sleep targets are intentionally **not reserved** while a person is travelling. Trees and bushes enforce single occupancy only at arrival: if another person is already sleeping on the target, the arriving person replans from that position while excluding only the occupied target that was just reached. Ground sleep has no occupancy restriction.

Farm balance is unchanged. Field footprints must remain valid grass and cannot overwrite natural resources, loose goods, reservations or occupied cells.

Organic roads still require eight qualifying crossings within 32 simulated seconds and retain the 1.3× movement multiplier. Roads cannot cover active natural-resource footprints.

Profession experience remains persistent from 0–100, with +1 XP per completed professional action. Technology unlocks remain permanent and placement enforcement remains in the simulation layer.

`src/simulation/technology.ts` evaluates two independent prerequisite classes. Profession rules unlock the corresponding production building at the configured XP threshold. Separately, every building derives the producers required for its processed construction goods from `constructionRules.ts`. Such a building unlocks only after every required producer has at least one completed, non-retired building instance. An unfinished construction site does not count. For technologies that have both a profession rule and processed-material prerequisites, both conditions must be satisfied. Once added to `World.unlockedTechnologies`, the unlock is never revoked if the qualifying person disappears or the producer building is later demolished.

Player-facing worlds start with only the explicitly declared `STARTING_TECHNOLOGIES`; neutral test/sandbox worlds that omit `World.unlockedTechnologies` stay permissive. The simulation wrapper calls `updateTechnologyUnlocks` after each authoritative tick, so completion of a production building can unlock dependent construction immediately on that tick.

## Direct person commands

Direct person control is represented as explicit person state rather than a parallel UI-only worker pool. `Person.profession` stores a player-chosen profession independently of a workplace, `Person.home` stores the personal house assignment, and `Person.manualMoveTarget` marks a temporary player movement override. Existing legacy role flags and assignments remain the execution state for the simulation, while `currentProfession` prefers the explicit profession when present.

`src/simulation/personCommands.ts` owns player-facing person commands: profession change, workplace assignment, home assignment, direct movement, and explicit eat/sleep requests. Workplace validation derives role compatibility and capacity from the selected profession and target building. Personal homes are persisted automatically through the versioned person state and are preferred by the existing sleep planner when valid.

`src/ui/personContextMenu.ts` owns the fixed 16-slot context-menu layout and opens it from keyboard or an explicit UI request event. The visible action button itself is rendered as part of the normal person-inspector markup in `src/ui/personPanel.ts`, avoiding post-render DOM mutation and ensuring its label is present on the first paint. On mobile, that inspector is bottom-anchored, intentionally omits previous/next navigation controls, and uses single-line compact fact rows to minimize covered map area. `src/game/personCommandInteraction.ts` owns map target selection for movement, workplace, and home assignment. The command interaction wraps the same scene selection adapter as other modal map interactions, so target picking consumes the tap/click while ordinary camera dragging and zoom remain available. Work-area changes continue to use the existing dedicated work-area interaction.

The first slot mapping is intentionally sparse: 1 profession, 2 workplace, 3 home, 4 work area, 5 move, 6 eat, 7 sleep. Unavailable slots are omitted from rendering instead of being disabled, and future actions must reuse the remaining fixed positions rather than repacking existing actions.

Building staffing UI no longer calls the legacy automatic `changeAssignment` controls. `src/ui/controls.ts` renders each building role as explicit occupied or empty staff slots. Occupied slots dispatch the existing person-selection request so map focus and the person inspector use the normal selection path. Empty slots dispatch a staff-picker request consumed by `src/ui/personPanel.ts`; that panel temporarily switches into a candidate mode, orders matching-profession people without a workplace first, profession-free people second and all remaining candidates third, with alphabetical name ordering inside each group, and uses `setPersonProfession` plus `setPersonWorkplace` for the chosen person. The older simulation assignment helpers remain available to internal/test code but are no longer a player-facing staffing path. Dynamic player-facing choice lists use German locale ordering by visible label; the build menu keeps waypost placement as an explicit first-item exception until a scout role owns it. Runtime controls (`#autoplay`, `.speed-control`, `#debug-toggle`) are mounted by `controls.ts` but moved intact into `gameMenu.ts`, preserving their existing listeners and authoritative simulation state while removing the persistent bottom control bar. Main menus dispatch `poc-ui-menu-opened`; `personContextMenu.ts` consumes that signal to close the person action overlay whenever another menu opens.

## Rendering and interaction

Rendering stays decoupled from simulation ticks. `IncrementalMainScene` caches map/person presentation state; natural resources, loose goods, work-area flags and registered building sprites are presentation layers over authoritative simulation state. The person layer is rendered above natural resources, bushes and loose goods so residents remain visually readable while crossing resource visuals.

Camera zoom remains 0.7×–10× for mouse-wheel and pinch. Building assets intended to remain crisp at the upper zoom range should therefore retain substantially more source pixels than their normal world-space display size. Desktop and touch remain first-class input adapters, with the iPhone 13 Mini as the mobile baseline. Build placement chooses its presentation mode from the most recently observed Pointer Event: mouse input uses direct left-click placement and hides the confirm button, while touch/pen keeps tap-to-move plus explicit confirmation. The hover/fine-pointer media query is used only before any concrete pointer type has been observed, which keeps hybrid devices from being locked into the wrong interaction model.

## Building editor

`building-editor/` is a separate Vite multi-page entry published at `/civilizations-poc/building-editor/`. It is an internal desktop-first authoring tool and does not start Phaser or own simulation state.

The editor is WYSIWYG against the runtime projection. A fixed editor-only preview zoom enlarges both grid and sprite together, so their size relationship matches the game. Sprite size is authored as world-space width rather than as a multiplier of source pixels, and the anchor is authored as a percentage/relative image position. Runtime-ready exports live under `src/assets/buildings/<id>/`.

The selected sprite file is exported unchanged; the editor does not downscale or recompress it. The current schema is authoritative and intentionally has no backward-compatibility layer for older visual-definition versions. During local development the editor can write validated exports directly into the runtime asset folder; the published editor downloads the JSON and sprite instead.

## Save/load persistence

`src/simulation/saveGame.ts` owns the versioned JSON save format. Saves remain anchor/interaction-point based rather than snapshotting derived geometry: `tiles`, entity footprints and underlying building terrain are not persisted.

For a registered editor-authored building, the save stores the building's gameplay interaction position (`Building.position`, i.e. its entrance) plus ordinary gameplay state. `visualDefinitionId` may be serialized as metadata, but load-time spatial behavior is derived from the current registry definition for the building kind rather than from a historical definition snapshot.

On load, registered kinds reconstruct the visual anchor, footprint and blocked collision overlay from the current registry definition. Building kinds with placeholder definitions reconstruct from their current code-defined shape rules. Static terrain is regenerated from the deterministic base map; roads, traffic history and bushes remain sparse persisted map state.

The save format remains `civilizations-save` **version 3**. The visual-definition schema version is separate from the save version. Before v1, older save versions or data shapes are not migrated when compatibility would require special handling; they may be rejected or break as the current model changes.

Loading and starting a new game still replace the contents of the existing shared `World` object instead of swapping its identity, so Phaser and UI modules keep valid references.

## Building status overview

`src/ui/buildingAlerts.ts` derives current building alerts from authoritative world state without persisting notification history in `World`. A completed, non-retired building with worker slots contributes a warning while it has no assigned worker. `src/ui/buildingPanel.ts` mirrors the existing person-management pattern: the Buildings menu button shows compact severity counts, the overview can filter by severity, and selecting an entry focuses and opens that building. `src/game/buildingAttentionIndicators.ts` renders the same actionable state as a clickable/touchable world marker. There is intentionally no separate generic notification menu.

## Person status overview

`src/ui/personAlerts.ts` derives a single current alert per person from authoritative simulation state. Severity precedence is `critical > warning > info`, so one person contributes to at most one HUD/list count. The first rules cover critical/normal hunger and sleep plus truly free idle people. Need alerts reuse the same display-status helpers as the world icons, so the list, counters and filters stay aligned at 30% warning / 20% critical while simulation planning may already have started at 40%. The classifier deliberately does not infer missing-resource failures from generic inactivity.

`src/ui/personPanel.ts` caches this derived alert map and refreshes it once per second. The same cached result drives the compact counts on the People menu button, the three severity filters and the per-person reason shown in the browser. This remains presentation-derived state and is not persisted in `World`.

## Performance diagnostics

The debug profiler keeps short rolling in-memory timing windows for live inspection. `src/debug/performanceRecording.ts` adds an explicit user-started recording layer without changing simulation behavior: while active, it samples the existing profiler once per real second, adds compact world-size counters, and stores the samples only in browser memory. Stopping the recording produces a versioned `civilizations-performance-recording` JSON export with metadata, a per-second time series, and an automatically calculated summary of FPS, frame/tick costs, feature costs and pathfinding causes. The recorder deliberately does not emit per-tick logs or add new simulation scans.

## Existing architecture

All other unchanged systems remain documented in [`architecture-detail.md`](./architecture-detail.md), including production, inventories, merchants, person selection, handbook/PWA behavior and performance diagnostics. Where older detail text conflicts with this file, this file is authoritative.

## Testing and deployment

`npm test` is the deterministic Node suite. `npm run build` performs TypeScript checking and the Vite production build. Coverage includes building-visual schema validation, resolution-independent sprite metadata, registered-building entrance/footprint/blocking behavior, placement/demolition, physical goods, logistics, work areas, waypost spacing/connections/navigation, technology progression and save/load reconstruction.

Vite builds both the game root and `building-editor/index.html`. GitHub Pages publishes both from the same `dist` artifact.

Per `agents.md`, implementation work happens on a temporary branch and is transferred to `main` as one final squash commit. The main `deploy.yml` workflow validates pull requests targeting `main` with `npm test` and `npm run build` but skips Pages setup, artifact upload and deployment for pull-request events. After the squash merge, the push to `main` repeats tests and the production build and deploys GitHub Pages only if both succeed. Character-Lab visual review is intentionally not part of this pipeline.


## Character Lab

`character-lab/` ist eine eigenständige Vite-Unterseite zur Erprobung einer späteren 3D-Bewohnerdarstellung. Sie ist bewusst nicht mit Phaser oder der autoritativen Simulation gekoppelt.

Das Lab rendert mit der über Vite gebündelten Projektabhängigkeit Three.js einen einfachen blockigen Referenzcharakter über eine orthografische isometrische Kamera; zur Laufzeit ist dafür kein CDN nötig. Körperteile hängen an festen lokalen Pivots; verfügbare Rotationsachsen und Neutralwinkel liegen in der Character-Definition. Pose-Winkel werden im Character Lab nicht künstlich begrenzt. Animationen sind JSON-Daten mit normiertem Fortschritt von 0 bis 1, absoluten lokalen Gelenkwinkeln und einer wählbaren Interpolationskurve (`linear`, `easeIn`, `easeOut`, `easeInOut`). Einzelne Keyframes dürfen die Interpolation des jeweils folgenden Segments überschreiben; Root-Motion (`root.x`, `root.z`, `root.yaw`) ist für räumliche Vorschauabläufe im Character Lab ebenfalls erlaubt. Zwischen Keyframes wird linear interpoliert.

Import, Export, UI und die Browser-Automatisierung `window.characterLab` verwenden denselben validierten Steuerkern. Das Character Lab installiert außerdem denselben PWA-/Versionscheck wie die Haupt-App und zeigt neue Deployments bewusst nur als manuellen Reload-Hinweis an. Eine externe Netzwerk-API ist bewusst nicht Teil von v1. Die lokale Unterprojekt-Dokumentation in `character-lab/agents.md`, `character-lab/architecture.md` und `character-lab/concept.md` ist für Änderungen an diesem Tool zusätzlich verbindlich.


Character Lab visual review runs in the separate `.github/workflows/character-lab-review.yml` pipeline. It uses the dedicated `build:character-lab` Vite/TypeScript configuration and therefore does not build or test the main game. The workflow installs ffmpeg only in that job, produces deterministic PNG review frames plus a compact 640×480 WebM, and uploads them together as a workflow artifact. Path filters keep this review pipeline from running for unrelated gameplay changes.
