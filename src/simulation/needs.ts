import type {
  Building,
  BuildingId,
  Hex,
  HungerState,
  Person,
  Tile,
  World,
} from "./model";
import { findPath, key, pathTravelCost, same, tileIndex } from "./hex";
import { CONFIG } from "./scenario";
import { hexDistance } from "./spatial";
import {
  performanceNow,
  performanceProfiler,
  type PathReason,
} from "../debug/performanceProfiler";

const SIMULATION_HZ = 60;
const EATING_DURATION_TICKS = 5 * SIMULATION_HZ;
const ROAD_SPEED_MULTIPLIER = 1.3;
const WANTS_TO_EAT_THRESHOLD = 40;
const CRITICAL_HUNGER_THRESHOLD = 20;
const HUNGER_MAX = 100;
const BREAD_FOOD_VALUE = 100;
const ACCUMULATOR_EPSILON = 1e-9;

type BreadCandidate = { kind: "bread"; source: Building; path: Hex[]; cost: number };
type BushCandidate = { kind: "bush"; tile: Tile; path: Hex[]; cost: number };
type FoodCandidate = BreadCandidate | BushCandidate;
type FoodSource =
  | { kind: "bread"; source: Building; target: Hex; lowerBound: number }
  | { kind: "bush"; tile: Tile; target: Hex; lowerBound: number };
type SelectedFoodTarget =
  | { kind: "bread"; source: Building }
  | { kind: "bush"; tile: Tile };

const isStorage = (building: Building): boolean =>
  (building.kind === "warehouse" || building.kind === "hq") &&
  !building.retired &&
  (!building.construction || building.construction.complete);

const isCompletedBakery = (building: Building): boolean =>
  building.kind === "bakery" && !building.retired && (!building.construction || building.construction.complete);

const breadStock = (building: Building): number => {
  if (isStorage(building)) return building.inventory?.bread ?? 0;
  if (isCompletedBakery(building)) return building.output;
  return 0;
};

const reservedBread = (world: World, sourceId: BuildingId, exceptPersonId?: number): number =>
  world.people.filter((person) => person.id !== exceptPersonId && person.hungerState?.foodSource === sourceId).length;

const reservedBush = (world: World, tile: Hex, exceptPersonId?: number): boolean =>
  world.people.some((person) => person.id !== exceptPersonId && person.hungerState?.foodBush && same(person.hungerState.foodBush, tile));

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
  person.hungerAccumulator! += 1 / secondsPerHungerPoint(person);
  while (person.hungerAccumulator! + ACCUMULATOR_EPSILON >= 1 && person.hunger! > 0) {
    person.hungerAccumulator = Math.max(0, person.hungerAccumulator! - 1);
    person.hunger!--;
  }
};

const routeTo = (world: World, person: Person, target: Hex, reason: PathReason = "hunger"): Hex[] | undefined =>
  performanceProfiler.withPathReason(reason, () => findPath(world.tiles, person.position, target, ROAD_SPEED_MULTIPLIER)) ?? undefined;

const sourceTie = (source: FoodSource): string => source.kind === "bread"
  ? `0:${source.source.id}`
  : `1:${String(source.tile.r).padStart(5, "0")}:${String(source.tile.q).padStart(5, "0")}`;

const foodCandidate = (world: World, person: Person): FoodCandidate | undefined => {
  const sources: FoodSource[] = [];
  for (const source of world.buildings) {
    if (breadStock(source) - reservedBread(world, source.id, person.id) < 1) continue;
    sources.push({ kind: "bread", source, target: source.position, lowerBound: hexDistance(person.position, source.position) / ROAD_SPEED_MULTIPLIER });
  }
  for (const tile of world.tiles) {
    if (tile.terrain !== "grass" || !tile.bush || !tile.bushAvailable || reservedBush(world, tile, person.id)) continue;
    sources.push({ kind: "bush", tile, target: tile, lowerBound: hexDistance(person.position, tile) / ROAD_SPEED_MULTIPLIER });
  }
  sources.sort((a, b) => a.lowerBound - b.lowerBound || sourceTie(a).localeCompare(sourceTie(b)));
  let best: FoodCandidate | undefined;
  for (const source of sources) {
    if (best && source.lowerBound > best.cost + ACCUMULATOR_EPSILON) break;
    const path = routeTo(world, person, source.target);
    if (!path) continue;
    const cost = pathTravelCost(world.tiles, path, ROAD_SPEED_MULTIPLIER);
    const candidate: FoodCandidate = source.kind === "bread"
      ? { kind: "bread", source: source.source, path, cost }
      : { kind: "bush", tile: source.tile, path, cost };
    if (
      !best ||
      cost < best.cost - ACCUMULATOR_EPSILON ||
      (Math.abs(cost - best.cost) <= ACCUMULATOR_EPSILON && candidate.kind === "bread" && best.kind === "bush") ||
      (Math.abs(cost - best.cost) <= ACCUMULATOR_EPSILON && candidate.kind === best.kind &&
        (candidate.kind === "bread"
          ? candidate.source.id.localeCompare((best as BreadCandidate).source.id) < 0
          : candidate.tile.r < (best as BushCandidate).tile.r ||
            (candidate.tile.r === (best as BushCandidate).tile.r && candidate.tile.q < (best as BushCandidate).tile.q)))
    ) best = candidate;
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
  if (person.resourceTarget) return world.naturalResources.find((resource) => resource.id === person.resourceTarget)?.position;
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

const finishEating = (world: World, person: Person): void => {
  const completedState = person.hungerState!;
  person.hungerState = undefined;
  person.hungerAccumulator = 0;
  resumeTask(world, person, completedState);
};

const consumeBread = (world: World, person: Person, source: Building): void => {
  if (isStorage(source)) {
    source.inventory ??= {};
    source.inventory.bread = (source.inventory.bread ?? 0) - 1;
  } else source.output -= 1;
  person.hunger = (person.hunger ?? HUNGER_MAX) + BREAD_FOOD_VALUE;
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
  person.hunger = (person.hunger ?? HUNGER_MAX) + CONFIG.bushFoodValue;
  finishEating(world, person);
};

const beginEating = (world: World, person: Person): void => {
  const state = person.hungerState!;
  person.path = [];
  person.movement = 0;
  person.active = false;
  state.eatingUntilTick ??= world.round + EATING_DURATION_TICKS;
};

const useCandidate = (world: World, person: Person, candidate: FoodCandidate): void => {
  if (candidate.kind === "bread") {
    if (same(person.position, candidate.source.position)) beginEating(world, person);
    else person.path = candidate.path;
    return;
  }
  if (same(person.position, candidate.tile)) beginEating(world, person);
  else person.path = candidate.path;
};

const assignFoodCandidate = (world: World, person: Person, state: HungerState, candidate: FoodCandidate | undefined): boolean => {
  state.foodSource = candidate?.kind === "bread" ? candidate.source.id : undefined;
  state.foodBush = candidate?.kind === "bush" ? { q: candidate.tile.q, r: candidate.tile.r } : undefined;
  state.retryAfterTick = candidate ? undefined : world.round + CONFIG.decisionIntervalTicks;
  state.eatingUntilTick = undefined;
  person.movement = 0;
  if (!candidate) { person.path = []; person.active = false; return false; }
  useCandidate(world, person, candidate);
  if (person.hungerState) person.active = false;
  return true;
};

const startEating = (world: World, person: Person): boolean => {
  const candidate = foodCandidate(world, person);
  person.hungerState = { resumeActive: person.active };
  person.active = false;
  person.movement = 0;
  return assignFoodCandidate(world, person, person.hungerState, candidate);
};

const atTaskBoundary = (person: Person): boolean => person.progress === 0 && !person.farmTask && !person.trip && person.path.length === 0;

const selectedFoodTarget = (world: World, person: Person): SelectedFoodTarget | undefined => {
  const state = person.hungerState!;
  if (state.foodSource) {
    const source = world.buildings.find((building) => building.id === state.foodSource);
    if (source && breadStock(source) - reservedBread(world, source.id, person.id) >= 1) return { kind: "bread", source };
  }
  if (state.foodBush) {
    const tile = tileIndex(world.tiles).get(key(state.foodBush));
    if (tile?.terrain === "grass" && tile.bush && tile.bushAvailable && !reservedBush(world, tile, person.id)) return { kind: "bush", tile };
  }
  return undefined;
};

const selectedTargetPosition = (target: SelectedFoodTarget): Hex => target.kind === "bread" ? target.source.position : target.tile;
const consumeSelectedTarget = (world: World, person: Person, target: SelectedFoodTarget): void => {
  if (target.kind === "bread") consumeBread(world, person, target.source);
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
    const path = routeTo(world, person, targetPosition);
    if (path) { person.path = path; person.movement = 0; person.active = false; return; }
    state.foodSource = undefined;
    state.foodBush = undefined;
  }
  state.eatingUntilTick = undefined;
  if (state.retryAfterTick !== undefined && world.round < state.retryAfterTick) { person.active = false; return; }
  assignFoodCandidate(world, person, state, foodCandidate(world, person));
};

/** Starts or completes the timed eating phase on the exact movement tick a food source is reached. */
export function resolveFoodArrivals(world: World): void {
  for (const person of world.people) {
    if (!person.hungerState) continue;
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
    if (person.hungerState) { ensureFoodRoute(world, person); continue; }
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
  if (hunger <= WANTS_TO_EAT_THRESHOLD) return "hungry";
  return "normal";
};