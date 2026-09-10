import type { Building, Hex, Person, Tile, World } from "./model";
import { findPath, key, same } from "./hex";
import { CONFIG } from "./scenario";

const hexDistance = (a: Hex, b: Hex): number => {
  const dq = a.q - b.q;
  const dr = a.r - b.r;
  return Math.max(Math.abs(dq), Math.abs(dr), Math.abs(dq + dr));
};

const randomIndex = (w: World, length: number): number => {
  w.rngState = (Math.imul(w.rngState, 1664525) + 1013904223) >>> 0;
  return w.rngState % length;
};

const farmFields = (w: World, farmId: string): Building[] =>
  w.buildings.filter(
    (b) => b.kind === "field" && b.farmId === farmId && !b.retired,
  );

const farmFootprint = (farm: Building): Hex[] => farm.footprint ?? [farm.position];

const routeTo = (w: World, p: Person, target: Hex): Hex[] | null =>
  findPath(w.tiles, p.position, target, CONFIG.roadSpeedMultiplier);

const tileAt = (w: World, position: Hex): Tile | undefined =>
  w.tiles.find((tile) => same(tile, position));

const sowCandidates = (w: World, farm: Building, p: Person): { tile: Tile; path: Hex[] }[] => {
  const reserved = new Set(
    w.people
      .filter((person) => person.id !== p.id && person.farmTask?.kind === "sow")
      .map((person) => key(person.farmTask!.target)),
  );
  const occupiedByPeople = new Set(w.people.map((person) => key(person.position)));
  return w.tiles
    .filter(
      (tile) =>
        tile.terrain === "grass" &&
        !reserved.has(key(tile)) &&
        !occupiedByPeople.has(key(tile)) &&
        Math.min(...farmFootprint(farm).map((position) => hexDistance(tile, position))) <=
          CONFIG.farmFieldRadius,
    )
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
  const tile = tileAt(w, target);
  if (!tile || tile.terrain !== "grass") return false;
  const number = w.nextFieldId++;
  w.buildings.push({
    id: `field-${number}`,
    kind: "field",
    name: `Acker ${number}`,
    position: { ...target },
    workers: 0,
    carriers: 0,
    input: 0,
    output: 0,
    farmId: farm.id,
    fieldStage: 1,
    fieldGrowthProgress: 0,
    recipe: { amount: 0, output: "wheat", duration: CONFIG.fieldStageDurationTicks },
  });
  tile.terrain = "field";
  tile.trafficTicks = undefined;
  return true;
};

const harvestField = (w: World, field: Building): void => {
  field.retired = true;
  field.fieldGrowthProgress = 0;
  const tile = tileAt(w, field.position);
  if (tile) {
    tile.terrain = "grass";
    tile.trafficTicks = undefined;
  }
};

/** Advances field growth and active farmer actions. Returns workers that should decide again immediately. */
export function advanceFarmSystem(w: World): number[] {
  const immediate = new Set<number>();
  const activeFertilizers = new Map<string, Person>();

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

    if (task.kind === "sow" && tileAt(w, task.target)?.terrain !== "grass") {
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
      harvestField(w, field);
      const path = routeTo(w, p, farm.position);
      if (path) {
        p.trip = { source: field.id, target: farm.id, good: "wheat", picked: true };
        p.path = path;
        p.movement = 0;
      } else {
        field.output += 1;
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
  for (const field of w.buildings.filter(
    (b) => b.kind === "field" && b.farmId === farmId && !b.retired,
  )) {
    removedIds.add(field.id);
    const tile = tileAt(w, field.position);
    if (tile?.terrain === "field") {
      tile.terrain = "grass";
      tile.trafficTicks = undefined;
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
