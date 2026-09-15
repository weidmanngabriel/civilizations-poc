import { test } from "node:test";
import assert from "node:assert/strict";
import { createWorld } from "../src/simulation/scenario";
import { hexDistance } from "../src/simulation/hex";
import {
  buildAt,
  changeAssignment,
  changeWoodcutters,
  setWorkAreaCenter,
  tick,
  WORK_AREA_RADIUS,
  woodcutters,
} from "../src/simulation/simulation";

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
