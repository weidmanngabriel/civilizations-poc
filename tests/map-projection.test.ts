import assert from "node:assert/strict";
import test from "node:test";
import {
  HEX_RADIUS,
  HEX_X,
  HEX_Y,
  hexCornerOffsets,
  hexPolygonPoints,
  pixel,
} from "../src/game/mapProjection";

const closeTo = (actual: number, expected: number): void => {
  assert.ok(Math.abs(actual - expected) < 1e-10, `${actual} should be close to ${expected}`);
};

test("shared projection keeps axial cell centers on the runtime spacing", () => {
  const origin = pixel({ q: 0, r: 0 });
  const qNeighbor = pixel({ q: 1, r: 0 });
  const rNeighbor = pixel({ q: 0, r: 1 });

  closeTo(qNeighbor.x - origin.x, HEX_X);
  closeTo(qNeighbor.y - origin.y, 0);
  closeTo(rNeighbor.x - origin.x, HEX_X / 2);
  closeTo(rNeighbor.y - origin.y, HEX_Y);
});

test("shared hex corners reproduce the runtime hex radius", () => {
  const offsets = hexCornerOffsets();
  assert.equal(offsets.length, 6);
  for (const offset of offsets) {
    closeTo(Math.hypot(offset.x, offset.y), HEX_RADIUS);
  }
});

test("hex polygon points are the shared corner offsets around the projected center", () => {
  const cell = { q: 3, r: 2 };
  const center = pixel(cell);
  const points = hexPolygonPoints(cell);
  const offsets = hexCornerOffsets();

  assert.deepEqual(
    points,
    offsets.map((offset) => ({ x: center.x + offset.x, y: center.y + offset.y })),
  );
});
