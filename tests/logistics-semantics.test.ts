import assert from "node:assert/strict";
import test from "node:test";
import { buildWithFootprint, canPlaceBuilding } from "../src/simulation/buildingPlacement";
import { findPathBySteps, hexDistance } from "../src/simulation/hex";
import type { Hex, World } from "../src/simulation/model";
import { CONFIG, createWorld } from "../src/simulation/scenario";
import { GRID_REFINEMENT } from "../src/simulation/spatial";
import {
  assigned,
  buildAt,
  changeAssignment,
  changeBuilders,
  setMerchantRoute,
  tick,
} from "../src/simulation/simulation";

function grassAtReachableDistance(
  world: World,
  origin: Hex,
  minSteps: number,
  maxSteps = Number.POSITIVE_INFINITY,
): Hex {
  const candidates = world.tiles
    .filter((tile) => {
      if (tile.terrain !== "grass") return false;
      const distance = hexDistance(origin, tile);
      return distance >= minSteps && distance <= maxSteps;
    })
    .sort(
      (a, b) =>
        hexDistance(origin, a) - hexDistance(origin, b) || a.r - b.r || a.q - b.q,
    );

  for (const tile of candidates.slice(0, 80)) {
    const path = findPathBySteps(world.tiles, origin, tile);
    if (path && path.length >= minSteps && path.length <= maxSteps)
      return { q: tile.q, r: tile.r };
  }
  assert.fail("expected suitable reachable grass tile");
}

function activateAtHome(world: World, buildingId: string, role: "carrier" | "merchant") {
  const person = assigned(world, buildingId, role)[0]!;
  const home = world.buildings.find((building) => building.id === buildingId)!;
  person.position = { ...home.position };
  person.path = [];
  person.movement = 0;
  person.active = true;
  return person;
}

test("warehouse and HQ collection radius is five coarse world tiles", () => {
  assert.equal(CONFIG.warehouseCollectionRadiusWorldTiles, 5);
  assert.equal(CONFIG.warehouseCollectionRadius, 5 * GRID_REFINEMENT);

  for (const storageKind of ["warehouse", "hq"] as const) {
    const nearWorld = createWorld(2);
    const nearHq = nearWorld.buildings.find((building) => building.id === "hq")!;
    const storage = storageKind === "hq"
      ? nearHq
      : buildAt(nearWorld, grassAtReachableDistance(nearWorld, nearHq.position, 2, 8), "warehouse")!;
    const nearSourcePosition = grassAtReachableDistance(
      nearWorld,
      storage.position,
      CONFIG.warehouseCollectionRadius - 2,
      CONFIG.warehouseCollectionRadius,
    );
    const nearSource = buildAt(nearWorld, nearSourcePosition, "sawmill")!;
    nearSource.output = 1;
    assert.equal(changeAssignment(nearWorld, storage.id, "carrier", 1), true);
    const nearCarrier = activateAtHome(nearWorld, storage.id, "carrier");
    tick(nearWorld);
    assert.equal(nearCarrier.trip?.source, nearSource.id, `${storageKind} should collect inside radius`);

    const farWorld = createWorld(2);
    const farHq = farWorld.buildings.find((building) => building.id === "hq")!;
    const farStorage = storageKind === "hq"
      ? farHq
      : buildAt(farWorld, grassAtReachableDistance(farWorld, farHq.position, 2, 8), "warehouse")!;
    const farSourcePosition = grassAtReachableDistance(
      farWorld,
      farStorage.position,
      CONFIG.warehouseCollectionRadius + 1,
      CONFIG.warehouseCollectionRadius + 8,
    );
    const farSource = buildAt(farWorld, farSourcePosition, "sawmill")!;
    farSource.output = 1;
    assert.equal(changeAssignment(farWorld, farStorage.id, "carrier", 1), true);
    const farCarrier = activateAtHome(farWorld, farStorage.id, "carrier");
    tick(farWorld);
    assert.equal(farCarrier.trip, undefined, `${storageKind} must ignore sources outside radius`);
    assert.equal(farSource.output, 1);
  }
});

test("merchant routes are not limited by the warehouse collection radius", () => {
  const world = createWorld(1);
  const hq = world.buildings.find((building) => building.id === "hq")!;
  const source = buildAt(world, grassAtReachableDistance(world, hq.position, 2, 8), "warehouse")!;
  const targetPosition = grassAtReachableDistance(
    world,
    source.position,
    CONFIG.warehouseCollectionRadius + 1,
    CONFIG.warehouseCollectionRadius + 8,
  );
  const target = buildAt(world, targetPosition, "warehouse")!;
  assert.ok(findPathBySteps(world.tiles, source.position, target.position)!.length > CONFIG.warehouseCollectionRadius);
  source.inventory!.wood = 1;

  assert.equal(changeAssignment(world, source.id, "merchant", 1), true);
  const merchant = activateAtHome(world, source.id, "merchant");
  assert.equal(setMerchantRoute(world, merchant.id, target.id, "wood"), true);
  tick(world);

  assert.equal(merchant.trip?.source, source.id);
  assert.equal(merchant.trip?.target, target.id);
  assert.equal(merchant.trip?.good, "wood");
});

test("builders may fetch construction material beyond the warehouse collection radius", () => {
  const world = createWorld(1);
  const sitePosition = world.tiles.find((tile) => canPlaceBuilding(world, tile, "warehouse"));
  assert.ok(sitePosition);
  const site = buildWithFootprint(world, sitePosition!, "warehouse")!;
  const sourcePosition = grassAtReachableDistance(
    world,
    site.position,
    CONFIG.warehouseCollectionRadius + 1,
    CONFIG.warehouseCollectionRadius + 8,
  );
  const source = buildAt(world, sourcePosition, "warehouse")!;
  source.inventory!.wood = 4;
  assert.ok(findPathBySteps(world.tiles, site.position, source.position)!.length > CONFIG.warehouseCollectionRadius);

  assert.equal(changeBuilders(world, 1), true);
  tick(world);

  const builder = assigned(world, site.id, "builder")[0]!;
  assert.equal(builder.trip?.source, source.id);
  assert.equal(builder.trip?.target, site.id);
  assert.equal(builder.trip?.good, "wood");
});
