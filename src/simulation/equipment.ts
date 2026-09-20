import type { Building, EquipmentGood, EquipmentSlot, Good, Person, World } from "./model";
import { CONFIG } from "./scenario";
import { same } from "./hex";
import { hexDistance } from "./spatial";
import { findRequiredNavigationPath } from "./wayposts";
import { interruptEating } from "./needs";
import { interruptSleep } from "./sleep";

export const EQUIPMENT_DEFINITIONS: Record<EquipmentGood, {
  slot: EquipmentSlot;
  label: string;
  icon: string;
  durability: number;
}> = {
  woodenTool: { slot: "tool", label: "Holzwerkzeug", icon: "🛠️", durability: CONFIG.woodenToolDurabilityActions },
  shoes: { slot: "shoes", label: "Schuhe", icon: "👞", durability: CONFIG.shoesDurabilityMicrotiles },
};

const storageBuilding = (building: Building): boolean =>
  !building.retired &&
  (!building.construction || building.construction.complete) &&
  (building.kind === "hq" || building.kind === "warehouse");

const stock = (building: Building, good: Good): number =>
  storageBuilding(building) ? (building.inventory?.[good] ?? 0) : 0;

const returnTarget = (world: World): Building | undefined =>
  world.buildings.find(storageBuilding);

const equipmentState = (person: Person) => person.equipment ?? (person.equipment = {});
const equipmentPreference = (person: Person) =>
  person.equipmentPreferences ?? (person.equipmentPreferences = {});

export const equipmentForSlot = (person: Person, slot: EquipmentSlot) =>
  person.equipment?.[slot];

export const equipmentStock = (world: World, good: EquipmentGood): number =>
  world.buildings.reduce((sum, building) => sum + stock(building, good), 0);

export const equipmentPendingForSlot = (person: Person, slot: EquipmentSlot): boolean =>
  person.equipmentTask?.slot === slot;

const storageCandidates = (world: World, person: Person, good: EquipmentGood): Building[] =>
  world.buildings
    .filter((building) => stock(building, good) > 0)
    .sort(
      (a, b) =>
        hexDistance(person.position, a.position) - hexDistance(person.position, b.position) ||
        a.id.localeCompare(b.id),
    );

const reserveEquipmentPickup = (
  world: World,
  person: Person,
  good: EquipmentGood,
): boolean => {
  for (const source of storageCandidates(world, person, good)) {
    const path = findRequiredNavigationPath(world, person, source.position, CONFIG.roadSpeedMultiplier);
    if (!path) continue;

    interruptEating(world, person);
    if (person.sleepState) interruptSleep(world, person);

    source.inventory ??= {};
    source.inventory[good] = Math.max(0, (source.inventory[good] ?? 0) - 1);

    person.equipmentTask = {
      good,
      slot: EQUIPMENT_DEFINITIONS[good].slot,
      source: source.id,
      sourcePosition: { ...source.position },
    };
    person.manualMoveTarget = { ...source.position };
    person.idleTarget = undefined;
    person.path = path;
    person.movement = 0;
    person.active = false;
    return true;
  }
  return false;
};

export function cancelEquipmentPickup(world: World, person: Person): void {
  const task = person.equipmentTask;
  if (!task) return;
  const source = world.buildings.find((building) => building.id === task.source && storageBuilding(building))
    ?? returnTarget(world);
  if (source) {
    source.inventory ??= {};
    source.inventory[task.good] = (source.inventory[task.good] ?? 0) + 1;
  }
  person.equipmentTask = undefined;
}

export function assignEquipment(world: World, personId: number, good: EquipmentGood): boolean {
  const person = world.people.find((candidate) => candidate.id === personId);
  if (!person) return false;
  const definition = EQUIPMENT_DEFINITIONS[good];
  const existing = equipmentForSlot(person, definition.slot);

  equipmentPreference(person)[definition.slot] = good;

  if (existing?.good === good) return true;
  if (person.equipmentTask?.good === good) return true;

  if (person.equipmentTask) cancelEquipmentPickup(world, person);
  return reserveEquipmentPickup(world, person, good);
}

export function resolveEquipmentPickups(world: World): void {
  for (const person of world.people) {
    const task = person.equipmentTask;
    if (!task || !same(person.position, task.sourcePosition)) continue;

    const existing = equipmentForSlot(person, task.slot);
    if (existing) {
      const source = world.buildings.find((building) => building.id === task.source && storageBuilding(building))
        ?? returnTarget(world);
      if (source) {
        source.inventory ??= {};
        source.inventory[existing.good] = (source.inventory[existing.good] ?? 0) + 1;
      }
    }

    const definition = EQUIPMENT_DEFINITIONS[task.good];
    equipmentState(person)[task.slot] = {
      good: task.good,
      durability: definition.durability,
      workProgress: 0,
    };
    person.equipmentTask = undefined;
  }
}

export function unequipSlot(world: World, personId: number, slot: EquipmentSlot): boolean {
  const person = world.people.find((candidate) => candidate.id === personId);
  const item = person ? equipmentForSlot(person, slot) : undefined;
  if (!person) return false;

  if (person.equipmentPreferences) delete person.equipmentPreferences[slot];
  if (person.equipmentTask?.slot === slot) cancelEquipmentPickup(world, person);
  if (!item || !person.equipment) return true;

  const target = returnTarget(world);
  if (target) {
    target.inventory ??= {};
    target.inventory[item.good] = (target.inventory[item.good] ?? 0) + 1;
  }
  delete person.equipment[slot];
  return true;
}

const tryPreferred = (world: World, person: Person, slot: EquipmentSlot): void => {
  const preferred = person.equipmentPreferences?.[slot];
  if (!preferred || equipmentForSlot(person, slot) || equipmentPendingForSlot(person, slot)) return;
  assignEquipment(world, person.id, preferred);
};

export function maintainEquipment(world: World): void {
  for (const person of world.people) {
    tryPreferred(world, person, "tool");
    tryPreferred(world, person, "shoes");
  }
}

export const equipmentWorkSpeedMultiplier = (person: Person): number =>
  equipmentForSlot(person, "tool")?.good === "woodenTool" ? CONFIG.equipmentSpeedMultiplier : 1;

export const equipmentMovementSpeedMultiplier = (person: Person): number =>
  equipmentForSlot(person, "shoes")?.good === "shoes" ? CONFIG.equipmentSpeedMultiplier : 1;

export function recordToolWork(world: World, person: Person, effectiveProgress: number): void {
  const item = equipmentForSlot(person, "tool");
  if (!item || item.good !== "woodenTool" || effectiveProgress <= 0) return;
  item.workProgress = (item.workProgress ?? 0) + effectiveProgress;
  while (item.workProgress >= CONFIG.duration && item.durability > 0) {
    item.workProgress -= CONFIG.duration;
    item.durability -= 1;
  }
  if (item.durability > 0) return;
  if (person.equipment) delete person.equipment.tool;
  tryPreferred(world, person, "tool");
}

export function recordShoeTravel(world: World, person: Person, microtiles: number): void {
  const item = equipmentForSlot(person, "shoes");
  if (!item || item.good !== "shoes" || microtiles <= 0) return;
  item.durability = Math.max(0, item.durability - microtiles);
  if (item.durability > 0) return;
  if (person.equipment) delete person.equipment.shoes;
  tryPreferred(world, person, "shoes");
}
