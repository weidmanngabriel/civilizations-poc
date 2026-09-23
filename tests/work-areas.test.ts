import { test } from "node:test";
import assert from "node:assert/strict";
import { CONFIG, createDefaultGameWorld, createWorld } from "../src/simulation/scenario";
import { createTestWorld } from "./testWorld";
import { GRID_REFINEMENT } from "../src/simulation/spatial";
import { hexDistance, neighbors, same } from "../src/simulation/hex";
import {
  buildAt,
  changeAssignment,
  changeFishers,
  changeWoodcutters,
  fishingCatchChance,
  fishers,
  setRoad,
  setWorkAreaCenter,
  tick,
  WORK_AREA_RADIUS,
  WORK_AREA_RADIUS_WORLD_TILES,
  woodcutters,
} from "../src/simulation/simulation";

const createForestTestWorld = (population = 1) =>
  createTestWorld({
    width: 40,
    height: 30,
    population,
    resources: [
      { kind: "forest", offset: { q: 8, r: 0 } },
      { kind: "forest", offset: { q: 10, r: 2 } },
      { kind: "forest", offset: { q: 7, r: 4 } },
      { kind: "forest", offset: { q: 12, r: -2 } },
      { kind: "forest", offset: { q: -8, r: 0 } },
    ],
  });

test("work areas use a 2.5-world-tile radius", () => {
  assert.equal(WORK_AREA_RADIUS_WORLD_TILES, 2.5);
  assert.equal(WORK_AREA_RADIUS, 2.5 * GRID_REFINEMENT);
});

test("initial woodcutters place their flags at their first selected trees", () => {
  const world = createDefaultGameWorld();
  const hq = world.buildings.find((building) => building.id === "hq")!;

  tick(world);

  const initialWoodcutters = woodcutters(world);
  assert.equal(initialWoodcutters.length, 2);
  for (const worker of initialWoodcutters) {
    assert.ok(worker.resourceTarget);
    assert.ok(worker.workArea);
    const tree = world.naturalResources.find((resource) => resource.id === worker.resourceTarget)!;
    assert.deepEqual(worker.workArea!.center, tree.position);
    assert.equal(same(worker.workArea!.center, hq.position), false);
  }
  assert.notDeepEqual(initialWoodcutters[0]!.resourceTarget, initialWoodcutters[1]!.resourceTarget);
});

test("woodcutters keep resource targets inside their movable work flag", () => {
  const world = createForestTestWorld();
  assert.equal(changeWoodcutters(world, 1), true);
  tick(world);
  const worker = woodcutters(world)[0]!;
  assert.ok(worker.workArea);
  assert.ok(worker.resourceTarget);
  const initial = world.naturalResources.find((resource) => resource.id === worker.resourceTarget)!;
  assert.equal(hexDistance(worker.workArea!.center, initial.position) <= WORK_AREA_RADIUS, true);

  const farthestTree = world.naturalResources
    .filter((resource) => resource.kind === "forest" && !resource.depleted)
    .sort(
      (a, b) =>
        hexDistance(initial.position, b.position) - hexDistance(initial.position, a.position),
    )[0]!;
  assert.equal(setWorkAreaCenter(world, worker.id, farthestTree.position), true);
  assert.ok(worker.workArea);
  if (worker.resourceTarget) {
    const target = world.naturalResources.find((resource) => resource.id === worker.resourceTarget)!;
    assert.equal(hexDistance(worker.workArea!.center, target.position) <= WORK_AREA_RADIUS, true);
  }
});

test("woodcutters stop instead of claiming resources outside an exhausted flag area", () => {
  const world = createForestTestWorld();
  assert.equal(changeWoodcutters(world, 1), true);
  tick(world);
  const worker = woodcutters(world)[0]!;
  const center = { ...worker.workArea!.center };
  for (const resource of world.naturalResources) {
    if (
      resource.kind === "forest" &&
      hexDistance(center, resource.position) <= WORK_AREA_RADIUS
    ) {
      resource.remaining = 0;
      resource.depleted = true;
    }
  }
  worker.resourceTarget = undefined;
  worker.path = [];
  worker.active = false;
  worker.workArea!.retryAfterTick = undefined;

  for (let i = 0; i < 120; i += 1) tick(world);
  assert.equal(worker.resourceTarget, undefined);
});

test("carriers receive a work flag at their workplace and reject outside pickup sources", () => {
  const world = createTestWorld({ width: 48, height: 36, population: 2 });
  const warehouse = buildAt(world, { q: -12, r: 0 }, "warehouse")!;
  const source = buildAt(world, { q: 12, r: 0 }, "sawmill")!;
  source.output = 5;
  assert.equal(changeAssignment(world, warehouse.id, "carrier", 1), true);
  const carrier = world.people.find(
    (person) => person.assignment?.building === warehouse.id && person.assignment.role === "carrier",
  )!;
  carrier.position = { ...warehouse.position };
  carrier.path = [];
  carrier.active = true;
  assert.deepEqual(carrier.workArea?.center, warehouse.position);
  assert.equal(carrier.workArea?.radius, WORK_AREA_RADIUS);

  const farTile = world.tiles
    .filter((tile) => hexDistance(tile, source.position) > WORK_AREA_RADIUS)
    .sort(
      (a, b) => hexDistance(a, source.position) - hexDistance(b, source.position),
    )[0]!;
  assert.equal(setWorkAreaCenter(world, carrier.id, farTile), true);
  for (let i = 0; i < 120; i += 1) tick(world);
  if (carrier.trip && !carrier.trip.picked) {
    const tripSource = carrier.trip.sourceKind === "resource"
      ? world.naturalResources.find((candidate) => candidate.id === carrier.trip!.source)?.position
      : world.buildings.find((candidate) => candidate.id === carrier.trip!.source)?.position;
    assert.ok(tripSource);
    assert.equal(hexDistance(carrier.workArea!.center, tripSource!) <= WORK_AREA_RADIUS, true);
  }
});


test("fisher catch chance rises from 30 to 80 percent with experience", () => {
  const world = createTestWorld();
  const fisher = world.people[0]!;
  assert.equal(fishingCatchChance(fisher), 0.3);
  fisher.experience = { fisher: 100 };
  assert.equal(fishingCatchChance(fisher), 0.8);
});

test("each extracted unit is carried to the personal work flag before becoming a stack", () => {
  const world = createForestTestWorld();
  assert.equal(changeWoodcutters(world, 1), true);
  tick(world);
  const worker = woodcutters(world)[0]!;
  const resource = world.naturalResources.find(
    (candidate) => candidate.id === worker.resourceTarget,
  )!;

  const flagTile = world.tiles
    .filter((tile) => {
      const distance = hexDistance(tile, resource.position);
      return distance >= 4 && distance <= 8 && tile.terrain === "grass";
    })
    .sort(
      (a, b) =>
        hexDistance(worker.position, a) - hexDistance(worker.position, b),
    )[0]!;
  assert.equal(setWorkAreaCenter(world, worker.id, flagTile), true);

  // Local work-area movement must not depend on the high-level waypost graph.
  world.wayposts = [];
  world.waypostRevision = 0;

  let guard = 10_000;
  while (worker.path.length && guard-- > 0) tick(world);
  assert.ok(guard > 0);
  worker.progress = CONFIG.duration - 1;
  worker.active = true;

  tick(world);

  assert.equal(worker.outdoorCarry, "wood");
  assert.equal(
    (world.looseGoods ?? []).filter((stack) => stack.good === "wood").length,
    0,
    "the extracted unit must not appear at the resource",
  );

  tick(world);
  assert.equal(worker.outdoorCarry, "wood");
  assert.ok(worker.path.length > 0, "the worker should be returning to the flag");
  const roadTile = world.tiles.find(
    (tile) =>
      tile.terrain === "grass" &&
      hexDistance(tile, resource.position) > WORK_AREA_RADIUS * 2,
  );
  assert.ok(roadTile);
  assert.equal(setRoad(world, roadTile, true), true);
  assert.ok(worker.path.length > 0, "a global reroute must keep the flag delivery route");
  assert.equal(
    same(worker.path.at(-1)!, worker.workArea!.center),
    true,
    "carried outdoor goods take precedence over the retained resource target",
  );

  guard = 10_000;
  while (worker.outdoorCarry && guard-- > 0) tick(world);
  assert.ok(guard > 0);
  const wood = (world.looseGoods ?? []).filter((stack) => stack.good === "wood");
  assert.equal(wood.reduce((sum, stack) => sum + stack.amount, 0), 1);
  assert.ok(
    wood.every((stack) => {
      const distance = hexDistance(stack.position, worker.workArea!.center);
      return distance >= 1 && distance <= GRID_REFINEMENT;
    }),
    "extracted goods must be dropped around the work flag, never on the flag itself",
  );
});

test("fisher reroutes keep the current fishing spot instead of returning to HQ", () => {
  const world = createWorld(1);
  assert.equal(changeFishers(world, 1), true);
  const fisher = fishers(world)[0]!;
  assert.ok(fisher.fishingSpot);
  assert.ok(fisher.path.length > 0, "the fisher should start by walking to the fishing spot");

  tick(world);
  const fishingSpot = { ...fisher.fishingSpot! };
  const roadTile = world.tiles.find(
    (tile) =>
      tile.terrain === "grass" &&
      !same(tile, fisher.position) &&
      !same(tile, fishingSpot) &&
      hexDistance(tile, fishingSpot) > WORK_AREA_RADIUS * 2,
  );
  assert.ok(roadTile);
  assert.equal(setRoad(world, roadTile, true), true);

  assert.ok(fisher.path.length > 0);
  assert.equal(
    same(fisher.path.at(-1)!, fishingSpot),
    true,
    "generic rerouting must preserve the authoritative fishing task target",
  );
});

test("fishers use one five-second cast cycle and carry a catch to their flag", () => {
  const world = createWorld(1);
  assert.equal(changeFishers(world, 1), true);
  const fisher = fishers(world)[0]!;
  assert.ok(fisher.workArea);
  assert.ok(fisher.fishingSpot);

  const initialSpot = { ...fisher.fishingSpot! };
  const flagTile = world.tiles
    .filter((tile) => {
      const distance = hexDistance(tile, initialSpot);
      return distance >= 4 && distance <= 8 && tile.terrain === "grass";
    })
    .sort((a, b) => hexDistance(a, initialSpot) - hexDistance(b, initialSpot))[0]!;
  assert.equal(setWorkAreaCenter(world, fisher.id, flagTile), true);
  assert.ok(fisher.fishingSpot);
  const fishingSpot = { ...fisher.fishingSpot! };

  assert.equal(
    neighbors(fishingSpot).some((position) =>
      world.tiles.some((tile) => same(tile, position) && tile.terrain === "river"),
    ),
    true,
  );

  fisher.position = { ...fishingSpot };
  fisher.path = [];
  fisher.movement = 0;
  fisher.active = false;
  world.rngState = 0;

  tick(world);

  assert.ok(fisher.fishingStartedAtTick !== undefined);
  assert.ok(fisher.fishingWaterTarget);
  assert.ok(fisher.fishingWaitUntilTick !== undefined);
  assert.equal(
    fisher.fishingWaitUntilTick! - fisher.fishingStartedAtTick!,
    5 * CONFIG.simulationHz,
  );
  assert.equal(fisher.experience?.fisher ?? 0, 0);
  assert.equal(fisher.outdoorCarry, undefined);
  assert.equal(
    (world.looseGoods ?? []).filter((stack) => stack.good === "fish").length,
    0,
  );

  const waitUntil = fisher.fishingWaitUntilTick!;
  let guard = 10_000;
  while (world.round < waitUntil && guard-- > 0) tick(world);
  assert.ok(guard > 0);

  assert.equal(fisher.experience?.fisher, 1);
  assert.equal(fisher.outdoorCarry, "fish");
  assert.equal(fisher.fishingWaterTarget, undefined);
  assert.equal(fisher.fishingStartedAtTick, undefined);
  assert.equal(fisher.fishingWaitUntilTick, undefined);
  assert.equal(
    (world.looseGoods ?? []).filter((stack) => stack.good === "fish").length,
    0,
    "the catch stays on the fisher until the flag is reached",
  );

  guard = 10_000;
  while (fisher.outdoorCarry && guard-- > 0) tick(world);
  assert.ok(guard > 0);
  const fish = (world.looseGoods ?? []).filter((stack) => stack.good === "fish");
  assert.equal(fish.reduce((sum, stack) => sum + stack.amount, 0), 1);
  assert.ok(
    fish.every((stack) => {
      const distance = hexDistance(stack.position, fisher.workArea!.center);
      return distance >= 1 && distance <= GRID_REFINEMENT;
    }),
    "caught goods must be dropped around the work flag, never on the flag itself",
  );
});


test("hungry fishers eat after every completed fishing cycle", () => {
  for (const scenario of [
    { rngState: 0, caught: true },
    { rngState: 1000, caught: false },
  ]) {
    const world = createWorld(1);
    const hq = world.buildings.find((building) => building.id === "hq")!;
    hq.inventory ??= {};
    hq.inventory.bread = 1;

    assert.equal(changeFishers(world, 1), true);
    const fisher = fishers(world)[0]!;
    assert.ok(fisher.fishingSpot);

    fisher.position = { ...fisher.fishingSpot! };
    fisher.path = [];
    fisher.movement = 0;
    fisher.active = false;
    fisher.hunger = 40;
    world.rngState = scenario.rngState;

    tick(world);
    assert.ok(fisher.fishingWaitUntilTick !== undefined);

    let guard = 10_000;
    while (fisher.fishingWaitUntilTick !== undefined && guard-- > 0) tick(world);
    assert.ok(guard > 0);

    assert.ok(fisher.hungerState, "a completed fishing cycle must become a hunger boundary");
    assert.equal(fisher.fishingStartedAtTick, undefined);
    assert.equal(fisher.fishingWaitUntilTick, undefined);
    assert.equal(Boolean(fisher.outdoorCarry), scenario.caught);
  }
});

test("failed fishing cycles do not award profession experience", () => {
  const world = createWorld(1);
  assert.equal(changeFishers(world, 1), true);
  const fisher = fishers(world)[0]!;
  assert.ok(fisher.fishingSpot);

  fisher.position = { ...fisher.fishingSpot! };
  fisher.path = [];
  fisher.movement = 0;
  fisher.active = false;
  world.rngState = 1000;

  tick(world);
  assert.ok(fisher.fishingWaitUntilTick !== undefined);

  let guard = 10_000;
  while (fisher.fishingWaitUntilTick !== undefined && guard-- > 0) tick(world);
  assert.ok(guard > 0);
  assert.equal(fisher.experience?.fisher ?? 0, 0);
  assert.equal(fisher.outdoorCarry, undefined);
});

test("moving a fisher flag invalidates a fishing spot outside the new area", () => {
  const world = createWorld(1);
  assert.equal(changeFishers(world, 1), true);
  const fisher = fishers(world)[0]!;
  const oldSpot = { ...fisher.fishingSpot! };
  const farTile = world.tiles
    .filter((tile) => hexDistance(tile, oldSpot) > WORK_AREA_RADIUS)
    .sort((a, b) => hexDistance(a, oldSpot) - hexDistance(b, oldSpot))[0]!;
  assert.equal(setWorkAreaCenter(world, fisher.id, farTile), true);
  if (fisher.fishingSpot)
    assert.equal(hexDistance(fisher.workArea!.center, fisher.fishingSpot) <= WORK_AREA_RADIUS, true);
});


test("moving a work flag outside the worker area still requires global waypost travel", () => {
  const world = createForestTestWorld();
  assert.equal(changeWoodcutters(world, 1), true);
  tick(world);
  const worker = woodcutters(world)[0]!;
  const oldCenter = { ...worker.workArea!.center };
  const farTile = world.tiles
    .filter((tile) => tile.terrain === "grass")
    .find((tile) => hexDistance(tile, oldCenter) > WORK_AREA_RADIUS + 5);
  assert.ok(farTile);

  world.wayposts = [];
  world.waypostRevision = 0;
  assert.equal(setWorkAreaCenter(world, worker.id, farTile), true);

  assert.deepEqual(worker.workArea!.center, { q: farTile.q, r: farTile.r });
  assert.equal(worker.path.length, 0);
  assert.equal(worker.navigationBlocked, true);
});


test("an extractor with no remaining local target returns to the work flag", () => {
  const world = createForestTestWorld();
  assert.equal(changeWoodcutters(world, 1), true);
  tick(world);
  const worker = woodcutters(world)[0]!;
  const center = { ...worker.workArea!.center };
  const target = world.naturalResources.find(
    (resource) => resource.id === worker.resourceTarget,
  )!;
  worker.position = { ...target.position };
  worker.path = [];
  worker.resourceTarget = undefined;
  worker.active = false;
  for (const resource of world.naturalResources) {
    if (
      resource.kind === "forest" &&
      hexDistance(center, resource.position) <= WORK_AREA_RADIUS
    ) {
      resource.remaining = 0;
      resource.depleted = true;
    }
  }
  worker.workArea!.retryAfterTick = undefined;

  tick(world);

  if (!same(worker.position, center)) {
    assert.ok(worker.path.length > 0);
    assert.equal(same(worker.path.at(-1)!, center), true);
  }
});

test("a failed fishing cycle replans locally without returning to the work flag", () => {
  const world = createWorld(1);
  assert.equal(changeFishers(world, 1), true);
  const fisher = fishers(world)[0]!;
  const spot = { ...fisher.fishingSpot! };
  const center = { ...fisher.workArea!.center };
  fisher.position = spot;
  fisher.path = [];
  fisher.active = false;
  fisher.hunger = 100;
  world.rngState = 1000;

  tick(world);
  const waitUntil = fisher.fishingWaitUntilTick!;
  while (world.round < waitUntil) tick(world);

  assert.equal(fisher.outdoorCarry, undefined);
  assert.equal(
    !same(spot, center) && fisher.path.length > 0
      ? same(fisher.path.at(-1)!, center)
      : false,
    false,
    "a failed cast should continue with local fishing instead of routing to the flag",
  );
});


test("an exhausted woodcutter idles exactly at the work flag across retry cycles", () => {
  const world = createForestTestWorld();
  assert.equal(changeWoodcutters(world, 1), true);
  tick(world);
  const worker = woodcutters(world)[0]!;
  const center = { ...worker.workArea!.center };

  for (const resource of world.naturalResources) {
    if (
      resource.kind === "forest" &&
      hexDistance(center, resource.position) <= WORK_AREA_RADIUS
    ) {
      resource.remaining = 0;
      resource.depleted = true;
    }
  }

  worker.position = { ...center };
  worker.resourceTarget = undefined;
  worker.outdoorCarry = undefined;
  worker.path = [];
  worker.idleTarget = undefined;
  worker.active = false;
  worker.progress = 0;
  worker.workArea!.retryAfterTick = undefined;

  const observedPositions: Array<{ q: number; r: number }> = [];
  for (let i = 0; i < CONFIG.decisionIntervalTicks * 4; i += 1) {
    tick(world);
    observedPositions.push({ ...worker.position });
  }

  assert.equal(worker.resourceTarget, undefined);
  assert.equal(worker.idleTarget, undefined);
  assert.equal(worker.path.length, 0);
  assert.equal(worker.active, false);
  assert.equal(
    observedPositions.every((position) => same(position, center)),
    true,
    "an exhausted woodcutter must remain at the flag while waiting for work",
  );
});
