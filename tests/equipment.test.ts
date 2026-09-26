import test from "node:test";
import assert from "node:assert/strict";
import { createWorld, CONFIG } from "../src/simulation/scenario";
import { tick } from "../src/simulation/simulation";
import {
  assignEquipment,
  equipmentForSlot,
  equipmentMovementSpeedMultiplier,
  equipmentStock,
  equipmentWearPercent,
  equipmentWorkSpeedMultiplier,
  recordShoeTravel,
  recordToolWork,
  resolveEquipmentPickups,
  unequipSlot,
} from "../src/simulation/equipment";

const tickUntil = (world: ReturnType<typeof createWorld>, predicate: () => boolean, maxTicks = 20_000): void => {
  for (let i = 0; i < maxTicks && !predicate(); i += 1) tick(world);
  assert.equal(predicate(), true);
};

test("manual equipment assignment reserves stock but equips only after reaching storage", () => {
  const world = createWorld(1);
  const person = world.people[0]!;
  const hq = world.buildings.find((building) => building.kind === "hq")!;
  hq.inventory!.woodenTool = 1;

  assert.equal(assignEquipment(world, person.id, "woodenTool"), true);
  assert.equal(equipmentStock(world, "woodenTool"), 0);
  assert.equal(equipmentForSlot(person, "tool"), undefined);
  assert.equal(person.equipmentTask?.good, "woodenTool");

  tickUntil(world, () => equipmentForSlot(person, "tool")?.good === "woodenTool");

  assert.equal(person.equipmentTask, undefined);
  assert.equal(equipmentWorkSpeedMultiplier(person), CONFIG.equipmentSpeedMultiplier);
  assert.equal(equipmentForSlot(person, "tool")?.durability, CONFIG.woodenToolDurabilityActions);
});

test("wooden tools auto-requip after thirty work actions until manually removed", () => {
  const world = createWorld(1);
  const person = world.people[0]!;
  const hq = world.buildings.find((building) => building.kind === "hq")!;
  hq.inventory!.woodenTool = 2;

  assert.equal(assignEquipment(world, person.id, "woodenTool"), true);
  tickUntil(world, () => equipmentForSlot(person, "tool")?.good === "woodenTool");
  for (let action = 0; action < CONFIG.woodenToolDurabilityActions; action += 1)
    recordToolWork(world, person, CONFIG.duration);

  assert.equal(equipmentForSlot(person, "tool"), undefined);
  assert.equal(person.equipmentTask?.good, "woodenTool");
  tickUntil(world, () => equipmentForSlot(person, "tool")?.good === "woodenTool");
  assert.equal(equipmentForSlot(person, "tool")?.durability, CONFIG.woodenToolDurabilityActions);
  assert.equal(equipmentStock(world, "woodenTool"), 0);
  assert.equal(person.equipmentPreferences?.tool, "woodenTool");

  assert.equal(unequipSlot(world, person.id, "tool"), true);
  assert.equal(equipmentForSlot(person, "tool"), undefined);
  assert.equal(person.equipmentPreferences?.tool, undefined);
  assert.equal(equipmentStock(world, "woodenTool"), 1);

  recordToolWork(world, person, CONFIG.duration);
  assert.equal(equipmentForSlot(person, "tool"), undefined);
});

test("shoes wear by travelled microtiles and auto-requip from storage", () => {
  const world = createWorld(1);
  const person = world.people[0]!;
  const hq = world.buildings.find((building) => building.kind === "hq")!;
  hq.inventory!.shoes = 2;

  assert.equal(assignEquipment(world, person.id, "shoes"), true);
  tickUntil(world, () => equipmentForSlot(person, "shoes")?.good === "shoes");
  recordShoeTravel(world, person, CONFIG.shoesDurabilityMicrotiles);

  assert.equal(equipmentForSlot(person, "shoes"), undefined);
  assert.equal(person.equipmentTask?.good, "shoes");
  tickUntil(world, () => equipmentForSlot(person, "shoes")?.good === "shoes");
  assert.equal(equipmentForSlot(person, "shoes")?.durability, CONFIG.shoesDurabilityMicrotiles);
  assert.equal(equipmentStock(world, "shoes"), 0);
});


test("manually stored used equipment keeps its wear when another person equips it", () => {
  const world = createWorld(2);
  const first = world.people[0]!;
  const second = world.people[1]!;
  const hq = world.buildings.find((building) => building.kind === "hq")!;
  hq.inventory!.shoes = 1;

  assert.equal(assignEquipment(world, first.id, "shoes"), true);
  tickUntil(world, () => equipmentForSlot(first, "shoes")?.good === "shoes");
  recordShoeTravel(world, first, 625);

  const worn = equipmentForSlot(first, "shoes")!;
  assert.equal(worn.durability, 1875);
  assert.equal(equipmentWearPercent(worn), 25);
  assert.equal(unequipSlot(world, first.id, "shoes"), true);
  assert.equal(hq.storedEquipment?.[0]?.durability, 1875);
  assert.equal(equipmentStock(world, "shoes"), 1);

  assert.equal(assignEquipment(world, second.id, "shoes"), true);
  tickUntil(world, () => equipmentForSlot(second, "shoes")?.good === "shoes");

  assert.equal(equipmentForSlot(second, "shoes")?.durability, 1875);
  assert.equal(equipmentWearPercent(equipmentForSlot(second, "shoes")!), 25);
});

test("used equipment is dropped physically when no HQ or warehouse exists and keeps its wear", () => {
  const world = createWorld(2);
  const first = world.people[0]!;
  const second = world.people[1]!;
  first.equipment = {
    tool: {
      good: "woodenTool",
      durability: 15,
      workProgress: CONFIG.duration / 2,
    },
  };
  const groundCell = world.tiles.find(
    (tile) => tile.terrain === "grass" && !tile.resourceBlocking,
  )!;
  first.position = { q: groundCell.q, r: groundCell.r };
  second.position = { q: groundCell.q, r: groundCell.r };
  world.buildings = [];

  assert.equal(unequipSlot(world, first.id, "tool"), true);
  const stack = world.looseGoods?.find((candidate) => candidate.good === "woodenTool");
  assert.ok(stack);
  assert.equal(stack.amount, 1);
  assert.equal(stack.equipmentItems?.[0]?.durability, 15);
  assert.equal(stack.equipmentItems?.[0]?.workProgress, CONFIG.duration / 2);

  assert.equal(assignEquipment(world, second.id, "woodenTool"), true);
  second.position = { ...second.equipmentTask!.sourcePosition };
  resolveEquipmentPickups(world);

  const reused = equipmentForSlot(second, "tool")!;
  assert.equal(reused.durability, 15);
  assert.equal(reused.workProgress, CONFIG.duration / 2);
  assert.equal(equipmentWearPercent(reused), 52);
  assert.equal(world.looseGoods?.some((candidate) => candidate.id === stack.id), false);
});


test("children cannot receive equipment assignments", () => {
  const world = createWorld(1);
  const child = world.people[0]!;
  const hq = world.buildings.find((building) => building.kind === "hq")!;
  child.ageStage = "child";
  child.hunger = undefined;
  child.sleep = undefined;
  hq.inventory!.woodenTool = 1;
  hq.inventory!.shoes = 1;

  assert.equal(assignEquipment(world, child.id, "woodenTool"), false);
  assert.equal(assignEquipment(world, child.id, "shoes"), false);
  assert.equal(child.equipmentTask, undefined);
  assert.equal(equipmentForSlot(child, "tool"), undefined);
  assert.equal(equipmentForSlot(child, "shoes"), undefined);
  assert.equal(equipmentStock(world, "woodenTool"), 1);
  assert.equal(equipmentStock(world, "shoes"), 1);
});
