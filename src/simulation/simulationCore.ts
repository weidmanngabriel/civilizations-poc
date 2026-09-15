export * from "./simulationCoreEngine";

import type {
  Building,
  BuildingId,
  NaturalResource,
  NaturalResourceKind,
  Person,
  Role,
  World,
} from "./model";
import { CONFIG } from "./scenario";
import { extractionSpeedMultiplier } from "./experience";
import { hexDistance } from "./spatial";
import {
  assigned,
  building,
  builders,
  changeAssignment as changeAssignmentNow,
  changeBuilders as changeBuildersNow,
  changeExtractors as changeExtractorsNow,
  changeWoodcutters as changeWoodcuttersNow,
  isUnderConstruction,
  resourceWorkers,
  status as statusNow,
  tick as tickNow,
  woodcutters,
} from "./simulationCoreEngine";
import {
  clearWorkArea,
  ensureWorkArea,
  setWorkAreaCenter,
  supportsWorkArea,
  syncWorkAreas,
  WORK_AREA_RADIUS,
  WORK_AREA_RADIUS_WORLD_TILES,
  workAreaContains,
} from "./workAreas";

type ExtractorKind = "clay" | "stone";
type PendingPlan =
  | { kind: "woodcutter"; person: Person }
  | { kind: "extractor"; person: Person; resourceKind: ExtractorKind }
  | { kind: "builder"; person: Person };

const pendingPlans = new WeakMap<World, PendingPlan[]>();

const samePosition = (a: { q: number; r: number }, b: { q: number; r: number }): boolean =>
  a.q === b.q && a.r === b.r;

const freePerson = (world: World): Person | undefined =>
  world.people.find(
    (candidate) =>
      !candidate.assignment &&
      !candidate.woodcutter &&
      !candidate.extractor &&
      !candidate.builder,
  );

function queuePlan(world: World, plan: PendingPlan): void {
  const queue = pendingPlans.get(world) ?? [];
  queue.push(plan);
  pendingPlans.set(world, queue);
}

function movePersonFirst<T>(world: World, person: Person, run: () => T): T {
  const index = world.people.indexOf(person);
  if (index <= 0) return run();
  world.people.splice(index, 1);
  world.people.unshift(person);
  try {
    return run();
  } finally {
    world.people.shift();
    world.people.splice(index, 0, person);
  }
}

function nearestUnclaimedResource(
  world: World,
  person: Person,
  kind: NaturalResourceKind,
): NaturalResource | undefined {
  return world.naturalResources
    .filter(
      (resource) =>
        resource.kind === kind &&
        !resource.depleted &&
        resource.remaining > 0 &&
        resourceWorkers(world, resource.id).length === 0,
    )
    .sort(
      (a, b) =>
        hexDistance(person.position, a.position) - hexDistance(person.position, b.position) ||
        a.position.q - b.position.q ||
        a.position.r - b.position.r ||
        a.id.localeCompare(b.id),
    )[0];
}

function nearestOpenConstructionSite(world: World, person: Person): Building | undefined {
  return world.buildings
    .filter(
      (site) =>
        !site.retired &&
        isUnderConstruction(site) &&
        assigned(world, site.id, "builder").length < 2,
    )
    .sort(
      (a, b) =>
        hexDistance(person.position, a.position) - hexDistance(person.position, b.position) ||
        a.position.q - b.position.q ||
        a.position.r - b.position.r ||
        a.id.localeCompare(b.id),
    )[0];
}

function initializeNaturalWorkArea(world: World, person: Person): void {
  const target = person.resourceTarget
    ? world.naturalResources.find((resource) => resource.id === person.resourceTarget)
    : undefined;
  ensureWorkArea(world, person, target?.position ?? person.position);
}

function flushPendingPlans(world: World): void {
  const queue = pendingPlans.get(world);
  if (!queue?.length) return;
  pendingPlans.delete(world);

  for (const plan of queue) {
    const person = plan.person;
    if (!world.people.includes(person)) continue;

    if (plan.kind === "woodcutter") {
      if (!person.woodcutter) continue;
      person.woodcutter = undefined;
      person.resourceTarget = undefined;
      movePersonFirst(world, person, () => changeWoodcuttersNow(world, 1));
      initializeNaturalWorkArea(world, person);
      continue;
    }

    if (plan.kind === "extractor") {
      if (person.extractor !== plan.resourceKind) continue;
      person.extractor = undefined;
      person.resourceTarget = undefined;
      movePersonFirst(world, person, () =>
        changeExtractorsNow(world, plan.resourceKind, 1),
      );
      initializeNaturalWorkArea(world, person);
      continue;
    }

    if (!person.builder) continue;
    person.builder = undefined;
    person.assignment = undefined;
    movePersonFirst(world, person, () => changeBuildersNow(world, 1));
  }
}

export function changeAssignment(
  world: World,
  id: BuildingId,
  role: Role,
  delta: 1 | -1,
): boolean {
  const before = assigned(world, id, role).slice();
  const changed = changeAssignmentNow(world, id, role, delta);
  if (!changed || role !== "carrier") return changed;
  const target = building(world, id);
  const localStorageCarrier = target.kind === "warehouse" || target.kind === "hq";
  const after = assigned(world, id, role);
  if (delta === 1) {
    const person = after.find((candidate) => !before.includes(candidate));
    if (person && localStorageCarrier) ensureWorkArea(world, person, target.position);
  } else {
    const person = before.find((candidate) => !after.includes(candidate));
    if (person) clearWorkArea(person);
  }
  return true;
}

export function changeWoodcutters(world: World, delta: 1 | -1): boolean {
  if (delta === -1) {
    const before = woodcutters(world).slice();
    const changed = changeWoodcuttersNow(world, -1);
    if (changed) {
      const removed = before.find((person) => !person.woodcutter);
      if (removed) clearWorkArea(removed);
    }
    return changed;
  }
  const person = freePerson(world);
  if (!person) return false;

  person.woodcutter = true;
  const target = nearestUnclaimedResource(world, person, "forest");
  person.resourceTarget = target?.id;
  person.active = Boolean(target && samePosition(person.position, target.position));
  person.movement = 0;
  person.path = [];
  queuePlan(world, { kind: "woodcutter", person });
  return true;
}

export function changeExtractors(
  world: World,
  kind: ExtractorKind,
  delta: 1 | -1,
): boolean {
  if (delta === -1) {
    const before = world.people.filter((person) => person.extractor === kind);
    const changed = changeExtractorsNow(world, kind, -1);
    if (changed) {
      const removed = before.find((person) => person.extractor !== kind);
      if (removed) clearWorkArea(removed);
    }
    return changed;
  }
  const person = freePerson(world);
  if (!person) return false;

  person.extractor = kind;
  const target = nearestUnclaimedResource(world, person, kind);
  person.resourceTarget = target?.id;
  person.active = Boolean(target && samePosition(person.position, target.position));
  person.movement = 0;
  person.path = [];
  queuePlan(world, { kind: "extractor", person, resourceKind: kind });
  return true;
}

export function changeBuilders(world: World, delta: 1 | -1): boolean {
  if (delta === -1) return changeBuildersNow(world, -1);
  const person = freePerson(world);
  if (!person) return false;

  person.builder = true;
  const site = nearestOpenConstructionSite(world, person);
  person.assignment = site ? { building: site.id, role: "builder" } : undefined;
  person.active = Boolean(site && samePosition(person.position, site.position));
  person.movement = 0;
  person.path = [];
  queuePlan(world, { kind: "builder", person });
  return true;
}

export function notifyConstructionSiteAdded(world: World): void {
  for (const person of builders(world)) {
    if (person.assignment) continue;
    const site = nearestOpenConstructionSite(world, person);
    if (!site) continue;
    person.assignment = { building: site.id, role: "builder" };
    person.active = samePosition(person.position, site.position);
    person.movement = 0;
    person.path = [];
    const alreadyQueued = (pendingPlans.get(world) ?? []).some(
      (plan) => plan.kind === "builder" && plan.person === person,
    );
    if (!alreadyQueued) queuePlan(world, { kind: "builder", person });
  }
}

export function status(world: World, target: Building): string {
  if ((target.kind === "warehouse" || target.kind === "hq") && !isUnderConstruction(target)) {
    const carriers = assigned(world, target.id, "carrier").length;
    const merchants = assigned(world, target.id, "merchant").length;
    if (!merchants && carriers)
      return `Träger sammeln Waren nur innerhalb ihrer Arbeitsflagge (${WORK_AREA_RADIUS_WORLD_TILES} Weltkacheln Radius)`;
  }
  return statusNow(world, target);
}

function legacyResourcePlanningGuard(world: World): Set<number> {
  const guarded = new Set<number>();
  for (const person of world.people) {
    if (!person.workArea || (!person.woodcutter && !person.extractor)) continue;
    if (!person.resourceTarget) {
      guarded.add(person.id);
      continue;
    }
    if (
      !person.active ||
      person.path.length ||
      person.trip ||
      person.farmTask ||
      person.hungerState ||
      person.sleepState ||
      person.progress <= 0
    ) continue;
    const resource = world.naturalResources.find(
      (candidate) => candidate.id === person.resourceTarget,
    );
    if (
      !resource ||
      resource.depleted ||
      resource.remaining !== 1 ||
      !samePosition(person.position, resource.position)
    ) continue;
    const profession =
      resource.kind === "forest"
        ? "woodcutter"
        : resource.kind === "clay"
          ? "clayDigger"
          : "stonecutter";
    if (person.progress + extractionSpeedMultiplier(person, profession) >= CONFIG.duration)
      guarded.add(person.id);
  }
  return guarded;
}

/**
 * The historical engine still tries global extractor planning during resource cleanup
 * and one-second idle retries. Local work areas own that decision now. The adapter
 * suppresses only those legacy decisions after the needs check has run, then restores
 * the real hunger values before local work-area planning.
 */
function tickWithoutLegacyGlobalResourcePlanning(world: World): void {
  const guardedIds = legacyResourcePlanningGuard(world);
  if (!guardedIds.size) {
    tickNow(world);
    return;
  }

  const originalHunger = new Map<number, number | undefined>();
  const tickWorld = new Proxy(world, {
    set(target, property, value, receiver) {
      const changed = Reflect.set(target, property, value, receiver);
      if (!changed || property !== "round" || typeof value !== "number") return changed;
      for (const id of guardedIds) {
        const person = world.people.find((candidate) => candidate.id === id);
        if (!person || person.hungerState || (person.hunger ?? 100) <= 40) continue;
        if (!originalHunger.has(id)) originalHunger.set(id, person.hunger);
        person.hunger = 40;
      }
      return changed;
    },
  });

  try {
    tickNow(tickWorld);
  } finally {
    for (const [id, hunger] of originalHunger) {
      const person = world.people.find((candidate) => candidate.id === id);
      if (person) person.hunger = hunger;
    }
  }
}

/** Flushes UI-triggered autonomous profession planning inside the simulation step. */
export function tick(world: World): void {
  flushPendingPlans(world);
  syncWorkAreas(world);
  tickWithoutLegacyGlobalResourcePlanning(world);
  syncWorkAreas(world);
}

export {
  building,
  builders,
  clearWorkArea,
  ensureWorkArea,
  setWorkAreaCenter,
  supportsWorkArea,
  WORK_AREA_RADIUS,
  WORK_AREA_RADIUS_WORLD_TILES,
  woodcutters,
  workAreaContains,
};
