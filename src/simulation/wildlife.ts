import type { Animal, AnimalGroup, AnimalKind, Hex, World } from "./model";
import { findPath, key, neighbors, tileIndex, walkable } from "./hex";
import { SIMULATION_HZ } from "./timing";
import { GRID_REFINEMENT, hexDistance } from "./spatial";
import { randomFraction, randomInt } from "./random";
import { completedLivestockBreeder } from "./livestockBreeding";

export type AnimalBehaviorProfile = {
  normalMoveMinTicks: number;
  normalMoveMaxTicks: number;
  normalPathMinSteps: number;
  normalPathMaxSteps: number;
  fleeTicks: number;
  fleePathMinSteps: number;
  fleePathMaxSteps: number;
  movementMultiplier: number;
  homeWeight: number;
  flockWeight: number;
  randomWeight: number;
  groupTargetWeight: number;
  groupTargetIntervalTicks: number;
  groupTargetMinDistance: number;
  groupTargetMaxDistance: number;
  /** Comfortable individual spacing inside the group, in micro-cells. */
  separationDistance: number;
  /** Beyond this distance, attraction back toward the flock center resumes. */
  flockRejoinDistance: number;
  separationWeight: number;
  /** Home attraction applies only after the group has roamed this far away. */
  homeReturnDistance: number;
  /** Strength of directional persistence between consecutive group targets. */
  migrationInertiaWeight: number;
  /** Random per-step path wobble; livestock uses lower values than small wildlife. */
  pathJitter: number;
};

export const ANIMAL_BEHAVIOR: Record<AnimalKind, AnimalBehaviorProfile> = {
  hare: {
    normalMoveMinTicks: 4 * SIMULATION_HZ,
    normalMoveMaxTicks: 8 * SIMULATION_HZ,
    normalPathMinSteps: 4,
    normalPathMaxSteps: 8,
    fleeTicks: 5 * SIMULATION_HZ,
    fleePathMinSteps: 6,
    fleePathMaxSteps: 10,
    movementMultiplier: 1.35,
    homeWeight: 0.16,
    flockWeight: 0.18,
    randomWeight: 0.4,
    groupTargetWeight: 0.32,
    groupTargetIntervalTicks: 30 * SIMULATION_HZ,
    groupTargetMinDistance: 10,
    groupTargetMaxDistance: 15,
    separationDistance: 2,
    flockRejoinDistance: 5,
    separationWeight: 0.85,
    homeReturnDistance: 30,
    migrationInertiaWeight: 0.7,
    pathJitter: 2.4,
  },
  boar: {
    normalMoveMinTicks: 4 * SIMULATION_HZ,
    normalMoveMaxTicks: 8 * SIMULATION_HZ,
    normalPathMinSteps: 4,
    normalPathMaxSteps: 8,
    fleeTicks: 5 * SIMULATION_HZ,
    fleePathMinSteps: 6,
    fleePathMaxSteps: 10,
    movementMultiplier: 1.35,
    homeWeight: 0.16,
    flockWeight: 0.18,
    randomWeight: 0.4,
    groupTargetWeight: 0.32,
    groupTargetIntervalTicks: 30 * SIMULATION_HZ,
    groupTargetMinDistance: 10,
    groupTargetMaxDistance: 15,
    separationDistance: 2,
    flockRejoinDistance: 5,
    separationWeight: 0.85,
    homeReturnDistance: 30,
    migrationInertiaWeight: 0.7,
    pathJitter: 2.4,
  },
  cow: {
    normalMoveMinTicks: 6 * SIMULATION_HZ,
    normalMoveMaxTicks: 10 * SIMULATION_HZ,
    normalPathMinSteps: 6,
    normalPathMaxSteps: 10,
    fleeTicks: 5 * SIMULATION_HZ,
    fleePathMinSteps: 7,
    fleePathMaxSteps: 11,
    movementMultiplier: 0.82,
    homeWeight: 0.2,
    flockWeight: 0.28,
    randomWeight: 0.12,
    groupTargetWeight: 0.58,
    groupTargetIntervalTicks: 30 * SIMULATION_HZ,
    groupTargetMinDistance: 14,
    groupTargetMaxDistance: 20,
    separationDistance: 3,
    flockRejoinDistance: 7,
    separationWeight: 0.8,
    homeReturnDistance: 32,
    migrationInertiaWeight: 0.85,
    pathJitter: 0.45,
  },
  sheep: {
    normalMoveMinTicks: 5 * SIMULATION_HZ,
    normalMoveMaxTicks: 9 * SIMULATION_HZ,
    normalPathMinSteps: 8,
    normalPathMaxSteps: 13,
    fleeTicks: 5 * SIMULATION_HZ,
    fleePathMinSteps: 8,
    fleePathMaxSteps: 13,
    movementMultiplier: 1,
    homeWeight: 0.18,
    flockWeight: 0.3,
    randomWeight: 0.15,
    groupTargetWeight: 0.62,
    groupTargetIntervalTicks: 30 * SIMULATION_HZ,
    groupTargetMinDistance: 18,
    groupTargetMaxDistance: 25,
    separationDistance: 2,
    flockRejoinDistance: 7,
    separationWeight: 0.85,
    homeReturnDistance: 36,
    migrationInertiaWeight: 0.88,
    pathJitter: 0.65,
  },
};

const animalList = (world: World): Animal[] => world.animals ?? (world.animals = []);
const groupList = (world: World): AnimalGroup[] => world.animalGroups ?? (world.animalGroups = []);

const validAnimalTile = (world: World, position: Hex): boolean => {
  const tile = tileIndex(world.tiles).get(key(position));
  return Boolean(
    tile &&
    walkable(tile) &&
    tile.terrain !== "building" &&
    tile.terrain !== "river" &&
    tile.terrain !== "mountain",
  );
};

const nearestValidSpawn = (world: World, requested: Hex): Hex | undefined =>
  [...world.tiles]
    .filter((tile) => validAnimalTile(world, tile))
    .sort(
      (a, b) =>
        hexDistance(a, requested) - hexDistance(b, requested) ||
        a.q - b.q ||
        a.r - b.r,
    )[0];

const nextAnimalId = (world: World): string => {
  const id = world.nextAnimalId ?? 1;
  world.nextAnimalId = id + 1;
  return `animal-${id}`;
};

const nextAnimalGroupId = (world: World): string => {
  const id = world.nextAnimalGroupId ?? 1;
  world.nextAnimalGroupId = id + 1;
  return `animal-group-${id}`;
};

export function spawnAnimalGroup(
  world: World,
  kind: AnimalKind,
  requestedHome: Hex,
  size: number,
): AnimalGroup | undefined {
  const home = nearestValidSpawn(world, requestedHome);
  if (!home || size <= 0) return undefined;

  const profile = ANIMAL_BEHAVIOR[kind];
  const group: AnimalGroup = {
    id: nextAnimalGroupId(world),
    kind,
    home: { ...home },
    target: { ...home },
    nextTargetTick: world.round + profile.groupTargetIntervalTicks,
    migrationDirection: { q: 0, r: 0 },
  };
  groupList(world).push(group);

  const spawnCount = kind === "boar" ? 1 : size;
  const candidates = world.tiles
    .filter((tile) => validAnimalTile(world, tile) && hexDistance(tile, home) <= GRID_REFINEMENT)
    .sort(
      (a, b) =>
        hexDistance(a, home) - hexDistance(b, home) ||
        a.q - b.q ||
        a.r - b.r,
    );
  const chosenSpawns: Hex[] = [];

  for (let i = 0; i < spawnCount; i += 1) {
    const spawn =
      candidates.find((candidate) =>
        chosenSpawns.every(
          (chosen) => hexDistance(candidate, chosen) >= profile.separationDistance,
        ),
      ) ??
      candidates.find((candidate) =>
        chosenSpawns.every((chosen) => key(candidate) !== key(chosen)),
      ) ??
      home;
    chosenSpawns.push({ q: spawn.q, r: spawn.r });
    animalList(world).push({
      id: nextAnimalId(world),
      kind,
      groupId: group.id,
      position: { q: spawn.q, r: spawn.r },
      path: [],
      movement: 0,
      nextMoveTick:
        world.round + randomInt(world, profile.normalMoveMinTicks, profile.normalMoveMaxTicks),
    });
  }
  return group;
}

export const LIVESTOCK_CAPTURE_RADIUS = 2;
export const OWNED_LIVESTOCK_PASTURE_RADIUS = 10;
const OWNED_LIVESTOCK_ARRIVAL_MIN_RADIUS = 4;
const OWNED_LIVESTOCK_ARRIVAL_MAX_RADIUS = 8;

const ownedRestRange = (kind: "cow" | "sheep"): [number, number] =>
  kind === "cow"
    ? [12 * SIMULATION_HZ, 25 * SIMULATION_HZ]
    : [8 * SIMULATION_HZ, 18 * SIMULATION_HZ];

const ownedStepRange = (kind: "cow" | "sheep"): [number, number] =>
  kind === "cow" ? [2, 4] : [3, 6];

const isLivestock = (animal: Animal): boolean =>
  animal.kind === "cow" || animal.kind === "sheep";

const ownedLivestockHome = (world: World): Hex | undefined =>
  completedLivestockBreeder(world)?.position ??
  world.buildings.find(
    (building) => building.kind === "hq" && !building.retired,
  )?.position;

const syncOwnedLivestockHomes = (world: World): void => {
  const home = ownedLivestockHome(world);
  if (!home) return;
  for (const kind of ["cow", "sheep"] as const) {
    const group = groupList(world).find((candidate) => candidate.id === `owned-${kind}`);
    if (group && (group.home.q !== home.q || group.home.r !== home.r)) {
      group.home = { ...home };
      group.target = { ...home };
      group.nextTargetTick = world.round;
      for (const animal of animalList(world)) {
        if (
          animal.owner !== "player" ||
          animal.kind !== kind ||
          animal.breedingAt
        ) continue;
        animal.returningToHq = true;
        animal.path = [];
        animal.movement = 0;
        animal.nextMoveTick = world.round;
      }
    }
  }
};

const ownedGroup = (world: World, kind: "cow" | "sheep", home: Hex): AnimalGroup => {
  const existing = groupList(world).find(
    (group) => group.kind === kind && group.id === `owned-${kind}`,
  );
  if (existing) return existing;
  const profile = ANIMAL_BEHAVIOR[kind];
  const group: AnimalGroup = {
    id: `owned-${kind}`,
    kind,
    home: { ...home },
    target: { ...home },
    nextTargetTick: world.round + profile.groupTargetIntervalTicks,
    migrationDirection: { q: 0, r: 0 },
  };
  groupList(world).push(group);
  return group;
};

const ownedPastureTarget = (
  world: World,
  animal: Animal,
  home: Hex,
  minRadius: number,
  maxRadius: number,
): Hex | undefined => {
  const occupied = occupiedAnimalCells(world, animal.id);
  const reserved = reservedAnimalEndpoints(world, animal.id);
  const sameKindOwned = animalList(world).filter(
    (candidate) =>
      candidate.id !== animal.id &&
      candidate.owner === "player" &&
      candidate.kind === animal.kind,
  );

  const candidates = world.tiles
    .filter((tile) => {
      if (!validAnimalTile(world, tile)) return false;
      const homeDistance = hexDistance(home, tile);
      if (homeDistance < minRadius || homeDistance > maxRadius) return false;
      if (occupied.has(key(tile)) || reserved.has(key(tile))) return false;
      return sameKindOwned.every(
        (other) =>
          hexDistance(tile, other.position) >=
          ANIMAL_BEHAVIOR[animal.kind].separationDistance,
      );
    })
    .sort(
      (a, b) =>
        hexDistance(animal.position, a) - hexDistance(animal.position, b) ||
        a.q - b.q ||
        a.r - b.r,
    );

  if (!candidates.length) return undefined;
  const shortlist = candidates.slice(0, Math.min(12, candidates.length));
  return shortlist[randomInt(world, 0, shortlist.length - 1)];
};

const scheduleOwnedRest = (world: World, animal: Animal): void => {
  const [minTicks, maxTicks] = ownedRestRange(animal.kind as "cow" | "sheep");
  animal.nextMoveTick = world.round + randomInt(world, minTicks, maxTicks);
  animal.movement = 0;
};

const planOwnedGrazingMovement = (world: World, animal: Animal): void => {
  const group = groupList(world).find((candidate) => candidate.id === animal.groupId);
  const home = group?.home ?? animal.position;
  const [minSteps, maxSteps] = ownedStepRange(animal.kind as "cow" | "sheep");
  const steps = randomInt(world, minSteps, maxSteps);
  const target =
    ownedPastureTarget(world, animal, home, 2, OWNED_LIVESTOCK_PASTURE_RADIUS) ??
    home;
  animal.path = zigZagPath(world, animal, target, steps);
  animal.movement = 0;
  if (!animal.path.length) scheduleOwnedRest(world, animal);
};

export type LivestockCaptureStats = {
  proximityChecks: number;
  captures: number;
};

export function captureNearbyLivestock(world: World): LivestockCaptureStats {
  const scouts = world.people.filter((person) => person.profession === "scout");
  const livestock = animalList(world).filter((animal) => isLivestock(animal) && !animal.owner);
  let proximityChecks = 0;
  let captures = 0;
  const home = ownedLivestockHome(world);
  if (!home || !scouts.length || !livestock.length) return { proximityChecks, captures };

  for (const animal of livestock) {
    let captured = false;
    for (const scout of scouts) {
      proximityChecks += 1;
      if (hexDistance(scout.position, animal.position) > LIVESTOCK_CAPTURE_RADIUS) continue;
      animal.owner = "player";
      animal.returningToHq = true;
      animal.fleeingUntilTick = undefined;
      animal.fleeFrom = undefined;
      animal.movement = 0;
      const pastureTarget =
        ownedPastureTarget(
          world,
          animal,
          home,
          OWNED_LIVESTOCK_ARRIVAL_MIN_RADIUS,
          OWNED_LIVESTOCK_ARRIVAL_MAX_RADIUS,
        ) ?? home;
      animal.path =
        findPath(world.tiles, animal.position, pastureTarget, 1) ?? [];
      captured = true;
      captures += 1;
      break;
    }
    if (!captured) continue;
  }
  return { proximityChecks, captures };
}

export const animalGroupMembers = (world: World, groupId: string): Animal[] =>
  animalList(world).filter((animal) => animal.groupId === groupId);

export function animalGroupCenter(world: World, groupId: string): Hex | undefined {
  const members = animalGroupMembers(world, groupId);
  if (!members.length) return undefined;
  return {
    q: Math.round(members.reduce((sum, animal) => sum + animal.position.q, 0) / members.length),
    r: Math.round(members.reduce((sum, animal) => sum + animal.position.r, 0) / members.length),
  };
}

const weightedTarget = (
  world: World,
  animal: Animal,
  profile: AnimalBehaviorProfile,
): Hex => {
  const group = groupList(world).find((candidate) => candidate.id === animal.groupId);
  const center = animalGroupCenter(world, animal.groupId) ?? animal.position;
  const home = group?.home ?? animal.position;
  const groupTarget = group?.target ?? center;
  const members = animalGroupMembers(world, animal.groupId).filter(
    (candidate) => candidate.id !== animal.id,
  );
  const centerDistance = hexDistance(animal.position, center);
  const flockWeight =
    centerDistance > profile.flockRejoinDistance ? profile.flockWeight : 0;

  let separationQ = 0;
  let separationR = 0;
  for (const member of members) {
    const distance = hexDistance(animal.position, member.position);
    if (distance <= 0 || distance > profile.separationDistance) continue;
    const pressure = (profile.separationDistance + 1 - distance) / profile.separationDistance;
    separationQ += Math.sign(animal.position.q - member.position.q) * pressure;
    separationR += Math.sign(animal.position.r - member.position.r) * pressure;
  }

  const randomQ = randomFraction(world) * 2 - 1;
  const randomR = randomFraction(world) * 2 - 1;
  const homeWeight =
    hexDistance(center, home) > profile.homeReturnDistance ? profile.homeWeight : 0;
  const q =
    animal.position.q +
    (center.q - animal.position.q) * flockWeight +
    (home.q - animal.position.q) * homeWeight +
    (groupTarget.q - animal.position.q) * profile.groupTargetWeight +
    separationQ * GRID_REFINEMENT * profile.separationWeight +
    randomQ * GRID_REFINEMENT * profile.randomWeight;
  const r =
    animal.position.r +
    (center.r - animal.position.r) * flockWeight +
    (home.r - animal.position.r) * homeWeight +
    (groupTarget.r - animal.position.r) * profile.groupTargetWeight +
    separationR * GRID_REFINEMENT * profile.separationWeight +
    randomR * GRID_REFINEMENT * profile.randomWeight;
  return { q: Math.round(q), r: Math.round(r) };
};

const fleeTarget = (world: World, animal: Animal, steps: number): Hex => {
  const danger = animal.fleeFrom ?? animal.position;
  let dq = animal.position.q - danger.q;
  let dr = animal.position.r - danger.r;
  if (dq === 0 && dr === 0) {
    dq = randomFraction(world) < 0.5 ? -1 : 1;
    dr = randomFraction(world) < 0.5 ? -1 : 1;
  }
  return {
    q: animal.position.q + Math.sign(dq) * steps + randomInt(world, -2, 2),
    r: animal.position.r + Math.sign(dr) * steps + randomInt(world, -2, 2),
  };
};

const occupiedAnimalCells = (world: World, exceptId?: string): Set<string> =>
  new Set(
    animalList(world)
      .filter((candidate) => candidate.id !== exceptId)
      .map((candidate) => key(candidate.position)),
  );

const reservedAnimalEndpoints = (world: World, exceptId?: string): Set<string> =>
  new Set(
    animalList(world)
      .filter((candidate) => candidate.id !== exceptId && candidate.path.length)
      .map((candidate) => key(candidate.path[candidate.path.length - 1]!)),
  );

function zigZagPath(
  world: World,
  animal: Animal,
  target: Hex,
  stepCount: number,
): Hex[] {
  const tiles = tileIndex(world.tiles);
  const occupied = occupiedAnimalCells(world, animal.id);
  const reserved = reservedAnimalEndpoints(world, animal.id);
  const path: Hex[] = [];
  let current = { ...animal.position };
  let previous: Hex | undefined;

  const candidateScore = (candidate: Hex): number => {
    const nearestOther = animalList(world)
      .filter((other) => other.id !== animal.id && other.groupId === animal.groupId)
      .reduce(
        (nearest, other) => Math.min(nearest, hexDistance(candidate, other.position)),
        Number.POSITIVE_INFINITY,
      );
    const crowdPenalty =
      nearestOther < ANIMAL_BEHAVIOR[animal.kind].separationDistance
        ? (ANIMAL_BEHAVIOR[animal.kind].separationDistance - nearestOther + 1) * 3
        : 0;
    return (
      hexDistance(candidate, target) +
      crowdPenalty +
      (randomFraction(world) - 0.5) * ANIMAL_BEHAVIOR[animal.kind].pathJitter
    );
  };

  const appendBestStep = (): boolean => {
    const candidates = neighbors(current)
      .filter((candidate) => {
        const tile = tiles.get(key(candidate));
        return Boolean(tile && walkable(tile) && tile.terrain !== "building");
      })
      .filter((candidate) => !previous || candidate.q !== previous.q || candidate.r !== previous.r)
      .filter((candidate) => !occupied.has(key(candidate)))
      .map((candidate) => ({ candidate, score: candidateScore(candidate) }))
      .sort(
        (a, b) =>
          a.score - b.score ||
          a.candidate.q - b.candidate.q ||
          a.candidate.r - b.candidate.r,
      );
    const next = candidates[0]?.candidate;
    if (!next) return false;
    path.push({ ...next });
    previous = current;
    current = { ...next };
    return true;
  };

  for (let step = 0; step < stepCount; step += 1)
    if (!appendBestStep()) break;

  // A hare must not finish on an occupied/reserved cell. If its planned stop
  // would overlap another hare, it keeps hopping until a free endpoint exists.
  let extensionSteps = 0;
  while (
    path.length &&
    (occupied.has(key(path[path.length - 1]!)) || reserved.has(key(path[path.length - 1]!))) &&
    extensionSteps < 4
  ) {
    if (!appendBestStep()) break;
    extensionSteps += 1;
  }

  return path;
}

function planNormalMovement(world: World, animal: Animal): void {
  const profile = ANIMAL_BEHAVIOR[animal.kind];
  const steps = randomInt(world, profile.normalPathMinSteps, profile.normalPathMaxSteps);
  animal.path = zigZagPath(world, animal, weightedTarget(world, animal, profile), steps);
  animal.movement = 0;
  animal.nextMoveTick =
    world.round + randomInt(world, profile.normalMoveMinTicks, profile.normalMoveMaxTicks);
}

function planFleeMovement(world: World, animal: Animal): void {
  const profile = ANIMAL_BEHAVIOR[animal.kind];
  const steps = randomInt(world, profile.fleePathMinSteps, profile.fleePathMaxSteps);
  animal.path = zigZagPath(world, animal, fleeTarget(world, animal, steps), steps);
  animal.movement = 0;
}

export const GROUP_FRIGHTEN_RADIUS = 10;

export function frightenAnimalGroup(
  world: World,
  groupId: string,
  danger: Hex,
  attackedPosition: Hex,
): void {
  for (const animal of animalGroupMembers(world, groupId)) {
    if (hexDistance(animal.position, attackedPosition) > GROUP_FRIGHTEN_RADIUS)
      continue;
    const profile = ANIMAL_BEHAVIOR[animal.kind];
    animal.fleeingUntilTick = world.round + profile.fleeTicks;
    animal.fleeFrom = { ...danger };
    animal.nextMoveTick = world.round;
    planFleeMovement(world, animal);
  }
}

export const animalIsFleeing = (world: World, animal: Animal): boolean =>
  (animal.fleeingUntilTick ?? -1) > world.round;

function advanceAnimalMovement(world: World, animal: Animal): void {
  const profile = ANIMAL_BEHAVIOR[animal.kind];
  if (!animal.path.length) return;
  animal.movement +=
    ((2.5 / 3) * GRID_REFINEMENT / SIMULATION_HZ) * profile.movementMultiplier;
  let moves = 0;
  while (animal.path.length && animal.movement + 1e-9 >= 1 && moves < 4) {
    const next = animal.path[0]!;
    const occupied = animalList(world).some(
      (candidate) =>
        candidate.id !== animal.id &&
        candidate.position.q === next.q &&
        candidate.position.r === next.r,
    );
    if (!validAnimalTile(world, next) || occupied) {
      animal.path = [];
      animal.movement = 0;
      animal.nextMoveTick = world.round;
      return;
    }
    animal.path.shift();
    animal.movement = Math.max(0, animal.movement - 1);
    animal.position = { ...next };
    moves += 1;
  }
}

const normalizedDirection = (from: Hex, to: Hex): { q: number; r: number } => {
  const dq = to.q - from.q;
  const dr = to.r - from.r;
  const length = Math.hypot(dq, dr);
  return length > 0 ? { q: dq / length, r: dr / length } : { q: 0, r: 0 };
};

function chooseGroupTarget(world: World, group: AnimalGroup): void {
  const profile = ANIMAL_BEHAVIOR[group.kind];
  const center = animalGroupCenter(world, group.id) ?? group.home;
  const previousDirection = group.migrationDirection ?? { q: 0, r: 0 };
  const homeDistance = hexDistance(center, group.home);

  const candidates = world.tiles
    .filter(
      (tile) =>
        validAnimalTile(world, tile) &&
        hexDistance(center, tile) >= profile.groupTargetMinDistance &&
        hexDistance(center, tile) <= profile.groupTargetMaxDistance,
    )
    .map((tile) => {
      const direction = normalizedDirection(center, tile);
      const inertia =
        direction.q * previousDirection.q + direction.r * previousDirection.r;
      const homeBias =
        homeDistance > profile.homeReturnDistance
          ? hexDistance(tile, group.home) - hexDistance(center, group.home)
          : 0;
      return {
        tile,
        score:
          inertia * profile.migrationInertiaWeight -
          Math.max(0, homeBias) * 0.08 +
          (randomFraction(world) - 0.5) * 0.6,
      };
    })
    .sort(
      (a, b) =>
        b.score - a.score ||
        a.tile.q - b.tile.q ||
        a.tile.r - b.tile.r,
    );

  const chosen = candidates[0]?.tile;
  if (chosen) {
    const direction = normalizedDirection(center, chosen);
    group.target = { q: chosen.q, r: chosen.r };
    group.migrationDirection = { q: direction.q, r: direction.r };
  } else {
    group.target = { ...center };
  }
  group.nextTargetTick = world.round + profile.groupTargetIntervalTicks;
}

function advanceAnimalGroups(world: World): void {
  for (const group of groupList(world)) {
    if ((group.nextTargetTick ?? 0) <= world.round) chooseGroupTarget(world, group);
  }
}

export function advanceWildlife(world: World): void {
  syncOwnedLivestockHomes(world);
  advanceAnimalGroups(world);
  for (const animal of animalList(world)) {
    if (animal.breedingAt) continue;
    if (animal.owner === "player" && animal.returningToHq) {
      const home = ownedLivestockHome(world);
      if (!home) continue;

      if (!animal.path.length) {
        if (hexDistance(animal.position, home) <= OWNED_LIVESTOCK_PASTURE_RADIUS) {
          animal.returningToHq = undefined;
          animal.groupId = ownedGroup(
            world,
            animal.kind as "cow" | "sheep",
            home,
          ).id;
          scheduleOwnedRest(world, animal);
          continue;
        }

        const pastureTarget =
          ownedPastureTarget(
            world,
            animal,
            home,
            OWNED_LIVESTOCK_ARRIVAL_MIN_RADIUS,
            OWNED_LIVESTOCK_ARRIVAL_MAX_RADIUS,
          ) ?? home;
        animal.path = findPath(world.tiles, animal.position, pastureTarget, 1) ?? [];
        animal.movement = 0;
      }

      advanceAnimalMovement(world, animal);
      if (
        !animal.path.length &&
        hexDistance(animal.position, home) <= OWNED_LIVESTOCK_PASTURE_RADIUS
      ) {
        animal.returningToHq = undefined;
        animal.groupId = ownedGroup(
          world,
          animal.kind as "cow" | "sheep",
          home,
        ).id;
        scheduleOwnedRest(world, animal);
      }
      continue;
    }

    if (animal.owner === "player" && isLivestock(animal)) {
      if (!animal.path.length && world.round >= animal.nextMoveTick)
        planOwnedGrazingMovement(world, animal);

      const wasMoving = animal.path.length > 0;
      advanceAnimalMovement(world, animal);
      if (wasMoving && !animal.path.length) scheduleOwnedRest(world, animal);
      continue;
    }

    const fleeing = animalIsFleeing(world, animal);
    if (!fleeing && animal.fleeingUntilTick !== undefined) {
      animal.fleeingUntilTick = undefined;
      animal.fleeFrom = undefined;
      animal.path = [];
      animal.movement = 0;
      const profile = ANIMAL_BEHAVIOR[animal.kind];
      animal.nextMoveTick =
        world.round + randomInt(world, profile.normalMoveMinTicks, profile.normalMoveMaxTicks);
    }

    if (fleeing && !animal.path.length) planFleeMovement(world, animal);
    else if (!fleeing && !animal.path.length && world.round >= animal.nextMoveTick)
      planNormalMovement(world, animal);

    advanceAnimalMovement(world, animal);
  }
}

export function removeAnimal(world: World, animalId: string): Animal | undefined {
  const animals = animalList(world);
  const index = animals.findIndex((animal) => animal.id === animalId);
  if (index < 0) return undefined;
  const [removed] = animals.splice(index, 1);
  return removed;
}
