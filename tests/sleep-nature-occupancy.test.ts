import test from "node:test";
import assert from "node:assert/strict";
import { createWorld } from "../src/simulation/scenario";
import { advanceSleepTick } from "../src/simulation/sleep";
import type { Hex, World } from "../src/simulation/model";

const removeNatureSleepTargets = (world: World): void => {
  world.naturalResources = [];
  for (const tile of world.tiles) {
    tile.resourceBlocking = undefined;
    tile.bush = undefined;
    tile.bushAvailable = undefined;
  }
};

const nearbyGrass = (world: World): Hex => {
  const origin = world.people[0]!.position;
  const tile = world.tiles.find(
    (candidate) =>
      candidate.terrain === "grass" &&
      Math.abs(candidate.q - origin.q) <= 6 &&
      Math.abs(candidate.r - origin.r) <= 6 &&
      (candidate.q !== origin.q || candidate.r !== origin.r),
  )!;
  return { q: tile.q, r: tile.r };
};

const startBothTowardSameNatureTarget = (world: World, target: Hex): void => {
  for (const person of world.people) person.sleep = 20;
  advanceSleepTick(world);
  for (const person of world.people) {
    assert.equal(person.sleepState?.kind, "nature");
    assert.deepEqual(person.sleepState?.target, target);
  }
};

const arriveTogether = (world: World, target: Hex): void => {
  for (const person of world.people) {
    person.position = { ...target };
    person.path = [];
  }
  advanceSleepTick(world);
};

test("two people may target the same bush, but only one sleeps there after arrival", () => {
  const world = createWorld(2);
  removeNatureSleepTargets(world);
  const target = nearbyGrass(world);
  const bush = world.tiles.find((tile) => tile.q === target.q && tile.r === target.r)!;
  bush.bush = true;
  bush.bushAvailable = true;

  startBothTowardSameNatureTarget(world, target);
  arriveTogether(world, target);

  assert.equal(world.people[0]!.sleepState?.kind, "nature");
  assert.ok((world.people[0]!.sleepState?.progress ?? 0) > 0);
  assert.equal(world.people[1]!.sleepState?.kind, "ground");
  assert.deepEqual(world.people[1]!.sleepState?.target, target);
  assert.equal(world.people[1]!.sleepState?.progress, 0);
});

test("two people may target the same tree, but the second continues after finding it occupied", () => {
  const world = createWorld(2);
  removeNatureSleepTargets(world);
  const target = nearbyGrass(world);
  world.naturalResources.push({
    id: "shared-sleep-tree",
    kind: "forest",
    position: { ...target },
    remaining: 3,
    output: 0,
  });

  startBothTowardSameNatureTarget(world, target);
  arriveTogether(world, target);

  assert.equal(world.people[0]!.sleepState?.kind, "nature");
  assert.ok((world.people[0]!.sleepState?.progress ?? 0) > 0);
  assert.equal(world.people[1]!.sleepState?.kind, "ground");
});

test("ground sleep has no exclusive occupancy", () => {
  const world = createWorld(2);
  removeNatureSleepTargets(world);
  const target = { ...world.people[0]!.position };
  world.people[1]!.position = { ...target };
  for (const person of world.people) person.sleep = 20;

  advanceSleepTick(world);
  advanceSleepTick(world);

  for (const person of world.people) {
    assert.equal(person.sleepState?.kind, "ground");
    assert.ok((person.sleepState?.progress ?? 0) > 0);
  }
});
