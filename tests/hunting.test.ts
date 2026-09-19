import assert from "node:assert/strict";
import test from "node:test";
import { hunterHitChance, advanceHunting } from "../src/simulation/hunting";
import { commandEat, resolveFoodArrivals } from "../src/simulation/needs";
import { placeLooseGood } from "../src/simulation/looseGoods";
import { setPersonProfession } from "../src/simulation/personCommands";
import { createWorld, CONFIG } from "../src/simulation/scenario";
import {
  HUNTER_WORK_AREA_RADIUS,
  HUNTER_WORK_AREA_RADIUS_WORLD_TILES,
  WORK_AREA_RADIUS_WORLD_TILES,
} from "../src/simulation/workAreas";
import { hexDistance } from "../src/simulation/spatial";
import {
  advanceWildlife,
  animalGroupCenter,
  frightenAnimalGroup,
  spawnAnimalGroup,
} from "../src/simulation/wildlife";

const firstGrass = (world: ReturnType<typeof createWorld>) =>
  world.tiles.find((tile) => tile.terrain === "grass" && !tile.resourceBlocking && !tile.buildingBlocking)!;

const centralGrass = (world: ReturnType<typeof createWorld>) => {
  const qMid = Math.round((Math.min(...world.tiles.map((tile) => tile.q)) + Math.max(...world.tiles.map((tile) => tile.q))) / 2);
  const rMid = Math.round((Math.min(...world.tiles.map((tile) => tile.r)) + Math.max(...world.tiles.map((tile) => tile.r))) / 2);
  return world.tiles
    .filter((tile) => tile.terrain === "grass" && !tile.resourceBlocking && !tile.buildingBlocking)
    .sort(
      (a, b) =>
        hexDistance(a, { q: qMid, r: rMid }) - hexDistance(b, { q: qMid, r: rMid }) ||
        a.q - b.q ||
        a.r - b.r,
    )[0]!;
};

test("hunter hit chance scales with experience and fleeing halves it", () => {
  const world = createWorld(1);
  const hunter = world.people[0]!;
  assert.equal(hunterHitChance(hunter, false), 0.2);
  assert.equal(hunterHitChance(hunter, true), 0.1);

  hunter.experience = { hunter: 100 };
  assert.equal(hunterHitChance(hunter, false), 0.95);
  assert.equal(hunterHitChance(hunter, true), 0.475);
});

test("hunter gets a ten-world-tile work area", () => {
  const world = createWorld(1);
  const hunter = world.people[0]!;
  hunter.position = { ...firstGrass(world) };

  assert.equal(setPersonProfession(world, hunter.id, "hunter"), true);
  assert.equal(hunter.workArea?.radius, HUNTER_WORK_AREA_RADIUS);
  assert.equal(HUNTER_WORK_AREA_RADIUS_WORLD_TILES, 10);
  assert.equal(HUNTER_WORK_AREA_RADIUS_WORLD_TILES, WORK_AREA_RADIUS_WORLD_TILES * 4);
});

test("a shot frightens every animal in the group for five seconds", () => {
  const world = createWorld(0);
  const home = firstGrass(world);
  const group = spawnAnimalGroup(world, "hare", home, 3)!;

  frightenAnimalGroup(world, group.id, home);
  const members = world.animals!.filter((animal) => animal.groupId === group.id);
  assert.equal(members.length, 3);
  for (const animal of members) {
    assert.equal(animal.fleeingUntilTick, 5 * CONFIG.simulationHz);
    assert.ok(animal.path.length > 0);
  }

  world.round = 5 * CONFIG.simulationHz;
  advanceWildlife(world);
  for (const animal of members) assert.equal(animal.fleeingUntilTick, undefined);
});

test("hunter aims for two seconds, fires a locked shot, and retrieves meat", () => {
  const world = createWorld(1);
  const hunter = world.people[0]!;
  const home = centralGrass(world);
  hunter.position = { ...home };
  assert.equal(setPersonProfession(world, hunter.id, "hunter"), true);

  const targetTile = world.tiles
    .filter((tile) => tile.terrain === "grass" && !tile.resourceBlocking && !tile.buildingBlocking)
    .sort(
      (a, b) =>
        Math.abs(hexDistance(home, a) - 6) - Math.abs(hexDistance(home, b) - 6) ||
        a.q - b.q ||
        a.r - b.r,
    )[0]!;
  const group = spawnAnimalGroup(world, "hare", targetTile, 1)!;
  const animal = world.animals!.find((candidate) => candidate.groupId === group.id)!;
  animal.position = { ...targetTile };
  animal.path = [];

  world.rngState = 1972;
  advanceHunting(world);
  assert.equal(world.projectiles?.length ?? 0, 0);
  assert.equal(hunter.huntAimTarget, animal.id);
  assert.equal(hunter.huntAimUntilTick, 2 * CONFIG.simulationHz);
  assert.equal(hunter.path.length, 0);

  const escapedTile = world.tiles
    .filter((tile) => tile.terrain === "grass" && !tile.resourceBlocking && !tile.buildingBlocking)
    .sort(
      (a, b) =>
        Math.abs(hexDistance(home, a) - 18) - Math.abs(hexDistance(home, b) - 18) ||
        a.q - b.q ||
        a.r - b.r,
    )[0]!;
  animal.position = { ...escapedTile };

  world.round = 2 * CONFIG.simulationHz;
  advanceHunting(world);
  assert.equal(world.projectiles?.length, 1);
  assert.deepEqual(world.projectiles![0]!.targetPosition, escapedTile);
  assert.equal(hunter.experience?.hunter ?? 0, 0);

  world.round = world.projectiles![0]!.impactAtTick;
  advanceHunting(world);

  assert.equal(world.animals?.length, 0);
  assert.equal(hunter.experience?.hunter, 1);
  assert.equal(world.projectiles?.length, 1);
  assert.ok(world.projectiles![0]!.resolvedAtTick !== undefined);
  assert.equal(
    world.projectiles![0]!.expiresAtTick,
    world.projectiles![0]!.resolvedAtTick! + 10 * CONFIG.simulationHz,
  );

  const meat = world.looseGoods?.find((stack) => stack.good === "meat");
  assert.ok(meat);
  assert.equal(meat!.reserved, 1);
  assert.equal(hunter.huntLootTarget, meat!.id);

  hunter.position = { ...meat!.position };
  hunter.path = [];
  advanceHunting(world);
  assert.equal(hunter.huntLootPickupUntilTick, world.round + CONFIG.simulationHz);

  world.round += CONFIG.simulationHz;
  advanceHunting(world);
  assert.equal(hunter.outdoorCarry, "meat");
  assert.equal(hunter.huntLootTarget, undefined);
  assert.ok(hunter.path.length > 0 || (
    hunter.workArea &&
    hunter.position.q === hunter.workArea.center.q &&
    hunter.position.r === hunter.workArea.center.r
  ));

  hunter.position = { ...hunter.workArea!.center };
  hunter.path = [];
  advanceHunting(world);
  assert.equal(hunter.outdoorCarry, undefined);
  assert.ok(world.looseGoods?.some(
    (stack) => stack.good === "meat" && hexDistance(stack.position, hunter.workArea!.center) <= 5,
  ));
});


test("wildlife groups pick a gentle migration target every thirty seconds", () => {
  const world = createWorld(0);
  const home = firstGrass(world);
  const group = spawnAnimalGroup(world, "hare", home, 3)!;
  const centerBefore = animalGroupCenter(world, group.id)!;

  group.nextTargetTick = world.round;
  advanceWildlife(world);

  assert.ok(group.target);
  const distance = hexDistance(centerBefore, group.target!);
  assert.ok(distance >= 10 && distance <= 15);
  assert.equal(group.nextTargetTick, 30 * CONFIG.simulationHz);
});


test("hare groups spawn loosely and never share a micro-cell while roaming", () => {
  const world = createWorld(0);
  const home = firstGrass(world);
  const group = spawnAnimalGroup(world, "hare", home, 4)!;
  const members = world.animals!.filter((animal) => animal.groupId === group.id);

  for (let i = 0; i < members.length; i += 1)
    for (let j = i + 1; j < members.length; j += 1)
      assert.ok(hexDistance(members[i]!.position, members[j]!.position) >= 2);

  for (let tick = 0; tick < 45 * CONFIG.simulationHz; tick += 1) {
    world.round += 1;
    advanceWildlife(world);
    const positions = members.map((animal) => `${animal.position.q},${animal.position.r}`);
    assert.equal(new Set(positions).size, positions.length);
  }
});


test("hare group migration develops sustained drift over several minutes", () => {
  const world = createWorld(0);
  const home = centralGrass(world);
  const group = spawnAnimalGroup(world, "hare", home, 4)!;
  const startCenter = animalGroupCenter(world, group.id)!;
  let maxDistance = 0;

  for (let tick = 0; tick < 4 * 60 * CONFIG.simulationHz; tick += 1) {
    world.round += 1;
    advanceWildlife(world);
    if (tick % CONFIG.simulationHz === 0) {
      const center = animalGroupCenter(world, group.id)!;
      maxDistance = Math.max(maxDistance, hexDistance(startCenter, center));
    }
  }

  assert.ok(
    maxDistance >= 12,
    `expected migrating group center to leave the spawn area, max distance was ${maxDistance}`,
  );
});


test("impacted arrows remain for ten seconds and are removed afterwards", () => {
  const world = createWorld(1);
  const hunter = world.people[0]!;
  const home = centralGrass(world);
  hunter.position = { ...home };
  assert.equal(setPersonProfession(world, hunter.id, "hunter"), true);
  const group = spawnAnimalGroup(world, "hare", home, 1)!;

  world.rngState = 1972;
  advanceHunting(world);
  world.round = 2 * CONFIG.simulationHz;
  advanceHunting(world);
  const projectile = world.projectiles![0]!;
  world.round = projectile.impactAtTick;
  advanceHunting(world);

  const expiresAt = projectile.expiresAtTick!;
  world.round = expiresAt - 1;
  advanceHunting(world);
  assert.ok(world.projectiles?.some((candidate) => candidate.id === projectile.id));

  world.round = expiresAt;
  advanceHunting(world);
  assert.equal(world.projectiles?.some((candidate) => candidate.id === projectile.id), false);
});

test("meat restores the same sixty hunger points as fish", () => {
  const world = createWorld(1);
  const person = world.people[0]!;
  person.position = { ...centralGrass(world) };
  person.hunger = 20;
  const stack = placeLooseGood(world, person.position, "meat", 1)!;

  assert.equal(commandEat(world, person.id), true);
  assert.equal(person.hungerState?.foodLooseGood, stack.id);
  resolveFoodArrivals(world);
  assert.ok(person.hungerState?.eatingUntilTick !== undefined);

  world.round = person.hungerState!.eatingUntilTick!;
  resolveFoodArrivals(world);
  assert.equal(person.hunger, 80);
  assert.equal(world.looseGoods?.some((candidate) => candidate.id === stack.id), false);
});


test("boars are solitary even when a larger group size is requested", () => {
  const world = createWorld(0);
  const home = centralGrass(world);
  const group = spawnAnimalGroup(world, "boar", home, 3)!;
  const members = world.animals!.filter((animal) => animal.groupId === group.id);

  assert.equal(members.length, 1);
  assert.equal(members[0]!.kind, "boar");
});

test("a killed boar yields meat and leather that the hunter carries to the flag one by one", () => {
  const world = createWorld(1);
  const hunter = world.people[0]!;
  const home = centralGrass(world);
  hunter.position = { ...home };
  assert.equal(setPersonProfession(world, hunter.id, "hunter"), true);

  const targetTile = world.tiles
    .filter((tile) => tile.terrain === "grass" && !tile.resourceBlocking && !tile.buildingBlocking)
    .sort(
      (a, b) =>
        Math.abs(hexDistance(home, a) - 6) - Math.abs(hexDistance(home, b) - 6) ||
        a.q - b.q ||
        a.r - b.r,
    )[0]!;
  const group = spawnAnimalGroup(world, "boar", targetTile, 1)!;
  const boar = world.animals!.find((animal) => animal.groupId === group.id)!;
  boar.position = { ...targetTile };
  boar.path = [];

  world.rngState = 1972;
  advanceHunting(world);
  world.round = 2 * CONFIG.simulationHz;
  advanceHunting(world);
  world.round = world.projectiles![0]!.impactAtTick;
  advanceHunting(world);

  assert.equal(world.animals?.some((animal) => animal.id === boar.id), false);
  const meat = world.looseGoods?.find((stack) => stack.good === "meat");
  const leather = world.looseGoods?.find((stack) => stack.good === "leather");
  assert.ok(meat);
  assert.ok(leather);
  assert.equal(meat!.reserved, 1);
  assert.equal(leather!.reserved, 1);
  assert.equal(hunter.huntLootTarget, meat!.id);
  assert.deepEqual(hunter.huntLootQueue, [leather!.id]);

  hunter.position = { ...meat!.position };
  hunter.path = [];
  advanceHunting(world);
  world.round += CONFIG.simulationHz;
  advanceHunting(world);
  assert.equal(hunter.outdoorCarry, "meat");

  hunter.position = { ...hunter.workArea!.center };
  hunter.path = [];
  advanceHunting(world);
  assert.equal(hunter.outdoorCarry, undefined);
  assert.equal(hunter.huntLootTarget, leather!.id);
  assert.equal(hunter.huntLootQueue, undefined);
  assert.equal(leather!.reserved, 1);

  hunter.position = { ...leather!.position };
  hunter.path = [];
  advanceHunting(world);
  world.round += CONFIG.simulationHz;
  advanceHunting(world);
  assert.equal(hunter.outdoorCarry, "leather");

  hunter.position = { ...hunter.workArea!.center };
  hunter.path = [];
  advanceHunting(world);

  assert.equal(hunter.outdoorCarry, undefined);
  assert.equal(hunter.huntLootTarget, undefined);
  assert.equal(hunter.huntLootQueue, undefined);
  assert.ok(world.looseGoods?.some(
    (stack) => stack.good === "meat" && hexDistance(stack.position, hunter.workArea!.center) <= 5,
  ));
  assert.ok(world.looseGoods?.some(
    (stack) => stack.good === "leather" && hexDistance(stack.position, hunter.workArea!.center) <= 5,
  ));
});


test("hunter keeps pursuing an acquired target outside the hunting area", () => {
  const world = createWorld(1);
  const hunter = world.people[0]!;
  const home = centralGrass(world);
  hunter.position = { ...home };
  assert.equal(setPersonProfession(world, hunter.id, "hunter"), true);

  const inside = world.tiles
    .filter((tile) => tile.terrain === "grass" && !tile.resourceBlocking && !tile.buildingBlocking)
    .sort(
      (a, b) =>
        Math.abs(hexDistance(home, a) - 12) - Math.abs(hexDistance(home, b) - 12) ||
        a.q - b.q ||
        a.r - b.r,
    )[0]!;
  const group = spawnAnimalGroup(world, "hare", inside, 1)!;
  const animal = world.animals!.find((candidate) => candidate.groupId === group.id)!;
  animal.position = { ...inside };
  animal.path = [];

  advanceHunting(world);
  assert.equal(hunter.huntTarget, animal.id);

  const outsideHunter = world.tiles
    .filter(
      (tile) =>
        tile.terrain === "grass" &&
        !tile.resourceBlocking &&
        !tile.buildingBlocking &&
        hexDistance(home, tile) > HUNTER_WORK_AREA_RADIUS,
    )
    .sort(
      (a, b) =>
        hexDistance(home, a) - hexDistance(home, b) ||
        a.q - b.q ||
        a.r - b.r,
    )[0]!;
  const outsideTarget = world.tiles
    .filter(
      (tile) =>
        tile.terrain === "grass" &&
        !tile.resourceBlocking &&
        !tile.buildingBlocking &&
        hexDistance(home, tile) > HUNTER_WORK_AREA_RADIUS &&
        hexDistance(outsideHunter, tile) <= 6,
    )
    .sort(
      (a, b) =>
        hexDistance(outsideHunter, a) - hexDistance(outsideHunter, b) ||
        a.q - b.q ||
        a.r - b.r,
    )[0]!;
  assert.ok(outsideTarget);

  hunter.position = { ...outsideHunter };
  hunter.path = [];
  animal.position = { ...outsideTarget };
  animal.path = [];

  advanceHunting(world);

  assert.equal(hunter.huntTarget, animal.id);
  assert.equal(hunter.huntAimTarget, animal.id);
});

test("hunter does not acquire a new target outside the hunting area", () => {
  const world = createWorld(1);
  const hunter = world.people[0]!;
  const home = centralGrass(world);
  hunter.position = { ...home };
  assert.equal(setPersonProfession(world, hunter.id, "hunter"), true);

  const outside = world.tiles
    .filter(
      (tile) =>
        tile.terrain === "grass" &&
        !tile.resourceBlocking &&
        !tile.buildingBlocking &&
        hexDistance(home, tile) > HUNTER_WORK_AREA_RADIUS,
    )
    .sort(
      (a, b) =>
        hexDistance(home, a) - hexDistance(home, b) ||
        a.q - b.q ||
        a.r - b.r,
    )[0]!;
  const group = spawnAnimalGroup(world, "hare", outside, 1)!;
  const animal = world.animals!.find((candidate) => candidate.groupId === group.id)!;
  animal.position = { ...outside };
  animal.path = [];

  advanceHunting(world);

  assert.equal(hunter.huntTarget, undefined);
  assert.equal(hunter.huntAimTarget, undefined);
});
