import test from "node:test";
import assert from "node:assert/strict";
import type { Building } from "../src/simulation/model";
import {
  isInfrastructureBuilding,
  isInfrastructureKind,
  isManagedBuilding,
  isManagedBuildingKind,
  managedBuildings,
} from "../src/simulation/structureKinds";
import { createTestWorld } from "./testWorld";

const building = (kind: Building["kind"], retired = false): Building => ({
  id: `test-${kind}`,
  kind,
  name: kind,
  position: { q: 0, r: 0 },
  workers: 0,
  carriers: 0,
  input: 0,
  output: 0,
  retired,
});

test("palisade is infrastructure, not a managed building", () => {
  const palisade = building("palisade");
  assert.equal(isInfrastructureKind(palisade.kind), true);
  assert.equal(isInfrastructureBuilding(palisade), true);
  assert.equal(isManagedBuildingKind(palisade.kind), false);
  assert.equal(isManagedBuilding(palisade), false);
});

test("normal buildings remain managed while fields stay outside both categories", () => {
  const warehouse = building("warehouse");
  const field = building("field");
  assert.equal(isManagedBuilding(warehouse), true);
  assert.equal(isInfrastructureBuilding(warehouse), false);
  assert.equal(isManagedBuildingKind(field.kind), false);
  assert.equal(isInfrastructureKind(field.kind), false);
});

test("retired buildings are not part of the managed building UI set", () => {
  assert.equal(isManagedBuilding(building("bakery", true)), false);
});


test("managed building collection excludes palisades from normal building lists", () => {
  const world = createTestWorld({ width: 20, height: 12, population: 0 });
  world.buildings.push(
    building("warehouse"),
    building("palisade"),
    building("palisade"),
  );

  const managed = managedBuildings(world);
  assert.ok(managed.some((entry) => entry.kind === "warehouse"));
  assert.equal(managed.some((entry) => entry.kind === "palisade"), false);
});
