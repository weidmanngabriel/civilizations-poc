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

test("frame attribution separates RAF delay, Phaser work and inter-frame gaps", () => {
  const profiler = new PerformanceProfiler();

  profiler.recordAnimationFrame(1_000, 1_002);
  profiler.recordAnimationFrame(1_016, 1_019);
  profiler.recordPhaserStep(4, 1_019);
  profiler.recordPhaserRender(2.5, 1_019);
  profiler.recordPhaserInterFrameGap(12, 1_019);

  const snapshot = profiler.snapshot(1_019);

  assert.equal(snapshot.frameAttribution.rafCallbackDelay.count, 2);
  assert.equal(snapshot.frameAttribution.rafCallbackDelay.average, 2.5);
  assert.equal(snapshot.frameAttribution.phaserStep.average, 4);
  assert.equal(snapshot.frameAttribution.phaserRender.average, 2.5);
  assert.equal(snapshot.frameAttribution.phaserInterFrameGap.average, 12);
});

test("feature samples expose cost, object churn, per-tick cost and unaccounted simulation time", () => {
  const profiler = new PerformanceProfiler();

  profiler.recordTick(10, 1_000);
  profiler.recordFeature("movement", 3, 0, 1_000);
  profiler.recordFeature("sleep", 2, 0, 1_000);
  profiler.recordFeature("overlayBush", 2, 42, 1_000);

  const snapshot = profiler.snapshot(1_000);
  const movement = snapshot.features.find((feature) => feature.key === "movement")!;
  const sleep = snapshot.features.find((feature) => feature.key === "sleep")!;
  const bushOverlay = snapshot.features.find((feature) => feature.key === "overlayBush")!;

  assert.equal(movement.total, 3);
  assert.equal(movement.msPerSecond, 0.3);
  assert.equal(movement.msPerTick, 3);
  assert.equal(sleep.total, 2);
  assert.equal(sleep.msPerTick, 2);
  assert.equal(bushOverlay.msPerTick, 0);
  assert.equal(bushOverlay.objectsPerSecond, 4.2);
  assert.equal(snapshot.simulationAccountedMsPerSecond, 0.5);
  assert.equal(snapshot.simulationOtherMsPerSecond, 0.5);
});

test("pathfinding samples retain hunger and sleep reasons", () => {
  const profiler = new PerformanceProfiler();

  profiler.withPathReason("farm", () => profiler.recordPath(2, 1_000));
  profiler.withPathReason("sleep", () => profiler.recordPath(3, 1_000));
  profiler.recordPath(1, 1_000);

  const snapshot = profiler.snapshot(1_000);
  const farm = snapshot.pathReasons.find((reason) => reason.reason === "farm")!;
  const sleep = snapshot.pathReasons.find((reason) => reason.reason === "sleep")!;
  const other = snapshot.pathReasons.find((reason) => reason.reason === "other")!;

  assert.equal(farm.count, 1);
  assert.equal(farm.total, 2);
  assert.equal(sleep.count, 1);
  assert.equal(sleep.total, 3);
  assert.equal(other.count, 1);
  assert.equal(other.total, 1);
});
