import { test } from "node:test";
import assert from "node:assert/strict";
import { createWorld, CONFIG } from "../src/simulation/scenario";
import { neighbors, same } from "../src/simulation/hex";
import {
  buildWithFootprint,
  canPlaceBuilding,
  CONSTRUCTION_PLANS,
} from "../src/simulation/buildingPlacement";
import {
  assigned,
  builders,
  changeAssignment,
  changeBuilders,
  isUnderConstruction,
  tick,
} from "../src/simulation/simulation";

test("builder pool automatically assigns builders and completes construction", () => {
  const world = createWorld();
  const origin = world.tiles.find((tile) => canPlaceBuilding(world, tile, "warehouse"));
  assert.ok(origin);

  const site = buildWithFootprint(world, origin!, "warehouse");
  assert.ok(site);
  assert.equal(isUnderConstruction(site!), true);
  assert.equal(changeAssignment(world, site!.id, "carrier", 1), false);
  assert.equal(changeAssignment(world, site!.id, "builder", 1), false);
  assert.equal(changeBuilders(world, 1), true);
  assert.equal(assigned(world, site!.id, "builder").length, 1);
  assert.equal(builders(world).length, 1);

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

  for (let i = 0; i < 3000 && isUnderConstruction(site!); i++) tick(world);

  assert.equal(site!.construction?.delivered.wood, 4);
  assert.equal(isUnderConstruction(site!), false);
  assert.equal(assigned(world, site!.id, "builder").length, 0);
  assert.equal(builders(world).length, 1);
  assert.equal(changeAssignment(world, site!.id, "carrier", 1), true);
});

test("newly assigned builder goes directly to available construction material", () => {
  const world = createWorld();
  const origin = world.tiles.find((tile) => canPlaceBuilding(world, tile, "warehouse"));
  assert.ok(origin);
  const site = buildWithFootprint(world, origin!, "warehouse")!;
  const sourcePosition = world.tiles.find((tile) => tile.terrain === "grass" && !same(tile, site.position));
  assert.ok(sourcePosition);
  world.buildings.push({ id: "ready-wood-source", kind: "forest", name: "Bereites Holz", position: { q: sourcePosition!.q, r: sourcePosition!.r }, workers: 0, carriers: 0, input: 0, output: 4, recipe: { amount: 0, output: "wood", duration: 1 } });
  assert.equal(changeBuilders(world, 1), true);
  const builder = assigned(world, site.id, "builder")[0]!;
  assert.equal(builder.trip?.source, "ready-wood-source");
  assert.equal(builder.trip?.target, site.id);
  assert.equal(builder.trip?.picked, false);
  const destination = builder.path.at(-1) ?? builder.position;
  assert.ok(same(destination, sourcePosition!));
  assert.equal(same(destination, site.position), false);
});

test("a construction site accepts at most two automatic builders", () => {
  const world = createWorld();
  const origin = world.tiles.find((tile) => canPlaceBuilding(world, tile, "warehouse"));
  assert.ok(origin);
  const site = buildWithFootprint(world, origin!, "warehouse")!;

  assert.equal(changeBuilders(world, 1), true);
  assert.equal(changeBuilders(world, 1), true);
  assert.equal(changeBuilders(world, 1), true);
  assert.equal(assigned(world, site.id, "builder").length, 2);
  assert.equal(builders(world).filter((person) => !person.assignment).length, 1);
});

test("two active builders double construction progress", () => {
  const world = createWorld();
  const origin = world.tiles.find((tile) => canPlaceBuilding(world, tile, "warehouse"));
  assert.ok(origin);
  const site = buildWithFootprint(world, origin!, "warehouse")!;
  site.construction!.delivered.wood = 4;

  assert.equal(changeBuilders(world, 1), true);
  assert.equal(changeBuilders(world, 1), true);
  const siteBuilders = assigned(world, site.id, "builder");
  assert.equal(siteBuilders.length, 2);
  for (const person of siteBuilders) {
    person.position = { ...site.position };
    person.path = [];
    person.active = true;
  }

  tick(world);
  assert.equal(site.construction!.progress, 2);
});

test("construction time is three seconds plus two seconds per resource", () => {
  assert.equal(CONSTRUCTION_PLANS.warehouse.duration, 11 * CONFIG.simulationHz);
  assert.equal(CONSTRUCTION_PLANS.sawmill.duration, 15 * CONFIG.simulationHz);
  assert.equal(CONSTRUCTION_PLANS.carpenter.duration, 11 * CONFIG.simulationHz);
  assert.deepEqual(CONSTRUCTION_PLANS.carpenter.required, { plank: 4 });
});
