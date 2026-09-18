import { test } from "node:test";
import assert from "node:assert/strict";
import { createWorld } from "../src/simulation/scenario";
import { GRID_REFINEMENT } from "../src/simulation/spatial";
import { hexDistance, neighbors, same } from "../src/simulation/hex";
import {
  buildAt,
  changeAssignment,
  changeFishers,
  changeWoodcutters,
  fishingCatchChance,
  fishers,
  setWorkAreaCenter,
  tick,
  WORK_AREA_RADIUS,
  WORK_AREA_RADIUS_WORLD_TILES,
  woodcutters,
} from "../src/simulation/simulation";

test("work areas use a 2.5-world-tile radius", () => {
  assert.equal(WORK_AREA_RADIUS_WORLD_TILES, 2.5);
  assert.equal(WORK_AREA_RADIUS, 2.5 * GRID_REFINEMENT);
});

test("woodcutters keep resource targets inside their movable work flag", () => {
  const world = createWorld();
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
  const world = createWorld();
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
  const world = createWorld();
  const warehouse = buildAt(world, { q: 7, r: 4 }, "warehouse")!;
  const source = buildAt(world, { q: 30, r: 18 }, "sawmill")!;
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
  const world = createWorld(1);
  const fisher = world.people[0]!;
  assert.equal(fishingCatchChance(fisher), 0.3);
  fisher.experience = { fisher: 100 };
  assert.equal(fishingCatchChance(fisher), 0.8);
});

test("fishers cast on arrival, then wait five simulated seconds before moving on", () => {
  const world = createWorld(1);
  assert.equal(changeFishers(world, 1), true);
  const fisher = fishers(world)[0]!;
  assert.ok(fisher.workArea);
  assert.ok(fisher.fishingSpot);
  assert.equal(
    hexDistance(fisher.workArea!.center, fisher.fishingSpot!) <= WORK_AREA_RADIUS,
    true,
  );
  assert.equal(
    neighbors(fisher.fishingSpot!).some((position) =>
      world.tiles.some((tile) => same(tile, position) && tile.terrain === "river"),
    ),
    true,
  );

  const firstSpot = { ...fisher.fishingSpot! };
  fisher.position = { ...firstSpot };
  fisher.path = [];
  fisher.movement = 0;
  fisher.active = false;
  world.rngState = 0;

  tick(world);

  assert.equal(fisher.experience?.fisher, 1, "the cast itself awards experience");
  assert.ok(fisher.fishingWaitUntilTick !== undefined, "waiting starts immediately after the cast");
  assert.equal(
    (world.looseGoods ?? [])
      .filter((stack) => stack.good === "fish")
      .reduce((sum, stack) => sum + stack.amount, 0),
    1,
    "a successful cast creates one physical fish",
  );

  const waitUntil = fisher.fishingWaitUntilTick!;
  while (world.round < waitUntil) {
    const experienceBefore: number | undefined = fisher.experience?.fisher;
    tick(world);
    if (world.round < waitUntil)
      assert.equal(fisher.experience?.fisher, experienceBefore);
  }

  assert.equal(fisher.experience?.fisher, 1);
  assert.ok(
    !same(fisher.fishingSpot!, firstSpot) || fisher.path.length > 0,
    "after waiting the fisher chooses another shoreline position when possible",
  );
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
