import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { buildPlacementInputModeForPointer } from "../src/game/buildPlacementInputMode";

const highlightSource = await readFile(
  new URL("../src/game/buildPlacementHighlights.ts", import.meta.url),
  "utf8",
);
const desktopPlacementSource = await readFile(
  new URL("../src/game/desktopBuildPlacement.ts", import.meta.url),
  "utf8",
);

test("mouse input selects desktop build placement controls", () => {
  assert.equal(buildPlacementInputModeForPointer("mouse", false), "desktop");
});

test("touch and pen input keep explicit build confirmation", () => {
  assert.equal(buildPlacementInputModeForPointer("touch", true), "touch");
  assert.equal(buildPlacementInputModeForPointer("pen", true), "touch");
});

test("unknown pointer types fall back to available pointer capability", () => {
  assert.equal(buildPlacementInputModeForPointer(undefined, true), "desktop");
  assert.equal(buildPlacementInputModeForPointer("", true), "desktop");
  assert.equal(buildPlacementInputModeForPointer("unknown", true), "desktop");
  assert.equal(buildPlacementInputModeForPointer(undefined, false), "touch");
  assert.equal(buildPlacementInputModeForPointer("", false), "touch");
  assert.equal(buildPlacementInputModeForPointer("unknown", false), "touch");
});

test("explicit touch input stays touch even when a fine pointer is available", () => {
  assert.equal(buildPlacementInputModeForPointer("touch", true), "touch");
  assert.equal(buildPlacementInputModeForPointer("pen", true), "touch");
});

test("desktop placement fallback checks any fine pointer instead of viewport size", () => {
  assert.match(desktopPlacementSource, /any-hover: hover/);
  assert.match(desktopPlacementSource, /any-pointer: fine/);
  assert.doesNotMatch(desktopPlacementSource, /max-width|min-width|innerWidth|userAgent/);
});


test("palisade build mode exposes the same global valid-region highlight layer", () => {
  assert.match(highlightSource, /"palisade"/);
  assert.match(highlightSource, /validPalisadePlanningAnchors\(world\)/);
});
