import test from "node:test";
import assert from "node:assert/strict";
import { createDefaultGameWorld, createWorld } from "../src/simulation/scenario";
import { advanceHungerTick } from "../src/simulation/needs";
import { setRoad } from "../src/simulation/simulation";
import { bushRevision, terrainRevision } from "../src/simulation/worldRevisions";

test("manual road changes advance the terrain revision", () => {
  const world = createWorld();
  const target = world.tiles.find((tile) => {
    if (tile.terrain !== "grass") return false;
    const before = terrainRevision(world);
    const placed = setRoad(world, tile, true);
    if (!placed) return false;
    assert.equal(terrainRevision(world), before + 1);
    return true;
  });

  assert.ok(target, "expected a valid road cell");
  const beforeRemoval = terrainRevision(world);
  assert.equal(setRoad(world, target, false), true);
  assert.equal(terrainRevision(world), beforeRemoval + 1);
});

test("bush consumption/regrowth state advances the bush revision", () => {
  const world = createDefaultGameWorld();
  const bush = world.tiles.find((tile) => tile.bush && tile.bushAvailable);
  assert.ok(bush);

  bush.bushAvailable = false;
  bush.bushRegrowTick = world.round;
  world.nextBushRegrowTick = world.round;
  const before = bushRevision(world);

  advanceHungerTick(world);

  assert.equal(bush.bushAvailable, true);
  assert.equal(bushRevision(world), before + 1);
});
