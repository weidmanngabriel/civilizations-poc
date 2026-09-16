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

test("shared projection keeps axial cell centers on the runtime spacing", () => {
  const origin = pixel({ q: 0, r: 0 });
  const qNeighbor = pixel({ q: 1, r: 0 });
  const rNeighbor = pixel({ q: 0, r: 1 });

  assert.equal(qNeighbor.x - origin.x, HEX_X);
  assert.equal(qNeighbor.y - origin.y, 0);
  assert.equal(rNeighbor.x - origin.x, HEX_X / 2);
  assert.equal(rNeighbor.y - origin.y, HEX_Y);
});

test("shared hex corners reproduce the runtime hex radius", () => {
  const offsets = hexCornerOffsets();
  assert.equal(offsets.length, 6);
  for (const offset of offsets) {
    assert.ok(Math.abs(Math.hypot(offset.x, offset.y) - HEX_RADIUS) < 1e-10);
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
