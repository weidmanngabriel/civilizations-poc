import type { Building, BuildingId, Hex, HungerState, Person, World } from "./model";
import { findPath, pathTravelCost, same } from "./hex";

const SIMULATION_HZ = 60;
const ROAD_SPEED_MULTIPLIER = 1.3;
const WANTS_TO_EAT_THRESHOLD = 40;
const CRITICAL_HUNGER_THRESHOLD = 20;
const HUNGER_MAX = 100;
const ACCUMULATOR_EPSILON = 1e-9;

type FoodCandidate = {
  warehouse: Building;
  path: Hex[];
  cost: number;
};

const isFinishedWarehouse = (building: Building): boolean =>
  building.kind === "warehouse" &&
  !building.retired &&
  (!building.construction || building.construction.complete);

const breadStock = (building: Building): number =>
  isFinishedWarehouse(building) ? (building.inventory?.bread ?? 0) : 0;

const reservedBread = (world: World, warehouseId: BuildingId, exceptPersonId?: number): number =>
  world.people.filter(
    (person) =>
      person.id !== exceptPersonId && person.hungerState?.foodSource === warehouseId,
  ).length;

const hungerValue = (person: Person): number => {
  person.hunger ??= HUNGER_MAX;
  person.hungerAccumulator ??= 0;
  return person.hunger;
};

const secondsPerHungerPoint = (person: Person): number => {
  if (person.trip?.picked) return 1;
  if (person.hungerState) return person.hungerState.foodSource && person.path.length > 0 ? 2 : 4;
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

const foodCandidates = (world: World, person: Person): FoodCandidate[] =>
  world.buildings
    .filter(
      (warehouse) =>
        isFinishedWarehouse(warehouse) &&
        breadStock(warehouse) - reservedBread(world, warehouse.id, person.id) >= 1,
    )
    .map((warehouse) => {
      const path = findPath(
        world.tiles,
        person.position,
        warehouse.position,
        ROAD_SPEED_MULTIPLIER,
      );
      if (!path) return undefined;
      return {
        warehouse,
        path,
        cost: pathTravelCost(world.tiles, path, ROAD_SPEED_MULTIPLIER),
      };
    })
    .filter((candidate): candidate is FoodCandidate => Boolean(candidate))
    .sort((a, b) => a.cost - b.cost || a.warehouse.id.localeCompare(b.warehouse.id));

const routeTo = (world: World, person: Person, target: Hex): Hex[] | undefined =>
  findPath(world.tiles, person.position, target, ROAD_SPEED_MULTIPLIER) ?? undefined;

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

const consumeBread = (world: World, person: Person, warehouse: Building): void => {
  warehouse.inventory ??= {};
  warehouse.inventory.bread = (warehouse.inventory.bread ?? 0) - 1;
  person.hunger = HUNGER_MAX;
  person.hungerAccumulator = 0;
  const completedState = person.hungerState!;
  person.hungerState = undefined;
  resumeTask(world, person, completedState);
};

const startEating = (world: World, person: Person, critical: boolean): boolean => {
  const candidate = foodCandidates(world, person)[0];
  if (!candidate && !critical) return false;

  person.hungerState = {
    foodSource: candidate?.warehouse.id,
    resumeActive: person.active,
  };
  person.active = false;
  person.movement = 0;

  if (candidate && same(person.position, candidate.warehouse.position)) {
    person.path = [];
    consumeBread(world, person, candidate.warehouse);
    return true;
  }

  if (candidate) {
    person.path = candidate.path;
    return true;
  }

  // A one-step hold path keeps the normal simulation from reactivating a
  // critically hungry person at its workplace while no food is reachable.
  person.path = [{ ...person.position }];
  return true;
};

const atTaskBoundary = (person: Person): boolean =>
  person.progress === 0 &&
  !person.farmTask &&
  !person.trip &&
  person.path.length === 0;

const ensureFoodRoute = (world: World, person: Person): void => {
  const state = person.hungerState!;
  let warehouse = state.foodSource
    ? world.buildings.find((building) => building.id === state.foodSource)
    : undefined;

  if (
    !warehouse ||
    !isFinishedWarehouse(warehouse) ||
    breadStock(warehouse) - reservedBread(world, warehouse.id, person.id) < 1
  ) {
    const candidate = foodCandidates(world, person)[0];
    state.foodSource = candidate?.warehouse.id;
    warehouse = candidate?.warehouse;
    person.movement = 0;
    if (candidate?.warehouse && same(person.position, candidate.warehouse.position)) {
      person.path = [];
      consumeBread(world, person, candidate.warehouse);
      return;
    }
    person.path = candidate?.path ?? [{ ...person.position }];
  }

  if (!warehouse) {
    person.active = false;
    person.movement = 0;
    person.path = [{ ...person.position }];
    return;
  }

  if (!same(person.position, warehouse.position)) {
    person.path = routeTo(world, person, warehouse.position) ?? [{ ...person.position }];
    person.active = false;
    return;
  }

  if (breadStock(warehouse) < 1) {
    state.foodSource = undefined;
    person.active = false;
    person.movement = 0;
    person.path = [{ ...person.position }];
    return;
  }

  consumeBread(world, person, warehouse);
};

export function advanceHungerTick(world: World): void {
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
