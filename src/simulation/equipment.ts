import type { Building, EquipmentGood, EquipmentSlot, Good, Person, World } from "./model";
import { CONFIG } from "./scenario";

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

const sourceFor = (world: World, good: EquipmentGood): Building | undefined =>
  world.buildings.find((building) => stock(building, good) > 0);

const returnTarget = (world: World): Building | undefined =>
  world.buildings.find(storageBuilding);

const equipmentState = (person: Person) => person.equipment ?? (person.equipment = {});
const equipmentPreference = (person: Person) =>
  person.equipmentPreferences ?? (person.equipmentPreferences = {});

export const equipmentForSlot = (person: Person, slot: EquipmentSlot) =>
  person.equipment?.[slot];

export const equipmentStock = (world: World, good: EquipmentGood): number =>
  world.buildings.reduce((sum, building) => sum + stock(building, good), 0);

export function assignEquipment(world: World, personId: number, good: EquipmentGood): boolean {
  const person = world.people.find((candidate) => candidate.id === personId);
  if (!person) return false;
  const definition = EQUIPMENT_DEFINITIONS[good];
  const existing = equipmentForSlot(person, definition.slot);
  if (existing?.good === good) {
    equipmentPreference(person)[definition.slot] = good;
    return true;
  }

  const source = sourceFor(world, good);
  if (!source || !source.inventory) return false;
  source.inventory[good] = Math.max(0, (source.inventory[good] ?? 0) - 1);

  if (existing) {
    const target = returnTarget(world);
    if (target) {
      target.inventory ??= {};
      target.inventory[existing.good] = (target.inventory[existing.good] ?? 0) + 1;
    }
  }

  equipmentState(person)[definition.slot] = {
    good,
    durability: definition.durability,
    workProgress: 0,
  };
  equipmentPreference(person)[definition.slot] = good;
  return true;
}

export function unequipSlot(world: World, personId: number, slot: EquipmentSlot): boolean {
  const person = world.people.find((candidate) => candidate.id === personId);
  const item = person ? equipmentForSlot(person, slot) : undefined;
  if (!person) return false;

  if (person.equipmentPreferences) delete person.equipmentPreferences[slot];
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
  if (!preferred || equipmentForSlot(person, slot)) return;
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
