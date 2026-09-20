import type { World } from "../simulation/model";
import {
  PERFORMANCE_DETAIL_FEATURES,
  type PerformanceFeature,
  type PerformanceSnapshot,
  type PathReason,
} from "./performanceProfiler";

export type PerformanceRecordingFeature = {
  msPerSecond: number;
  msPerTick: number;
  average: number;
  p95: number;
  max: number;
  callsPerSecond: number;
};

export type PerformanceRecordingPathReason = {
  msPerSecond: number;
  average: number;
  p95: number;
  max: number;
  callsPerSecond: number;
};

export type PerformanceRecordingWorld = {
  tiles: number;
  people: number;
  buildings: number;
  fields: number;
  naturalResources: number;
  activeForests: number;
  looseGoods: number;
  movingPeople: number;
  activeTrips: number;
  animals: number;
  animalGroups: number;
  livestock: number;
  ownedLivestock: number;
};

export type PerformanceRecordingSample = {
  elapsedMs: number;
  capturedAt: string;
  fps1s: number;
  fps10s: number;
  frameAverageMs: number;
  frameP95Ms: number;
  frameMaxMs: number;
  tickAverageMs: number;
  tickP95Ms: number;
  tickMaxMs: number;
  ticksPerSecond: number;
  pathMsPerSecond: number;
  pathCallsPerSecond: number;
  simulationRunning: boolean;
  simulationSpeed: number;
  simulationBacklogMs: number;
  simulationOtherMsPerSecond: number;
  features: Record<PerformanceFeature, PerformanceRecordingFeature>;
  pathReasons: Record<PathReason, PerformanceRecordingPathReason>;
  world: PerformanceRecordingWorld;
};

type FeatureSummary = {
  key: PerformanceFeature;
  averageMsPerSecond: number;
  maxMsPerSecond: number;
  maxP95Ms: number;
};

type PathSummary = {
  reason: PathReason;
  averageMsPerSecond: number;
  maxMsPerSecond: number;
  maxP95Ms: number;
};

export type PerformanceRecordingExport = {
  schema: "civilizations-performance-recording";
  version: 1;
  startedAt: string;
  endedAt: string;
  durationSeconds: number;
  metadata: {
    buildLabel: string;
    userAgent: string;
    viewport: { width: number; height: number; devicePixelRatio: number };
  };
  summary: {
    sampleCount: number;
    fps: { average: number; minimum: number };
    frameMs: { average: number; maximum: number };
    tickMs: { average: number; maximum: number };
    simulationSpeeds: number[];
    topFeatures: FeatureSummary[];
    topPathReasons: PathSummary[];
    worldStart?: PerformanceRecordingWorld;
    worldEnd?: PerformanceRecordingWorld;
  };
  samples: PerformanceRecordingSample[];
};

type RecordingState = {
  startedAtIso: string;
  startedAtMs: number;
  lastSampleAtMs: number;
  samples: PerformanceRecordingSample[];
};

const SAMPLE_INTERVAL_MS = 1000;
let recording: RecordingState | undefined;

const average = (values: number[]): number =>
  values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;

const worldSnapshot = (world: World): PerformanceRecordingWorld => {
  const activeBuildings = world.buildings.filter((building) => !building.retired);
  const animals = world.animals ?? [];
  const livestock = animals.filter((animal) => animal.kind === "cow" || animal.kind === "sheep");
  return {
    tiles: world.tiles.length,
    people: world.people.length,
    buildings: activeBuildings.length,
    fields: activeBuildings.filter((building) => building.kind === "field").length,
    naturalResources: world.naturalResources.filter((resource) => !resource.depleted).length,
    activeForests: world.naturalResources.filter(
      (resource) => resource.kind === "forest" && !resource.depleted,
    ).length,
    looseGoods: world.looseGoods?.length ?? 0,
    movingPeople: world.people.filter((person) => person.path.length > 0).length,
    activeTrips: world.people.filter((person) => person.trip).length,
    animals: animals.length,
    animalGroups: world.animalGroups?.length ?? 0,
    livestock: livestock.length,
    ownedLivestock: livestock.filter((animal) => animal.owner === "player").length,
  };
};

const sampleFromSnapshot = (
  world: World,
  snapshot: PerformanceSnapshot,
  elapsedMs: number,
): PerformanceRecordingSample => ({
  elapsedMs,
  capturedAt: new Date().toISOString(),
  fps1s: snapshot.fps1s,
  fps10s: snapshot.fps10s,
  frameAverageMs: snapshot.frame.average,
  frameP95Ms: snapshot.frame.p95,
  frameMaxMs: snapshot.frame.max,
  tickAverageMs: snapshot.tick.average,
  tickP95Ms: snapshot.tick.p95,
  tickMaxMs: snapshot.tick.max,
  ticksPerSecond: snapshot.ticksPerSecond,
  pathMsPerSecond: snapshot.path.total / 10,
  pathCallsPerSecond: snapshot.pathCallsPerSecond,
  simulationRunning: snapshot.simulationRunning,
  simulationSpeed: snapshot.simulationSpeed,
  simulationBacklogMs: snapshot.simulationBacklogMs,
  simulationOtherMsPerSecond: snapshot.simulationOtherMsPerSecond,
  features: Object.fromEntries(snapshot.features.map((feature) => [feature.key, {
    msPerSecond: feature.msPerSecond,
    msPerTick: feature.msPerTick,
    average: feature.average,
    p95: feature.p95,
    max: feature.max,
    callsPerSecond: feature.callsPerSecond,
  }])) as Record<PerformanceFeature, PerformanceRecordingFeature>,
  pathReasons: Object.fromEntries(snapshot.pathReasons.map((reason) => [reason.reason, {
    msPerSecond: reason.msPerSecond,
    average: reason.average,
    p95: reason.p95,
    max: reason.max,
    callsPerSecond: reason.callsPerSecond,
  }])) as Record<PathReason, PerformanceRecordingPathReason>,
  world: worldSnapshot(world),
});

export function startPerformanceRecording(): void {
  const current = performance.now();
  recording = {
    startedAtIso: new Date().toISOString(),
    startedAtMs: current,
    lastSampleAtMs: current - SAMPLE_INTERVAL_MS,
    samples: [],
  };
}

export function isPerformanceRecording(): boolean {
  return Boolean(recording);
}

export function performanceRecordingElapsedMs(current = performance.now()): number {
  return recording ? Math.max(0, current - recording.startedAtMs) : 0;
}

export function capturePerformanceRecordingSample(
  world: World,
  snapshot: PerformanceSnapshot,
  current = performance.now(),
): void {
  if (!recording || current - recording.lastSampleAtMs < SAMPLE_INTERVAL_MS) return;
  recording.lastSampleAtMs = current;
  recording.samples.push(sampleFromSnapshot(world, snapshot, current - recording.startedAtMs));
}

const summarizeFeatures = (samples: PerformanceRecordingSample[]): FeatureSummary[] => {
  const first = samples[0];
  if (!first) return [];
  return (Object.keys(first.features) as PerformanceFeature[])
    .filter((key) => !PERFORMANCE_DETAIL_FEATURES.has(key))
    .map((key) => {
      const values = samples.map((sample) => sample.features[key]);
      return {
        key,
        averageMsPerSecond: average(values.map((value) => value.msPerSecond)),
        maxMsPerSecond: Math.max(0, ...values.map((value) => value.msPerSecond)),
        maxP95Ms: Math.max(0, ...values.map((value) => value.p95)),
      };
    })
    .sort((a, b) => b.averageMsPerSecond - a.averageMsPerSecond);
};

const summarizePaths = (samples: PerformanceRecordingSample[]): PathSummary[] => {
  const first = samples[0];
  if (!first) return [];
  return (Object.keys(first.pathReasons) as PathReason[]).map((reason) => {
    const values = samples.map((sample) => sample.pathReasons[reason]);
    return {
      reason,
      averageMsPerSecond: average(values.map((value) => value.msPerSecond)),
      maxMsPerSecond: Math.max(0, ...values.map((value) => value.msPerSecond)),
      maxP95Ms: Math.max(0, ...values.map((value) => value.p95)),
    };
  }).sort((a, b) => b.averageMsPerSecond - a.averageMsPerSecond);
};

export function finishPerformanceRecording(): PerformanceRecordingExport | undefined {
  if (!recording) return undefined;
  const endedAt = new Date();
  const state = recording;
  recording = undefined;
  const samples = state.samples;
  const fps = samples.map((sample) => sample.fps1s);
  const frame = samples.map((sample) => sample.frameAverageMs);
  const ticks = samples.map((sample) => sample.tickAverageMs);
  const buildLabel = document.querySelector<HTMLElement>("#build-version")?.textContent?.trim() ?? "";

  return {
    schema: "civilizations-performance-recording",
    version: 1,
    startedAt: state.startedAtIso,
    endedAt: endedAt.toISOString(),
    durationSeconds: Math.max(0, (performance.now() - state.startedAtMs) / 1000),
    metadata: {
      buildLabel,
      userAgent: navigator.userAgent,
      viewport: {
        width: window.innerWidth,
        height: window.innerHeight,
        devicePixelRatio: window.devicePixelRatio,
      },
    },
    summary: {
      sampleCount: samples.length,
      fps: {
        average: average(fps),
        minimum: fps.length ? Math.min(...fps) : 0,
      },
      frameMs: {
        average: average(frame),
        maximum: frame.length ? Math.max(...frame) : 0,
      },
      tickMs: {
        average: average(ticks),
        maximum: ticks.length ? Math.max(...ticks) : 0,
      },
      simulationSpeeds: [...new Set(samples.map((sample) => sample.simulationSpeed))].sort((a, b) => a - b),
      topFeatures: summarizeFeatures(samples),
      topPathReasons: summarizePaths(samples),
      worldStart: samples[0]?.world,
      worldEnd: samples.at(-1)?.world,
    },
    samples,
  };
}

export function downloadPerformanceRecording(data: PerformanceRecordingExport): void {
  const safeTime = data.startedAt.replace(/[:.]/g, "-");
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `performance-${safeTime}.json`;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
