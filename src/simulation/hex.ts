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

export const hexDistance = (a: Hex, b: Hex): number => {
  const dq = a.q - b.q;
  const dr = a.r - b.r;
  return Math.max(Math.abs(dq), Math.abs(dr), Math.abs(dq + dr));
};

export const walkable = (t: Tile): boolean =>
  t.terrain === "grass" ||
  t.terrain === "road" ||
  t.terrain === "forest" ||
  t.terrain === "field" ||
  t.terrain === "building";

export const movementCost = (t: Tile, roadSpeedMultiplier = 1.3): number =>
  t.terrain === "road" ? 1 / roadSpeedMultiplier : 1;

const tileIndexCache = new WeakMap<Tile[], Map<string, Tile>>();

/** Coordinate lookup is stable even though tile terrain mutates in place. */
export const tileIndex = (tiles: Tile[]): Map<string, Tile> => {
  let index = tileIndexCache.get(tiles);
  if (!index) {
    index = new Map(tiles.map((tile) => [key(tile), tile]));
    tileIndexCache.set(tiles, index);
  }
  return index;
};

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

type QueueEntry = { position: Hex; priority: number; distance: number };

class MinHeap {
  private items: QueueEntry[] = [];

  get length(): number {
    return this.items.length;
  }

  push(entry: QueueEntry): void {
    this.items.push(entry);
    let index = this.items.length - 1;
    while (index > 0) {
      const parent = Math.floor((index - 1) / 2);
      if (this.items[parent]!.priority <= entry.priority) break;
      this.items[index] = this.items[parent]!;
      index = parent;
    }
    this.items[index] = entry;
  }

  pop(): QueueEntry | undefined {
    if (!this.items.length) return undefined;
    const first = this.items[0]!;
    const last = this.items.pop()!;
    if (!this.items.length) return first;

    let index = 0;
    while (true) {
      const left = index * 2 + 1;
      const right = left + 1;
      if (left >= this.items.length) break;
      const child = right < this.items.length && this.items[right]!.priority < this.items[left]!.priority
        ? right
        : left;
      if (this.items[child]!.priority >= last.priority) break;
      this.items[index] = this.items[child]!;
      index = child;
    }
    this.items[index] = last;
    return first;
  }
}

/** Returns the quickest path, excluding the start, or null when unreachable. */
export function findPath(
  tiles: Tile[],
  start: Hex,
  end: Hex,
  roadSpeedMultiplier = 1.3,
): Hex[] | null {
  return profilePath(() => {
    const index = tileIndex(tiles);
    const startTile = index.get(key(start));
    const endTile = index.get(key(end));
    if (!startTile || !endTile || !walkable(startTile) || !walkable(endTile)) return null;

    const startKey = key(start);
    const distances = new Map<string, number>([[startKey, 0]]);
    const previous = new Map<string, Hex | null>([[startKey, null]]);
    const open = new MinHeap();
    open.push({ position: start, distance: 0, priority: hexDistance(start, end) / roadSpeedMultiplier });

    while (open.length) {
      const currentEntry = open.pop()!;
      const current = currentEntry.position;
      const currentKey = key(current);
      const currentDistance = distances.get(currentKey);
      if (currentDistance === undefined || currentEntry.distance > currentDistance + 1e-9) continue;
      if (same(current, end)) return reconstructPath(previous, start, current);

      for (const next of neighbors(current)) {
        const tile = index.get(key(next));
        if (!tile || !walkable(tile)) continue;
        const nextDistance = currentDistance + movementCost(tile, roadSpeedMultiplier);
        const nextKey = key(next);
        const knownDistance = distances.get(nextKey);
        if (knownDistance !== undefined && knownDistance <= nextDistance + 1e-9) continue;
        distances.set(nextKey, nextDistance);
        previous.set(nextKey, current);
        open.push({
          position: next,
          distance: nextDistance,
          priority: nextDistance + hexDistance(next, end) / roadSpeedMultiplier,
        });
      }
    }
    return null;
  });
}

/** Returns the fewest reachable tile steps, ignoring terrain speed. */
export function findPathBySteps(tiles: Tile[], start: Hex, end: Hex): Hex[] | null {
  return profilePath(() => {
    const index = tileIndex(tiles);
    const startTile = index.get(key(start));
    const endTile = index.get(key(end));
    if (!startTile || !endTile || !walkable(startTile) || !walkable(endTile)) return null;
    const queue = [start];
    const previous = new Map<string, Hex | null>([[key(start), null]]);
    for (let i = 0; i < queue.length; i += 1) {
      const current = queue[i]!;
      if (same(current, end)) return reconstructPath(previous, start, current);
      for (const next of neighbors(current)) {
        const nextKey = key(next);
        const tile = index.get(nextKey);
        if (tile && walkable(tile) && !previous.has(nextKey)) {
          previous.set(nextKey, current);
          queue.push(next);
        }
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
  const index = tileIndex(tiles);
  return path.reduce((sum, step) => {
    const tile = index.get(key(step));
    return sum + (tile ? movementCost(tile, roadSpeedMultiplier) : Number.POSITIVE_INFINITY);
  }, 0);
}
