import assert from "node:assert/strict";
import test from "node:test";
import { advanceHunting } from "../src/simulation/hunting";
import type { Animal, Building } from "../src/simulation/model";
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
import { changeAssignment, tick } from "../src/simulation/simulation";
import { personActivityLabel } from "../src/personPresentation";
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


test("owned sheep wait on a temporary animal blockage before replanning", () => {
  const world = createWorld(0);
  world.animals = [];
  world.animalGroups = [];
  const hq = world.buildings.find((building) => building.kind === "hq")!;
  const group = spawnAnimalGroup(world, "sheep", grassNear(world, hq.position, 6), 2)!;
  const sheep = world.animals!.filter((animal) => animal.groupId === group.id);
  const moving = sheep[0]!;
  const blocker = sheep[1]!;
  moving.owner = "player";
  blocker.owner = "player";
  moving.path = [{ ...blocker.position }];
  moving.movement = 1;
  moving.nextMoveTick = Number.MAX_SAFE_INTEGER;
  blocker.path = [];
  blocker.nextMoveTick = Number.MAX_SAFE_INTEGER;

  let stats = advanceWildlife(world);
  assert.equal(stats.blockedSteps, 1);
  assert.equal(stats.blockageReplans, 0);
  assert.equal(moving.path.length, 1);
  assert.equal(moving.movementBlockedSinceTick, world.round);

  world.round += 29;
  moving.movement = 1;
  stats = advanceWildlife(world);
  assert.equal(stats.blockedSteps, 1);
  assert.equal(stats.blockageReplans, 0);
  assert.equal(moving.path.length, 1);

  world.round += 1;
  moving.movement = 1;
  stats = advanceWildlife(world);
  assert.equal(stats.blockedSteps, 1);
  assert.equal(stats.blockageReplans, 1);
  assert.equal(moving.path.length, 0);
  assert.equal(moving.nextMoveTick, world.round);
  assert.equal(moving.movementBlockedSinceTick, undefined);
});

test("owned livestock pasture search stays inside the local pasture radius", () => {
  const world = createWorld(0);
  world.animals = [];
  world.animalGroups = [];
  const hq = world.buildings.find((building) => building.kind === "hq")!;
  const group = spawnAnimalGroup(world, "sheep", grassNear(world, hq.position, 6), 1)!;
  const sheep = world.animals!.find((animal) => animal.groupId === group.id)!;
  sheep.owner = "player";
  sheep.path = [];
  sheep.nextMoveTick = world.round;

  const stats = advanceWildlife(world);

  assert.equal(stats.pastureTargetSearches, 1);
  assert.ok(stats.pastureCandidateChecks > 0);
  assert.ok(
    stats.pastureCandidateChecks < world.tiles.length / 10,
    `expected local pasture search, checked ${stats.pastureCandidateChecks} of ${world.tiles.length} tiles`,
  );
  assert.ok(stats.pastureTargetSearchMs >= 0);
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

test("stockfarmer physically gathers both parents before breeding", () => {
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
  const worker = world.people[0]!;
  worker.assignment = { building: "livestockBreeder-test", role: "worker" };
  worker.position = { ...breederPosition };

  const cowGroup = spawnAnimalGroup(world, "cow", breederPosition, 2)!;
  const sheepGroup = spawnAnimalGroup(world, "sheep", breederPosition, 2)!;
  for (const [index, animal] of world.animals!.entries()) {
    animal.owner = "player";
    animal.position = { ...grassNear(world, breederPosition, animal.kind === "cow" ? 4 + index : 7 + index) };
    animal.path = [];
  }
  const cowPositions = new Map(
    world.animals!
      .filter((animal) => animal.kind === "cow")
      .map((animal) => [animal.id, { ...animal.position }]),
  );

  advanceLivestockBreeding(world);
  const breeder = world.buildings.find((building) => building.id === "livestockBreeder-test")!;
  assert.equal(breeder.breeding, undefined);
  const gathering = breeder.breedingGathering;
  assert.ok(gathering);
  assert.equal(gathering.kind, "cow");
  assert.equal(breeder.breederNextKind, "sheep");
  assert.equal(breeder.inputInventory?.wheat, 6);
  assert.equal(breeder.inputInventory?.water, 6);
  for (const animal of world.animals!.filter((candidate) => candidate.kind === "cow")) {
    assert.deepEqual(animal.position, cowPositions.get(animal.id));
    assert.equal(animal.breedingReservedAt, breeder.id);
    assert.equal(animal.breedingAt, undefined);
  }

  const parentIds = [...gathering.parentIds];
  for (const parentId of parentIds) {
    const parentAnimal: Animal = world.animals!.find((animal) => animal.id === parentId)!;
    worker.position = { ...parentAnimal.position };
    worker.path = [];
    advanceLivestockBreeding(world);
    assert.equal(parentAnimal.followingBreederId, worker.id);
    assert.equal(parentAnimal.breedingAt, undefined);

    worker.position = { ...breeder.position };
    worker.path = [];
    parentAnimal.position = { ...breeder.position };
    parentAnimal.path = [];
    advanceLivestockBreeding(world);
    assert.equal(parentAnimal.followingBreederId, undefined);
    assert.equal(parentAnimal.breedingAt, breeder.id);
  }

  assert.equal(breeder.breedingGathering, undefined);
  const activeBreeding = world.buildings.find((building) => building.id === breeder.id)!.breeding;
  assert.ok(activeBreeding);
  assert.equal(activeBreeding.kind, "cow");
  assert.deepEqual(activeBreeding.parentIds, parentIds);
  assert.equal(worker.active, true);
  assert.equal(worker.idleTarget, undefined);
  assert.equal(worker.path.length, 0);
  assert.equal(personActivityLabel(worker), "Arbeitet");

  world.round = activeBreeding.untilTick;
  advanceLivestockBreeding(world);

  const cows = world.animals!.filter((animal) => animal.owner === "player" && animal.kind === "cow");
  assert.equal(cows.length, 3);
  const calf = cows.find((animal) => animal.matureAtTick !== undefined)!;
  assert.ok(calf);
  assert.equal(calf.matureAtTick, world.round + LIVESTOCK_GROWTH_TICKS);
  assert.equal(calf.returningToHq, true);
  assert.equal(cows.filter((animal) => (animal.breedingCooldownUntilTick ?? 0) > world.round).length, 1);
  assert.equal(
    cows.find((animal) => (animal.breedingCooldownUntilTick ?? 0) > world.round)!.breedingCooldownUntilTick,
    world.round + LIVESTOCK_BREEDING_COOLDOWN_TICKS,
  );
  assert.equal(worker.active, false);

  advanceLivestockBreeding(world);
  assert.equal(breeder.breeding, undefined);
  const nextGathering = world.buildings.find((building) => building.id === breeder.id)!.breedingGathering;
  assert.ok(nextGathering);
  assert.equal(nextGathering.kind, "sheep");
  assert.equal(
    world.animals!.filter((animal) => animal.groupId === sheepGroup.id && animal.breedingReservedAt === breeder.id).length,
    2,
  );
  assert.equal(
    world.animals!.filter((animal) => animal.groupId === cowGroup.id && animal.breedingAt === breeder.id).length,
    0,
  );
});

test("stockfarmer fetches missing breeding inputs before gathering animals", () => {
  const world = createWorld(1);
  world.animals = [];
  world.animalGroups = [];

  const hq = world.buildings.find((building) => building.kind === "hq")!;
  hq.inventory ??= {};
  hq.inventory.wheat = 10;
  hq.inventory.water = 10;

  const breederPosition = grassNear(world, hq.position, 2);
  const breeder: Building = {
    id: "livestockBreeder-resupply",
    kind: "livestockBreeder",
    name: "Viehzüchterei",
    position: { q: breederPosition.q, r: breederPosition.r },
    workers: 1,
    carriers: 0,
    input: 0,
    inputInventory: { wheat: 0, water: 0 },
    output: 0,
    recipe: {
      inputs: { wheat: 4, water: 4 },
      amount: 1,
      duration: LIVESTOCK_BREEDING_DURATION_TICKS,
    },
    breederNextKind: "sheep",
  };
  world.buildings.push(breeder);

  const worker = world.people[0]!;
  worker.hunger = 100;
  worker.sleep = 100;
  assert.equal(changeAssignment(world, breeder.id, "worker", 1), true);

  const sheepGroup = spawnAnimalGroup(
    world,
    "sheep",
    grassNear(world, breeder.position, 4),
    2,
  )!;
  const sheep = world.animals!.filter((animal) => animal.groupId === sheepGroup.id);
  for (const [index, animal] of sheep.entries()) {
    animal.owner = "player";
    animal.position = { ...grassNear(world, breeder.position, 4 + index) };
    animal.path = [];
    animal.nextMoveTick = Number.MAX_SAFE_INTEGER;
  }

  for (let i = 0; i < 120 && !worker.trip; i++) tick(world);
  assert.ok(worker.trip);
  assert.equal(worker.trip.target, breeder.id);
  assert.equal(breeder.breedingGathering, undefined);

  let workerTrips = 0;
  let previousTrip = worker.trip;
  let gatheringStarted = false;
  for (let i = 0; i < 7200; i++) {
    tick(world);
    if (worker.trip && worker.trip !== previousTrip) workerTrips += 1;
    previousTrip = worker.trip;

    const hasPhysicalInputs =
      (breeder.inputInventory?.wheat ?? 0) >= 4 &&
      (breeder.inputInventory?.water ?? 0) >= 4;
    if (!hasPhysicalInputs && worker.trip)
      assert.equal(breeder.breedingGathering, undefined);

    if (breeder.breedingGathering) {
      gatheringStarted = true;
      break;
    }
  }

  assert.equal(gatheringStarted, true);
  assert.ok(workerTrips >= 1);
  assert.equal(worker.trip, undefined);
  assert.equal(breeder.inputInventory?.wheat, 0);
  assert.equal(breeder.inputInventory?.water, 0);
  assert.equal(
    sheep.filter((animal) => animal.breedingReservedAt === breeder.id).length,
    2,
  );
});

test("completed breeding immediately reschedules the stockfarmer for missing inputs", () => {
  const world = createWorld(1);
  world.animals = [];
  world.animalGroups = [];

  const hq = world.buildings.find((building) => building.kind === "hq")!;
  hq.inventory ??= {};
  hq.inventory.wheat = 10;
  hq.inventory.water = 10;

  const breederPosition = grassNear(world, hq.position, 2);
  const breeder: Building = {
    id: "livestockBreeder-restart",
    kind: "livestockBreeder",
    name: "Viehzüchterei",
    position: { ...breederPosition },
    workers: 1,
    carriers: 0,
    input: 0,
    inputInventory: { wheat: 0, water: 0 },
    output: 0,
    recipe: {
      inputs: { wheat: 4, water: 4 },
      amount: 1,
      duration: LIVESTOCK_BREEDING_DURATION_TICKS,
    },
  };
  world.buildings.push(breeder);

  const worker = world.people[0]!;
  worker.assignment = { building: breeder.id, role: "worker" };
  worker.position = { ...breeder.position };
  worker.path = [];
  worker.active = true;
  worker.hunger = 100;
  worker.sleep = 100;

  const group = spawnAnimalGroup(world, "cow", breeder.position, 2)!;
  const parents = world.animals!.filter((animal) => animal.groupId === group.id);
  for (const animal of parents) {
    animal.owner = "player";
    animal.position = { ...breeder.position };
    animal.path = [];
    animal.breedingAt = breeder.id;
    animal.breedingReservedAt = breeder.id;
  }
  breeder.breeding = {
    kind: "cow",
    parentIds: parents.map((animal) => animal.id),
    untilTick: world.round + 1,
  };

  tick(world);
  assert.equal(breeder.breeding, undefined);
  assert.equal(
    world.people.find((person) => person.id === worker.id)?.trip,
    undefined,
  );

  tick(world);
  const resupplyTrip = world.people.find((person) => person.id === worker.id)?.trip;
  assert.ok(resupplyTrip);
  assert.equal(resupplyTrip.target, breeder.id);
  assert.ok(resupplyTrip.good === "wheat" || resupplyTrip.good === "water");
});

test("full simulation tick brings livestock through a real breeder entrance", () => {
  const world = createWorld(1);
  world.animals = [];
  world.animalGroups = [];

  const anchor = validBuildingAnchors(world, "livestockBreeder")[0];
  assert.ok(anchor);
  const breeder = buildWithFootprint(world, anchor, "livestockBreeder");
  assert.ok(breeder);
  assert.ok(breeder.construction);
  breeder.construction.complete = true;
  breeder.construction.progress = breeder.construction.duration;
  breeder.inputInventory = { wheat: 10, water: 10 };
  breeder.breederNextKind = "sheep";

  const entranceTile = world.tiles.find(
    (tile) => tile.q === breeder.position.q && tile.r === breeder.position.r,
  );
  assert.equal(entranceTile?.terrain, "building");
  assert.notEqual(entranceTile?.buildingBlocking, true);

  const worker = world.people[0]!;
  worker.assignment = { building: breeder.id, role: "worker" };
  worker.position = { ...breeder.position };
  worker.active = true;
  worker.path = [];
  worker.hunger = 100;
  worker.sleep = 100;

  const footprint = breeder.footprint ?? [];
  const nearbyPasture = world.tiles
    .filter(
      (tile) =>
        tile.terrain === "grass" &&
        !tile.resourceBlocking &&
        !tile.buildingBlocking &&
        footprint.some((cell) => hexDistance(tile, cell) === 1),
    )
    .slice(0, 2);
  assert.equal(nearbyPasture.length, 2);

  const sheepGroup = spawnAnimalGroup(world, "sheep", nearbyPasture[0]!, 2)!;
  const sheep = world.animals!.filter((animal) => animal.groupId === sheepGroup.id);
  for (const [index, animal] of sheep.entries()) {
    animal.owner = "player";
    animal.position = { ...nearbyPasture[index]! };
    animal.path = [];
    animal.nextMoveTick = Number.MAX_SAFE_INTEGER;
  }

  let sawFollowing = false;
  let sawAnimalInsideBuilding = false;
  let startedBreeding = false;
  for (let i = 0; i < 600; i++) {
    tick(world);
    if (sheep.some((animal) => animal.followingBreederId === worker.id))
      sawFollowing = true;
    if (
      sheep.some((animal) => {
        const tile = world.tiles.find(
          (candidate) =>
            candidate.q === animal.position.q &&
            candidate.r === animal.position.r,
        );
        return tile?.terrain === "building";
      })
    ) sawAnimalInsideBuilding = true;
    if (breeder.breeding) {
      startedBreeding = true;
      break;
    }
  }

  assert.equal(sawFollowing, true);
  assert.equal(sawAnimalInsideBuilding, true);
  assert.equal(startedBreeding, true);
  assert.equal(breeder.breedingGathering, undefined);
  assert.equal(breeder.breeding?.kind, "sheep");
  assert.equal(
    sheep.filter((animal) => animal.breedingAt === breeder.id).length,
    2,
  );
  const workerTile = world.tiles.find(
    (tile) => tile.q === worker.position.q && tile.r === worker.position.r,
  );
  assert.equal(workerTile?.terrain, "building");
});

test("reserved livestock follows the stockfarmer instead of teleporting", () => {
  const world = createWorld(1);
  world.animals = [];
  world.animalGroups = [];
  const breederPosition = grassNear(world, world.buildings[0]!.position, 7);
  const breeder: Building = {
    id: "livestockBreeder-follow",
    kind: "livestockBreeder",
    name: "Viehzüchterei",
    position: { ...breederPosition },
    workers: 1,
    carriers: 2,
    input: 0,
    inputInventory: { wheat: 10, water: 10 },
    output: 0,
    recipe: { inputs: { wheat: 4, water: 4 }, amount: 1, duration: LIVESTOCK_BREEDING_DURATION_TICKS },
  };
  world.buildings.push(breeder);
  const worker = world.people[0]!;
  worker.assignment = { building: breeder.id, role: "worker" };

  spawnAnimalGroup(world, "cow", breederPosition, 2);
  for (const [index, animal] of world.animals!.entries()) {
    animal.owner = "player";
    animal.position = { ...grassNear(world, breederPosition, 4 + index) };
    animal.path = [];
  }

  advanceLivestockBreeding(world);
  const first = world.animals!.find(
    (animal) => animal.id === breeder.breedingGathering!.parentIds[0],
  )!;
  worker.position = { ...first.position };
  worker.path = [];
  advanceLivestockBreeding(world);
  assert.equal(first.followingBreederId, worker.id);

  const oldPosition = { ...first.position };
  worker.position = { ...breeder.position };
  worker.path = [];
  advanceWildlife(world);

  assert.deepEqual(first.position, oldPosition);
  assert.ok(first.path.length > 0);
  assert.equal(first.path.at(-1)!.q, breeder.position.q);
  assert.equal(first.path.at(-1)!.r, breeder.position.r);
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
  assert.equal(breeder.breeding, undefined);
  assert.equal(breeder.breedingGathering?.kind, "sheep");
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
