import test from "node:test";
import assert from "node:assert/strict";
import { performanceProfiler } from "../src/debug/performanceProfiler";
import { findPath, same } from "../src/simulation/hex";
import { CONFIG, createWorld } from "../src/simulation/scenario";
import { tick } from "../src/simulation/simulation";
import { hexDistance } from "../src/simulation/spatial";

test("local final-resource retirement bypasses legacy cleanup from a blocking interaction cell", () => {
  const world = createWorld(1);
  const worker = world.people[0]!;
  const resource = world.naturalResources.find((candidate) => candidate.kind === "forest")!;
  const resourceTile = world.tiles.find(
    (tile) => tile.q === resource.position.q && tile.r === resource.position.r,
  )!;
  resourceTile.resourceBlocking = true;
  const start = world.tiles.find(
    (tile) => tile.terrain === "grass" && hexDistance(tile, resource.position) >= 3,
  )!;
  const route = findPath(world.tiles, start, resource.position, CONFIG.roadSpeedMultiplier)!;
  assert.ok(route.length > 0);
  const interactionCell = route.at(-1)!;
  assert.notDeepEqual(interactionCell, resource.position);
  assert.equal(same(interactionCell, resource.position), true);

  worker.woodcutter = true;
  worker.resourceTarget = resource.id;
  worker.position = interactionCell;
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
  assert.equal(after, before, "blocking local depletion must not enter the legacy cleanup path");
});
