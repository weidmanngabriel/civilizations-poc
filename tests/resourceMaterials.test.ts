import assert from "node:assert/strict";
import test from "node:test";
import { CONSTRUCTION_PLANS } from "../src/simulation/buildingPlacement";
import { key, neighbors, same } from "../src/simulation/hex";
import { naturalResourceFootprint } from "../src/simulation/naturalResources";
import { CONFIG, createDefaultGameWorld } from "../src/simulation/scenario";
import { changeExtractors, clayDiggers, stonecutters, tick } from "../src/simulation/simulation";
import { createTestWorld } from "./testWorld";

test("default map places four-cell clay by rivers and four-cell stone by mountains", () => {
  const world = createDefaultGameWorld();
  for (const [kind, terrain] of [["clay", "river"], ["stone", "mountain"]] as const) {
    const nodes = world.naturalResources.filter((resource) => resource.kind === kind);
    assert.ok(nodes.length > 0);
    for (const node of nodes) {
      assert.equal(node.remaining, 10);
      assert.equal(naturalResourceFootprint(node).length, 4);
      assert.ok(neighbors(node.position).some((position) =>
        world.tiles.some((tile) => same(tile, position) && tile.terrain === terrain),
      ));
      for (const position of naturalResourceFootprint(node)) {
        const tile = world.tiles.find((candidate) => same(candidate, position));
        assert.ok(tile, `missing footprint tile ${key(position)}`);
        assert.equal(tile!.terrain, "grass");
        assert.equal(tile!.resourceBlocking, kind === "stone" ? true : undefined);
      }
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

test("clay extraction creates exactly ten physical ground units and retires the source", () => {
  const world = createTestWorld({
    width: 28,
    height: 24,
    resources: [{ kind: "clay", offset: { q: 11, r: -6 } }],
  });
  assert.equal(changeExtractors(world, "clay", 1), true);
  const assignedPerson = clayDiggers(world)[0]!;
  const deposit = world.naturalResources.find((resource) => resource.id === assignedPerson.resourceTarget)!;
  assert.equal(deposit.kind, "clay");
  assignedPerson.position = { ...deposit.position };
  assignedPerson.path = [];
  assignedPerson.active = true;
  for (let i = 0; i < CONFIG.duration * 15 && !deposit.depleted; i += 1) {
    tick(world);
    assignedPerson.hunger = 100;
    assignedPerson.sleep = 100;
  }
  let dropGuard = 2_000;
  while (assignedPerson.outdoorCarry && dropGuard-- > 0) {
    tick(world);
    assignedPerson.hunger = 100;
    assignedPerson.sleep = 100;
  }
  assert.ok(dropGuard > 0);
  assert.equal(deposit.remaining, 0);
  assert.equal(deposit.depleted, true);
  assert.equal(deposit.output, 0);
  assert.equal(
    (world.looseGoods ?? [])
      .filter((stack) => stack.good === "clay")
      .reduce((sum, stack) => sum + stack.amount, 0),
    10,
  );
  assert.ok((world.looseGoods ?? []).filter((stack) => stack.good === "clay").every((stack) => stack.amount <= 3));
});

test("stone extraction creates physical rubble and removes footprint blocking on depletion", () => {
  const world = createTestWorld({
    width: 28,
    height: 24,
    resources: [{ kind: "stone", offset: { q: 11, r: -6 } }],
  });
  assert.equal(changeExtractors(world, "stone", 1), true);
  const worker = stonecutters(world)[0]!;
  const deposit = world.naturalResources.find((resource) => resource.id === worker.resourceTarget)!;
  const footprint = naturalResourceFootprint(deposit);
  worker.position = { ...deposit.position };
  worker.path = [];
  worker.active = true;
  for (let i = 0; i < CONFIG.duration * 15 && !deposit.depleted; i += 1) {
    tick(world);
    worker.hunger = 100;
    worker.sleep = 100;
  }
  let dropGuard = 2_000;
  while (worker.outdoorCarry && dropGuard-- > 0) {
    tick(world);
    worker.hunger = 100;
    worker.sleep = 100;
  }
  assert.ok(dropGuard > 0);
  assert.equal(deposit.depleted, true);
  assert.equal(deposit.output, 0);
  assert.equal(
    (world.looseGoods ?? [])
      .filter((stack) => stack.good === "rubble")
      .reduce((sum, stack) => sum + stack.amount, 0),
    10,
  );
  for (const position of footprint) {
    const tile = world.tiles.find((candidate) => same(candidate, position));
    assert.equal(tile?.resourceBlocking, undefined);
  }
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
