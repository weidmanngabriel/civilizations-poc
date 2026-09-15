import test from "node:test";
import assert from "node:assert/strict";
import { CONFIG, createDefaultGameWorld } from "../src/simulation/scenario";
import { key, neighbors, same } from "../src/simulation/hex";
import { buildingFootprint, footprintAt } from "../src/simulation/buildingPlacement";
import { naturalResourceFootprint } from "../src/simulation/naturalResources";
import { GRID_REFINEMENT } from "../src/simulation/spatial";

test("phase A uses a five-times finer grid without changing the visible world scale semantics", () => {
  const world = createDefaultGameWorld();

  assert.equal(GRID_REFINEMENT, 5);
  assert.equal(CONFIG.mapColumns, 41 * GRID_REFINEMENT);
  assert.equal(CONFIG.mapRows, 25 * GRID_REFINEMENT);
  assert.equal(world.tiles.length, CONFIG.mapColumns * CONFIG.mapRows);
  assert.equal(CONFIG.movementPerTick * CONFIG.simulationHz / GRID_REFINEMENT, 2.5);
  assert.equal(CONFIG.warehouseCollectionRadius / GRID_REFINEMENT, 5);
  assert.equal(CONFIG.farmFieldRadius / GRID_REFINEMENT, 3);
});

test("buildings occupy many micro-cells while keeping the old coarse footprint proportions", () => {
  const world = createDefaultGameWorld();
  const hq = world.buildings.find((building) => building.id === "hq")!;
  const warehouseFootprint = footprintAt("warehouse", hq.position);
  const sawmillFootprint = footprintAt("sawmill", hq.position);

  assert.ok(buildingFootprint(hq).length > 4);
  assert.ok(warehouseFootprint.length > 4);
  assert.ok(sawmillFootprint.length > warehouseFootprint.length);
});

test("natural resources are overlays and their complete footprints stay separate from terrain", () => {
  const world = createDefaultGameWorld();

  assert.equal(world.tiles.some((tile) => tile.terrain === "forest"), false);
  for (const resource of world.naturalResources.filter((candidate) => !candidate.depleted)) {
    const footprint = naturalResourceFootprint(resource);
    assert.equal(footprint.length, resource.kind === "forest" ? 1 : 4);
    for (const position of footprint) {
      const tile = world.tiles.find((candidate) => same(candidate, position));
      assert.ok(tile, `missing tile for ${resource.id}`);
      assert.equal(tile!.terrain, "grass");
      if (resource.kind === "forest" || resource.kind === "stone")
        assert.equal(tile!.resourceBlocking, true);
      else
        assert.equal(tile!.resourceBlocking, undefined);
    }
  }
  assert.equal(CONFIG.forestYield, 3);
});

test("phase E forests contain many individual trees while preserving walkable gaps", () => {
  const world = createDefaultGameWorld();
  const trees = world.naturalResources.filter((resource) => resource.kind === "forest" && !resource.depleted);
  const occupied = new Set(trees.map((tree) => key(tree.position)));

  assert.ok(trees.length >= 100);
  assert.equal(occupied.size, trees.length);
  assert.ok(
    trees.some((tree) => neighbors(tree.position).some((position) => !occupied.has(key(position)))),
  );
});