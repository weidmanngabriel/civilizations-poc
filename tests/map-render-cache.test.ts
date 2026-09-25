import assert from "node:assert/strict";
import test from "node:test";
import { runMapCacheOperation } from "../src/game/mapRenderCache";

test("map cache operation stays enabled when rendering succeeds", () => {
  let fallbackCalls = 0;
  const result = runMapCacheOperation(
    () => {},
    () => { fallbackCalls += 1; },
  );

  assert.equal(result, true);
  assert.equal(fallbackCalls, 0);
});

test("map cache operation falls back instead of propagating a renderer failure", () => {
  let fallbackCalls = 0;
  const result = runMapCacheOperation(
    () => { throw new Error("render texture failed"); },
    () => { fallbackCalls += 1; },
  );

  assert.equal(result, false);
  assert.equal(fallbackCalls, 1);
});
