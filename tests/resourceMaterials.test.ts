import assert from "node:assert/strict";
import test from "node:test";
import { CONSTRUCTION_PLANS } from "../src/simulation/buildingPlacement";
import { neighbors, same } from "../src/simulation/hex";
import type { BuildingKind } from "../src/simulation/model";
import { CONFIG, createDefaultGameWorld } from "../src/simulation/scenario";
import { changeExtractors, clayDiggers, stonecutters, tick } from "../src/simulation/simulation";

test("default map places finite clay by rivers and stone by mountains", () => {
  const world = createDefaultGameWorld();
  for (const [kind, terrain] of [["clayDeposit", "river"], ["stoneDeposit", "mountain"]] as const) {
    const nodes = world.buildings.filter((building) => building.kind === kind);
    assert.ok(nodes.length > 0);
    for (const node of nodes) {
      assert.equal(node.resourceRemaining, 10);
      assert.ok(neighbors(node.position).some((position) =>
        world.tiles.some((tile) => same(tile, position) && tile.terrain === terrain),
      ));
    }
  }
});

test("clay and stone processors expose the intended recipes and construction materials", () => {
  const world = createDefaultGameWorld();
  const kinds = ["pottery", "stonemason"] as const;
  for (const kind of kinds) {
    const buildable = world.tiles.find((tile) => tile.terrain === "grass")!;
    void buildable;
    assert.ok(CONSTRUCTION_PLANS[kind]);
  }
  assert.deepEqual(CONSTRUCTION_PLANS.bakery.required, { plank: 2, brick: 2 });
  assert.deepEqual(CONSTRUCTION_PLANS.well.required, { wood: 2, stoneBlock: 2 });
});

test("a natural deposit retires after exactly ten extracted units", () => {
  const world = createDefaultGameWorld();
  assert.equal(changeExtractors(world, "clay", 1), true);
  const assignedPerson = clayDiggers(world)[0]!;
  const deposit = world.buildings.find((building) => building.id === assignedPerson.assignment?.building)!;
  assert.equal(deposit.kind, "clayDeposit");
  assignedPerson.position = { ...deposit.position };
  assignedPerson.path = [];
  assignedPerson.active = true;
  let extracted = 0;
  for (let i = 0; i < CONFIG.duration * 15 && !deposit.retired; i += 1) {
    const before = deposit.output;
    tick(world);
    if (deposit.output > before) {
      extracted += deposit.output - before;
      deposit.output = 0;
    }
    assignedPerson.hunger = 100;
    assignedPerson.sleep = 100;
  }
  assert.equal(extracted, 10);
  assert.equal(deposit.resourceRemaining, 0);
  assert.equal(deposit.retired, true);
});

test("extractor pools claim different deposits and relocate after depletion", () => {
  const world = createDefaultGameWorld();
  assert.equal(changeExtractors(world, "clay", 1), true);
  assert.equal(changeExtractors(world, "clay", 1), true);
  assert.equal(changeExtractors(world, "stone", 1), true);
  assert.equal(clayDiggers(world).length, 2);
  assert.equal(stonecutters(world).length, 1);
  assert.notEqual(clayDiggers(world)[0]!.assignment?.building, clayDiggers(world)[1]!.assignment?.building);

  const worker = clayDiggers(world)[0]!;
  const firstId = worker.assignment!.building;
  const first = world.buildings.find((building) => building.id === firstId)!;
  first.resourceRemaining = 1;
  first.output = 0;
  worker.position = { ...first.position };
  worker.path = [];
  worker.active = true;
  worker.hunger = 100;
  worker.sleep = 100;
  for (let i = 0; i <= CONFIG.duration + 2 && !first.retired; i += 1) {
    tick(world);
    worker.hunger = 100;
    worker.sleep = 100;
  }
  assert.equal(first.retired, true);
  assert.notEqual(worker.assignment?.building, firstId);
  if (worker.assignment)
    assert.equal(world.buildings.find((building) => building.id === worker.assignment!.building)?.kind, "clayDeposit");
});
