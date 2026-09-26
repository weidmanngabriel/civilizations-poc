import assert from "node:assert/strict";
import test from "node:test";
import type { Building, HouseLevel, World } from "../src/simulation/model";
import {
  HOUSE_LEVEL_DEFINITIONS,
  assignPersonHome,
  homeForPerson,
  houseDirectCost,
  householdsForHouse,
  validHomes,
} from "../src/simulation/housing";
import {
  footprintAt,
  startBuildingUpgrade,
  upgradePlacementBlockers,
} from "../src/simulation/buildingPlacement";
import { createTestWorld } from "./testWorld";

const house = (id: string, level: HouseLevel): Building => ({
  id,
  kind: "house",
  name: "Wohnhaus",
  position: { q: level * 3, r: 0 },
  workers: 0,
  carriers: 0,
  merchants: 0,
  input: 0,
  output: 0,
  houseLevel: level,
  construction: {
    required: {},
    delivered: {},
    duration: 1,
    progress: 1,
    complete: true,
  },
});

const addHouse = (world: World, id: string, level: HouseLevel): Building => {
  const building = house(id, level);
  world.buildings.push(building);
  return building;
};

test("house levels provide two through six apartments", () => {
  assert.deepEqual(
    ([1, 2, 3, 4, 5] as HouseLevel[]).map(
      (level) => HOUSE_LEVEL_DEFINITIONS[level].apartments,
    ),
    [2, 3, 4, 5, 6],
  );
});

test("direct house construction accumulates every previous upgrade cost", () => {
  assert.deepEqual(houseDirectCost(1), {
    rubble: 2,
    wood: 2,
    wheat: 1,
    clay: 2,
  });
  assert.deepEqual(houseDirectCost(5), {
    rubble: 2,
    wood: 10,
    wheat: 1,
    clay: 2,
    brick: 5,
    stoneBlock: 5,
    roofTile: 5,
    marble: 5,
  });
});

test("one apartment holds one household and full houses stop accepting residents", () => {
  const world = createTestWorld({ population: 3 });
  const target = addHouse(world, "house-a", 1);

  assert.equal(assignPersonHome(world, 1, target.id), true);
  assert.equal(assignPersonHome(world, 2, target.id), true);
  assert.equal(assignPersonHome(world, 3, target.id), false);

  assert.equal(householdsForHouse(world, target.id).length, 2);
  assert.equal(homeForPerson(world, world.people[0]!)?.id, target.id);
  assert.equal(validHomes(world, 3).some((building) => building.id === target.id), false);
});

test("moving a resident moves the existing household and frees the previous apartment", () => {
  const world = createTestWorld({ population: 2 });
  const first = addHouse(world, "house-a", 1);
  const second = addHouse(world, "house-b", 1);

  assert.equal(assignPersonHome(world, 1, first.id), true);
  const householdId = world.people[0]!.householdId;
  assert.ok(householdId);

  assert.equal(assignPersonHome(world, 1, second.id), true);
  assert.equal(world.people[0]!.householdId, householdId);
  assert.equal(householdsForHouse(world, first.id).length, 0);
  assert.equal(householdsForHouse(world, second.id).length, 1);

  assert.equal(assignPersonHome(world, 2, first.id), true);
});

test("house upgrades request only the next level materials and keep current apartments usable", () => {
  const world = createTestWorld();
  const target = addHouse(world, "house-a", 3);
  assert.equal(assignPersonHome(world, world.people[0]!.id, target.id), true);

  assert.equal(startBuildingUpgrade(world, target), true);
  assert.equal(target.houseLevel, 3);
  assert.equal(target.houseUpgradeTarget, 4);
  assert.deepEqual(target.construction?.required, {
    wood: 2,
    brick: 1,
    stoneBlock: 1,
    roofTile: 4,
  });
  assert.equal(target.construction?.complete, false);
  assert.equal(homeForPerson(world, world.people[0]!)?.id, target.id);
  assert.equal(HOUSE_LEVEL_DEFINITIONS[target.houseLevel!].apartments, 4);
});


test("house upgrades keep their current geometry until a target visual level is authored", () => {
  const world = createTestWorld({ population: 0 });
  const target = addHouse(world, "house-upgrade-space", 1);
  target.position = { q: 4, r: 0 };
  target.footprint = [{ ...target.position }];
  const before = target.footprint.map((cell) => ({ ...cell }));

  assert.deepEqual(upgradePlacementBlockers(world, target), []);
  assert.equal(startBuildingUpgrade(world, target), true);
  assert.deepEqual(target.footprint, before);
  assert.equal(target.houseUpgradeTarget, 2);
});
