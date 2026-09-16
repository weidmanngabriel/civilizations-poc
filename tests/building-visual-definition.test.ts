import assert from "node:assert/strict";
import test from "node:test";
import { validateBuildingVisualDefinition } from "../src/buildings/buildingVisualDefinition";

test("building visual definition accepts a walkable entrance inside its footprint", () => {
  const errors = validateBuildingVisualDefinition({
    schema: "civilizations-building-visual",
    version: 1,
    id: "bakery",
    sprite: "sprite.png",
    spriteAnchor: { x: 64, y: 96 },
    footprint: [{ q: 0, r: 0 }, { q: 1, r: 0 }],
    blocked: [{ q: 0, r: 0 }],
    entrance: { q: 1, r: 0 },
  });
  assert.deepEqual(errors, []);
});

test("building visual definition accepts a positive sprite scale", () => {
  const errors = validateBuildingVisualDefinition({
    schema: "civilizations-building-visual",
    version: 1,
    id: "hq",
    sprite: "sprite.webp",
    spriteAnchor: { x: 512, y: 800 },
    spriteScale: 0.22,
    footprint: [{ q: 0, r: 0 }],
    blocked: [],
    entrance: { q: 0, r: 0 },
  });
  assert.deepEqual(errors, []);
});

test("building visual definition rejects a non-positive sprite scale", () => {
  const errors = validateBuildingVisualDefinition({
    schema: "civilizations-building-visual",
    version: 1,
    id: "hq",
    sprite: "sprite.png",
    spriteAnchor: { x: 64, y: 96 },
    spriteScale: 0,
    footprint: [{ q: 0, r: 0 }],
    blocked: [],
    entrance: { q: 0, r: 0 },
  });
  assert.ok(errors.some((error) => error.includes("Sprite-Skalierung")));
});

test("building visual definition rejects a blocked entrance", () => {
  const errors = validateBuildingVisualDefinition({
    schema: "civilizations-building-visual",
    version: 1,
    id: "bakery",
    sprite: "sprite.png",
    spriteAnchor: { x: 64, y: 96 },
    footprint: [{ q: 0, r: 0 }],
    blocked: [{ q: 0, r: 0 }],
    entrance: { q: 0, r: 0 },
  });
  assert.ok(errors.some((error) => error.includes("Eingang darf nicht blockiert")));
});
