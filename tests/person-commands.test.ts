import test from "node:test";
import assert from "node:assert/strict";
import type { Building } from "../src/simulation/model";
import { currentProfession } from "../src/simulation/experience";
import {
  orderPersonMove,
  setPersonHome,
  setPersonProfession,
  setPersonWorkplace,
  validHomes,
  validWorkplaces,
} from "../src/simulation/personCommands";
import { createWorld } from "../src/simulation/scenario";
import { tick } from "../src/simulation/simulation";
import { hexDistance } from "../src/simulation/spatial";
import { householdForPerson } from "../src/simulation/housing";

test("a person can receive profession, workplace and home independently", () => {
  const world = createWorld(1);
  const person = world.people[0]!;
  const sawmill: Building = {
    id: "personal-sawmill",
    kind: "sawmill",
    name: "Persönliches Sägewerk",
    position: { ...person.position },
    workers: 1,
    carriers: 0,
    input: 0,
    output: 0,
  };
  const house: Building = {
    id: "personal-house",
    kind: "house",
    name: "Persönliches Wohnhaus",
    position: { ...person.position },
    workers: 0,
    carriers: 0,
    input: 0,
    output: 0,
  };
  world.buildings.push(sawmill, house);
  person.experience = { woodcutter: 10 };

  assert.equal(setPersonProfession(world, person.id, "sawmillWorker"), true);
  assert.equal(currentProfession(world, person), "sawmillWorker");
  assert.equal(person.assignment, undefined);

  assert.deepEqual(validWorkplaces(world, person.id).map((building) => building.id), [sawmill.id]);
  assert.equal(setPersonWorkplace(world, person.id, sawmill.id), true);
  assert.deepEqual(person.assignment, { building: sawmill.id, role: "worker" });
  assert.equal(person.profession, "sawmillWorker");

  assert.deepEqual(validHomes(world, person.id).map((building) => building.id), [house.id]);
  assert.equal(setPersonHome(world, person.id, house.id), true);
  assert.equal(householdForPerson(world, person)?.homeId, house.id);
  assert.equal(world.people[0]!.assignment?.building, sawmill.id);
});

test("direct movement overrides normal behavior only until the chosen target is reached", () => {
  const world = createWorld(1);
  const person = world.people[0]!;
  const target = world.tiles
    .filter((tile) =>
      tile.terrain === "grass" &&
      !tile.resourceBlocking &&
      !tile.buildingBlocking,
    )
    .sort((a, b) => hexDistance(person.position, a) - hexDistance(person.position, b))
    .find((tile) => orderPersonMove(world, person.id, { q: tile.q, r: tile.r }));
  assert.ok(target, "expected a reachable free tile");

  assert.deepEqual(person.manualMoveTarget, { q: target.q, r: target.r });

  for (let step = 0; step < 300 && person.manualMoveTarget; step += 1) tick(world);

  assert.deepEqual(person.position, { q: target.q, r: target.r });
  assert.equal(person.manualMoveTarget, undefined);
});


test("an experienced hunter can become a tailor and be assigned to a tailor building", () => {
  const world = createWorld(1);
  const person = world.people[0]!;
  const tailor: Building = {
    id: "personal-tailor",
    kind: "tailor",
    name: "Persönliche Näherei",
    position: { ...person.position },
    workers: 1,
    carriers: 0,
    input: 0,
    output: 0,
  };
  world.buildings.push(tailor);
  person.experience = { hunter: 10 };

  assert.equal(setPersonProfession(world, person.id, "tailor"), true);
  assert.equal(currentProfession(world, person), "tailor");
  assert.deepEqual(validWorkplaces(world, person.id).map((building) => building.id), [tailor.id]);
  assert.equal(setPersonWorkplace(world, person.id, tailor.id), true);
  assert.deepEqual(person.assignment, { building: tailor.id, role: "worker" });
});


test("an experienced hunter can become a livestock breeder and be assigned to the livestock breeder building", () => {
  const world = createWorld(1);
  const person = world.people[0]!;
  const livestockBreeder: Building = {
    id: "personal-livestock-breeder",
    kind: "livestockBreeder",
    name: "Persönliche Viehzüchterei",
    position: { ...person.position },
    workers: 1,
    carriers: 2,
    input: 0,
    inputInventory: { wheat: 0, water: 0 },
    output: 0,
    recipe: { inputs: { wheat: 4, water: 4 }, amount: 1, duration: 600 },
  };
  world.buildings.push(livestockBreeder);
  person.experience = { hunter: 10 };

  assert.equal(setPersonProfession(world, person.id, "stockfarmer"), true);
  assert.equal(currentProfession(world, person), "stockfarmer");
  assert.deepEqual(
    validWorkplaces(world, person.id).map((building) => building.id),
    [livestockBreeder.id],
  );
  assert.equal(setPersonWorkplace(world, person.id, livestockBreeder.id), true);
  assert.deepEqual(person.assignment, { building: livestockBreeder.id, role: "worker" });
});
