import { test } from "node:test";
import assert from "node:assert/strict";
import { createWorld } from "../src/simulation/scenario";
import {
  assigned,
  buildAt,
  changeAssignment,
  tick,
  warehouseStock,
} from "../src/simulation/simulation";

const activateWorker = (world: ReturnType<typeof createWorld>, buildingId: string) => {
  const worker = assigned(world, buildingId, "worker")[0]!;
  const workplace = world.buildings.find((b) => b.id === buildingId)!;
  worker.position = { ...workplace.position };
  worker.path = [];
  worker.movement = 0;
  worker.active = true;
  return worker;
};

test("mill and bakery turn wheat plus well water into bread", () => {
  const world = createWorld(4);
  const warehouse = buildAt(world, { q: 0, r: 0 }, "warehouse")!;
  const mill = buildAt(world, { q: 2, r: 0 }, "mill")!;
  const bakery = buildAt(world, { q: 4, r: 0 }, "bakery")!;
  const well = buildAt(world, { q: 6, r: 0 }, "well")!;
  warehouse.inventory!.wheat = 4;

  assert.equal(changeAssignment(world, mill.id, "worker", 1), true);
  assert.equal(changeAssignment(world, bakery.id, "worker", 1), true);
  activateWorker(world, mill.id);
  activateWorker(world, bakery.id);

  for (let i = 0; i < 6000 && bakery.output === 0; i++) tick(world);

  assert.ok(mill.output > 0 || (bakery.inputInventory?.flour ?? 0) > 0 || bakery.output > 0);
  assert.ok((bakery.inputInventory?.water ?? 0) >= 0);
  assert.equal(bakery.output, 2, "one bakery batch should produce two bread");
  assert.equal(well.output, 0, "well water must not be depleted");
});

test("warehouse carriers can collect water from a well", () => {
  const world = createWorld(2);
  const warehouse = buildAt(world, { q: 0, r: 0 }, "warehouse")!;
  const well = buildAt(world, { q: 2, r: 0 }, "well")!;
  assert.equal(changeAssignment(world, warehouse.id, "carrier", 1), true);
  const carrier = assigned(world, warehouse.id, "carrier")[0]!;
  carrier.position = { ...warehouse.position };
  carrier.path = [];
  carrier.movement = 0;
  carrier.active = true;

  for (let i = 0; i < 1200 && warehouseStock(warehouse, "water") === 0; i++) tick(world);

  assert.ok(warehouseStock(warehouse, "water") > 0);
  assert.equal(well.output, 0);
});


test("bakery fetches only what the next batch needs before topping up another input", () => {
  const world = createWorld(3);
  const bakery = buildAt(world, { q: 0, r: 0 }, "bakery")!;
  const well = buildAt(world, { q: 1, r: 0 }, "well")!;
  const warehouse = buildAt(world, { q: 4, r: 0 }, "warehouse")!;
  warehouse.inventory!.flour = 4;

  assert.equal(changeAssignment(world, bakery.id, "worker", 1), true);
  const baker = activateWorker(world, bakery.id);

  tick(world);
  assert.equal(baker.trip?.good, "water");

  for (let i = 0; i < 1200 && (bakery.inputInventory?.water ?? 0) < 1; i++) tick(world);
  assert.equal(bakery.inputInventory?.water, 1);
  assert.equal(baker.trip?.good, "flour", "after one required water, flour must be prioritized over more water");

  for (let i = 0; i < 2400 && (bakery.inputInventory?.flour ?? 0) < 2; i++) tick(world);
  assert.equal(bakery.inputInventory?.flour, 2);
  assert.equal(bakery.inputInventory?.water, 1);
});
