import { test } from "node:test";
import assert from "node:assert/strict";
import { CONFIG } from "../src/simulation/scenario";
import { hexDistance } from "../src/simulation/spatial";
import { WAYPOST_ORIENTATION_RADIUS } from "../src/simulation/wayposts";
import {
  PALISADE_MAX_SEGMENTS,
  createPalisadeSites,
  palisadeNewSegmentCount,
  palisadePlanningTileAvailable,
  planPalisadePath,
  validPalisadePlanningAnchors,
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


test("unfinished palisades stay walkable and completed ones block movement", async () => {
  const world = createTestWorld({ width: 20, height: 12, population: 1 });
  const [site] = createPalisadeSites(world, [{ q: 2, r: 2 }]);
  assert.ok(site?.construction);

  const { assigned, changeBuilders, tick } = await import("../src/simulation/simulation");
  const { key, tileIndex, walkable } = await import("../src/simulation/hex");
  const tile = tileIndex(world.tiles).get(key(site.position))!;
  assert.equal(walkable(tile), true);

  site.construction.delivered.wood = 1;
  assert.equal(changeBuilders(world, 1), true);
  for (let i = 0; i < CONFIG.simulationHz * 4 && !site.construction.complete; i++) tick(world);

  assert.equal(site.construction.complete, true);
  assert.equal(tile.buildingBlocking, true);
  assert.equal(walkable(tile), false);
  assert.ok(assigned(world, site.id, "builder").length <= 1);
});

test("at most one builder is assigned to one palisade site", async () => {
  const world = createTestWorld({ width: 20, height: 12, population: 2 });
  const [site] = createPalisadeSites(world, [{ q: 2, r: 2 }]);
  assert.ok(site);

  const { assigned, changeBuilders, tick } = await import("../src/simulation/simulation");
  assert.equal(changeBuilders(world, 1), true);
  assert.equal(changeBuilders(world, 1), true);
  tick(world);

  assert.equal(assigned(world, site.id, "builder").length, 1);
});


test("palisade planning stops at the edge of waypost coverage without failing", () => {
  const world = createTestWorld({ width: 100, height: 20, population: 0 });
  const waypost = { q: 0, r: 1 };
  world.wayposts = [{ id: "waypost-test", position: waypost, connections: [] }];

  const path = planPalisadePath(world, { q: 1, r: 1 }, { q: 40, r: 1 });

  assert.ok(path.length > 0);
  assert.ok(path.length < PALISADE_MAX_SEGMENTS);
  assert.ok(path.every((position) => hexDistance(position, waypost) <= WAYPOST_ORIENTATION_RADIUS));
  assert.notDeepEqual(path.at(-1), { q: 40, r: 1 });
});

test("one builder continues across adjacent palisade lines and works from a reachable side", async () => {
  const world = createTestWorld({ width: 30, height: 20, population: 1 });
  const hq = world.buildings.find((building) => building.id === "hq")!;
  hq.inventory ??= {};
  hq.inventory.wood = 20;

  const positions = [
    { q: 2, r: 2 }, { q: 3, r: 2 }, { q: 4, r: 2 },
    { q: 2, r: 3 }, { q: 3, r: 3 }, { q: 4, r: 3 },
  ];
  const sites = createPalisadeSites(world, positions);
  assert.equal(sites.length, positions.length);

  const { builders, changeBuilders, tick } = await import("../src/simulation/simulation");
  assert.equal(changeBuilders(world, 1), true);

  for (let i = 0; i < CONFIG.simulationHz * 90 && sites.some((site) => !site.construction?.complete); i++) {
    tick(world);
    const builder = builders(world)[0]!;
    const assignedSite = builder.assignment
      ? world.buildings.find((building) => building.id === builder.assignment!.building)
      : undefined;
    if (assignedSite?.kind === "palisade" && !builder.trip) {
      const destination = builder.path.at(-1) ?? builder.position;
      assert.equal(hexDistance(destination, assignedSite.position), 1);
      assert.equal(
        sites.some((site) => site.id !== assignedSite.id && hexDistance(destination, site.position) === 0),
        false,
      );
    }
  }

  assert.ok(sites.every((site) => site.construction?.complete));
});


test("existing palisades are valid planning cells, including the start, but are not rebuilt", async () => {
  const world = createTestWorld({ width: 30, height: 14, population: 0 });
  const existing = createPalisadeSites(world, [
    { q: 1, r: 2 },
    { q: 2, r: 2 },
  ]);
  assert.equal(existing.length, 2);

  const { key, tileIndex } = await import("../src/simulation/hex");
  const tiles = tileIndex(world.tiles);
  for (const site of existing) {
    site.construction!.complete = true;
    tiles.get(key(site.position))!.buildingBlocking = true;
  }

  assert.equal(palisadePlanningTileAvailable(world, { q: 1, r: 2 }), true);
  assert.ok(validPalisadePlanningAnchors(world).some((position) => position.q === 1 && position.r === 2));

  const path = planPalisadePath(world, { q: 1, r: 2 }, { q: 4, r: 2 });
  assert.deepEqual(path[0], { q: 1, r: 2 });
  assert.ok(path.some((position) => position.q === 2 && position.r === 2));
  assert.equal(path.length, 4);
  assert.equal(palisadeNewSegmentCount(world, path), 2);

  const created = createPalisadeSites(world, path);
  assert.deepEqual(created.map((site) => site.position), [
    { q: 3, r: 2 },
    { q: 4, r: 2 },
  ]);
  assert.equal(world.buildings.filter((building) => building.kind === "palisade" && !building.retired).length, 4);
});

test("existing palisades still count toward the 50-step planning limit", async () => {
  const world = createTestWorld({ width: 140, height: 12, population: 0 });
  const existing = createPalisadeSites(world, Array.from({ length: 10 }, (_, index) => ({
    q: -60 + index,
    r: 2,
  })));
  const { key, tileIndex } = await import("../src/simulation/hex");
  const tiles = tileIndex(world.tiles);
  for (const site of existing) {
    site.construction!.complete = true;
    tiles.get(key(site.position))!.buildingBlocking = true;
  }

  const path = planPalisadePath(world, { q: -60, r: 2 }, { q: 60, r: 2 });
  assert.equal(path.length, PALISADE_MAX_SEGMENTS);
  assert.equal(palisadeNewSegmentCount(world, path), PALISADE_MAX_SEGMENTS - existing.length);
});
