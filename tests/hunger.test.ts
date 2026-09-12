import test from "node:test";
import assert from "node:assert/strict";
import { CONFIG, createWorld } from "../src/simulation/scenario";
import { advanceHungerTick } from "../src/simulation/needs";
import { tick } from "../src/simulation/simulation";
import type { Building, World } from "../src/simulation/model";

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

test("hunger decays at idle, walking and active-work rates", () => {
  const world = createWorld(1);
  const person = world.people[0]!;

  for (let i = 0; i < 4 * 60; i += 1) advanceHungerTick(world);
  assert.equal(person.hunger, 99);

  person.path = [{ q: person.position.q + 1, r: person.position.r }];
  for (let i = 0; i < 2 * 60; i += 1) advanceHungerTick(world);
  assert.equal(person.hunger, 98);

  person.trip = { source: "a", target: "b", good: "wood", picked: true };
  for (let i = 0; i < 60; i += 1) advanceHungerTick(world);
  assert.equal(person.hunger, 97);
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
  assert.equal(person.hunger, 100);
  assert.equal(person.hungerState, undefined);
  assert.equal(warehouse.inventory?.bread, 0);
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
  const woodSource: Building = {
    id: "test-wood",
    kind: "forest",
    name: "Testholz",
    position: { q: hq.position.q + 3, r: hq.position.r },
    workers: 0,
    carriers: 0,
    input: 0,
    output: 3,
    forestRemaining: 10,
    recipe: { amount: 0, output: "wood", duration: 240 },
  };
  world.buildings.push(sawmill, woodSource);
  person.assignment = { building: sawmill.id, role: "worker" };
  person.position = { ...sawmill.position };
  person.active = true;
  person.progress = 239;
  person.hunger = 40;

  tick(world);
  assert.equal(person.progress, 0);
  assert.equal(person.trip, undefined);

  tick(world);
  assert.ok(person.hungerState);
  assert.equal(person.hungerState?.foodSource, warehouse.id);
});

test("critical hunger pauses immediately and keeps work progress", () => {
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
  assert.equal(person.hunger, 100);
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
