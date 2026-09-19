import assert from "node:assert/strict";
import test from "node:test";
import { hunterHitChance, advanceHunting } from "../src/simulation/hunting";
import { setPersonProfession } from "../src/simulation/personCommands";
import { createWorld, CONFIG } from "../src/simulation/scenario";
import { HUNTER_WORK_AREA_RADIUS } from "../src/simulation/workAreas";
import { hexDistance } from "../src/simulation/spatial";
import {
  advanceWildlife,
  animalGroupCenter,
  frightenAnimalGroup,
  spawnAnimalGroup,
} from "../src/simulation/wildlife";

const firstGrass = (world: ReturnType<typeof createWorld>) =>
  world.tiles.find((tile) => tile.terrain === "grass" && !tile.resourceBlocking && !tile.buildingBlocking)!;

const centralGrass = (world: ReturnType<typeof createWorld>) => {
  const qMid = Math.round((Math.min(...world.tiles.map((tile) => tile.q)) + Math.max(...world.tiles.map((tile) => tile.q))) / 2);
  const rMid = Math.round((Math.min(...world.tiles.map((tile) => tile.r)) + Math.max(...world.tiles.map((tile) => tile.r))) / 2);
  return world.tiles
    .filter((tile) => tile.terrain === "grass" && !tile.resourceBlocking && !tile.buildingBlocking)
    .sort(
      (a, b) =>
        hexDistance(a, { q: qMid, r: rMid }) - hexDistance(b, { q: qMid, r: rMid }) ||
        a.q - b.q ||
        a.r - b.r,
    )[0]!;
};

test("hunter hit chance scales with experience and fleeing halves it", () => {
  const world = createWorld(1);
  const hunter = world.people[0]!;
  assert.equal(hunterHitChance(hunter, false), 0.2);
  assert.equal(hunterHitChance(hunter, true), 0.1);

  hunter.experience = { hunter: 100 };
  assert.equal(hunterHitChance(hunter, false), 0.95);
  assert.equal(hunterHitChance(hunter, true), 0.475);
});

test("hunter gets a work area twice as large as normal outdoor workers", () => {
  const world = createWorld(1);
  const hunter = world.people[0]!;
  hunter.position = { ...firstGrass(world) };

  assert.equal(setPersonProfession(world, hunter.id, "hunter"), true);
  assert.equal(hunter.workArea?.radius, HUNTER_WORK_AREA_RADIUS);
});

test("a shot frightens every animal in the group for five seconds", () => {
  const world = createWorld(0);
  const home = firstGrass(world);
  const group = spawnAnimalGroup(world, "hare", home, 3)!;

  frightenAnimalGroup(world, group.id, home);
  const members = world.animals!.filter((animal) => animal.groupId === group.id);
  assert.equal(members.length, 3);
  for (const animal of members) {
    assert.equal(animal.fleeingUntilTick, 5 * CONFIG.simulationHz);
    assert.ok(animal.path.length > 0);
  }

  world.round = 5 * CONFIG.simulationHz;
  advanceWildlife(world);
  for (const animal of members) assert.equal(animal.fleeingUntilTick, undefined);
});

test("hunter gains experience only when the projectile actually kills wildlife", () => {
  const world = createWorld(1);
  const hunter = world.people[0]!;
  const home = firstGrass(world);
  hunter.position = { ...home };
  assert.equal(setPersonProfession(world, hunter.id, "hunter"), true);

  const group = spawnAnimalGroup(world, "hare", home, 1)!;
  const animal = world.animals!.find((candidate) => candidate.groupId === group.id)!;
  animal.position = { ...home };

  world.rngState = 1972;
  advanceHunting(world);
  assert.equal(world.projectiles?.length, 1);
  assert.equal(hunter.experience?.hunter ?? 0, 0);

  for (let i = 0; i < Math.ceil(0.5 * CONFIG.simulationHz); i += 1) {
    world.round += 1;
    advanceHunting(world);
  }

  assert.equal(world.animals?.length, 0);
  assert.equal(hunter.experience?.hunter, 1);
});


test("wildlife groups pick a gentle migration target every thirty seconds", () => {
  const world = createWorld(0);
  const home = firstGrass(world);
  const group = spawnAnimalGroup(world, "hare", home, 3)!;
  const centerBefore = animalGroupCenter(world, group.id)!;

  group.nextTargetTick = world.round;
  advanceWildlife(world);

  assert.ok(group.target);
  const distance = hexDistance(centerBefore, group.target!);
  assert.ok(distance >= 10 && distance <= 15);
  assert.equal(group.nextTargetTick, 30 * CONFIG.simulationHz);
});


test("hare groups spawn loosely and never share a micro-cell while roaming", () => {
  const world = createWorld(0);
  const home = firstGrass(world);
  const group = spawnAnimalGroup(world, "hare", home, 4)!;
  const members = world.animals!.filter((animal) => animal.groupId === group.id);

  for (let i = 0; i < members.length; i += 1)
    for (let j = i + 1; j < members.length; j += 1)
      assert.ok(hexDistance(members[i]!.position, members[j]!.position) >= 2);

  for (let tick = 0; tick < 45 * CONFIG.simulationHz; tick += 1) {
    world.round += 1;
    advanceWildlife(world);
    const positions = members.map((animal) => `${animal.position.q},${animal.position.r}`);
    assert.equal(new Set(positions).size, positions.length);
  }
});


test("hare group migration develops sustained drift over several minutes", () => {
  const world = createWorld(0);
  const home = centralGrass(world);
  const group = spawnAnimalGroup(world, "hare", home, 4)!;
  const startCenter = animalGroupCenter(world, group.id)!;
  let maxDistance = 0;

  for (let tick = 0; tick < 4 * 60 * CONFIG.simulationHz; tick += 1) {
    world.round += 1;
    advanceWildlife(world);
    if (tick % CONFIG.simulationHz === 0) {
      const center = animalGroupCenter(world, group.id)!;
      maxDistance = Math.max(maxDistance, hexDistance(startCenter, center));
    }
  }

  assert.ok(
    maxDistance >= 12,
    `expected migrating group center to leave the spawn area, max distance was ${maxDistance}`,
  );
});
