import test from "node:test";
import assert from "node:assert/strict";
import { createWorld } from "../src/simulation/scenario";
import { advanceHungerTick } from "../src/simulation/needs";
import type { Building, World } from "../src/simulation/model";

const addBreadWarehouse = (world: World, bread = 1): Building => {
  const hq = world.buildings.find((building) => building.id === "hq")!;
  const warehouse: Building = {
    id: "food-warehouse",
    kind: "warehouse",
    name: "Essenslager",
    position: { ...hq.position },
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

  advanceHungerTick(world);
  assert.equal(person.hunger, 100);
  assert.equal(person.hungerState, undefined);
  assert.equal(warehouse.inventory?.bread, 0);
});

test("critical hunger pauses immediately and keeps work progress", () => {
  const world = createWorld(1);
  const person = world.people[0]!;
  addBreadWarehouse(world);
  person.hunger = 20;
  person.progress = 72;
  person.active = true;

  advanceHungerTick(world);
  assert.ok(person.hungerState);
  assert.equal(person.active, false);
  assert.equal(person.progress, 72);

  advanceHungerTick(world);
  assert.equal(person.hunger, 100);
  assert.equal(person.progress, 72);
});

test("critical hunger blocks work while no bread is reachable", () => {
  const world = createWorld(1);
  const person = world.people[0]!;
  person.hunger = 20;
  person.progress = 45;
  person.active = true;

  advanceHungerTick(world);

  assert.ok(person.hungerState);
  assert.equal(person.hungerState?.foodSource, undefined);
  assert.equal(person.active, false);
  assert.equal(person.progress, 45);
  assert.deepEqual(person.path, []);
});
