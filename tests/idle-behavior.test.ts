import test from "node:test";
import assert from "node:assert/strict";
import { createWorld } from "../src/simulation/scenario";
import { buildAt, tick } from "../src/simulation/simulation";
import { buildingFootprint } from "../src/simulation/buildingPlacement";
import { hexDistance, key } from "../src/simulation/hex";
import { syncIdleBehavior } from "../src/simulation/idleBehavior";

test("free people stay where they are when idle", () => {
  const world = createWorld();
  const positions = world.people.map((person) => ({ ...person.position }));

  syncIdleBehavior(world);

  for (const [index, person] of world.people.entries()) {
    assert.equal(person.idleTarget, undefined);
    assert.equal(person.path.length, 0);
    assert.deepEqual(person.position, positions[index]);
  }
});

test("generic idle behavior leaves an extractor waiting at its personal work flag", () => {
  const world = createWorld();
  const person = world.people[0]!;
  person.woodcutter = true;
  person.workArea = { center: { q: 15, r: 10 }, radius: 12.5 };
  person.position = { ...person.workArea.center };
  person.resourceTarget = undefined;
  person.path = [];
  person.idleTarget = undefined;
  person.active = false;

  syncIdleBehavior(world);

  assert.equal(person.idleTarget, undefined);
  assert.equal(person.path.length, 0);
  assert.deepEqual(person.position, person.workArea.center);
});

test("an idle production worker waits outside the assigned workplace", () => {
  const world = createWorld();
  const workplace = buildAt(world, { q: 7, r: 4 }, "sawmill")!;
  const person = world.people[0]!;
  person.assignment = { building: workplace.id, role: "worker" };
  person.position = { ...workplace.position };
  person.path = [];
  person.active = true;
  person.progress = 0;

  syncIdleBehavior(world);

  assert.ok(person.idleTarget);
  const footprint = new Set(buildingFootprint(workplace).map(key));
  assert.equal(footprint.has(key(person.idleTarget!)), false);
  const distance = hexDistance(workplace.position, person.idleTarget!);
  assert.ok(distance >= 2 && distance <= 4);
});


test("a fresh idle world advances without sending residents toward the HQ", () => {
  const world = createWorld();
  const beforeRound = world.round;
  const positions = world.people.map((person) => ({ ...person.position }));

  tick(world);

  assert.equal(world.round, beforeRound + 1);
  for (const [index, person] of world.people.entries()) {
    assert.equal(person.idleTarget, undefined);
    assert.equal(person.path.length, 0);
    assert.deepEqual(person.position, positions[index]);
  }
});
