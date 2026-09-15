import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { CONFIG, createDefaultGameWorld, createWorld } from "../src/simulation/scenario";
import {
  assigned,
  buildAt,
  changeAssignment,
  tick,
} from "../src/simulation/simulation";
import { hexDistance } from "../src/simulation/spatial";

test("starting woodcutters choose trees on the first simulation tick", () => {
  const world = createDefaultGameWorld();
  const woodcutters = world.people.filter((person) => person.woodcutter);

  assert.equal(woodcutters.length, 2);
  assert.ok(woodcutters.every((person) => person.resourceTarget === undefined));

  tick(world);

  assert.ok(woodcutters.every((person) => person.resourceTarget));
  assert.equal(new Set(woodcutters.map((person) => person.resourceTarget)).size, 2);
});

test("assigning a farmer defers the initial route search to the simulation tick", () => {
  const world = createWorld();
  const hq = world.buildings.find((building) => building.id === "hq")!;
  const farmTile = world.tiles.find(
    (tile) =>
      tile.terrain === "grass" &&
      hexDistance(tile, hq.position) >= CONFIG.spatialScale * 2,
  )!;
  const farm = buildAt(world, farmTile, "farm")!;

  assert.equal(changeAssignment(world, farm.id, "worker", 1), true);
  const farmer = assigned(world, farm.id, "worker")[0]!;
  assert.equal(farmer.path.length, 0);

  tick(world);

  assert.ok(farmer.active || farmer.path.length > 0);
});

test("mobile pinch zoom uses the ten-times camera limit", () => {
  const source = readFileSync(
    fileURLToPath(new URL("../src/game/mobileTouch.ts", import.meta.url)),
    "utf8",
  );
  assert.match(source, /const MAX_CAMERA_ZOOM = 10;/);
});
