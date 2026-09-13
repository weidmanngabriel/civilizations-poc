import assert from "node:assert/strict";
import test from "node:test";
import { CONSTRUCTION_PLANS } from "../src/simulation/buildingPlacement";
import { neighbors, same } from "../src/simulation/hex";
import { CONFIG, createDefaultGameWorld } from "../src/simulation/scenario";
import { changeExtractors, clayDiggers, stonecutters, tick } from "../src/simulation/simulation";

test("default map places finite clay by rivers and stone by mountains", () => {
  const world = createDefaultGameWorld();
  for (const [kind, terrain] of [["clay", "river"], ["stone", "mountain"]] as const) {
    const nodes = world.naturalResources.filter((resource) => resource.kind === kind);
    assert.ok(nodes.length > 0);
    for (const node of nodes) {
      assert.equal(node.remaining, 10);
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
  const deposit = world.naturalResources.find((resource) => resource.id === assignedPerson.resourceTarget)!;
  assert.equal(deposit.kind, "clay");
  assignedPerson.position = { ...deposit.position };
  assignedPerson.path = [];
  assignedPerson.active = true;
  let extracted = 0;
  for (let i = 0; i < CONFIG.duration * 15 && !deposit.depleted; i += 1) {
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
  assert.equal(deposit.remaining, 0);
  assert.equal(deposit.depleted, true);
});

test("extractor pools claim different deposits and relocate after depletion", () => {
  const world = createDefaultGameWorld();
  assert.equal(changeExtractors(world, "clay", 1), true);
  assert.equal(changeExtractors(world, "clay", 1), true);
  assert.equal(changeExtractors(world, "stone", 1), true);
  assert.equal(clayDiggers(world).length, 2);
  assert.equal(stonecutters(world).length, 1);
  assert.notEqual(clayDiggers(world)[0]!.resourceTarget, clayDiggers(world)[1]!.resourceTarget);

  const worker = clayDiggers(world)[0]!;
  const firstId = worker.resourceTarget!;
  const first = world.naturalResources.find((resource) => resource.id === firstId)!;
  first.remaining = 1;
  first.output = 0;
  worker.position = { ...first.position };
  worker.path = [];
  worker.active = true;
  worker.hunger = 100;
  worker.sleep = 100;
  for (let i = 0; i <= CONFIG.duration + 2 && !first.depleted; i += 1) {
    tick(world);
    worker.hunger = 100;
    worker.sleep = 100;
  }
  assert.equal(first.depleted, true);
  assert.notEqual(worker.resourceTarget, firstId);
  if (worker.resourceTarget)
    assert.equal(world.naturalResources.find((resource) => resource.id === worker.resourceTarget)?.kind, "clay");
});


test("natural resources are not buildings and have no direct building assignment", () => {
  const world = createDefaultGameWorld();
  assert.equal(world.buildings.some((building) => ["forest", "clayDeposit", "stoneDeposit"].includes(building.kind as string)), false);
  assert.ok(world.naturalResources.some((resource) => resource.kind === "forest"));
  assert.ok(world.naturalResources.some((resource) => resource.kind === "clay"));
  assert.ok(world.naturalResources.some((resource) => resource.kind === "stone"));
  assert.equal(changeExtractors(world, "clay", 1), true);
  const worker = clayDiggers(world)[0]!;
  assert.equal(worker.assignment, undefined);
  assert.ok(worker.resourceTarget);
});
