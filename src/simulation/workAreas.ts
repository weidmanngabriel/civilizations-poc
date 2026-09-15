import type {
  Building,
  Good,
  Hex,
  NaturalResource,
  NaturalResourceKind,
  Person,
  World,
} from "./model";
import { findPath, pathTravelCost, same } from "./hex";
import { CONFIG } from "./scenario";
import { GRID_REFINEMENT, hexDistance } from "./spatial";

export const WORK_AREA_RADIUS_WORLD_TILES = 2.5;
export const WORK_AREA_RADIUS = WORK_AREA_RADIUS_WORLD_TILES * GRID_REFINEMENT;

const ALL_GOODS: Good[] = [
  "wood",
  "plank",
  "woodenTool",
  "wheat",
  "flour",
  "water",
  "bread",
  "clay",
  "rubble",
  "brick",
  "stoneBlock",
];

const isComplete = (building: Building): boolean =>
  !building.construction || building.construction.complete;

const storageCarrierWorkplace = (world: World, person: Person): Building | undefined => {
  if (person.assignment?.role !== "carrier") return undefined;
  return world.buildings.find(
    (building) =>
      building.id === person.assignment!.building &&
      !building.retired &&
      isComplete(building) &&
      (building.kind === "warehouse" || building.kind === "hq"),
  );
};

/** Presentation can use this without needing the world: eligible people always own a workArea. */
export const supportsWorkArea = (person: Person): boolean =>
  Boolean(person.woodcutter || person.extractor || person.workArea);

export const workAreaContains = (person: Person, position: Hex): boolean =>
  Boolean(
    person.workArea &&
      hexDistance(person.workArea.center, position) <= person.workArea.radius,
  );

function defaultWorkAreaCenter(world: World, person: Person): Hex {
  if (person.resourceTarget) {
    const resource = world.naturalResources.find(
      (candidate) => candidate.id === person.resourceTarget,
    );
    if (resource) return resource.position;
  }
  const workplace = storageCarrierWorkplace(world, person);
  return workplace?.position ?? person.position;
}

export function ensureWorkArea(
  world: World,
  person: Person,
  preferredCenter?: Hex,
): void {
  if (person.workArea) return;
  const center = preferredCenter ?? defaultWorkAreaCenter(world, person);
  person.workArea = {
    center: { q: center.q, r: center.r },
    radius: WORK_AREA_RADIUS,
  };
}

export function clearWorkArea(person: Person): void {
  person.workArea = undefined;
}

function resourceKindFor(person: Person): NaturalResourceKind | undefined {
  if (person.woodcutter) return "forest";
  return person.extractor;
}

function claimedByOther(world: World, person: Person, resource: NaturalResource): boolean {
  return world.people.some(
    (candidate) =>
      candidate.id !== person.id && candidate.resourceTarget === resource.id,
  );
}

type ResourceCandidate = {
  resource: NaturalResource;
  path: Hex[];
  cost: number;
};

function planLocalResource(world: World, person: Person): boolean {
  const area = person.workArea;
  const kind = resourceKindFor(person);
  if (!area || !kind) return false;

  const candidates: ResourceCandidate[] = [];
  for (const resource of world.naturalResources) {
    if (
      resource.kind !== kind ||
      resource.depleted ||
      resource.remaining <= 0 ||
      hexDistance(area.center, resource.position) > area.radius ||
      claimedByOther(world, person, resource)
    ) continue;
    const path = findPath(
      world.tiles,
      person.position,
      resource.position,
      CONFIG.roadSpeedMultiplier,
    );
    if (!path) continue;
    candidates.push({
      resource,
      path,
      cost: pathTravelCost(world.tiles, path, CONFIG.roadSpeedMultiplier),
    });
  }

  candidates.sort(
    (a, b) =>
      a.cost - b.cost ||
      a.resource.position.q - b.resource.position.q ||
      a.resource.position.r - b.resource.position.r ||
      a.resource.id.localeCompare(b.resource.id),
  );
  const candidate = candidates[0];
  if (!candidate) return false;

  person.resourceTarget = candidate.resource.id;
  person.assignment = undefined;
  person.path = candidate.path;
  person.movement = 0;
  person.active = same(person.position, candidate.resource.position);
  area.retryAfterTick = undefined;
  return true;
}

const incomingTo = (world: World, target: string, good: Good): number =>
  world.people.filter(
    (person) => person.trip?.target === target && person.trip.good === good,
  ).length;

const reservedAtSource = (
  world: World,
  sourceId: string,
  good: Good,
  sourceKind?: "resource",
): number =>
  world.people.filter(
    (person) =>
      person.trip?.source === sourceId &&
      person.trip.good === good &&
      person.trip.sourceKind === sourceKind &&
      !person.trip.picked,
  ).length;

const buildingSourceStock = (building: Building, good: Good): number => {
  if (!isComplete(building) || building.retired) return 0;
  if (building.kind === "warehouse" || building.kind === "hq") return 0;
  if (building.kind === "well" && good === "water") return Number.MAX_SAFE_INTEGER;
  if (building.kind === "farm" && good === "wheat") return building.output;
  return building.recipe?.output === good ? building.output : 0;
};

const resourceGood = (resource: NaturalResource): Good =>
  resource.kind === "forest" ? "wood" : resource.kind === "clay" ? "clay" : "rubble";

type CarrierCandidate = {
  sourceId: string;
  sourceKind?: "resource";
  good: Good;
  path: Hex[];
  cost: number;
};

function planLocalStorageCarrier(world: World, person: Person): boolean {
  const target = storageCarrierWorkplace(world, person);
  const area = person.workArea;
  if (!target || !area) return false;

  const hqProxy = target.kind === "hq"
    ? world.buildings.find((candidate) => candidate.id === "hq-storage-proxy")
    : undefined;
  const tripTarget = target.kind === "hq" ? hqProxy?.id : target.id;
  if (!tripTarget) return false;
  const candidates: CarrierCandidate[] = [];

  for (const good of ALL_GOODS) {
    if (
      (target.inventory?.[good] ?? 0) +
        incomingTo(world, tripTarget, good) +
        CONFIG.carryCapacity >
      CONFIG.warehouseCapacityPerGood + 1e-9
    ) continue;

    for (const source of world.buildings) {
      if (source.id === target.id || source.id === tripTarget) continue;
      if (hexDistance(area.center, source.position) > area.radius) continue;
      if (
        buildingSourceStock(source, good) -
          reservedAtSource(world, source.id, good) +
          1e-9 <
        CONFIG.carryCapacity
      ) continue;
      const path = findPath(
        world.tiles,
        person.position,
        source.position,
        CONFIG.roadSpeedMultiplier,
      );
      if (!path) continue;
      candidates.push({
        sourceId: source.id,
        good,
        path,
        cost: pathTravelCost(world.tiles, path, CONFIG.roadSpeedMultiplier),
      });
    }

    for (const source of world.naturalResources) {
      if (resourceGood(source) !== good) continue;
      if (hexDistance(area.center, source.position) > area.radius) continue;
      if (
        source.output - reservedAtSource(world, source.id, good, "resource") + 1e-9 <
        CONFIG.carryCapacity
      ) continue;
      const path = findPath(
        world.tiles,
        person.position,
        source.position,
        CONFIG.roadSpeedMultiplier,
      );
      if (!path) continue;
      candidates.push({
        sourceId: source.id,
        sourceKind: "resource",
        good,
        path,
        cost: pathTravelCost(world.tiles, path, CONFIG.roadSpeedMultiplier),
      });
    }
  }

  candidates.sort(
    (a, b) => a.cost - b.cost || a.sourceId.localeCompare(b.sourceId),
  );
  const candidate = candidates[0];
  if (!candidate) return false;

  person.trip = {
    source: candidate.sourceId,
    ...(candidate.sourceKind ? { sourceKind: candidate.sourceKind } : {}),
    target: tripTarget,
    good: candidate.good,
    picked: false,
  };
  person.path = candidate.path;
  person.movement = 0;
  area.retryAfterTick = undefined;
  return true;
}

function tripSourcePosition(world: World, person: Person): Hex | undefined {
  const trip = person.trip;
  if (!trip) return undefined;
  if (trip.sourceKind === "resource")
    return world.naturalResources.find((source) => source.id === trip.source)?.position;
  return world.buildings.find((source) => source.id === trip.source)?.position;
}

function resetUnpickedTrip(world: World, person: Person): void {
  if (!person.trip || person.trip.picked) return;
  person.trip = undefined;
  person.path = [];
  person.movement = 0;
  const workplace = storageCarrierWorkplace(world, person);
  person.active = Boolean(workplace && same(person.position, workplace.position));
}

function enforceResourceWorker(world: World, person: Person): void {
  const area = person.workArea!;
  if (person.resourceTarget) {
    const target = world.naturalResources.find(
      (resource) => resource.id === person.resourceTarget,
    );
    if (
      !target ||
      target.depleted ||
      target.remaining <= 0 ||
      hexDistance(area.center, target.position) > area.radius
    ) {
      person.resourceTarget = undefined;
      person.path = [];
      person.movement = 0;
      person.active = false;
      person.progress = 0;
      area.retryAfterTick = undefined;
    }
  }
  if (
    person.resourceTarget ||
    person.hungerState ||
    person.sleepState ||
    person.trip ||
    person.progress > 0 ||
    (area.retryAfterTick !== undefined && world.round < area.retryAfterTick)
  ) return;
  if (!planLocalResource(world, person))
    area.retryAfterTick = world.round + CONFIG.decisionIntervalTicks;
}

function enforceStorageCarrier(world: World, person: Person): void {
  const area = person.workArea!;
  if (person.trip && !person.trip.picked) {
    const sourcePosition = tripSourcePosition(world, person);
    if (!sourcePosition || hexDistance(area.center, sourcePosition) > area.radius) {
      resetUnpickedTrip(world, person);
      area.retryAfterTick = undefined;
    }
  }
  if (
    person.trip ||
    person.path.length ||
    person.hungerState ||
    person.sleepState ||
    person.farmTask ||
    person.progress > 0 ||
    (area.retryAfterTick !== undefined && world.round < area.retryAfterTick)
  ) return;
  const workplace = storageCarrierWorkplace(world, person);
  if (!workplace || !same(person.position, workplace.position)) return;
  person.active = true;
  if (!planLocalStorageCarrier(world, person))
    area.retryAfterTick = world.round + CONFIG.decisionIntervalTicks;
}

export function syncWorkAreas(world: World): void {
  for (const person of world.people) {
    const resourceWorker = Boolean(person.woodcutter || person.extractor);
    const storageCarrier = Boolean(storageCarrierWorkplace(world, person));
    if (!resourceWorker && !storageCarrier) {
      clearWorkArea(person);
      continue;
    }
    ensureWorkArea(world, person);
    if (resourceWorker) enforceResourceWorker(world, person);
    else enforceStorageCarrier(world, person);
  }
}

export function setWorkAreaCenter(world: World, personId: number, center: Hex): boolean {
  const person = world.people.find((candidate) => candidate.id === personId);
  const eligible = Boolean(
    person &&
      (person.woodcutter || person.extractor || storageCarrierWorkplace(world, person)),
  );
  if (!person || !eligible) return false;
  if (!world.tiles.some((tile) => tile.q === center.q && tile.r === center.r)) return false;

  ensureWorkArea(world, person, center);
  person.workArea = {
    center: { q: center.q, r: center.r },
    radius: WORK_AREA_RADIUS,
  };

  if (person.resourceTarget) {
    const target = world.naturalResources.find(
      (resource) => resource.id === person.resourceTarget,
    );
    if (!target || !workAreaContains(person, target.position)) {
      person.resourceTarget = undefined;
      person.path = [];
      person.movement = 0;
      person.active = false;
      person.progress = 0;
    }
  }
  if (person.trip && !person.trip.picked) {
    const sourcePosition = tripSourcePosition(world, person);
    if (!sourcePosition || !workAreaContains(person, sourcePosition))
      resetUnpickedTrip(world, person);
  }
  person.workArea.retryAfterTick = undefined;
  syncWorkAreas(world);
  return true;
}
