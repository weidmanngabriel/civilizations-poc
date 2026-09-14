import { test } from "node:test";
import assert from "node:assert/strict";
import { buildWithFootprint, validBuildingAnchors } from "../src/simulation/buildingPlacement";
import { createDefaultGameWorld, createWorld } from "../src/simulation/scenario";
import { tick } from "../src/simulation/simulation";
import {
  IMPLEMENTED_TECHNOLOGIES,
  STARTING_TECHNOLOGIES,
  TECHNOLOGY_UNLOCK_RULES,
  isBuildingUnlocked,
  updateTechnologyUnlocks,
} from "../src/simulation/technology";

test("player-facing world starts with only the intended building technologies", () => {
  const world = createDefaultGameWorld();

  for (const technology of STARTING_TECHNOLOGIES)
    assert.equal(isBuildingUnlocked(world, technology), true);

  for (const rule of TECHNOLOGY_UNLOCK_RULES)
    assert.equal(isBuildingUnlocked(world, rule.technology), false);
});

test("every implemented profession rule unlocks at exactly ten XP and stays unlocked", () => {
  for (const rule of TECHNOLOGY_UNLOCK_RULES) {
    const world = createDefaultGameWorld();
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
