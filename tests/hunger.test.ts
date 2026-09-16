import test from "node:test";
import assert from "node:assert/strict";
import { CONFIG, createWorld } from "../src/simulation/scenario";
import { advanceHungerTick } from "../src/simulation/needs";
import { tick } from "../src/simulation/simulation";
import type { Building, NaturalResource, World } from "../src/simulation/model";

const addBreadWarehouse = (world: World, bread = 1): Building => {
  const hq = world.buildings.find((building) => building.id === "hq")!;
  const warehouse: Building = {
    id: "food-warehouse",
    kind: "warehouse",
    name: "Essenslager",
    position: { q: hq.position.q + 2, r: hq.position.r },
    workers: 0,
    carriers: 0,
    merchants: 0,
    input: 0,
    output: 0,
    inventory: { bread },
  };
  world.buildings.push(warehouse);
  return warehouse;
};

test("hunger decays at idle, walking and active-work rates in one-second steps", () => {
  const world = createWorld(1);
  const person = world.people[0]!;

  for (let i = 0; i < 4; i += 1) advanceHungerTick(world);
  assert.equal(person.hunger, 99);

  person.path = [{ q: person.position.q + 1, r: person.position.r }];
  for (let i = 0; i < 2; i += 1) advanceHungerTick(world);
  assert.equal(person.hunger, 98);

  person.trip = { source: "a", target: "b", good: "wood", picked: true };
  advanceHungerTick(world);
  assert.equal(person.hunger, 97);
});

test("normal simulation checks hunger only once per second", () => {
  const world = createWorld(1);
  const person = world.people[0]!;
  person.hunger = 20;
  addBreadWarehouse(world);

  for (let i = 0; i < CONFIG.simulationHz - 1; i += 1) tick(world);
  assert.equal(person.hungerState, undefined);

  tick(world);
  assert.ok(person.hungerState);
});

test("a hungry person finishes current work before eating at 40", () => {
  const world = createWorld(1);
  const person = world.people[0]!;
  const warehouse = addBreadWarehouse(world);
  person.hunger = 40;
  person.progress = 30;
  person.active = true;

  advanceHungerTick(world);
  assert.equal(person.hungerState, undefined);
  assert.equal(person.progress, 30);

  person.progress = 0;
  advanceHungerTick(world);
  assert.ok(person.hungerState);
  assert.equal(person.active, false);
  assert.ok(person.path.length > 0);

  person.position = { ...warehouse.position };
  person.path = [];
  advanceHungerTick(world);
  assert.equal(person.hunger, 139);
  assert.equal(person.hungerState, undefined);
  assert.equal(warehouse.inventory?.bread, 0);
});

test("food recovery is not capped at 100", () => {
  const world = createWorld(1);
  const person = world.people[0]!;
  const bush = world.tiles.find((tile) => tile.terrain === "grass")!;
  person.position = { q: bush.q, r: bush.r };
  person.path = [];
  person.hunger = 90;
  person.hungerState = {
    resumeActive: false,
    foodBush: { q: bush.q, r: bush.r },
  };
  bush.bush = true;
  bush.bushAvailable = true;

  advanceHungerTick(world);

  assert.equal(person.hunger, 130);
  assert.equal(person.hungerState, undefined);
  assert.equal(bush.bushAvailable, false);
});

test("a hungry person keeps the selected route without revalidating food while travelling", () => {
  const world = createWorld(1);
  const person = world.people[0]!;
  const warehouse = addBreadWarehouse(world);
  person.hunger = 20;

  advanceHungerTick(world);
  assert.ok(person.hungerState);
  assert.ok(person.path.length > 0);
  const route = person.path;

  warehouse.inventory!.bread = 0;
  advanceHungerTick(world);

  assert.strictEqual(person.path, route);
  assert.equal(person.hungerState?.foodSource, warehouse.id);

  person.position = { ...warehouse.position };
  person.path = [];
  advanceHungerTick(world);

  assert.equal(person.hungerState?.foodSource, undefined);
  assert.equal(person.path.length, 0);
  assert.ok((person.hungerState?.retryAfterTick ?? 0) > world.round);
});

test("failed food searches are throttled to the normal decision cadence", () => {
  const world = createWorld(1);
  const person = world.people[0]!;
  person.hunger = 20;

  advanceHungerTick(world);
  const retryAfter = person.hungerState?.retryAfterTick;
  assert.ok(retryAfter !== undefined);
  assert.equal(person.path.length, 0);

  const bush = world.tiles.find((tile) => tile.terrain === "grass" && tile.q !== person.position.q)!;
  bush.bush = true;
  bush.bushAvailable = true;

  advanceHungerTick(world);
  assert.equal(person.hungerState?.foodBush, undefined);

  world.round = retryAfter!;
  advanceHungerTick(world);
  assert.ok(person.hungerState?.foodBush);
});

test("light hunger prevents a new task after the current production cycle", () => {
  const world = createWorld(1);
  const person = world.people[0]!;
  const hq = world.buildings.find((building) => building.id === "hq")!;
  const warehouse = addBreadWarehouse(world);
  const sawmill: Building = {
    id: "test-sawmill",
    kind: "sawmill",
    name: "Testsägewerk",
    position: { q: hq.position.q + 1, r: hq.position.r },
    workers: 1,
    carriers: 0,
    input: 2,
    output: 0,
    recipe: { input: "wood", amount: 2, output: "plank", duration: 240 },
  };
  const woodSource: NaturalResource = {
    id: "test-wood",
    kind: "forest",
    position: { q: hq.position.q + 3, r: hq.position.r },
    remaining: 10,
    output: 3,
  };
  world.buildings.push(sawmill);
  world.naturalResources.push(woodSource);
  person.assignment = { building: sawmill.id, role: "worker" };
  person.position = { ...sawmill.position };
  person.active = true;
  person.progress = 239;
  person.hunger = 40;

  tick(world);
  assert.equal(person.progress, 0);
  assert.equal(person.trip, undefined);

  for (let i = 1; i < CONFIG.simulationHz; i += 1) tick(world);
  assert.ok(person.hungerState);
  assert.equal(person.hungerState?.foodSource, warehouse.id);
});

test("critical hunger pauses at the next one-second check and keeps work progress", () => {
  const world = createWorld(1);
  const person = world.people[0]!;
  const warehouse = addBreadWarehouse(world);
  person.hunger = 20;
  person.progress = 72;
  person.active = true;

  advanceHungerTick(world);
  assert.ok(person.hungerState);
  assert.equal(person.active, false);
  assert.equal(person.progress, 72);

  person.position = { ...warehouse.position };
  person.path = [];
  advanceHungerTick(world);
  assert.equal(person.hunger, 119);
  assert.equal(person.progress, 72);
});

test("critical hunger blocks work while no food is reachable", () => {
  const world = createWorld(1);
  const person = world.people[0]!;
  person.hunger = 20;
  person.progress = 45;
  person.active = true;

  advanceHungerTick(world);

  assert.ok(person.hungerState);
  assert.equal(person.hungerState?.foodSource, undefined);
  assert.equal(person.hungerState?.foodBush, undefined);
  assert.equal(person.active, false);
  assert.equal(person.progress, 45);
  assert.equal(person.path.length, 0);
  assert.ok((person.hungerState?.retryAfterTick ?? 0) >= CONFIG.decisionIntervalTicks);
});

test("worker eats immediately on HQ arrival before returning to work", () => {
  const world = createWorld(1);
  const person = world.people[0]!;
  const hq = world.buildings.find((building) => building.id === "hq")!;
  hq.inventory ??= {};
  hq.inventory.bread = 1;

  const workplace: Building = {
    id: "hq-food-regression-workplace",
    kind: "sawmill",
    name: "Arbeitsstätte",
    position: { q: hq.position.q + 8, r: hq.position.r },
    workers: 1,
    carriers: 0,
    input: 0,
    output: 0,
    recipe: { input: "wood", amount: 2, output: "plank", duration: 240 },
  };
  world.buildings.push(workplace);
  person.assignment = { building: workplace.id, role: "worker" };
  person.position = { ...workplace.position };
  person.active = false;
  person.progress = 0;
  person.path = [];
  person.hunger = 20;

  advanceHungerTick(world);
  assert.equal(person.hungerState?.foodSource, hq.id);
  assert.ok(person.path.length > 0);

  let arrivalTick = -1;
  for (let i = 0; i < 300; i += 1) {
    tick(world);
    if (person.hungerState === undefined) {
      arrivalTick = i;
      break;
    }
  }

  assert.ok(arrivalTick >= 0, "person should eat after reaching the HQ");
  assert.equal(hq.inventory.bread, 0);
  assert.equal(person.hunger, 120);
  assert.ok(person.path.length > 0, "person should resume the route to the workplace after eating");
});
