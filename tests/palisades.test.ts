import { test } from "node:test";
import assert from "node:assert/strict";
import { CONFIG } from "../src/simulation/scenario";
import {
  PALISADE_MAX_SEGMENTS,
  createPalisadeSites,
  planPalisadePath,
} from "../src/simulation/palisades";
import { createTestWorld } from "./testWorld";

test("long palisade planning stops at 50 segments instead of failing", () => {
  const world = createTestWorld({ width: 140, height: 12, population: 0 });
  const path = planPalisadePath(world, { q: -60, r: 2 }, { q: 60, r: 2 });

  assert.equal(path.length, PALISADE_MAX_SEGMENTS);
  assert.deepEqual(path[0], { q: -60, r: 2 });
});

test("palisade sites cost one wood and take one second each", () => {
  const world = createTestWorld({ width: 20, height: 12, population: 0 });
  const sites = createPalisadeSites(world, [
    { q: 2, r: 2 },
    { q: 3, r: 2 },
    { q: 4, r: 2 },
  ]);

  assert.equal(sites.length, 3);
  for (const site of sites) {
    assert.equal(site.kind, "palisade");
    assert.deepEqual(site.footprint, [site.position]);
    assert.deepEqual(site.construction?.required, { wood: 1 });
    assert.equal(site.construction?.duration, CONFIG.simulationHz);
    assert.equal(site.construction?.complete, false);
  }
});
