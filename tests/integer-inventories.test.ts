import test from "node:test";
import assert from "node:assert/strict";
import { createWorld, CONFIG } from "../src/simulation/scenario";
import type { Building } from "../src/simulation/model";
import { tick, warehouseStock } from "../src/simulation/simulation";

const almostEqual = (actual: number, expected: number, epsilon = 1e-9) =>
  assert.ok(Math.abs(actual - expected) < epsilon, `${actual} != ${expected}`);

function fractionalSource(position: { q: number; r: number }): Building {
  return {
    id: "fractional-source",
    kind: "sawmill",
    name: "Quelle",
    position: { ...position },
    workers: 0,
    carriers: 0,
    input: 0,
    output: 4.7,
    recipe: {
      input: "wood",
      amount: 2,
      output: "plank",
      duration: CONFIG.duration,
    },
  };
}

test("fractional production output enters a warehouse only in whole units", () => {
  const world = createWorld(1);
  const person = world.people[0]!;
  const source = fractionalSource(person.position);
  const warehouse: Building = {
    id: "warehouse-test",
    kind: "warehouse",
    name: "Lager",
    position: { ...person.position },
    workers: 0,
    carriers: 1,
    merchants: 0,
    input: 0,
    output: 0,
    inventory: { plank: 0 },
  };
  world.buildings.push(source, warehouse);
  person.assignment = { building: warehouse.id, role: "carrier" };
  person.active = true;
  person.trip = {
    source: source.id,
    target: warehouse.id,
    good: "plank",
    picked: false,
  };

  tick(world);
  tick(world);

  almostEqual(source.output, 3.7);
  assert.equal(warehouseStock(warehouse, "plank"), 1);
  assert.equal(Number.isInteger(warehouseStock(warehouse, "plank")), true);
});

test("fractional production output enters production input only in whole units", () => {
  const world = createWorld(1);
  const person = world.people[0]!;
  const source = fractionalSource(person.position);
  source.recipe!.output = "wood";
  const sawmill: Building = {
    id: "sawmill-test",
    kind: "sawmill",
    name: "Sägewerk",
    position: { ...person.position },
    workers: 0,
    carriers: 1,
    input: 0,
    output: 0,
    recipe: {
      input: "wood",
      amount: 2,
      output: "plank",
      duration: CONFIG.duration,
    },
  };
  world.buildings.push(source, sawmill);
  person.assignment = { building: sawmill.id, role: "carrier" };
  person.active = true;
  person.trip = {
    source: source.id,
    target: sawmill.id,
    good: "wood",
    picked: false,
  };

  tick(world);
  tick(world);

  almostEqual(source.output, 3.7);
  assert.equal(sawmill.input, 1);
  assert.equal(Number.isInteger(sawmill.input), true);
});
