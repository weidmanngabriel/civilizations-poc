import test from "node:test";
import assert from "node:assert/strict";
import { createWorld, CONFIG } from "../src/simulation/scenario";
import type { Building, NaturalResource } from "../src/simulation/model";
import {
  awardProfessionExperience,
  logisticsSpeedMultiplier,
  productionMultiplier,
  professionExperience,
} from "../src/simulation/experience";
import { tick } from "../src/simulation/simulation";

const almostEqual = (actual: number, expected: number, epsilon = 1e-6) =>
  assert.ok(Math.abs(actual - expected) < epsilon, `${actual} != ${expected}`);

test("profession experience gains exactly one point per completed action and caps at 100", () => {
  const person = createWorld(1).people[0]!;

  for (let action = 0; action < 99; action++)
    awardProfessionExperience(person, "woodcutter");
  assert.equal(professionExperience(person, "woodcutter"), 99);

  awardProfessionExperience(person, "woodcutter");
  assert.equal(professionExperience(person, "woodcutter"), 100);

  awardProfessionExperience(person, "woodcutter", 10);
  assert.equal(professionExperience(person, "woodcutter"), 100);
});

test("experience doubles production and caps logistics speed at plus 50 percent", () => {
  const person = createWorld(1).people[0]!;
  person.experience = { sawmillWorker: 100, carrier: 100, merchant: 50 };

  almostEqual(productionMultiplier(person, "sawmillWorker"), 2);
  almostEqual(logisticsSpeedMultiplier(person, "carrier"), 1.5);
  almostEqual(logisticsSpeedMultiplier(person, "merchant"), 1.25);
});

test("production XP is awarded only when a production cycle completes", () => {
  const world = createWorld(1);
  const person = world.people[0]!;
  const sawmill: Building = {
    id: "xp-sawmill",
    kind: "sawmill",
    name: "XP-Sägewerk",
    position: { ...person.position },
    workers: 1,
    carriers: 0,
    input: 2,
    output: 0,
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
  person.progress = CONFIG.duration - 2;

  tick(world);
  assert.equal(professionExperience(person, "sawmillWorker"), 0);
  assert.equal(person.progress, CONFIG.duration - 1);

  tick(world);
  assert.equal(professionExperience(person, "sawmillWorker"), 1);
  assert.equal(person.progress, 0);
});

test("natural-resource XP is awarded once per extracted unit", () => {
  const world = createWorld(1);
  const person = world.people[0]!;
  const resource: NaturalResource = {
    id: "xp-forest",
    kind: "forest",
    position: { ...person.position },
    remaining: 2,
    output: 0,
  };
  world.naturalResources.push(resource);
  const tile = world.tiles.find(
    (candidate) => candidate.q === person.position.q && candidate.r === person.position.r,
  )!;
  tile.terrain = "forest";
  person.woodcutter = true;
  person.resourceTarget = resource.id;
  person.active = true;
  person.progress = CONFIG.duration - 1;

  tick(world);

  assert.equal(resource.remaining, 1);
  assert.equal(professionExperience(person, "woodcutter"), 1);
});

test("carrier XP is awarded on successful delivery, not while merely moving", () => {
  const world = createWorld(1);
  const person = world.people[0]!;
  const target: Building = {
    id: "xp-warehouse",
    kind: "warehouse",
    name: "XP-Lager",
    position: { ...person.position },
    workers: 0,
    carriers: 1,
    merchants: 0,
    input: 0,
    output: 0,
    inventory: { wood: 0 },
  };
  world.buildings.push(target);
  person.assignment = { building: target.id, role: "carrier" };
  person.active = true;
  person.trip = {
    source: "hq",
    target: target.id,
    good: "wood",
    picked: true,
  };

  for (let i = 0; i <= CONFIG.transferDurationTicks; i++) tick(world);

  assert.equal(target.inventory?.wood, 1);
  assert.equal(professionExperience(person, "carrier"), 1);
});

test("builder gains one XP after one complete construction work cycle", () => {
  const world = createWorld(1);
  const person = world.people[0]!;
  const site: Building = {
    id: "xp-site",
    kind: "warehouse",
    name: "XP-Baustelle",
    position: { ...person.position },
    workers: 0,
    carriers: 2,
    merchants: 2,
    input: 0,
    output: 0,
    inventory: {},
    construction: {
      required: {},
      delivered: {},
      duration: CONFIG.duration * 2,
      progress: 0,
      complete: false,
    },
  };
  world.buildings.push(site);
  person.builder = true;
  person.assignment = { building: site.id, role: "builder" };
  person.active = true;

  for (let i = 0; i < CONFIG.duration - 1; i++) tick(world);
  assert.equal(professionExperience(person, "builder"), 0);

  tick(world);
  assert.equal(professionExperience(person, "builder"), 1);
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

  for (let i = 0; i <= CONFIG.transferDurationTicks; i++) tick(world);

  almostEqual(source.output, 3.7);
  assert.equal(person.trip?.picked, true);
  assert.equal(professionExperience(person, "carrier"), 0);
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
