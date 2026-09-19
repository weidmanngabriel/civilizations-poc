import type { Animal, AnimalKind, Good, Person, World } from "./model";
import { findPath, same } from "./hex";
import { awardProfessionExperience, professionExperience } from "./experience";
import { CONFIG } from "./scenario";
import { GRID_REFINEMENT, hexDistance } from "./spatial";
import {
  HUNTER_WORK_AREA_RADIUS,
  ensureWorkArea,
  routeOutdoorCarryToFlag,
  workAreaContains,
} from "./workAreas";
import { clearNavigationBlocked } from "./wayposts";
import {
  findLooseGoodDropPosition,
  looseGoodStack,
  pickupReservedLooseGood,
  placeLooseGood,
  releaseLooseGoodReservation,
  reserveLooseGood,
} from "./looseGoods";
import {
  advanceRangedCombat,
  fireRangedAttack,
  type RangedAttackProfile,
  type RangedImpact,
} from "./rangedCombat";
import {
  animalIsFleeing,
  frightenAnimalGroup,
  removeAnimal,
} from "./wildlife";

const HUNTER_BOW_RANGE = 2 * GRID_REFINEMENT;
const HUNTER_AIM_TICKS = 2 * CONFIG.simulationHz;
const HUNTER_LOOT_PICKUP_TICKS = 1 * CONFIG.simulationHz;
const HUNTER_ARROW_GROUND_TICKS = 10 * CONFIG.simulationHz;

const HUNTER_BOW: RangedAttackProfile = {
  projectileKind: "arrow",
  flightTicks: Math.round(0.45 * CONFIG.simulationHz),
  cooldownTicks: Math.round(1.5 * CONFIG.simulationHz),
  range: HUNTER_BOW_RANGE,
  impactLifetimeTicks: HUNTER_ARROW_GROUND_TICKS,
};

export function hunterHitChance(person: Person, targetFleeing: boolean): number {
  const base = 0.2 + 0.75 * professionExperience(person, "hunter") / 100;
  return targetFleeing ? base * 0.5 : base;
}

const animals = (world: World): Animal[] => world.animals ?? [];

const HUNT_DROPS: Record<AnimalKind, readonly Good[]> = {
  hare: ["meat"],
  boar: ["meat", "leather"],
};

const hunterInterrupted = (person: Person): boolean =>
  Boolean(
    person.hungerState ||
    person.sleepState ||
    person.manualMoveTarget ||
    person.trip,
  );

const clearAim = (hunter: Person): void => {
  hunter.huntAimTarget = undefined;
  hunter.huntAimUntilTick = undefined;
};

const targetForHunter = (world: World, hunter: Person): Animal | undefined => {
  const area = hunter.workArea;
  if (!area) return undefined;
  const current = hunter.huntTarget
    ? animals(world).find((animal) => animal.id === hunter.huntTarget)
    : undefined;
  if (current) return current;

  const target = animals(world)
    .filter((animal) => workAreaContains(hunter, animal.position))
    .sort(
      (a, b) =>
        hexDistance(hunter.position, a.position) - hexDistance(hunter.position, b.position) ||
        a.id.localeCompare(b.id),
    )[0];
  hunter.huntTarget = target?.id;
  if (target) {
    hunter.idleTarget = undefined;
    hunter.path = [];
    hunter.movement = 0;
    hunter.active = false;
  }
  return target;
};

const routeIntoRange = (world: World, hunter: Person, target: Animal): void => {
  const path = findPath(world.tiles, hunter.position, target.position, CONFIG.roadSpeedMultiplier);
  clearNavigationBlocked(hunter);
  if (!path) {
    hunter.huntTarget = undefined;
    hunter.path = [];
    hunter.active = false;
    return;
  }
  const travelSteps = Math.max(0, path.length - HUNTER_BOW.range);
  hunter.path = path.slice(0, travelSteps);
  hunter.movement = 0;
  hunter.active = travelSteps === 0;
};

const abandonLoot = (world: World, hunter: Person): void => {
  if (hunter.huntLootTarget)
    releaseLooseGoodReservation(world, hunter.huntLootTarget, 1);
  for (const targetId of hunter.huntLootQueue ?? [])
    releaseLooseGoodReservation(world, targetId, 1);
  hunter.huntLootTarget = undefined;
  hunter.huntLootQueue = undefined;
  hunter.huntLootPickupUntilTick = undefined;
};

const activateNextLootTarget = (hunter: Person): boolean => {
  const [next, ...rest] = hunter.huntLootQueue ?? [];
  hunter.huntLootQueue = rest.length ? rest : undefined;
  hunter.huntLootTarget = next;
  hunter.huntLootPickupUntilTick = undefined;
  return Boolean(next);
};

function collectHuntLoot(world: World, hunter: Person): void {
  const targetId = hunter.huntLootTarget;
  if (!targetId) return;
  const stack = looseGoodStack(world, targetId);
  if (!stack || stack.amount < 1 || stack.reserved < 1) {
    hunter.huntLootTarget = undefined;
    hunter.huntLootPickupUntilTick = undefined;
    hunter.path = [];
    hunter.active = false;
    return;
  }

  if (hunter.path.length) {
    hunter.active = false;
    return;
  }

  if (!same(hunter.position, stack.position)) {
    const retryAfter = hunter.workArea?.retryAfterTick;
    if (retryAfter !== undefined && world.round < retryAfter) return;
    const path = findPath(world.tiles, hunter.position, stack.position, CONFIG.roadSpeedMultiplier);
    clearNavigationBlocked(hunter);
    if (!path) {
      hunter.active = false;
      if (hunter.workArea)
        hunter.workArea.retryAfterTick = world.round + CONFIG.decisionIntervalTicks;
      return;
    }
    hunter.path = path;
    hunter.movement = 0;
    hunter.active = false;
    if (hunter.workArea) hunter.workArea.retryAfterTick = undefined;
    return;
  }

  if (hunter.huntLootPickupUntilTick === undefined) {
    hunter.huntLootPickupUntilTick = world.round + HUNTER_LOOT_PICKUP_TICKS;
    hunter.active = true;
    return;
  }
  if (world.round < hunter.huntLootPickupUntilTick) {
    hunter.active = true;
    return;
  }

  if (!pickupReservedLooseGood(world, targetId, 1)) {
    abandonLoot(world, hunter);
    return;
  }

  hunter.huntLootTarget = undefined;
  hunter.huntLootPickupUntilTick = undefined;
  hunter.outdoorCarry = stack.good;
  hunter.path = [];
  hunter.movement = 0;
  hunter.active = false;
  routeOutdoorCarryToFlag(world, hunter, true);
}

function startAiming(world: World, hunter: Person, target: Animal): void {
  hunter.path = [];
  hunter.movement = 0;
  hunter.active = true;
  hunter.huntAimTarget = target.id;
  hunter.huntAimUntilTick = world.round + HUNTER_AIM_TICKS;
}

function finishAiming(world: World, hunter: Person): boolean {
  if (!hunter.huntAimTarget || hunter.huntAimUntilTick === undefined) return false;
  const target = animals(world).find((candidate) => candidate.id === hunter.huntAimTarget);
  if (!target) {
    clearAim(hunter);
    hunter.huntTarget = undefined;
    hunter.active = false;
    return true;
  }

  hunter.path = [];
  hunter.movement = 0;
  hunter.active = true;
  if (world.round < hunter.huntAimUntilTick) return true;

  const fleeing = animalIsFleeing(world, target);
  fireRangedAttack(
    world,
    hunter,
    { kind: "animal", id: target.id },
    target.position,
    HUNTER_BOW,
    hunterHitChance(hunter, fleeing),
    "hunter",
  );
  hunter.nextRangedAttackTick = world.round + HUNTER_BOW.cooldownTicks;
  hunter.huntTarget = target.id;
  clearAim(hunter);
  frightenAnimalGroup(world, target.groupId, hunter.position);
  return true;
}

function advanceHunter(world: World, hunter: Person): void {
  ensureWorkArea(world, hunter);

  if (hunterInterrupted(hunter)) {
    clearAim(hunter);
    return;
  }

  if (
    hunter.huntTarget ||
    hunter.huntAimTarget ||
    hunter.huntLootTarget ||
    hunter.huntLootQueue?.length ||
    hunter.outdoorCarry
  )
    clearNavigationBlocked(hunter);

  if (hunter.outdoorCarry) {
    clearAim(hunter);
    if (routeOutdoorCarryToFlag(world, hunter, true))
      activateNextLootTarget(hunter);
    return;
  }

  if (!hunter.huntLootTarget && hunter.huntLootQueue?.length)
    activateNextLootTarget(hunter);

  if (hunter.huntLootTarget) {
    clearAim(hunter);
    collectHuntLoot(world, hunter);
    return;
  }

  if (!hunter.workArea) return;
  if (finishAiming(world, hunter)) return;

  const target = targetForHunter(world, hunter);
  if (!target) {
    hunter.active = false;
    return;
  }

  clearNavigationBlocked(hunter);
  const distance = hexDistance(hunter.position, target.position);
  if (distance > HUNTER_BOW.range) {
    if (!hunter.path.length) routeIntoRange(world, hunter, target);
    return;
  }

  startAiming(world, hunter, target);
}

function createHuntingLoot(
  world: World,
  shooter: Person | undefined,
  animal: Animal,
): void {
  const reserved: string[] = [];
  for (const good of HUNT_DROPS[animal.kind]) {
    const drop = findLooseGoodDropPosition(world, animal.position, good, GRID_REFINEMENT);
    if (!drop) continue;
    const stack = placeLooseGood(world, drop, good, 1);
    if (!stack || !shooter || !shooter.hunter) continue;
    if (!reserveLooseGood(world, stack.id, 1)) continue;
    reserved.push(stack.id);
  }
  if (!shooter || !shooter.hunter || !reserved.length) return;

  const [first, ...rest] = reserved;
  shooter.huntLootTarget = first;
  shooter.huntLootQueue = rest.length ? rest : undefined;
  shooter.huntLootPickupUntilTick = undefined;
  shooter.path = [];
  shooter.movement = 0;
  shooter.active = false;
}

function resolveHuntingImpact(world: World, impact: RangedImpact): void {
  if (!impact.hit || impact.target.kind !== "animal") return;
  const removed = removeAnimal(world, impact.target.id);
  if (!removed) return;

  const shooter =
    impact.projectile.source.kind === "person"
      ? world.people.find((person) => person.id === impact.projectile.source.id)
      : undefined;

  if (impact.rewardProfession && shooter)
    awardProfessionExperience(shooter, impact.rewardProfession);

  createHuntingLoot(world, shooter, removed);

  for (const person of world.people) {
    if (person.huntTarget === removed.id) person.huntTarget = undefined;
    if (person.huntAimTarget === removed.id) clearAim(person);
  }
}

export function advanceHunting(world: World): void {
  const impacts = advanceRangedCombat(world);
  for (const impact of impacts) resolveHuntingImpact(world, impact);

  for (const person of world.people) {
    if (!person.hunter) continue;
    advanceHunter(world, person);
  }
}
