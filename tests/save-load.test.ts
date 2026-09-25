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

test("save/load roundtrip reconstructs the complete authoritative JSON world state", () => {
  const world = createDefaultGameWorld();
  const person = world.people[0]!;
  const target = world.buildings.find((building) => building.id === "hq")!;
  const roadTile = world.tiles.find(
    (tile) =>
      tile.terrain === "grass" &&
      !tile.bush &&
      !tile.resourceBlocking &&
      !tile.buildingBlocking,
  )!;

  world.round = 48291;
  world.rngState = 123456789;
  world.simulationSpeed = 7.4;
  world.unlockedTechnologies = ["farm", "sawmill", "carpenter"];
  roadTile.terrain = "road";
  roadTile.trafficTicks = [48280, 48290];
  target.storedEquipment = [{ good: "shoes", durability: 1875 }];
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

test("save format stores entities by interaction position without tile or footprint snapshots", () => {
  const world = createDefaultGameWorld();
  const person = world.people[0]!;
  person.path = [{ q: person.position.q + 1, r: person.position.r }];

  const save = createSaveGame(world, new Date("2026-09-16T04:46:00.000Z"));
  const savedHq = save.world.buildings.find((building) => building.id === "hq")!;
  const serialized = JSON.parse(JSON.stringify(save)) as Record<string, any>;

  assert.equal(save.format, "civilizations-save");
  assert.equal(save.version, 7);
  assert.equal(save.world.people[0]!.id, `person-${person.id}`);
  assert.equal(save.world.people[0]!.activity, "moving");
  assert.deepEqual(savedHq.position, world.buildings[0]!.position);
  assert.equal("footprint" in savedHq, false);
  assert.equal("baseTerrain" in savedHq, false);
  assert.equal("baseTerrains" in savedHq, false);
  assert.equal("tiles" in serialized.world, false);
  assert.ok(Array.isArray(serialized.world.map.roads));
  assert.ok(Array.isArray(serialized.world.map.bushes));
});

test("old save versions are rejected instead of migrated", () => {
  const oldSave = createSaveGame(createDefaultGameWorld());
  const parsed = JSON.parse(JSON.stringify(oldSave));
  parsed.version = 6;

  assert.throws(
    () => deserializeSaveGame(JSON.stringify(parsed)),
    /Spielstand-Version 6 wird nicht unterstützt/,
  );
});

test("save rejects an invalid custom simulation speed", () => {
  const save = createSaveGame(createDefaultGameWorld());
  const parsed = JSON.parse(JSON.stringify(save));
  parsed.world.simulationSpeed = 10.01;

  assert.throws(
    () => deserializeSaveGame(JSON.stringify(parsed)),
    /keinen gültigen Simulationszustand/,
  );
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
