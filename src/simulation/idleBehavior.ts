import type { Building, Hex, Person, World } from "./model";
import { findPath, hexDistance, key, neighbors, same, tileIndex, walkable } from "./hex";
import { CONFIG } from "./scenario";
import { buildingFootprint } from "./buildingPlacement";

const IDLE_MIN_DISTANCE = 1;
const IDLE_MAX_DISTANCE = 4;

const isBusy = (person: Person): boolean =>
  Boolean(
    person.hungerState ||
    person.sleepState ||
    person.trip ||
    person.farmTask ||
    person.resourceTarget ||
    person.progress > 0
  );

const workplace = (world: World, person: Person): Building | undefined =>
  person.assignment
    ? world.buildings.find((building) => building.id === person.assignment!.building && !building.retired)
    : undefined;

const idleAnchor = (world: World, person: Person): Hex | undefined => {
  if ((person.woodcutter || person.extractor) && person.workArea) return person.workArea.center;
  const assignedBuilding = workplace(world, person);
  if (assignedBuilding) return assignedBuilding.position;
  return world.buildings.find((building) => building.id === "hq" && !building.retired)?.position;
};

const recipeInputAmount = (building: Building, good: string): number => {
  if (building.recipe?.inputs)
    return building.inputInventory?.[good as keyof typeof building.inputInventory] ?? 0;
  return building.recipe?.input === good ? building.input : 0;
};

const productionReady = (building: Building): boolean => {
  if (!building.recipe || building.construction && !building.construction.complete) return false;
  if (building.output >= CONFIG.outputCapacity) return false;
  const requirements = building.recipe.inputs ??
    (building.recipe.input ? { [building.recipe.input]: building.recipe.amount } : {});
  return Object.entries(requirements).every(([good, amount]) =>
    recipeInputAmount(building, good) + 1e-9 >= (amount ?? 0)
  );
};

const hashScore = (personId: number, position: Hex, round: number): number => {
  let value = Math.imul(personId + 1, 0x45d9f3b) ^ Math.imul(position.q + 2048, 0x27d4eb2d);
  value ^= Math.imul(position.r + 2048, 0x165667b1) ^ Math.floor(round / CONFIG.decisionIntervalTicks);
  value ^= value >>> 16;
  return value >>> 0;
};

const nearbyCells = (world: World, anchor: Hex): Hex[] => {
  const tiles = tileIndex(world.tiles);
  const seen = new Set<string>([key(anchor)]);
  const result: Hex[] = [];
  let frontier = [anchor];
  for (let distance = 1; distance <= IDLE_MAX_DISTANCE; distance += 1) {
    const next: Hex[] = [];
    for (const current of frontier) {
      for (const candidate of neighbors(current)) {
        const candidateKey = key(candidate);
        if (seen.has(candidateKey)) continue;
        seen.add(candidateKey);
        next.push(candidate);
        const tile = tiles.get(candidateKey);
        if (distance >= IDLE_MIN_DISTANCE && tile && walkable(tile)) result.push(candidate);
      }
    }
    frontier = next;
  }
  return result;
};

const chooseIdleTarget = (
  world: World,
  person: Person,
  anchor: Hex,
  reserved: Set<string>,
  buildingCells: Set<string>,
): Hex | undefined => {
  const candidates = nearbyCells(world, anchor)
    .filter((candidate) => !reserved.has(key(candidate)) && !buildingCells.has(key(candidate)))
    .map((candidate) => ({
      candidate,
      path: findPath(world.tiles, person.position, candidate, CONFIG.roadSpeedMultiplier),
      distance: hexDistance(anchor, candidate),
      score: hashScore(person.id, candidate, world.round),
    }))
    .filter((entry): entry is { candidate: Hex; path: Hex[]; distance: number; score: number } =>
      Boolean(entry.path))
    .sort((a, b) => b.distance - a.distance || a.score - b.score);
  return candidates[0]?.candidate;
};

export function wakeIdlePeople(world: World): void {
  for (const person of world.people) {
    if (!person.idleTarget) continue;
    if (isBusy(person)) {
      person.idleTarget = undefined;
      continue;
    }
    const assignedBuilding = workplace(world, person);
    if (person.assignment?.role === "worker" && assignedBuilding && productionReady(assignedBuilding)) {
      person.idleTarget = undefined;
      person.path = [];
      person.movement = 0;
      person.active = false;
      continue;
    }
    if (person.path.length && !same(person.path.at(-1)!, person.idleTarget))
      person.idleTarget = undefined;
  }
}

export function syncIdleBehavior(world: World): void {
  const buildingCells = new Set(
    world.buildings
      .filter((building) => !building.retired)
      .flatMap((building) => buildingFootprint(building).map(key)),
  );
  const reserved = new Set<string>();
  for (const person of world.people) {
    if (person.idleTarget) reserved.add(key(person.idleTarget));
    else if (!person.path.length) reserved.add(key(person.position));
  }

  for (const person of world.people) {
    if (isBusy(person)) {
      if (person.idleTarget) reserved.delete(key(person.idleTarget));
      person.idleTarget = undefined;
      continue;
    }
    if (person.path.length) {
      if (person.idleTarget && same(person.path.at(-1)!, person.idleTarget)) person.active = true;
      continue;
    }

    const anchor = idleAnchor(world, person);
    if (!anchor) continue;
    if (person.idleTarget && same(person.position, person.idleTarget)) {
      person.active = true;
      continue;
    }

    if (person.idleTarget) reserved.delete(key(person.idleTarget));
    const target = chooseIdleTarget(world, person, anchor, reserved, buildingCells);
    person.idleTarget = target;
    if (!target) continue;
    reserved.add(key(target));
    person.path = findPath(world.tiles, person.position, target, CONFIG.roadSpeedMultiplier) ?? [];
    person.movement = 0;
    person.active = true;
  }
}
