import type { Building, Hex, Person, SleepLocationKind, SleepState, World } from "./model";
import { findPathBySteps, key, pathTravelCost, same, tileIndex } from "./hex";
import { CONFIG } from "./scenario";
import { homeForPerson } from "./housing";
import { clearNavigationBlocked, findRequiredNavigationPath } from "./wayposts";
import { GRID_REFINEMENT, hexDistance } from "./spatial";
import {
  findLocalNeedAnchorReturn,
  findLocalNeedPath,
  findNeedReturnPath,
  localNeedPathLeavesWaypostCoverage,
  NEED_LOCAL_NAVIGATION_RADIUS,
} from "./needNavigation";
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
  if (person.educationTask?.active || person.progress > 0 || (person.farmTask && person.path.length === 0)) return 4;
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
    findRequiredNavigationPath(world, person, target, CONFIG.roadSpeedMultiplier, "sleep"),
  ) ?? undefined;

const localRouteTo = (
  world: World,
  person: Person,
  origin: Hex,
  target: Hex,
): Hex[] | undefined =>
  performanceProfiler.withPathReason(
    "sleep",
    () => findLocalNeedPath(world, person, origin, target, CONFIG.roadSpeedMultiplier),
  ) ?? undefined;

const isCompletedHouse = (building: Building): boolean =>
  building.kind === "house" && !building.retired && (!building.construction || building.construction.complete);

const withinSleepRadius = (world: World, origin: Hex, target: Hex): boolean => {
  const path = performanceProfiler.withPathReason("sleep", () => findPathBySteps(world.tiles, origin, target));
  return Boolean(path && path.length <= SLEEP_RADIUS_STEPS);
};

type SleepCandidate = {
  kind: Exclude<SleepLocationKind, "ground">;
  target: Hex;
  path: Hex[];
  cost: number;
  localNeedSearch: boolean;
};
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
    const home = homeForPerson(world, person);
    return home ? [home.position] : [];
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
  origin?: Hex,
  localOnly = false,
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
    .filter((candidate) =>
      candidate.distance <= (
        localOnly ? NEED_LOCAL_NAVIGATION_RADIUS : SLEEP_RADIUS_STEPS
      ),
    )
    .sort((a, b) => a.lowerBound - b.lowerBound || a.target.r - b.target.r || a.target.q - b.target.q);

  let best: SleepCandidate | undefined;
  for (const candidate of targets) {
    if (best && candidate.lowerBound > best.cost + ACCUMULATOR_EPSILON) break;
    if (!localOnly && !withinSleepRadius(world, person.position, candidate.target)) continue;
    const path = localOnly && origin
      ? localRouteTo(world, person, origin, candidate.target)
      : routeTo(world, person, candidate.target);
    if (!path) continue;
    const cost = pathTravelCost(world.tiles, path, CONFIG.roadSpeedMultiplier);
    if (
      !best ||
      cost < best.cost - ACCUMULATOR_EPSILON ||
      (Math.abs(cost - best.cost) <= ACCUMULATOR_EPSILON &&
        (candidate.target.r < best.target.r ||
          (candidate.target.r === best.target.r && candidate.target.q < best.target.q)))
    ) best = { kind, target: candidate.target, path, cost, localNeedSearch: localOnly };
  }
  return best;
};

const assignedHomeSleepTarget = (
  world: World,
  person: Person,
  origin: Hex = person.position,
): SleepCandidate | undefined => {
  const home = homeForPerson(world, person);
  if (!home) return;
  if (same(person.position, home.position))
    return { kind: "house", target: home.position, path: [], cost: 0, localNeedSearch: false };

  if (hexDistance(person.position, home.position) <= NEED_LOCAL_NAVIGATION_RADIUS) {
    const path = localRouteTo(world, person, origin, home.position);
    if (path)
      return {
        kind: "house",
        target: home.position,
        path,
        cost: pathTravelCost(world.tiles, path, CONFIG.roadSpeedMultiplier),
        localNeedSearch: true,
      };
  }

  const path = routeTo(world, person, home.position);
  if (!path) return;
  return {
    kind: "house",
    target: home.position,
    path,
    cost: pathTravelCost(world.tiles, path, CONFIG.roadSpeedMultiplier),
    localNeedSearch: false,
  };
};

const chooseLocalSleepTarget = (
  world: World,
  person: Person,
  context: SleepSearchContext,
  excludedTargets: ReadonlySet<string> = new Set(),
  origin: Hex = person.position,
): SleepCandidate | undefined =>
  bestCandidate(world, person, "nature", context, excludedTargets, origin, true);

const chooseGlobalSleepTarget = (
  world: World,
  person: Person,
  context: SleepSearchContext,
  excludedTargets: ReadonlySet<string> = new Set(),
): SleepCandidate | { kind: "ground"; target: Hex; path: Hex[]; localNeedSearch: false } =>
  bestCandidate(world, person, "nature", context, excludedTargets, person.position, false) ??
  { kind: "ground", target: { ...person.position }, path: [], localNeedSearch: false };

const chooseSleepTarget = (
  world: World,
  person: Person,
  context: SleepSearchContext,
  excludedTargets: ReadonlySet<string> = new Set(),
  origin: Hex = person.position,
): SleepCandidate | { kind: "ground"; target: Hex; path: Hex[]; localNeedSearch: false } =>
  assignedHomeSleepTarget(world, person, origin) ??
  chooseLocalSleepTarget(world, person, context, excludedTargets, origin) ??
  chooseGlobalSleepTarget(world, person, context, excludedTargets);

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
  if (person.educationTask)
    return world.buildings.find((building) => building.id === person.educationTask!.schoolId)?.position;
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
  if (person.familyTask) {
    person.path = [];
    return;
  }
  const target = currentTaskTarget(world, person);
  if (!target) { person.path = []; return; }
  if (same(person.position, target)) {
    person.path = [];
    person.active = state.resumeActive || Boolean(person.assignment);
    return;
  }
  person.path = routeTo(world, person, target) ?? [];
};

const completeSleeping = (world: World, person: Person, state: SleepState): void => {
  person.sleepAccumulator = 0;
  person.sleepState = undefined;
  person.sleepGraceTicks = 2;
  resumeTask(world, person, state);
};

const finishSleeping = (world: World, person: Person): void => {
  const state = person.sleepState!;
  const origin = state.needOrigin;
  if (
    state.returnToNeedOrigin &&
    origin &&
    !same(person.position, origin)
  ) {
    const returnPath = findNeedReturnPath(
      world,
      person,
      origin,
      CONFIG.roadSpeedMultiplier,
    );
    if (returnPath) {
      state.returningToNeedOrigin = true;
      state.progress = SLEEP_DURATION_TICKS;
      person.path = returnPath;
      person.movement = 0;
      person.active = false;
      return;
    }
  }
  completeSleeping(world, person, state);
};

const ensureSleepReturn = (world: World, person: Person): void => {
  const state = person.sleepState!;
  const origin = state.needOrigin;
  if (!state.returningToNeedOrigin || !origin) return;
  if (same(person.position, origin)) {
    completeSleeping(world, person, state);
    return;
  }
  if (person.path.length > 0) {
    person.active = false;
    return;
  }
  const path = findNeedReturnPath(world, person, origin, CONFIG.roadSpeedMultiplier);
  if (!path) {
    completeSleeping(world, person, state);
    return;
  }
  person.path = path;
  person.movement = 0;
  person.active = false;
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
  const origin = { ...person.position };
  const assignedHome = assignedHomeSleepTarget(world, person, origin);
  const localCandidate = assignedHome
    ? undefined
    : chooseLocalSleepTarget(world, person, context, new Set(), origin);
  const anchorReturn = assignedHome || localCandidate
    ? undefined
    : findLocalNeedAnchorReturn(world, person, CONFIG.roadSpeedMultiplier);
  const candidate = assignedHome ?? localCandidate ?? (
    anchorReturn
      ? { kind: "ground" as const, target: anchorReturn.anchor, path: anchorReturn.path, localNeedSearch: false as const }
      : chooseGlobalSleepTarget(world, person, context)
  );
  if (candidate.kind === "ground" && !anchorReturn) clearNavigationBlocked(person);
  if (anchorReturn) clearNavigationBlocked(person);
  person.sleepState = {
    needOrigin: origin,
    localNeedSearch: candidate.localNeedSearch,
    returnToNeedOrigin:
      candidate.localNeedSearch &&
      localNeedPathLeavesWaypostCoverage(world, origin, candidate.path),
    returningToNeedAnchor: Boolean(anchorReturn) || undefined,
    needAnchor: anchorReturn?.anchor,
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

export const startSleepingAfterCompletedAction = (world: World, person: Person): boolean => {
  if (
    person.sleepState ||
    sleepValue(person) > WANTS_TO_SLEEP_THRESHOLD ||
    (person.sleepGraceTicks ?? 0) > 0
  )
    return false;
  startSleeping(world, person, {});
  return true;
};

export const commandSleep = (world: World, personId: number): boolean => {
  const person = world.people.find((candidate) => candidate.id === personId);
  if (person?.ageStage === "child") return false;
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
  const origin = state.needOrigin ?? { ...person.position };
  const replacement = chooseSleepTarget(world, person, context, excludedTargets, origin);
  if (replacement.kind === "ground") clearNavigationBlocked(person);
  state.localNeedSearch = replacement.localNeedSearch;
  state.returnToNeedOrigin =
    replacement.localNeedSearch &&
    localNeedPathLeavesWaypostCoverage(world, origin, replacement.path);
  state.returningToNeedOrigin = undefined;
  state.kind = replacement.kind;
  state.target = { ...replacement.target };
  state.progress = 0;
  state.completedPhases = 0;
  state.recoveryPerPhase = recoveryPerPhase(person, replacement.kind);
  person.path = same(person.position, replacement.target) ? [] : replacement.path;
  person.movement = 0;
};

const continueLocalNeedAnchorReturn = (
  world: World,
  person: Person,
  state: SleepState,
  context: SleepSearchContext,
): void => {
  const anchor = state.needAnchor;
  if (!state.returningToNeedAnchor || !anchor) return;
  if (same(person.position, anchor)) {
    state.returningToNeedAnchor = undefined;
    state.needAnchor = undefined;
    state.needOrigin = { ...person.position };
    applyReplacementTarget(world, person, state, context);
    return;
  }
  if (person.path.length > 0) {
    person.active = false;
    return;
  }
  const path = localRouteTo(world, person, { ...person.position }, anchor);
  if (path) {
    person.path = path;
    person.movement = 0;
    person.active = false;
    return;
  }
  state.returningToNeedAnchor = undefined;
  state.needAnchor = undefined;
  applyReplacementTarget(world, person, state, context);
};

const applySleepPhase = (person: Person, state: SleepState): void => {
  person.sleep = Math.min(SLEEP_MAX, (person.sleep ?? SLEEP_MAX) + state.recoveryPerPhase);
  person.sleepAccumulator = 0;
};

const ensureSleepRouteOrProgress = (world: World, person: Person, context: SleepSearchContext): void => {
  const state = person.sleepState!;
  if (state.returningToNeedOrigin) {
    ensureSleepReturn(world, person);
    return;
  }
  if (state.returningToNeedAnchor) {
    continueLocalNeedAnchorReturn(world, person, state, context);
    return;
  }
  if (person.hungerState) return;
  if (person.path.length > 0) { person.active = false; return; }
  if (!same(person.position, state.target)) {
    if (!targetStillValid(world, state)) { applyReplacementTarget(world, person, state, context); return; }
    const reroute = state.localNeedSearch && state.needOrigin
      ? localRouteTo(world, person, state.needOrigin, state.target)
      : routeTo(world, person, state.target);
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
      if (person.ageStage === "child") continue;
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
