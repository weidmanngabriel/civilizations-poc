import test from "node:test";
import assert from "node:assert/strict";
import { createWorld } from "../src/simulation/scenario";
import { buildAt, removeBuilding } from "../src/simulation/simulation";
import { personInsideBuilding } from "../src/game/personVisibility";

test("a working person is hidden while inside a production building", () => {
  const world = createWorld();
  const workplace = buildAt(world, { q: 7, r: 4 }, "sawmill")!;
  const person = world.people[0]!;
  person.assignment = { building: workplace.id, role: "worker" };
  person.position = { ...workplace.position };
  person.path = [];
  person.active = true;
  person.progress = 10;

  assert.equal(personInsideBuilding(world, person), true);
});

test("demolishing a workplace immediately aborts and reveals an indoor worker", () => {
  const world = createWorld();
  const workplace = buildAt(world, { q: 7, r: 4 }, "sawmill")!;
  const person = world.people[0]!;
  person.assignment = { building: workplace.id, role: "worker" };
  person.position = { ...workplace.position };
  person.path = [];
  person.active = true;
  person.progress = 10;

  assert.equal(personInsideBuilding(world, person), true);
  assert.equal(removeBuilding(world, workplace.id), true);

  assert.equal(person.assignment, undefined);
  assert.equal(person.progress, 0);
  assert.equal(personInsideBuilding(world, person), false);
});
