import { test } from "node:test";
import assert from "node:assert/strict";
import { createWorld } from "../src/simulation/scenario";
import {
  assigned,
  building,
  changeAssignment,
  tick,
} from "../src/simulation/simulation";

function activeSawmillWorker() {
  const world = createWorld();
  const sawmill = building(world, "sawmill");
  changeAssignment(world, "sawmill", "worker", 1);
  const worker = assigned(world, "sawmill", "worker")[0]!;
  worker.position = { ...sawmill.position };
  worker.path = [];
  worker.active = true;
  return { world, sawmill, worker };
}

test("production worker keeps producing while input and output space allow it", () => {
  const { world, sawmill, worker } = activeSawmillWorker();
  const forest = building(world, "forest");
  sawmill.input = 10;
  forest.output = 1;

  for (let i = 0; i < 5; i++) tick(world);
  assert.equal(sawmill.output, 1);
  assert.equal(sawmill.input, 8);
  assert.equal(worker.trip, undefined);

  tick(world);
  assert.equal(worker.progress, 1);
  assert.equal(worker.trip, undefined);

  for (let i = 0; i < 9; i++) tick(world);
  assert.equal(sawmill.output, 3);
  assert.equal(sawmill.input, 4);
  assert.equal(worker.progress, 0);
  assert.deepEqual(worker.trip, {
    source: "forest",
    target: "sawmill",
    good: "wood",
    picked: false,
  });
});

test("production worker keeps filling free input slots while output is full", () => {
  const { world, sawmill, worker } = activeSawmillWorker();
  const forest = building(world, "forest");

  sawmill.input = 2;
  sawmill.output = 3;
  forest.output = 1;

  tick(world);

  assert.equal(worker.progress, 0);
  assert.deepEqual(worker.trip, {
    source: "forest",
    target: "sawmill",
    good: "wood",
    picked: false,
  });
});
