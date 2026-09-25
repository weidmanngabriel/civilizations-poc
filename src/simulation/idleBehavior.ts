import type { Building, Good, Hex, Person, World } from "./model";
import { findPath, hexDistance, key, neighbors, same, tileIndex, walkable } from "./hex";
import { CONFIG } from "./scenario";
import { buildingFootprint } from "./buildingPlacement";

const IDLE_MIN_DISTANCE = 2;
const IDLE_MAX_DISTANCE = 4;

const needDue = (person: Person): boolean =>
  Boolean(person.hungerState || person.sleepState) ||
  (person.hunger ?? 100) <= 40 ||
  (person.sleep ?? 100) <= 40;

const isBusy = (person: Person): boolean =>
  Boolean(
    person.ageStage === "child" ||
    person.familyTask ||
    needDue(person) ||
    person.educationTask ||
    person.manualMoveTarget ||
    person.scoutWaypostTask ||
    person.trip ||
    person.farmTask ||
    person.outdoorCarry ||
    person.resourceTarget ||
    person.woodcutter ||
    person.extractor ||
    person.fisher ||
    person.hunter ||
    person.navigationBlocked ||
    person.progress > 0
  );

const workplace = (world: World, person: Person): Building | undefined =>
  person.assignment
    ? world.buildings.find((building) => building.id === person.assignment!.building && !building.retired)
    : undefined;

const livestockBreedingBusy = (world: World, person: Person): boolean => {
  const assignedBuilding = workplace(world, person);
  return Boolean(
    assignedBuilding?.kind === "livestockBreeder" &&
    person.assignment?.role === "worker" &&
    (assignedBuilding.breedingGathering || assignedBuilding.breeding)
  );
};

const livestockResupplyPending = (world: World, person: Person): boolean => {
  const assignedBuilding = workplace(world, person);
  return Boolean(
    assignedBuilding?.kind === "livestockBreeder" &&
    person.assignment?.role === "worker" &&
    !assignedBuilding.breedingGathering &&
    !assignedBuilding.breeding &&
    !productionReady(assignedBuilding)
  );
};

const idleAnchor = (world: World, person: Person): Hex | undefined => {
  if ((person.woodcutter || person.fisher || person.extractor) && person.workArea) return person.workArea.center;
  const assignedBuilding = workplace(world, person);
  if (assignedBuilding) return assignedBuilding.position;
  return undefined;
};

const recipeInputAmount = (building: Building, good: Good): number => {
  if (building.recipe?.inputs) return building.inputInventory?.[good] ?? 0;
  return building.recipe?.input === good ? building.input : 0;
};

const productionReady = (building: Building): boolean => {
  if (!building.recipe || building.construction && !building.construction.complete) return false;
  if (building.output >= CONFIG.outputCapacity) return false;
  const requirements = building.recipe.inputs ??
    (building.recipe.input ? { [building.recipe.input]: building.recipe.amount } : {});
  return Object.entries(requirements).every(([good, amount]) =>
    recipeInputAmount(building, good as Good) + 1e-9 >= (amount ?? 0)
  );
};

const constructionReady = (building: Building): boolean =>
  Boolean(
    building.construction &&
    !building.construction.complete &&
    Object.entries(building.construction.required).every(
      ([good, amount]) => (building.construction!.delivered[good as Good] ?? 0) >= (amount ?? 0),
    ),
  );

const returnToBuilding = (world: World, person: Person, building: Building): void => {
  person.idleTarget = undefined;
  person.path = findPath(world.tiles, person.position, building.position, CONFIG.roadSpeedMultiplier) ?? [];
  person.movement = 0;
  person.active = same(person.position, building.position);
};

const hashScore = (personId: number, position: Hex, round: number): number => {
  let value = Math.imul(personId + 1, 0x45d9f3b) ^ Math.imul(position.q + 2048, 0x27d4eb2d);
  value ^= Math.imul(position.r + 2048, 0x165667b1) ^ Math.floor(round / CONFIG.decisionIntervalTicks);
  value ^= value >>> 16;
  return value >>> 0;
};

const localPath = (world: World, start: Hex, target: Hex, maxSteps: number): Hex[] | undefined => {
  if (same(start, target)) return [];
  const tiles = tileIndex(world.tiles);
  const startTile = tiles.get(key(start));
  const targetTile = tiles.get(key(target));
  if (!startTile || !targetTile || !walkable(startTile) || !walkable(targetTile)) return undefined;

  const startKey = key(start);
  const targetKey = key(target);
  const queue: Array<{ position: Hex; depth: number }> = [{ position: start, depth: 0 }];
  const previous = new Map<string, Hex | undefined>([[startKey, undefined]]);

  for (let index = 0; index < queue.length; index += 1) {
    const current = queue[index]!;
    if (current.depth >= maxSteps) continue;
    for (const next of neighbors(current.position)) {
      const nextKey = key(next);
      if (previous.has(nextKey)) continue;
      const tile = tiles.get(nextKey);
      if (!tile || !walkable(tile)) continue;
      previous.set(nextKey, current.position);
      if (nextKey === targetKey) {
        const path: Hex[] = [next];
        let cursor = current.position;
        while (key(cursor) !== startKey) {
          path.unshift(cursor);
          cursor = previous.get(key(cursor))!;
        }
        return path;
      }
      queue.push({ position: next, depth: current.depth + 1 });
    }
  }
  return undefined;
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
): { target: Hex; path: Hex[] } | undefined => {
  const candidates = nearbyCells(world, anchor)
    .filter((candidate) => !reserved.has(key(candidate)) && !buildingCells.has(key(candidate)))
    .map((candidate) => ({
      candidate,
      distance: hexDistance(anchor, candidate),
      score: hashScore(person.id, candidate, world.round),
    }))
    .sort((a, b) => a.score - b.score || b.distance - a.distance);

  for (const { candidate } of candidates) {
    const localDistance = hexDistance(person.position, candidate);
    const path = localDistance <= IDLE_MAX_DISTANCE * 2
      ? localPath(world, person.position, candidate, IDLE_MAX_DISTANCE * 2)
      : findPath(world.tiles, person.position, candidate, CONFIG.roadSpeedMultiplier);
    if (path) return { target: candidate, path };
  }
  return undefined;
};

export function wakeIdlePeople(world: World): void {
  for (const person of world.people) {
    if (!person.idleTarget) continue;
    if (needDue(person)) {
      person.idleTarget = undefined;
      person.path = [];
      person.movement = 0;
      person.active = false;
      continue;
    }
    if (isBusy(person) || livestockBreedingBusy(world, person)) {
      person.idleTarget = undefined;
      continue;
    }
    const assignedBuilding = workplace(world, person);
    if (assignedBuilding && livestockResupplyPending(world, person)) {
      returnToBuilding(world, person, assignedBuilding);
      continue;
    }
    if (
      assignedBuilding &&
      (
        (person.assignment?.role === "worker" && productionReady(assignedBuilding)) ||
        (person.assignment?.role === "builder" && constructionReady(assignedBuilding))
      )
    ) {
      returnToBuilding(world, person, assignedBuilding);
      continue;
    }
    if (person.path.length && !same(person.path.at(-1)!, person.idleTarget))
      person.idleTarget = undefined;
  }
}

export function syncIdleBehavior(world: World): void {
  const activeBuildings = world.buildings.filter((building) => !building.retired);
  const buildingByCell = new Map<string, Building>();
  const buildingCells = new Set<string>();
  for (const building of activeBuildings)
    for (const position of buildingFootprint(building)) {
      const positionKey = key(position);
      buildingCells.add(positionKey);
      buildingByCell.set(positionKey, building);
    }
  const reserved = new Set<string>();
  for (const person of world.people) {
    if (person.idleTarget) reserved.add(key(person.idleTarget));
    else if (!person.path.length) reserved.add(key(person.position));
  }

  for (const person of world.people) {
    if (
      isBusy(person) ||
      livestockBreedingBusy(world, person) ||
      livestockResupplyPending(world, person)
    ) {
      if (person.idleTarget) reserved.delete(key(person.idleTarget));
      person.idleTarget = undefined;
      continue;
    }
    if (person.path.length) {
      if (person.idleTarget && same(person.path.at(-1)!, person.idleTarget)) person.active = true;
      continue;
    }

    const anchor =
      idleAnchor(world, person) ??
      buildingByCell.get(key(person.position))?.position;
    if (!anchor) continue;
    if (person.idleTarget && same(person.position, person.idleTarget)) {
      person.active = true;
      continue;
    }

    if (person.idleTarget) reserved.delete(key(person.idleTarget));
    const choice = chooseIdleTarget(world, person, anchor, reserved, buildingCells);
    person.idleTarget = choice?.target;
    if (!choice) continue;
    reserved.add(key(choice.target));
    person.path = choice.path;
    person.movement = 0;
    person.active = true;
  }
}
