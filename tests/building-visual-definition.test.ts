import assert from "node:assert/strict";
import test from "node:test";
import { validateBuildingVisualDefinition } from "../src/buildings/buildingVisualDefinition";

const validDefinition = () => ({
  schema: "civilizations-building-visual" as const,
  version: 3 as const,
  id: "bakery",
  sprite: "sprite.png",
  spriteAnchor: { x: 0.5, y: 0.75 },
  spriteWorldWidth: 52,
  footprint: [{ q: 0, r: 0 }, { q: 1, r: 0 }],
  blocked: [{ q: 0, r: 0 }],
  entrance: { q: 1, r: 0 },
});

test("building visual definition accepts a walkable entrance inside its footprint", () => {
  assert.deepEqual(validateBuildingVisualDefinition(validDefinition()), []);
});

test("building visual definition accepts normalized sprite anchor and positive world width", () => {
  const definition = validDefinition();
  definition.spriteAnchor = { x: 0.519, y: 0.568 };
  definition.spriteWorldWidth = 52;
  assert.deepEqual(validateBuildingVisualDefinition(definition), []);
});

test("building visual definition accepts authored PNG and WebP sprite filenames", () => {
  const definition = validDefinition();
  definition.sprite = "headquarter-highres.webp";
  assert.deepEqual(validateBuildingVisualDefinition(definition), []);
  definition.sprite = "hq_master.png";
  assert.deepEqual(validateBuildingVisualDefinition(definition), []);
});

test("building visual definition rejects sprite paths and unsupported image types", () => {
  const definition = validDefinition();
  definition.sprite = "../sprite.png";
  assert.ok(validateBuildingVisualDefinition(definition).some((error) => error.includes("Sprite-Dateiname")));
  definition.sprite = "sprite.jpg";
  assert.ok(validateBuildingVisualDefinition(definition).some((error) => error.includes("Sprite-Dateiname")));
});

test("building visual definition rejects an anchor outside the normalized image range", () => {
  const definition = validDefinition();
  definition.spriteAnchor = { x: 1.01, y: 0.5 };
  const errors = validateBuildingVisualDefinition(definition);
  assert.ok(errors.some((error) => error.includes("normalisiert")));
});

test("building visual definition rejects a non-positive world width", () => {
  const definition = validDefinition();
  definition.spriteWorldWidth = 0;
  const errors = validateBuildingVisualDefinition(definition);
  assert.ok(errors.some((error) => error.includes("Sprite-Breite")));
});

test("building visual definition rejects a blocked entrance", () => {
  const definition = validDefinition();
  definition.footprint = [{ q: 0, r: 0 }];
  definition.blocked = [{ q: 0, r: 0 }];
  definition.entrance = { q: 0, r: 0 };
  const errors = validateBuildingVisualDefinition(definition);
  assert.ok(errors.some((error) => error.includes("Eingang darf nicht blockiert")));
});
