import assert from "node:assert/strict";
import test from "node:test";
import {
  DESKTOP_TAP_MAX_DISTANCE,
  MOBILE_LONG_PRESS_MS,
  MOBILE_TAP_MAX_DISTANCE,
  isWithinTapDistance,
} from "../src/game/mapInputGestures";

test("desktop click tolerance remains compact", () => {
  assert.equal(DESKTOP_TAP_MAX_DISTANCE, 8);
  assert.equal(
    isWithinTapDistance({ x: 10, y: 10 }, { x: 16, y: 14 }, DESKTOP_TAP_MAX_DISTANCE),
    true,
  );
  assert.equal(
    isWithinTapDistance({ x: 10, y: 10 }, { x: 19, y: 10 }, DESKTOP_TAP_MAX_DISTANCE),
    false,
  );
});

test("touch keeps a larger movement tolerance and a deliberate long press delay", () => {
  assert.equal(MOBILE_TAP_MAX_DISTANCE, 18);
  assert.equal(MOBILE_LONG_PRESS_MS, 450);
  assert.equal(
    isWithinTapDistance({ x: 20, y: 20 }, { x: 35, y: 29 }, MOBILE_TAP_MAX_DISTANCE),
    true,
  );
  assert.equal(
    isWithinTapDistance({ x: 20, y: 20 }, { x: 39, y: 20 }, MOBILE_TAP_MAX_DISTANCE),
    false,
  );
});
