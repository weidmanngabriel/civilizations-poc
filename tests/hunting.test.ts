import assert from "node:assert/strict";
import test from "node:test";
import { hunterHitChance, advanceHunting } from "../src/simulation/hunting";
import { setPersonProfession } from "../src/simulation/personCommands";
import { createWorld, CONFIG } from "../src/simulation/scenario";
import { HUNTER_WORK_AREA_RADIUS } from "../src/simulation/workAreas";
import {
  advanceWildlife,
  frightenAnimalGroup,
  spawnAnimalGroup,
} from "../src/simulation/wildlife";

const firstGrass = (world: ReturnType<typeof createWorld>) =>
  world.tiles.find((tile) => tile.terrain === "grass" && !tile.resourceBlocking && !tile.buildingBlocking)!;

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
