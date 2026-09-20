import { test } from "node:test";
import assert from "node:assert/strict";
import type { PlaceableBuildingKind } from "../src/simulation/model";
import { createDefaultGameWorld, createWorld } from "../src/simulation/scenario";
import { createTestWorld } from "./testWorld";
import { hexDistance, same } from "../src/simulation/hex";
import { placeLooseGood } from "../src/simulation/looseGoods";
import { buildingInteractionAt } from "../src/buildings/buildingDefinitionRegistry";
import { WAYPOST_ORIENTATION_RADIUS } from "../src/simulation/wayposts";
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
  kind: PlaceableBuildingKind,
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

test("player buildings require their entrance to be inside any placed waypost radius", () => {
  const world = createDefaultGameWorld();
  const origin = findValidOrigin(world, "house");
  const entrance = buildingInteractionAt("house", origin);

  world.wayposts = [];
  assert.equal(canPlaceBuilding(world, origin, "house"), false);
  assert.equal(validBuildingAnchors(world, "house").length, 0);

  world.wayposts = [{
    id: "isolated-waypost",
    position: {
      q: entrance.q + Math.floor(WAYPOST_ORIENTATION_RADIUS) + 1,
      r: entrance.r,
    },
    connections: [],
  }];
  assert.equal(canPlaceBuilding(world, origin, "house"), false);

  const footprint = footprintAt("house", origin);
  const nearbyWaypostTile = world.tiles.find(
    (tile) =>
      hexDistance(tile, entrance) <= WAYPOST_ORIENTATION_RADIUS &&
      footprint.every((position) => hexDistance(tile, position) > 1),
  );
  assert.ok(nearbyWaypostTile);
  world.wayposts[0]!.position = { q: nearbyWaypostTile.q, r: nearbyWaypostTile.r };
  assert.equal(canPlaceBuilding(world, origin, "house"), true);
});

test("wayposts reserve their cell plus one neighboring micro-cell from building footprints", () => {
  const world = createDefaultGameWorld();
  const waypost = world.wayposts![0]!;
  const candidate = validBuildingAnchors(world, "house").find((anchor) => {
    const footprint = footprintAt("house", anchor);
    return footprint.some((position) => hexDistance(position, waypost.position) === 2);
  });
  assert.ok(candidate);

  const footprint = footprintAt("house", candidate);
  const closest = footprint
    .slice()
    .sort(
      (a, b) =>
        hexDistance(a, waypost.position) - hexDistance(b, waypost.position),
    )[0]!;
  world.wayposts![0]!.position = {
    q: closest.q + 1,
    r: closest.r,
  };
  assert.equal(
    footprint.some((position) => hexDistance(position, world.wayposts![0]!.position) <= 1),
    true,
  );
  assert.equal(canPlaceBuilding(world, candidate, "house"), false);
});

test("buildable buildings occupy multiple tiles and keep a two-micro-cell clearance", () => {
  const world = createWorld();
  const origin = findValidOrigin(world, "warehouse");
  const footprint = footprintAt("warehouse", origin);
  const ring = footprintRing(footprint);

  assert.ok(footprint.length > 1);
  assert.ok(ring.length > 0);
  assert.equal(
    Math.max(...ring.map((position) =>
      Math.min(...footprint.map((occupied) => hexDistance(position, occupied))),
    )),
    2,
  );
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

test("physical goods block only the actual building footprint", () => {
  const world = createWorld();
  const origin = findValidOrigin(world, "warehouse");
  const footprint = footprintAt("warehouse", origin);
  const ring = footprintRing(footprint);

  assert.ok(placeLooseGood(world, footprint[0]!, "wood", 1));
  assert.equal(canPlaceBuilding(world, origin, "warehouse"), false);

  world.looseGoods = [];
  assert.ok(placeLooseGood(world, ring[0]!, "wood", 1));
  assert.equal(canPlaceBuilding(world, origin, "warehouse"), true);
});

test("demolishing a multi-tile building restores every occupied grass tile", () => {
  const world = createWorld();
  const origin = findValidOrigin(world, "sawmill");
  const footprint = footprintAt("sawmill", origin);
  const created = buildWithFootprint(world, origin, "sawmill");
  assert.ok(created);
  assert.equal(removeBuildingWithFootprint(world, created!.id), true);
  for (const position of footprint) {
    assert.equal(
      world.tiles.find((tile) => same(tile, position))!.terrain,
      "grass",
    );
  }
});

test("roads are valid placement terrain but are removed by the building footprint", () => {
  const world = createWorld();
  const origin = findValidOrigin(world, "warehouse");
  const footprint = footprintAt("warehouse", origin);
  const roadPosition = footprint[1]!;
  const roadTile = world.tiles.find((tile) => same(tile, roadPosition))!;
  roadTile.terrain = "road";

  assert.equal(canPlaceBuilding(world, origin, "warehouse"), true);
  const created = buildWithFootprint(world, origin, "warehouse");
  assert.ok(created);
  assert.equal(roadTile.terrain, "building");

  assert.equal(removeBuildingWithFootprint(world, created!.id), true);
  assert.equal(roadTile.terrain, "grass");
});
