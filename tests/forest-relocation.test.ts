import { test } from "node:test";
import assert from "node:assert/strict";
import { createWorld, CONFIG } from "../src/simulation/scenario";
import { findPath, same, walkable } from "../src/simulation/hex";
import {
  assigned,
  building,
  changeAssignment,
  changeWoodcutters,
  tick,
  woodcutters,
} from "../src/simulation/simulation";

function activeWoodcutter() {
  const world = createWorld();
  assert.equal(changeWoodcutters(world, 1), true);
  const worker = woodcutters(world)[0]!;
  const forest = building(world, worker.assignment!.building);
  worker.position = { ...forest.position };
  worker.path = [];
  worker.active = true;
  return { world, forest, worker };
}

test("world starts without an active forest and passive forest tiles are walkable", () => {
  const world = createWorld();
  assert.equal(world.buildings.some((b) => b.forestRemaining !== undefined), false);
  const forestTiles = world.tiles.filter((tile) => tile.terrain === "forest");
  assert.ok(forestTiles.length >= 15);
  assert.ok(forestTiles.every(walkable));
  assert.ok(
    forestTiles.some((tile) =>
      findPath(world.tiles, building(world, "hq").position, tile),
    ),
  );
});

test("each appointed woodcutter claims a different forest", () => {
  const world = createWorld();
  assert.equal(changeWoodcutters(world, 1), true);
  assert.equal(changeWoodcutters(world, 1), true);

  const workers = woodcutters(world);
  assert.equal(workers.length, 2);
  const forestIds = workers.map((p) => p.assignment?.building);
  assert.ok(forestIds.every(Boolean));
  assert.equal(new Set(forestIds).size, 2);
  for (const id of forestIds) {
    const forest = building(world, id!);
    assert.equal(forest.workers, 1);
    assert.equal(assigned(world, forest.id, "worker").length, 1);
    assert.equal(forest.forestRemaining, CONFIG.forestYield);
  }
});

test("a forest produces exactly ten wood, disappears immediately, and its woodcutter relocates", () => {
  const { world, forest, worker } = activeWoodcutter();
  for (let produced = 0; produced < CONFIG.forestYield; produced++) {
    forest.output = 0;
    for (let round = 0; round < CONFIG.duration; round++) tick(world);
  }

  assert.equal(forest.forestRemaining, 0);
  assert.equal(forest.output, 1);
  assert.equal(forest.retired, true);
  assert.equal(assigned(world, forest.id, "worker").length, 0);
  assert.notEqual(worker.assignment?.building, forest.id);
  const nextForest = building(world, worker.assignment!.building);
  assert.equal(nextForest.forestRemaining, CONFIG.forestYield);
  const oldTile = world.tiles.find((tile) => same(tile, forest.position))!;
  assert.equal(oldTile.terrain, "road");
});

test("leftover wood remains collectible after the forest has disappeared", () => {
  const { world, forest } = activeWoodcutter();
  forest.forestRemaining = 1;
  forest.output = 0;
  for (let i = 0; i < CONFIG.duration; i++) tick(world);
  assert.equal(forest.retired, true);
  assert.equal(forest.output, 1);

  changeAssignment(world, "sawmill", "carrier", 1);
  const carrier = assigned(world, "sawmill", "carrier")[0]!;
  carrier.position = { ...building(world, "sawmill").position };
  carrier.path = [];
  carrier.active = true;
  tick(world);

  assert.equal(carrier.trip?.source, forest.id);
  assert.equal(carrier.trip?.good, "wood");
  assert.equal(forest.retired, true);
});

test("removing a woodcutter returns the person to the normal free-person flow", () => {
  const { world, worker } = activeWoodcutter();
  assert.equal(changeWoodcutters(world, -1), true);
  assert.equal(worker.woodcutter, undefined);
  assert.equal(worker.assignment, undefined);
  assert.ok(worker.path.length > 0);
});
