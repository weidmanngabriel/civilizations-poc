import type { Building, Hex, Person, Tile, World } from "./model";
import { key, neighbors, same, tileIndex } from "./hex";
import { CONFIG } from "./scenario";
import { findRequiredNavigationPath } from "./wayposts";
import { refinedCellCluster } from "./spatial";
import { naturalResourceFootprint } from "./naturalResources";
import { looseGoodStacks } from "./looseGoods";
import {
  gainProfessionExperience,
  productionMultiplier,
} from "./experience";

const randomIndex = (w: World, length: number): number => {
  w.rngState = (Math.imul(w.rngState, 1664525) + 1013904223) >>> 0;
  return w.rngState % length;
};

const farmFields = (w: World, farmId: string): Building[] =>
  w.buildings.filter(
    (b) => b.kind === "field" && b.farmId === farmId && !b.retired,
  );

const farmFootprint = (farm: Building): Hex[] => farm.footprint ?? [farm.position];

const fieldFootprintAt = (target: Hex): Hex[] =>
  refinedCellCluster({ q: 0, r: 0 }).map((offset) => ({
    q: target.q + offset.q,
    r: target.r + offset.r,
  }));

const routeTo = (w: World, p: Person, target: Hex): Hex[] | null =>
  findRequiredNavigationPath(w, p, target, CONFIG.roadSpeedMultiplier);

const tileAt = (w: World, position: Hex): Tile | undefined =>
  tileIndex(w.tiles).get(key(position));

/** Exact set of cells within the configured step radius of any farm footprint cell. */
const farmAreaPositions = (farm: Building): Hex[] => {
  const visited = new Map<string, Hex>();
  let frontier = farmFootprint(farm).map((position) => ({ ...position }));
  for (const position of frontier) visited.set(key(position), position);

  for (let distance = 0; distance < CONFIG.farmFieldRadius; distance += 1) {
    const next = new Map<string, Hex>();
    for (const position of frontier)
      for (const neighbor of neighbors(position)) {
        const neighborKey = key(neighbor);
        if (visited.has(neighborKey)) continue;
        visited.set(neighborKey, neighbor);
        next.set(neighborKey, neighbor);
      }
    frontier = [...next.values()];
  }
  return [...visited.values()];
};

const physicalObstacleCells = (w: World): Set<string> => {
  const blocked = new Set<string>();
  for (const resource of w.naturalResources) {
    if (resource.depleted) continue;
    for (const position of naturalResourceFootprint(resource)) blocked.add(key(position));
  }
  for (const stack of looseGoodStacks(w)) blocked.add(key(stack.position));
  return blocked;
};

const fieldAreaIsFree = (
  w: World,
  target: Hex,
  reserved: Set<string>,
  occupiedByPeople: Set<string>,
  physicalObstacles: Set<string>,
): boolean => {
  const tiles = tileIndex(w.tiles);
  return fieldFootprintAt(target).every((position) => {
    const positionKey = key(position);
    return (
      tiles.get(positionKey)?.terrain === "grass" &&
      !reserved.has(positionKey) &&
      !occupiedByPeople.has(positionKey) &&
      !physicalObstacles.has(positionKey)
    );
  });
};

const sowCandidates = (w: World, farm: Building, p: Person): { tile: Tile; path: Hex[] }[] => {
  const reserved = new Set<string>();
  for (const person of w.people) {
    if (person.id === p.id || person.farmTask?.kind !== "sow") continue;
    for (const position of fieldFootprintAt(person.farmTask.target)) reserved.add(key(position));
  }
  const occupiedByPeople = new Set(w.people.map((person) => key(person.position)));
  const physicalObstacles = physicalObstacleCells(w);
  const tiles = tileIndex(w.tiles);
  return farmAreaPositions(farm)
    .map((position) => tiles.get(key(position)))
    .filter((tile): tile is Tile => Boolean(tile?.terrain === "grass"))
    .filter((tile) => fieldAreaIsFree(w, tile, reserved, occupiedByPeople, physicalObstacles))
    .map((tile) => {
      const path = routeTo(w, p, tile);
      return path ? { tile, path } : undefined;
    })
    .filter((candidate): candidate is { tile: Tile; path: Hex[] } => Boolean(candidate));
};

const fieldCandidates = (
  w: World,
  farm: Building,
  p: Person,
  predicate: (field: Building) => boolean,
): { field: Building; path: Hex[] }[] =>
  farmFields(w, farm.id)
    .filter(predicate)
    .map((field) => {
      const path = routeTo(w, p, field.position);
      return path ? { field, path } : undefined;
    })
    .filter((candidate): candidate is { field: Building; path: Hex[] } => Boolean(candidate));

const assignSowTask = (w: World, farm: Building, p: Person): boolean => {
  const candidates = sowCandidates(w, farm, p);
  if (!candidates.length) return false;
  const choice = candidates[randomIndex(w, candidates.length)]!;
  p.farmTask = {
    kind: "sow",
    target: { q: choice.tile.q, r: choice.tile.r },
    progress: 0,
  };
  p.path = choice.path;
  p.movement = 0;
  return true;
};

const assignFieldTask = (
  w: World,
  farm: Building,
  p: Person,
  kind: "fertilize" | "harvest",
  predicate: (field: Building) => boolean,
): boolean => {
  const candidates = fieldCandidates(w, farm, p, predicate);
  if (!candidates.length) return false;
  const choice = candidates[randomIndex(w, candidates.length)]!;
  p.farmTask = {
    kind,
    target: { ...choice.field.position },
    fieldId: choice.field.id,
    progress: 0,
    outputMultiplier: kind === "harvest" ? productionMultiplier(p, "farmer") : undefined,
  };
  p.path = choice.path;
  p.movement = 0;
  return true;
};

export function planFarmWorker(w: World, p: Person, farm: Building): boolean {
  if (
    farm.kind !== "farm" ||
    p.assignment?.building !== farm.id ||
    p.assignment.role !== "worker" ||
    p.trip ||
    p.path.length ||
    p.farmTask
  )
    return false;

  const ripeFields = farmFields(w, farm.id).filter((field) => field.fieldStage === 4);
  const incomingWheat = w.people.filter(
    (person) => person.trip?.target === farm.id && person.trip.good === "wheat",
  ).length;
  if (
    farm.output + incomingWheat < CONFIG.outputCapacity &&
    assignFieldTask(
      w,
      farm,
      p,
      "harvest",
      (field) => field.fieldStage === 4,
    )
  )
    return true;
  if (ripeFields.length) return false;

  if (farmFields(w, farm.id).length < CONFIG.farmMaxFields && assignSowTask(w, farm, p))
    return true;

  return assignFieldTask(
    w,
    farm,
    p,
    "fertilize",
    (field) => field.fieldStage !== undefined && field.fieldStage < 4,
  );
}

const createField = (w: World, farm: Building, target: Hex): boolean => {
  const footprint = fieldFootprintAt(target);
  const tiles = tileIndex(w.tiles);
  const physicalObstacles = physicalObstacleCells(w);
  if (!footprint.every((position) =>
    tiles.get(key(position))?.terrain === "grass" && !physicalObstacles.has(key(position)))) return false;
  const number = w.nextFieldId++;
  w.buildings.push({
    id: `field-${number}`,
    kind: "field",
    name: `Acker ${number}`,
    position: { ...target },
    footprint: footprint.map((position) => ({ ...position })),
    workers: 0,
    carriers: 0,
    input: 0,
    output: 0,
    farmId: farm.id,
    fieldStage: 1,
    fieldGrowthProgress: 0,
    recipe: { amount: 0, output: "wheat", duration: CONFIG.fieldStageDurationTicks },
  });
  for (const position of footprint) {
    const tile = tiles.get(key(position))!;
    tile.terrain = "field";
    tile.trafficTicks = undefined;
    tile.bush = undefined;
    tile.bushAvailable = undefined;
    tile.bushRegrowTick = undefined;
  }
  return true;
};

const harvestField = (w: World, field: Building): void => {
  field.retired = true;
  field.fieldGrowthProgress = 0;
  const tiles = tileIndex(w.tiles);
  for (const position of field.footprint ?? [field.position]) {
    const tile = tiles.get(key(position));
    if (tile?.terrain === "field") {
      tile.terrain = "grass";
      tile.trafficTicks = undefined;
    }
  }
};

/** Advances field growth and active farmer actions. Returns workers that should decide again immediately. */
export function advanceFarmSystem(w: World): number[] {
  const immediate = new Set<number>();
  const activeFertilizers = new Map<string, Person>();
  const physicalObstacles = physicalObstacleCells(w);

  for (const p of w.people) {
    const task = p.farmTask;
    if (!task || task.kind !== "fertilize" || p.path.length || !same(p.position, task.target))
      continue;
    const field = task.fieldId
      ? w.buildings.find((b) => b.id === task.fieldId && !b.retired)
      : undefined;
    if (!field || field.kind !== "field" || field.fieldStage === undefined || field.fieldStage === 4) {
      p.farmTask = undefined;
      p.progress = 0;
      immediate.add(p.id);
      continue;
    }
    activeFertilizers.set(field.id, p);
  }

  for (const field of w.buildings.filter(
    (b) => b.kind === "field" && !b.retired && b.fieldStage !== undefined && b.fieldStage < 4,
  )) {
    const currentStage = field.fieldStage;
    if (currentStage === undefined || currentStage >= 4) continue;
    const fertilizer = activeFertilizers.get(field.id);
    field.fieldGrowthProgress = (field.fieldGrowthProgress ?? 0) + (fertilizer ? 3 : 1);
    if (fertilizer) {
      gainProfessionExperience(fertilizer, "farmer");
      fertilizer.farmTask!.progress++;
      fertilizer.progress = fertilizer.farmTask!.progress;
    }
    if (field.fieldGrowthProgress < CONFIG.fieldStageDurationTicks) continue;
    field.fieldStage = (currentStage + 1) as 2 | 3 | 4;
    field.fieldGrowthProgress = 0;
    if (fertilizer) {
      fertilizer.farmTask = undefined;
      fertilizer.progress = 0;
      immediate.add(fertilizer.id);
    }
  }

  for (const p of w.people) {
    const task = p.farmTask;
    if (!task || task.kind === "fertilize" || p.path.length || !same(p.position, task.target))
      continue;
    const farm = p.assignment
      ? w.buildings.find((b) => b.id === p.assignment!.building && b.kind === "farm" && !b.retired)
      : undefined;
    if (!farm) {
      p.farmTask = undefined;
      p.progress = 0;
      immediate.add(p.id);
      continue;
    }

    if (task.kind === "sow" && !fieldFootprintAt(task.target).every((position) =>
      tileAt(w, position)?.terrain === "grass" && !physicalObstacles.has(key(position)))) {
      p.farmTask = undefined;
      p.progress = 0;
      immediate.add(p.id);
      continue;
    }
    if (task.kind === "harvest") {
      const field = task.fieldId
        ? w.buildings.find((b) => b.id === task.fieldId && !b.retired)
        : undefined;
      if (!field || field.kind !== "field" || field.fieldStage !== 4) {
        p.farmTask = undefined;
        p.progress = 0;
        immediate.add(p.id);
        continue;
      }
    }

    gainProfessionExperience(p, "farmer");
    task.progress++;
    p.progress = task.progress;
    if (task.progress < CONFIG.farmActionDurationTicks) continue;

    if (task.kind === "sow") {
      createField(w, farm, task.target);
      p.farmTask = undefined;
      p.progress = 0;
      immediate.add(p.id);
      continue;
    }

    const field = task.fieldId ? w.buildings.find((b) => b.id === task.fieldId) : undefined;
    if (field?.kind === "field" && !field.retired && field.fieldStage === 4) {
      const harvestAmount = task.outputMultiplier ?? productionMultiplier(p, "farmer");
      harvestField(w, field);
      const path = routeTo(w, p, farm.position);
      if (path) {
        p.pendingFarmBonus = Math.max(0, harvestAmount - CONFIG.carryCapacity);
        p.trip = { source: field.id, target: farm.id, good: "wheat", picked: true };
        p.path = path;
        p.movement = 0;
      } else {
        field.output += harvestAmount;
      }
    }
    p.farmTask = undefined;
    p.progress = 0;
    if (!p.trip) immediate.add(p.id);
  }

  return [...immediate];
}

export function rerouteFarmTask(w: World, p: Person): boolean {
  if (!p.farmTask) return false;
  p.path = routeTo(w, p, p.farmTask.target) ?? [];
  p.movement = 0;
  return true;
}

export function clearFarmTask(p: Person): void {
  p.farmTask = undefined;
}

export function removeActiveFarmFields(w: World, farmId: string): void {
  const removedIds = new Set<string>();
  const tiles = tileIndex(w.tiles);
  for (const field of w.buildings.filter(
    (b) => b.kind === "field" && b.farmId === farmId && !b.retired,
  )) {
    removedIds.add(field.id);
    for (const position of field.footprint ?? [field.position]) {
      const tile = tiles.get(key(position));
      if (tile?.terrain === "field") {
        tile.terrain = "grass";
        tile.trafficTicks = undefined;
      }
    }
  }
  if (!removedIds.size) return;
  w.buildings = w.buildings.filter((b) => !removedIds.has(b.id));
  for (const p of w.people) {
    if (p.farmTask?.fieldId && removedIds.has(p.farmTask.fieldId)) {
      p.farmTask = undefined;
      p.progress = 0;
      p.path = [];
      p.movement = 0;
    }
  }
}

export const activeFarmFieldCount = (w: World, farmId: string): number =>
  farmFields(w, farmId).length;
