import type { Hex } from "./model";

/**
 * Phase-A spatial refinement. One former coarse tile spans this many cells
 * along each axial grid direction. Rendering divides cell spacing by the same
 * factor so the visible world keeps approximately its previous size.
 */
export const GRID_REFINEMENT = 5;
export const BASE_MAP_COLUMNS = 41;
export const BASE_MAP_ROWS = 25;
export const MAP_COLUMNS = BASE_MAP_COLUMNS * GRID_REFINEMENT;
export const MAP_ROWS = BASE_MAP_ROWS * GRID_REFINEMENT;

export const scaleHex = (position: Hex): Hex => ({
  q: position.q * GRID_REFINEMENT,
  r: position.r * GRID_REFINEMENT,
});

export const hexDistance = (a: Hex, b: Hex): number => {
  const dq = a.q - b.q;
  const dr = a.r - b.r;
  return Math.max(Math.abs(dq), Math.abs(dr), Math.abs(dq + dr));
};

/** All fine-grid cells that represent one former coarse cell. */
export const refinedCellCluster = (coarseOffset: Hex): Hex[] => {
  const center = scaleHex(coarseOffset);
  const radius = Math.floor(GRID_REFINEMENT / 2);
  const cells: Hex[] = [];
  for (let dq = -radius; dq <= radius; dq += 1)
    for (let dr = -radius; dr <= radius; dr += 1) {
      const candidate = { q: center.q + dq, r: center.r + dr };
      if (hexDistance(candidate, center) <= radius) cells.push(candidate);
    }
  return cells;
};

/** Convert fine-grid step counts back to the former player-facing world scale. */
export const worldDistanceFromCells = (cells: number): number => cells / GRID_REFINEMENT;
