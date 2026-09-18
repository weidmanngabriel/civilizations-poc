import test from "node:test";
import assert from "node:assert/strict";
import { createWorld, CONFIG } from "../src/simulation/scenario";
import {
  changeAssignment,
  setWorkAreaCenter,
  tick,
  WORK_AREA_RADIUS,
} from "../src/simulation/simulation";
import { hexDistance } from "../src/simulation/spatial";
import type { Building } from "../src/simulation/model";

test("wood extraction creates a ground stack and sawmill workers collect from it", () => {
  const world = createWorld(2);
  const forest = world.naturalResources.find((resource) => resource.kind === "forest")!;
  const woodcutter = world.people[0]!;
  const oldRemaining = forest.remaining;

  woodcutter.woodcutter = true;
  woodcutter.resourceTarget = forest.id;
  woodcutter.position = { ...forest.position };
  woodcutter.active = true;
  woodcutter.path = [];
  woodcutter.progress = CONFIG.duration - 1;

  const flagTile = world.tiles.find(
    (tile) =>
      tile.terrain === "grass" &&
      hexDistance(tile, forest.position) >= 4 &&
      hexDistance(tile, forest.position) <= Math.floor(WORK_AREA_RADIUS),
  )!;
  assert.equal(setWorkAreaCenter(world, woodcutter.id, flagTile), true);

  tick(world);

  assert.equal(forest.remaining, oldRemaining - 1);
  assert.equal(forest.output, 0, "wood must no longer remain on the tree output pool");
  assert.equal(woodcutter.outdoorCarry, "wood");
  assert.equal(
    world.looseGoods?.some((candidate) => candidate.good === "wood") ?? false,
    false,
    "the unit must stay on the woodcutter until the flag is reached",
  );

  let guard = 10_000;
  while (woodcutter.outdoorCarry && guard-- > 0) tick(world);
  assert.ok(guard > 0);
  const stack = world.looseGoods?.find((candidate) => candidate.good === "wood");
  assert.ok(stack, "carried wood should become a physical ground stack at the work flag");
  assert.equal(stack.amount, 1);
  assert.ok(hexDistance(flagTile, stack.position) <= CONFIG.spatialScale);
  assert.equal(
    world.naturalResources.some((resource) => resource.id === stack.id),
    false,
    "physical goods must not be mirrored as fake natural resources",
  );

  woodcutter.woodcutter = undefined;
  woodcutter.resourceTarget = undefined;
  woodcutter.active = false;
  woodcutter.progress = 0;

  const sawmillPosition = world.tiles.find(
    (tile) =>
      tile.terrain === "grass" &&
      hexDistance(tile, stack.position) >= CONFIG.spatialScale * 2,
  )!;
  const sawmill: Building = {
    id: "sawmill-physical-test",
    kind: "sawmill",
    name: "Sägewerk",
    position: { q: sawmillPosition.q, r: sawmillPosition.r },
    workers: 1,
    carriers: 0,
    input: 0,
    output: 0,
    recipe: { input: "wood", amount: 2, output: "plank", duration: CONFIG.duration },
  };
  world.buildings.push(sawmill);

  assert.equal(changeAssignment(world, sawmill.id, "worker", 1), true);
  const worker = world.people.find(
    (person) => person.assignment?.building === sawmill.id && person.assignment.role === "worker",
  )!;
  worker.position = { ...sawmill.position };
  worker.active = true;
  worker.path = [];
  worker.progress = 0;

  world.round = 60;
  tick(world);
  assert.ok(worker.trip, "sawmill worker should plan a wood pickup");
  assert.equal(worker.trip!.good, "wood");
  assert.equal(worker.trip!.source, stack.id, "pickup must target the physical stack");
  assert.equal(worker.trip!.sourceKind, "looseGood");
  assert.deepEqual(worker.trip!.sourcePosition, stack.position);
  assert.equal(world.looseGoods?.find((candidate) => candidate.id === stack.id)?.reserved, 1);

  for (let i = 0; i < 2_000 && sawmill.input < 1; i += 1) tick(world);

  assert.equal(sawmill.input, 1, "physical wood should be delivered into the sawmill input");
  assert.equal(world.looseGoods?.some((candidate) => candidate.id === stack.id), false);
});
