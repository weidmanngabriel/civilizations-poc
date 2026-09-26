import test from "node:test";
import assert from "node:assert/strict";
import { CONFIG, createWorld } from "../src/simulation/scenario";
import { advanceSleepTick, SLEEP_RULES } from "../src/simulation/sleep";
import { tick } from "../src/simulation/simulation";
import type { Building, World } from "../src/simulation/model";
import { assignPersonHome } from "../src/simulation/housing";

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

const removeNatureSleepTargets = (world: World): void => {
  world.naturalResources = [];
  for (const tile of world.tiles) {
    if (tile.terrain === "forest") tile.terrain = "grass";
    tile.resourceBlocking = undefined;
    tile.bush = undefined;
    tile.bushAvailable = undefined;
  }
};

const sleepForFullDuration = (world: World): void => {
  for (let i = 0; i < SLEEP_RULES.durationTicks; i += 1) advanceSleepTick(world);
};

test("sleep decays slower while idle than walking or working", () => {
  const world = createWorld(1);
  const person = world.people[0]!;

  for (let i = 0; i < 16 * 60; i += 1) advanceSleepTick(world);
  assert.equal(person.sleep, 99);

  person.path = [{ q: person.position.q + 1, r: person.position.r }];
  for (let i = 0; i < 8 * 60; i += 1) advanceSleepTick(world);
  assert.equal(person.sleep, 98);

  person.path = [];
  person.progress = 1;
  for (let i = 0; i < 4 * 60; i += 1) advanceSleepTick(world);
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

test("sleep keeps the workplace assignment while pausing production", () => {
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
  assert.equal(person.assignment?.building, workplace.id);
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

test("sleep keeps autonomous profession and resource assignment visible", () => {
  const world = createWorld(1);
  const person = world.people[0]!;
  const resource = world.naturalResources.find((candidate) => candidate.kind === "forest")!;

  person.woodcutter = true;
  person.resourceTarget = resource.id;
  person.active = true;
  person.sleep = 20;

  advanceSleepTick(world);

  assert.ok(person.sleepState);
  assert.equal(person.woodcutter, true);
  assert.equal(person.resourceTarget, resource.id);
});

test("a tired sawmill worker does not start resupply after finishing the current cycle", () => {
  const world = createWorld(1);
  const person = world.people[0]!;
  const sawmill: Building = {
    id: "test-sawmill-boundary",
    kind: "sawmill",
    name: "Testsägewerk",
    position: { ...person.position },
    workers: 1,
    carriers: 0,
    input: 2,
    output: 0,
    recipe: { input: "wood", amount: 2, output: "plank", duration: CONFIG.duration },
  };
  const warehouse: Building = {
    id: "test-wood-source",
    kind: "warehouse",
    name: "Testlager",
    position: { ...person.position },
    workers: 0,
    carriers: 0,
    merchants: 0,
    input: 0,
    output: 0,
    inventory: { wood: 5 },
  };
  world.buildings.push(sawmill, warehouse);
  person.assignment = { building: sawmill.id, role: "worker" };
  person.active = true;
  person.progress = CONFIG.duration - 1;
  person.sleep = 40;

  tick(world);

  assert.ok(sawmill.output >= 1);
  assert.equal(person.progress, 0);
  assert.equal(person.trip, undefined);

  tick(world);

  assert.ok(person.sleepState);
  assert.equal(person.assignment?.building, sawmill.id);
});

test("assigned residents choose their own home over a closer nature sleep target", () => {
  const world = createWorld(1);
  const person = world.people[0]!;
  removeNatureSleepTargets(world);
  const bush = world.tiles.find(
    (tile) =>
      tile.terrain === "grass" &&
      tile.q === person.position.q &&
      tile.r === person.position.r,
  )!;
  bush.bush = true;
  bush.bushAvailable = true;
  const house = addHouse(world, 20);
  assert.equal(assignPersonHome(world, person.id, house.id), true);
  person.sleep = 20;

  advanceSleepTick(world);

  assert.equal(person.sleepState?.kind, "house");
  assert.deepEqual(person.sleepState?.target, house.position);
});

test("stone extractor keeps an active sleep route instead of returning to its resource", () => {
  const world = createWorld(1);
  const person = world.people[0]!;
  const stone = world.naturalResources.find((resource) => resource.kind === "stone");
  assert.ok(stone);

  removeNatureSleepTargets(world);
  world.naturalResources = [stone];
  const bush = nearbyGrassTile(world);
  bush.bush = true;
  bush.bushAvailable = true;

  person.extractor = "stone";
  person.resourceTarget = stone.id;
  person.workArea = { center: { ...stone.position }, radius: 13 };
  person.active = false;
  person.path = [];
  person.sleep = 20;

  advanceSleepTick(world);
  assert.equal(person.sleepState?.kind, "nature");
  assert.deepEqual(person.sleepState?.target, { q: bush.q, r: bush.r });

  waitForSleepProgress(world);
});

test("house sleep restores 50 sleep points per five-second phase up to 100", () => {
  const world = createWorld(1);
  const person = world.people[0]!;
  const house = addHouse(world);
  assert.equal(assignPersonHome(world, person.id, house.id), true);
  person.sleep = 20;

  advanceSleepTick(world);
  assert.equal(person.sleepState?.kind, "house");
  person.position = { ...house.position };
  person.path = [];

  for (let i = 0; i < SLEEP_RULES.phaseTicks; i += 1) advanceSleepTick(world);
  assert.equal(person.sleep, 70);
  assert.equal(person.sleepState?.completedPhases, 1);

  for (let i = SLEEP_RULES.phaseTicks; i < SLEEP_RULES.durationTicks; i += 1)
    advanceSleepTick(world);
  assert.equal(person.sleepState, undefined);
  assert.equal(person.sleep, 100);
});

test("a tree or bush restores 15 sleep points per five-second phase", () => {
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

  for (let i = 0; i < SLEEP_RULES.phaseTicks; i += 1) advanceSleepTick(world);
  assert.equal(person.sleep, 35);
  assert.ok(person.sleepState);

  for (let i = SLEEP_RULES.phaseTicks; i < SLEEP_RULES.durationTicks; i += 1)
    advanceSleepTick(world);
  assert.equal(person.sleepState, undefined);
  assert.equal(person.sleep, 50);
});

test("ground sleep restores 5 sleep points per five-second phase", () => {
  const world = createWorld(1);
  const person = world.people[0]!;
  removeNatureSleepTargets(world);
  person.sleep = 20;

  advanceSleepTick(world);
  assert.equal(person.sleepState?.kind, "ground");

  for (let i = 0; i < SLEEP_RULES.phaseTicks; i += 1) advanceSleepTick(world);
  assert.equal(person.sleep, 25);
  assert.ok(person.sleepState);

  for (let i = SLEEP_RULES.phaseTicks; i < SLEEP_RULES.durationTicks; i += 1)
    advanceSleepTick(world);
  assert.equal(person.sleepState, undefined);
  assert.equal(person.sleep, 30);
});

test("sleep places outside eight reachable steps are ignored", () => {
  const world = createWorld(1);
  const person = world.people[0]!;
  removeNatureSleepTargets(world);
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

const addSleepRegressionWorkplace = (world: World): Building => {
  const person = world.people[0]!;
  const workplace: Building = {
    id: "sleep-arrival-workplace",
    kind: "sawmill",
    name: "Schlaf-Test-Arbeitsstätte",
    position: { ...person.position },
    workers: 1,
    carriers: 0,
    input: 2,
    output: 0,
    recipe: { input: "wood", amount: 2, output: "plank", duration: CONFIG.duration },
  };
  world.buildings.push(workplace);
  person.assignment = { building: workplace.id, role: "worker" };
  person.active = true;
  person.progress = 0;
  person.sleep = 20;
  return workplace;
};

const nearbyGrassTile = (world: World) => {
  const person = world.people[0]!;
  return world.tiles.find(
    (tile) =>
      tile.terrain === "grass" &&
      Math.abs(tile.q - person.position.q) <= 6 &&
      Math.abs(tile.r - person.position.r) <= 6 &&
      (tile.q !== person.position.q || tile.r !== person.position.r),
  )!;
};

const waitForSleepProgress = (world: World): void => {
  const person = world.people[0]!;
  for (let i = 0; i < 600 && (person.sleepState?.progress ?? 0) === 0; i += 1) tick(world);
  assert.ok((person.sleepState?.progress ?? 0) > 0, "person should begin sleeping after reaching the nature target");
  assert.equal(person.path.length, 0, "active sleep must not be replaced by a route back to work");
};

test("assigned worker reaches a bush and starts sleeping instead of returning to work", () => {
  const world = createWorld(1);
  const person = world.people[0]!;
  removeNatureSleepTargets(world);
  addSleepRegressionWorkplace(world);
  const bush = nearbyGrassTile(world);
  bush.bush = true;
  bush.bushAvailable = true;

  advanceSleepTick(world);
  assert.equal(person.sleepState?.kind, "nature");
  assert.deepEqual(person.sleepState?.target, { q: bush.q, r: bush.r });
  assert.ok(person.path.length > 0);

  waitForSleepProgress(world);
});

test("assigned worker reaches a blocking tree and starts sleeping instead of returning to work", () => {
  const world = createWorld(1);
  const person = world.people[0]!;
  removeNatureSleepTargets(world);
  addSleepRegressionWorkplace(world);
  const treeTile = nearbyGrassTile(world);
  treeTile.resourceBlocking = true;
  world.naturalResources.push({
    id: "sleep-arrival-tree",
    kind: "forest",
    position: { q: treeTile.q, r: treeTile.r },
    remaining: 3,
    output: 0,
  });

  advanceSleepTick(world);
  assert.equal(person.sleepState?.kind, "nature");
  assert.deepEqual(person.sleepState?.target, { q: treeTile.q, r: treeTile.r });
  assert.ok(person.path.length > 0);

  waitForSleepProgress(world);
});
