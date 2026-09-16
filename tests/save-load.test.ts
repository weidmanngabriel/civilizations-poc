import test from "node:test";
import assert from "node:assert/strict";
import { createDefaultGameWorld } from "../src/simulation/scenario";
import {
  createSaveGame,
  deserializeSaveGame,
  replaceWorldState,
  serializeSaveGame,
} from "../src/simulation/saveGame";

const jsonState = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

test("save/load roundtrip preserves the complete authoritative JSON world state", () => {
  const world = createDefaultGameWorld();
  const person = world.people[0]!;
  const target = world.buildings.find((building) => building.id === "hq")!;

  world.round = 48291;
  world.rngState = 123456789;
  world.unlockedTechnologies = ["farm", "sawmill", "carpenter"];
  person.experience = { woodcutter: 13, carpenter: 7 };
  person.experienceActionProgress = { woodcutter: 0.5 };
  person.path = [{ q: person.position.q + 1, r: person.position.r }];
  person.movement = 0.375;
  person.trip = {
    source: target.id,
    target: target.id,
    good: "wood",
    picked: true,
  };

  const json = serializeSaveGame(world, new Date("2026-09-16T04:46:00.000Z"));
  const loaded = deserializeSaveGame(json);

  assert.deepEqual(loaded, jsonState(world));
});

test("save format exposes readable string ids and current activities", () => {
  const world = createDefaultGameWorld();
  const person = world.people[0]!;
  person.path = [{ q: person.position.q + 1, r: person.position.r }];

  const save = createSaveGame(world, new Date("2026-09-16T04:46:00.000Z"));

  assert.equal(save.format, "civilizations-save");
  assert.equal(save.version, 1);
  assert.equal(save.world.people[0]!.id, `person-${person.id}`);
  assert.equal(save.world.people[0]!.activity, "moving");
  assert.match(save.world.tiles[0]!.id, /^tile--?\d+--?\d+$/);
});

test("replaceWorldState keeps the shared world object but replaces its JSON snapshot", () => {
  const target = createDefaultGameWorld();
  const source = createDefaultGameWorld();
  const sameReference = target;

  source.round = 99;
  source.unlockedTechnologies = ["well", "bakery"];
  source.people[0]!.experience = { baker: 42 };

  replaceWorldState(target, source);

  assert.equal(target, sameReference);
  assert.deepEqual(target, jsonState(source));
  source.people[0]!.experience!.baker = 1;
  assert.equal(target.people[0]!.experience!.baker, 42);
});
