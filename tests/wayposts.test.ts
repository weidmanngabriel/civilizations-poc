import { test } from "node:test";
import assert from "node:assert/strict";
import { createDefaultGameWorld } from "../src/simulation/scenario";
import { changeWoodcutters } from "../src/simulation/simulation";
import {
  WAYPOST_MAX_CONNECTION_DISTANCE_WORLD_TILES,
  WAYPOST_MIN_DISTANCE_WORLD_TILES,
  WAYPOST_ORIENTATION_RADIUS_WORLD_TILES,
  canPlaceWaypost,
  findNavigationPath,
  findPathViaWayposts,
  findRequiredNavigationPath,
  placeWaypost,
  wayposts,
} from "../src/simulation/wayposts";
import { findPath, hexDistance } from "../src/simulation/hex";
import { GRID_REFINEMENT } from "../src/simulation/spatial";

test("player world starts with one HQ waypost and independent balance constants", () => {
  const world = createDefaultGameWorld();
  assert.equal(WAYPOST_ORIENTATION_RADIUS_WORLD_TILES, 3.5);
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
      return distance >= 4 * GRID_REFINEMENT && distance <= 5 * GRID_REFINEMENT;
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
      return distance >= 4 * GRID_REFINEMENT && distance <= 5 * GRID_REFINEMENT;
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


test("player navigation has no global direct fallback outside the waypost network", () => {
  const world = createDefaultGameWorld();
  const first = wayposts(world)[0]!;
  const end = world.tiles
    .filter((tile) => tile.terrain === "grass")
    .filter((tile) => hexDistance(first.position, tile) > 4 * GRID_REFINEMENT)
    .find((tile) => Boolean(findPath(world.tiles, first.position, tile)));
  assert.ok(end, "fixture needs a globally reachable tile outside the initial waypost area");

  assert.ok(findPath(world.tiles, first.position, end), "low-level A* can physically reach the tile");
  assert.equal(
    findNavigationPath(world, first.position, end),
    null,
    "player navigation must not bypass the waypost network",
  );
});

test("failed required routes are cached until the waypost network revision changes", () => {
  const world = createDefaultGameWorld();
  const person = world.people[0]!;
  const first = wayposts(world)[0]!;
  person.position = { ...first.position };

  const secondTile = world.tiles
    .filter((tile) => tile.terrain === "grass")
    .filter((tile) => {
      const distance = hexDistance(first.position, tile);
      return distance >= 4 * GRID_REFINEMENT && distance <= 5 * GRID_REFINEMENT;
    })
    .find((tile) => canPlaceWaypost(world, tile));
  assert.ok(secondTile);

  const end = world.tiles
    .filter((tile) => tile.terrain === "grass")
    .find((tile) =>
      hexDistance(tile, secondTile) === 1 &&
      hexDistance(tile, first.position) > WAYPOST_ORIENTATION_RADIUS_WORLD_TILES * GRID_REFINEMENT
    );
  assert.ok(end);

  const initialRevision = world.waypostRevision ?? 0;
  assert.equal(findRequiredNavigationPath(world, person, end), null);
  assert.equal(person.navigationBlocked, true);
  assert.deepEqual(person.navigationFailedTargets, [`${end.q},${end.r}`]);

  const manualSecond = {
    id: "waypost-manual",
    position: { q: secondTile.q, r: secondTile.r },
    connections: [first.id],
  };
  first.connections ??= [];
  first.connections.push(manualSecond.id);
  world.wayposts!.push(manualSecond);

  assert.equal(
    findRequiredNavigationPath(world, person, end),
    null,
    "same network revision must reuse the cached failure",
  );

  world.waypostRevision = initialRevision + 1;
  const retried = findRequiredNavigationPath(world, person, end);
  assert.ok(retried, "network revision change must allow one fresh route search");
  assert.equal(person.navigationBlocked, undefined);
  assert.equal(person.navigationFailedTargets, undefined);
});


test("new extractor assignments cannot bypass the waypost network", () => {
  const world = createDefaultGameWorld();
  const first = wayposts(world)[0]!;
  const farForest = world.naturalResources.find(
    (resource) =>
      resource.kind === "forest" &&
      !resource.depleted &&
      hexDistance(first.position, resource.position) >
        WAYPOST_ORIENTATION_RADIUS_WORLD_TILES * GRID_REFINEMENT,
  );
  assert.ok(farForest, "fixture needs a forest outside the initial waypost orientation area");

  for (const resource of world.naturalResources) {
    if (resource.kind !== "forest" || resource.id === farForest.id) continue;
    resource.remaining = 0;
    resource.depleted = true;
  }

  const person = world.people.find(
    (candidate) =>
      !candidate.assignment &&
      !candidate.woodcutter &&
      !candidate.fisher &&
      !candidate.extractor &&
      !candidate.builder,
  );
  assert.ok(person);
  person.position = { ...first.position };
  person.path = [];

  assert.equal(changeWoodcutters(world, 1), true);
  const worker = world.people.find((candidate) => candidate.woodcutter);
  assert.ok(worker);
  assert.equal(worker.resourceTarget, undefined);
  assert.equal(
    worker.path.some(
      (position) =>
        position.q === farForest.position.q && position.r === farForest.position.r,
    ),
    false,
    "worker must not receive a direct path to the unreachable forest",
  );
});
