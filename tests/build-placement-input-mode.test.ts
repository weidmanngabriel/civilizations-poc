import assert from "node:assert/strict";
import test from "node:test";
import { buildPlacementInputModeForPointer } from "../src/game/buildPlacementInputMode";

test("mouse input selects desktop build placement controls", () => {
  assert.equal(buildPlacementInputModeForPointer("mouse", false), "desktop");
});

test("touch and pen input keep explicit build confirmation", () => {
  assert.equal(buildPlacementInputModeForPointer("touch", true), "touch");
  assert.equal(buildPlacementInputModeForPointer("pen", true), "touch");
});

test("media capability is only a fallback before a pointer is known", () => {
  assert.equal(buildPlacementInputModeForPointer(undefined, true), "desktop");
  assert.equal(buildPlacementInputModeForPointer(undefined, false), "touch");
});
