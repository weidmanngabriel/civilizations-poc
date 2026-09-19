import type { Animal, AnimalGroup, AnimalKind, Hex, World } from "./model";
import { key, neighbors, tileIndex, walkable } from "./hex";
import { CONFIG } from "./scenario";
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
};

export const ANIMAL_BEHAVIOR: Record<AnimalKind, AnimalBehaviorProfile> = {
  hare: {
    normalMoveMinTicks: 4 * CONFIG.simulationHz,
    normalMoveMaxTicks: 8 * CONFIG.simulationHz,
    normalPathMinSteps: 4,
    normalPathMaxSteps: 8,
    fleeTicks: 5 * CONFIG.simulationHz,
    fleePathMinSteps: 6,
    fleePathMaxSteps: 10,
    movementMultiplier: 1.35,
    homeWeight: 0.3,
    flockWeight: 0.55,
    randomWeight: 0.15,
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

  const group: AnimalGroup = {
    id: nextAnimalGroupId(world),
    kind,
    home: { ...home },
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

  for (let i = 0; i < size; i += 1) {
    const spawn = candidates[i % Math.max(1, candidates.length)] ?? home;
    const profile = ANIMAL_BEHAVIOR[kind];
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
  const randomQ = randomFraction(world) * 2 - 1;
  const randomR = randomFraction(world) * 2 - 1;
  const q =
    animal.position.q +
    (center.q - animal.position.q) * profile.flockWeight +
    (home.q - animal.position.q) * profile.homeWeight +
    randomQ * GRID_REFINEMENT * profile.randomWeight;
  const r =
    animal.position.r +
    (center.r - animal.position.r) * profile.flockWeight +
    (home.r - animal.position.r) * profile.homeWeight +
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

function zigZagPath(
  world: World,
  start: Hex,
  target: Hex,
  stepCount: number,
): Hex[] {
  const tiles = tileIndex(world.tiles);
  const path: Hex[] = [];
  let current = { ...start };
  let previous: Hex | undefined;

  for (let step = 0; step < stepCount; step += 1) {
    const candidates = neighbors(current)
      .filter((candidate) => {
        const tile = tiles.get(key(candidate));
        return Boolean(tile && walkable(tile) && tile.terrain !== "building");
      })
      .filter((candidate) => !previous || candidate.q !== previous.q || candidate.r !== previous.r)
      .map((candidate) => ({
        candidate,
        score:
          hexDistance(candidate, target) +
          (randomFraction(world) - 0.5) * 2.4,
      }))
      .sort(
        (a, b) =>
          a.score - b.score ||
          a.candidate.q - b.candidate.q ||
          a.candidate.r - b.candidate.r,
      );
    const next = candidates[0]?.candidate;
    if (!next) break;
    path.push({ ...next });
    previous = current;
    current = { ...next };
  }
  return path;
}

function planNormalMovement(world: World, animal: Animal): void {
  const profile = ANIMAL_BEHAVIOR[animal.kind];
  const steps = randomInt(world, profile.normalPathMinSteps, profile.normalPathMaxSteps);
  animal.path = zigZagPath(world, animal.position, weightedTarget(world, animal, profile), steps);
  animal.movement = 0;
  animal.nextMoveTick =
    world.round + randomInt(world, profile.normalMoveMinTicks, profile.normalMoveMaxTicks);
}

function planFleeMovement(world: World, animal: Animal): void {
  const profile = ANIMAL_BEHAVIOR[animal.kind];
  const steps = randomInt(world, profile.fleePathMinSteps, profile.fleePathMaxSteps);
  animal.path = zigZagPath(world, animal.position, fleeTarget(world, animal, steps), steps);
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
  animal.movement += CONFIG.movementPerTick * profile.movementMultiplier;
  let moves = 0;
  while (animal.path.length && animal.movement + 1e-9 >= 1 && moves < 4) {
    const next = animal.path.shift()!;
    if (!validAnimalTile(world, next)) {
      animal.path = [];
      animal.movement = 0;
      return;
    }
    animal.movement = Math.max(0, animal.movement - 1);
    animal.position = { ...next };
    moves += 1;
  }
}

export function advanceWildlife(world: World): void {
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
