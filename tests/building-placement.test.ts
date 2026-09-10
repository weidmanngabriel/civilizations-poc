import { test } from "node:test";
import assert from "node:assert/strict";
import type { BuildableBuildingKind } from "../src/simulation/model";
import { createWorld } from "../src/simulation/scenario";
import { same } from "../src/simulation/hex";
import {
  buildingFootprint,
  buildWithFootprint,
  canPlaceBuilding,
  footprintAt,
  footprintFromShape,
  footprintRing,
  removeBuildingWithFootprint,
  validBuildingAnchors,
} from "../src/simulation/buildingPlacement";

const findValidOrigin = (
  world: ReturnType<typeof createWorld>,
  kind: BuildableBuildingKind,
) => {
  const tile = world.tiles.find((candidate) => canPlaceBuilding(world, candidate, kind));
  assert.ok(tile, "expected a valid building position");
  return { q: tile.q, r: tile.r };
};

test("building shapes can use an anchor anywhere inside an irregular footprint", () => {
  const anchorPosition = { q: 10, r: 10 };
  const footprint = footprintFromShape({
    cells: [
      { q: 0, r: 0 },
      { q: 1, r: 0 },
      { q: 2, r: 0 },
      { q: 1, r: 1 },
    ],
    anchor: { q: 1, r: 0 },
  }, anchorPosition);

  assert.deepEqual(footprint, [
    { q: 9, r: 10 },
    { q: 10, r: 10 },
    { q: 11, r: 10 },
    { q: 10, r: 11 },
  ]);
});

test("valid anchor enumeration matches the authoritative placement rule", () => {
  const world = createWorld();
  const valid = validBuildingAnchors(world, "warehouse");
  assert.ok(valid.length > 0);
  assert.ok(valid.every((position) => canPlaceBuilding(world, position, "warehouse")));
  assert.equal(
    valid.length,
    world.tiles.filter((position) => canPlaceBuilding(world, position, "warehouse")).length,
  );
});

test("buildable buildings occupy multiple tiles and keep one free tile around them", () => {
  const world = createWorld();
  const origin = findValidOrigin(world, "warehouse");
  const footprint = footprintAt("warehouse", origin);
  const ring = footprintRing(footprint);

  assert.ok(footprint.length > 1);
  assert.ok(ring.length > 0);
  assert.ok(ring.every((position) => {
    const tile = world.tiles.find((candidate) => same(candidate, position));
    return tile?.terrain === "grass" || tile?.terrain === "road";
  }));

  const created = buildWithFootprint(world, origin, "warehouse");
  assert.ok(created);
  assert.deepEqual(buildingFootprint(created!), footprint);
  assert.ok(footprint.every((position) =>
    world.tiles.find((candidate) => same(candidate, position))?.terrain === "building",
  ));
  assert.ok(ring.every((position) => !canPlaceBuilding(world, position, "warehouse")));
});

test("placement fails when the required free ring contains blocked terrain", () => {
  const world = createWorld();
  const origin = findValidOrigin(world, "warehouse");
  const ring = footprintRing(footprintAt("warehouse", origin));
  const blocked = world.tiles.find((tile) => same(tile, ring[0]!))!;
  blocked.terrain = "river";
  assert.equal(canPlaceBuilding(world, origin, "warehouse"), false);
});

test("demolishing a multi-tile building restores every occupied tile", () => {
  const world = createWorld();
  const origin = findValidOrigin(world, "sawmill");
  const footprint = footprintAt("sawmill", origin);
  const before = footprint.map((position) => ({
    position,
    terrain: world.tiles.find((tile) => same(tile, position))!.terrain,
  }));
  const created = buildWithFootprint(world, origin, "sawmill");
  assert.ok(created);
  assert.equal(removeBuildingWithFootprint(world, created!.id), true);
  for (const entry of before) {
    assert.equal(
      world.tiles.find((tile) => same(tile, entry.position))!.terrain,
      entry.terrain,
    );
  }
});
