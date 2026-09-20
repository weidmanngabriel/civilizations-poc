import { test } from "node:test";
import assert from "node:assert/strict";
import {
  BUILDING_CONSTRUCTION_REQUIREMENTS,
} from "../src/simulation/constructionRules";
import {
  buildWithFootprint,
  canPlaceBuilding,
  canUpgradeBuilding,
  startBuildingUpgrade,
  upgradePlacementBlockers,
} from "../src/simulation/buildingPlacement";
import { setBuildingRecipe } from "../src/simulation/simulation";
import { createTestWorld } from "./testWorld";

const placeCompleted = (
  kind: "pottery" | "stonemason",
) => {
  const world = createTestWorld({ width: 48, height: 36, population: 2 });
  const anchor = world.tiles.find((tile) => canPlaceBuilding(world, tile, kind));
  assert.ok(anchor);
  const building = buildWithFootprint(world, anchor!, kind);
  assert.ok(building?.construction);
  building!.construction!.complete = true;
  return { world, building: building! };
};

test("tier-two direct construction costs equal stage one plus the upgrade", () => {
  assert.deepEqual(BUILDING_CONSTRUCTION_REQUIREMENTS.pottery2, {
    wood: 6,
    rubble: 2,
    brick: 2,
  });
  assert.deepEqual(BUILDING_CONSTRUCTION_REQUIREMENTS.stonemason2, {
    wood: 6,
    rubble: 2,
    stoneBlock: 2,
  });
});

test("pottery upgrades in place and pays only the upgrade materials", () => {
  const { world, building } = placeCompleted("pottery");
  const id = building.id;
  const positionBefore = { ...building.position };

  assert.deepEqual(upgradePlacementBlockers(world, building), []);
  assert.equal(canUpgradeBuilding(world, building), true);
  assert.equal(startBuildingUpgrade(world, building), true);

  assert.equal(building.id, id);
  assert.equal(building.kind, "pottery2");
  assert.deepEqual(building.position, positionBefore);
  assert.deepEqual(building.construction?.required, {
    wood: 2,
    rubble: 2,
    brick: 2,
  });
  assert.deepEqual(
    building.availableRecipes?.map((recipe) => recipe.output),
    ["brick", "roofTile"],
  );
});

test("stonemason upgrades in place and gains the marble recipe", () => {
  const { world, building } = placeCompleted("stonemason");

  assert.equal(startBuildingUpgrade(world, building), true);
  assert.equal(building.kind, "stonemason2");
  assert.deepEqual(building.construction?.required, {
    wood: 2,
    rubble: 2,
    stoneBlock: 2,
  });
  assert.deepEqual(
    building.availableRecipes?.map((recipe) => recipe.output),
    ["stoneBlock", "marble"],
  );
});

test("tier-two recipe switching waits for the current output to clear", () => {
  const world = createTestWorld({ width: 48, height: 36 });
  const anchor = world.tiles.find((tile) => canPlaceBuilding(world, tile, "pottery2"));
  assert.ok(anchor);
  const building = buildWithFootprint(world, anchor!, "pottery2");
  assert.ok(building);
  building!.construction!.complete = true;

  assert.equal(setBuildingRecipe(world, building!.id, "roofTile"), true);
  assert.equal(building!.recipe?.output, "roofTile");

  building!.output = 1;
  assert.equal(setBuildingRecipe(world, building!.id, "brick"), false);
  assert.equal(building!.recipe?.output, "roofTile");

  building!.output = 0;
  assert.equal(setBuildingRecipe(world, building!.id, "brick"), true);
  assert.equal(building!.recipe?.output, "brick");
});
