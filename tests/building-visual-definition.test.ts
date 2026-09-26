import assert from "node:assert/strict";
import test from "node:test";
import { validateBuildingVisualDefinition } from "../src/buildings/buildingVisualDefinition";

const validDefinition = () => ({
  schema: "civilizations-building-visual" as const,
  version: 4 as const,
  id: "bakery",
  levels: [{
    level: 1,
    sprite: "sprite.png",
    spriteAnchor: { x: 0.5, y: 0.75 },
    spriteWorldWidth: 52,
    footprint: [{ q: 0, r: 0 }, { q: 1, r: 0 }],
    blocked: [{ q: 0, r: 0 }],
    entrance: { q: 1, r: 0 },
  }],
});

test("building visual definition accepts a walkable entrance inside its footprint", () => {
  assert.deepEqual(validateBuildingVisualDefinition(validDefinition()), []);
});

test("building visual definition accepts normalized sprite anchor and positive world width", () => {
  const definition = validDefinition();
  definition.levels[0]!.spriteAnchor = { x: 0.519, y: 0.568 };
  definition.levels[0]!.spriteWorldWidth = 52;
  assert.deepEqual(validateBuildingVisualDefinition(definition), []);
});

test("building visual definition accepts local PNG and WebP sprite filenames", () => {
  const definition = validDefinition();
  definition.levels[0]!.sprite = "hq-master.webp";
  assert.deepEqual(validateBuildingVisualDefinition(definition), []);
});

test("building visual definition accepts independent levels", () => {
  const definition = validDefinition();
  definition.levels.push({
    ...definition.levels[0]!,
    level: 2,
    sprite: "sprite-2.webp",
    footprint: [{ q: 0, r: 0 }, { q: 1, r: 0 }, { q: 2, r: 0 }],
    entrance: { q: 2, r: 0 },
  });
  assert.deepEqual(validateBuildingVisualDefinition(definition), []);
});

test("building visual definition accepts sparse levels but rejects duplicate levels and sprites", () => {
  const sparse = validDefinition();
  sparse.levels.push({
    ...sparse.levels[0]!,
    level: 3,
    sprite: "sprite-3.png",
  });
  assert.deepEqual(validateBuildingVisualDefinition(sparse), []);

  const duplicate = validDefinition();
  duplicate.levels.push({
    ...duplicate.levels[0]!,
  });
  const errors = validateBuildingVisualDefinition(duplicate);
  assert.ok(errors.some((error) => error.includes("mehrfach definiert")));
  assert.ok(errors.some((error) => error.includes("mehreren Gebäudestufen")));
});

test("building visual definition rejects paths and unsupported sprite formats", () => {
  const definition = validDefinition();
  definition.levels[0]!.sprite = "../sprite.jpg";
  const errors = validateBuildingVisualDefinition(definition);
  assert.ok(errors.some((error) => error.includes("PNG- oder WebP")));
});

test("building visual definition rejects an anchor outside the normalized image range", () => {
  const definition = validDefinition();
  definition.levels[0]!.spriteAnchor = { x: 1.01, y: 0.5 };
  const errors = validateBuildingVisualDefinition(definition);
  assert.ok(errors.some((error) => error.includes("normalisiert")));
});

test("building visual definition rejects a non-positive world width", () => {
  const definition = validDefinition();
  definition.levels[0]!.spriteWorldWidth = 0;
  const errors = validateBuildingVisualDefinition(definition);
  assert.ok(errors.some((error) => error.includes("Sprite-Breite")));
});

test("building visual definition rejects a blocked entrance", () => {
  const definition = validDefinition();
  definition.levels[0]!.footprint = [{ q: 0, r: 0 }];
  definition.levels[0]!.blocked = [{ q: 0, r: 0 }];
  definition.levels[0]!.entrance = { q: 0, r: 0 };
  const errors = validateBuildingVisualDefinition(definition);
  assert.ok(errors.some((error) => error.includes("Eingang darf nicht blockiert")));
});
