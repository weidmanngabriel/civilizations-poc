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
  t.terrain === "road" || t.terrain === "forest" || t.terrain === "building";
/** Returns steps excluding the start, or null for an unreachable destination. */
export function findPath(tiles: Tile[], start: Hex, end: Hex): Hex[] | null {
  const allowed = new Set(tiles.filter(walkable).map(key));
  if (!allowed.has(key(start)) || !allowed.has(key(end))) return null;
  const queue = [start];
  const previous = new Map<string, Hex | null>([[key(start), null]]);
  for (let i = 0; i < queue.length; i++) {
    const current = queue[i]!;
    if (same(current, end)) {
      const path: Hex[] = [];
      let cursor = current;
      while (!same(cursor, start)) {
        path.unshift(cursor);
        cursor = previous.get(key(cursor))!;
      }
      return path;
    }
    for (const next of neighbors(current))
      if (allowed.has(key(next)) && !previous.has(key(next))) {
        previous.set(key(next), current);
        queue.push(next);
      }
  }
  return null;
}
