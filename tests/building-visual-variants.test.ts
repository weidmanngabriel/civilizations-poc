import assert from "node:assert/strict";
import test from "node:test";
import {
  BUILDING_VISUAL_VARIANTS,
  buildingVisualVariant,
  buildingVisualVariantKey,
} from "../src/buildings/buildingVisualVariants";

test("game owns the five residential visual variants", () => {
  assert.deepEqual(
    BUILDING_VISUAL_VARIANTS
      .filter((variant) => variant.kind === "house")
      .map((variant) => variant.level),
    [1, 2, 3, 4, 5],
  );
  assert.equal(buildingVisualVariant("house", 5)?.label, "Wohnhaus 5");
});

test("tier-two production buildings are exposed as normal editor variants", () => {
  assert.equal(buildingVisualVariant("pottery", 1)?.label, "Töpferei 1");
  assert.equal(buildingVisualVariant("pottery2", 1)?.label, "Töpferei 2");
  assert.equal(buildingVisualVariant("stonemason", 1)?.label, "Steinmetzhütte 1");
  assert.equal(buildingVisualVariant("stonemason2", 1)?.label, "Steinmetzhütte 2");
});

test("visual variant keys are unique", () => {
  const keys = BUILDING_VISUAL_VARIANTS.map(buildingVisualVariantKey);
  assert.equal(new Set(keys).size, keys.length);
});
