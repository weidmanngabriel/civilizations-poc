import assert from "node:assert/strict";
import test from "node:test";
import { CONSTRUCTION_PLANS } from "../src/simulation/buildingPlacement";
import { neighbors, same } from "../src/simulation/hex";
import type { BuildingKind } from "../src/simulation/model";
import { CONFIG, createDefaultGameWorld } from "../src/simulation/scenario";
import { changeAssignment, tick } from "../src/simulation/simulation";

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
  const deposit = world.buildings.find((building) => building.kind === "clayDeposit")!;
  const person = world.people.find((candidate) => !candidate.assignment && !candidate.builder && !candidate.woodcutter)!;
  person.position = { ...deposit.position };
  assert.equal(changeAssignment(world, deposit.id, "worker", 1), true);
  const assignedPerson = world.people.find((candidate) => candidate.assignment?.building === deposit.id)!;
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
