import test from "node:test";
import assert from "node:assert/strict";
import { createWorld, CONFIG } from "../src/simulation/scenario";
import {
  assignEquipment,
  equipmentForSlot,
  equipmentMovementSpeedMultiplier,
  equipmentStock,
  equipmentWorkSpeedMultiplier,
  recordShoeTravel,
  recordToolWork,
  unequipSlot,
} from "../src/simulation/equipment";

test("manual equipment assignment consumes stock and enables both bonuses", () => {
  const world = createWorld(1);
  const person = world.people[0]!;
  const hq = world.buildings.find((building) => building.kind === "hq")!;
  hq.inventory!.woodenTool = 1;
  hq.inventory!.shoes = 1;

  assert.equal(assignEquipment(world, person.id, "woodenTool"), true);
  assert.equal(assignEquipment(world, person.id, "shoes"), true);

  assert.equal(equipmentStock(world, "woodenTool"), 0);
  assert.equal(equipmentStock(world, "shoes"), 0);
  assert.equal(equipmentWorkSpeedMultiplier(person), CONFIG.equipmentSpeedMultiplier);
  assert.equal(equipmentMovementSpeedMultiplier(person), CONFIG.equipmentSpeedMultiplier);
  assert.equal(equipmentForSlot(person, "tool")?.durability, CONFIG.woodenToolDurabilityActions);
  assert.equal(equipmentForSlot(person, "shoes")?.durability, CONFIG.shoesDurabilityMicrotiles);
});

test("wooden tools auto-requip after thirty work actions until manually removed", () => {
  const world = createWorld(1);
  const person = world.people[0]!;
  const hq = world.buildings.find((building) => building.kind === "hq")!;
  hq.inventory!.woodenTool = 2;

  assert.equal(assignEquipment(world, person.id, "woodenTool"), true);
  for (let action = 0; action < CONFIG.woodenToolDurabilityActions; action += 1)
    recordToolWork(world, person, CONFIG.duration);

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
  recordShoeTravel(world, person, CONFIG.shoesDurabilityMicrotiles);

  assert.equal(equipmentForSlot(person, "shoes")?.durability, CONFIG.shoesDurabilityMicrotiles);
  assert.equal(equipmentStock(world, "shoes"), 0);
});
