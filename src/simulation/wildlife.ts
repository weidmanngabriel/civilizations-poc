import type { Animal, AnimalGroup, AnimalKind, Hex, World } from "./model";
import { key, neighbors, tileIndex, walkable } from "./hex";
import { SIMULATION_HZ } from "./timing";
import { GRID_REFINEMENT, hexDistance } from "./spatial";
import { randomFraction, randomInt } from "./random";

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
    homeWeight: 0.08,
    flockWeight: 0.18,
    randomWeight: 0.48,
    groupTargetWeight: 0.2,
    groupTargetIntervalTicks: 30 * SIMULATION_HZ,
    groupTargetMinDistance: 10,
    groupTargetMaxDistance: 15,
    separationDistance: 2,
    flockRejoinDistance: 5,
    separationWeight: 0.85,
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
  };
  groupList(world).push(group);

  const candidates = world.tiles
    .filter((tile) => validAnimalTile(world, tile) && hexDistance(tile, home) <= GRID_REFINEMENT)
    .sort(
      (a, b) =>
        hexDistance(a, home) - hexDistance(b, home) ||
        a.q - b.q ||
        a.r - b.r,
    );
  const chosenSpawns: Hex[] = [];

  for (let i = 0; i < size; i += 1) {
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
  const q =
    animal.position.q +
    (center.q - animal.position.q) * flockWeight +
    (home.q - animal.position.q) * profile.homeWeight +
    (groupTarget.q - animal.position.q) * profile.groupTargetWeight +
    separationQ * GRID_REFINEMENT * profile.separationWeight +
    randomQ * GRID_REFINEMENT * profile.randomWeight;
  const r =
    animal.position.r +
    (center.r - animal.position.r) * flockWeight +
    (home.r - animal.position.r) * profile.homeWeight +
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
      (randomFraction(world) - 0.5) * 2.4
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

export function frightenAnimalGroup(world: World, groupId: string, danger: Hex): void {
  for (const animal of animalGroupMembers(world, groupId)) {
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

function chooseGroupTarget(world: World, group: AnimalGroup): void {
  const profile = ANIMAL_BEHAVIOR[group.kind];
  const center = animalGroupCenter(world, group.id) ?? group.home;
  const candidates = world.tiles.filter(
    (tile) =>
      validAnimalTile(world, tile) &&
      hexDistance(center, tile) >= profile.groupTargetMinDistance &&
      hexDistance(center, tile) <= profile.groupTargetMaxDistance,
  );
  const chosen = candidates.length
    ? candidates[randomInt(world, 0, candidates.length - 1)]
    : undefined;
  group.target = chosen ? { q: chosen.q, r: chosen.r } : { ...center };
  group.nextTargetTick = world.round + profile.groupTargetIntervalTicks;
}

function advanceAnimalGroups(world: World): void {
  for (const group of groupList(world)) {
    if ((group.nextTargetTick ?? 0) <= world.round) chooseGroupTarget(world, group);
  }
}

export function advanceWildlife(world: World): void {
  advanceAnimalGroups(world);
  for (const animal of animalList(world)) {
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
