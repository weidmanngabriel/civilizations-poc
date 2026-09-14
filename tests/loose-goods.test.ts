import test from "node:test";
import assert from "node:assert/strict";
import {
  LOOSE_GOOD_STACK_CAPACITY,
  availableLooseGoodAmount,
  canPlaceLooseGoodAt,
  findLooseGoodDropPosition,
  looseGoodStacks,
  pickupReservedLooseGood,
  placeLooseGood,
  releaseLooseGoodReservation,
  reserveLooseGood,
} from "../src/simulation/looseGoods";
import { findPathBySteps } from "../src/simulation/hex";
import type { Tile, World } from "../src/simulation/model";

const makeWorld = (): World => {
  const tiles: Tile[] = [];
  for (let q = -3; q <= 3; q += 1)
    for (let r = -3; r <= 3; r += 1)
      if (Math.max(Math.abs(q), Math.abs(r), Math.abs(q + r)) <= 3)
        tiles.push({ q, r, terrain: "grass" });

  return {
    round: 0,
    nextId: 1,
    nextBuildingId: 1,
    nextFieldId: 1,
    rngState: 1,
    people: [],
    buildings: [],
    naturalResources: [],
    tiles,
  };
};

test("ground stacks hold only one good type and at most three physical units", () => {
  const world = makeWorld();
  const position = { q: 0, r: 0 };

  const stack = placeLooseGood(world, position, "wood", 2)!;
  assert.ok(stack);
  assert.equal(stack.amount, 2);
  assert.equal(placeLooseGood(world, position, "wood", 1), stack);
  assert.equal(stack.amount, LOOSE_GOOD_STACK_CAPACITY);
  assert.equal(placeLooseGood(world, position, "wood", 1), undefined);
  assert.equal(placeLooseGood(world, position, "clay", 1), undefined);
  assert.equal(looseGoodStacks(world).length, 1);
});

test("loose goods never change terrain or block pathfinding", () => {
  const world = makeWorld();
  const position = { q: 0, r: 0 };
  const before = world.tiles.find((tile) => tile.q === 0 && tile.r === 0)!.terrain;
  const pathBefore = findPathBySteps(world.tiles, { q: -2, r: 0 }, { q: 2, r: 0 })!;

  placeLooseGood(world, position, "wood", 3);

  assert.equal(world.tiles.find((tile) => tile.q === 0 && tile.r === 0)!.terrain, before);
  assert.deepEqual(findPathBySteps(world.tiles, { q: -2, r: 0 }, { q: 2, r: 0 }), pathBefore);
});

test("reservations protect concrete units and empty stacks disappear on pickup", () => {
  const world = makeWorld();
  const stack = placeLooseGood(world, { q: 0, r: 0 }, "wood", 2)!;

  assert.equal(reserveLooseGood(world, stack.id), true);
  assert.equal(reserveLooseGood(world, stack.id), true);
  assert.equal(reserveLooseGood(world, stack.id), false);
  assert.equal(availableLooseGoodAmount(stack), 0);

  assert.equal(releaseLooseGoodReservation(world, stack.id), true);
  assert.equal(availableLooseGoodAmount(stack), 1);
  assert.equal(reserveLooseGood(world, stack.id), true);

  assert.equal(pickupReservedLooseGood(world, stack.id), true);
  assert.equal(stack.amount, 1);
  assert.equal(stack.reserved, 1);
  assert.equal(pickupReservedLooseGood(world, stack.id), true);
  assert.equal(looseGoodStacks(world).length, 0);
});

test("drop search prefers a compatible partial stack before a nearer empty cell", () => {
  const world = makeWorld();
  const existing = placeLooseGood(world, { q: 2, r: 0 }, "wood", 1)!;

  const target = findLooseGoodDropPosition(world, { q: 0, r: 0 }, "wood", 3);

  assert.deepEqual(target, existing.position);
});

test("new drop cells are deterministic, free of resources, and never use blocked terrain", () => {
  const world = makeWorld();
  world.naturalResources.push({
    id: "tree-1",
    kind: "forest",
    position: { q: -1, r: 0 },
    remaining: 1,
    output: 0,
  });
  world.tiles.find((tile) => tile.q === 0 && tile.r === -1)!.terrain = "river";
  world.tiles.find((tile) => tile.q === 1 && tile.r === -1)!.terrain = "building";

  const target = findLooseGoodDropPosition(world, { q: 0, r: 0 }, "wood", 2)!;

  assert.deepEqual(target, { q: 0, r: 0 });
  assert.equal(canPlaceLooseGoodAt(world, target, "wood"), true);
  assert.equal(canPlaceLooseGoodAt(world, { q: -1, r: 0 }, "wood"), false);
  assert.equal(canPlaceLooseGoodAt(world, { q: 0, r: -1 }, "wood"), false);
});
