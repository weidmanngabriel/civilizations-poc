import type { Building, Hex, Person, SleepLocationKind, SleepState, World } from "./model";
import { findPathBySteps, key, pathTravelCost, same, tileIndex } from "./hex";
import { CONFIG } from "./scenario";
import { clearNavigationBlocked, findRequiredNavigationPath } from "./wayposts";
import { GRID_REFINEMENT, hexDistance } from "./spatial";
import { performanceNow, performanceProfiler } from "../debug/performanceProfiler";

const SLEEP_MAX = 100;
const WANTS_TO_SLEEP_THRESHOLD = 40;
const SLEEP_WARNING_THRESHOLD = 30;
const CRITICAL_SLEEP_THRESHOLD = 20;
const SLEEP_RADIUS_WORLD_TILES = 8;
const SLEEP_RADIUS_STEPS = SLEEP_RADIUS_WORLD_TILES * GRID_REFINEMENT;
const SLEEP_PHASE_TICKS = 5 * 60;
const SLEEP_DURATION_TICKS = SLEEP_PHASE_TICKS * 2;
const ACCUMULATOR_EPSILON = 1e-9;

const sleepValue = (person: Person): number => {
  person.sleep ??= SLEEP_MAX;
  person.sleepAccumulator ??= 0;
  person.sleepGraceTicks ??= 0;
  return person.sleep;
};

const secondsPerSleepPoint = (person: Person): number => {
  if (person.trip?.picked) return 4;
  if (person.progress > 0 || (person.farmTask && person.path.length === 0)) return 4;
  if (person.path.length > 0) return 8;
  return 16;
};

const decaySleep = (person: Person): void => {
  sleepValue(person);
  person.sleepAccumulator! += 1 / (secondsPerSleepPoint(person) * CONFIG.simulationHz);
  while (person.sleepAccumulator! + ACCUMULATOR_EPSILON >= 1 && person.sleep! > 0) {
    person.sleepAccumulator = Math.max(0, person.sleepAccumulator! - 1);
    person.sleep!--;
  }
};

const routeTo = (world: World, person: Person, target: Hex): Hex[] | undefined =>
  performanceProfiler.withPathReason("sleep", () =>
    findRequiredNavigationPath(world, person, target, CONFIG.roadSpeedMultiplier),
  ) ?? undefined;

const isCompletedHouse = (building: Building): boolean =>
  building.kind === "house" && !building.retired && (!building.construction || building.construction.complete);

const withinSleepRadius = (world: World, origin: Hex, target: Hex): boolean => {
  const path = performanceProfiler.withPathReason("sleep", () => findPathBySteps(world.tiles, origin, target));
  return Boolean(path && path.length <= SLEEP_RADIUS_STEPS);
};

type SleepCandidate = { kind: Exclude<SleepLocationKind, "ground">; target: Hex; path: Hex[]; cost: number };
type SleepSearchContext = { houses?: Hex[]; nature?: Hex[] };

const natureTargets = (world: World): Hex[] => {
  const targets = new Map<string, Hex>();
  for (const resource of world.naturalResources) {
    if (resource.kind !== "forest" || resource.depleted) continue;
    targets.set(key(resource.position), { ...resource.position });
  }
  for (const tile of world.tiles) {
    if (tile.terrain !== "grass" || !tile.bush) continue;
    targets.set(key(tile), { q: tile.q, r: tile.r });
  }
  return [...targets.values()];
};

const searchTargets = (world: World, person: Person, context: SleepSearchContext, kind: "house" | "nature"): Hex[] => {
  if (kind === "house") {
    if (person.home) {
      const home = world.buildings.find((building) => building.id === person.home && isCompletedHouse(building));
      if (home) return [home.position];
    }
    context.houses ??= world.buildings.filter(isCompletedHouse).map((building) => building.position);
    return context.houses;
  }
  context.nature ??= natureTargets(world);
  return context.nature;
};

const bestCandidate = (
  world: World,
  person: Person,
  kind: "house" | "nature",
  context: SleepSearchContext,
  excludedTargets: ReadonlySet<string> = new Set(),
): SleepCandidate | undefined => {
  const targets = searchTargets(world, person, context, kind)
    .filter((target) => !excludedTargets.has(key(target)))
    .map((target) => {
      const distance = hexDistance(person.position, target);
      return {
        target,
        distance,
        lowerBound: distance / CONFIG.roadSpeedMultiplier,
      };
    })
    .filter((candidate) => candidate.distance <= SLEEP_RADIUS_STEPS)
    .sort((a, b) => a.lowerBound - b.lowerBound || a.target.r - b.target.r || a.target.q - b.target.q);

  let best: SleepCandidate | undefined;
  for (const candidate of targets) {
    if (best && candidate.lowerBound > best.cost + ACCUMULATOR_EPSILON) break;
    if (!withinSleepRadius(world, person.position, candidate.target)) continue;
    const path = routeTo(world, person, candidate.target);
    if (!path) continue;
    const cost = pathTravelCost(world.tiles, path, CONFIG.roadSpeedMultiplier);
    if (
      !best ||
      cost < best.cost - ACCUMULATOR_EPSILON ||
      (Math.abs(cost - best.cost) <= ACCUMULATOR_EPSILON &&
        (candidate.target.r < best.target.r ||
          (candidate.target.r === best.target.r && candidate.target.q < best.target.q)))
    ) best = { kind, target: candidate.target, path, cost };
  }
  return best;
};

const chooseSleepTarget = (
  world: World,
  person: Person,
  context: SleepSearchContext,
  excludedTargets: ReadonlySet<string> = new Set(),
): SleepCandidate | { kind: "ground"; target: Hex; path: Hex[] } =>
  bestCandidate(world, person, "house", context, excludedTargets) ??
  bestCandidate(world, person, "nature", context, excludedTargets) ??
  { kind: "ground", target: { ...person.position }, path: [] };

const targetStillValid = (world: World, state: SleepState): boolean => {
  if (state.kind === "ground") return true;
  if (state.kind === "house") return world.buildings.some((building) => isCompletedHouse(building) && same(building.position, state.target));
  if (world.naturalResources.some((resource) => resource.kind === "forest" && !resource.depleted && same(resource.position, state.target))) return true;
  const tile = tileIndex(world.tiles).get(key(state.target));
  return Boolean(tile?.terrain === "grass" && tile.bush);
};

const natureSleepTargetOccupied = (world: World, person: Person, target: Hex): boolean =>
  world.people.some((other) =>
    other.id !== person.id &&
    other.sleepState?.kind === "nature" &&
    other.sleepState.progress > 0 &&
    same(other.sleepState.target, target) &&
    same(other.position, target) &&
    other.path.length === 0,
  );

const atTaskBoundary = (person: Person): boolean =>
  person.progress === 0 &&
  !person.farmTask &&
  !person.trip &&
  !person.outdoorCarry &&
  person.fishingWaitUntilTick === undefined &&
  person.path.length === 0;

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
  if (person.resourceTarget) return world.naturalResources.find((resource) => resource.id === person.resourceTarget)?.position;
  if (person.fisher && person.fishingSpot) return person.fishingSpot;
  if (person.assignment) return world.buildings.find((building) => building.id === person.assignment!.building)?.position;
  return world.buildings.find((building) => building.id === "hq")?.position;
};

const resumeTask = (world: World, person: Person, state: SleepState): void => {
  person.builder = state.resumeBuilder || undefined;
  person.woodcutter = state.resumeWoodcutter || undefined;
  person.fisher = state.resumeFisher || undefined;
  person.extractor = state.resumeExtractor;
  const resourceStillAvailable = state.resumeResourceTarget
    ? world.naturalResources.some((resource) => resource.id === state.resumeResourceTarget && !resource.depleted &&
        !world.people.some((other) => other.id !== person.id && other.resourceTarget === state.resumeResourceTarget))
    : false;
  person.resourceTarget = resourceStillAvailable ? state.resumeResourceTarget : undefined;
  if (state.resumeResourceTarget && !resourceStillAvailable) person.progress = 0;
  person.active = false;
  person.movement = 0;
  const target = currentTaskTarget(world, person);
  if (!target) { person.path = []; return; }
  if (same(person.position, target)) {
    person.path = [];
    person.active = state.resumeActive || Boolean(person.assignment);
    return;
  }
  person.path = routeTo(world, person, target) ?? [];
};

const finishSleeping = (world: World, person: Person): void => {
  const state = person.sleepState!;
  person.sleepAccumulator = 0;
  person.sleepState = undefined;
  person.sleepGraceTicks = 2;
  resumeTask(world, person, state);
};

export const interruptSleep = (world: World, person: Person): void => {
  const state = person.sleepState;
  if (!state) return;
  person.sleepState = undefined;
  person.sleepGraceTicks = 2;
  resumeTask(world, person, state);
};

const recoveryPerPhase = (person: Person, kind: SleepLocationKind): number => {
  if (kind === "house") return 50;
  if (kind === "nature") return 15;
  return 5;
};

const startSleeping = (world: World, person: Person, context: SleepSearchContext): void => {
  const candidate = chooseSleepTarget(world, person, context);
  if (candidate.kind === "ground") clearNavigationBlocked(person);
  person.sleepState = {
    kind: candidate.kind,
    target: { ...candidate.target },
    progress: 0,
    completedPhases: 0,
    recoveryPerPhase: recoveryPerPhase(person, candidate.kind),
    resumeActive: person.active,
    resumeAssignment: person.assignment ? { ...person.assignment } : undefined,
    resumeBuilder: Boolean(person.builder),
    resumeWoodcutter: Boolean(person.woodcutter),
    resumeFisher: Boolean(person.fisher),
    resumeExtractor: person.extractor,
    resumeResourceTarget: person.resourceTarget,
  };
  // Sleeping pauses the current activity, but it must not make the person
  // lose their profession/work assignment or resource workplace.
  person.active = false;
  person.movement = 0;
  person.path = same(person.position, candidate.target) ? [] : candidate.path;
};

export const commandSleep = (world: World, personId: number): boolean => {
  const person = world.people.find((candidate) => candidate.id === personId);
  if (!person || (person.sleep ?? SLEEP_MAX) >= SLEEP_MAX) return false;
  if (person.sleepState) interruptSleep(world, person);
  person.manualMoveTarget = undefined;
  startSleeping(world, person, {});
  return true;
};

const applyReplacementTarget = (
  world: World,
  person: Person,
  state: SleepState,
  context: SleepSearchContext,
  excludedTargets: ReadonlySet<string> = new Set(),
): void => {
  const replacement = chooseSleepTarget(world, person, context, excludedTargets);
  if (replacement.kind === "ground") clearNavigationBlocked(person);
  state.kind = replacement.kind;
  state.target = { ...replacement.target };
  state.progress = 0;
  state.completedPhases = 0;
  state.recoveryPerPhase = recoveryPerPhase(person, replacement.kind);
  person.path = same(person.position, replacement.target) ? [] : replacement.path;
  person.movement = 0;
};

const applySleepPhase = (person: Person, state: SleepState): void => {
  person.sleep = Math.min(SLEEP_MAX, (person.sleep ?? SLEEP_MAX) + state.recoveryPerPhase);
  person.sleepAccumulator = 0;
};

const ensureSleepRouteOrProgress = (world: World, person: Person, context: SleepSearchContext): void => {
  const state = person.sleepState!;
  if (person.hungerState) return;
  if (person.path.length > 0) { person.active = false; return; }
  if (!same(person.position, state.target)) {
    if (!targetStillValid(world, state)) { applyReplacementTarget(world, person, state, context); return; }
    const reroute = routeTo(world, person, state.target);
    if (!reroute) applyReplacementTarget(world, person, state, context);
    else person.path = reroute;
    person.movement = 0;
    person.active = false;
    return;
  }
  if (state.progress === 0 && state.completedPhases === 0 && !targetStillValid(world, state)) {
    applyReplacementTarget(world, person, state, context);
    return;
  }
  if (state.kind === "nature" && natureSleepTargetOccupied(world, person, state.target)) {
    applyReplacementTarget(world, person, state, context, new Set([key(state.target)]));
    return;
  }
  person.active = false;
  person.movement = 0;
  state.progress++;
  if (state.completedPhases === 0 && state.progress >= SLEEP_PHASE_TICKS) {
    applySleepPhase(person, state);
    state.completedPhases = 1;
  }
  if (state.progress >= SLEEP_DURATION_TICKS) {
    applySleepPhase(person, state);
    finishSleeping(world, person);
  }
};

export function advanceSleepTick(world: World): void {
  const started = performanceNow();
  const searchContext: SleepSearchContext = {};
  try {
    for (const person of world.people) {
      sleepValue(person);
      if (person.sleepGraceTicks! > 0) person.sleepGraceTicks!--;
      if (person.manualMoveTarget) continue;
      if (person.sleepState) { ensureSleepRouteOrProgress(world, person, searchContext); continue; }
      decaySleep(person);
      if (person.hungerState || (person.hunger ?? 100) <= 40) continue;
      if (person.sleepGraceTicks! > 0) continue;
      if (person.sleep! <= CRITICAL_SLEEP_THRESHOLD) { startSleeping(world, person, searchContext); continue; }
      if (person.sleep! <= WANTS_TO_SLEEP_THRESHOLD && atTaskBoundary(person)) startSleeping(world, person, searchContext);
    }
  } finally {
    performanceProfiler.recordFeature("sleep", performanceNow() - started);
  }
}

export function attachSleep(world: World): World {
  return new Proxy(world, {
    set(target, property, value, receiver) {
      if (property === "round" && typeof value === "number" && value === target.round + 1) advanceSleepTick(receiver as World);
      return Reflect.set(target, property, value, receiver);
    },
  });
}

export const sleepStatus = (person: Person): "normal" | "tired" | "critical" => {
  const sleep = person.sleep ?? SLEEP_MAX;
  if (sleep <= CRITICAL_SLEEP_THRESHOLD) return "critical";
  if (sleep <= SLEEP_WARNING_THRESHOLD) return "tired";
  return "normal";
};

export const SLEEP_RULES = {
  radiusWorldTiles: SLEEP_RADIUS_WORLD_TILES,
  radiusSteps: SLEEP_RADIUS_STEPS,
  phaseTicks: SLEEP_PHASE_TICKS,
  durationTicks: SLEEP_DURATION_TICKS,
  houseRecovery: 100,
  natureRecovery: 30,
  groundRecovery: 10,
} as const;
