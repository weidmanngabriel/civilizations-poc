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

test("forests are natural resources and forest tiles are walkable", () => {
  const world = createWorld();
  assert.equal(world.buildings.some((b) => b.kind === ("forest" as never)), false);
  assert.ok(world.naturalResources.some((resource) => resource.kind === "forest"));
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
  const forestIds = workers.map((p) => p.resourceTarget);
  assert.ok(forestIds.every(Boolean));
  assert.equal(new Set(forestIds).size, 2);
  for (const id of forestIds) {
    const forest = naturalResource(world, id!);
    assert.equal(world.people.filter((person) => person.resourceTarget === forest.id).length, 1);
    assert.equal(forest.remaining, CONFIG.forestYield);
  }
});

test("a forest pauses at three local wood until one slot is free", () => {
  const { world, forest, worker } = activeWoodcutter();
  for (let i = 0; i < CONFIG.duration * 4; i++) tick(world);

  assert.equal(forest.output, CONFIG.forestOutputCapacity);
  assert.equal(forest.remaining, CONFIG.forestYield - CONFIG.forestOutputCapacity);
  assert.equal(worker.progress, 0);
  assert.equal(forest.depleted, undefined);

  forest.output--;
  for (let i = 0; i < CONFIG.duration; i++) tick(world);

  assert.equal(forest.output, CONFIG.forestOutputCapacity);
  assert.equal(forest.remaining, CONFIG.forestYield - CONFIG.forestOutputCapacity - 1);
});

test("a forest allows ten harvest cycles, disappears immediately, and its woodcutter relocates", () => {
  const { world, forest, worker } = activeWoodcutter();
  for (let produced = 0; produced < CONFIG.forestYield; produced++) {
    forest.output = 0;
    for (let round = 0; round < CONFIG.duration; round++) tick(world);
  }

  assert.equal(forest.remaining, 0);
  assert.equal(forest.output, 1);
  assert.equal(forest.depleted, true);
  assert.equal(world.people.filter((person) => person.resourceTarget === forest.id).length, 0);
  assert.notEqual(worker.resourceTarget, forest.id);
  const nextForest = naturalResource(world, worker.resourceTarget!);
  assert.equal(nextForest.remaining, CONFIG.forestYield);
  const oldTile = world.tiles.find((tile) => same(tile, forest.position))!;
  assert.equal(oldTile.terrain, "grass");
});

test("woodcutter experience speeds up felling by up to 50 percent without increasing yield", () => {
  const { world, forest, worker } = activeWoodcutter();
  worker.experience = { woodcutter: 100 };

  const expectedTicks = Math.ceil(CONFIG.duration / 1.5);
  for (let i = 0; i < expectedTicks - 1; i++) tick(world);
  assert.equal(forest.output, 0);
  assert.equal(forest.remaining, CONFIG.forestYield);

  tick(world);
  assert.equal(forest.output, 1);
  assert.equal(forest.remaining, CONFIG.forestYield - 1);
});

test("leftover wood remains collectible after the forest has disappeared", () => {
  const { world, forest } = activeWoodcutter();
  forest.remaining = 1;
  forest.output = 0;
  for (let i = 0; i < CONFIG.duration; i++) tick(world);
  assert.equal(forest.depleted, true);
  assert.equal(forest.output, 1);

  const sawmill = buildAt(world, { q: 7, r: 4 }, "sawmill")!;
  changeAssignment(world, sawmill.id, "carrier", 1);
  const carrier = assigned(world, sawmill.id, "carrier")[0]!;
  carrier.position = { ...sawmill.position };
  carrier.path = [];
  carrier.movement = 0;
  carrier.active = true;
  tick(world);

  assert.equal(carrier.trip?.source, forest.id);
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
