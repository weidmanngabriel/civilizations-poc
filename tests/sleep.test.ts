import test from "node:test";
import assert from "node:assert/strict";
import { createWorld } from "../src/simulation/scenario";
import { advanceSleepTick, SLEEP_RULES } from "../src/simulation/sleep";
import { tick } from "../src/simulation/simulation";
import type { Building, World } from "../src/simulation/model";

const addHouse = (world: World, qOffset = 2): Building => {
  const person = world.people[0]!;
  const house: Building = {
    id: "test-house",
    kind: "house",
    name: "Wohnhaus",
    position: { q: person.position.q + qOffset, r: person.position.r },
    workers: 0,
    carriers: 0,
    merchants: 0,
    input: 0,
    output: 0,
  };
  world.buildings.push(house);
  return house;
};

const sleepForFullDuration = (world: World): void => {
  for (let i = 0; i < SLEEP_RULES.durationTicks; i += 1) advanceSleepTick(world);
};

test("sleep decays slower while idle than walking or working", () => {
  const world = createWorld(1);
  const person = world.people[0]!;

  for (let i = 0; i < 8 * 60; i += 1) advanceSleepTick(world);
  assert.equal(person.sleep, 99);

  person.path = [{ q: person.position.q + 1, r: person.position.r }];
  for (let i = 0; i < 4 * 60; i += 1) advanceSleepTick(world);
  assert.equal(person.sleep, 98);

  person.path = [];
  person.progress = 1;
  for (let i = 0; i < 2 * 60; i += 1) advanceSleepTick(world);
  assert.equal(person.sleep, 97);
});

test("a tired person finishes current work at 40 before sleeping", () => {
  const world = createWorld(1);
  const person = world.people[0]!;
  person.sleep = 40;
  person.progress = 30;
  person.active = true;

  advanceSleepTick(world);
  assert.equal(person.sleepState, undefined);
  assert.equal(person.progress, 30);

  person.progress = 0;
  advanceSleepTick(world);
  assert.ok(person.sleepState);
  assert.equal(person.active, false);
});

test("critical tiredness interrupts immediately and preserves work progress", () => {
  const world = createWorld(1);
  const person = world.people[0]!;
  person.sleep = 20;
  person.progress = 72;
  person.active = true;

  advanceSleepTick(world);

  assert.ok(person.sleepState);
  assert.equal(person.active, false);
  assert.equal(person.progress, 72);
});

test("sleep temporarily removes a workplace assignment so production cannot continue", () => {
  const world = createWorld(1);
  const person = world.people[0]!;
  const workplace: Building = {
    id: "test-sawmill",
    kind: "sawmill",
    name: "Testsägewerk",
    position: { ...person.position },
    workers: 1,
    carriers: 0,
    input: 2,
    output: 0,
    recipe: { input: "wood", amount: 2, output: "plank", duration: 240 },
  };
  world.buildings.push(workplace);
  person.assignment = { building: workplace.id, role: "worker" };
  person.active = true;
  person.progress = 72;
  person.sleep = 20;

  advanceSleepTick(world);
  assert.equal(person.assignment, undefined);
  assert.equal(person.sleepState?.resumeAssignment?.building, workplace.id);

  const preservedProgress = person.progress;
  tick(world);
  assert.equal(person.progress, preservedProgress);

  const sleepTarget = person.sleepState!.target;
  person.position = { ...sleepTarget };
  person.path = [];
  person.sleepState!.progress = SLEEP_RULES.durationTicks - 1;
  advanceSleepTick(world);

  assert.equal(person.assignment?.building, workplace.id);
  assert.equal(person.progress, preservedProgress);
});

test("a completed house is preferred and restores sleep fully", () => {
  const world = createWorld(1);
  const person = world.people[0]!;
  const house = addHouse(world);
  person.sleep = 20;

  advanceSleepTick(world);
  assert.equal(person.sleepState?.kind, "house");

  person.position = { ...house.position };
  person.path = [];
  sleepForFullDuration(world);

  assert.equal(person.sleepState, undefined);
  assert.equal(person.sleep, 100);
});

test("a tree or bush restores 40 sleep points", () => {
  const world = createWorld(1);
  const person = world.people[0]!;
  const natureTile = world.tiles.find((tile) => tile.terrain === "grass" && tile.q !== person.position.q)!;
  person.position = { q: natureTile.q, r: natureTile.r };
  natureTile.bush = true;
  natureTile.bushAvailable = true;
  person.sleep = 20;

  advanceSleepTick(world);
  assert.equal(person.sleepState?.kind, "nature");
  assert.deepEqual(person.sleepState?.target, person.position);

  sleepForFullDuration(world);

  assert.equal(person.sleepState, undefined);
  assert.equal(person.sleep, 60);
});

test("sleeping on the ground restores 20 sleep points", () => {
  const world = createWorld(1);
  const person = world.people[0]!;
  for (const tile of world.tiles) {
    if (tile.terrain === "forest") tile.terrain = "grass";
    tile.bush = undefined;
    tile.bushAvailable = undefined;
  }
  person.sleep = 20;

  advanceSleepTick(world);
  assert.equal(person.sleepState?.kind, "ground");

  sleepForFullDuration(world);

  assert.equal(person.sleepState, undefined);
  assert.equal(person.sleep, 40);
});

test("sleep places outside eight reachable steps are ignored", () => {
  const world = createWorld(1);
  const person = world.people[0]!;
  for (const tile of world.tiles) {
    if (tile.terrain === "forest") tile.terrain = "grass";
    tile.bush = undefined;
    tile.bushAvailable = undefined;
  }
  addHouse(world, SLEEP_RULES.radiusSteps + 3);
  person.sleep = 20;

  advanceSleepTick(world);

  assert.equal(person.sleepState?.kind, "ground");
});

test("hunger has priority when hunger and sleep are both due", () => {
  const world = createWorld(1);
  const person = world.people[0]!;
  person.hunger = 20;
  person.sleep = 20;

  advanceSleepTick(world);

  assert.equal(person.sleepState, undefined);
});
