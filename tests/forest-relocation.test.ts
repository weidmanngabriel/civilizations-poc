import { test } from "node:test";
import assert from "node:assert/strict";
import { createWorld, CONFIG } from "../src/simulation/scenario";
import { findPath, same, walkable } from "../src/simulation/hex";
import {
  assigned,
  buildAt,
  building,
  naturalResource,
  changeAssignment,
  changeWoodcutters,
  tick,
  woodcutters,
} from "../src/simulation/simulation";

function activeWoodcutter() {
  const world = createWorld();
  assert.equal(changeWoodcutters(world, 1), true);
  const worker = woodcutters(world)[0]!;
  const forest = naturalResource(world, worker.resourceTarget!);
  worker.position = { ...forest.position };
  worker.path = [];
  worker.movement = 0;
  worker.active = true;
  return { world, forest, worker };
}

const groundWood = (world: ReturnType<typeof createWorld>) =>
  (world.looseGoods ?? []).filter((stack) => stack.good === "wood");

const groundWoodAmount = (world: ReturnType<typeof createWorld>) =>
  groundWood(world).reduce((sum, stack) => sum + stack.amount, 0);

test("trees are blocking resource objects on ordinary ground", () => {
  const world = createWorld();
  assert.equal(world.buildings.some((b) => b.kind === ("forest" as never)), false);
  const trees = world.naturalResources.filter((resource) => resource.kind === "forest");
  assert.ok(trees.length >= 15);
  assert.equal(world.tiles.some((tile) => tile.terrain === "forest"), false);

  for (const tree of trees) {
    const tile = world.tiles.find((candidate) => same(candidate, tree.position))!;
    assert.equal(tile.terrain, "grass");
    assert.equal(tile.resourceBlocking, true);
    assert.equal(walkable(tile), false);
  }

  assert.ok(findPath(world.tiles, building(world, "hq").position, trees[0]!.position));
});

test("each appointed woodcutter claims a different tree", () => {
  const world = createWorld();
  assert.equal(changeWoodcutters(world, 1), true);
  assert.equal(changeWoodcutters(world, 1), true);

  const workers = woodcutters(world);
  assert.equal(workers.length, 2);
  const forestIds = workers.map((p) => p.resourceTarget);
  assert.ok(forestIds.every(Boolean));
  assert.equal(new Set(forestIds).size, 2);
  for (const id of forestIds) {
    const forest = naturalResource(world, id!);
    assert.equal(world.people.filter((person) => person.resourceTarget === forest.id).length, 1);
    assert.equal(forest.remaining, CONFIG.forestYield);
  }
});

test("one tree yields exactly three physical wood units", () => {
  const { world, forest } = activeWoodcutter();
  for (let produced = 0; produced < CONFIG.forestYield; produced++)
    for (let round = 0; round < CONFIG.duration; round++) tick(world);

  assert.equal(CONFIG.forestYield, 3);
  assert.equal(forest.output, 0);
  assert.equal(forest.remaining, 0);
  assert.equal(groundWoodAmount(world), 3);
  assert.ok(groundWood(world).every((stack) => stack.amount <= 3));
});

test("a depleted tree disappears, unblocks its cell, and its woodcutter relocates", () => {
  const { world, forest, worker } = activeWoodcutter();
  for (let produced = 0; produced < CONFIG.forestYield; produced++)
    for (let round = 0; round < CONFIG.duration; round++) tick(world);

  assert.equal(forest.remaining, 0);
  assert.equal(forest.output, 0);
  assert.equal(groundWoodAmount(world), CONFIG.forestYield);
  assert.equal(forest.depleted, true);
  assert.equal(world.people.filter((person) => person.resourceTarget === forest.id).length, 0);
  assert.notEqual(worker.resourceTarget, forest.id);
  const nextForest = naturalResource(world, worker.resourceTarget!);
  assert.equal(nextForest.remaining, CONFIG.forestYield);
  const oldTile = world.tiles.find((tile) => same(tile, forest.position))!;
  assert.equal(oldTile.terrain, "grass");
  assert.equal(oldTile.resourceBlocking, undefined);
  assert.equal(walkable(oldTile), true);
});

test("woodcutter experience speeds up felling by up to 50 percent without increasing yield", () => {
  const { world, forest, worker } = activeWoodcutter();
  worker.experience = { woodcutter: 100 };

  const expectedTicks = Math.ceil(CONFIG.duration / 1.5);
  for (let i = 0; i < expectedTicks - 1; i++) tick(world);
  assert.equal(groundWoodAmount(world), 0);
  assert.equal(forest.remaining, CONFIG.forestYield);

  tick(world);
  assert.equal(forest.output, 0);
  assert.equal(groundWoodAmount(world), 1);
  assert.equal(forest.remaining, CONFIG.forestYield - 1);
});

test("leftover wood remains collectible after the tree has disappeared", () => {
  const { world, forest } = activeWoodcutter();
  forest.remaining = 1;
  forest.output = 0;
  for (let i = 0; i < CONFIG.duration; i++) tick(world);
  assert.equal(forest.depleted, true);
  assert.equal(forest.output, 0);
  const stack = groundWood(world)[0];
  assert.ok(stack);
  assert.equal(stack.amount, 1);

  const sawmill = buildAt(world, { q: 7, r: 4 }, "sawmill")!;
  changeAssignment(world, sawmill.id, "carrier", 1);
  const carrier = assigned(world, sawmill.id, "carrier")[0]!;
  carrier.position = { ...sawmill.position };
  carrier.path = [];
  carrier.movement = 0;
  carrier.active = true;
  tick(world);

  assert.equal(carrier.trip?.source, stack.id);
  assert.equal(carrier.trip?.sourceKind, "resource");
  assert.equal(carrier.trip?.good, "wood");
  assert.equal(forest.depleted, true);
});

test("removing a woodcutter returns the person to the normal free-person flow", () => {
  const { world, worker } = activeWoodcutter();
  assert.equal(changeWoodcutters(world, -1), true);
  assert.equal(worker.woodcutter, undefined);
  assert.equal(worker.assignment, undefined);
  assert.equal(worker.resourceTarget, undefined);
  assert.ok(worker.path.length > 0);
});
