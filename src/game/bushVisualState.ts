import type { Tile, World } from "../simulation/model";

export type BushVisualState = "full" | "empty" | "hidden";

export const bushVisualKey = (tile: Pick<Tile, "q" | "r">): string => `${tile.q},${tile.r}`;

export const bushVisualState = (tile: Tile): BushVisualState => {
  if (!tile.bush || tile.terrain !== "grass") return "hidden";
  return tile.bushAvailable ? "full" : "empty";
};

export const currentBushTiles = (world: World): Tile[] =>
  world.tiles.filter((tile) => tile.bush);
