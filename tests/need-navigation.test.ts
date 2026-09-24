import test from "node:test";
import assert from "node:assert/strict";
import type { Building, Person, Tile, World } from "../src/simulation/model";
import { advanceHungerTick, resolveFoodArrivals } from "../src/simulation/needs";
import { advanceSleepTick, SLEEP_RULES } from "../src/simulation/sleep";
import { findRequiredNavigationPath } from "../src/simulation/wayposts";

const lineWorld = (): World => {
  const tiles: Tile[] = Array.from({ length: 26 }, (_, q) => ({
    q,
    r: 0,
    terrain: "grass" as const,
  }));
  const person: Person = {
    id: 1,
    position: { q: 17, r: 0 },
    active: false,
    progress: 0,
    movement: 0,
    path: [],
    hunger: 20,
    sleep: 100,
  };
  return {
    round: 0,
    nextId: 2,
    nextBuildingId: 1,
    nextFieldId: 1,
    nextWaypostId: 2,
    waypostRevision: 0,
    rngState: 1,
    people: [person],
    buildings: [],
    naturalResources: [],
    wayposts: [{ id: "waypost-1", position: { q: 0, r: 0 }, connections: [] }],
    tiles,
  };
};

test("normal residents need wayposts for global travel while scouts do not", () => {
  const world = lineWorld();
  const person = world.people[0]!;
  const target = { q: 25, r: 0 };

  assert.equal(findRequiredNavigationPath(world, person, target), null);

  person.profession = "scout";
  assert.ok(findRequiredNavigationPath(world, person, target));
});

test("local hunger may leave waypost coverage and returns to the need origin", () => {
  const world = lineWorld();
  const person = world.people[0]!;
  const origin = { ...person.position };
  const bush = world.tiles.find((tile) => tile.q === 20 && tile.r === 0)!;
  bush.bush = true;
  bush.bushAvailable = true;

  advanceHungerTick(world);

  assert.deepEqual(person.hungerState?.needOrigin, origin);
  assert.equal(person.hungerState?.localNeedSearch, true);
  assert.equal(person.hungerState?.returnToNeedOrigin, true);
  assert.deepEqual(person.path.at(-1), { q: bush.q, r: bush.r });

  person.position = { q: bush.q, r: bush.r };
  person.path = [];
  resolveFoodArrivals(world);
  assert.ok(person.hungerState?.eatingUntilTick !== undefined);

  world.round = person.hungerState!.eatingUntilTick!;
  resolveFoodArrivals(world);

  assert.equal(person.hungerState?.returningToNeedOrigin, true);
  assert.deepEqual(person.path.at(-1), origin);

  person.position = { ...origin };
  person.path = [];
  advanceHungerTick(world);

  assert.equal(person.hungerState, undefined);
});

test("hungry farm worker outside waypost coverage returns to the covered farm before global food search", () => {
  const world = lineWorld();
  const person = world.people[0]!;
  person.position = { q: 20, r: 0 };
  person.hunger = 20;

  const farm: Building = {
    id: "farm-1",
    kind: "farm",
    name: "Farm",
    position: { q: 17, r: 0 },
    workers: 1,
    carriers: 0,
    input: 0,
    output: 0,
  };
  const food: Building = {
    id: "food-store",
    kind: "warehouse",
    name: "Nahrung",
    position: { q: 0, r: 0 },
    workers: 0,
    carriers: 0,
    merchants: 0,
    input: 0,
    output: 0,
    inventory: { bread: 1 },
  };
  world.buildings.push(farm, food);
  person.assignment = { building: farm.id, role: "worker" };

  advanceHungerTick(world);

  assert.equal(person.hungerState?.returningToNeedAnchor, true);
  assert.deepEqual(person.hungerState?.needAnchor, farm.position);
  assert.deepEqual(person.path.at(-1), farm.position);

  person.position = { ...farm.position };
  person.path = [];
  advanceHungerTick(world);

  assert.equal(person.hungerState?.returningToNeedAnchor, undefined);
  assert.equal(person.hungerState?.foodSource, food.id);
  assert.deepEqual(person.path.at(-1), food.position);
});

test("tired farm worker outside waypost coverage returns to the covered farm before sleep search", () => {
  const world = lineWorld();
  const person = world.people[0]!;
  person.position = { q: 20, r: 0 };
  person.hunger = 100;
  person.sleep = 20;

  const farm: Building = {
    id: "farm-1",
    kind: "farm",
    name: "Farm",
    position: { q: 17, r: 0 },
    workers: 1,
    carriers: 0,
    input: 0,
    output: 0,
  };
  const house: Building = {
    id: "house-1",
    kind: "house",
    name: "Haus",
    position: { q: 0, r: 0 },
    workers: 0,
    carriers: 0,
    input: 0,
    output: 0,
  };
  world.buildings.push(farm, house);
  person.assignment = { building: farm.id, role: "worker" };

  advanceSleepTick(world);

  assert.equal(person.sleepState?.returningToNeedAnchor, true);
  assert.deepEqual(person.sleepState?.needAnchor, farm.position);
  assert.deepEqual(person.path.at(-1), farm.position);

  person.position = { ...farm.position };
  person.path = [];
  advanceSleepTick(world);

  assert.equal(person.sleepState?.returningToNeedAnchor, undefined);
  assert.equal(person.sleepState?.kind, "house");
  assert.deepEqual(person.sleepState?.target, house.position);
  assert.deepEqual(person.path.at(-1), house.position);
});

test("local sleep may leave waypost coverage and returns before resuming", () => {
  const world = lineWorld();
  const person = world.people[0]!;
  const origin = { ...person.position };
  person.hunger = 100;
  person.sleep = 20;
  const bush = world.tiles.find((tile) => tile.q === 20 && tile.r === 0)!;
  bush.bush = true;
  bush.bushAvailable = true;

  advanceSleepTick(world);

  assert.deepEqual(person.sleepState?.needOrigin, origin);
  assert.equal(person.sleepState?.localNeedSearch, true);
  assert.equal(person.sleepState?.returnToNeedOrigin, true);
  assert.deepEqual(person.sleepState?.target, { q: 20, r: 0 });

  person.position = { q: bush.q, r: bush.r };
  person.path = [];
  person.sleepState!.progress = SLEEP_RULES.durationTicks - 1;
  advanceSleepTick(world);

  assert.equal(person.sleepState?.returningToNeedOrigin, true);
  assert.deepEqual(person.path.at(-1), origin);

  person.position = { ...origin };
  person.path = [];
  advanceSleepTick(world);

  assert.equal(person.sleepState, undefined);
});
