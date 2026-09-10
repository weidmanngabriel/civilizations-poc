import test from "node:test";
import assert from "node:assert/strict";
import { createWorld, CONFIG } from "../src/simulation/scenario";
import type { Building } from "../src/simulation/model";
import {
  gainProfessionExperience,
  logisticsSpeedMultiplier,
  productionMultiplier,
  professionExperience,
} from "../src/simulation/experience";
import { tick } from "../src/simulation/simulation";

const almostEqual = (actual: number, expected: number, epsilon = 1e-6) =>
  assert.ok(Math.abs(actual - expected) < epsilon, `${actual} != ${expected}`);

test("profession experience slows down toward 100 percent but remains reachable", () => {
  const person = createWorld(1).people[0]!;

  gainProfessionExperience(person, "woodcutter", 10 * 60 * CONFIG.simulationHz);
  almostEqual(professionExperience(person, "woodcutter"), 50);

  gainProfessionExperience(person, "woodcutter", 20 * 60 * CONFIG.simulationHz);
  almostEqual(professionExperience(person, "woodcutter"), 80);

  gainProfessionExperience(person, "woodcutter", 30 * 60 * CONFIG.simulationHz);
  almostEqual(professionExperience(person, "woodcutter"), 95);

  gainProfessionExperience(person, "woodcutter", 30 * 60 * CONFIG.simulationHz);
  almostEqual(professionExperience(person, "woodcutter"), 100);
});

test("experience doubles production and caps logistics speed at plus 50 percent", () => {
  const person = createWorld(1).people[0]!;
  person.experience = { sawmillWorker: 100, carrier: 100, merchant: 50 };

  almostEqual(productionMultiplier(person, "sawmillWorker"), 2);
  almostEqual(logisticsSpeedMultiplier(person, "carrier"), 1.5);
  almostEqual(logisticsSpeedMultiplier(person, "merchant"), 1.25);
});

test("experienced production creates fractional output and may overflow output capacity", () => {
  const world = createWorld(1);
  const person = world.people[0]!;
  const sawmill: Building = {
    id: "test-sawmill",
    kind: "sawmill",
    name: "Test-Sägewerk",
    position: { ...person.position },
    workers: 1,
    carriers: 0,
    input: 2,
    output: 2.8,
    recipe: {
      input: "wood",
      amount: 2,
      output: "plank",
      duration: CONFIG.duration,
    },
  };
  world.buildings.push(sawmill);
  person.assignment = { building: sawmill.id, role: "worker" };
  person.active = true;
  person.progress = CONFIG.duration - 1;
  person.experience = { sawmillWorker: 100 };

  tick(world);

  almostEqual(sawmill.output, 4.8);
  assert.equal(person.progress, 0);

  tick(world);
  assert.equal(person.progress, 0, "no new batch starts while output is above capacity");
});

test("transport still removes exactly one unit from fractional stock", () => {
  const world = createWorld(1);
  const person = world.people[0]!;
  const source: Building = {
    id: "source",
    kind: "sawmill",
    name: "Quelle",
    position: { ...person.position },
    workers: 0,
    carriers: 0,
    input: 0,
    output: 4.7,
    recipe: { input: "wood", amount: 2, output: "plank", duration: CONFIG.duration },
  };
  const target: Building = {
    id: "target",
    kind: "warehouse",
    name: "Lager",
    position: { ...person.position },
    workers: 0,
    carriers: 1,
    merchants: 0,
    input: 0,
    output: 0,
    inventory: { plank: 0 },
  };
  world.buildings.push(source, target);
  person.assignment = { building: target.id, role: "carrier" };
  person.active = true;
  person.trip = { source: source.id, target: target.id, good: "plank", picked: false };

  tick(world);

  almostEqual(source.output, 3.7);
  assert.equal(person.trip?.picked, true);
});

test("fractional remainder below one unit is not reserved for transport", () => {
  const world = createWorld(1);
  const person = world.people[0]!;
  const source: Building = {
    id: "small-source",
    kind: "sawmill",
    name: "Kleine Quelle",
    position: { q: person.position.q + 1, r: person.position.r },
    workers: 0,
    carriers: 0,
    input: 0,
    output: 0.7,
    recipe: { input: "wood", amount: 2, output: "plank", duration: CONFIG.duration },
  };
  const target: Building = {
    id: "collector",
    kind: "warehouse",
    name: "Sammellager",
    position: { ...person.position },
    workers: 0,
    carriers: 1,
    merchants: 0,
    input: 0,
    output: 0,
    inventory: { plank: 0 },
  };
  world.buildings.push(source, target);
  person.assignment = { building: target.id, role: "carrier" };
  person.active = true;

  tick(world);

  assert.equal(person.trip, undefined);
});

test("experienced carrier gains movement speed without changing carry capacity", () => {
  const world = createWorld(1);
  const person = world.people[0]!;
  const next = { q: person.position.q + 1, r: person.position.r };
  person.assignment = { building: "hq", role: "carrier" };
  person.trip = { source: "hq", target: "hq", good: "wood", picked: true };
  person.path = [next];
  person.experience = { carrier: 100 };

  tick(world);

  almostEqual(person.movement, CONFIG.movementPerTick * 1.5);
});
