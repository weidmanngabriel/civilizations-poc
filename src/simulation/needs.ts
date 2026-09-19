import type {
  Building,
  BuildingId,
  Hex,
  HungerState,
  Person,
  Tile,
  World,
} from "./model";
import { key, pathTravelCost, same, tileIndex } from "./hex";
import { CONFIG } from "./scenario";
import { findRequiredNavigationPath } from "./wayposts";
import { hexDistance } from "./spatial";
import {
  findLocalNeedPath,
  findNeedReturnPath,
  localNeedPathLeavesWaypostCoverage,
  NEED_LOCAL_NAVIGATION_RADIUS,
} from "./needNavigation";
import {
  availableLooseGoodAmount,
  looseGoodStack,
  looseGoodStacks,
  pickupReservedLooseGood,
  releaseLooseGoodReservation,
  reserveLooseGood,
} from "./looseGoods";
import {
  performanceNow,
  performanceProfiler,
  type PathReason,
} from "../debug/performanceProfiler";

const SIMULATION_HZ = 60;
const EATING_DURATION_TICKS = 5 * SIMULATION_HZ;
const ROAD_SPEED_MULTIPLIER = 1.3;
const WANTS_TO_EAT_THRESHOLD = 40;
const HUNGER_WARNING_THRESHOLD = 30;
const CRITICAL_HUNGER_THRESHOLD = 20;
const HUNGER_MAX = 100;
const BREAD_FOOD_VALUE = 80;
const FISH_FOOD_VALUE = 60;
const ACCUMULATOR_EPSILON = 1e-9;

type StoredFoodGood = "bread" | "fish" | "meat";
type BuildingFoodCandidate = { kind: "building"; source: Building; good: StoredFoodGood; path: Hex[]; cost: number };
type LooseFoodCandidate = { kind: "looseFood"; stackId: string; good: Exclude<StoredFoodGood, "bread">; target: Hex; path: Hex[]; cost: number };
type BushCandidate = { kind: "bush"; tile: Tile; path: Hex[]; cost: number };
type FoodCandidate = BuildingFoodCandidate | LooseFoodCandidate | BushCandidate;
type FoodSource =
  | { kind: "building"; source: Building; good: StoredFoodGood; target: Hex; lowerBound: number }
  | { kind: "looseFood"; stackId: string; good: Exclude<StoredFoodGood, "bread">; target: Hex; lowerBound: number }
  | { kind: "bush"; tile: Tile; target: Hex; lowerBound: number };
type SelectedFoodTarget =
  | { kind: "building"; source: Building; good: StoredFoodGood }
  | { kind: "looseFood"; stackId: string; good: Exclude<StoredFoodGood, "bread">; target: Hex }
  | { kind: "bush"; tile: Tile };

const isStorage = (building: Building): boolean =>
  (building.kind === "warehouse" || building.kind === "hq") &&
  !building.retired &&
  (!building.construction || building.construction.complete);

const isCompletedBakery = (building: Building): boolean =>
  building.kind === "bakery" && !building.retired && (!building.construction || building.construction.complete);

const buildingFoodStock = (building: Building, good: StoredFoodGood): number => {
  if (isStorage(building)) return building.inventory?.[good] ?? 0;
  if (good === "bread" && isCompletedBakery(building)) return building.output;
  return 0;
};

const reservedBuildingFood = (
  world: World,
  sourceId: BuildingId,
  good: StoredFoodGood,
  exceptPersonId?: number,
): number =>
  world.people.filter((person) =>
    person.id !== exceptPersonId &&
    person.hungerState?.foodSource === sourceId &&
    (person.hungerState.foodGood ?? "bread") === good,
  ).length;

const reservedBush = (world: World, tile: Hex, exceptPersonId?: number): boolean =>
  world.people.some((person) => person.id !== exceptPersonId && person.hungerState?.foodBush && same(person.hungerState.foodBush, tile));

const hungerValue = (person: Person): number => {
  person.hunger ??= HUNGER_MAX;
  person.hungerAccumulator ??= 0;
  return person.hunger;
};

const secondsPerHungerPoint = (person: Person): number => {
  if (person.trip?.picked) return 2;
  if (person.hungerState) return person.path.length > 0 ? 4 : 8;
  if (person.progress > 0 || (person.farmTask && person.path.length === 0)) return 2;
  if (person.path.length > 0) return 4;
  return 8;
};

const decayHunger = (person: Person): void => {
  hungerValue(person);
  person.hungerAccumulator! += 1 / secondsPerHungerPoint(person);
  while (person.hungerAccumulator! + ACCUMULATOR_EPSILON >= 1 && person.hunger! > 0) {
    person.hungerAccumulator = Math.max(0, person.hungerAccumulator! - 1);
    person.hunger!--;
  }
};

const routeTo = (world: World, person: Person, target: Hex, reason: PathReason = "hunger"): Hex[] | undefined =>
  performanceProfiler.withPathReason(reason, () => findRequiredNavigationPath(world, person, target, ROAD_SPEED_MULTIPLIER)) ?? undefined;

const localRouteTo = (
  world: World,
  person: Person,
  origin: Hex,
  target: Hex,
): Hex[] | undefined =>
  performanceProfiler.withPathReason(
    "hunger",
    () => findLocalNeedPath(world, person, origin, target, ROAD_SPEED_MULTIPLIER),
  ) ?? undefined;

const sourceTie = (source: FoodSource): string => {
  if (source.kind === "building")
    return `${source.good === "bread" ? 0 : 1}:${source.source.id}`;
  if (source.kind === "looseFood") return `2:${source.good}:${source.stackId}`;
  return `3:${String(source.tile.r).padStart(5, "0")}:${String(source.tile.q).padStart(5, "0")}`;
};

const foodCandidate = (
  world: World,
  person: Person,
  origin?: Hex,
  localOnly = false,
): FoodCandidate | undefined => {
  const sources: FoodSource[] = [];
  for (const source of world.buildings) {
    for (const good of ["bread", "fish", "meat"] as const) {
      if (buildingFoodStock(source, good) - reservedBuildingFood(world, source.id, good, person.id) < 1) continue;
      sources.push({
        kind: "building",
        source,
        good,
        target: source.position,
        lowerBound: hexDistance(person.position, source.position) / ROAD_SPEED_MULTIPLIER,
      });
    }
  }
  for (const stack of looseGoodStacks(world)) {
    if ((stack.good !== "fish" && stack.good !== "meat") || availableLooseGoodAmount(stack) < 1) continue;
    sources.push({
      kind: "looseFood",
      stackId: stack.id,
      good: stack.good,
      target: stack.position,
      lowerBound: hexDistance(person.position, stack.position) / ROAD_SPEED_MULTIPLIER,
    });
  }
  for (const tile of world.tiles) {
    if (tile.terrain !== "grass" || !tile.bush || !tile.bushAvailable || reservedBush(world, tile, person.id)) continue;
    sources.push({ kind: "bush", tile, target: tile, lowerBound: hexDistance(person.position, tile) / ROAD_SPEED_MULTIPLIER });
  }
  const eligibleSources = localOnly && origin
    ? sources.filter((source) => hexDistance(origin, source.target) <= NEED_LOCAL_NAVIGATION_RADIUS)
    : sources;
  eligibleSources.sort((a, b) => a.lowerBound - b.lowerBound || sourceTie(a).localeCompare(sourceTie(b)));
  let best: FoodCandidate | undefined;
  let bestTie = "";
  for (const source of eligibleSources) {
    if (best && source.lowerBound > best.cost + ACCUMULATOR_EPSILON) break;
    const path = localOnly && origin
      ? localRouteTo(world, person, origin, source.target)
      : routeTo(world, person, source.target);
    if (!path) continue;
    const cost = pathTravelCost(world.tiles, path, ROAD_SPEED_MULTIPLIER);
    const candidate: FoodCandidate = source.kind === "building"
      ? { kind: "building", source: source.source, good: source.good, path, cost }
      : source.kind === "looseFood"
        ? { kind: "looseFood", stackId: source.stackId, good: source.good, target: source.target, path, cost }
        : { kind: "bush", tile: source.tile, path, cost };
    const tie = sourceTie(source);
    if (!best || cost < best.cost - ACCUMULATOR_EPSILON ||
      (Math.abs(cost - best.cost) <= ACCUMULATOR_EPSILON && tie < bestTie)) {
      best = candidate;
      bestTie = tie;
    }
  }
  return best;
};

const currentTaskTarget = (world: World, person: Person): Hex | undefined => {
  if (person.farmTask) return person.farmTask.target;
  if (person.trip) {
    if (!person.trip.picked && person.trip.sourcePosition) return person.trip.sourcePosition;
    if (!person.trip.picked && person.trip.sourceKind === "resource")
      return world.naturalResources.find((resource) => resource.id === person.trip!.source)?.position;
    const buildingId = person.trip.picked ? person.trip.target : person.trip.source;
    return world.buildings.find((building) => building.id === buildingId)?.position;
  }
  if (person.outdoorCarry && person.workArea) return person.workArea.center;
  if (person.huntLootTarget) return looseGoodStack(world, person.huntLootTarget)?.position;
  if (person.resourceTarget) return world.naturalResources.find((resource) => resource.id === person.resourceTarget)?.position;
  if (person.fisher && person.fishingSpot) return person.fishingSpot;
  if (person.assignment) return world.buildings.find((building) => building.id === person.assignment!.building)?.position;
  return world.buildings.find((building) => building.id === "hq")?.position;
};

const resumeTask = (world: World, person: Person, hungerState: HungerState): void => {
  person.active = false;
  person.movement = 0;
  const target = currentTaskTarget(world, person);
  if (!target) { person.path = []; return; }
  if (same(person.position, target)) {
    person.path = [];
    person.active = hungerState.resumeActive || Boolean(person.assignment) || Boolean(person.resourceTarget);
    return;
  }
  person.path = routeTo(world, person, target) ?? [];
};

const completeEating = (world: World, person: Person, completedState: HungerState): void => {
  person.hungerState = undefined;
  person.hungerAccumulator = 0;
  resumeTask(world, person, completedState);
};

const finishEating = (world: World, person: Person): void => {
  const completedState = person.hungerState!;
  const origin = completedState.needOrigin;
  if (
    completedState.returnToNeedOrigin &&
    origin &&
    !same(person.position, origin)
  ) {
    const returnPath = findNeedReturnPath(
      world,
      person,
      origin,
      ROAD_SPEED_MULTIPLIER,
    );
    if (returnPath) {
      completedState.foodSource = undefined;
      completedState.foodGood = undefined;
      completedState.foodLooseGood = undefined;
      completedState.foodBush = undefined;
      completedState.eatingUntilTick = undefined;
      completedState.retryAfterTick = undefined;
      completedState.returningToNeedOrigin = true;
      person.path = returnPath;
      person.movement = 0;
      person.active = false;
      return;
    }
  }
  completeEating(world, person, completedState);
};

const ensureEatingReturn = (world: World, person: Person): void => {
  const state = person.hungerState!;
  const origin = state.needOrigin;
  if (!state.returningToNeedOrigin || !origin) return;
  if (same(person.position, origin)) {
    completeEating(world, person, state);
    return;
  }
  if (person.path.length > 0) {
    person.active = false;
    return;
  }
  const path = findNeedReturnPath(world, person, origin, ROAD_SPEED_MULTIPLIER);
  if (!path) {
    completeEating(world, person, state);
    return;
  }
  person.path = path;
  person.movement = 0;
  person.active = false;
};

const consumeBuildingFood = (
  world: World,
  person: Person,
  source: Building,
  good: StoredFoodGood,
): void => {
  if (isStorage(source)) {
    source.inventory ??= {};
    source.inventory[good] = (source.inventory[good] ?? 0) - 1;
  } else if (good === "bread") source.output -= 1;
  person.hunger = Math.min(
    HUNGER_MAX,
    (person.hunger ?? HUNGER_MAX) + (good === "bread" ? BREAD_FOOD_VALUE : FISH_FOOD_VALUE),
  );
  finishEating(world, person);
};

const consumeLooseFood = (
  world: World,
  person: Person,
  stackId: string,
  _good: "fish" | "meat",
): void => {
  if (!pickupReservedLooseGood(world, stackId, 1)) return;
  person.hunger = Math.min(HUNGER_MAX, (person.hunger ?? HUNGER_MAX) + FISH_FOOD_VALUE);
  finishEating(world, person);
};

const nextRandom = (world: World): number => {
  world.rngState = (Math.imul(world.rngState, 1664525) + 1013904223) >>> 0;
  return world.rngState;
};

const consumeBush = (world: World, person: Person, tile: Tile): void => {
  tile.bushAvailable = false;
  const span = CONFIG.bushRegrowMaxTicks - CONFIG.bushRegrowMinTicks;
  const regrowTick = world.round + CONFIG.bushRegrowMinTicks + (nextRandom(world) % (span + 1));
  tile.bushRegrowTick = regrowTick;
  world.nextBushRegrowTick = Math.min(world.nextBushRegrowTick ?? regrowTick, regrowTick);
  person.hunger = Math.min(HUNGER_MAX, (person.hunger ?? HUNGER_MAX) + CONFIG.bushFoodValue);
  finishEating(world, person);
};

const beginEating = (world: World, person: Person): void => {
  const state = person.hungerState!;
  person.path = [];
  person.movement = 0;
  person.active = false;
  state.eatingUntilTick ??= world.round + EATING_DURATION_TICKS;
};

const candidateTarget = (candidate: FoodCandidate): Hex =>
  candidate.kind === "building" ? candidate.source.position
    : candidate.kind === "looseFood" ? candidate.target
      : candidate.tile;

const useCandidate = (world: World, person: Person, candidate: FoodCandidate): void => {
  const target = candidateTarget(candidate);
  if (same(person.position, target)) beginEating(world, person);
  else person.path = candidate.path;
};

const clearLooseFoodReservation = (world: World, state: HungerState): void => {
  if (state.foodLooseGood) releaseLooseGoodReservation(world, state.foodLooseGood, 1);
  state.foodLooseGood = undefined;
};

const assignFoodCandidate = (
  world: World,
  person: Person,
  state: HungerState,
  candidate: FoodCandidate | undefined,
  localNeedSearch = false,
): boolean => {
  if (state.foodLooseGood && (candidate?.kind !== "looseFood" || candidate.stackId !== state.foodLooseGood))
    clearLooseFoodReservation(world, state);

  state.foodSource = candidate?.kind === "building" ? candidate.source.id : undefined;
  state.foodGood = candidate?.kind === "building" ? candidate.good : undefined;
  state.foodBush = candidate?.kind === "bush" ? { q: candidate.tile.q, r: candidate.tile.r } : undefined;
  state.foodLooseGood = candidate?.kind === "looseFood" ? candidate.stackId : undefined;
  if (candidate?.kind === "looseFood" && !reserveLooseGood(world, candidate.stackId, 1)) {
    state.foodLooseGood = undefined;
    candidate = undefined;
  }
  state.localNeedSearch = Boolean(candidate) && localNeedSearch;
  state.returnToNeedOrigin = Boolean(
    candidate &&
    localNeedSearch &&
    state.needOrigin &&
    localNeedPathLeavesWaypostCoverage(world, state.needOrigin, candidate.path),
  );
  state.returningToNeedOrigin = undefined;
  state.retryAfterTick = candidate ? undefined : world.round + CONFIG.decisionIntervalTicks;
  state.eatingUntilTick = undefined;
  person.movement = 0;
  if (!candidate) { person.path = []; person.active = false; return false; }
  useCandidate(world, person, candidate);
  if (person.hungerState) person.active = false;
  return true;
};

const startEating = (world: World, person: Person): boolean => {
  const origin = { ...person.position };
  const localCandidate = foodCandidate(world, person, origin, true);
  const candidate = localCandidate ?? foodCandidate(world, person, origin, false);
  person.hungerState = {
    resumeActive: person.active,
    needOrigin: origin,
  };
  person.active = false;
  person.movement = 0;
  return assignFoodCandidate(
    world,
    person,
    person.hungerState,
    candidate,
    Boolean(localCandidate),
  );
};

export const interruptEating = (world: World, person: Person): void => {
  if (!person.hungerState) return;
  clearLooseFoodReservation(world, person.hungerState);
  person.hungerState = undefined;
};

export const commandEat = (world: World, personId: number): boolean => {
  const person = world.people.find((candidate) => candidate.id === personId);
  if (!person || (person.hunger ?? HUNGER_MAX) >= HUNGER_MAX) return false;
  interruptEating(world, person);
  person.manualMoveTarget = undefined;
  return startEating(world, person);
};

export const startEatingAfterCompletedAction = (world: World, person: Person): boolean => {
  if (person.hungerState || hungerValue(person) > WANTS_TO_EAT_THRESHOLD) return false;
  return startEating(world, person);
};

const atTaskBoundary = (person: Person): boolean =>
  person.progress === 0 &&
  !person.farmTask &&
  !person.trip &&
  !person.outdoorCarry &&
  person.fishingWaitUntilTick === undefined &&
  person.path.length === 0;

const selectedFoodTarget = (world: World, person: Person): SelectedFoodTarget | undefined => {
  const state = person.hungerState!;
  if (state.foodSource) {
    const source = world.buildings.find((building) => building.id === state.foodSource);
    const good = state.foodGood ?? "bread";
    if (source && buildingFoodStock(source, good) - reservedBuildingFood(world, source.id, good, person.id) >= 1)
      return { kind: "building", source, good };
  }
  if (state.foodLooseGood) {
    const stack = looseGoodStack(world, state.foodLooseGood);
    if ((stack?.good === "fish" || stack?.good === "meat") && stack.amount >= 1 && stack.reserved >= 1)
      return { kind: "looseFood", stackId: stack.id, good: stack.good, target: stack.position };
  }
  if (state.foodBush) {
    const tile = tileIndex(world.tiles).get(key(state.foodBush));
    if (tile?.terrain === "grass" && tile.bush && tile.bushAvailable && !reservedBush(world, tile, person.id)) return { kind: "bush", tile };
  }
  return undefined;
};

const selectedTargetPosition = (target: SelectedFoodTarget): Hex =>
  target.kind === "building" ? target.source.position : target.kind === "looseFood" ? target.target : target.tile;
const plannedFoodTargetPosition = (world: World, person: Person): Hex | undefined => {
  const state = person.hungerState;
  if (!state) return undefined;
  if (state.foodSource)
    return world.buildings.find((building) => building.id === state.foodSource)?.position;
  if (state.foodLooseGood) return looseGoodStack(world, state.foodLooseGood)?.position;
  return state.foodBush;
};
const restoreFoodRouteIfHijacked = (world: World, person: Person): void => {
  const target = plannedFoodTargetPosition(world, person);
  if (!target) return;
  if (same(person.position, target)) {
    person.path = [];
    person.movement = 0;
    person.active = false;
    return;
  }
  const routeTarget = person.path.at(-1);
  if (routeTarget && same(routeTarget, target)) return;
  const state = person.hungerState!;
  const path = state.localNeedSearch && state.needOrigin
    ? localRouteTo(world, person, state.needOrigin, target)
    : routeTo(world, person, target);
  if (!path) return;
  person.path = path;
  person.movement = 0;
  person.active = false;
};
const consumeSelectedTarget = (world: World, person: Person, target: SelectedFoodTarget): void => {
  if (target.kind === "building") consumeBuildingFood(world, person, target.source, target.good);
  else if (target.kind === "looseFood") consumeLooseFood(world, person, target.stackId, target.good);
  else consumeBush(world, person, target.tile);
};

const ensureFoodRoute = (world: World, person: Person): void => {
  const state = person.hungerState!;
  if (person.path.length > 0) { person.active = false; return; }
  const target = selectedFoodTarget(world, person);
  if (target) {
    const targetPosition = selectedTargetPosition(target);
    if (same(person.position, targetPosition)) { beginEating(world, person); return; }
    state.eatingUntilTick = undefined;
    const path = state.localNeedSearch && state.needOrigin
      ? localRouteTo(world, person, state.needOrigin, targetPosition)
      : routeTo(world, person, targetPosition);
    if (path) { person.path = path; person.movement = 0; person.active = false; return; }
    state.foodSource = undefined;
    state.foodGood = undefined;
    state.foodBush = undefined;
    clearLooseFoodReservation(world, state);
  }
  state.eatingUntilTick = undefined;
  if (state.retryAfterTick !== undefined && world.round < state.retryAfterTick) { person.active = false; return; }
  const origin = state.needOrigin ?? { ...person.position };
  const localCandidate = foodCandidate(world, person, origin, true);
  assignFoodCandidate(
    world,
    person,
    state,
    localCandidate ?? foodCandidate(world, person, origin, false),
    Boolean(localCandidate),
  );
};

/** Starts or completes the timed eating phase on the exact movement tick a food source is reached. */
export function resolveFoodArrivals(world: World): void {
  for (const person of world.people) {
    if (!person.hungerState) continue;
    if (person.hungerState.returningToNeedOrigin) continue;
    restoreFoodRouteIfHijacked(world, person);
    const state = person.hungerState;
    const target = performanceProfiler.profileFeature(
      "foodArrivalTargetLookup",
      () => selectedFoodTarget(world, person),
    );
    if (!target || !same(person.position, selectedTargetPosition(target))) {
      if (state.eatingUntilTick !== undefined) state.eatingUntilTick = undefined;
      continue;
    }
    if (state.eatingUntilTick === undefined) {
      beginEating(world, person);
      continue;
    }
    if (world.round >= state.eatingUntilTick) {
      performanceProfiler.profileFeature(
        "foodArrivalConsumption",
        () => consumeSelectedTarget(world, person, target),
      );
    }
  }
}

const cleanupAndRegrowBushes = (world: World): void => {
  const cleanupDue = world.round % CONFIG.decisionIntervalTicks === 0;
  const regrowDue = world.nextBushRegrowTick !== undefined && world.round >= world.nextBushRegrowTick;
  if (!cleanupDue && !regrowDue) return;
  let nextRegrowTick: number | undefined;
  for (const tile of world.tiles) {
    if (!tile.bush) continue;
    if (cleanupDue && tile.terrain !== "grass") {
      tile.bush = undefined; tile.bushAvailable = undefined; tile.bushRegrowTick = undefined; continue;
    }
    if (tile.bushRegrowTick === undefined) continue;
    if (world.round >= tile.bushRegrowTick) { tile.bushAvailable = true; tile.bushRegrowTick = undefined; continue; }
    nextRegrowTick = Math.min(nextRegrowTick ?? tile.bushRegrowTick, tile.bushRegrowTick);
  }
  world.nextBushRegrowTick = nextRegrowTick;
};

export function advanceHungerTick(world: World): void {
  const hungerStarted = performanceNow();
  cleanupAndRegrowBushes(world);
  for (const person of world.people) {
    decayHunger(person);
    if (person.manualMoveTarget) continue;
    if (person.hungerState) {
      if (person.hungerState.returningToNeedOrigin) ensureEatingReturn(world, person);
      else ensureFoodRoute(world, person);
      continue;
    }
    if (person.hunger! <= CRITICAL_HUNGER_THRESHOLD) { startEating(world, person); continue; }
    if (person.hunger! <= WANTS_TO_EAT_THRESHOLD && atTaskBoundary(person)) startEating(world, person);
  }
  performanceProfiler.recordFeature("hunger", performanceNow() - hungerStarted);
}

export function attachNeeds(world: World): World {
  return new Proxy(world, {
    set(target, property, value, receiver) {
      const oneTickAdvance = property === "round" && typeof value === "number" && value === target.round + 1;
      const changed = Reflect.set(target, property, value, receiver);
      if (changed && oneTickAdvance && value % SIMULATION_HZ === 0) advanceHungerTick(receiver as World);
      return changed;
    },
  });
}

export const hungerStatus = (person: Person): "normal" | "hungry" | "critical" => {
  const hunger = person.hunger ?? HUNGER_MAX;
  if (hunger <= CRITICAL_HUNGER_THRESHOLD) return "critical";
  if (hunger <= HUNGER_WARNING_THRESHOLD) return "hungry";
  return "normal";
};