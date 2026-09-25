# Architecture

This file is the current architectural entry point. Detailed unchanged subsystems remain documented in [`architecture-detail.md`](../architecture-detail.md). If the two files conflict, this file describes the newer state.

The completed fine-grid/resource migration is recorded in [`FINE_GRID_RESOURCE_REWORK_PLAN.md`](../FINE_GRID_RESOURCE_REWORK_PLAN.md). It remains the reference for changes to map scale, terrain, resources, loose goods, movement, placement, roads or logistics.

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
  ui/wikiCatalog.ts  data-driven player knowledge catalog
  debug/        performance diagnostics

building-editor/   desktop-first building authoring subpage
```

The deterministic simulation stays independent from Phaser. Presentation reads simulation state and never owns authoritative game state. The simulation runs at 60 ticks/s at displayed 1×; rendering is decoupled and driven by `requestAnimationFrame`.

The DOM UI uses a single light visual theme. Component styles keep layout and feature-specific structure in their existing CSS files; `src/light-theme.css` is imported last from `src/main.ts` and owns the shared light palette plus deliberate overrides for components that previously carried dark palettes. Dark translucent colors remain appropriate for modal backdrops and map-dimming layers, but interactive panels themselves use the light component language.

### Focused map actions

`src/ui/actionMode.ts` aggregates the existing build, merchant-target, upgrade-preview, person-command and work-area mode events into one presentation-only `ui-action-mode` state. CSS hides the normal top-level UI while that state is active and leaves only the map plus the active mode's own action overlay visible. Mode ownership remains in the existing feature modules; the aggregator does not mutate simulation state or replace their completion/cancellation events.

Scrollable menu shells keep their close-bearing header outside the scrolled-away content through sticky headers. Debug extensions insert below the cheat controls so dynamically mounted profiler sections cannot reorder the cheats.

### User dialogs

User-facing confirmations and blocking information messages use the reusable DOM modal in `src/ui/modalDialog.ts` instead of browser-native `alert()` or `confirm()`. The modal owns only presentation and the asynchronous user decision; callers remain responsible for simulation mutations. Its fixed backdrop blocks pointer interaction with the map while open, `Escape` cancels/closes it, focus is restored afterwards, and destructive confirmations focus the safe cancel action by default. The same interaction is used on desktop and touch.

## Simulation entry point

`src/simulation/simulation.ts` is the public simulation entry point and wraps/re-exports core behavior. `simulationCore.ts` is a scheduling/work-area facade around the historical core implementation in `simulationCoreEngine.ts`.

Equipment assignment is physical simulation state. A manual or automatic equipment request reserves one item from an eligible storage building, stores an equipment pickup task on the person and routes that person to the storage through normal navigation. The item enters the equipment slot only after arrival at the storage interaction point. A later direct movement order cancels the outstanding pickup and returns the reserved item to storage.

Autonomous target selection is event-driven where possible. Hunger, missing work and related fallback decisions use the existing one-second cadence instead of replanning every simulation tick. Starting a new autonomous work action passes through the shared need gate in `workNeeds.ts`; completed specialized actions can use the same boundary so hunger and sleep are handled before another work cycle starts. Subsystems that complete an authoritative person-owned task may call the shared `requestImmediateWorkDecision(world, person)` scheduling boundary to re-enter normal work planning on the next core tick instead of duplicating profession-specific retry logic. Hunger and sleep decay use the reduced early-game balance: their previous decay rate is halved while thresholds and recovery values remain unchanged. Generic path rerouting follows the currently authoritative task state rather than profession-specific fallback behavior; for fishing, an existing `fishingSpot` remains the movement target until that task state changes. Active routes are not recalculated merely because a road is created, removed or becomes organically established; road-cost changes apply when the next route is planned.

Blocked high-level navigation keeps a coarse destination category on the person (for example workplace, resource, food, sleep, storage or construction). The UI derives the warning text from this authoritative route intent rather than guessing from profession or current animation state.\n\nNeed navigation is layered on top of the same fine-grid A*. Normal residents first search for food or sleep locations inside a local radius equal to the waypost orientation radius (3.5 world tiles). This local need route may cross outside waypost coverage. If a need route starts inside waypost coverage and leaves it, the resident returns by local A* to the position where the need search started before normal work resumes. If no local target is usable while the resident is outside waypost coverage, need navigation first tries to return locally to a nearby covered work anchor (personal work-area center or assigned workplace) within the same 3.5-world-tile radius; global waypost-constrained food or sleep search begins only after that anchor is reached. If no such anchor exists, the normal global search is attempted directly. A hunter who became hungry during unrestricted pursuit keeps its dedicated return-to-flag behavior before global food search. Active hunting state is resumed by the hunting subsystem after eating rather than by generic need routing. Scouts bypass waypost routing entirely and always use unrestricted global A*; the same navigation class is reserved for the future `soldier` profession.

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
natural source -> extractor carries one unit -> reserved ground cell around personal work flag -> one-second drop -> loose ground stack -> one-second ground pickup -> consumer/storage
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

Every current managed building kind plus `field` has a same-key asset slot under `src/assets/buildings/<key>/`. Each slot contains `building.json` plus a sprite file. Types without a finished editor export use an explicit `{"placeholder": true, ...}` JSON and a transparent placeholder image; `tailor` currently uses such a placeholder slot; the registry imports these managed-building/field slots but skips placeholder JSONs, so current gameplay remains unchanged until a real export replaces the two files. Infrastructure is not registered through this building-visual path even if a legacy or placeholder asset folder exists for it. Future managed building kinds must receive the same-key slot in the same implementation run. There is intentionally no CI/build failure just for a placeholder slot.

The currently active editor definitions are HQ, bakery, farm, well and mill. For a registered building, the editor placement coordinate is the **visual/spatial anchor**. The simulation stores `Building.position` as the gameplay **interaction coordinate**, which is the authored `entrance`. The visual anchor is recovered deterministically as `position - entrance`. This preserves the existing simulation convention that workers, carriers and other systems route to `Building.position`, while the sprite and footprint remain aligned exactly as authored.

The authoritative footprint and collision semantics for registered buildings are therefore:

- `footprint` comes from the current registered `building.json` translated by the visual anchor;
- `blocked` becomes the derived `Tile.buildingBlocking` overlay;
- footprint cells not in `blocked` remain walkable;
- the authored `entrance` must be inside the footprint and not blocked;
- building kinds with placeholder definitions continue to use their current hard-coded spatial fallback.

`src/game/buildingSprites.ts` is the generic Phaser renderer for registered definitions. It loads registered sprites once, creates one sprite per completed building instance of a registered kind, derives the visual anchor from the building interaction coordinate, applies the normalized Phaser origin, and sets the display size from `spriteWorldWidth` plus the source aspect ratio. The renderer does not own placement or collision state.

Activating another editor-authored runtime building now consists only of replacing `building.json` and the sprite inside the existing same-key asset slot. No additional registry edit is required for current kinds because every current kind is already wired through `register(...)`. When a new `BuildingKind` is introduced in code, its same-key asset slot and registry registration are added in that same implementation run.

## Structure classification

`Building` remains the shared runtime entity for construction-capable static structures so material delivery, `ConstructionState`, builder assignment, save/load and demolition can be reused without a parallel construction engine. Its `kind` is nevertheless classified by product semantics:

- `ManagedBuildingKind` contains normal managed buildings such as HQ, production buildings, warehouses and houses.
- `InfrastructureKind` contains construction-capable infrastructure. Palisade is the first member; gates and other future constructed infrastructure can extend this union.
- `field` remains a separate building-backed gameplay entity and belongs to neither category.

`src/simulation/structureKinds.ts` is the central runtime boundary. Building management UI, staffing alerts and the generic editor-authored building sprite path must use this classification instead of adding local `kind !== "palisade"` checks. Infrastructure may still reuse the shared `Building` storage shape internally, but it owns its own placement/rendering/management semantics. The current palisade therefore stays in `World.buildings` for construction compatibility while remaining absent from the normal building browser and building alert system.

The generic building-definition registry intentionally does not register infrastructure. Infrastructure visuals are rendered by their dedicated renderer; adding an editor-authored asset for a future infrastructure kind does not implicitly turn it into a managed building.

## Placement, clearance and demolition

`src/simulation/buildingPlacement.ts` remains authoritative for placement legality. For registered kinds it uses the editor footprint; otherwise it uses the current hard-coded shape table. The placement clearance is a compact ring of two micro-cells around whichever footprint is authoritative.

Every placeable building additionally requires its gameplay interaction coordinate / entrance to lie within the **3.5 coarse-world-tile orientation radius of at least one placed waypost**. Connectivity of that waypost to any other waypost is deliberately irrelevant: separate logistics networks may exist, for example on different islands. This rule is enforced by the same authoritative placement predicate used by both placement highlights and construction. Neutral low-level test worlds that deliberately omit the waypost subsystem retain unrestricted placement semantics.

Active natural-resource footprints reserve both the building footprint and the two-micro-cell clearance ring. Loose goods block only the actual footprint because they remain walkable and may stay in the surrounding clearance area.

For registered placeable buildings, construction stores the interaction position at the authored entrance, writes the authored footprint and `buildingBlocking` overlay, and otherwise preserves the existing construction/gameplay semantics.

Demolition restores the complete footprint, clears the building collision overlay and stale traffic state, and preserves the existing rule that a road covered by construction returns as grass rather than reappearing.

Construction requirements are centralized in `src/simulation/constructionRules.ts`. `buildingPlacement.ts` derives construction plans and durations from these shared requirements instead of owning a second cost table. The same module maps processed construction goods to the building type that produces them, so progression can derive prerequisites from actual construction costs.

## Fishing

Fishing reuses the personal work-area system rather than introducing a building. A fisher owns the same **2.5-world-tile work flag** used by outdoor resource workers. Valid fishing spots are walkable land cells adjacent to river/water terrain and inside that work area.

Fish availability is authoritative world state in `World.fishSchools`. `src/simulation/fishSchools.ts` groups connected water cells into deterministic fishing regions. Each region owns one school with a finite stock of **15 fish**. A successful catch consumes exactly one fish from the school attached to the adjacent water target. At zero stock the school remains present but cannot yield a catch. While below capacity, it regenerates exactly **one fish every 60 simulated seconds**, including recovery from zero.

The simulation stores the current fishing spot, adjacent water target, cycle start tick and absolute end tick on the person. One fishing cycle lasts exactly five simulated seconds. Presentation derives a roughly 0.5-second cast, four-second hold and 0.5-second reel animation from those authoritative ticks. The deterministic catch roll is resolved only when the line is reeled in. Catch probability is derived from fisherman profession XP, from 0.30 at zero XP to 0.80 at 100 XP. Fisher profession XP is awarded only for a successful catch; failed cycles and attempts against an empty school do not advance experience.

A successful cast sets exactly one `fish` unit as outdoor cargo on the fisherman. The fisherman carries that unit back to the personal work flag, where it becomes a normal loose-good stack. Completing a fishing cycle is an explicit need boundary: at or below the normal hunger or sleep threshold, the fisher handles that need before another cast starts, whether the cast succeeded or failed. A caught fish remains in `outdoorCarry` during the interruption and is routed to the work flag afterwards.

Fish-school presentation is deliberately non-authoritative. The renderer moves a compact group of fish slowly along a deterministic walk through the school's water region; the displayed position does not affect fishing eligibility. Fish positions are projected through the current Phaser world camera into a separate DOM canvas overlay, while fish body geometry remains in fixed CSS-pixel screen space. This prevents camera zoom from scaling the fish a second time. Display density represents larger stocks compactly, but the final three fish are exact: stock 3/2/1 renders exactly 3/2/1 visible fish, and stock 0 renders none.

## Wildlife, hunting and ranged attacks

Wildlife is authoritative simulation state in `World.animals` and `World.animalGroups`. Species behavior is isolated in `src/simulation/wildlife.ts`; hares and boars share the same movement/fleeing framework, while species-specific cadence and weighting remain data rather than hunter-specific branches. Boars are always spawned as singleton groups, so the same migration logic produces solitary roaming without a second AI path. Hare groups keep a home point plus a soft group migration target while every animal moves independently. About every 30 simulated seconds the group target moves 10–15 micro-cells from the current group center. Consecutive targets retain directional inertia instead of choosing an unrelated direction each time, producing longer wandering arcs. The original home point is only a soft outer boundary: it exerts no pull while the group center remains within roughly 30 micro-cells and starts attracting the group back only beyond that range. Individual path choice is influenced only lightly by that target. Hares keep a loose personal spacing: inside roughly five micro-cells there is no pull toward the flock center, and very close neighbors create a separation bias; only animals that drift farther away are pulled back toward the group. Current animal cells and already planned endpoints are excluded from new path endpoints. The first two planned steps of other animals are also treated as short-lived reservations. If the next cell is occupied by another animal, the animal keeps its route and waits for up to half a simulated second; only a continuing blockage discards the route and triggers replanning. Owned-livestock pasture target selection enumerates only the bounded pasture radius around its home instead of scanning the complete fine grid. This keeps the group drifting without collapsing into a tight formation. Normal movement starts every 4–8 simulated seconds and uses short zig-zag paths. A shot makes the attacked animal and only surviving members of its group within 10 micro-cells of the attacked animal flee independently for five simulated seconds; farther group members are unaffected. After that, the normal flock/home/group-target weighting resumes so scattered groups gradually gather again.

Hunters are outdoor workers with a personal flag. Their radius is 10 coarse world tiles / 50 micro-cells, four times the normal extractor/fisher radius. Hunters are excluded from the generic idle-position system; acquiring a new prey target clears any stale idle target/path before pursuit is planned. Bow range remains a separate fixed 2-world-tile / 10-micro-cell value, so enlarging the hunting area does not enlarge the weapon. Hunters autonomously select new wildlife targets only while both the hunter and those animals are inside the hunting area. If the personal flag was moved and the hunter is still outside the new area, reaching that area remains normal waypost-constrained travel and no new prey may be acquired yet. Once a target has been acquired, that target remains valid outside the hunting area: the hunter may leave the area and continue pursuing and attacking it until the target dies, disappears or becomes unreachable. Hunting pursuit, reserved-loot collection and the return trip carrying hunting loot to the personal flag use unrestricted global A* rather than waypost/local-node routing; these active hunting states therefore do not create waypost-blocked warnings. The normal person path system is used to move into bow range. Once a target is in range, the hunter stops and aims for two simulated seconds. That aiming cycle locks the target: if the animal leaves bow range during those two seconds, the shot still fires when aiming completes. After the shot the hunter reevaluates distance before beginning the next aiming cycle.

Ranged attacks are separated from hunting in `src/simulation/rangedCombat.ts`. A ranged attack creates an authoritative projectile containing source/target entity references, launch/impact ticks, projectile kind, impact lifetime and the already resolved hit roll. Impact effects resolve exactly once; arrows then remain authoritative world objects at their impact position for ten simulated seconds before expiring. Presentation interpolates flying projectiles and renders impacted arrows in world scale without owning authoritative positions. Wildlife rendering uses native animal emoji glyphs (🐇, 🐗, 🐄, 🐑) and interpolates each current micro-cell toward the next path cell using the simulation movement fraction, with a presentation-only hop arc; player-owned livestock is marked by a small native ❤️ emoji overlay instead of a stroked text glyph. This is intentionally reusable for later ranged soldiers: hunter targeting and XP stay in `hunting.ts`, while projectile timing and attack transport remain generic. Hunter bow accuracy scales linearly from 20% at 0 experience to 95% at 100 experience; firing at an already fleeing animal multiplies that chance by 0.5. Hunter experience is awarded only when a projectile actually kills wildlife. Hunting drops are species data: a killed hare creates one physical `meat` unit, while a killed boar creates one `meat` and one `leather` unit at or near its final position. All created drops are reserved for the successful hunter. The hunter collects exactly one reserved stack at a time, carries it as outdoor cargo back to the personal flag, deposits it as an ordinary loose-good stack and then returns for the next reserved drop before hunting again. Eating may interrupt this retrieval after meat has been deposited; the remaining reserved loot stays the hunter's resumable task and is collected afterwards. Meat participates in normal storage/transport and restores the same 60 hunger points as fish; leather is a normal non-food good. Hare sprites and arrow geometry are presentation-only and are rendered at half their previous visual size without changing simulation ranges or hit logic.

## Profession qualification

Profession XP and qualification rules are centralized in `src/simulation/experience.ts`. Basic professions are always selectable. Advanced production professions require 10 XP in their direct predecessor profession: woodcutter → sawmill worker → carpenter, clay digger → potter, stonecutter → stonemason, farmer → miller → baker, and hunter → tailor.

`setPersonProfession` is the authoritative mutation boundary and rejects profession changes that do not satisfy these person-specific prerequisites. UI surfaces must use the same qualification predicate rather than duplicating progression logic. The person context menu lists only professions currently available to that person, while building staffing filters out people who cannot qualify for the building's required profession. Tailor is a normal building-worker profession for the tailor building once the hunter-XP prerequisite is met.

## Person equipment

Person equipment is authoritative simulation state on each `Person`. The first slots are `tool` and `shoes`; current assignable goods are only `woodenTool` and `shoes`. Manual assignment reserves one matching item from a reachable completed HQ/warehouse or from a physical ground stack and stores a slot preference. Fresh equipment may stay represented by the compact counted building inventory; once an item has an individual condition, it is represented as an `EquippedItem` instance in `Building.storedEquipment`, `LooseGoodStack.equipmentItems`, a transport trip, or a person's equipment slot. Wearing an item to zero removes it and immediately tries to reserve the same preferred type again; if no stock exists, the one-second maintenance cadence retries later. Manual unequip clears the preference and therefore stops automatic replacement. The unequipped instance is stored with unchanged durability in HQ/warehouse, or placed as a stateful loose good on the ground when no storage building exists.

Shoes multiply movement progress by 1.3 and lose one durability point per crossed micro-cell, for 2,500 micro-cells total. Wooden tools multiply productive work progress by 1.3. Their durability is expressed as 30 normalized work actions, where one action equals `CONFIG.duration` effective work progress; this lets ordinary production, extraction, farming, fishing and continuous construction share one wear model without profession-specific item logic. `equipmentWearPercent` converts remaining durability plus partial tool-work progress into the player-facing 0–100 % wear value.

The equipment UI is split deliberately: the person context menu contains one extensible **Ausrüstung** assignment action, while the person detail panel shows individual slots and owns manual unequip. This keeps future equipment such as armour out of the fixed context-action grid.

## Storage and transport

HQ and warehouses use the same first-class storage semantics. Production workers/building carriers may fetch required goods from either storage type. Storage carriers deliver directly into their assigned warehouse/HQ inventory.

Automatic storage-to-storage collection remains forbidden. Warehouse merchants retain explicit warehouse-to-warehouse routes. Builders and production-building carriers retain their separate long-distance/demand-driven sourcing rules.

Physical pickup and dropoff are timed simulation interactions. Picking up a loose good from the ground takes one simulated second; building pickups, natural-resource pickups and all dropoffs take three simulated seconds before the inventory mutation occurs. The deadline is stored on the active trip, so pause and simulation-speed changes affect the interaction consistently and save/load preserves an in-progress transfer. Stateful equipment metadata travels with the same loose-good and transport path, so warehouse/merchant movement never resets wear.

## Handbook navigation

The in-app handbook is currently a catalog-only knowledge surface rendered by `src/ui/handbook.ts` and `src/ui/wikiCatalog.ts`. Its top level contains only the generated lists for goods, buildings, animals and professions. Static Markdown topic pages are intentionally absent. Dynamic detail routes and the internal back history remain available from those four catalogs.

## Idle positions, indoor visibility and staffing markers

Idle positioning is authoritative simulation state through `Person.idleTarget`. Only final waiting positions are reserved; people may still cross the same cells while moving. A new player world creates its residents directly on distinct walkable micro-cells a few rows south of the HQ entrance and outside the HQ footprint; no synthetic movement order is used. Free people and builders without an active workplace task otherwise remain where they currently are instead of walking back to the HQ. If an otherwise idle person is standing on any walkable cell that still belongs to a building footprint, idle behavior moves them to a nearby free stand position outside that footprint so entrances do not become permanent waiting areas. Natural-resource workers are owned by their work-area state and wait exactly at their personal flag when no local resource is available. Assigned building staff wait outside their workplace. A deterministic spread picks a reachable free stand position near the relevant anchor rather than stacking people at the entrance. Candidate stand positions are ranked cheaply first. Nearby idle moves use a bounded local search; only genuinely distant fallback movement uses normal A*. This prevents fresh-world idle placement from fanning out into expensive global path searches. Generic rerouting preserves an existing idle target instead of sending an otherwise free person back through the HQ first. UI activity text treats a reached idle target as "Wartet"; the internal `active` flag alone is not interpreted as actual work.

Building activities still use the authored entrance as their interaction coordinate. Presentation hides the person's normal world representation only while an actual building activity is underway inside a **completed** building, such as production work, eating from a building, sleeping in a house, or the timed pickup/dropoff phase of a trip at a building. Unfinished construction sites never count as indoor space, so builders and other people remain visible there during construction and material transfers. Pickups from loose goods or natural-resource sources remain visible because they happen outside buildings. Well interactions also remain visible because residents use the well from outside rather than entering it. The body marker, name/activity labels and carried-good marker are hidden together. Existing person selection remains active and keeps only its selection ring at the entrance. Merely crossing a walkable footprint cell does not hide the person.

Assigned staffing is also visualized without changing simulation rules: completed buildings show small presentation-only flags next to the entrance, blue for workers and red for carriers. Multiple flags are stacked compactly.

Demolishing a building immediately cancels activities that depend on that building. Assigned people lose the removed workplace, indoor need actions are interrupted, and anyone who was hidden becomes visible immediately before normal replanning continues.

## Work areas

Woodcutters, clay diggers, stonecutters, fishers, warehouse carriers and HQ carriers use per-person `WorkArea` state. The shared radius remains 2.5 coarse world tiles / 12.5 micro-cells.

Extractor flags start at the first selected resource. Storage-carrier flags start at their storage workplace. A personal flag acts as a private local navigation node for that person: once the person is inside its radius, movement to work targets that are also inside the radius uses local micro-grid A* and bypasses the global waypost graph. Moving a flag does not create a local shortcut from the old location: if the person is outside the newly positioned work area, reaching the new node still requires normal global waypost navigation first. Moving a flag invalidates an unpicked source outside the new area but does not discard already carried cargo. Extractors already return every produced unit to their flag before choosing more work. Fishers return to the flag only after a successful catch because the carried fish must be deposited there; failed casts may immediately replan another local fishing spot. Storage carriers finish their collection trip at their storage workplace. Production carriers are deliberately outside this system.

Farms use the same local-node abstraction without a visible personal flag. The farm is the local node and its configured field radius defines the local work environment. A farmer outside that environment must reach the farm through the global waypost network. Once inside, field work uses local navigation. Farm planning filters candidate cells/fields geometrically first, then samples candidates without replacement and stops A* after the first reachable candidate instead of routing to every valid option before choosing. After sowing or fertilizing, the farmer returns to the farm before selecting another task; harvesting already ends with the carried wheat returning to the farm. Builders are intentionally excluded: construction sites never grant a local navigation node.

## Wayposts and high-level navigation

Wayposts are first-class navigation objects in `World.wayposts`; they are not buildings and remain independent from per-person work flags. Player-facing worlds start with one waypost on valid terrain roughly one coarse world tile in front of the HQ entrance.

Waypost balance is intentionally owned by separate constants even where current values match work-area balance. A waypost has a **3.5 coarse-world-tile orientation radius**. Minimum center-to-center spacing is coupled to the same **3.5 coarse world tiles**. The maximum direct connection distance is coupled to twice that radius, **7 coarse world tiles**. Each stored connection is rendered as its own directional sign using the shared isometric projection.

Wayposts are no longer launched from the building menu. A person with profession `scout` exposes the waypost action in the person context menu. The action reuses the existing placement preview without treating a waypost as a `Building`: desktop uses a hover ghost plus left-click selection and right-click/Escape cancellation; touch uses tap-to-position plus an explicit confirmation button. Confirming creates a scout order rather than the waypost itself. The scout walks physically to the chosen anchor and then spends exactly one simulated second erecting the waypost; the action consumes no goods. The order is persistent simulation state and resumes after temporary hunger/sleep handling. Scouts are not bound to the waypost graph and use direct terrain A* for movement, including explicit expansion orders beyond the current orientation coverage. This establishes the navigation policy for exploration/combat roles: future soldiers are expected to use the same unrestricted terrain navigation, while civilian production, logistics and settlement movement remains governed by the waypost network.

Entering waypost placement immediately highlights every currently valid anchor while the dimmed map makes invalid anchors visible by contrast. The placement-highlight layer observes the existing waypost-network revision while any building or waypost placement mode is active. When a scout finishes a previously ordered waypost, the revision changes and the valid-anchor overview is recomputed once; it is not rescanned every frame. This refresh applies to both waypost placement and normal building placement because waypost spacing and orientation coverage affect their legality. The current ghost and touch confirmation remain live-validated by the authoritative placement predicates. After choosing a position, the ghost additionally shows the orientation area and spacing constraint. A waypost reserves its own micro-cell plus the six directly adjacent micro-cells against building footprints; conversely, new wayposts cannot be placed in that one-cell clearance around an existing building footprint. Wayposts remain walkable. Clicking/tapping one opens a waypost panel with demolition; removal cleans reciprocal connections and advances the waypost-network revision.

Player-facing navigation requires the waypost graph for high-level reachability, but waypost cells are never physical checkpoints. If start and destination are covered by the same waypost or by directly neighboring connected wayposts, movement uses one ordinary direct micro-cell A* route. For journeys whose selected high-level chain contains three or more wayposts, the graph first chooses a cheap node chain and the micro-cell A* search is then restricted to the union of those wayposts' orientation areas. This keeps long searches bounded while allowing the person to cross each area wherever terrain and roads make sense instead of walking through the signpost centers. Terrain, blocking and road speed therefore remain authoritative locally. There is no direct fallback that bypasses missing waypost connectivity for roles governed by the civilian navigation network. Scouts are deliberately outside that network; future soldiers are intended to follow the same unrestricted-navigation policy. Neutral low-level test worlds without a waypost system retain unrestricted direct A* semantics. Failed required destinations are cached per person for the current waypost-network revision, so they are not repeatedly replanned; placing or removing a waypost increments the revision and re-enables one fresh search. A failed required route sets a person warning state that is cleared on a successful route or task cancellation.

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

The fixed slot mapping is intentionally sparse: 1 profession, 2 workplace, 3 home, 4 work area, 5 move, 6 eat, 7 sleep, 8 waypost when the scout action is valid, and 9 equipment. Unavailable slots are omitted from rendering instead of being disabled, and future actions must reuse the remaining fixed positions rather than repacking existing actions.

Building staffing UI no longer calls the legacy automatic `changeAssignment` controls. `src/ui/controls.ts` renders each building role as explicit occupied or empty staff slots. Occupied slots dispatch the existing person-selection request so map focus and the person inspector use the normal selection path. Empty slots dispatch a staff-picker request consumed by `src/ui/personPanel.ts`; that panel temporarily switches into a candidate mode, orders matching-profession people without a workplace first, profession-free people second and all remaining candidates third, with alphabetical name ordering inside each group, and uses `setPersonProfession` plus `setPersonWorkplace` for the chosen person. The older simulation assignment helpers remain available to internal/test code but are no longer a player-facing staffing path. Dynamic player-facing choice lists use German locale ordering by visible label; the build menu keeps waypost placement as an explicit first-item exception until a scout role owns it. Runtime controls (`#autoplay`, `.speed-control`, `#debug-toggle`) are mounted by `controls.ts` but moved intact into `gameMenu.ts`, preserving their existing listeners and authoritative simulation state while removing the persistent bottom control bar. Preset speeds remain available and the same control also accepts a normalized custom multiplier from 0.1× through 10.0× in 0.1 steps. `World.simulationSpeed` is the authoritative selected multiplier so save/load can restore it. Main menus dispatch `poc-ui-menu-opened`; `personContextMenu.ts` consumes that signal to close the person action overlay whenever another menu opens.

## Rendering and interaction

Rendering stays decoupled from simulation ticks. `IncrementalMainScene` caches map/person presentation state; natural resources, loose goods, work-area flags and registered building sprites are presentation layers over authoritative simulation state. The person layer is rendered above natural resources, bushes and loose goods so residents remain visually readable while crossing resource visuals.

Camera zoom remains 0.7×–10× for mouse-wheel and pinch. Building assets intended to remain crisp at the upper zoom range should therefore retain substantially more source pixels than their normal world-space display size. Desktop and touch remain first-class input adapters, with the iPhone 13 Mini as the mobile baseline. Build placement chooses its presentation mode from the most recently observed Pointer Event: mouse input uses direct left-click placement and hides the confirm button, while touch/pen keeps tap-to-move plus explicit confirmation. The hover/fine-pointer media query is used only before any concrete pointer type has been observed, which keeps hybrid devices from being locked into the wrong interaction model.

## Building editor

`building-editor/` is a separate Vite multi-page entry published at `/civilizations-poc/building-editor/`. It is an internal desktop-first authoring tool and does not start Phaser or own simulation state.

The editor is WYSIWYG against the runtime projection. A fixed editor-only preview zoom enlarges both grid and sprite together, so their size relationship matches the game. Sprite size is authored as world-space width rather than as a multiplier of source pixels, and the anchor is authored as a percentage/relative image position. Runtime-ready exports live under `src/assets/buildings/<id>/`.

The selected sprite file is exported unchanged; the editor does not downscale or recompress it. The current schema is authoritative and intentionally has no backward-compatibility layer for older visual-definition versions. During local development the editor can write validated exports directly into the runtime asset folder; the published editor downloads the JSON and sprite instead.

## Save/load persistence

`src/simulation/saveGame.ts` owns the versioned JSON save format. Saves remain anchor/interaction-point based rather than snapshotting derived geometry: `tiles`, entity footprints and underlying building terrain are not persisted.

Large choice surfaces are viewport-level UI, not children constrained by inspectors or radial context menus. Profession/equipment pickers use a fixed backdrop and a wide responsive dialog; the staff candidate picker switches the person browser into the same near-fullscreen modal treatment. Compact confirmations remain on the shared small modal.

`src/ui/browserSaves.ts` stores named browser saves in IndexedDB. Each record contains the unchanged serialized save JSON plus UI metadata (name, timestamp, population/building counts and a preview image). IndexedDB is only a persistence adapter: browser saves and downloaded/imported files use the same `serializeSaveGame` / `deserializeSaveGame` path, so there is no second gameplay save schema.

Saving from the game menu always writes the current state to IndexedDB. A checkbox may additionally download that same JSON as a file. Loading normally reads a browser save; the load dialog also accepts a JSON file. A successfully imported file is loaded and immediately stored as a new browser save so future loads no longer require the file.

Every browser save receives a settlement preview generated by `MainScene.captureSettlementThumbnail()`. The capture temporarily frames all non-retired, non-field buildings (including HQ and construction sites), with extra visual padding, renders a small WebP thumbnail while preserving the current game-canvas aspect ratio, and then restores the player's previous camera position and zoom. Roads, residents, resources and fields do not expand the framing bounds.

For a registered editor-authored building, the save stores the building's gameplay interaction position (`Building.position`, i.e. its entrance) plus ordinary gameplay state. `visualDefinitionId` may be serialized as metadata, but load-time spatial behavior is derived from the current registry definition for the building kind rather than from a historical definition snapshot.

On load, registered kinds reconstruct the visual anchor, footprint and blocked collision overlay from the current registry definition. Building kinds with placeholder definitions reconstruct from their current code-defined shape rules. Static terrain is regenerated from the deterministic base map; roads, traffic history and bushes remain sparse persisted map state.

The save format is `civilizations-save` **version 5**. Version 5 persists and validates `World.simulationSpeed` and naturally includes stateful used-equipment instances because they are part of the authoritative world graph. The visual-definition schema version is separate from the save version. Before v1, older save versions or data shapes are not migrated when compatibility would require special handling; they may be rejected or break as the current model changes.

Loading and starting a new game still replace the contents of the existing shared `World` object instead of swapping its identity, so Phaser and UI modules keep valid references.

## Building status overview

`src/ui/buildingAlerts.ts` derives current building alerts from authoritative world state without persisting notification history in `World`. A completed, non-retired building with worker slots contributes a warning while it has no assigned worker. `src/ui/buildingPanel.ts` mirrors the existing person-management pattern: the Buildings menu button shows compact severity counts, the overview can filter by severity, and selecting an entry focuses and opens that building. `src/game/buildingAttentionIndicators.ts` renders the same actionable state as a clickable/touchable world marker. There is intentionally no separate generic notification menu.

## Person status overview

`src/ui/personAlerts.ts` derives a single current alert per person from authoritative simulation state. Severity precedence is `critical > warning > info`, so one person contributes to at most one HUD/list count. The first rules cover critical/normal hunger and sleep plus truly free idle people. Need alerts reuse the same display-status helpers as the world icons, so the list, counters and filters stay aligned at 30% warning / 20% critical while simulation planning may already have started at 40%. The classifier deliberately does not infer missing-resource failures from generic inactivity.

`src/ui/personPanel.ts` caches this derived alert map and refreshes it once per second. The same cached result drives the compact counts on the People menu button, the three severity filters and the per-person reason shown in the browser. This remains presentation-derived state and is not persisted in `World`.

## Performance diagnostics

The debug profiler keeps short rolling in-memory timing windows for live inspection. In addition to simulation, feature and pathfinding timings, it attributes browser-frame time across the requestAnimationFrame callback delay, the complete Phaser game step, Phasers render phase and the gap from the previous Phaser post-render to the next pre-step. The inter-frame gap intentionally represents browser/VSync/compositor/idle time as one combined bucket; JavaScript cannot reliably split those browser-internal phases on every supported browser.

The fine-grid base map is still authored through the existing `MainScene.drawMap()` rules, but `IncrementalMainScene` does not leave that large Graphics command list in the normal render path. Whenever the map signature changes it redraws the authoritative map Graphics once, copies the result into a world-sized Phaser `RenderTexture`, then hides the source Graphics. The signature no longer hashes all 25,625 terrain cells every presentation frame: runtime-only terrain and bush revision counters are advanced by the simulation at the mutation boundary, while the small building/resource/selection state remains part of the map signature. Bush rendering uses its dedicated revision so eating/regrowth or footprint removal invalidates only that overlay. Normal frames therefore render one cached map texture instead of re-rendering tens of thousands of hex polygons or rescanning the full tile grid for cache validation. Dynamic overlays, people, building sprites and interaction highlights remain separate Game Objects above that cache. The profiler records signature checks and cache refreshes separately as `renderMapSignature`, `renderBushSignature` and `renderMapCache`.

`src/debug/performanceRecording.ts` adds an explicit user-started recording layer without changing simulation behavior: while active, it samples the existing profiler once per real second, adds compact world-size counters, and stores the samples only in browser memory. Stopping the recording produces a versioned `civilizations-performance-recording` JSON export with metadata, a per-second time series, and an automatically calculated summary of FPS, frame/tick costs, frame attribution, feature costs and pathfinding causes. The recorder deliberately does not emit per-tick logs or add new simulation scans.

## Existing architecture

All other unchanged systems remain documented in [`architecture-detail.md`](../architecture-detail.md), including production, inventories, merchants, person selection, handbook/PWA behavior and performance diagnostics. Where older detail text conflicts with this file, this file is authoritative.

## Testing and deployment

`npm test` is the deterministic Node suite. `npm run build` performs TypeScript checking and the Vite production build. Coverage includes building-visual schema validation, resolution-independent sprite metadata, registered-building entrance/footprint/blocking behavior, placement/demolition, physical goods, logistics, work areas, waypost spacing/connections/navigation, technology progression and save/load reconstruction.

Vite builds both the game root and `building-editor/index.html`. GitHub Pages publishes both from the same `dist` artifact.

Per `agents.md`, implementation work happens on a temporary branch and is transferred to `main` as one final squash commit. Pull-request updates run the fast validation path with `npm test` only, so iterative test and implementation work does not pay the production-build cost on every commit. The same workflow can be dispatched manually with validation level `test` or `full`; `full` runs both `npm test` and `npm run build` without deploying. Reopening a pull request is an additional automation-friendly full-validation trigger and also runs both commands. Immediately before every squash merge, the final PR head must have a successful full validation, and the validated commit SHA must exactly match the PR head being merged. After the squash merge, the push to `main` repeats tests and the production build and deploys GitHub Pages only if both succeed. Manual workflow runs never deploy. Character-Lab visual review is intentionally not part of this pipeline.


## Character Lab

`character-lab/` ist eine eigenständige Vite-Unterseite zur Erprobung einer späteren 3D-Bewohnerdarstellung. Sie ist bewusst nicht mit Phaser oder der autoritativen Simulation gekoppelt.

Das Lab rendert mit der über Vite gebündelten Projektabhängigkeit Three.js einen einfachen blockigen Referenzcharakter über eine orthografische isometrische Kamera; zur Laufzeit ist dafür kein CDN nötig. Körperteile hängen an festen lokalen Pivots; verfügbare Rotationsachsen und Neutralwinkel liegen in der Character-Definition. Pose-Winkel werden im Character Lab nicht künstlich begrenzt. Der Torso unterstützt Pitch und Yaw am Hüftpunkt, damit Arbeitsanimationen Oberkörperdrehung nutzen können. Animationen sind JSON-Daten mit normiertem Fortschritt von 0 bis 1, absoluten lokalen Gelenkwinkeln und einer wählbaren Interpolationskurve (`linear`, `easeIn`, `easeOut`, `easeInOut`). Einzelne Keyframes dürfen die Interpolation des jeweils folgenden Segments überschreiben; Root-Motion (`root.x`, `root.z`, `root.yaw`) ist für räumliche Vorschauabläufe im Character Lab ebenfalls erlaubt. Zwischen Keyframes wird linear interpoliert.

Import, Export, UI und die Browser-Automatisierung `window.characterLab` verwenden denselben validierten Steuerkern. Das Character Lab installiert außerdem denselben PWA-/Versionscheck wie die Haupt-App und zeigt neue Deployments bewusst nur als manuellen Reload-Hinweis an. Eine externe Netzwerk-API ist bewusst nicht Teil von v1. Die lokale Unterprojekt-Dokumentation in `character-lab/agents.md`, `character-lab/architecture.md` und `character-lab/concept.md` ist für Änderungen an diesem Tool zusätzlich verbindlich.


Character Lab visual review runs in the separate `.github/workflows/character-lab-review.yml` pipeline. It uses the dedicated `build:character-lab` Vite/TypeScript configuration and therefore does not build or test the main game. The workflow installs ffmpeg only in that job, produces deterministic overview PNGs, dense strike bursts for all six woodcut swings, plus a compact 640×480 WebM, and uploads them together as a workflow artifact. Path filters keep this review pipeline from running for unrelated gameplay changes.

## Livestock breeding

src/simulation/livestockBreeding.ts owns the deterministic breeding state for player-owned cows and sheep. The breeder remains a normal building for staffing and demand-driven input logistics: its one worker and up to two carriers use the existing assignment and transport systems, while wheat and water live in the building's normal multi-input inventory with the shared per-good capacity of ten. The building recipe is intentionally input-only; animal creation is handled by the livestock system rather than the generic goods-output production loop.

A completed livestockBreeder becomes the dynamic home of both owned livestock groups. wildlife.ts retargets those groups between the completed breeder and HQ fallback without introducing a second animal representation. A breeding attempt first reserves two concrete parent animal IDs in building state. The assigned stockfarmer then walks to the parents one after another; while this gathering task is active, generic workplace-return and idle routing defer to the livestock system so they cannot overwrite the collection path. The currently collected animal stores the stockfarmer id and follows that person's authoritative position through the existing wildlife movement loop. Normal wildlife still rejects building terrain. During physical collection, the breeder chooses one stable walkable handoff cell on the building footprint edge that is reachable from exterior terrain; an authored interaction/entrance cell is preferred when it is such an edge cell. Only the currently guided livestock animal may enter that handoff cell. This also keeps placeholder/fallback building footprints usable without allowing animals to traverse arbitrary building terrain. Only after both animals have physically reached the breeder are they marked as inside and the fixed breeding timer starts. Four wheat and four water are consumed when gathering starts. On completion, both parents and the juvenile leave from the breeder through normal animal paths back into the surrounding pasture. Juvenile maturity and the selected parent's breeding cooldown are absolute simulation ticks, so pause, save/load and simulation speed preserve deterministic timing. Rendering derives juvenile scale from the remaining fixed growth duration instead of storing presentation state. The breeder worker uses the generic physical input-transport mechanism while breeding inputs are incomplete, but requests only goods still missing for the next 4-wheat/4-water breeding batch instead of topping the building up to input capacity. Idle routing suppresses leisure movement in that state so work retries can assign resource pickup. Carriers keep their normal independent replenishment behavior. Animal gathering starts only after the required recipe inputs are physically present in building inventory. When the second parent handoff completes and `building.breeding` starts, the assigned stockfarmer is explicitly kept active with no idle target or residual path; idle scheduling treats both gathering and active breeding as busy. On breeding completion that active state is released for normal planning.

The current product intentionally permits only one non-retired livestock breeder, including construction sites. The placement layer enforces this invariant; demolition makes a new breeder placeable and causes owned livestock to return to the HQ pasture.

Indoor worker visibility is centralized in `src/game/personVisibility.ts`. A worker is hidden only while authoritative state says that internal work is actively happening in a completed non-farm/non-well workplace and the person is physically on that workplace footprint. The generic production signal remains `person.progress > 0`; building-owned internal processes such as livestock breeding contribute their own active-work signal through the same predicate. Assigned but idle workers, travelers, resource fetchers and workers outside the footprint remain visible.

## Gebäudeausbau und Produktionsstufen

Produktionsstufen sind als eigene `BuildingKind`-Einträge modelliert. `pottery2` und `stonemason2` besitzen damit eigene Baukosten, Technologieeinträge und Asset-Slots und können später unabhängig exportierte Grundrisse und Sprites erhalten. Bis echte Editor-Exporte vorhanden sind, bleiben ihre Asset-Slots explizite Placeholder und verwenden die vorhandene räumliche Fallback-Form.

Die fachlichen Ausbaukanten liegen zentral in `src/simulation/buildingUpgradeRules.ts`. Ein Ausbau transformiert die bestehende Gebäudeinstanz auf den Zieltyp, behält die stabile Gebäude-ID und verwendet nur die Ausbaukosten als neue Baustellenanforderung. Die Direktbaukosten der zweiten Stufe bleiben separat in `constructionRules.ts` zentralisiert und entsprechen fachlich Stufe 1 plus Ausbau.

Die räumliche Prüfung liegt in `buildingPlacement.ts`. Sie berechnet den Zielgrundriss am bestehenden visuellen Anker, ignoriert ausschließlich den aktuellen Gebäudegrundriss und prüft ansonsten dieselben relevanten räumlichen Konflikte wie die normale Platzierung. `upgradePlacementBlockers` liefert die konkreten Konflikte zusätzlich strukturiert an die Präsentation, damit dieselbe autoritative Prüfung sowohl den Ausbau verhindert als auch die Kartenmarkierung speist.

Mehrstufige Produktionsgebäude können `availableRecipes` besitzen; `recipe` bleibt das aktuell aktive Rezept und damit kompatibel mit dem bestehenden Produktionskern. Ein Rezeptwechsel ist nur zulässig, wenn kein alter Output und kein laufender Arbeitsfortschritt vorhanden ist, damit numerischer Gebäude-Output niemals nachträglich als anderer Warentyp interpretiert wird.


## Profession integration

For every newly introduced `Profession`, the complete technical integration must be checked: type/union, profession label and icon, experience/unlock rules, `currentProfession`, `workerProfession`, building-profession mappings in `personCommands.ts` including `BUILDING_PROFESSIONS` and workplace compatibility, plus person/building UI integration. A TypeScript build alone is not sufficient because not all profession mappings are modeled as exhaustive `Record` types.

## Palisaden

`src/simulation/palisades.ts` kapselt die linienbasierte Palisadenplanung und die Erzeugung der einzelnen Baustellen. Planung und tatsächliche Neubelegung besitzen bewusst getrennte Prädikate: Die Planungs-A* darf innerhalb der Wegweiser-Orientierungsabdeckung über bereits vorhandene Palisaden laufen und sie als Start oder Ziel verwenden, obwohl fertige Palisaden für normale Bewohnerbewegung blockieren. Beim Erzeugen der Baustellen werden bereits vorhandene Palisadenzellen dagegen übersprungen. Die Planung nutzt normale Geländekosten und erweitert keinen Pfad über 50 Routenzellen inklusive bestehender Palisaden hinaus. Außerhalb der Wegweiser-Abdeckung werden keine Palisadenzellen expandiert oder erzeugt. Ist das Ziel innerhalb einer dieser Grenzen nicht erreicht, wird der beste gefundene Teilpfad als gültige Vorschau verwendet.

`src/game/buildPlacementHighlights.ts` verwendet für den Palisadenmodus die Planungsvalidierung und zeigt dadurch wie beim normalen Gebäude-Baumodus die gesamte gültige Region bereits vor der Startwahl und weiterhin während der Zielwahl. Die konkrete Vorschau unterscheidet vorhandene Palisaden von tatsächlich neuen Segmenten; Kosten und Bestätigung richten sich nur nach den neu anzulegenden Segmenten.

Palisaden sind leichte `Building`-Instanzen mit `kind: "palisade"`, einem Ein-Zellen-Footprint und normalem `ConstructionState`. Dadurch verwenden sie dieselbe physische Baustoffbeschaffung und denselben Bauarbeiter-Pool wie andere Baustellen. Die Bauarbeiter-Kapazität ist für Palisaden auf eins begrenzt. Im Unterschied zu normalen Gebäudebaustellen ist die Palisadenzelle selbst nicht die Arbeitsposition: Bauarbeiter und Materiallieferung wählen per normaler Wegfindung die günstigste erreichbare Nachbarzelle. Damit kann eine Baustelle bei blockierter Seite von einer anderen Seite bedient werden. Während der Baustelle bleibt die Bodenkachel unverändert und begehbar; bei Fertigstellung setzt die Simulation ausschließlich `Tile.buildingBlocking`. Beim Abriss wird dieses Overlay wieder entfernt, ohne Gras oder Weg darunter umzuschreiben.

Die Darstellung bleibt abgeleitet: `MainScene` verbindet benachbarte fertige Palisaden beim Rendern, ohne zusätzliche Simulationsobjekte zwischen Kachelzentren zu erzeugen. Eine kleine blaue Flagge an unfertigen Segmenten wird direkt aus einer vorhandenen `builder`-Zuweisung auf die Palisaden-ID abgeleitet; dafür existiert kein eigener Reservierungszustand. Save/Load rekonstruiert den Blocking-Overlay aus dem Fertigstellungszustand der Palisaden.


## School education tasks

School lessons are authoritative simulation tasks stored on the participating people rather than normal building worker assignments. The education simulation module owns lesson creation, teacher eligibility, routing to the selected school, synchronized 60-second progress, need-driven pausing, completion and teacher restoration.

Each participant stores the school, target profession, partner, shared progress and previous profession/workplace needed for restoration. Successfully taught professions are persisted on the person as learned qualifications so they remain selectable after later profession changes. While a lesson is active, generic idle behavior ignores both participants. Hunger and sleep treat active teaching/learning as normal work intensity. Their existing need systems remain authoritative for eating and sleeping; after a need completes, normal task-target restoration points the person back to the school and education processing resumes the lesson once both participants are present.

The profession menu owns only the selection flow: selected resident -> school -> profession -> teacher. It does not own lesson progress or qualification state. School is a normal managed building kind with a placeholder same-key asset slot until a final editor-authored school visual is supplied.

## UI-Entity-Links und Wiki-Navigation

src/ui/wikiLinks.ts definiert die stabilen Wiki-Zieltypen und das zentrale Öffnungsereignis. Statische Wissensziele sind Waren und Gebäudetypen; konkrete Personen und Gebäude verwenden weiterhin die bestehenden Selection-Events und bleiben damit Weltobjekte statt Wiki-Seiten.

src/ui/wikiCatalog.ts erzeugt die Waren-, Gebäude-, Tier- und Berufsartikel aus bestehenden Simulationsquellen wie GOODS, Baukosten, Produktionsdefinitionen und Ausbaukanten. Dafür stellt der Simulationskern die unveränderlichen Regeldaten lesbar bereit; die UI mutiert diese Daten nicht. Das Handbuch in src/ui/handbook.ts zeigt ausschließlich die vier datengetriebenen Kataloge und deren dynamische Detailrouten in derselben Modaloberfläche und verwaltet eine kleine interne Zurück-Historie.

Wiki-Links werden als data-wiki-good beziehungsweise data-wiki-building markiert und zentral delegiert. Komponenten sollen dadurch keine eigene Wiki-Routinglogik duplizieren. Bei zusammengesetzten Controls, insbesondere im Baumenü, müssen Wiki- und Primäraktion getrennte Buttons bleiben, damit Pointer- und Touch-Ereignisse nicht gleichzeitig eine Spielaktion auslösen.


### Weitere Wiki-Zieltypen und Pausenintegration

Die zentralen Wiki-Ziele umfassen zusätzlich `AnimalKind` und `Profession`. `wikiCatalog.ts` erzeugt deren Übersichten und Detailartikel aus den bestehenden Typen, `PROFESSION_LABELS`, Erfahrungsregeln und den fachlich relevanten Tierdaten. Alle Übersichts- und Beziehungslisten werden anhand ihrer deutschen Anzeigenamen sortiert.

Das Handbuch signalisiert seinen Sichtbarkeitszustand über `poc-handbook-visibility`. Die Controls bleiben alleiniger Besitzer des Simulations-Loops: Beim Öffnen merken sie sich, ob die Simulation lief, pausieren gegebenenfalls und starten beim Schließen nur dann wieder, wenn sie vor dem Handbuch lief. Das Wiki selbst startet oder tickt keine Simulation.

## Housing and households

Residential capacity is modeled as apartments and households in the authoritative simulation state, not as a per-person capacity on the UI. `World.households` contains the household records; a person points to at most one household through `householdId`, and the household points to exactly one residential building and apartment index. Residential buildings remain a single `house` building kind and carry `houseLevel` (1–5), so later level-specific benefits can be added without multiplying building kinds.

Housing rules and costs live in `src/simulation/housing.ts`. A level-1 house has two apartments and every further level adds one apartment up to six at level 5. Direct construction of a higher level uses the cumulative costs of all levels up to the target. An in-place upgrade uses only the next level's cost and stores `houseUpgradeTarget` until construction completes; the additional apartment becomes available only when construction finishes.

The person command for choosing a home uses the same household model. Only completed houses with a free apartment (or the person's current household) are valid targets. Reassigning a person moves their existing household as a unit, which keeps the command compatible with later couples and families. Sleeping resolves the assigned house through the household; an unhoused person does not implicitly occupy another residential building and falls back to the existing nature/ground sleep behavior.

Save format version 7 persists household records, person household references, and residential level state as part of the authoritative world snapshot.

### Map render-cache fallback

The incremental Phaser renderer may cache the static terrain map in a RenderTexture for performance. That cache is an optimization only: `MainScene.drawMap()` remains the authoritative presentation path. RenderTexture creation or refresh can fail on renderer/browser combinations even when the rest of Phaser remains operational. `IncrementalMainScene` therefore guards both cache creation and cache refresh. On the first cache failure it destroys/disables the cache for the remainder of the scene and keeps the direct `mapGraphics` (and its map-label container) visible. A cache failure must never abort `renderWorld()` or leave the canvas showing only the Phaser background.

