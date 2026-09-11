import { test } from "node:test";
import assert from "node:assert/strict";
import { createWorld, CONFIG } from "../src/simulation/scenario";
import {
  assigned,
  buildAt,
  building,
  changeAssignment,
  changeWoodcutters,
  tick,
  woodcutters,
} from "../src/simulation/simulation";

function activeSawmillWorker() {
  const world = createWorld();
  const sawmill = buildAt(world, { q: 7, r: 4 }, "sawmill")!;
  changeAssignment(world, sawmill.id, "worker", 1);
  const worker = assigned(world, sawmill.id, "worker")[0]!;
  worker.position = { ...sawmill.position };
  worker.path = [];
  worker.movement = 0;
  worker.active = true;
  changeWoodcutters(world, 1);
  const woodcutter = woodcutters(world)[0]!;
  const forest = building(world, woodcutter.assignment!.building);
  return { world, sawmill, worker, forest };
}

test("production worker keeps producing while input and output space allow it", () => {
  const { world, sawmill, worker, forest } = activeSawmillWorker();
  sawmill.input = 10;
  forest.output = 1;

  for (let i = 0; i < CONFIG.duration * 5; i++) tick(world);

  assert.ok(sawmill.output > 5 && sawmill.output < 5.1);
  assert.equal(sawmill.input, 0);
  assert.equal(worker.progress, 0);
  assert.deepEqual(worker.trip, {
    source: forest.id,
    target: sawmill.id,
    good: "wood",
    picked: false,
  });
});

test("production worker keeps filling free input slots while output is full", () => {
  const { world, sawmill, worker, forest } = activeSawmillWorker();

  sawmill.input = 2;
  sawmill.output = CONFIG.outputCapacity;
  forest.output = 1;

  tick(world);

  assert.equal(worker.progress, 0);
  assert.deepEqual(worker.trip, {
    source: forest.id,
    target: sawmill.id,
    good: "wood",
    picked: false,
  });
});
