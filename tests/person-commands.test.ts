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

  assert.equal(setPersonProfession(world, person.id, "sawmillWorker"), true);
  assert.equal(currentProfession(world, person), "sawmillWorker");
  assert.equal(person.assignment, undefined);

  assert.deepEqual(validWorkplaces(world, person.id).map((building) => building.id), [sawmill.id]);
  assert.equal(setPersonWorkplace(world, person.id, sawmill.id), true);
  assert.deepEqual(person.assignment, { building: sawmill.id, role: "worker" });
  assert.equal(person.profession, "sawmillWorker");

  assert.deepEqual(validHomes(world).map((building) => building.id), [house.id]);
  assert.equal(setPersonHome(world, person.id, house.id), true);
  assert.equal(person.home, house.id);
  assert.equal(person.assignment?.building, sawmill.id);
});

test("direct movement overrides normal behavior only until the chosen target is reached", () => {
  const world = createWorld(1);
  const person = world.people[0]!;
  const target = world.tiles.find((tile) =>
    tile.terrain === "grass" &&
    !tile.resourceBlocking &&
    !tile.buildingBlocking &&
    hexDistance(person.position, tile) === 1,
  );
  assert.ok(target, "expected a reachable neighboring tile");

  assert.equal(orderPersonMove(world, person.id, { q: target.q, r: target.r }), true);
  assert.deepEqual(person.manualMoveTarget, { q: target.q, r: target.r });

  for (let step = 0; step < 300 && person.manualMoveTarget; step += 1) tick(world);

  assert.deepEqual(person.position, { q: target.q, r: target.r });
  assert.equal(person.manualMoveTarget, undefined);
});
