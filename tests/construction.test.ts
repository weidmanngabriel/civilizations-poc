import { test } from "node:test";
import assert from "node:assert/strict";
import { createWorld } from "../src/simulation/scenario";
import { neighbors, same } from "../src/simulation/hex";
import {
  buildWithFootprint,
  canPlaceBuilding,
} from "../src/simulation/buildingPlacement";
import {
  assigned,
  changeAssignment,
  isUnderConstruction,
  tick,
} from "../src/simulation/simulation";

test("placed buildings are construction sites until a builder delivers materials and builds them", () => {
  const world = createWorld();
  const origin = world.tiles.find((tile) => canPlaceBuilding(world, tile, "warehouse"));
  assert.ok(origin);

  const site = buildWithFootprint(world, origin!, "warehouse");
  assert.ok(site);
  assert.equal(isUnderConstruction(site!), true);
  assert.equal(changeAssignment(world, site!.id, "carrier", 1), false);
  assert.equal(changeAssignment(world, site!.id, "builder", 1), true);

  const sourcePosition = neighbors(site!.position).find((position) =>
    world.tiles.some(
      (tile) => same(tile, position) && (tile.terrain === "grass" || tile.terrain === "road"),
    ),
  );
  assert.ok(sourcePosition);
  world.buildings.push({
    id: "test-wood-source",
    kind: "forest",
    name: "Testholz",
    position: { ...sourcePosition! },
    workers: 0,
    carriers: 0,
    input: 0,
    output: 4,
    recipe: { amount: 0, output: "wood", duration: 1 },
  });

  for (let i = 0; i < 2000 && isUnderConstruction(site!); i++) tick(world);

  assert.equal(site!.construction?.delivered.wood, 4);
  assert.equal(isUnderConstruction(site!), false);
  assert.equal(assigned(world, site!.id, "builder").length, 0);
  assert.equal(changeAssignment(world, site!.id, "carrier", 1), true);
});

test("carpenter construction requires planks instead of wood", () => {
  const world = createWorld();
  const origin = world.tiles.find((tile) => canPlaceBuilding(world, tile, "carpenter"));
  assert.ok(origin);
  const site = buildWithFootprint(world, origin!, "carpenter");
  assert.ok(site);
  assert.deepEqual(site!.construction?.required, { plank: 4 });
});
