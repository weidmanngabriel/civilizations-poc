import test from "node:test";
import assert from "node:assert/strict";
import { buildWithFootprint, footprintAt, removeBuildingWithFootprint, validBuildingAnchors } from "../src/simulation/buildingPlacement";
import { findPathBySteps } from "../src/simulation/hex";
import { advanceHungerTick } from "../src/simulation/needs";
import { createDefaultGameWorld, createWorld, CONFIG } from "../src/simulation/scenario";
import { tick } from "../src/simulation/simulation";
import type { Building } from "../src/simulation/model";

test("start world has twelve people, HQ bread, initial roles and forty-two bushes", () => {
  const world = createDefaultGameWorld();
  const hq = world.buildings.find((building) => building.id === "hq")!;

  assert.equal(world.people.length, 12);
  assert.equal(hq.inventory?.bread, 10);
  assert.equal(world.tiles.filter((tile) => tile.bush).length, 42);
  assert.equal(
    world.people.filter(
      (person) => person.assignment?.building === "hq" && person.assignment.role === "carrier",
    ).length,
    1,
  );
  assert.equal(world.people.filter((person) => person.builder).length, 2);
  assert.equal(world.people.filter((person) => person.woodcutter).length, 2);
  assert.equal(
    world.people.filter((person) => !person.assignment && !person.builder && !person.woodcutter).length,
    7,
  );
});

test("HQ bread is a valid food source", () => {
  const world = createDefaultGameWorld();
  const hq = world.buildings.find((building) => building.id === "hq")!;
  const person = world.people[5]!;
  person.hunger = 20;

  advanceHungerTick(world);

  assert.equal(person.hunger, 100);
  assert.equal(hq.inventory?.bread, 9);
  assert.equal(person.hungerState, undefined);
});

test("berries restore forty hunger and regrow after two to three minutes", () => {
  const world = createDefaultGameWorld();
  const bush = world.tiles.find((tile) => tile.bush && tile.bushAvailable)!;
  const person = world.people[5]!;
  person.position = { q: bush.q, r: bush.r };
  person.hunger = 20;

  world.buildings.find((building) => building.id === "hq")!.inventory!.bread = 0;
  advanceHungerTick(world);

  assert.equal(person.hunger, 60);
  assert.equal(bush.bushAvailable, false);
  assert.ok(bush.bushRegrowTick !== undefined);
  assert.ok(bush.bushRegrowTick! >= CONFIG.bushRegrowMinTicks);
  assert.ok(bush.bushRegrowTick! <= CONFIG.bushRegrowMaxTicks);

  world.round = bush.bushRegrowTick!;
  advanceHungerTick(world);
  assert.equal(bush.bushAvailable, true);
  assert.equal(bush.bushRegrowTick, undefined);
});

test("building over a bush removes it permanently and demolition restores grass", () => {
  const world = createWorld();
  const anchor = validBuildingAnchors(world, "warehouse")[0]!;
  const footprint = footprintAt("warehouse", anchor);
  const bushTile = world.tiles.find(
    (tile) => tile.q === footprint[0]!.q && tile.r === footprint[0]!.r,
  )!;
  bushTile.bush = true;
  bushTile.bushAvailable = true;

  const building = buildWithFootprint(world, anchor, "warehouse");
  assert.ok(building);
  assert.equal(bushTile.bush, undefined);
  assert.equal(bushTile.bushAvailable, undefined);

  assert.equal(removeBuildingWithFootprint(world, building!.id), true);
  assert.equal(bushTile.terrain, "grass");
  assert.equal(bushTile.bush, undefined);
});

test("an HQ carrier collects nearby production output into HQ inventory", () => {
  const world = createWorld(1);
  const hq = world.buildings.find((building) => building.id === "hq")!;
  const carrier = world.people[0]!;
  carrier.assignment = { building: "hq", role: "carrier" };
  carrier.active = true;
  hq.carriers = 1;
  hq.inventory ??= {};

  const sourceTile = world.tiles.find((tile) => {
    if (tile.terrain !== "grass") return false;
    const path = findPathBySteps(world.tiles, hq.position, tile);
    return path !== null && path.length >= 2 && path.length <= 5;
  })!;
  const source: Building = {
    id: "test-source",
    kind: "sawmill",
    name: "Testquelle",
    position: { q: sourceTile.q, r: sourceTile.r },
    workers: 0,
    carriers: 0,
    input: 0,
    output: 1,
    recipe: { amount: 0, output: "wood", duration: CONFIG.duration },
  };
  world.buildings.push(source);

  for (let i = 0; i < 1000; i += 1) tick(world);

  assert.equal(hq.inventory?.wood, 1);
  assert.equal(source.output, 0);
});
