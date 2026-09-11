import type { Building, BuildingId, Good, Hex, HungerState, Person, Tile, World } from "./model";
import { findPath, findPathBySteps, pathTravelCost, same } from "./hex";
import { CONFIG } from "./scenario";

const SIMULATION_HZ = 60;
const ROAD_SPEED_MULTIPLIER = 1.3;
const WANTS_TO_EAT_THRESHOLD = 40;
const CRITICAL_HUNGER_THRESHOLD = 20;
const HUNGER_MAX = 100;
const ACCUMULATOR_EPSILON = 1e-9;
const HQ_STORAGE_PROXY_ID = "hq-storage-proxy";
const ALL_GOODS: Good[] = ["wood", "plank", "woodenTool", "wheat", "flour", "water", "bread"];

type BreadCandidate = {
  kind: "bread";
  warehouse: Building;
  path: Hex[];
  cost: number;
};

type BushCandidate = {
  kind: "bush";
  tile: Tile;
  path: Hex[];
  cost: number;
};

type FoodCandidate = BreadCandidate | BushCandidate;

type CollectionCandidate = {
  source: Building;
  good: Good;
  path: Hex[];
  cost: number;
};

const isStorage = (building: Building): boolean =>
  (building.kind === "warehouse" || building.kind === "hq") &&
  !building.retired &&
  (!building.construction || building.construction.complete);

const breadStock = (building: Building): number =>
  isStorage(building) ? (building.inventory?.bread ?? 0) : 0;

const reservedBread = (world: World, warehouseId: BuildingId, exceptPersonId?: number): number =>
  world.people.filter(
    (person) =>
      person.id !== exceptPersonId && person.hungerState?.foodSource === warehouseId,
  ).length;

const reservedBush = (world: World, tile: Hex, exceptPersonId?: number): boolean =>
  world.people.some(
    (person) =>
      person.id !== exceptPersonId &&
      person.hungerState?.foodBush &&
      same(person.hungerState.foodBush, tile),
  );

const hungerValue = (person: Person): number => {
  person.hunger ??= HUNGER_MAX;
  person.hungerAccumulator ??= 0;
  return person.hunger;
};

const secondsPerHungerPoint = (person: Person): number => {
  if (person.trip?.picked) return 1;
  if (person.hungerState) return person.path.length > 0 ? 2 : 4;
  if (person.progress > 0 || (person.farmTask && person.path.length === 0)) return 1;
  if (person.path.length > 0) return 2;
  return 4;
};

const decayHunger = (person: Person): void => {
  hungerValue(person);
  person.hungerAccumulator! += 1 / (secondsPerHungerPoint(person) * SIMULATION_HZ);
  while (person.hungerAccumulator! + ACCUMULATOR_EPSILON >= 1 && person.hunger! > 0) {
    person.hungerAccumulator = Math.max(0, person.hungerAccumulator! - 1);
    person.hunger!--;
  }
};

const routeTo = (world: World, person: Person, target: Hex): Hex[] | undefined =>
  findPath(world.tiles, person.position, target, ROAD_SPEED_MULTIPLIER) ?? undefined;

const foodCandidates = (world: World, person: Person): FoodCandidate[] => {
  const bread: BreadCandidate[] = world.buildings
    .filter(
      (warehouse) =>
        isStorage(warehouse) &&
        breadStock(warehouse) - reservedBread(world, warehouse.id, person.id) >= 1,
    )
    .map((warehouse) => {
      const path = routeTo(world, person, warehouse.position);
      if (!path) return undefined;
      return {
        kind: "bread" as const,
        warehouse,
        path,
        cost: pathTravelCost(world.tiles, path, ROAD_SPEED_MULTIPLIER),
      };
    })
    .filter((candidate): candidate is BreadCandidate => Boolean(candidate));

  const bushes: BushCandidate[] = world.tiles
    .filter(
      (tile) =>
        tile.terrain === "grass" &&
        tile.bush &&
        tile.bushAvailable &&
        !reservedBush(world, tile, person.id),
    )
    .map((tile) => {
      const path = routeTo(world, person, tile);
      if (!path) return undefined;
      return {
        kind: "bush" as const,
        tile,
        path,
        cost: pathTravelCost(world.tiles, path, ROAD_SPEED_MULTIPLIER),
      };
    })
    .filter((candidate): candidate is BushCandidate => Boolean(candidate));

  return [...bread, ...bushes].sort((a, b) => {
    if (Math.abs(a.cost - b.cost) > 1e-9) return a.cost - b.cost;
    if (a.kind !== b.kind) return a.kind === "bread" ? -1 : 1;
    if (a.kind === "bread" && b.kind === "bread")
      return a.warehouse.id.localeCompare(b.warehouse.id);
    if (a.kind === "bush" && b.kind === "bush")
      return a.tile.r - b.tile.r || a.tile.q - b.tile.q;
    return 0;
  });
};

const currentTaskTarget = (world: World, person: Person): Hex | undefined => {
  if (person.farmTask) return person.farmTask.target;
  if (person.trip) {
    const buildingId = person.trip.picked ? person.trip.target : person.trip.source;
    return world.buildings.find((building) => building.id === buildingId)?.position;
  }
  if (person.assignment)
    return world.buildings.find((building) => building.id === person.assignment!.building)
      ?.position;
  return world.buildings.find((building) => building.id === "hq")?.position;
};

const resumeTask = (world: World, person: Person, hungerState: HungerState): void => {
  person.active = false;
  person.movement = 0;
  const target = currentTaskTarget(world, person);
  if (!target) {
    person.path = [];
    return;
  }
  if (same(person.position, target)) {
    person.path = [];
    person.active = hungerState.resumeActive || Boolean(person.assignment);
    return;
  }
  person.path = routeTo(world, person, target) ?? [];
};

const finishEating = (world: World, person: Person): void => {
  const completedState = person.hungerState!;
  person.hungerState = undefined;
  person.hungerAccumulator = 0;
  resumeTask(world, person, completedState);
};

const consumeBread = (world: World, person: Person, warehouse: Building): void => {
  warehouse.inventory ??= {};
  warehouse.inventory.bread = (warehouse.inventory.bread ?? 0) - 1;
  person.hunger = HUNGER_MAX;
  finishEating(world, person);
};

const nextRandom = (world: World): number => {
  world.rngState = (Math.imul(world.rngState, 1664525) + 1013904223) >>> 0;
  return world.rngState;
};

const consumeBush = (world: World, person: Person, tile: Tile): void => {
  tile.bushAvailable = false;
  const span = CONFIG.bushRegrowMaxTicks - CONFIG.bushRegrowMinTicks;
  tile.bushRegrowTick =
    world.round + CONFIG.bushRegrowMinTicks + (nextRandom(world) % (span + 1));
  person.hunger = Math.min(HUNGER_MAX, (person.hunger ?? HUNGER_MAX) + CONFIG.bushFoodValue);
  finishEating(world, person);
};

const useCandidate = (world: World, person: Person, candidate: FoodCandidate): void => {
  if (candidate.kind === "bread") {
    if (same(person.position, candidate.warehouse.position)) {
      person.path = [];
      consumeBread(world, person, candidate.warehouse);
    } else {
      person.path = candidate.path;
    }
    return;
  }
  if (same(person.position, candidate.tile)) {
    person.path = [];
    consumeBush(world, person, candidate.tile);
  } else {
    person.path = candidate.path;
  }
};

const startEating = (world: World, person: Person, critical: boolean): boolean => {
  const candidate = foodCandidates(world, person)[0];
  if (!candidate && !critical) return false;

  person.hungerState = {
    foodSource: candidate?.kind === "bread" ? candidate.warehouse.id : undefined,
    foodBush: candidate?.kind === "bush" ? { q: candidate.tile.q, r: candidate.tile.r } : undefined,
    resumeActive: person.active,
  };
  person.active = false;
  person.movement = 0;

  if (candidate) {
    useCandidate(world, person, candidate);
    return true;
  }

  person.path = [{ ...person.position }];
  return true;
};

const atTaskBoundary = (person: Person): boolean =>
  person.progress === 0 &&
  !person.farmTask &&
  !person.trip &&
  person.path.length === 0;

const selectedFoodCandidate = (world: World, person: Person): FoodCandidate | undefined => {
  const state = person.hungerState!;
  if (state.foodSource) {
    const warehouse = world.buildings.find((building) => building.id === state.foodSource);
    if (
      warehouse &&
      isStorage(warehouse) &&
      breadStock(warehouse) - reservedBread(world, warehouse.id, person.id) >= 1
    ) {
      const path = routeTo(world, person, warehouse.position);
      if (path)
        return {
          kind: "bread",
          warehouse,
          path,
          cost: pathTravelCost(world.tiles, path, ROAD_SPEED_MULTIPLIER),
        };
    }
  }
  if (state.foodBush) {
    const tile = world.tiles.find((candidate) => same(candidate, state.foodBush!));
    if (
      tile?.terrain === "grass" &&
      tile.bush &&
      tile.bushAvailable &&
      !reservedBush(world, tile, person.id)
    ) {
      const path = routeTo(world, person, tile);
      if (path)
        return {
          kind: "bush",
          tile,
          path,
          cost: pathTravelCost(world.tiles, path, ROAD_SPEED_MULTIPLIER),
        };
    }
  }
  return undefined;
};

const ensureFoodRoute = (world: World, person: Person): void => {
  const state = person.hungerState!;
  let candidate = selectedFoodCandidate(world, person);
  if (!candidate) {
    candidate = foodCandidates(world, person)[0];
    state.foodSource = candidate?.kind === "bread" ? candidate.warehouse.id : undefined;
    state.foodBush = candidate?.kind === "bush" ? { q: candidate.tile.q, r: candidate.tile.r } : undefined;
    person.movement = 0;
  }

  if (!candidate) {
    person.active = false;
    person.movement = 0;
    person.path = [{ ...person.position }];
    return;
  }

  useCandidate(world, person, candidate);
  if (person.hungerState) person.active = false;
};

const cleanupAndRegrowBushes = (world: World): void => {
  for (const tile of world.tiles) {
    if (!tile.bush) continue;
    if (tile.terrain !== "grass") {
      tile.bush = undefined;
      tile.bushAvailable = undefined;
      tile.bushRegrowTick = undefined;
      continue;
    }
    if (!tile.bushAvailable && tile.bushRegrowTick !== undefined && world.round >= tile.bushRegrowTick) {
      tile.bushAvailable = true;
      tile.bushRegrowTick = undefined;
    }
  }
};

const sourceStock = (building: Building, good: Good): number => {
  if (building.construction && !building.construction.complete) return 0;
  if (building.kind === "well" && good === "water") return Number.MAX_SAFE_INTEGER;
  if (building.kind === "farm" && good === "wheat") return building.output;
  return building.recipe?.output === good ? building.output : 0;
};

const reservedAtSource = (world: World, id: BuildingId, good: Good): number =>
  world.people.filter(
    (person) => person.trip?.source === id && person.trip.good === good && !person.trip.picked,
  ).length;

const incomingToHq = (world: World, good: Good): number =>
  world.people.filter(
    (person) => person.trip?.target === HQ_STORAGE_PROXY_ID && person.trip.good === good,
  ).length;

const ensureHqStorageProxy = (world: World, hq: Building): Building => {
  let proxy = world.buildings.find((building) => building.id === HQ_STORAGE_PROXY_ID);
  if (!proxy) {
    proxy = {
      id: HQ_STORAGE_PROXY_ID,
      kind: "warehouse",
      name: "HQ storage adapter",
      position: { ...hq.position },
      workers: 0,
      carriers: 0,
      merchants: 0,
      input: 0,
      output: 0,
      inventory: hq.inventory,
      retired: true,
    };
    world.buildings.push(proxy);
  }
  proxy.position = { ...hq.position };
  proxy.inventory = hq.inventory;
  return proxy;
};

const planHqCarrier = (world: World, person: Person, hq: Building): void => {
  if (person.hungerState || person.trip || person.path.length > 0 || !same(person.position, hq.position)) return;
  const inventory = hq.inventory ?? {};
  const candidates: CollectionCandidate[] = [];
  for (const good of ALL_GOODS) {
    if ((inventory[good] ?? 0) + incomingToHq(world, good) >= CONFIG.warehouseCapacityPerGood) continue;
    for (const source of world.buildings) {
      if (
        source.id === hq.id ||
        source.id === HQ_STORAGE_PROXY_ID ||
        source.kind === "warehouse" ||
        source.kind === "hq" ||
        (source.retired && sourceStock(source, good) < CONFIG.carryCapacity) ||
        sourceStock(source, good) - reservedAtSource(world, source.id, good) < CONFIG.carryCapacity
      )
        continue;
      const rangePath = findPathBySteps(world.tiles, hq.position, source.position);
      if (!rangePath || rangePath.length > CONFIG.warehouseCollectionRadius) continue;
      const path = routeTo(world, person, source.position);
      if (!path) continue;
      candidates.push({
        source,
        good,
        path,
        cost: pathTravelCost(world.tiles, path, ROAD_SPEED_MULTIPLIER),
      });
    }
  }
  candidates.sort((a, b) => a.cost - b.cost || a.source.id.localeCompare(b.source.id));
  const candidate = candidates[0];
  if (!candidate) return;
  const proxy = ensureHqStorageProxy(world, hq);
  person.trip = {
    source: candidate.source.id,
    target: proxy.id,
    good: candidate.good,
    picked: false,
  };
  person.path = candidate.path;
  person.movement = 0;
};

const advanceHqWarehouseCarrier = (world: World): void => {
  const hq = world.buildings.find((building) => building.id === "hq");
  if (!hq) return;
  hq.inventory ??= {};

  if (world.round % CONFIG.decisionIntervalTicks !== 0) return;
  for (const person of world.people.filter(
    (candidate) =>
      candidate.assignment?.building === hq.id && candidate.assignment.role === "carrier",
  ))
    planHqCarrier(world, person, hq);
};

export function advanceHungerTick(world: World): void {
  cleanupAndRegrowBushes(world);

  for (const person of world.people) {
    decayHunger(person);

    if (person.hungerState) {
      ensureFoodRoute(world, person);
      continue;
    }

    if (person.hunger! <= CRITICAL_HUNGER_THRESHOLD) {
      startEating(world, person, true);
      continue;
    }

    if (person.hunger! <= WANTS_TO_EAT_THRESHOLD && atTaskBoundary(person))
      startEating(world, person, false);
  }

  advanceHqWarehouseCarrier(world);
}

export function attachNeeds(world: World): World {
  return new Proxy(world, {
    set(target, property, value, receiver) {
      if (
        property === "round" &&
        typeof value === "number" &&
        value === target.round + 1
      )
        advanceHungerTick(receiver as World);
      return Reflect.set(target, property, value, receiver);
    },
  });
}

export const hungerStatus = (person: Person): "normal" | "hungry" | "critical" => {
  const hunger = person.hunger ?? HUNGER_MAX;
  if (hunger <= CRITICAL_HUNGER_THRESHOLD) return "critical";
  if (hunger <= WANTS_TO_EAT_THRESHOLD) return "hungry";
  return "normal";
};
