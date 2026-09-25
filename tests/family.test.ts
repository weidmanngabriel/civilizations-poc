import assert from "node:assert/strict";
import test from "node:test";
import type { Building, Person, World } from "../src/simulation/model";
import {
  BABY_STAGE_TICKS,
  BIRTH_POLICY_RULES,
  CHILDHOOD_TICKS,
  advanceFamily,
  areCloseRelatives,
  birthCountFromRoll,
  canSearchForPartner,
  childVisualStage,
  startPartnerSearch,
} from "../src/simulation/family";
import { assignPersonHome, householdForPerson, householdsForHouse } from "../src/simulation/housing";
import { orderPersonMove } from "../src/simulation/personCommands";
import { createTestWorld } from "./testWorld";

const addHouse = (world: World, id: string, q: number): Building => {
  const house: Building = {
    id,
    kind: "house",
    name: "Wohnhaus",
    position: { q, r: 0 },
    workers: 0,
    carriers: 0,
    merchants: 0,
    input: 0,
    output: 0,
    houseLevel: 1,
    construction: {
      required: {},
      delivered: {},
      duration: 1,
      progress: 1,
      complete: true,
    },
  };
  world.buildings.push(house);
  return house;
};

const adultPair = (world: World): [Person, Person] => {
  const first = world.people[0]!;
  const second = world.people[1]!;
  first.sex = "male";
  second.sex = "female";
  first.ageStage = "adult";
  second.ageStage = "adult";
  first.parentIds = [];
  second.parentIds = [];
  first.childIds = [];
  second.childIds = [];
  first.position = { q: 2, r: 0 };
  second.position = { q: 3, r: 0 };
  return [first, second];
};

test("birth policy uses the agreed low, medium and high cadence", () => {
  assert.deepEqual(
    Object.fromEntries(Object.entries(BIRTH_POLICY_RULES).map(([key, rule]) => [
      key,
      { seconds: rule.intervalTicks / 60, chance: rule.chance },
    ])),
    {
      low: { seconds: 180, chance: 0.15 },
      medium: { seconds: 120, chance: 0.3 },
      high: { seconds: 60, chance: 0.5 },
    },
  );
});

test("birth count distribution thresholds are 90/9/1", () => {
  assert.equal(birthCountFromRoll(0), 1);
  assert.equal(birthCountFromRoll(0.899999), 1);
  assert.equal(birthCountFromRoll(0.9), 2);
  assert.equal(birthCountFromRoll(0.989999), 2);
  assert.equal(birthCountFromRoll(0.99), 3);
  assert.equal(birthCountFromRoll(0.999999), 3);
});

test("partner search marries compatible adults and merges two apartments", () => {
  const world = createTestWorld({ population: 2 });
  world.households = [];
  world.nextHouseholdId = 1;
  const [first, second] = adultPair(world);
  const firstHouse = addHouse(world, "house-a", 6);
  const secondHouse = addHouse(world, "house-b", 9);
  assert.equal(assignPersonHome(world, first.id, firstHouse.id), true);
  assert.equal(assignPersonHome(world, second.id, secondHouse.id), true);

  assert.equal(canSearchForPartner(world, first), true);
  assert.equal(startPartnerSearch(world, first.id), true);
  advanceFamily(world);
  advanceFamily(world);

  assert.equal(first.spouseId, second.id);
  assert.equal(second.spouseId, first.id);
  assert.ok(first.householdId);
  assert.equal(first.householdId, second.householdId);
  assert.equal(
    householdsForHouse(world, firstHouse.id).length + householdsForHouse(world, secondHouse.id).length,
    1,
  );
});

test("one housed spouse brings the other spouse into the same household", () => {
  const world = createTestWorld({ population: 2 });
  world.households = [];
  world.nextHouseholdId = 1;
  const [first, second] = adultPair(world);
  const house = addHouse(world, "house-a", 6);
  assert.equal(assignPersonHome(world, first.id, house.id), true);

  assert.equal(startPartnerSearch(world, second.id), true);
  advanceFamily(world);
  advanceFamily(world);

  assert.equal(second.spouseId, first.id);
  assert.equal(second.householdId, first.householdId);
  assert.deepEqual(
    new Set(householdForPerson(world, first)?.memberIds),
    new Set([first.id, second.id]),
  );
});

test("parents, children and siblings are excluded as marriage candidates", () => {
  const world = createTestWorld({ population: 3 });
  const [parent, child, sibling] = world.people;
  parent!.sex = "male";
  child!.sex = "female";
  sibling!.sex = "male";
  parent!.ageStage = "adult";
  child!.ageStage = "adult";
  sibling!.ageStage = "adult";
  child!.parentIds = [parent!.id];
  sibling!.parentIds = [parent!.id];

  assert.equal(areCloseRelatives(parent!, child!), true);
  assert.equal(areCloseRelatives(child!, sibling!), true);
  assert.equal(canSearchForPartner(world, child!), false);
});

test("child changes visual stage halfway through five-minute childhood then becomes unhoused adult", () => {
  const world = createTestWorld({ population: 2 });
  world.households = [];
  world.nextHouseholdId = 1;
  const parent = world.people[0]!;
  const child = world.people[1]!;
  parent.sex = "female";
  parent.ageStage = "adult";
  parent.childIds = [child.id];
  child.sex = "male";
  child.ageStage = "child";
  child.bornAtTick = 0;
  child.parentIds = [parent.id];
  child.childIds = [];
  child.hunger = undefined;
  child.sleep = undefined;
  const house = addHouse(world, "house-a", 6);
  assert.equal(assignPersonHome(world, parent.id, house.id), true);
  const household = householdForPerson(world, parent)!;
  household.memberIds.push(child.id);
  child.householdId = household.id;

  world.round = BABY_STAGE_TICKS - 1;
  assert.equal(childVisualStage(world, child), "baby");
  world.round = BABY_STAGE_TICKS;
  assert.equal(childVisualStage(world, child), "child");

  world.round = CHILDHOOD_TICKS;
  advanceFamily(world);

  assert.equal(child.ageStage, "adult");
  assert.equal(child.householdId, undefined);
  assert.equal(child.hunger, 100);
  assert.equal(child.sleep, 100);
  assert.equal(household.memberIds.includes(child.id), false);
});

test("children cannot receive manual movement orders", () => {
  const world = createTestWorld({ population: 1 });
  const child = world.people[0]!;
  child.ageStage = "child";
  child.hunger = undefined;
  child.sleep = undefined;

  assert.equal(orderPersonMove(world, child.id, { q: 1, r: 0 }), false);
});
