import { performanceNow, performanceProfiler } from "../debug/performanceProfiler";
import type { Hex, Tile } from "./model";

export const key = (h: Hex): string => `${h.q},${h.r}`;

const interactionTargetKey = Symbol("interactionTargetKey");
type RoutedHex = Hex & { [interactionTargetKey]?: string };

const exactSame = (a: Hex, b: Hex): boolean => a.q === b.q && a.r === b.r;

/**
 * Coordinates normally compare exactly. A person that has just reached an explicit
 * interaction cell for a blocking target also compares as being "at" that logical
 * target without ever entering its blocked cell.
 */
export const same = (a: Hex, b: Hex): boolean =>
  exactSame(a, b) || (a as RoutedHex)[interactionTargetKey] === key(b);

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

const terrainWalkable = (t: Tile): boolean =>
  t.terrain === "grass" ||
  t.terrain === "road" ||
  t.terrain === "forest" ||
  t.terrain === "field" ||
  t.terrain === "building";

export const walkable = (t: Tile): boolean => terrainWalkable(t) && !t.resourceBlocking;

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
  while (!exactSame(cursor, start)) {
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

const pathTargets = (index: Map<string, Tile>, end: Hex): Hex[] | null => {
  const endTile = index.get(key(end));
  if (!endTile || !terrainWalkable(endTile)) return null;
  if (!endTile.resourceBlocking) return [end];
  return neighbors(end).filter((position) => {
    const tile = index.get(key(position));
    return Boolean(tile && walkable(tile));
  });
};

const targetHeuristic = (
  position: Hex,
  targets: Hex[],
  roadSpeedMultiplier: number,
): number =>
  Math.min(...targets.map((target) => hexDistance(position, target))) / roadSpeedMultiplier;

const markInteractionArrival = (start: Hex, path: Hex[], logicalTarget: Hex): void => {
  const arrival = path.at(-1) ?? start;
  (arrival as RoutedHex)[interactionTargetKey] = key(logicalTarget);
};

/**
 * Returns the quickest path, excluding the start, or null when unreachable.
 * Blocking targets are never entered. Instead the route ends on the quickest
 * walkable adjacent interaction cell while preserving logical target arrival.
 */
export function findPath(
  tiles: Tile[],
  start: Hex,
  end: Hex,
  roadSpeedMultiplier = 1.3,
): Hex[] | null {
  return profilePath(() => {
    const index = tileIndex(tiles);
    const startTile = index.get(key(start));
    const targets = pathTargets(index, end);
    if (!startTile || !terrainWalkable(startTile) || !targets?.length) return null;

    const interactionTarget = Boolean(index.get(key(end))?.resourceBlocking);
    const targetKeys = new Set(targets.map(key));
    const startKey = key(start);
    if (targetKeys.has(startKey)) {
      if (interactionTarget) markInteractionArrival(start, [], end);
      return [];
    }

    const distances = new Map<string, number>([[startKey, 0]]);
    const previous = new Map<string, Hex | null>([[startKey, null]]);
    const open = new MinHeap();
    open.push({
      position: start,
      distance: 0,
      priority: targetHeuristic(start, targets, roadSpeedMultiplier),
    });

    while (open.length) {
      const currentEntry = open.pop()!;
      const current = currentEntry.position;
      const currentKey = key(current);
      const currentDistance = distances.get(currentKey);
      if (currentDistance === undefined || currentEntry.distance > currentDistance + 1e-9) continue;
      if (targetKeys.has(currentKey)) {
        const path = reconstructPath(previous, start, current);
        if (interactionTarget) markInteractionArrival(start, path, end);
        return path;
      }

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
          priority: nextDistance + targetHeuristic(next, targets, roadSpeedMultiplier),
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
    const targets = pathTargets(index, end);
    if (!startTile || !terrainWalkable(startTile) || !targets?.length) return null;

    const interactionTarget = Boolean(index.get(key(end))?.resourceBlocking);
    const targetKeys = new Set(targets.map(key));
    const startKey = key(start);
    if (targetKeys.has(startKey)) {
      if (interactionTarget) markInteractionArrival(start, [], end);
      return [];
    }

    const queue = [start];
    const previous = new Map<string, Hex | null>([[startKey, null]]);
    for (let i = 0; i < queue.length; i += 1) {
      const current = queue[i]!;
      const currentKey = key(current);
      if (targetKeys.has(currentKey)) {
        const path = reconstructPath(previous, start, current);
        if (interactionTarget) markInteractionArrival(start, path, end);
        return path;
      }
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
