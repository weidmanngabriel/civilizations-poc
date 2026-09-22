import assert from "node:assert/strict";
import test from "node:test";
import {
  buildWithFootprint,
  startBuildingUpgrade,
  validBuildingAnchors,
} from "../src/simulation/buildingPlacement";
import {
  isMaterialCheatEnabled,
  isTechnologyCheatEnabled,
  setMaterialCheatEnabled,
  setTechnologyCheatEnabled,
} from "../src/simulation/debugCheats";
import {
  createPalisadeSites,
  validPalisadePlanningAnchors,
} from "../src/simulation/palisades";
import { createDefaultGameWorld } from "../src/simulation/scenario";
import {
  isBuildingUnlocked,
  updateTechnologyUnlocks,
} from "../src/simulation/technology";

test("technology cheat unlocks buildings without mutating persistent unlock state", () => {
  const world = createDefaultGameWorld();
  assert.equal(isTechnologyCheatEnabled(world), false);
  assert.equal(isBuildingUnlocked(world, "sawmill"), false);
  const originalUnlocks = [...(world.unlockedTechnologies ?? [])];

  setTechnologyCheatEnabled(world, true);
  assert.equal(isTechnologyCheatEnabled(world), true);
  assert.equal(isBuildingUnlocked(world, "sawmill"), true);

  updateTechnologyUnlocks(world);
  assert.deepEqual(world.unlockedTechnologies, originalUnlocks);

  setTechnologyCheatEnabled(world, false);
  assert.equal(isBuildingUnlocked(world, "sawmill"), false);
});

test("material cheat pre-delivers materials for newly placed buildings", () => {
  const world = createDefaultGameWorld();
  assert.equal(isMaterialCheatEnabled(world), false);
  setMaterialCheatEnabled(world, true);

  const anchor = validBuildingAnchors(world, "house")[0];
  assert.ok(anchor);
  const building = buildWithFootprint(world, anchor, "house");
  assert.ok(building?.construction);
  assert.deepEqual(building.construction.delivered, building.construction.required);
  assert.equal(building.construction.complete, false);
});

test("material cheat pre-delivers wood for newly placed palisades", () => {
  const world = createDefaultGameWorld();
  setMaterialCheatEnabled(world, true);

  const position = validPalisadePlanningAnchors(world)[0];
  assert.ok(position);
  const [palisade] = createPalisadeSites(world, [position]);
  assert.ok(palisade?.construction);
  assert.deepEqual(palisade.construction.delivered, { wood: 1 });
  assert.equal(palisade.construction.complete, false);
});

test("material cheat pre-delivers materials for newly started upgrades", () => {
  const world = createDefaultGameWorld();
  setTechnologyCheatEnabled(world, true);
  setMaterialCheatEnabled(world, true);

  const targetAnchors = new Set(validBuildingAnchors(world, "pottery2").map((position) => `${position.q},${position.r}`));
  const anchor = validBuildingAnchors(world, "pottery")
    .find((position) => targetAnchors.has(`${position.q},${position.r}`));
  assert.ok(anchor);

  const building = buildWithFootprint(world, anchor, "pottery");
  assert.ok(building);
  assert.ok(building.construction);
  building.construction.complete = true;
  building.construction.progress = building.construction.duration;

  assert.equal(startBuildingUpgrade(world, building), true);
  assert.ok(building.construction);
  assert.deepEqual(building.construction.delivered, building.construction.required);
  assert.equal(building.construction.complete, false);
});
