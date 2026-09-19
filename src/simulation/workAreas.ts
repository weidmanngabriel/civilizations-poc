import type { Building, Good, Hex, NaturalResource, NaturalResourceKind, Person, World } from "./model";
import { findPath, key, neighbors, pathTravelCost, same, tileIndex } from "./hex";
import { CONFIG } from "./scenario";
import { clearNavigationBlocked, findRequiredNavigationPath } from "./wayposts";
import {
  findLocalNavigationPath,
  findPathIntoLocalNavigationNode,
  type LocalNavigationNode,
} from "./localNavigation";
import { GRID_REFINEMENT, hexDistance } from "./spatial";
import { awardProfessionExperience, professionExperience } from "./experience";
import { startEatingAfterCompletedAction } from "./needs";
import {
  availableLooseGoodAmount,
  findLooseGoodDropPosition,
  looseGoodStack,
  looseGoodStacks,
  placeLooseGood,
  releaseLooseGoodReservation,
  reserveLooseGood,
} from "./looseGoods";

export const WORK_AREA_RADIUS_WORLD_TILES = 2.5;
export const WORK_AREA_RADIUS = WORK_AREA_RADIUS_WORLD_TILES * GRID_REFINEMENT;

const ALL_GOODS: Good[] = ["wood", "plank", "woodenTool", "wheat", "flour", "water", "bread", "fish", "clay", "rubble", "brick", "stoneBlock"];
const FISHING_WAIT_TICKS = 5 * CONFIG.simulationHz;
const isComplete = (building: Building): boolean => !building.construction || building.construction.complete;

const storageCarrierWorkplace = (world: World, person: Person): Building | undefined => {
  if (person.assignment?.role !== "carrier") return undefined;
  return world.buildings.find((building) =>
    building.id === person.assignment!.building && !building.retired && isComplete(building) &&
    (building.kind === "warehouse" || building.kind === "hq"));
};

export const supportsWorkArea = (person: Person): boolean => Boolean(person.woodcutter || person.fisher || person.extractor || person.workArea);
export const workAreaContains = (person: Person, position: Hex): boolean =>
  Boolean(person.workArea && hexDistance(person.workArea.center, position) <= person.workArea.radius);

const workAreaNavigationNode = (person: Person): LocalNavigationNode | undefined => {
  const area = person.workArea;
  if (!area) return undefined;
  return {
    entry: area.center,
    contains: (position) => hexDistance(area.center, position) <= area.radius,
  };
};

function defaultWorkAreaCenter(world: World, person: Person): Hex {
  if (person.fishingSpot) return person.fishingSpot;
  if (person.resourceTarget) {
    const resource = world.naturalResources.find((candidate) => candidate.id === person.resourceTarget);
    if (resource) return resource.position;
  }
  return storageCarrierWorkplace(world, person)?.position ?? person.position;
}

export function ensureWorkArea(world: World, person: Person, preferredCenter?: Hex): void {
  if (person.workArea) return;
  const center = preferredCenter ?? defaultWorkAreaCenter(world, person);
  person.workArea = { center: { q: center.q, r: center.r }, radius: WORK_AREA_RADIUS };
}

export function clearWorkArea(person: Person): void { person.workArea = undefined; }


export function fishingCatchChance(person: Person): number {
  return 0.3 + 0.5 * professionExperience(person, "fisher") / 100;
}

const nextRandomFraction = (world: World): number => {
  world.rngState = (Math.imul(world.rngState, 1664525) + 1013904223) >>> 0;
  return world.rngState / 0x100000000;
};

const isFishingSpot = (
  tiles: ReturnType<typeof tileIndex>,
  position: Hex,
): boolean => {
  const tile = tiles.get(key(position));
  if (!tile || tile.resourceBlocking || tile.buildingBlocking) return false;
  if (tile.terrain === "river" || tile.terrain === "mountain" || tile.terrain === "building") return false;
  return neighbors(position).some((neighbor) => tiles.get(key(neighbor))?.terrain === "river");
};

type FishingCandidate = { position: Hex; path: Hex[] };

function fishingCandidate(
  world: World,
  person: Person,
  center?: Hex,
  radius?: number,
  excluded?: Hex,
): FishingCandidate | undefined {
  const tiles = tileIndex(world.tiles);
  const positions = world.tiles
    .filter((tile) => isFishingSpot(tiles, tile))
    .filter((tile) => !center || radius === undefined || hexDistance(center, tile) <= radius)
    .filter((tile) => !excluded || !same(tile, excluded))
    .sort(
      (a, b) =>
        hexDistance(person.position, a) - hexDistance(person.position, b) ||
        a.q - b.q ||
        a.r - b.r,
    );

  for (const position of positions) {
    const node = center && radius !== undefined
      ? {
          entry: center,
          contains: (candidate: Hex) => hexDistance(center, candidate) <= radius,
        }
      : undefined;
    const path = node
      ? findLocalNavigationPath(world, person, node, position, CONFIG.roadSpeedMultiplier)
      : findRequiredNavigationPath(world, person, position, CONFIG.roadSpeedMultiplier);
    if (path) return { position: { q: position.q, r: position.r }, path };
  }
  return undefined;
}

function useFishingCandidate(person: Person, candidate: FishingCandidate): void {
  person.idleTarget = undefined;
  person.fishingSpot = { ...candidate.position };
  person.fishingWaterTarget = undefined;
  person.fishingStartedAtTick = undefined;
  person.fishingWaitUntilTick = undefined;
  person.path = candidate.path;
  person.movement = 0;
  person.active = same(person.position, candidate.position);
}

export function initializeFisher(world: World, person: Person): boolean {
  const candidate = fishingCandidate(world, person);
  ensureWorkArea(world, person, candidate?.position ?? person.position);
  if (!candidate) {
    person.fishingSpot = undefined;
    person.fishingWaterTarget = undefined;
    person.fishingStartedAtTick = undefined;
    person.fishingWaitUntilTick = undefined;
    person.path = [];
    person.active = false;
    person.workArea!.retryAfterTick = world.round + CONFIG.decisionIntervalTicks;
    return false;
  }
  useFishingCandidate(person, candidate);
  return true;
}

function planLocalFishingSpot(world: World, person: Person): boolean {
  const area = person.workArea;
  if (!area) return false;
  const alternative = fishingCandidate(
    world,
    person,
    area.center,
    area.radius,
    person.fishingSpot,
  );
  const candidate =
    alternative ?? fishingCandidate(world, person, area.center, area.radius);
  if (!candidate) return false;
  useFishingCandidate(person, candidate);
  area.retryAfterTick = undefined;
  return true;
}

function waterTargetForFishingSpot(world: World, position: Hex): Hex | undefined {
  const tiles = tileIndex(world.tiles);
  return neighbors(position)
    .filter((neighbor) => tiles.get(key(neighbor))?.terrain === "river")
    .sort((a, b) => a.q - b.q || a.r - b.r)[0];
}

function startFishingCycle(world: World, person: Person): void {
  const waterTarget = person.fishingSpot
    ? waterTargetForFishingSpot(world, person.fishingSpot)
    : undefined;
  if (!waterTarget) {
    person.fishingSpot = undefined;
    person.active = false;
    return;
  }
  person.fishingWaterTarget = { ...waterTarget };
  person.fishingStartedAtTick = world.round;
  person.fishingWaitUntilTick = world.round + FISHING_WAIT_TICKS;
  person.active = true;
}

function routeOutdoorCarryToFlag(world: World, person: Person): boolean {
  const area = person.workArea;
  const good = person.outdoorCarry;
  if (!area || !good) return true;
  if (person.hungerState || person.sleepState) return false;

  if (person.path.length) {
    person.active = false;
    return false;
  }

  if (!same(person.position, area.center)) {
    const node = workAreaNavigationNode(person)!;
    const path = findLocalNavigationPath(world, person, node, area.center, CONFIG.roadSpeedMultiplier);
    if (!path) {
      person.active = false;
      area.retryAfterTick = world.round + CONFIG.decisionIntervalTicks;
      return false;
    }
    person.path = path;
    person.movement = 0;
    person.active = false;
    return false;
  }

  const drop = findLooseGoodDropPosition(world, area.center, good, GRID_REFINEMENT);
  if (!drop || !placeLooseGood(world, drop, good, 1)) {
    person.active = false;
    area.retryAfterTick = world.round + CONFIG.decisionIntervalTicks;
    return false;
  }

  person.outdoorCarry = undefined;
  person.path = [];
  person.movement = 0;
  person.active = false;
  area.retryAfterTick = undefined;
  return true;
}

function finishFishingCycle(world: World, person: Person): void {
  const caught = nextRandomFraction(world) < fishingCatchChance(person);
  if (caught) awardProfessionExperience(person, "fisher");
  person.fishingWaterTarget = undefined;
  person.fishingStartedAtTick = undefined;
  person.fishingWaitUntilTick = undefined;
  person.active = false;
  if (caught) person.outdoorCarry = "fish";
}

function enforceFisher(world: World, person: Person): void {
  const area = person.workArea!;
  if (person.hungerState || person.sleepState) return;

  if (person.outdoorCarry) {
    if (!routeOutdoorCarryToFlag(world, person)) return;
    if (!planLocalFishingSpot(world, person))
      area.retryAfterTick = world.round + CONFIG.decisionIntervalTicks;
    return;
  }

  if (person.path.length) {
    person.active = false;
    return;
  }

  if (person.fishingWaitUntilTick !== undefined) {
    if (world.round < person.fishingWaitUntilTick) {
      person.active = true;
      return;
    }
    finishFishingCycle(world, person);
    if (startEatingAfterCompletedAction(world, person)) return;
    if (person.hungerState) return;
    if (person.outdoorCarry) {
      routeOutdoorCarryToFlag(world, person);
      return;
    }
    if (!planLocalFishingSpot(world, person))
      area.retryAfterTick = world.round + CONFIG.decisionIntervalTicks;
    return;
  }

  if (person.fishingSpot && same(person.position, person.fishingSpot)) {
    startFishingCycle(world, person);
    return;
  }

  if (area.retryAfterTick !== undefined && world.round < area.retryAfterTick) return;
  if (!planLocalFishingSpot(world, person))
    area.retryAfterTick = world.round + CONFIG.decisionIntervalTicks;
}

function resourceKindFor(person: Person): NaturalResourceKind | undefined {
  if (person.woodcutter) return "forest";
  return person.extractor;
}

function claimedByOther(world: World, person: Person, resource: NaturalResource): boolean {
  return world.people.some((candidate) => candidate.id !== person.id && candidate.resourceTarget === resource.id);
}

type ResourceCandidate = { resource: NaturalResource; path: Hex[]; cost: number };

function initializeResourceWorker(world: World, person: Person): boolean {
  if (person.workArea) return true;
  const kind = resourceKindFor(person);
  if (!kind) return false;

  if (person.resourceTarget) {
    const selected = world.naturalResources.find((resource) =>
      resource.id === person.resourceTarget &&
      resource.kind === kind &&
      !resource.depleted &&
      resource.remaining > 0 &&
      !claimedByOther(world, person, resource),
    );
    if (selected) {
      ensureWorkArea(world, person, selected.position);
      return true;
    }
    person.resourceTarget = undefined;
  }

  const candidates: ResourceCandidate[] = [];
  for (const resource of world.naturalResources) {
    if (resource.kind !== kind || resource.depleted || resource.remaining <= 0 || claimedByOther(world, person, resource)) continue;
    const path = findRequiredNavigationPath(world, person, resource.position, CONFIG.roadSpeedMultiplier);
    if (!path) continue;
    candidates.push({
      resource,
      path,
      cost: pathTravelCost(world.tiles, path, CONFIG.roadSpeedMultiplier),
    });
  }
  candidates.sort((a, b) => a.cost - b.cost || a.resource.position.q - b.resource.position.q ||
    a.resource.position.r - b.resource.position.r || a.resource.id.localeCompare(b.resource.id));
  const candidate = candidates[0];
  if (!candidate) return false;

  person.resourceTarget = candidate.resource.id;
  person.assignment = undefined;
  person.path = candidate.path;
  person.movement = 0;
  person.active = same(person.position, candidate.resource.position);
  ensureWorkArea(world, person, candidate.resource.position);
  return true;
}

function planLocalResource(world: World, person: Person): boolean {
  const area = person.workArea;
  const kind = resourceKindFor(person);
  if (!area || !kind) return false;
  const candidates: ResourceCandidate[] = [];
  for (const resource of world.naturalResources) {
    if (resource.kind !== kind || resource.depleted || resource.remaining <= 0 ||
      hexDistance(area.center, resource.position) > area.radius || claimedByOther(world, person, resource)) continue;
    const node = workAreaNavigationNode(person)!;
    const path = findLocalNavigationPath(world, person, node, resource.position, CONFIG.roadSpeedMultiplier);
    if (!path) continue;
    candidates.push({ resource, path, cost: pathTravelCost(world.tiles, path, CONFIG.roadSpeedMultiplier) });
  }
  candidates.sort((a, b) => a.cost - b.cost || a.resource.position.q - b.resource.position.q ||
    a.resource.position.r - b.resource.position.r || a.resource.id.localeCompare(b.resource.id));
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
  world.people.filter((person) => person.trip?.target === target && person.trip.good === good).length;

const reservedAtBuildingSource = (world: World, sourceId: string, good: Good): number =>
  world.people.filter((person) => person.trip?.source === sourceId && person.trip.good === good &&
    !person.trip.sourceKind && !person.trip.picked).length;

const buildingSourceStock = (building: Building, good: Good): number => {
  if (!isComplete(building) || building.retired) return 0;
  if (building.kind === "warehouse" || building.kind === "hq") return 0;
  if (building.kind === "well" && good === "water") return Number.MAX_SAFE_INTEGER;
  if (building.kind === "farm" && good === "wheat") return building.output;
  return building.recipe?.output === good ? building.output : 0;
};

type CarrierCandidate = { sourceId: string; sourceKind: "building" | "looseGood"; sourcePosition: Hex; good: Good; path: Hex[]; cost: number };

function planLocalStorageCarrier(world: World, person: Person): boolean {
  const target = storageCarrierWorkplace(world, person);
  const area = person.workArea;
  if (!target || !area) return false;
  const candidates: CarrierCandidate[] = [];
  for (const good of ALL_GOODS) {
    if ((target.inventory?.[good] ?? 0) + incomingTo(world, target.id, good) + CONFIG.carryCapacity > CONFIG.warehouseCapacityPerGood + 1e-9) continue;
    for (const source of world.buildings) {
      if (source.id === target.id || hexDistance(area.center, source.position) > area.radius) continue;
      if (buildingSourceStock(source, good) - reservedAtBuildingSource(world, source.id, good) + 1e-9 < CONFIG.carryCapacity) continue;
      const node = workAreaNavigationNode(person)!;
      const path = findLocalNavigationPath(world, person, node, source.position, CONFIG.roadSpeedMultiplier);
      if (!path) continue;
      candidates.push({ sourceId: source.id, sourceKind: "building", sourcePosition: { ...source.position }, good, path,
        cost: pathTravelCost(world.tiles, path, CONFIG.roadSpeedMultiplier) });
    }
    for (const source of looseGoodStacks(world)) {
      if (source.good !== good || hexDistance(area.center, source.position) > area.radius ||
        availableLooseGoodAmount(source) + 1e-9 < CONFIG.carryCapacity) continue;
      const node = workAreaNavigationNode(person)!;
      const path = findLocalNavigationPath(world, person, node, source.position, CONFIG.roadSpeedMultiplier);
      if (!path) continue;
      candidates.push({ sourceId: source.id, sourceKind: "looseGood", sourcePosition: { ...source.position }, good, path,
        cost: pathTravelCost(world.tiles, path, CONFIG.roadSpeedMultiplier) });
    }
  }
  candidates.sort((a, b) => a.cost - b.cost || a.sourceId.localeCompare(b.sourceId));
  const candidate = candidates[0];
  if (!candidate) return false;
  if (candidate.sourceKind === "looseGood" && !reserveLooseGood(world, candidate.sourceId, CONFIG.carryCapacity)) return false;
  person.trip = {
    source: candidate.sourceId,
    ...(candidate.sourceKind === "looseGood" ? { sourceKind: "looseGood" as const } : {}),
    sourcePosition: { ...candidate.sourcePosition },
    target: target.id,
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
  if (trip.sourceKind === "looseGood") return looseGoodStack(world, trip.source)?.position ?? trip.sourcePosition;
  if (trip.sourceKind === "resource") return world.naturalResources.find((source) => source.id === trip.source)?.position;
  return world.buildings.find((source) => source.id === trip.source)?.position;
}

function resetUnpickedTrip(world: World, person: Person): void {
  if (!person.trip || person.trip.picked) return;
  if (person.trip.sourceKind === "looseGood") releaseLooseGoodReservation(world, person.trip.source, CONFIG.carryCapacity);
  person.trip = undefined;
  person.path = [];
  person.movement = 0;
  clearNavigationBlocked(person);
  const workplace = storageCarrierWorkplace(world, person);
  person.active = Boolean(workplace && same(person.position, workplace.position));
}

function enforceResourceWorker(world: World, person: Person): void {
  const area = person.workArea!;

  if (person.outdoorCarry) {
    if (!routeOutdoorCarryToFlag(world, person)) return;
  }

  if (person.resourceTarget) {
    const target = world.naturalResources.find((resource) => resource.id === person.resourceTarget);
    if (!target || target.depleted || target.remaining <= 0 || hexDistance(area.center, target.position) > area.radius) {
      person.resourceTarget = undefined;
      person.path = [];
      person.movement = 0;
      clearNavigationBlocked(person);
      person.active = false;
      person.progress = 0;
      area.retryAfterTick = undefined;
    } else if (!person.path.length && !same(person.position, target.position)) {
      const path = findPath(world.tiles, person.position, target.position, CONFIG.roadSpeedMultiplier);
      if (path) {
        person.path = path;
        person.movement = 0;
        person.active = false;
      }
    }
  }

  if (person.resourceTarget || person.outdoorCarry || person.hungerState || person.sleepState || person.trip || person.progress > 0 ||
    (area.retryAfterTick !== undefined && world.round < area.retryAfterTick)) return;
  if (!planLocalResource(world, person)) area.retryAfterTick = world.round + CONFIG.decisionIntervalTicks;
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
  if (person.trip || person.path.length || person.hungerState || person.sleepState || person.farmTask || person.progress > 0 ||
    (area.retryAfterTick !== undefined && world.round < area.retryAfterTick)) return;
  const workplace = storageCarrierWorkplace(world, person);
  if (!workplace) return;
  person.active = true;
  if (!planLocalStorageCarrier(world, person)) area.retryAfterTick = world.round + CONFIG.decisionIntervalTicks;
}

export function syncWorkAreas(world: World): void {
  for (const person of world.people) {
    const resourceWorker = Boolean(person.woodcutter || person.extractor);
    const fisher = Boolean(person.fisher);
    const storageCarrier = Boolean(storageCarrierWorkplace(world, person));
    if (!resourceWorker && !fisher && !storageCarrier) { clearWorkArea(person); continue; }
    if (resourceWorker && !person.workArea && !initializeResourceWorker(world, person)) continue;
    ensureWorkArea(world, person);

    const node = workAreaNavigationNode(person)!;
    const outsideLocalNode = !node.contains(person.position);
    const externalPriority = Boolean(
      person.hungerState ||
      person.sleepState ||
      person.manualMoveTarget ||
      (storageCarrier && person.trip?.picked),
    );
    if (outsideLocalNode && !externalPriority) {
      if (!person.path.length) {
        person.path =
          findPathIntoLocalNavigationNode(
            world,
            person,
            node,
            CONFIG.roadSpeedMultiplier,
          ) ?? [];
        person.movement = 0;
      }
      person.active = false;
      continue;
    }

    if (resourceWorker) enforceResourceWorker(world, person);
    else if (fisher) enforceFisher(world, person);
    else enforceStorageCarrier(world, person);
  }
}

export function setWorkAreaCenter(world: World, personId: number, center: Hex): boolean {
  const person = world.people.find((candidate) => candidate.id === personId);
  const eligible = Boolean(person && (person.woodcutter || person.fisher || person.extractor || storageCarrierWorkplace(world, person)));
  if (!person || !eligible) return false;
  if (!world.tiles.some((tile) => tile.q === center.q && tile.r === center.r)) return false;
  ensureWorkArea(world, person, center);
  person.workArea = { center: { q: center.q, r: center.r }, radius: WORK_AREA_RADIUS };
  if (person.resourceTarget) {
    const target = world.naturalResources.find((resource) => resource.id === person.resourceTarget);
    if (!target || !workAreaContains(person, target.position)) {
      person.resourceTarget = undefined;
      person.path = [];
      person.movement = 0;
      person.active = false;
      person.progress = 0;
    }
  }
  if (person.fishingSpot && !workAreaContains(person, person.fishingSpot)) {
    person.fishingSpot = undefined;
    person.fishingWaterTarget = undefined;
    person.fishingStartedAtTick = undefined;
    person.fishingWaitUntilTick = undefined;
    person.path = [];
    person.movement = 0;
    person.active = false;
  }
  if (person.trip && !person.trip.picked) {
    const sourcePosition = tripSourcePosition(world, person);
    if (!sourcePosition || !workAreaContains(person, sourcePosition)) resetUnpickedTrip(world, person);
  }
  if (
    !workAreaContains(person, person.position) &&
    !person.hungerState &&
    !person.sleepState &&
    !person.manualMoveTarget &&
    !person.trip?.picked
  ) {
    person.path = [];
    person.movement = 0;
    person.active = false;
  }
  person.workArea.retryAfterTick = undefined;
  syncWorkAreas(world);
  return true;
}
