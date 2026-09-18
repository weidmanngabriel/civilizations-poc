import test from "node:test";
import assert from "node:assert/strict";
import { createDefaultGameWorld, createWorld } from "../src/simulation/scenario";
import { buildAt, tick } from "../src/simulation/simulation";
import { buildingFootprint } from "../src/simulation/buildingPlacement";
import { hexDistance, key } from "../src/simulation/hex";
import { syncIdleBehavior } from "../src/simulation/idleBehavior";

test("free people wait on distinct positions outside the HQ", () => {
  const world = createWorld();
  const hq = world.buildings.find((building) => building.id === "hq")!;
  const footprint = new Set(buildingFootprint(hq).map(key));

  syncIdleBehavior(world);

  const targets = world.people.map((person) => person.idleTarget).filter(Boolean);
  assert.ok(targets.length > 1);
  assert.equal(new Set(targets.map((target) => key(target!))).size, targets.length);
  for (const target of targets) {
    assert.equal(footprint.has(key(target!)), false);
    const distance = hexDistance(hq.position, target!);
    assert.ok(distance >= 2 && distance <= 4);
  }
});

test("an extractor without work waits around its personal work flag", () => {
  const world = createWorld();
  const person = world.people[0]!;
  person.woodcutter = true;
  person.workArea = { center: { q: 15, r: 10 }, radius: 12.5 };
  person.resourceTarget = undefined;
  person.path = [];
  person.active = false;

  syncIdleBehavior(world);

  assert.ok(person.idleTarget);
  const distance = hexDistance(person.workArea.center, person.idleTarget!);
  assert.ok(distance >= 2 && distance <= 4);
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


test("a fresh player game advances immediately and starts visible movement", () => {
  const world = createDefaultGameWorld();
  const beforeRound = world.round;

  tick(world);

  assert.equal(world.round, beforeRound + 1);
  assert.ok(world.people.some((person) => person.path.length > 0));
  assert.ok(world.people.some((person) => person.idleTarget));
});
