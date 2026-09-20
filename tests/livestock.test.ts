import assert from "node:assert/strict";
import test from "node:test";
import { advanceHunting } from "../src/simulation/hunting";
import type { Building } from "../src/simulation/model";
import { setPersonProfession } from "../src/simulation/personCommands";
import { createWorld } from "../src/simulation/scenario";
import { buildWithFootprint, validBuildingAnchors } from "../src/simulation/buildingPlacement";
import {
  LIVESTOCK_BREEDING_COOLDOWN_TICKS,
  LIVESTOCK_BREEDING_DURATION_TICKS,
  LIVESTOCK_GROWTH_TICKS,
  advanceLivestockBreeding,
} from "../src/simulation/livestockBreeding";
import { hexDistance } from "../src/simulation/spatial";
import {
  LIVESTOCK_CAPTURE_RADIUS,
  OWNED_LIVESTOCK_PASTURE_RADIUS,
  advanceWildlife,
  captureNearbyLivestock,
  spawnAnimalGroup,
} from "../src/simulation/wildlife";

const grassNear = (
  world: ReturnType<typeof createWorld>,
  origin: { q: number; r: number },
  distance: number,
) =>
  world.tiles
    .filter(
      (tile) =>
        tile.terrain === "grass" &&
        !tile.resourceBlocking &&
        !tile.buildingBlocking,
    )
    .sort(
      (a, b) =>
        Math.abs(hexDistance(origin, a) - distance) -
          Math.abs(hexDistance(origin, b) - distance) ||
        a.q - b.q ||
        a.r - b.r,
    )[0]!;

test("a scout automatically captures livestock within two micro-tiles", () => {
  const world = createWorld(1);
  const scout = world.people[0]!;
  const hq = world.buildings.find((building) => building.kind === "hq")!;
  scout.position = { ...grassNear(world, hq.position, 8) };
  assert.equal(setPersonProfession(world, scout.id, "scout"), true);

  const outside = grassNear(world, scout.position, LIVESTOCK_CAPTURE_RADIUS + 1);
  const group = spawnAnimalGroup(world, "cow", outside, 1)!;
  const cow = world.animals!.find((animal) => animal.groupId === group.id)!;
  cow.position = { ...outside };
  cow.path = [];

  let stats = captureNearbyLivestock(world);
  assert.equal(cow.owner, undefined);
  assert.ok(stats.proximityChecks > 0);

  const inside = grassNear(world, scout.position, LIVESTOCK_CAPTURE_RADIUS);
  cow.position = { ...inside };
  cow.path = [];
  stats = captureNearbyLivestock(world);

  assert.equal(stats.captures, 1);
  assert.equal(cow.owner, "player");
  assert.equal(cow.returningToHq, true);
  assert.ok(cow.path.length > 0);
  const arrival = cow.path.at(-1)!;
  assert.ok(hexDistance(arrival, hq.position) >= 4);
  assert.ok(hexDistance(arrival, hq.position) <= 8);
});

test("owned cows and sheep are excluded from hunter target selection", () => {
  const world = createWorld(1);
  const hunter = world.people[0]!;
  const home = grassNear(world, hunter.position, 0);
  hunter.position = { ...home };
  assert.equal(setPersonProfession(world, hunter.id, "hunter"), true);

  const cowGroup = spawnAnimalGroup(world, "cow", home, 1)!;
  const cow = world.animals!.find((animal) => animal.groupId === cowGroup.id)!;
  cow.position = { ...home };
  cow.path = [];
  cow.owner = "player";

  const sheepGroup = spawnAnimalGroup(world, "sheep", home, 1)!;
  const sheep = world.animals!.find((animal) => animal.groupId === sheepGroup.id)!;
  sheep.position = { ...grassNear(world, home, 2) };
  sheep.path = [];
  sheep.owner = "player";

  advanceHunting(world);

  assert.equal(hunter.huntTarget, undefined);
  assert.equal(hunter.huntAimTarget, undefined);
});

test("cow and sheep groups keep their requested herd sizes", () => {
  const world = createWorld(0);
  const home = grassNear(world, world.buildings[0]!.position, 10);
  const cows = spawnAnimalGroup(world, "cow", home, 4)!;
  const sheep = spawnAnimalGroup(world, "sheep", grassNear(world, home, 10), 6)!;

  assert.equal(
    world.animals!.filter((animal) => animal.groupId === cows.id).length,
    4,
  );
  assert.equal(
    world.animals!.filter((animal) => animal.groupId === sheep.id).length,
    6,
  );
});


test("captured livestock rests after reaching the HQ pasture and only takes short grazing walks", () => {
  const world = createWorld(0);
  const hq = world.buildings.find((building) => building.kind === "hq")!;
  const pasture = grassNear(world, hq.position, 6);
  const group = spawnAnimalGroup(world, "cow", pasture, 1)!;
  const cow = world.animals!.find((animal) => animal.groupId === group.id)!;
  cow.owner = "player";
  cow.returningToHq = true;
  cow.position = { ...pasture };
  cow.path = [];
  cow.nextMoveTick = world.round;

  advanceWildlife(world);

  assert.equal(cow.returningToHq, undefined);
  assert.equal(cow.groupId, "owned-cow");
  assert.equal(cow.path.length, 0);
  assert.ok(cow.nextMoveTick >= world.round + 12 * 60);
  assert.ok(cow.nextMoveTick <= world.round + 25 * 60);

  world.round = cow.nextMoveTick - 1;
  advanceWildlife(world);
  assert.equal(cow.path.length, 0);

  world.round += 1;
  advanceWildlife(world);
  assert.ok(cow.path.length >= 1 && cow.path.length <= 4);
  assert.ok(
    hexDistance(cow.path.at(-1)!, hq.position) <= OWNED_LIVESTOCK_PASTURE_RADIUS,
  );
});

test("captured herd members reserve different pasture arrival endpoints", () => {
  const world = createWorld(1);
  const scout = world.people[0]!;
  const hq = world.buildings.find((building) => building.kind === "hq")!;
  scout.position = { ...grassNear(world, hq.position, 14) };
  assert.equal(setPersonProfession(world, scout.id, "scout"), true);

  const group = spawnAnimalGroup(world, "sheep", scout.position, 2)!;
  const sheep = world.animals!.filter((animal) => animal.groupId === group.id);
  for (const animal of sheep) {
    animal.position = { ...scout.position };
    animal.path = [];
  }

  captureNearbyLivestock(world);

  assert.equal(sheep.every((animal) => animal.owner === "player"), true);
  const endpoints = sheep.map((animal) => animal.path.at(-1)!).filter(Boolean);
  assert.equal(endpoints.length, 2);
  assert.notDeepEqual(endpoints[0], endpoints[1]);
});


test("only one livestock breeder can be placed", () => {
  const world = createWorld(1);
  const firstAnchor = validBuildingAnchors(world, "livestockBreeder")[0];
  assert.ok(firstAnchor);
  const first = buildWithFootprint(world, firstAnchor, "livestockBreeder");
  assert.ok(first);
  assert.equal(validBuildingAnchors(world, "livestockBreeder").length, 0);
});

test("livestock breeder alternates species and creates a growing juvenile", () => {
  const world = createWorld(1);
  world.animals = [];
  world.animalGroups = [];
  const breederPosition = grassNear(world, world.buildings[0]!.position, 7);
  world.buildings.push({
    id: "livestockBreeder-test",
    kind: "livestockBreeder",
    name: "Viehzüchterei",
    position: { ...breederPosition },
    workers: 1,
    carriers: 2,
    input: 0,
    inputInventory: { wheat: 10, water: 10 },
    output: 0,
    recipe: { inputs: { wheat: 4, water: 4 }, amount: 1, duration: LIVESTOCK_BREEDING_DURATION_TICKS },
    breederNextKind: "cow",
  });
  world.people[0]!.assignment = { building: "livestockBreeder-test", role: "worker" };

  const cowGroup = spawnAnimalGroup(world, "cow", breederPosition, 2)!;
  const sheepGroup = spawnAnimalGroup(world, "sheep", breederPosition, 2)!;
  for (const animal of world.animals!) {
    animal.owner = "player";
    animal.position = { ...grassNear(world, breederPosition, animal.kind === "cow" ? 4 : 6) };
    animal.path = [];
  }

  advanceLivestockBreeding(world);
  const breeder = world.buildings.find((building) => building.id === "livestockBreeder-test")!;
  assert.equal(breeder.breeding?.kind, "cow");
  assert.equal(breeder.breederNextKind, "sheep");
  assert.equal(breeder.inputInventory?.wheat, 6);
  assert.equal(breeder.inputInventory?.water, 6);
  assert.equal(
    world.animals!.filter((animal) => animal.groupId === cowGroup.id && animal.breedingAt === breeder.id).length,
    2,
  );

  world.round = breeder.breeding!.untilTick;
  advanceLivestockBreeding(world);

  const cows = world.animals!.filter((animal) => animal.owner === "player" && animal.kind === "cow");
  assert.equal(cows.length, 3);
  const calf = cows.find((animal) => animal.matureAtTick !== undefined)!;
  assert.ok(calf);
  assert.equal(calf.matureAtTick, world.round + LIVESTOCK_GROWTH_TICKS);
  assert.equal(cows.filter((animal) => (animal.breedingCooldownUntilTick ?? 0) > world.round).length, 1);
  assert.equal(
    cows.find((animal) => (animal.breedingCooldownUntilTick ?? 0) > world.round)!.breedingCooldownUntilTick,
    world.round + LIVESTOCK_BREEDING_COOLDOWN_TICKS,
  );

  advanceLivestockBreeding(world);
  assert.equal(breeder.breeding?.kind, "sheep");
  assert.equal(
    world.animals!.filter((animal) => animal.groupId === sheepGroup.id && animal.breedingAt === breeder.id).length,
    2,
  );
});

test("breeding skips a species that already has twelve owned animals", () => {
  const world = createWorld(1);
  world.animals = [];
  world.animalGroups = [];
  const breederPosition = grassNear(world, world.buildings[0]!.position, 7);
  const breeder: Building = {
    id: "livestockBreeder-limit",
    kind: "livestockBreeder" as const,
    name: "Viehzüchterei",
    position: { ...breederPosition },
    workers: 1,
    carriers: 2,
    input: 0,
    inputInventory: { wheat: 10, water: 10 },
    output: 0,
    recipe: { inputs: { wheat: 4, water: 4 }, amount: 1, duration: LIVESTOCK_BREEDING_DURATION_TICKS },
    breederNextKind: "cow" as const,
  };
  world.buildings.push(breeder);
  world.people[0]!.assignment = { building: breeder.id, role: "worker" };

  spawnAnimalGroup(world, "cow", breederPosition, 12);
  spawnAnimalGroup(world, "sheep", breederPosition, 2);
  for (const animal of world.animals!) {
    animal.owner = "player";
    animal.position = { ...grassNear(world, breederPosition, animal.kind === "cow" ? 5 : 6) };
    animal.path = [];
  }

  advanceLivestockBreeding(world);
  assert.equal(breeder.breeding?.kind, "sheep");
});

test("completed livestock breeder becomes the pasture home and demolition falls back to HQ", () => {
  const world = createWorld(0);
  const hq = world.buildings.find((building) => building.kind === "hq")!;
  const cowGroup = spawnAnimalGroup(world, "cow", grassNear(world, hq.position, 6), 1)!;
  const cow = world.animals!.find((animal) => animal.groupId === cowGroup.id)!;
  cow.owner = "player";
  cow.groupId = "owned-cow";
  world.animalGroups!.push({
    id: "owned-cow",
    kind: "cow",
    home: { ...hq.position },
    target: { ...hq.position },
    nextTargetTick: world.round,
  });

  const breederPosition = grassNear(world, hq.position, 10);
  world.buildings.push({
    id: "livestockBreeder-home",
    kind: "livestockBreeder",
    name: "Viehzüchterei",
    position: { ...breederPosition },
    workers: 1,
    carriers: 2,
    input: 0,
    inputInventory: { wheat: 0, water: 0 },
    output: 0,
    recipe: { inputs: { wheat: 4, water: 4 }, amount: 1, duration: LIVESTOCK_BREEDING_DURATION_TICKS },
  });

  advanceWildlife(world);
  assert.deepEqual(world.animalGroups!.find((group) => group.id === "owned-cow")!.home, breederPosition);

  world.buildings = world.buildings.filter((building) => building.id !== "livestockBreeder-home");
  cow.path = [];
  advanceWildlife(world);
  assert.deepEqual(world.animalGroups!.find((group) => group.id === "owned-cow")!.home, hq.position);
});
