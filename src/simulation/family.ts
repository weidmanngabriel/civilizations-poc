import type {
  BirthPolicy,
  ChildVisualStage,
  FamilyEffect,
  Household,
  Person,
  Sex,
  World,
} from "./model";
import { neighbors, key, tileIndex, walkable } from "./hex";
import { hexDistance, GRID_REFINEMENT } from "./spatial";
import { findRequiredNavigationPath } from "./wayposts";
import { randomFraction, randomInt } from "./random";
import {
  householdForPerson,
  homeForPerson,
  makePersonUnhoused,
  mergeHouseholdsForMarriage,
} from "./housing";
import { SIMULATION_HZ } from "./timing";
import { performanceProfiler } from "../debug/performanceProfiler";

export const CHILDHOOD_TICKS = 5 * 60 * SIMULATION_HZ;
export const BABY_STAGE_TICKS = CHILDHOOD_TICKS / 2;
export const CHILD_WANDER_RADIUS = 4 * GRID_REFINEMENT;
export const BIRTH_COOLDOWN_TICKS = 5 * 60 * SIMULATION_HZ;
const BIRTH_CELEBRATION_TICKS = 3 * SIMULATION_HZ;
const FAMILY_EFFECT_TICKS = 5 * SIMULATION_HZ;
const PARTNER_REPLAN_TICKS = SIMULATION_HZ;
const ROAD_SPEED_MULTIPLIER = 1.3;

export const BIRTH_POLICY_RULES: Record<
  BirthPolicy,
  { intervalTicks: number; chance: number; label: string }
> = {
  low: { intervalTicks: 3 * 60 * SIMULATION_HZ, chance: 0.15, label: "Wenig" },
  medium: { intervalTicks: 2 * 60 * SIMULATION_HZ, chance: 0.3, label: "Mittel" },
  high: { intervalTicks: 1 * 60 * SIMULATION_HZ, chance: 0.5, label: "Viele" },
};

export const isChild = (person: Person): boolean => person.ageStage === "child";
export const isAdult = (person: Person): boolean => !isChild(person);

export const childVisualStage = (
  world: World,
  person: Person,
): ChildVisualStage | undefined => {
  if (!isChild(person) || person.bornAtTick === undefined) return;
  return world.round - person.bornAtTick < BABY_STAGE_TICKS ? "baby" : "child";
};

export const birthCountFromRoll = (roll: number): 1 | 2 | 3 =>
  roll < 0.9 ? 1 : roll < 0.99 ? 2 : 3;

const familyTaskBoundary = (person: Person): boolean =>
  !person.trip &&
  !person.farmTask &&
  !person.outdoorCarry &&
  !person.educationTask &&
  !person.hungerState &&
  !person.sleepState &&
  !person.equipmentTask &&
  !person.scoutWaypostTask &&
  person.progress <= 0 &&
  person.path.length === 0;

export const areCloseRelatives = (first: Person, second: Person): boolean => {
  if ((first.parentIds ?? []).includes(second.id)) return true;
  if ((second.parentIds ?? []).includes(first.id)) return true;
  const firstParents = new Set(first.parentIds ?? []);
  return (second.parentIds ?? []).some((parentId) => firstParents.has(parentId));
};

const oppositeSex = (first: Person, second: Person): boolean =>
  Boolean(first.sex && second.sex && first.sex !== second.sex);

export const canSearchForPartner = (world: World, person: Person): boolean =>
  isAdult(person) &&
  Boolean(person.sex) &&
  !person.spouseId &&
  !person.partnerReservedBy &&
  !person.familyTask &&
  world.people.some(
    (candidate) =>
      candidate.id !== person.id &&
      isAdult(candidate) &&
      !candidate.spouseId &&
      !candidate.partnerReservedBy &&
      !candidate.familyTask &&
      oppositeSex(person, candidate) &&
      !areCloseRelatives(person, candidate),
  );

export function startPartnerSearch(world: World, personId: number): boolean {
  const person = world.people.find((candidate) => candidate.id === personId);
  if (!person || !canSearchForPartner(world, person)) return false;
  person.familyTask = { kind: "partner-search", partnerId: 0 };
  person.idleTarget = undefined;
  return true;
}

export function startPartnerSearchMany(world: World, personIds: readonly number[]): number {
  let started = 0;
  for (const personId of personIds)
    if (startPartnerSearch(world, personId)) started += 1;
  return started;
}

const partnerCandidates = (world: World, seeker: Person): Person[] =>
  world.people
    .filter(
      (candidate) =>
        candidate.id !== seeker.id &&
        isAdult(candidate) &&
        !candidate.spouseId &&
        !candidate.partnerReservedBy &&
        !candidate.familyTask &&
        oppositeSex(seeker, candidate) &&
        !areCloseRelatives(seeker, candidate),
    )
    .map((candidate) => ({ candidate, score: randomFraction(world) }))
    .sort((a, b) => a.score - b.score || a.candidate.id - b.candidate.id)
    .map(({ candidate }) => candidate);

const routeToPartner = (world: World, seeker: Person, partner: Person): boolean => {
  const path = performanceProfiler.withPathReason("family", () =>
    findRequiredNavigationPath(
      world,
      seeker,
      partner.position,
      ROAD_SPEED_MULTIPLIER,
      "destination",
    ),
  );
  if (!path) return false;
  seeker.path = path;
  seeker.movement = 0;
  seeker.active = false;
  return true;
};

const releasePartnerReservation = (world: World, seeker: Person): void => {
  const targetId = seeker.familyTask?.kind === "partner-search"
    ? seeker.familyTask.partnerId
    : undefined;
  if (!targetId) return;
  const target = world.people.find((candidate) => candidate.id === targetId);
  if (target?.partnerReservedBy === seeker.id) target.partnerReservedBy = undefined;
};

const choosePartner = (world: World, seeker: Person): boolean => {
  for (const candidate of partnerCandidates(world, seeker)) {
    if (!routeToPartner(world, seeker, candidate)) continue;
    candidate.partnerReservedBy = seeker.id;
    seeker.familyTask = { kind: "partner-search", partnerId: candidate.id };
    return true;
  }
  seeker.familyTask = undefined;
  return false;
};

const marry = (world: World, first: Person, second: Person): void => {
  releasePartnerReservation(world, first);
  releasePartnerReservation(world, second);
  first.partnerReservedBy = undefined;
  second.partnerReservedBy = undefined;
  first.familyTask = undefined;
  second.familyTask = undefined;
  first.spouseId = second.id;
  second.spouseId = first.id;
  first.path = [];
  second.path = [];
  first.movement = 0;
  second.movement = 0;
  first.active = false;
  second.active = false;

  const firstHousehold = householdForPerson(world, first);
  const secondHousehold = householdForPerson(world, second);
  const preferred =
    firstHousehold && secondHousehold && firstHousehold.id !== secondHousehold.id
      ? randomFraction(world) < 0.5
        ? firstHousehold.id
        : secondHousehold.id
      : undefined;
  const household = mergeHouseholdsForMarriage(world, first, second, preferred);
  if (household)
    household.nextBirthCheckTick =
      world.round + BIRTH_POLICY_RULES[world.birthPolicy ?? "medium"].intervalTicks;
};

const advancePartnerSearch = (world: World, person: Person): void => {
  const task = person.familyTask;
  if (task?.kind !== "partner-search") return;
  if (person.hungerState || person.sleepState) return;

  if (person.spouseId || !isAdult(person)) {
    releasePartnerReservation(world, person);
    person.familyTask = undefined;
    return;
  }

  if (task.partnerId === 0) {
    if (!familyTaskBoundary({ ...person, familyTask: undefined })) return;
    choosePartner(world, person);
    return;
  }

  const partner = world.people.find((candidate) => candidate.id === task.partnerId);
  if (
    !partner ||
    partner.spouseId ||
    partner.partnerReservedBy !== person.id ||
    !isAdult(partner) ||
    !oppositeSex(person, partner) ||
    areCloseRelatives(person, partner)
  ) {
    releasePartnerReservation(world, person);
    person.familyTask = { kind: "partner-search", partnerId: 0 };
    person.path = [];
    return;
  }

  if (hexDistance(person.position, partner.position) <= 1) {
    marry(world, person, partner);
    return;
  }

  if (
    person.path.length === 0 ||
    world.round % PARTNER_REPLAN_TICKS === 0
  ) {
    if (!routeToPartner(world, person, partner)) {
      releasePartnerReservation(world, person);
      person.familyTask = { kind: "partner-search", partnerId: 0 };
      person.path = [];
    }
  }
};

const coupleForHousehold = (
  world: World,
  household: Household,
): [Person, Person] | undefined => {
  const adults = household.memberIds
    .map((id) => world.people.find((person) => person.id === id))
    .filter((person): person is Person => Boolean(person && isAdult(person)));
  for (const first of adults) {
    if (!first.spouseId) continue;
    const second = adults.find((candidate) => candidate.id === first.spouseId);
    if (
      second &&
      second.spouseId === first.id &&
      oppositeSex(first, second)
    )
      return first.id < second.id ? [first, second] : [second, first];
  }
  return;
};

const coupleReadyForBirthJourney = (first: Person, second: Person): boolean =>
  !first.familyTask &&
  !second.familyTask &&
  familyTaskBoundary(first) &&
  familyTaskBoundary(second);

const routeParentHome = (world: World, person: Person, household: Household): boolean => {
  const home = world.buildings.find(
    (building) => building.id === household.homeId && !building.retired,
  );
  if (!home) return false;
  if (hexDistance(person.position, home.position) === 0) {
    person.path = [];
    return true;
  }
  const path = performanceProfiler.withPathReason("family", () =>
    findRequiredNavigationPath(
      world,
      person,
      home.position,
      ROAD_SPEED_MULTIPLIER,
      "destination",
    ),
  );
  if (!path) return false;
  person.path = path;
  person.movement = 0;
  person.active = false;
  return true;
};

const startBirthJourney = (
  world: World,
  household: Household,
  first: Person,
  second: Person,
): boolean => {
  if (!routeParentHome(world, first, household)) return false;
  if (!routeParentHome(world, second, household)) {
    first.path = [];
    return false;
  }
  first.familyTask = { kind: "birth", partnerId: second.id, homeId: household.homeId };
  second.familyTask = { kind: "birth", partnerId: first.id, homeId: household.homeId };
  first.idleTarget = undefined;
  second.idleTarget = undefined;
  return true;
};

const scheduleNextBirthCheck = (world: World, household: Household): void => {
  household.nextBirthCheckTick =
    world.round + BIRTH_POLICY_RULES[world.birthPolicy ?? "medium"].intervalTicks;
};

const checkAutonomousBirths = (world: World): void => {
  const rule = BIRTH_POLICY_RULES[world.birthPolicy ?? "medium"];
  for (const household of world.households ?? []) {
    const couple = coupleForHousehold(world, household);
    if (!couple) continue;

    household.nextBirthCheckTick ??= world.round + rule.intervalTicks;
    if (world.round < household.nextBirthCheckTick) continue;

    const cooldownUntil = (household.lastBirthTick ?? -BIRTH_COOLDOWN_TICKS) + BIRTH_COOLDOWN_TICKS;
    if (world.round < cooldownUntil) {
      household.nextBirthCheckTick = cooldownUntil;
      continue;
    }

    scheduleNextBirthCheck(world, household);
    if (randomFraction(world) >= rule.chance) continue;
    const [first, second] = couple;
    if (!coupleReadyForBirthJourney(first, second)) continue;
    startBirthJourney(world, household, first, second);
  }
};

const nextFamilyEffectId = (world: World): string => {
  world.nextFamilyEffectId ??= 1;
  return `family-effect-${world.nextFamilyEffectId++}`;
};

const startBirthCelebration = (
  world: World,
  household: Household,
  first: Person,
  second: Person,
): void => {
  const birthAtTick = world.round + BIRTH_CELEBRATION_TICKS;
  first.familyTask!.completeAtTick = birthAtTick;
  second.familyTask!.completeAtTick = birthAtTick;
  const effect: FamilyEffect = {
    id: nextFamilyEffectId(world),
    kind: "birth",
    homeId: household.homeId,
    startedAtTick: world.round,
    birthAtTick,
    expiresAtTick: birthAtTick + FAMILY_EFFECT_TICKS,
  };
  (world.familyEffects ??= []).push(effect);
};

const createChild = (
  world: World,
  household: Household,
  first: Person,
  second: Person,
): Person => {
  const home = homeForPerson(world, first) ?? homeForPerson(world, second);
  const sex: Sex = randomFraction(world) < 0.5 ? "male" : "female";
  const child: Person = {
    id: world.nextId++,
    position: { ...(home?.position ?? first.position) },
    sex,
    ageStage: "child",
    bornAtTick: world.round,
    parentIds: [first.id, second.id],
    childIds: [],
    householdId: household.id,
    active: false,
    progress: 0,
    movement: 0,
    path: [],
  };
  world.people.push(child);
  household.memberIds.push(child.id);
  (first.childIds ??= []).push(child.id);
  (second.childIds ??= []).push(child.id);
  return child;
};

const completeBirth = (
  world: World,
  household: Household,
  first: Person,
  second: Person,
): void => {
  const count = birthCountFromRoll(randomFraction(world));
  for (let index = 0; index < count; index += 1)
    createChild(world, household, first, second);

  household.lastBirthTick = world.round;
  household.nextBirthCheckTick = world.round + BIRTH_COOLDOWN_TICKS;
  first.familyTask = undefined;
  second.familyTask = undefined;
  first.active = false;
  second.active = false;
};

const advanceBirthTasks = (world: World): void => {
  for (const first of world.people) {
    const task = first.familyTask;
    if (task?.kind !== "birth" || first.id > task.partnerId) continue;
    const second = world.people.find((candidate) => candidate.id === task.partnerId);
    const household = householdForPerson(world, first);
    if (
      !second ||
      second.familyTask?.kind !== "birth" ||
      second.spouseId !== first.id ||
      first.spouseId !== second.id ||
      !household ||
      household.id !== second.householdId ||
      task.homeId !== household.homeId
    ) {
      first.familyTask = undefined;
      if (second?.familyTask?.partnerId === first.id) second.familyTask = undefined;
      continue;
    }

    if (first.hungerState || first.sleepState || second.hungerState || second.sleepState)
      continue;

    const home = world.buildings.find(
      (building) => building.id === household.homeId && !building.retired,
    );
    if (!home) {
      first.familyTask = undefined;
      second.familyTask = undefined;
      continue;
    }

    const firstHome = hexDistance(first.position, home.position) === 0;
    const secondHome = hexDistance(second.position, home.position) === 0;
    if (!firstHome && first.path.length === 0) routeParentHome(world, first, household);
    if (!secondHome && second.path.length === 0) routeParentHome(world, second, household);
    if (!firstHome || !secondHome) continue;

    first.path = [];
    second.path = [];
    if (task.completeAtTick === undefined) {
      startBirthCelebration(world, household, first, second);
      continue;
    }
    if (world.round >= task.completeAtTick)
      completeBirth(world, household, first, second);
  }
};

const childAnchor = (world: World, child: Person): { q: number; r: number } => {
  const home = homeForPerson(world, child);
  if (home) return home.position;
  const parent = (child.parentIds ?? [])
    .map((id) => world.people.find((person) => person.id === id))
    .find(Boolean);
  return parent?.position ?? child.position;
};

const chooseChildStep = (world: World, child: Person): void => {
  const anchor = childAnchor(world, child);
  const tiles = tileIndex(world.tiles);
  const options = neighbors(child.position).filter((candidate) => {
    const tile = tiles.get(key(candidate));
    return Boolean(
      tile &&
      walkable(tile) &&
      hexDistance(anchor, candidate) <= CHILD_WANDER_RADIUS,
    );
  });
  if (!options.length) return;
  const target = options[randomInt(world, 0, options.length - 1)]!;
  child.path = [{ ...target }];
  child.movement = 0;
  const stage = childVisualStage(world, child);
  child.nextChildWanderTick =
    world.round + randomInt(
      world,
      stage === "baby" ? 2 * SIMULATION_HZ : SIMULATION_HZ,
      stage === "baby" ? 4 * SIMULATION_HZ : 3 * SIMULATION_HZ,
    );
};

const makeAdult = (world: World, child: Person): void => {
  makePersonUnhoused(world, child.id);
  child.ageStage = "adult";
  child.bornAtTick = undefined;
  child.nextChildWanderTick = undefined;
  child.path = [];
  child.movement = 0;
  child.active = false;
  child.hunger = 100;
  child.hungerAccumulator = 0;
  child.sleep = 100;
  child.sleepAccumulator = 0;
  child.sleepGraceTicks = 0;
};

const advanceChildren = (world: World): void => {
  for (const child of [...world.people]) {
    if (!isChild(child) || child.bornAtTick === undefined) continue;
    if (world.round - child.bornAtTick >= CHILDHOOD_TICKS) {
      makeAdult(world, child);
      continue;
    }
    if (child.path.length) continue;
    if ((child.nextChildWanderTick ?? 0) > world.round) continue;
    chooseChildStep(world, child);
  }
};

export function setBirthPolicy(world: World, policy: BirthPolicy): void {
  world.birthPolicy = policy;
  const interval = BIRTH_POLICY_RULES[policy].intervalTicks;
  for (const household of world.households ?? []) {
    const cooldownUntil = (household.lastBirthTick ?? -BIRTH_COOLDOWN_TICKS) + BIRTH_COOLDOWN_TICKS;
    household.nextBirthCheckTick = Math.max(world.round + interval, cooldownUntil);
  }
}

export function advanceFamily(world: World): void {
  world.birthPolicy ??= "medium";
  world.familyEffects = (world.familyEffects ?? []).filter(
    (effect) => effect.expiresAtTick > world.round,
  );

  for (const person of world.people)
    if (person.familyTask?.kind === "partner-search")
      advancePartnerSearch(world, person);

  advanceBirthTasks(world);
  checkAutonomousBirths(world);
  advanceChildren(world);
}
