import test from "node:test";
import assert from "node:assert/strict";
import { PerformanceProfiler } from "../src/debug/performanceProfiler";

test("animation frame timestamps produce FPS and frame duration samples", () => {
  const profiler = new PerformanceProfiler();

  profiler.recordAnimationFrame(1_000);
  profiler.recordAnimationFrame(1_016);
  profiler.recordAnimationFrame(1_032);
  profiler.recordAnimationFrame(1_048);

  const snapshot = profiler.snapshot(1_048);

  assert.equal(snapshot.fps1s, 3);
  assert.equal(snapshot.frame.count, 3);
  assert.equal(snapshot.frame.average, 16);
  assert.equal(snapshot.frame.max, 16);
});

test("the first animation frame only establishes the timestamp baseline", () => {
  const profiler = new PerformanceProfiler();

  profiler.recordAnimationFrame(500);

  const snapshot = profiler.snapshot(500);
  assert.equal(snapshot.fps1s, 0);
  assert.equal(snapshot.frame.count, 0);
});
