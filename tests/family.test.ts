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
import { advanceHungerTick, resolveFoodArrivals } from "../src/simulation/needs";
import { advanceSleepTick } from "../src/simulation/sleep";
import { syncWorkAreas } from "../src/simulation/workAreas";
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


test("active birth journey yields to hunger and resumes after eating", () => {
  const world = createTestWorld({ population: 2 });
  world.households = [];
  world.nextHouseholdId = 1;
  const [first, second] = adultPair(world);
  const house = addHouse(world, "house-a", 6);

  first.spouseId = second.id;
  second.spouseId = first.id;
  assert.equal(assignPersonHome(world, first.id, house.id), true);
  assert.equal(first.householdId, second.householdId);

  first.position = { q: 0, r: 0 };
  second.position = { ...house.position };
  world.buildings.find((building) => building.id === "hq")!.inventory!.bread = 2;

  first.familyTask = { kind: "birth", partnerId: second.id, homeId: house.id };
  second.familyTask = { kind: "birth", partnerId: first.id, homeId: house.id };
  first.hunger = 20;
  second.hunger = 100;

  advanceHungerTick(world);

  assert.ok(first.hungerState);
  assert.equal(first.familyTask?.kind, "birth");

  const foodPath = first.path.map((step) => ({ ...step }));
  advanceFamily(world);
  assert.deepEqual(first.path, foodPath);

  if (first.hungerState?.eatingUntilTick === undefined)
    resolveFoodArrivals(world);
  assert.ok(first.hungerState?.eatingUntilTick !== undefined);

  world.round = first.hungerState!.eatingUntilTick!;
  resolveFoodArrivals(world);

  assert.equal(first.hungerState, undefined);
  assert.equal(first.path.length, 0);

  advanceFamily(world);

  assert.ok(first.path.length > 0);
  assert.deepEqual(first.path.at(-1), house.position);
});

test("active birth journey keeps its planned home route between family ticks", () => {
  const world = createTestWorld({ population: 2 });
  world.households = [];
  world.nextHouseholdId = 1;
  const [first, second] = adultPair(world);
  const house = addHouse(world, "house-a", 12);

  first.spouseId = second.id;
  second.spouseId = first.id;
  assert.equal(assignPersonHome(world, first.id, house.id), true);

  first.position = { q: 0, r: 0 };
  second.position = { ...house.position };
  first.familyTask = { kind: "birth", partnerId: second.id, homeId: house.id };
  second.familyTask = { kind: "birth", partnerId: first.id, homeId: house.id };

  advanceFamily(world);
  assert.ok(first.path.length > 0);
  const plannedPath = first.path;

  world.round += 1;
  advanceFamily(world);

  assert.equal(first.path, plannedPath);
});

test("active birth journey yields to assigned-home sleep", () => {
  const world = createTestWorld({ population: 2 });
  world.households = [];
  world.nextHouseholdId = 1;
  const [first, second] = adultPair(world);
  const house = addHouse(world, "house-a", 6);

  first.spouseId = second.id;
  second.spouseId = first.id;
  assert.equal(assignPersonHome(world, first.id, house.id), true);

  first.position = { q: 0, r: 0 };
  second.position = { ...house.position };
  first.familyTask = { kind: "birth", partnerId: second.id, homeId: house.id };
  second.familyTask = { kind: "birth", partnerId: first.id, homeId: house.id };
  first.hunger = 100;
  first.sleep = 20;

  advanceSleepTick(world);

  assert.equal(first.sleepState?.kind, "house");
  assert.deepEqual(first.sleepState?.target, house.position);

  const sleepPath = first.path.map((step) => ({ ...step }));
  advanceFamily(world);

  assert.deepEqual(first.path, sleepPath);
  assert.equal(first.familyTask?.kind, "birth");
});


test("active family task prevents a woodcutter work area from reclaiming the home route", () => {
  const world = createTestWorld({ population: 2 });
  world.households = [];
  world.nextHouseholdId = 1;
  const [first, second] = adultPair(world);
  const house = addHouse(world, "house-a", 12);

  first.spouseId = second.id;
  second.spouseId = first.id;
  assert.equal(assignPersonHome(world, first.id, house.id), true);

  first.woodcutter = true;
  first.workArea = { center: { q: 0, r: 0 }, radius: 3 };
  first.resourceTarget = world.naturalResources.find((resource) => resource.kind === "forest")?.id;
  first.position = { q: 6, r: 0 };
  first.familyTask = { kind: "birth", partnerId: second.id, homeId: house.id };
  first.path = [{ q: 7, r: 0 }, { q: 8, r: 0 }, { q: 9, r: 0 }, { q: 10, r: 0 }, { q: 11, r: 0 }, { ...house.position }];
  const familyPath = first.path.map((step) => ({ ...step }));

  syncWorkAreas(world);

  assert.deepEqual(first.path, familyPath);
  assert.equal(first.familyTask?.kind, "birth");
});


test("birth sequence creates children at 7.5 seconds and releases rested parents at 15 seconds", () => {
  const world = createTestWorld({ population: 2 });
  world.households = [];
  world.nextHouseholdId = 1;
  const [first, second] = adultPair(world);
  const house = addHouse(world, "house-family-sequence", 6);

  first.spouseId = second.id;
  second.spouseId = first.id;
  assert.equal(assignPersonHome(world, first.id, house.id), true);
  first.position = { ...house.position };
  second.position = { ...house.position };
  first.sleep = 23;
  second.sleep = 41;
  first.familyTask = { kind: "birth", partnerId: second.id, homeId: house.id };
  second.familyTask = { kind: "birth", partnerId: first.id, homeId: house.id };

  const startTick = world.round;
  advanceFamily(world);

  const effect = world.familyEffects?.[0];
  assert.ok(effect);
  assert.equal(effect.storkStartsAtTick - startTick, 5 * 60);
  assert.equal(effect.birthAtTick - startTick, 7.5 * 60);
  assert.equal(effect.storkEndsAtTick - startTick, 10 * 60);
  assert.equal(effect.expiresAtTick - startTick, 15 * 60);

  world.round = effect.birthAtTick - 1;
  advanceFamily(world);
  assert.equal(world.people.length, 2);
  assert.equal(first.familyTask?.kind, "birth");

  world.round = effect.birthAtTick;
  advanceFamily(world);
  assert.ok(world.people.length > 2);
  const populationAfterBirth = world.people.length;
  const newborns = world.people.filter((person) => person.ageStage === "child");
  assert.ok(newborns.length > 0);
  assert.ok(newborns.every((child) => child.nextChildWanderTick === effect.expiresAtTick));
  assert.equal(first.familyTask?.kind, "birth");

  world.round = effect.expiresAtTick - 1;
  advanceFamily(world);
  assert.equal(world.people.length, populationAfterBirth);
  assert.equal(first.familyTask?.kind, "birth");

  world.round = effect.expiresAtTick;
  advanceFamily(world);
  assert.equal(first.familyTask, undefined);
  assert.equal(second.familyTask, undefined);
  assert.equal(first.sleep, 100);
  assert.equal(second.sleep, 100);
});
