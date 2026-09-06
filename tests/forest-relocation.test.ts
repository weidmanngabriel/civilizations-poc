import { test } from "node:test";
import assert from "node:assert/strict";
import { createWorld, CONFIG } from "../src/simulation/scenario";
import { findPath, same, walkable } from "../src/simulation/hex";
import {
  assigned,
  building,
  changeAssignment,
  tick,
} from "../src/simulation/simulation";

function activateForestWorkers(count = 1) {
  const world = createWorld();
  const forest = building(world, "forest");
  for (let i = 0; i < count; i++) {
    changeAssignment(world, "forest", "worker", 1);
    const worker = assigned(world, "forest", "worker").at(-1)!;
    worker.position = { ...forest.position };
    worker.path = [];
    worker.active = true;
  }
  return { world, forest };
}

test("forest tiles are walkable and distributed as reachable future sites", () => {
  const world = createWorld();
  const forestTiles = world.tiles.filter((tile) => tile.terrain === "forest");
  assert.ok(forestTiles.length >= 15);
  assert.ok(forestTiles.every(walkable));
  for (const tile of forestTiles)
    assert.ok(findPath(world.tiles, building(world, "forest").position, tile));
});

test("a forest produces exactly ten wood before its workers relocate", () => {
  const { world, forest } = activateForestWorkers(1);
  for (let produced = 0; produced < CONFIG.forestYield; produced++) {
    forest.output = 0;
    for (let round = 0; round < CONFIG.duration; round++) tick(world);
  }

  assert.equal(forest.forestRemaining, 0);
  assert.equal(forest.output, 1);
  const worker = world.people.find((p) => p.assignment?.role === "worker")!;
  assert.notEqual(worker.assignment?.building, "forest");
  const newForest = building(world, worker.assignment!.building);
  assert.equal(newForest.forestRemaining, CONFIG.forestYield);
  assert.ok(worker.path.length > 0);
});

test("two workers choose nearest forest sites independently and may split", () => {
  const { world, forest } = activateForestWorkers(2);
  world.rngState = 1;
  forest.forestRemaining = 1;
  forest.output = 0;

  for (let i = 0; i < CONFIG.duration; i++) tick(world);

  assert.equal(forest.forestRemaining, 0);
  const destinations = assigned(world, "forest", "worker");
  assert.equal(destinations.length, 0);
  const ids = world.people
    .filter((p) => p.assignment?.role === "worker")
    .map((p) => p.assignment!.building);
  assert.equal(ids.length, 2);
  assert.ok(ids.every((id) => building(world, id).forestRemaining === CONFIG.forestYield));
});

test("depleted forest stays as rest-wood source, then turns into road", () => {
  const { world, forest } = activateForestWorkers(1);
  forest.forestRemaining = 1;
  forest.output = 0;
  for (let i = 0; i < CONFIG.duration; i++) tick(world);
  assert.equal(forest.forestRemaining, 0);
  assert.equal(forest.output, 1);
  assert.equal(forest.retired, undefined);

  forest.output = 0;
  tick(world);
  assert.equal(forest.retired, true);
  const oldTile = world.tiles.find((tile) => same(tile, forest.position))!;
  assert.equal(oldTile.terrain, "road");
  assert.ok(walkable(oldTile));
});
