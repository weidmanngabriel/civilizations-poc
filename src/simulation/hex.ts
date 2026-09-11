import { performanceNow, performanceProfiler } from "../debug/performanceProfiler";
import type { Hex, Tile } from "./model";

export const key = (h: Hex): string => `${h.q},${h.r}`;
export const same = (a: Hex, b: Hex): boolean => a.q === b.q && a.r === b.r;
export const neighbors = (h: Hex): Hex[] =>
  [
    [1, 0],
    [1, -1],
    [0, -1],
    [-1, 0],
    [-1, 1],
    [0, 1],
  ].map(([q, r]) => ({ q: h.q + q!, r: h.r + r! }));

export const walkable = (t: Tile): boolean =>
  t.terrain === "grass" ||
  t.terrain === "road" ||
  t.terrain === "forest" ||
  t.terrain === "field" ||
  t.terrain === "building";

export const movementCost = (t: Tile, roadSpeedMultiplier = 1.3): number =>
  t.terrain === "road" ? 1 / roadSpeedMultiplier : 1;

const reconstructPath = (
  previous: Map<string, Hex | null>,
  start: Hex,
  end: Hex,
): Hex[] => {
  const path: Hex[] = [];
  let cursor = end;
  while (!same(cursor, start)) {
    path.unshift(cursor);
    cursor = previous.get(key(cursor))!;
  }
  return path;
};

const profilePath = <T>(run: () => T): T => {
  const started = performanceNow();
  try {
    return run();
  } finally {
    performanceProfiler.recordPath(performanceNow() - started);
  }
};

/** Returns the quickest path, excluding the start, or null when unreachable. */
export function findPath(
  tiles: Tile[],
  start: Hex,
  end: Hex,
  roadSpeedMultiplier = 1.3,
): Hex[] | null {
  return profilePath(() => {
    const allowed = new Map(tiles.filter(walkable).map((tile) => [key(tile), tile]));
    if (!allowed.has(key(start)) || !allowed.has(key(end))) return null;

    const distances = new Map<string, number>([[key(start), 0]]);
    const previous = new Map<string, Hex | null>([[key(start), null]]);
    const open: Hex[] = [start];

    while (open.length) {
      let bestIndex = 0;
      for (let i = 1; i < open.length; i += 1) {
        if (distances.get(key(open[i]!))! < distances.get(key(open[bestIndex]!))!)
          bestIndex = i;
      }
      const current = open.splice(bestIndex, 1)[0]!;
      if (same(current, end)) return reconstructPath(previous, start, current);

      const currentDistance = distances.get(key(current))!;
      for (const next of neighbors(current)) {
        const tile = allowed.get(key(next));
        if (!tile) continue;
        const nextDistance = currentDistance + movementCost(tile, roadSpeedMultiplier);
        const knownDistance = distances.get(key(next));
        if (knownDistance !== undefined && knownDistance <= nextDistance + 1e-9) continue;
        distances.set(key(next), nextDistance);
        previous.set(key(next), current);
        if (!open.some((candidate) => same(candidate, next))) open.push(next);
      }
    }
    return null;
  });
}

/** Returns the fewest reachable tile steps, ignoring terrain speed. */
export function findPathBySteps(tiles: Tile[], start: Hex, end: Hex): Hex[] | null {
  return profilePath(() => {
    const allowed = new Set(tiles.filter(walkable).map(key));
    if (!allowed.has(key(start)) || !allowed.has(key(end))) return null;
    const queue = [start];
    const previous = new Map<string, Hex | null>([[key(start), null]]);
    for (let i = 0; i < queue.length; i += 1) {
      const current = queue[i]!;
      if (same(current, end)) return reconstructPath(previous, start, current);
      for (const next of neighbors(current))
        if (allowed.has(key(next)) && !previous.has(key(next))) {
          previous.set(key(next), current);
          queue.push(next);
        }
    }
    return null;
  });
}

export function pathTravelCost(
  tiles: Tile[],
  path: Hex[],
  roadSpeedMultiplier = 1.3,
): number {
  return path.reduce((sum, step) => {
    const tile = tiles.find((candidate) => same(candidate, step));
    return sum + (tile ? movementCost(tile, roadSpeedMultiplier) : Number.POSITIVE_INFINITY);
  }, 0);
}
