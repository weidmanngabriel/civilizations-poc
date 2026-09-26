import type {
  Building,
  EquippedItem,
  EquipmentGood,
  EquipmentSlot,
  Good,
  LooseGoodStack,
  Person,
  World,
} from "./model";
import { CONFIG } from "./scenario";
import { same } from "./hex";
import { GRID_REFINEMENT, hexDistance } from "./spatial";
import { findRequiredNavigationPath } from "./wayposts";
import { interruptEating } from "./needs";
import { interruptSleep } from "./sleep";
import {
  availableLooseGoodAmount,
  findLooseGoodDropPosition,
  looseGoodStacks,
  pickupReservedLooseGoodWithState,
  placeLooseGood,
  releaseLooseGoodReservation,
  reserveLooseGood,
} from "./looseGoods";

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

const cloneItem = (item: EquippedItem): EquippedItem => ({ ...item });

const freshItem = (good: EquipmentGood): EquippedItem => ({
  good,
  durability: EQUIPMENT_DEFINITIONS[good].durability,
  workProgress: 0,
});

export const storedEquipmentCount = (building: Building, good: Good): number =>
  building.storedEquipment?.filter((item) => item.good === good).length ?? 0;

export const storageGoodStock = (building: Building, good: Good): number =>
  storageBuilding(building)
    ? (building.inventory?.[good] ?? 0) + storedEquipmentCount(building, good)
    : 0;

export const storeEquipmentItems = (building: Building, items: EquippedItem[]): void => {
  if (!items.length) return;
  building.storedEquipment ??= [];
  building.storedEquipment.push(...items.map(cloneItem));
};

export const takeStoredEquipment = (
  building: Building,
  good: Good,
  amount = 1,
): EquippedItem[] => {
  if (!building.storedEquipment?.length || amount <= 0) return [];
  const taken: EquippedItem[] = [];
  const kept: EquippedItem[] = [];
  for (const item of building.storedEquipment) {
    if (item.good === good && taken.length < amount) taken.push(cloneItem(item));
    else kept.push(item);
  }
  building.storedEquipment = kept.length ? kept : undefined;
  return taken;
};

const returnTarget = (world: World): Building | undefined =>
  world.buildings.find(storageBuilding);

const equipmentState = (person: Person) => person.equipment ?? (person.equipment = {});
const equipmentPreference = (person: Person) =>
  person.equipmentPreferences ?? (person.equipmentPreferences = {});

export const equipmentForSlot = (person: Person, slot: EquipmentSlot) =>
  person.equipment?.[slot];

export const equipmentWearPercent = (item: EquippedItem): number => {
  const definition = EQUIPMENT_DEFINITIONS[item.good];
  const partialToolWear = item.good === "woodenTool"
    ? Math.max(0, item.workProgress ?? 0) / CONFIG.duration
    : 0;
  const used = definition.durability - item.durability + partialToolWear;
  return Math.max(0, Math.min(100, Math.round((used / definition.durability) * 100)));
};

export const equipmentStock = (world: World, good: EquipmentGood): number =>
  world.buildings.reduce((sum, building) => sum + storageGoodStock(building, good), 0) +
  looseGoodStacks(world)
    .filter((stack) => stack.good === good)
    .reduce((sum, stack) => sum + availableLooseGoodAmount(stack), 0);

export const equipmentPendingForSlot = (person: Person, slot: EquipmentSlot): boolean =>
  person.equipmentTask?.slot === slot;

const dropEquipmentItem = (world: World, origin: Person["position"], item: EquippedItem): boolean => {
  const radius = Math.max(GRID_REFINEMENT, CONFIG.mapColumns, CONFIG.mapRows);
  const drop = findLooseGoodDropPosition(world, origin, item.good, radius);
  return Boolean(drop && placeLooseGood(world, drop, item.good, 1, [item]));
};

const depositEquipmentItem = (
  world: World,
  origin: Person["position"],
  item: EquippedItem,
  preferred?: Building,
): boolean => {
  const target = preferred && storageBuilding(preferred) ? preferred : returnTarget(world);
  if (target) {
    storeEquipmentItems(target, [item]);
    return true;
  }
  return dropEquipmentItem(world, origin, item);
};

type EquipmentSource =
  | { kind: "storage"; source: Building; path: Person["path"] }
  | { kind: "looseGood"; source: LooseGoodStack; path: Person["path"] };

const equipmentSources = (
  world: World,
  person: Person,
  good: EquipmentGood,
): EquipmentSource[] => {
  const sources: EquipmentSource[] = [];
  for (const source of world.buildings.filter((building) => storageGoodStock(building, good) > 0)) {
    const path = findRequiredNavigationPath(world, person, source.position, CONFIG.roadSpeedMultiplier, "equipment");
    if (path) sources.push({ kind: "storage", source, path });
  }
  for (const source of looseGoodStacks(world)) {
    if (source.good !== good || availableLooseGoodAmount(source) < 1) continue;
    const path = findRequiredNavigationPath(world, person, source.position, CONFIG.roadSpeedMultiplier, "equipment");
    if (path) sources.push({ kind: "looseGood", source, path });
  }
  return sources.sort(
    (a, b) =>
      hexDistance(person.position, a.source.position) - hexDistance(person.position, b.source.position) ||
      a.source.id.localeCompare(b.source.id),
  );
};

const reserveEquipmentPickup = (
  world: World,
  person: Person,
  good: EquipmentGood,
): boolean => {
  for (const candidate of equipmentSources(world, person, good)) {
    let item: EquippedItem | undefined;
    if (candidate.kind === "storage") {
      item = takeStoredEquipment(candidate.source, good, 1)[0];
      if (!item) {
        candidate.source.inventory ??= {};
        if ((candidate.source.inventory[good] ?? 0) < 1) continue;
        candidate.source.inventory[good] = (candidate.source.inventory[good] ?? 0) - 1;
        item = freshItem(good);
      }
    } else if (!reserveLooseGood(world, candidate.source.id, 1)) {
      continue;
    }

    interruptEating(world, person);
    if (person.sleepState) interruptSleep(world, person);

    person.equipmentTask = {
      good,
      slot: EQUIPMENT_DEFINITIONS[good].slot,
      source: candidate.source.id,
      ...(candidate.kind === "looseGood" ? { sourceKind: "looseGood" as const } : {}),
      sourcePosition: { ...candidate.source.position },
      ...(item ? { item } : {}),
    };
    person.manualMoveTarget = { ...candidate.source.position };
    person.idleTarget = undefined;
    person.path = candidate.path;
    person.movement = 0;
    person.active = false;
    return true;
  }
  return false;
};

export function cancelEquipmentPickup(world: World, person: Person): void {
  const task = person.equipmentTask;
  if (!task) return;

  if (task.sourceKind === "looseGood") {
    releaseLooseGoodReservation(world, task.source, 1);
  } else if (task.item) {
    const source = world.buildings.find(
      (building) => building.id === task.source && storageBuilding(building),
    );
    depositEquipmentItem(world, task.sourcePosition, task.item, source);
  }

  if (person.manualMoveTarget && same(person.manualMoveTarget, task.sourcePosition)) {
    person.manualMoveTarget = undefined;
    person.path = [];
    person.movement = 0;
    person.active = false;
  }
  person.equipmentTask = undefined;
}

export function assignEquipment(world: World, personId: number, good: EquipmentGood): boolean {
  const person = world.people.find((candidate) => candidate.id === personId);
  if (!person || person.ageStage === "child") return false;
  const definition = EQUIPMENT_DEFINITIONS[good];
  const existing = equipmentForSlot(person, definition.slot);

  if (existing?.good === good) {
    equipmentPreference(person)[definition.slot] = good;
    return true;
  }
  if (person.equipmentTask?.good === good) {
    equipmentPreference(person)[definition.slot] = good;
    return true;
  }

  if (person.equipmentTask) cancelEquipmentPickup(world, person);
  if (!reserveEquipmentPickup(world, person, good)) return false;
  equipmentPreference(person)[definition.slot] = good;
  return true;
}

export function resolveEquipmentPickups(world: World): void {
  for (const person of world.people) {
    const task = person.equipmentTask;
    if (!task || !same(person.position, task.sourcePosition)) continue;

    let item = task.item;
    if (task.sourceKind === "looseGood") {
      const pickup = pickupReservedLooseGoodWithState(world, task.source, 1);
      if (!pickup) {
        person.equipmentTask = undefined;
        continue;
      }
      item = pickup.equipmentItems[0] ?? freshItem(task.good);
    }
    item ??= freshItem(task.good);

    const existing = equipmentForSlot(person, task.slot);
    if (existing) {
      const source = task.sourceKind === "looseGood"
        ? undefined
        : world.buildings.find(
            (building) => building.id === task.source && storageBuilding(building),
          );
      depositEquipmentItem(world, person.position, existing, source);
    }

    equipmentState(person)[task.slot] = cloneItem(item);
    person.equipmentTask = undefined;
  }
}

export function unequipSlot(world: World, personId: number, slot: EquipmentSlot): boolean {
  const person = world.people.find((candidate) => candidate.id === personId);
  const item = person ? equipmentForSlot(person, slot) : undefined;
  if (!person) return false;

  if (person.equipmentTask?.slot === slot) cancelEquipmentPickup(world, person);
  if (item && person.equipment) {
    if (!depositEquipmentItem(world, person.position, item)) return false;
    delete person.equipment[slot];
  }
  if (person.equipmentPreferences) delete person.equipmentPreferences[slot];
  return true;
}

const tryPreferred = (world: World, person: Person, slot: EquipmentSlot): void => {
  const preferred = person.equipmentPreferences?.[slot];
  if (
    !preferred ||
    person.manualMoveTarget ||
    equipmentForSlot(person, slot) ||
    equipmentPendingForSlot(person, slot)
  ) return;
  assignEquipment(world, person.id, preferred);
};

export function maintainEquipment(world: World): void {
  for (const person of world.people) {
    if (person.ageStage === "child") continue;
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
