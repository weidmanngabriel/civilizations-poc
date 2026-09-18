import { test } from "node:test";
import assert from "node:assert/strict";
import { createDefaultGameWorld } from "../src/simulation/scenario";
import {
  WAYPOST_MAX_CONNECTION_DISTANCE_WORLD_TILES,
  WAYPOST_MIN_DISTANCE_WORLD_TILES,
  WAYPOST_ORIENTATION_RADIUS_WORLD_TILES,
  canPlaceWaypost,
  findNavigationPath,
  findPathViaWayposts,
  placeWaypost,
  wayposts,
} from "../src/simulation/wayposts";
import { hexDistance } from "../src/simulation/hex";
import { GRID_REFINEMENT } from "../src/simulation/spatial";

test("player world starts with one HQ waypost and independent balance constants", () => {
  const world = createDefaultGameWorld();
  assert.equal(WAYPOST_ORIENTATION_RADIUS_WORLD_TILES, 2.5);
  assert.equal(WAYPOST_MIN_DISTANCE_WORLD_TILES, 2.5);
  assert.equal(WAYPOST_MAX_CONNECTION_DISTANCE_WORLD_TILES, 5);
  assert.equal(wayposts(world).length, 1);
  const hq = world.buildings.find((building) => building.kind === "hq")!;
  assert.ok(
    hexDistance(hq.position, wayposts(world)[0]!.position) <= GRID_REFINEMENT + 2,
  );
});

test("waypost placement rejects positions inside the minimum distance", () => {
  const world = createDefaultGameWorld();
  const first = wayposts(world)[0]!;
  assert.equal(
    canPlaceWaypost(world, {
      q: first.position.q + GRID_REFINEMENT,
      r: first.position.r,
    }),
    false,
  );
});

test("reachable wayposts connect within five world tiles and support network routing", () => {
  const world = createDefaultGameWorld();
  const first = wayposts(world)[0]!;
  const secondTile = world.tiles
    .filter((tile) => tile.terrain === "grass")
    .filter((tile) => {
      const distance = hexDistance(first.position, tile);
      return distance >= 3 * GRID_REFINEMENT && distance <= 4 * GRID_REFINEMENT;
    })
    .find((tile) => canPlaceWaypost(world, tile));

  assert.ok(secondTile);
  const second = placeWaypost(world, secondTile);
  assert.ok(second);
  assert.ok(first.connections?.includes(second.id));
  assert.ok(second.connections?.includes(first.id));

  const path = findPathViaWayposts(world, first.position, second.position);
  assert.ok(path);
});


test("normal navigation visibly routes through connected wayposts when both ends are oriented", () => {
  const world = createDefaultGameWorld();
  const first = wayposts(world)[0]!;

  const secondTile = world.tiles
    .filter((tile) => tile.terrain === "grass")
    .filter((tile) => {
      const distance = hexDistance(first.position, tile);
      return distance >= 3 * GRID_REFINEMENT && distance <= 4 * GRID_REFINEMENT;
    })
    .find((tile) => canPlaceWaypost(world, tile));
  assert.ok(secondTile);
  const second = placeWaypost(world, secondTile);
  assert.ok(second);

  const start = world.tiles
    .filter((tile) => tile.terrain === "grass")
    .find((tile) => hexDistance(tile, first.position) === 1);
  const end = world.tiles
    .filter((tile) => tile.terrain === "grass")
    .find((tile) => hexDistance(tile, second.position) === 1 && hexDistance(tile, first.position) > WAYPOST_ORIENTATION_RADIUS_WORLD_TILES * GRID_REFINEMENT);
  assert.ok(start);
  assert.ok(end);

  const path = findNavigationPath(world, start, end);
  assert.ok(path);

  const firstIndex = path.findIndex(
    (position) => position.q === first.position.q && position.r === first.position.r,
  );
  const secondIndex = path.findIndex(
    (position) => position.q === second.position.q && position.r === second.position.r,
  );
  assert.ok(firstIndex >= 0, "route should pass through the entry waypost");
  assert.ok(secondIndex > firstIndex, "route should then pass through the connected exit waypost");
});
