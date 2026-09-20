import { test } from "node:test";
import assert from "node:assert/strict";
import { CONFIG } from "../src/simulation/scenario";
import { findLooseGoodDropPosition, placeLooseGood } from "../src/simulation/looseGoods";
import {
  assigned,
  buildAt,
  changeAssignment,
  tick,
} from "../src/simulation/simulation";
import { createTestWorld } from "./testWorld";

function activeSawmillWorker() {
  const world = createTestWorld({ width: 32, height: 24 });
  const sawmill = buildAt(world, { q: 7, r: 4 }, "sawmill")!;
  changeAssignment(world, sawmill.id, "worker", 1);
  const worker = assigned(world, sawmill.id, "worker")[0]!;
  worker.position = { ...sawmill.position };
  worker.path = [];
  worker.movement = 0;
  worker.active = true;
  const drop = findLooseGoodDropPosition(world, { q: 10, r: 4 }, "wood", CONFIG.spatialScale)!;
  const stack = placeLooseGood(world, drop, "wood", 1)!;
  return { world, sawmill, worker, stack };
}

test("production worker keeps producing while input and output space allow it", () => {
  const { world, sawmill, worker, stack } = activeSawmillWorker();
  sawmill.input = 10;

  for (let i = 0; i < CONFIG.duration * 5; i++) tick(world);

  assert.ok(Math.abs(sawmill.output - 5.1) < 1e-9);
  assert.equal(sawmill.input, 0);
  assert.equal(worker.progress, 0);
  assert.deepEqual(worker.trip, {
    source: stack.id,
    sourceKind: "looseGood",
    sourcePosition: { ...stack.position },
    target: sawmill.id,
    good: "wood",
    picked: false,
  });
});

test("production worker keeps filling free input slots while output is full", () => {
  const { world, sawmill, worker, stack } = activeSawmillWorker();

  sawmill.input = 2;
  sawmill.output = CONFIG.outputCapacity;

  tick(world);

  assert.equal(worker.progress, 0);
  assert.deepEqual(worker.trip, {
    source: stack.id,
    sourceKind: "looseGood",
    sourcePosition: { ...stack.position },
    target: sawmill.id,
    good: "wood",
    picked: false,
  });
});
