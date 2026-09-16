import type { Hex } from "../simulation/model";
import { GRID_REFINEMENT } from "../simulation/spatial";

export interface ProjectionPoint {
  x: number;
  y: number;
}

export const HEX_X = 24 / GRID_REFINEMENT;
export const HEX_Y = 21 / GRID_REFINEMENT;
export const HEX_RADIUS = 14 / GRID_REFINEMENT;
export const MAP_ORIGIN_X = 34;
export const MAP_ORIGIN_Y = 34;

export const pixel = (h: Hex): ProjectionPoint => ({
  x: MAP_ORIGIN_X + HEX_X * (h.q + h.r / 2),
  y: MAP_ORIGIN_Y + h.r * HEX_Y,
});

export const hexCornerOffsets = (scale = 1): ProjectionPoint[] =>
  Array.from({ length: 6 }, (_, i) => ({
    x: HEX_RADIUS * scale * Math.cos(((60 * i - 30) * Math.PI) / 180),
    y: HEX_RADIUS * scale * Math.sin(((60 * i - 30) * Math.PI) / 180),
  }));

export const hexPolygonPoints = (h: Hex): ProjectionPoint[] => {
  const center = pixel(h);
  return hexCornerOffsets().map((offset) => ({
    x: center.x + offset.x,
    y: center.y + offset.y,
  }));
};
