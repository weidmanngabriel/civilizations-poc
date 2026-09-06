import { test } from "node:test";
import assert from "node:assert/strict";
import { createWorld } from "../src/simulation/scenario";
import {
  assigned,
  building,
  changeAssignment,
  tick,
} from "../src/simulation/simulation";

test("production worker keeps filling free input slots while output is full", () => {
  const world = createWorld();
  const sawmill = building(world, "sawmill");
  const forest = building(world, "forest");

  changeAssignment(world, "sawmill", "worker", 1);
  const worker = assigned(world, "sawmill", "worker")[0]!;
  worker.position = { ...sawmill.position };
  worker.path = [];
  worker.active = true;

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
