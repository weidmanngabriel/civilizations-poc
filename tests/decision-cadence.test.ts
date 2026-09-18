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

function twoGrassPositions() {
  const world = createWorld();
  const first = world.tiles.find((tile) => tile.terrain === "grass")!;
  const second = world.tiles.find(
    (tile) =>
      tile.terrain === "grass" &&
      (Math.abs(tile.q - first.q) >= CONFIG.spatialScale ||
        Math.abs(tile.r - first.r) >= CONFIG.spatialScale),
  )!;
  return { world, first, second };
}

function activeBlockedWorker() {
  const { world, first, second } = twoGrassPositions();
  const sawmill = buildAt(world, first, "sawmill")!;
  const warehouse = buildAt(world, second, "warehouse")!;
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
    sourcePosition: { ...warehouse.position },
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

  for (let i = 0; i <= CONFIG.transferDurationTicks; i++) tick(world);

  assert.equal(sawmill.input, 1);
  assert.deepEqual(worker.trip, {
    source: warehouse.id,
    sourcePosition: { ...warehouse.position },
    target: sawmill.id,
    good: "wood",
    picked: false,
  });
});

test("arrival at a merchant source triggers the next transfer immediately", () => {
  const { world, first, second } = twoGrassPositions();
  const source = buildAt(world, first, "warehouse")!;
  const target = buildAt(world, second, "warehouse")!;
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
    sourcePosition: { ...source.position },
    target: target.id,
    good: "wood",
    picked: false,
  });
});
