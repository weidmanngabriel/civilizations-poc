export type ResourcePerformanceKey = "resourceRetirement" | "resourceBlockingSync";

type Sample = { at: number; duration: number };
export type ResourcePerformanceMetric = {
  key: ResourcePerformanceKey;
  msPerSecond: number;
  average: number;
  p95: number;
  callsPerSecond: number;
  count: number;
};

const WINDOW_MS = 10_000;
const samples = new Map<ResourcePerformanceKey, Sample[]>();
const now = (): number => globalThis.performance?.now?.() ?? Date.now();

const percentile = (values: number[], fraction: number): number => {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.ceil(sorted.length * fraction) - 1);
  return sorted[Math.max(0, index)] ?? 0;
};

function trim(current: number): void {
  const cutoff = current - WINDOW_MS;
  for (const [key, values] of samples)
    samples.set(key, values.filter((sample) => sample.at >= cutoff));
}

export function measureResourcePerformance<T>(
  key: ResourcePerformanceKey,
  run: () => T,
): T {
  const started = now();
  try {
    return run();
  } finally {
    const finished = now();
    const values = samples.get(key) ?? [];
    values.push({ at: finished, duration: Math.max(0, finished - started) });
    samples.set(key, values);
    trim(finished);
  }
}

export function resourcePerformanceSnapshot(current = now()): ResourcePerformanceMetric[] {
  trim(current);
  return (["resourceRetirement", "resourceBlockingSync"] as const).map((key) => {
    const values = samples.get(key) ?? [];
    const durations = values.map((sample) => sample.duration);
    const total = durations.reduce((sum, value) => sum + value, 0);
    const recentCalls = values.filter((sample) => sample.at >= current - 1000).length;
    return {
      key,
      msPerSecond: total / (WINDOW_MS / 1000),
      average: durations.length ? total / durations.length : 0,
      p95: percentile(durations, 0.95),
      callsPerSecond: recentCalls,
      count: values.length,
    };
  });
}
