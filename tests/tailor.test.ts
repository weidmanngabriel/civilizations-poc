import { test } from "node:test";
import assert from "node:assert/strict";
import { createWorld } from "../src/simulation/scenario";
import { assigned, buildAt, changeAssignment, tick } from "../src/simulation/simulation";
import { professionExperience } from "../src/simulation/experience";

test("tailor turns one leather into one pair of shoes", () => {
  const world = createWorld(1);
  const tailor = buildAt(world, { q: 0, r: 0 }, "tailor")!;
  tailor.input = 1;

  assert.equal(changeAssignment(world, tailor.id, "worker", 1), true);
  const worker = assigned(world, tailor.id, "worker")[0]!;
  worker.position = { ...tailor.position };
  worker.path = [];
  worker.movement = 0;
  worker.active = true;

  for (let i = 0; i < 1200 && tailor.output === 0; i++) tick(world);

  assert.equal(tailor.input, 0);
  assert.equal(tailor.output, 1);
  assert.equal(professionExperience(worker, "tailor"), 1);
});
