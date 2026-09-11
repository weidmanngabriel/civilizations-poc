type TimedSample = { at: number; duration: number };
type FrameSample = TimedSample;

export type MetricStats = {
  average: number;
  p95: number;
  max: number;
  count: number;
  total: number;
};

export type PerformanceHistoryPoint = {
  secondsAgo: number;
  fps: number;
  frameMs: number;
  tickMs: number;
  pathMs: number;
};

export type PerformanceSnapshot = {
  fps1s: number;
  fps10s: number;
  frame: MetricStats;
  slowFrames16: number;
  slowFrames33: number;
  ticksPerSecond: number;
  tick: MetricStats;
  pathCallsPerSecond: number;
  path: MetricStats;
  renderCallsPerSecond: number;
  render: MetricStats;
  simulationRunning: boolean;
  simulationSpeed: number;
  simulationBacklogMs: number;
  history: PerformanceHistoryPoint[];
};

const HISTORY_MS = 30_000;
const TRIM_INTERVAL_MS = 1000;
const now = (): number => globalThis.performance?.now?.() ?? Date.now();
const validDuration = (duration: number): boolean => Number.isFinite(duration) && duration >= 0;

const percentile = (values: number[], fraction: number): number => {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.ceil(sorted.length * fraction) - 1);
  return sorted[Math.max(0, index)] ?? 0;
};

const stats = (samples: TimedSample[]): MetricStats => {
  if (!samples.length) return { average: 0, p95: 0, max: 0, count: 0, total: 0 };
  const values = samples.map((sample) => sample.duration);
  const total = values.reduce((sum, value) => sum + value, 0);
  return {
    average: total / values.length,
    p95: percentile(values, 0.95),
    max: Math.max(...values),
    count: values.length,
    total,
  };
};

const rate = (samples: TimedSample[], windowMs: number, current: number): number => {
  const cutoff = current - windowMs;
  const count = samples.filter((sample) => sample.at >= cutoff).length;
  return count / (windowMs / 1000);
};

export class PerformanceProfiler {
  private frames: FrameSample[] = [];
  private ticks: TimedSample[] = [];
  private paths: TimedSample[] = [];
  private renders: TimedSample[] = [];
  private simulationRunning = false;
  private simulationSpeed = 1;
  private simulationBacklogMs = 0;
  private lastTrimAt = 0;
  private lastAnimationFrameAt: number | undefined;

  private trim(current: number, force = false): void {
    if (!force && current - this.lastTrimAt < TRIM_INTERVAL_MS) return;
    this.lastTrimAt = current;
    const cutoff = current - HISTORY_MS;
    this.frames = this.frames.filter((sample) => sample.at >= cutoff);
    this.ticks = this.ticks.filter((sample) => sample.at >= cutoff);
    this.paths = this.paths.filter((sample) => sample.at >= cutoff);
    this.renders = this.renders.filter((sample) => sample.at >= cutoff);
  }

  private record(target: TimedSample[], duration: number, at: number): void {
    if (!validDuration(duration) || !Number.isFinite(at)) return;
    target.push({ at, duration });
    this.trim(at);
  }

  recordAnimationFrame(timestamp: number): void {
    if (!Number.isFinite(timestamp)) return;
    if (this.lastAnimationFrameAt !== undefined) {
      const duration = timestamp - this.lastAnimationFrameAt;
      if (duration >= 0) this.record(this.frames, duration, timestamp);
    }
    this.lastAnimationFrameAt = timestamp;
  }

  recordFrame(duration: number, at = now()): void {
    this.record(this.frames, duration, at);
  }

  recordTick(duration: number, at = now()): void {
    this.record(this.ticks, duration, at);
  }

  recordPath(duration: number, at = now()): void {
    this.record(this.paths, duration, at);
  }

  recordRender(duration: number, at = now()): void {
    this.record(this.renders, duration, at);
  }

  setSimulationState(running: boolean, speed: number, backlogMs: number): void {
    this.simulationRunning = running;
    this.simulationSpeed = speed;
    this.simulationBacklogMs = backlogMs;
  }

  snapshot(current = now()): PerformanceSnapshot {
    this.trim(current, true);
    const recentFrames = this.frames.filter((sample) => sample.at >= current - 10_000);
    const recentTicks = this.ticks.filter((sample) => sample.at >= current - 10_000);
    const recentPaths = this.paths.filter((sample) => sample.at >= current - 10_000);
    const recentRenders = this.renders.filter((sample) => sample.at >= current - 10_000);
    const oneSecondFrames = this.frames.filter((sample) => sample.at >= current - 1000);

    const history: PerformanceHistoryPoint[] = [];
    for (let secondsAgo = 29; secondsAgo >= 0; secondsAgo -= 1) {
      const end = current - secondsAgo * 1000;
      const start = end - 1000;
      const bucket = (samples: TimedSample[]) =>
        samples.filter((sample) => sample.at >= start && sample.at < end);
      const frameBucket = bucket(this.frames);
      const tickBucket = bucket(this.ticks);
      const pathBucket = bucket(this.paths);
      history.push({
        secondsAgo,
        fps: frameBucket.length,
        frameMs: stats(frameBucket).average,
        tickMs: stats(tickBucket).average,
        pathMs: stats(pathBucket).total,
      });
    }

    return {
      fps1s: oneSecondFrames.length,
      fps10s: recentFrames.length / 10,
      frame: stats(recentFrames),
      slowFrames16: recentFrames.filter((sample) => sample.duration > 1000 / 60).length,
      slowFrames33: recentFrames.filter((sample) => sample.duration > 1000 / 30).length,
      ticksPerSecond: rate(this.ticks, 1000, current),
      tick: stats(recentTicks),
      pathCallsPerSecond: rate(this.paths, 1000, current),
      path: stats(recentPaths),
      renderCallsPerSecond: rate(this.renders, 1000, current),
      render: stats(recentRenders),
      simulationRunning: this.simulationRunning,
      simulationSpeed: this.simulationSpeed,
      simulationBacklogMs: this.simulationBacklogMs,
      history,
    };
  }
}

export const performanceProfiler = new PerformanceProfiler();
export const performanceNow = now;
