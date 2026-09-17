import { test } from "node:test";
import assert from "node:assert/strict";
import { buildWithFootprint, validBuildingAnchors } from "../src/simulation/buildingPlacement";
import type { Building, PlaceableBuildingKind, World } from "../src/simulation/model";
import { createDefaultGameWorld, createWorld } from "../src/simulation/scenario";
import { tick } from "../src/simulation/simulation";
import { requiredProductionBuildings } from "../src/simulation/constructionRules";
import {
  IMPLEMENTED_TECHNOLOGIES,
  STARTING_TECHNOLOGIES,
  TECHNOLOGY_UNLOCK_RULES,
  isBuildingUnlocked,
  updateTechnologyUnlocks,
} from "../src/simulation/technology";

const addCompletedBuilding = (
  world: World,
  kind: PlaceableBuildingKind,
  complete = true,
): Building => {
  const building: Building = {
    id: `test-${kind}-${world.buildings.length}`,
    kind,
    name: kind,
    position: { q: 0, r: 0 },
    workers: 0,
    carriers: 0,
    input: 0,
    output: 0,
    construction: {
      required: {},
      delivered: {},
      duration: 1,
      progress: complete ? 1 : 0,
      complete,
    },
  };
  world.buildings.push(building);
  return building;
};

test("player-facing world starts with only the intended building technologies", () => {
  const world = createDefaultGameWorld();

  for (const technology of IMPLEMENTED_TECHNOLOGIES)
    assert.equal(
      isBuildingUnlocked(world, technology),
      STARTING_TECHNOLOGIES.includes(technology),
      `${technology} has the wrong initial unlock state`,
    );
});

test("profession rules unlock at exactly ten XP once construction-chain prerequisites exist", () => {
  for (const rule of TECHNOLOGY_UNLOCK_RULES) {
    const world = createDefaultGameWorld();
    for (const prerequisite of requiredProductionBuildings(rule.technology))
      addCompletedBuilding(world, prerequisite);

    const person = world.people[0]!;
    person.experience = { [rule.profession]: rule.threshold - 1 };

    updateTechnologyUnlocks(world);
    assert.equal(isBuildingUnlocked(world, rule.technology), false, `${rule.technology} must stay locked at 9 XP`);

    person.experience[rule.profession] = rule.threshold;
    updateTechnologyUnlocks(world);
    assert.equal(isBuildingUnlocked(world, rule.technology), true, `${rule.technology} must unlock at 10 XP`);

    world.people.splice(0, 1);
    updateTechnologyUnlocks(world);
    assert.equal(isBuildingUnlocked(world, rule.technology), true, `${rule.technology} must remain permanently unlocked`);
  }
});

test("well unlocks only after a completed stonemason exists", () => {
  const world = createDefaultGameWorld();
  world.people[0]!.experience = { stonecutter: 10 };
  updateTechnologyUnlocks(world);
  assert.equal(isBuildingUnlocked(world, "stonemason"), true);
  assert.equal(isBuildingUnlocked(world, "well"), false);

  const stonemason = addCompletedBuilding(world, "stonemason", false);
  updateTechnologyUnlocks(world);
  assert.equal(isBuildingUnlocked(world, "well"), false, "construction sites must not satisfy the prerequisite");

  stonemason.construction!.complete = true;
  updateTechnologyUnlocks(world);
  assert.equal(isBuildingUnlocked(world, "well"), true);

  world.buildings.splice(world.buildings.indexOf(stonemason), 1);
  updateTechnologyUnlocks(world);
  assert.equal(isBuildingUnlocked(world, "well"), true, "the unlock must remain permanent");
});

test("bakery needs its profession and every processed construction-good producer", () => {
  const world = createDefaultGameWorld();
  world.people[0]!.experience = { miller: 10 };

  addCompletedBuilding(world, "sawmill");
  updateTechnologyUnlocks(world);
  assert.equal(isBuildingUnlocked(world, "bakery"), false, "brick production is still missing");

  addCompletedBuilding(world, "pottery");
  updateTechnologyUnlocks(world);
  assert.equal(isBuildingUnlocked(world, "bakery"), true);
});

test("simulation tick evaluates existing XP and unlocks the matching technology", () => {
  const world = createDefaultGameWorld();
  world.people[0]!.experience = { woodcutter: 10 };
  assert.equal(isBuildingUnlocked(world, "sawmill"), false);

  tick(world);

  assert.equal(isBuildingUnlocked(world, "sawmill"), true);
});

test("locked technologies expose no valid building anchors and unlock into normal placement", () => {
  const world = createDefaultGameWorld();
  assert.deepEqual(validBuildingAnchors(world, "sawmill"), []);

  world.people[0]!.experience = { woodcutter: 10 };
  updateTechnologyUnlocks(world);
  const anchors = validBuildingAnchors(world, "sawmill");
  assert.ok(anchors.length > 0);

  const building = buildWithFootprint(world, anchors[0]!, "sawmill");
  assert.equal(building?.kind, "sawmill");
});

test("neutral test worlds stay permissive for low-level simulation scenarios", () => {
  const world = createWorld();
  assert.equal(world.unlockedTechnologies, undefined);
  for (const technology of IMPLEMENTED_TECHNOLOGIES)
    assert.equal(isBuildingUnlocked(world, technology), true);
});
