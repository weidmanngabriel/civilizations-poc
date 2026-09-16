import type { Hex } from "../simulation/model";
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
