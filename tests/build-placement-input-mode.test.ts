import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { buildPlacementInputModeForPointer } from "../src/game/buildPlacementInputMode";

const highlightSource = await readFile(
  new URL("../src/game/buildPlacementHighlights.ts", import.meta.url),
  "utf8",
);

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


test("palisade build mode exposes the same global valid-region highlight layer", () => {
  assert.match(highlightSource, /"palisade"/);
  assert.match(highlightSource, /validPalisadePlanningAnchors\(world\)/);
});
