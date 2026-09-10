import { test } from "node:test";
import assert from "node:assert/strict";
import { createWorld, CONFIG } from "../src/simulation/scenario";
import { assigned, buildAt, changeAssignment, tick, warehouseStock } from "../src/simulation/simulation";
import { activeFarmFieldCount } from "../src/simulation/farm";
import type { Building, World } from "../src/simulation/model";

const rounds = (w: World, count: number) => {
  for (let i = 0; i < count; i++) tick(w);
};

const distance = (a: { q: number; r: number }, b: { q: number; r: number }) => {
  const dq = a.q - b.q;
  const dr = a.r - b.r;
  return Math.max(Math.abs(dq), Math.abs(dr), Math.abs(dq + dr));
};

const finishedFarm = (w: World) => {
  const farm = buildAt(w, { q: 10, r: 10 }, "farm")!;
  assert.ok(farm);
  changeAssignment(w, farm.id, "worker", 1);
  const farmer = assigned(w, farm.id, "worker")[0]!;
  farmer.position = { ...farm.position };
  farmer.path = [];
  farmer.movement = 0;
  farmer.active = true;
  return { farm, farmer };
};

const addField = (
  w: World,
  farm: Building,
  position: { q: number; r: number },
  stage: 1 | 2 | 3 | 4,
  progress = 0,
) => {
  const tile = w.tiles.find((candidate) => candidate.q === position.q && candidate.r === position.r)!;
  assert.equal(tile.terrain, "grass");
  tile.terrain = "field";
  const field: Building = {
    id: `field-test-${w.nextFieldId++}`,
    kind: "field",
    name: "Testacker",
    position: { ...position },
    workers: 0,
    carriers: 0,
    input: 0,
    output: 0,
    farmId: farm.id,
    fieldStage: stage,
    fieldGrowthProgress: progress,
    recipe: { amount: 0, output: "wheat", duration: CONFIG.fieldStageDurationTicks },
  };
  w.buildings.push(field);
  return field;
};

test("farmer sows up to four random fields around the farm", () => {
  const w = createWorld();
  const { farm } = finishedFarm(w);

  for (let i = 0; i < 6000 && activeFarmFieldCount(w, farm.id) < CONFIG.farmMaxFields; i++)
    tick(w);

  const fields = w.buildings.filter(
    (b) => b.kind === "field" && b.farmId === farm.id && !b.retired,
  );
  assert.equal(fields.length, 4);
  for (const field of fields) {
    assert.ok(distance(field.position, farm.position) <= CONFIG.farmFieldRadius);
    assert.equal(
      w.tiles.find((tile) => tile.q === field.position.q && tile.r === field.position.r)?.terrain,
      "field",
    );
  }
});

test("fertilizing reduces the remaining time to the next stage to one third", () => {
  const w = createWorld();
  const { farm, farmer } = finishedFarm(w);
  const field = addField(
    w,
    farm,
    { q: farm.position.q + 1, r: farm.position.r },
    1,
    CONFIG.fieldStageDurationTicks / 2,
  );
  farmer.position = { ...field.position };
  farmer.path = [];
  farmer.farmTask = {
    kind: "fertilize",
    target: { ...field.position },
    fieldId: field.id,
    progress: 0,
  };

  rounds(w, CONFIG.fieldStageDurationTicks / 6 - 1);
  assert.equal(field.fieldStage, 1);
  tick(w);
  assert.equal(field.fieldStage, 2);
  assert.notEqual(farmer.farmTask?.kind, "fertilize");
});

test("harvest takes ten seconds, restores grass and leaves one wheat", () => {
  const w = createWorld();
  const { farm, farmer } = finishedFarm(w);
  const field = addField(w, farm, { q: farm.position.q + 1, r: farm.position.r }, 4);
  farmer.position = { ...field.position };
  farmer.path = [];
  farmer.farmTask = {
    kind: "harvest",
    target: { ...field.position },
    fieldId: field.id,
    progress: 0,
  };

  rounds(w, CONFIG.farmActionDurationTicks - 1);
  assert.equal(field.retired, undefined);
  tick(w);

  assert.equal(field.retired, true);
  assert.equal(field.output, 1);
  assert.equal(
    w.tiles.find((tile) => tile.q === field.position.q && tile.r === field.position.r)?.terrain,
    "grass",
  );
});

test("warehouse carriers can collect wheat from a harvested field", () => {
  const w = createWorld();
  const warehouse = buildAt(w, { q: 9, r: 10 }, "warehouse")!;
  assert.ok(warehouse);
  changeAssignment(w, warehouse.id, "carrier", 1);
  const carrier = assigned(w, warehouse.id, "carrier")[0]!;
  carrier.position = { ...warehouse.position };
  carrier.path = [];
  carrier.movement = 0;
  carrier.active = true;

  const source: Building = {
    id: "field-harvested",
    kind: "field",
    name: "Abgeernteter Acker",
    position: { q: 10, r: 10 },
    workers: 0,
    carriers: 0,
    input: 0,
    output: 1,
    fieldStage: 4,
    fieldGrowthProgress: 0,
    retired: true,
    recipe: { amount: 0, output: "wheat", duration: CONFIG.fieldStageDurationTicks },
  };
  w.buildings.push(source);

  for (let i = 0; i < 1000 && warehouseStock(warehouse, "wheat") === 0; i++) tick(w);

  assert.equal(warehouseStock(warehouse, "wheat"), 1);
  assert.equal(source.output, 0);
});
