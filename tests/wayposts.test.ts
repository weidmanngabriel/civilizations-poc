import { test } from "node:test";
import assert from "node:assert/strict";
import { CONFIG, createDefaultGameWorld, createWorld } from "../src/simulation/scenario";
import { changeWoodcutters, tick } from "../src/simulation/simulation";
import {
  WAYPOST_MAX_CONNECTION_DISTANCE_WORLD_TILES,
  WAYPOST_MIN_DISTANCE_WORLD_TILES,
  WAYPOST_ORIENTATION_RADIUS_WORLD_TILES,
  canPlaceWaypost,
  findNavigationPath,
  findPathViaWayposts,
  findRequiredNavigationPath,
  placeWaypost,
  removeWaypost,
  wayposts,
} from "../src/simulation/wayposts";
import { findPath, hexDistance, key, neighbors, tileIndex, walkable } from "../src/simulation/hex";
import { GRID_REFINEMENT } from "../src/simulation/spatial";

test("player world starts with one HQ waypost and coupled balance constants", () => {
  const world = createDefaultGameWorld();
  assert.equal(WAYPOST_ORIENTATION_RADIUS_WORLD_TILES, 3.5);
  assert.equal(WAYPOST_MIN_DISTANCE_WORLD_TILES, 3.5);
  assert.equal(WAYPOST_MAX_CONNECTION_DISTANCE_WORLD_TILES, 7);
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

test("placing a waypost advances the network revision used by live placement previews", () => {
  const world = createDefaultGameWorld();
  const first = wayposts(world)[0]!;
  const candidate = world.tiles
    .filter((tile) => tile.terrain === "grass")
    .find((tile) =>
      hexDistance(first.position, tile) >= 4 * GRID_REFINEMENT &&
      canPlaceWaypost(world, tile)
    );
  assert.ok(candidate);

  const revision = world.waypostRevision ?? 0;
  assert.ok(placeWaypost(world, candidate));
  assert.equal(world.waypostRevision, revision + 1);
});

test("reachable wayposts connect between 3.5 and 7 world tiles and support network routing", () => {
  const world = createDefaultGameWorld();
  const first = wayposts(world)[0]!;
  const secondTile = world.tiles
    .filter((tile) => tile.terrain === "grass")
    .filter((tile) => {
      const distance = hexDistance(first.position, tile);
      return distance >= 6 * GRID_REFINEMENT && distance <= 7 * GRID_REFINEMENT;
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


test("demolishing a waypost removes reciprocal connections and advances the network revision", () => {
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

  const revision = world.waypostRevision ?? 0;
  assert.equal(removeWaypost(world, second.id), true);
  assert.equal(wayposts(world).some((post) => post.id === second.id), false);
  assert.equal(first.connections?.includes(second.id), false);
  assert.equal(world.waypostRevision, revision + 1);
});


test("same and neighboring waypost areas use direct local A* without signpost checkpoints", () => {
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
    .find(
      (tile) =>
        hexDistance(tile, second.position) === 1 &&
        hexDistance(tile, first.position) > WAYPOST_ORIENTATION_RADIUS_WORLD_TILES * GRID_REFINEMENT,
    );
  assert.ok(start);
  assert.ok(end);

  const direct = findPath(world.tiles, start, end);
  const routed = findNavigationPath(world, start, end);
  assert.ok(direct);
  assert.ok(routed);
  assert.deepEqual(routed.map(key), direct.map(key));
});

test("three or more wayposts constrain a corridor without requiring signpost cells", () => {
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

  const thirdTile = world.tiles
    .filter((tile) => tile.terrain === "grass")
    .filter((tile) => {
      const fromSecond = hexDistance(second.position, tile);
      return (
        fromSecond >= 4 * GRID_REFINEMENT &&
        fromSecond <= 5 * GRID_REFINEMENT &&
        hexDistance(first.position, tile) > WAYPOST_MAX_CONNECTION_DISTANCE_WORLD_TILES * GRID_REFINEMENT
      );
    })
    .find((tile) => canPlaceWaypost(world, tile));
  assert.ok(thirdTile);
  const third = placeWaypost(world, thirdTile);
  assert.ok(third);
  assert.ok(second.connections?.includes(third.id));

  const start = world.tiles
    .filter((tile) => tile.terrain === "grass")
    .find((tile) => hexDistance(tile, first.position) === 1);
  const end = world.tiles
    .filter((tile) => tile.terrain === "grass")
    .find(
      (tile) =>
        hexDistance(tile, third.position) === 1 &&
        hexDistance(tile, second.position) > WAYPOST_ORIENTATION_RADIUS_WORLD_TILES * GRID_REFINEMENT,
    );
  assert.ok(start);
  assert.ok(end);

  const tileMap = tileIndex(world.tiles);
  for (const post of [first, second, third]) {
    const tile = tileMap.get(key(post.position));
    assert.ok(tile);
    tile.buildingBlocking = true;
  }

  const routed = findNavigationPath(world, start, end);
  assert.ok(routed, "the route should remain possible when exact signpost cells are unavailable");
  for (const post of [first, second, third]) {
    assert.equal(
      routed.some((position) => key(position) === key(post.position)),
      false,
      "signpost cells must not be mandatory checkpoints",
    );
  }
  assert.ok(
    routed.every((position) =>
      [first, second, third].some(
        (post) => hexDistance(position, post.position) <= WAYPOST_ORIENTATION_RADIUS_WORLD_TILES * GRID_REFINEMENT,
      ),
    ),
    "long routes should stay inside the selected high-level waypost corridor",
  );
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


test("a newly formed road does not replace an active route", () => {
  const world = createWorld(1);
  const person = world.people[0]!;
  const tiles = tileIndex(world.tiles);

  let startTile;
  let first;
  let detour;
  let goal;
  for (const candidateStart of world.tiles) {
    if (candidateStart.terrain !== "grass" || !walkable(candidateStart)) continue;
    for (const candidateFirstPosition of neighbors(candidateStart)) {
      const candidateFirst = tiles.get(key(candidateFirstPosition));
      if (candidateFirst?.terrain !== "grass" || !walkable(candidateFirst)) continue;
      const candidateGoal = neighbors(candidateFirst)
        .map((position) => tiles.get(key(position)))
        .find((tile) =>
          tile?.terrain === "grass" &&
          walkable(tile) &&
          hexDistance(candidateStart, tile) === 2
        );
      if (!candidateGoal) continue;
      const candidateDetour = neighbors(candidateFirst)
        .map((position) => tiles.get(key(position)))
        .find((tile) =>
          tile?.terrain === "grass" &&
          walkable(tile) &&
          key(tile) !== key(candidateStart) &&
          key(tile) !== key(candidateGoal) &&
          hexDistance(tile, candidateGoal) === 1
        );
      if (!candidateDetour) continue;
      startTile = candidateStart;
      first = candidateFirst;
      detour = candidateDetour;
      goal = candidateGoal;
      break;
    }
    if (startTile) break;
  }

  assert.ok(startTile);
  assert.ok(first);
  assert.ok(detour);
  assert.ok(goal);

  person.position = { q: startTile.q, r: startTile.r };
  person.idleTarget = { q: goal.q, r: goal.r };
  person.path = [
    { q: first.q, r: first.r },
    { q: detour.q, r: detour.r },
    { q: goal.q, r: goal.r },
  ];
  person.movement = 1;
  first.trafficTicks = Array.from(
    { length: CONFIG.trafficThreshold - 1 },
    () => world.round,
  );

  tick(world);

  assert.equal(first.terrain, "road");
  assert.deepEqual(person.path[0], { q: detour.q, r: detour.r });
  assert.deepEqual(person.path.at(-1), { q: goal.q, r: goal.r });
});
