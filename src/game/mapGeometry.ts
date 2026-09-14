import type { Hex, Tile } from "../simulation/model";
import { key, tileIndex } from "../simulation/hex";
import { GRID_REFINEMENT } from "../simulation/spatial";

export const HEX_X = 24 / GRID_REFINEMENT;
export const HEX_Y = 21 / GRID_REFINEMENT;
export const HEX_RADIUS = 14 / GRID_REFINEMENT;
export const MAP_ORIGIN_X = 34;
export const MAP_ORIGIN_Y = 34;

export const pixel = (h: Hex) => ({
  x: MAP_ORIGIN_X + HEX_X * (h.q + h.r / 2),
  y: MAP_ORIGIN_Y + h.r * HEX_Y,
});

/**
 * Find the nearest fine-grid cell without scanning the complete map. The
 * affine map projection can be inverted directly; checking a tiny local
 * neighborhood handles rounding near cell boundaries.
 */
export function nearestTileAtWorldPoint(
  tiles: Tile[],
  worldX: number,
  worldY: number,
): Tile | undefined {
  const rFloat = (worldY - MAP_ORIGIN_Y) / HEX_Y;
  const qFloat = (worldX - MAP_ORIGIN_X) / HEX_X - rFloat / 2;
  const qBase = Math.round(qFloat);
  const rBase = Math.round(rFloat);
  const index = tileIndex(tiles);

  let best: Tile | undefined;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (let dq = -1; dq <= 1; dq += 1)
    for (let dr = -1; dr <= 1; dr += 1) {
      const candidate = index.get(key({ q: qBase + dq, r: rBase + dr }));
      if (!candidate) continue;
      const point = pixel(candidate);
      const dx = point.x - worldX;
      const dy = point.y - worldY;
      const distance = dx * dx + dy * dy;
      if (distance < bestDistance) {
        bestDistance = distance;
        best = candidate;
      }
    }
  return best;
}
