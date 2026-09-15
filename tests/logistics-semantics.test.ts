import assert from "node:assert/strict";
import test from "node:test";
import { buildWithFootprint, canPlaceBuilding } from "../src/simulation/buildingPlacement";
import { findPathBySteps } from "../src/simulation/hex";
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

function grassAtDistance(
  world: World,
  origin: Hex,
  predicate: (steps: number) => boolean,
): Hex {
  for (const tile of world.tiles) {
    if (tile.terrain !== "grass") continue;
    const path = findPathBySteps(world.tiles, origin, tile);
    if (path && predicate(path.length)) return { q: tile.q, r: tile.r };
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
    const storage = storageKind === "hq"
      ? nearWorld.buildings.find((building) => building.id === "hq")!
      : buildAt(
          nearWorld,
          grassAtDistance(
            nearWorld,
            nearWorld.buildings.find((building) => building.id === "hq")!.position,
            (steps) => steps >= 2,
          ),
          "warehouse",
        )!;
    const nearSourcePosition = grassAtDistance(
      nearWorld,
      storage.position,
      (steps) => steps >= CONFIG.warehouseCollectionRadius - 2 && steps <= CONFIG.warehouseCollectionRadius,
    );
    const nearSource = buildAt(nearWorld, nearSourcePosition, "sawmill")!;
    nearSource.output = 1;
    assert.equal(changeAssignment(nearWorld, storage.id, "carrier", 1), true);
    const nearCarrier = activateAtHome(nearWorld, storage.id, "carrier");
    tick(nearWorld);
    assert.equal(nearCarrier.trip?.source, nearSource.id, `${storageKind} should collect inside radius`);

    const farWorld = createWorld(2);
    const farStorage = storageKind === "hq"
      ? farWorld.buildings.find((building) => building.id === "hq")!
      : buildAt(
          farWorld,
          grassAtDistance(
            farWorld,
            farWorld.buildings.find((building) => building.id === "hq")!.position,
            (steps) => steps >= 2,
          ),
          "warehouse",
        )!;
    const farSourcePosition = grassAtDistance(
      farWorld,
      farStorage.position,
      (steps) => steps > CONFIG.warehouseCollectionRadius,
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
  const sourcePosition = grassAtDistance(
    world,
    world.buildings.find((building) => building.id === "hq")!.position,
    (steps) => steps >= 2,
  );
  const source = buildAt(world, sourcePosition, "warehouse")!;
  const targetPosition = grassAtDistance(
    world,
    source.position,
    (steps) => steps > CONFIG.warehouseCollectionRadius,
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
  const sourcePosition = grassAtDistance(
    world,
    site.position,
    (steps) => steps > CONFIG.warehouseCollectionRadius,
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
