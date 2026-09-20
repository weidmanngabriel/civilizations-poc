import assert from "node:assert/strict";
import test from "node:test";
import { advanceHunting } from "../src/simulation/hunting";
import { setPersonProfession } from "../src/simulation/personCommands";
import { createWorld } from "../src/simulation/scenario";
import { hexDistance } from "../src/simulation/spatial";
import {
  LIVESTOCK_CAPTURE_RADIUS,
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
  assert.deepEqual(cow.path.at(-1), hq.position);
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
