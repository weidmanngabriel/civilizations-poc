import { test } from "node:test";
import assert from "node:assert/strict";
import { createWorld } from "../src/simulation/scenario";
import { personActivityLabel, personProfessionLabel } from "../src/personPresentation";

test("person presentation labels expose profession and current activity", () => {
  const world = createWorld(1);
  const person = world.people[0]!;

  assert.equal(personProfessionLabel(world, person), "Frei");
  assert.equal(personActivityLabel(person), "Wartet");

  person.path = [{ q: person.position.q + 1, r: person.position.r }];
  assert.equal(personActivityLabel(person), "Unterwegs");

  person.path = [];
  person.woodcutter = true;
  assert.equal(personProfessionLabel(world, person), "Abbauer Holz");

  person.active = true;
  assert.equal(personActivityLabel(person), "Arbeitet");
});


test("hunger presentation distinguishes searching, walking, returning and eating", () => {
  const world = createWorld(1);
  const person = world.people[0]!;

  person.hungerState = { resumeActive: false };
  person.path = [];
  assert.equal(personActivityLabel(person), "Sucht Essen");

  person.path = [{ q: person.position.q + 1, r: person.position.r }];
  assert.equal(personActivityLabel(person), "Geht essen");

  person.hungerState.returningToWorkAreaForFood = true;
  assert.equal(personActivityLabel(person), "Geht zur Jagdflagge");

  person.path = [];
  assert.equal(personActivityLabel(person), "Sucht Essen");

  person.hungerState.returningToWorkAreaForFood = undefined;
  person.hungerState.eatingUntilTick = 123;
  assert.equal(personActivityLabel(person), "Isst");
});
