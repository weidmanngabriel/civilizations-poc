export * from "./simulationCoreEngine";

import type {
  Building,
  NaturalResource,
  NaturalResourceKind,
  Person,
  World,
} from "./model";
import { hexDistance } from "./spatial";
import {
  assigned,
  building,
  builders,
  changeBuilders as changeBuildersNow,
  changeExtractors as changeExtractorsNow,
  changeWoodcutters as changeWoodcuttersNow,
  isUnderConstruction,
  resourceWorkers,
  tick as tickNow,
  woodcutters,
} from "./simulationCoreEngine";

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
      continue;
    }

    if (plan.kind === "extractor") {
      if (person.extractor !== plan.resourceKind) continue;
      person.extractor = undefined;
      person.resourceTarget = undefined;
      movePersonFirst(world, person, () =>
        changeExtractorsNow(world, plan.resourceKind, 1),
      );
      continue;
    }

    if (!person.builder) continue;
    person.builder = undefined;
    person.assignment = undefined;
    movePersonFirst(world, person, () => changeBuildersNow(world, 1));
  }
}

export function changeWoodcutters(world: World, delta: 1 | -1): boolean {
  if (delta === -1) return changeWoodcuttersNow(world, -1);
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
  if (delta === -1) return changeExtractorsNow(world, kind, -1);
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

/** Flushes UI-triggered autonomous profession planning inside the simulation step. */
export function tick(world: World): void {
  flushPendingPlans(world);
  tickNow(world);
}

export { building, builders, woodcutters };
