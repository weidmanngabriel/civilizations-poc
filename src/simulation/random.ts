import type { World } from "./model";

export const randomFraction = (world: World): number => {
  world.rngState = (Math.imul(world.rngState, 1664525) + 1013904223) >>> 0;
  return world.rngState / 0x100000000;
};

export const randomInt = (world: World, min: number, max: number): number => {
  const low = Math.ceil(min);
  const high = Math.floor(max);
  if (high <= low) return low;
  return low + Math.floor(randomFraction(world) * (high - low + 1));
};
