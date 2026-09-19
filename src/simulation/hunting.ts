import type { Animal, Person, World } from "./model";
import { findPath } from "./hex";
import { awardProfessionExperience, professionExperience } from "./experience";
import { CONFIG } from "./scenario";
import { GRID_REFINEMENT, hexDistance } from "./spatial";
import { ensureWorkArea, workAreaContains } from "./workAreas";
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

export const HUNTER_WORK_AREA_RADIUS_WORLD_TILES = 5;
export const HUNTER_WORK_AREA_RADIUS =
  HUNTER_WORK_AREA_RADIUS_WORLD_TILES * GRID_REFINEMENT;

const HUNTER_BOW: RangedAttackProfile = {
  projectileKind: "arrow",
  flightTicks: Math.round(0.45 * CONFIG.simulationHz),
  cooldownTicks: Math.round(1.5 * CONFIG.simulationHz),
  range: Math.round(2 * GRID_REFINEMENT),
};

export function hunterHitChance(person: Person, targetFleeing: boolean): number {
  const base = 0.2 + 0.75 * professionExperience(person, "hunter") / 100;
  return targetFleeing ? base * 0.5 : base;
}

const animals = (world: World): Animal[] => world.animals ?? [];

const hunterBusy = (person: Person): boolean =>
  Boolean(
    person.hungerState ||
    person.sleepState ||
    person.manualMoveTarget ||
    person.trip ||
    person.outdoorCarry,
  );

const targetForHunter = (world: World, hunter: Person): Animal | undefined => {
  const area = hunter.workArea;
  if (!area) return undefined;
  const current = hunter.huntTarget
    ? animals(world).find(
        (animal) =>
          animal.id === hunter.huntTarget &&
          hexDistance(area.center, animal.position) <= area.radius,
      )
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
  return target;
};

const routeIntoRange = (world: World, hunter: Person, target: Animal): void => {
  const path = findPath(world.tiles, hunter.position, target.position, CONFIG.roadSpeedMultiplier);
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

function advanceHunter(world: World, hunter: Person): void {
  ensureWorkArea(world, hunter);
  if (hunterBusy(hunter)) return;
  if (!hunter.workArea || !workAreaContains(hunter, hunter.position)) return;

  const target = targetForHunter(world, hunter);
  if (!target) {
    hunter.active = false;
    return;
  }

  const distance = hexDistance(hunter.position, target.position);
  if (distance > HUNTER_BOW.range) {
    if (!hunter.path.length) routeIntoRange(world, hunter, target);
    return;
  }

  hunter.path = [];
  hunter.movement = 0;
  hunter.active = true;
  if ((hunter.nextRangedAttackTick ?? 0) > world.round) return;

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
  frightenAnimalGroup(world, target.groupId, hunter.position);
}

function resolveHuntingImpact(world: World, impact: RangedImpact): void {
  if (!impact.hit || impact.target.kind !== "animal") return;
  const removed = removeAnimal(world, impact.target.id);
  if (!removed) return;
  if (impact.rewardProfession) {
    const shooter =
      impact.projectile.source.kind === "person"
        ? world.people.find((person) => person.id === impact.projectile.source.id)
        : undefined;
    if (shooter) awardProfessionExperience(shooter, impact.rewardProfession);
  }
  for (const person of world.people)
    if (person.huntTarget === removed.id) person.huntTarget = undefined;
}

export function advanceHunting(world: World): void {
  const impacts = advanceRangedCombat(world);
  for (const impact of impacts) resolveHuntingImpact(world, impact);

  for (const person of world.people) {
    if (!person.hunter) continue;
    advanceHunter(world, person);
  }
}
