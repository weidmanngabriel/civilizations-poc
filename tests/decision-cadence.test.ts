import { test } from "node:test";
import assert from "node:assert/strict";
import { CONFIG, createWorld } from "../src/simulation/scenario";
import {
  assigned,
  buildAt,
  changeAssignment,
  setMerchantRoute,
  tick,
} from "../src/simulation/simulation";

function activeBlockedWorker() {
  const world = createWorld();
  const sawmill = buildAt(world, { q: 7, r: 4 }, "sawmill")!;
  const warehouse = buildAt(world, { q: 8, r: 4 }, "warehouse")!;
  changeAssignment(world, sawmill.id, "worker", 1);
  const worker = assigned(world, sawmill.id, "worker")[0]!;
  worker.position = { ...sawmill.position };
  worker.path = [];
  worker.movement = 0;
  worker.active = true;
  sawmill.input = 0;
  sawmill.output = CONFIG.outputCapacity;
  return { world, sawmill, warehouse, worker };
}

test("idle autonomous planning runs once per simulated second", () => {
  const { world, sawmill, warehouse, worker } = activeBlockedWorker();

  tick(world);
  assert.equal(worker.trip, undefined);

  warehouse.inventory!.wood = 1;
  for (let i = 0; i < CONFIG.decisionIntervalTicks - 1; i++) tick(world);
  assert.equal(worker.trip, undefined);

  tick(world);
  assert.deepEqual(worker.trip, {
    source: warehouse.id,
    target: sawmill.id,
    good: "wood",
    picked: false,
  });
});

test("delivery triggers the required follow-up decision immediately", () => {
  const { world, sawmill, warehouse, worker } = activeBlockedWorker();
  world.round = 1;
  warehouse.inventory!.wood = 1;
  worker.trip = {
    source: warehouse.id,
    target: sawmill.id,
    good: "wood",
    picked: true,
  };

  tick(world);

  assert.equal(sawmill.input, 1);
  assert.deepEqual(worker.trip, {
    source: warehouse.id,
    target: sawmill.id,
    good: "wood",
    picked: false,
  });
});

test("arrival at a merchant source triggers the next transfer immediately", () => {
  const world = createWorld();
  const source = buildAt(world, { q: 7, r: 4 }, "warehouse")!;
  const target = buildAt(world, { q: 9, r: 4 }, "warehouse")!;
  source.inventory!.wood = 1;
  changeAssignment(world, source.id, "merchant", 1);
  const merchant = assigned(world, source.id, "merchant")[0]!;
  merchant.position = { q: source.position.q - 1, r: source.position.r };
  merchant.path = [{ ...source.position }];
  merchant.movement = 1;
  merchant.active = true;
  setMerchantRoute(world, merchant.id, target.id, "wood");
  merchant.position = { q: source.position.q - 1, r: source.position.r };
  merchant.path = [{ ...source.position }];
  merchant.movement = 1;
  world.round = 1;

  tick(world);

  assert.deepEqual(merchant.trip, {
    source: source.id,
    target: target.id,
    good: "wood",
    picked: false,
  });
});
