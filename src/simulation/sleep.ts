import type { Building, Hex, Person, SleepLocationKind, SleepState, World } from "./model";
import { findPath, findPathBySteps, pathTravelCost, same } from "./hex";
import { CONFIG } from "./scenario";
import { performanceNow, performanceProfiler } from "../debug/performanceProfiler";

const SLEEP_MAX = 100;
const WANTS_TO_SLEEP_THRESHOLD = 40;
const CRITICAL_SLEEP_THRESHOLD = 20;
const SLEEP_RADIUS_STEPS = 8;
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
  if (person.trip?.picked) return 2;
  if (person.progress > 0 || (person.farmTask && person.path.length === 0)) return 2;
  if (person.path.length > 0) return 4;
  return 8;
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
    findPath(world.tiles, person.position, target, CONFIG.roadSpeedMultiplier),
  ) ?? undefined;

const isCompletedHouse = (building: Building): boolean =>
  building.kind === "house" &&
  !building.retired &&
  (!building.construction || building.construction.complete);

const withinSleepRadius = (world: World, origin: Hex, target: Hex): boolean => {
  const path = performanceProfiler.withPathReason("sleep", () =>
    findPathBySteps(world.tiles, origin, target),
  );
  return Boolean(path && path.length <= SLEEP_RADIUS_STEPS);
};

type SleepCandidate = {
  kind: Exclude<SleepLocationKind, "ground">;
  target: Hex;
  path: Hex[];
  cost: number;
};

const bestCandidate = (
  world: World,
  person: Person,
  kind: "house" | "nature",
): SleepCandidate | undefined => {
  const targets: Hex[] = kind === "house"
    ? world.buildings.filter(isCompletedHouse).map((building) => building.position)
    : world.tiles
        .filter((tile) => tile.terrain === "forest" || (tile.terrain === "grass" && tile.bush))
        .map((tile) => ({ q: tile.q, r: tile.r }));

  const candidates = targets
    .filter((target) => withinSleepRadius(world, person.position, target))
    .map((target) => {
      const path = routeTo(world, person, target);
      if (!path) return undefined;
      return {
        kind,
        target,
        path,
        cost: pathTravelCost(world.tiles, path, CONFIG.roadSpeedMultiplier),
      } as SleepCandidate;
    })
    .filter((candidate): candidate is SleepCandidate => Boolean(candidate));

  candidates.sort(
    (a, b) => a.cost - b.cost || a.target.r - b.target.r || a.target.q - b.target.q,
  );
  return candidates[0];
};

const chooseSleepTarget = (world: World, person: Person): SleepCandidate | {
  kind: "ground";
  target: Hex;
  path: Hex[];
} =>
  bestCandidate(world, person, "house") ??
  bestCandidate(world, person, "nature") ?? {
    kind: "ground",
    target: { ...person.position },
    path: [],
  };

const targetStillValid = (world: World, state: SleepState): boolean => {
  if (state.kind === "ground") return true;
  if (state.kind === "house")
    return world.buildings.some(
      (building) => isCompletedHouse(building) && same(building.position, state.target),
    );
  const tile = world.tiles.find((candidate) => same(candidate, state.target));
  return Boolean(
    tile && (tile.terrain === "forest" || (tile.terrain === "grass" && tile.bush)),
  );
};

const atTaskBoundary = (person: Person): boolean =>
  person.progress === 0 &&
  !person.farmTask &&
  !person.trip &&
  person.path.length === 0;

const currentTaskTarget = (world: World, person: Person): Hex | undefined => {
  if (person.farmTask) return person.farmTask.target;
  if (person.trip) {
    const buildingId = person.trip.picked ? person.trip.target : person.trip.source;
    return world.buildings.find((building) => building.id === buildingId)?.position;
  }
  if (person.assignment)
    return world.buildings.find((building) => building.id === person.assignment!.building)?.position;
  return world.buildings.find((building) => building.id === "hq")?.position;
};

const resumeTask = (world: World, person: Person, state: SleepState): void => {
  const workplaceStillExists = state.resumeAssignment
    ? world.buildings.some(
        (building) => building.id === state.resumeAssignment!.building && !building.retired,
      )
    : false;
  person.assignment = workplaceStillExists && state.resumeAssignment
    ? { ...state.resumeAssignment }
    : undefined;
  person.builder = state.resumeBuilder || undefined;
  person.woodcutter = state.resumeWoodcutter || undefined;
  person.active = false;
  person.movement = 0;
  const target = currentTaskTarget(world, person);
  if (!target) {
    person.path = [];
    return;
  }
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

const recoveryPerPhase = (person: Person, kind: SleepLocationKind): number => {
  if (kind === "house") return Math.max(0, (SLEEP_MAX - (person.sleep ?? SLEEP_MAX)) / 2);
  if (kind === "nature") return 20;
  return 10;
};

const startSleeping = (world: World, person: Person): void => {
  const candidate = chooseSleepTarget(world, person);
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
  };
  person.assignment = undefined;
  person.builder = undefined;
  person.woodcutter = undefined;
  person.active = false;
  person.movement = 0;
  person.path = same(person.position, candidate.target) ? [] : candidate.path;
};

const applyReplacementTarget = (world: World, person: Person, state: SleepState): void => {
  const replacement = chooseSleepTarget(world, person);
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

const ensureSleepRouteOrProgress = (world: World, person: Person): void => {
  const state = person.sleepState!;
  if (person.hungerState) return;

  // A selected route is trusted while travelling. Revalidation happens only after arrival
  // (or if the route disappeared before reaching the stored target).
  if (person.path.length > 0) {
    person.active = false;
    return;
  }

  if (!same(person.position, state.target)) {
    if (!targetStillValid(world, state)) {
      applyReplacementTarget(world, person, state);
      return;
    }
    const reroute = routeTo(world, person, state.target);
    if (!reroute) applyReplacementTarget(world, person, state);
    else person.path = reroute;
    person.movement = 0;
    person.active = false;
    return;
  }

  if (state.progress === 0 && state.completedPhases === 0 && !targetStillValid(world, state)) {
    applyReplacementTarget(world, person, state);
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
  try {
    for (const person of world.people) {
      sleepValue(person);
      if (person.sleepGraceTicks! > 0) person.sleepGraceTicks!--;

      if (person.sleepState) {
        ensureSleepRouteOrProgress(world, person);
        continue;
      }

      decaySleep(person);

      if (person.hungerState || (person.hunger ?? 100) <= 40) continue;
      if (person.sleepGraceTicks! > 0) continue;

      if (person.sleep! <= CRITICAL_SLEEP_THRESHOLD) {
        startSleeping(world, person);
        continue;
      }

      if (person.sleep! <= WANTS_TO_SLEEP_THRESHOLD && atTaskBoundary(person))
        startSleeping(world, person);
    }
  } finally {
    performanceProfiler.recordFeature("sleep", performanceNow() - started);
  }
}

export function attachSleep(world: World): World {
  return new Proxy(world, {
    set(target, property, value, receiver) {
      if (
        property === "round" &&
        typeof value === "number" &&
        value === target.round + 1
      )
        advanceSleepTick(receiver as World);
      return Reflect.set(target, property, value, receiver);
    },
  });
}

export const sleepStatus = (person: Person): "normal" | "tired" | "critical" => {
  const sleep = person.sleep ?? SLEEP_MAX;
  if (sleep <= CRITICAL_SLEEP_THRESHOLD) return "critical";
  if (sleep <= WANTS_TO_SLEEP_THRESHOLD) return "tired";
  return "normal";
};

export const SLEEP_RULES = {
  radiusSteps: SLEEP_RADIUS_STEPS,
  phaseTicks: SLEEP_PHASE_TICKS,
  durationTicks: SLEEP_DURATION_TICKS,
  natureRecovery: 40,
  groundRecovery: 20,
} as const;
