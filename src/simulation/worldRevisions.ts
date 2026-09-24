import type { World } from "./model";

export const terrainRevision = (world: World): number => world.terrainRevision ?? 0;
export const bushRevision = (world: World): number => world.bushRevision ?? 0;

export const markTerrainChanged = (world: World): void => {
  world.terrainRevision = terrainRevision(world) + 1;
};

export const markBushChanged = (world: World): void => {
  world.bushRevision = bushRevision(world) + 1;
};
