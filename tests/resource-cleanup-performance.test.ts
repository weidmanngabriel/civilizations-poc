import test from "node:test";
import assert from "node:assert/strict";
import { performanceProfiler } from "../src/debug/performanceProfiler";
import { CONFIG, createWorld } from "../src/simulation/scenario";
import { tick } from "../src/simulation/simulation";

test("local final-resource retirement bypasses legacy resource cleanup", () => {
  const world = createWorld(1);
  const worker = world.people[0]!;
  const resource = world.naturalResources.find((candidate) => candidate.kind === "forest")!;

  worker.woodcutter = true;
  worker.resourceTarget = resource.id;
  worker.position = { ...resource.position };
  worker.active = true;
  worker.path = [];
  worker.progress = CONFIG.duration - 1;
  worker.workArea = { center: { ...resource.position }, radius: CONFIG.spatialScale * 2.5 };
  resource.remaining = 1;

  const before = performanceProfiler
    .snapshot()
    .features.find((feature) => feature.key === "planningResourceCleanup")!.count;

  tick(world);

  const after = performanceProfiler
    .snapshot()
    .features.find((feature) => feature.key === "planningResourceCleanup")!.count;

  assert.equal(resource.depleted, true);
  assert.equal(resource.remaining, 0);
  assert.equal(after, before, "local depletion must not enter the legacy cleanup path");
});
