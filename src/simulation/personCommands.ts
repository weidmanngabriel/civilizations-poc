import type { Building, BuildingId, Hex, Person, Profession, Role, World } from "./model";
import { canLearnProfession, currentProfession, workerProfession } from "./experience";
import { same } from "./hex";
import { releaseLooseGoodReservation } from "./looseGoods";
import { commandEat, interruptEating } from "./needs";
import { commandSleep, interruptSleep } from "./sleep";
import { clearWorkArea, ensureWorkArea, syncWorkAreas } from "./workAreas";
import { findRequiredNavigationPath } from "./wayposts";
import { CONFIG } from "./scenario";

const BUILDING_PROFESSIONS = new Set<Profession>([
  "carrier",
  "merchant",
  "farmer",
  "sawmillWorker",
  "carpenter",
  "miller",
  "baker",
  "potter",
  "stonemason",
]);

const completed = (building: Building): boolean =>
  !building.retired && (!building.construction || building.construction.complete);

const roleForProfession = (profession: Profession | undefined): Role | undefined => {
  if (!profession) return undefined;
  if (profession === "carrier") return "carrier";
  if (profession === "merchant") return "merchant";
  if (BUILDING_PROFESSIONS.has(profession)) return "worker";
  return undefined;
};

const assignmentCount = (world: World, buildingId: BuildingId, role: Role): number =>
  world.people.filter((person) => person.assignment?.building === buildingId && person.assignment.role === role).length;

const roleLimit = (building: Building, role: Role): number => {
  if (!completed(building) || building.kind === "field") return 0;
  if (role === "worker") return building.workers;
  if (role === "carrier") return building.carriers;
  if (role === "merchant") return building.kind === "warehouse" ? (building.merchants ?? 0) : 0;
  return 0;
};

const compatibleWorkplace = (profession: Profession, building: Building): boolean => {
  const role = roleForProfession(profession);
  if (!role || !completed(building)) return false;
  if (role === "worker") return workerProfession(building) === profession;
  if (role === "merchant") return building.kind === "warehouse";
  return building.kind === "warehouse" || building.kind === "hq" || building.carriers > 0;
};

const releaseTripReservation = (world: World, person: Person): void => {
  if (person.trip?.sourceKind === "looseGood" && !person.trip.picked)
    releaseLooseGoodReservation(world, person.trip.source, CONFIG.carryCapacity);
};

const stopCurrentWork = (world: World, person: Person): boolean => {
  if (person.trip?.picked || person.outdoorCarry) return false;
  if (person.sleepState) interruptSleep(world, person);
  releaseTripReservation(world, person);
  if (person.huntLootTarget) releaseLooseGoodReservation(world, person.huntLootTarget, 1);
  person.trip = undefined;
  person.assignment = undefined;
  person.merchantRoute = undefined;
  person.farmTask = undefined;
  person.woodcutter = undefined;
  person.fisher = undefined;
  person.hunter = undefined;
  person.huntTarget = undefined;
  person.huntAimTarget = undefined;
  person.huntAimUntilTick = undefined;
  person.huntLootTarget = undefined;
  person.huntLootPickupUntilTick = undefined;
  person.nextRangedAttackTick = undefined;
  person.fishingSpot = undefined;
  person.fishingWaterTarget = undefined;
  person.fishingStartedAtTick = undefined;
  person.fishingWaitUntilTick = undefined;
  person.scoutWaypostTask = undefined;
  person.extractor = undefined;
  person.resourceTarget = undefined;
  person.builder = undefined;
  person.workArea = undefined;
  person.idleTarget = undefined;
  person.progress = 0;
  person.path = [];
  person.movement = 0;
  person.active = false;
  return true;
};

export const canChangePersonProfession = (person: Person): boolean =>
  !person.trip?.picked && !person.outdoorCarry;

export function setPersonProfession(
  world: World,
  personId: number,
  profession: Profession | undefined,
): boolean {
  const person = world.people.find((candidate) => candidate.id === personId);
  if (
    !person ||
    !canChangePersonProfession(person) ||
    (profession && !canLearnProfession(person, profession)) ||
    !stopCurrentWork(world, person)
  ) return false;

  person.profession = profession;
  if (profession === "woodcutter") person.woodcutter = true;
  else if (profession === "fisher") person.fisher = true;
  else if (profession === "hunter") person.hunter = true;
  else if (profession === "clayDigger") person.extractor = "clay";
  else if (profession === "stonecutter") person.extractor = "stone";
  else if (profession === "builder") person.builder = true;

  syncWorkAreas(world);
  return true;
}

export function validWorkplaces(world: World, personId: number): Building[] {
  const person = world.people.find((candidate) => candidate.id === personId);
  const profession = person ? currentProfession(world, person) : undefined;
  if (!person || !profession || !roleForProfession(profession)) return [];
  const role = roleForProfession(profession)!;
  return world.buildings.filter((building) =>
    compatibleWorkplace(profession, building) &&
    (person.assignment?.building === building.id ||
      assignmentCount(world, building.id, role) < roleLimit(building, role)),
  );
}

export function setPersonWorkplace(world: World, personId: number, buildingId: BuildingId): boolean {
  const person = world.people.find((candidate) => candidate.id === personId);
  const profession = person ? currentProfession(world, person) : undefined;
  const target = world.buildings.find((building) => building.id === buildingId);
  if (!person || !profession || !target || !compatibleWorkplace(profession, target)) return false;
  const role = roleForProfession(profession);
  const alreadyAssignedHere =
    person.assignment?.building === target.id && person.assignment.role === role;
  if (!role || (!alreadyAssignedHere && assignmentCount(world, target.id, role) >= roleLimit(target, role)))
    return false;
  if (alreadyAssignedHere) return true;
  if (person.trip?.picked || person.outdoorCarry) return false;

  if (person.sleepState) interruptSleep(world, person);
  releaseTripReservation(world, person);
  person.trip = undefined;
  person.assignment = { building: target.id, role };
  person.merchantRoute = role === "merchant" ? { good: "wood" } : undefined;
  person.idleTarget = undefined;
  person.manualMoveTarget = undefined;
  person.active = same(person.position, target.position);
  person.movement = 0;
  person.path = person.active
    ? []
    : findRequiredNavigationPath(world, person, target.position, CONFIG.roadSpeedMultiplier) ?? [];
  if (role === "carrier" && (target.kind === "warehouse" || target.kind === "hq"))
    ensureWorkArea(world, person, target.position);
  else clearWorkArea(person);
  return true;
}

export const validHomes = (world: World): Building[] =>
  world.buildings.filter((building) => building.kind === "house" && completed(building));

export function setPersonHome(world: World, personId: number, buildingId: BuildingId): boolean {
  const person = world.people.find((candidate) => candidate.id === personId);
  const home = world.buildings.find((building) => building.id === buildingId);
  if (!person || !home || home.kind !== "house" || !completed(home)) return false;
  person.home = home.id;
  return true;
}

export function orderPersonMove(world: World, personId: number, target: Hex): boolean {
  const person = world.people.find((candidate) => candidate.id === personId);
  if (!person || !world.tiles.some((tile) => same(tile, target))) return false;
  interruptEating(world, person);
  if (person.sleepState) interruptSleep(world, person);
  const path = findRequiredNavigationPath(world, person, target, CONFIG.roadSpeedMultiplier);
  if (!path) return false;
  person.manualMoveTarget = { ...target };
  person.idleTarget = undefined;
  person.path = path;
  person.movement = 0;
  person.active = false;
  return true;
}

export function syncManualMoveOrders(world: World): void {
  for (const person of world.people) {
    const target = person.manualMoveTarget;
    if (!target) continue;
    if (same(person.position, target)) {
      person.manualMoveTarget = undefined;
      continue;
    }
    if (person.path.length) continue;
    const path = findRequiredNavigationPath(world, person, target, CONFIG.roadSpeedMultiplier);
    if (!path) {
      person.manualMoveTarget = undefined;
      continue;
    }
    person.path = path;
    person.movement = 0;
    person.active = false;
  }
}

export { commandEat, commandSleep };
