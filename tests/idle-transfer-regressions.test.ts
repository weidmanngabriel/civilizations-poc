import test from "node:test";
import assert from "node:assert/strict";
import type { Person } from "../src/simulation/model";
import { CONFIG, createWorld } from "../src/simulation/scenario";
import {
  assigned,
  buildAt,
  changeAssignment,
  setRoad,
  tick,
} from "../src/simulation/simulation";
import { personActivityLabel } from "../src/ui/personPanel";

test("idle residents are shown as waiting instead of working", () => {
  const person: Person = {
    id: 1,
    position: { q: 0, r: 0 },
    idleTarget: { q: 0, r: 0 },
    active: true,
    progress: 0,
    movement: 0,
    path: [],
  };

  assert.equal(personActivityLabel(person), "Wartet");

  person.path = [{ q: 1, r: 0 }];
  assert.equal(personActivityLabel(person), "Unterwegs");
});

test("generic rerouting preserves a reached idle position", () => {
  const world = createWorld(1);
  const person = world.people[0]!;

  for (let i = 0; i < 600 && !(person.idleTarget && person.path.length === 0); i++) tick(world);

  assert.ok(person.idleTarget, "resident should have an idle target");
  assert.deepEqual(person.position, person.idleTarget);
  const idleTarget = { ...person.idleTarget };

  const roadTile = world.tiles.find(
    (tile) =>
      tile.terrain === "grass" &&
      (tile.q !== person.position.q || tile.r !== person.position.r),
  )!;
  assert.equal(setRoad(world, roadTile, true), true);

  assert.deepEqual(person.idleTarget, idleTarget);
  assert.equal(person.path.length, 0, "rerouting must not send the idle resident back to HQ");
  assert.deepEqual(person.position, idleTarget);
});

test("building pickup and dropoff each take three simulated seconds", () => {
  const world = createWorld(1);
  const source = buildAt(world, { q: 0, r: 0 }, "warehouse")!;
  const target = buildAt(world, { q: 4, r: 0 }, "sawmill")!;
  source.inventory!.wood = 1;

  assert.equal(changeAssignment(world, target.id, "worker", 1), true);
  const worker = assigned(world, target.id, "worker")[0]!;
  worker.position = { ...source.position };
  worker.path = [];
  worker.movement = 0;
  worker.active = false;
  worker.trip = {
    source: source.id,
    sourcePosition: { ...source.position },
    target: target.id,
    good: "wood",
    picked: false,
  };

  tick(world);
  assert.equal(source.inventory!.wood, 1);
  assert.equal(worker.trip?.picked, false);
  assert.equal(worker.trip?.transferUntilTick, world.round + CONFIG.transferDurationTicks);

  for (let i = 0; i < CONFIG.transferDurationTicks - 1; i++) tick(world);
  assert.equal(source.inventory!.wood, 1, "pickup must not happen before three seconds");

  tick(world);
  assert.equal(source.inventory!.wood, 0);
  assert.equal(worker.trip?.picked, true);
  assert.equal(worker.trip?.transferUntilTick, undefined);

  worker.position = { ...target.position };
  worker.path = [];
  worker.movement = 0;

  tick(world);
  assert.equal(target.input, 0);
  assert.equal(worker.trip?.transferUntilTick, world.round + CONFIG.transferDurationTicks);

  for (let i = 0; i < CONFIG.transferDurationTicks - 1; i++) tick(world);
  assert.equal(target.input, 0, "dropoff must not happen before three seconds");

  tick(world);
  assert.equal(target.input, 1);
  assert.equal(worker.trip, undefined);
});


test("picking up loose goods from the ground takes one simulated second", () => {
  const world = createWorld(1);
  const target = buildAt(world, { q: 4, r: 0 }, "sawmill")!;

  assert.equal(changeAssignment(world, target.id, "worker", 1), true);
  const worker = assigned(world, target.id, "worker")[0]!;
  worker.position = { q: 0, r: 0 };
  worker.path = [];
  worker.movement = 0;
  worker.active = false;

  world.looseGoods = [{
    id: "loose-good-1",
    position: { ...worker.position },
    good: "wood",
    amount: 1,
    reserved: 1,
  }];
  worker.trip = {
    source: "loose-good-1",
    sourceKind: "looseGood",
    sourcePosition: { ...worker.position },
    target: target.id,
    good: "wood",
    picked: false,
  };

  tick(world);
  assert.equal(world.looseGoods[0]?.amount, 1);
  assert.equal(worker.trip?.picked, false);
  assert.equal(worker.trip?.transferUntilTick, world.round + CONFIG.looseGoodPickupDurationTicks);

  for (let i = 0; i < CONFIG.looseGoodPickupDurationTicks - 1; i++) tick(world);
  assert.equal(world.looseGoods[0]?.amount, 1, "ground pickup must not happen before one second");

  tick(world);
  assert.equal(world.looseGoods?.length ?? 0, 0);
  assert.equal(worker.trip?.picked, true);
  assert.equal(worker.trip?.transferUntilTick, undefined);
});
