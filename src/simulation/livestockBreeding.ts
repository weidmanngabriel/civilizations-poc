import type { Animal, AnimalGroup, Building, Person, World } from "./model";
import { findPath, key, neighbors, same, tileIndex, walkable } from "./hex";
import { hexDistance } from "./spatial";
import { SIMULATION_HZ } from "./timing";
import { awardProfessionExperience } from "./experience";
import { requestImmediateWorkDecision } from "./workScheduling";

export type LivestockKind = "cow" | "sheep";

export const LIVESTOCK_BREEDING_LIMIT = 12;
export const LIVESTOCK_BREEDING_DURATION_TICKS = 10 * SIMULATION_HZ;
export const LIVESTOCK_GROWTH_TICKS = 3 * 60 * SIMULATION_HZ;
export const LIVESTOCK_BREEDING_COOLDOWN_TICKS = 3 * 60 * SIMULATION_HZ;
export const LIVESTOCK_BABY_START_SCALE = 0.45;
export const LIVESTOCK_BREEDING_WHEAT = 4;
export const LIVESTOCK_BREEDING_WATER = 4;

export const completedLivestockBreeder = (world: World): Building | undefined =>
  world.buildings.find(
    (building) =>
      building.kind === "livestockBreeder" &&
      !building.retired &&
      (!building.construction || building.construction.complete),
  );

export const ownedLivestockCount = (world: World, kind: LivestockKind): number =>
  (world.animals ?? []).filter(
    (animal) => animal.owner === "player" && animal.kind === kind,
  ).length;

export const livestockIsAdult = (world: World, animal: Animal): boolean =>
  animal.matureAtTick === undefined || animal.matureAtTick <= world.round;

const hasBreedingInputs = (building: Building): boolean =>
  (building.inputInventory?.wheat ?? 0) >= LIVESTOCK_BREEDING_WHEAT &&
  (building.inputInventory?.water ?? 0) >= LIVESTOCK_BREEDING_WATER;

const consumeBreedingInputs = (building: Building): void => {
  building.inputInventory ??= {};
  building.inputInventory.wheat =
    (building.inputInventory.wheat ?? 0) - LIVESTOCK_BREEDING_WHEAT;
  building.inputInventory.water =
    (building.inputInventory.water ?? 0) - LIVESTOCK_BREEDING_WATER;
};

const eligibleParents = (
  world: World,
  building: Building,
  kind: LivestockKind,
): Animal[] =>
  (world.animals ?? [])
    .filter(
      (animal) =>
        animal.owner === "player" &&
        animal.kind === kind &&
        !animal.breedingAt &&
        !animal.breedingReservedAt &&
        livestockIsAdult(world, animal) &&
        (animal.breedingCooldownUntilTick ?? 0) <= world.round &&
        hexDistance(animal.position, building.position) <= 10,
    )
    .sort(
      (a, b) =>
        hexDistance(a.position, building.position) -
          hexDistance(b.position, building.position) ||
        a.id.localeCompare(b.id),
    );

const canBreedKind = (
  world: World,
  building: Building,
  kind: LivestockKind,
): boolean =>
  ownedLivestockCount(world, kind) < LIVESTOCK_BREEDING_LIMIT &&
  eligibleParents(world, building, kind).length >= 2;

const ensureOwnedGroup = (
  world: World,
  kind: LivestockKind,
  home: Building["position"],
): AnimalGroup => {
  world.animalGroups ??= [];
  let group = world.animalGroups.find((candidate) => candidate.id === `owned-${kind}`);
  if (!group) {
    group = {
      id: `owned-${kind}`,
      kind,
      home: { ...home },
      target: { ...home },
      nextTargetTick: world.round,
      migrationDirection: { q: 0, r: 0 },
    };
    world.animalGroups.push(group);
  } else {
    group.home = { ...home };
    group.target = { ...home };
  }
  return group;
};

const freePasturePosition = (
  world: World,
  home: Building["position"],
  excludedIds: Set<string>,
): Building["position"] => {
  const occupied = new Set(
    (world.animals ?? [])
      .filter((animal) => !excludedIds.has(animal.id) && !animal.breedingAt)
      .map((animal) => key(animal.position)),
  );
  const candidate = world.tiles
    .filter(
      (tile) =>
        walkable(tile) &&
        tile.terrain !== "building" &&
        tile.terrain !== "river" &&
        tile.terrain !== "mountain" &&
        hexDistance(tile, home) >= 3 &&
        hexDistance(tile, home) <= 8 &&
        !occupied.has(key(tile)),
    )
    .sort(
      (a, b) =>
        hexDistance(a, home) - hexDistance(b, home) ||
        a.q - b.q ||
        a.r - b.r,
    )[0];
  return candidate ? { q: candidate.q, r: candidate.r } : { ...home };
};

const releaseAnimal = (
  world: World,
  animal: Animal,
  building: Building,
  excludedIds: Set<string>,
): void => {
  const group = ensureOwnedGroup(world, animal.kind as LivestockKind, building.position);
  const target = freePasturePosition(world, building.position, excludedIds);
  animal.groupId = group.id;
  animal.path = findPath(world.tiles, animal.position, target, 1) ?? [];
  animal.movement = 0;
  animal.breedingReservedAt = undefined;
  animal.followingBreederId = undefined;
  animal.breedingAt = undefined;
  animal.returningToHq = true;
  animal.nextMoveTick = world.round;
  excludedIds.delete(animal.id);
};

const nextAnimalId = (world: World): string => {
  const id = world.nextAnimalId ?? 1;
  world.nextAnimalId = id + 1;
  return `animal-${id}`;
};

const finishBreeding = (world: World, building: Building): void => {
  const cycle = building.breeding;
  if (!cycle) return;
  const parents = cycle.parentIds
    .map((id) => (world.animals ?? []).find((animal) => animal.id === id))
    .filter((animal): animal is Animal => Boolean(animal));
  const releaseIds = new Set(parents.map((parent) => parent.id));

  for (const parent of parents) releaseAnimal(world, parent, building, releaseIds);
  const cooldownParent = parents[0];
  if (cooldownParent)
    cooldownParent.breedingCooldownUntilTick =
      world.round + LIVESTOCK_BREEDING_COOLDOWN_TICKS;

  const group = ensureOwnedGroup(world, cycle.kind, building.position);
  const babyId = nextAnimalId(world);
  const babyTarget = freePasturePosition(world, building.position, new Set());
  const babyEntry = livestockBreederEntry(world, building, babyTarget);
  const baby: Animal = {
    id: babyId,
    kind: cycle.kind,
    groupId: group.id,
    position: { ...babyEntry },
    path: findPath(world.tiles, babyEntry, babyTarget, 1) ?? [],
    movement: 0,
    nextMoveTick: world.round,
    owner: "player",
    returningToHq: true,
    matureAtTick: world.round + LIVESTOCK_GROWTH_TICKS,
  };
  (world.animals ??= []).push(baby);
  const worker = world.people.find(
    (person) =>
      person.assignment?.building === building.id &&
      person.assignment.role === "worker",
  );
  if (worker) {
    awardProfessionExperience(worker, "stockfarmer");
    worker.idleTarget = undefined;
    worker.path = [];
    worker.movement = 0;
    worker.active = false;
    requestImmediateWorkDecision(world, worker);
  }
  building.breeding = undefined;
};

const releaseOrphanedBreedingAnimals = (world: World): void => {
  const activeBreederIds = new Set(
    world.buildings
      .filter((building) => building.kind === "livestockBreeder" && !building.retired)
      .map((building) => building.id),
  );
  const home =
    completedLivestockBreeder(world) ??
    world.buildings.find((building) => building.kind === "hq" && !building.retired);
  if (!home) return;

  for (const animal of world.animals ?? []) {
    const breederId = animal.breedingAt ?? animal.breedingReservedAt;
    if (!breederId || activeBreederIds.has(breederId)) continue;
    releaseAnimal(world, animal, home, new Set([animal.id]));
  }
};

const chooseKind = (
  world: World,
  building: Building,
): LivestockKind | undefined => {
  const preferred = building.breederNextKind ?? "cow";
  const other: LivestockKind = preferred === "cow" ? "sheep" : "cow";
  if (canBreedKind(world, building, preferred)) return preferred;
  if (canBreedKind(world, building, other)) return other;
  return undefined;
};

const assignedStockfarmer = (world: World, building: Building): Person | undefined =>
  world.people.find(
    (person) =>
      person.assignment?.building === building.id &&
      person.assignment.role === "worker",
  );

const livestockBreederEntry = (
  world: World,
  building: Building,
  approachFrom: Building["position"],
): Building["position"] => {
  const tiles = tileIndex(world.tiles);
  const footprint = building.footprint?.length
    ? building.footprint
    : [building.position];
  const reachableEdges = footprint.filter((position) => {
    const tile = tiles.get(key(position));
    if (!tile || !walkable(tile)) return false;
    return neighbors(position).some((neighbor) => {
      const neighborTile = tiles.get(key(neighbor));
      return Boolean(
        neighborTile &&
        walkable(neighborTile) &&
        neighborTile.terrain !== "building",
      );
    });
  });
  const authoredEntrance = reachableEdges.find((position) =>
    same(position, building.position),
  );
  if (authoredEntrance) return { ...authoredEntrance };
  const fallback = reachableEdges
    .sort(
      (a, b) =>
        hexDistance(a, approachFrom) - hexDistance(b, approachFrom) ||
        hexDistance(a, building.position) - hexDistance(b, building.position) ||
        a.q - b.q ||
        a.r - b.r,
    )[0];
  return fallback ? { ...fallback } : { ...building.position };
};

const routePerson = (
  world: World,
  person: Person,
  target: Building["position"],
): boolean => {
  if (same(person.position, target)) {
    person.path = [];
    person.movement = 0;
    return true;
  }
  const path = findPath(world.tiles, person.position, target, 1);
  if (!path) return false;
  person.path = path;
  person.movement = 0;
  person.active = false;
  return true;
};

const cancelGathering = (world: World, building: Building): void => {
  const gathering = building.breedingGathering;
  if (!gathering) return;
  for (const id of gathering.parentIds) {
    const animal = (world.animals ?? []).find((candidate) => candidate.id === id);
    if (!animal) continue;
    animal.breedingReservedAt = undefined;
    animal.followingBreederId = undefined;
    animal.breedingAt = undefined;
    animal.path = [];
    animal.movement = 0;
    animal.returningToHq = true;
    animal.nextMoveTick = world.round;
  }
  building.breedingGathering = undefined;
};

const startGathering = (
  world: World,
  building: Building,
  kind: LivestockKind,
): void => {
  const parents = eligibleParents(world, building, kind).slice(0, 2);
  if (parents.length < 2) return;

  consumeBreedingInputs(building);
  for (const parent of parents) {
    parent.breedingReservedAt = building.id;
    parent.followingBreederId = undefined;
    parent.path = [];
    parent.movement = 0;
    parent.returningToHq = undefined;
  }
  building.breedingGathering = {
    kind,
    parentIds: parents.map((parent) => parent.id),
    collectedIds: [],
  };
  building.breederNextKind = kind === "cow" ? "sheep" : "cow";
};

const advanceGathering = (world: World, building: Building): void => {
  const gathering = building.breedingGathering;
  if (!gathering) return;
  const worker = assignedStockfarmer(world, building);
  if (!worker) {
    cancelGathering(world, building);
    return;
  }
  if (worker.hungerState || worker.sleepState) return;

  let currentId = gathering.currentParentId;
  if (!currentId) {
    currentId = gathering.parentIds.find((id) => !gathering.collectedIds.includes(id));
    gathering.currentParentId = currentId;
  }
  if (!currentId) return;

  const animal = (world.animals ?? []).find((candidate) => candidate.id === currentId);
  if (!animal || animal.breedingReservedAt !== building.id) {
    cancelGathering(world, building);
    return;
  }
  const entry =
    gathering.currentEntry ??
    (gathering.currentEntry = livestockBreederEntry(world, building, animal.position));

  if (animal.followingBreederId !== worker.id) {
    if (!same(worker.position, animal.position)) {
      if (worker.path.length === 0 && !routePerson(world, worker, animal.position))
        cancelGathering(world, building);
      return;
    }
    animal.followingBreederId = worker.id;
    if (!routePerson(world, worker, entry)) {
      cancelGathering(world, building);
      return;
    }
    return;
  }

  if (!same(worker.position, entry)) {
    if (worker.path.length === 0 && !routePerson(world, worker, entry))
      cancelGathering(world, building);
    return;
  }

  if (!same(animal.position, entry)) return;

  animal.followingBreederId = undefined;
  animal.breedingReservedAt = undefined;
  animal.breedingAt = building.id;
  animal.path = [];
  animal.movement = 0;
  gathering.collectedIds.push(animal.id);
  gathering.currentParentId = undefined;
  gathering.currentEntry = undefined;

  if (gathering.collectedIds.length < gathering.parentIds.length) return;

  building.breeding = {
    kind: gathering.kind,
    parentIds: [...gathering.parentIds],
    untilTick: world.round + LIVESTOCK_BREEDING_DURATION_TICKS,
  };
  building.breedingGathering = undefined;
  worker.idleTarget = undefined;
  worker.path = [];
  worker.movement = 0;
  worker.active = true;
};

export function advanceLivestockBreeding(world: World): void {
  releaseOrphanedBreedingAnimals(world);
  const building = completedLivestockBreeder(world);
  if (!building) return;

  if (building.breeding) {
    if (world.round >= building.breeding.untilTick) finishBreeding(world, building);
    return;
  }

  if (building.breedingGathering) {
    advanceGathering(world, building);
    return;
  }

  if (!assignedStockfarmer(world, building) || !hasBreedingInputs(building)) return;

  const kind = chooseKind(world, building);
  if (kind) startGathering(world, building, kind);
}
