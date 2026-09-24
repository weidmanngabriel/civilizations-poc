import type { FishSchool, Hex, World } from "./model";
import { key, neighbors } from "./hex";
import { SIMULATION_HZ } from "./timing";

export const FISH_SCHOOL_CAPACITY = 15;
export const FISH_REGROW_INTERVAL_TICKS = 60 * SIMULATION_HZ;

const riverRegions = (world: World): Hex[][] => {
  const river = new Map(
    world.tiles
      .filter((tile) => tile.terrain === "river")
      .map((tile) => [key(tile), { q: tile.q, r: tile.r }] as const),
  );
  const regions: Hex[][] = [];
  const visited = new Set<string>();

  for (const start of river.values()) {
    if (visited.has(key(start))) continue;
    const queue = [start];
    const region: Hex[] = [];
    visited.add(key(start));

    for (let index = 0; index < queue.length; index += 1) {
      const current = queue[index]!;
      region.push(current);
      for (const neighbor of neighbors(current)) {
        const neighborKey = key(neighbor);
        const water = river.get(neighborKey);
        if (!water || visited.has(neighborKey)) continue;
        visited.add(neighborKey);
        queue.push(water);
      }
    }

    regions.push(region.sort((a, b) => a.q - b.q || a.r - b.r));
  }

  return regions.sort((a, b) => {
    const firstA = a[0];
    const firstB = b[0];
    if (!firstA || !firstB) return a.length - b.length;
    return firstA.q - firstB.q || firstA.r - firstB.r || a.length - b.length;
  });
};

export const initializeFishSchools = (world: World): FishSchool[] => {
  if (world.fishSchools) return world.fishSchools;
  world.fishSchools = riverRegions(world).map((region, index) => ({
    id: `fish-school-${index + 1}`,
    region,
    fish: FISH_SCHOOL_CAPACITY,
    capacity: FISH_SCHOOL_CAPACITY,
  }));
  return world.fishSchools;
};

export const fishSchoolForWater = (world: World, water: Hex): FishSchool | undefined =>
  initializeFishSchools(world).find((school) =>
    school.region.some((position) => position.q === water.q && position.r === water.r),
  );

export const consumeFish = (world: World, school: FishSchool): boolean => {
  if (school.fish <= 0) return false;
  school.fish -= 1;
  if (school.fish < school.capacity && school.nextRegrowTick === undefined)
    school.nextRegrowTick = world.round + FISH_REGROW_INTERVAL_TICKS;
  return true;
};

export const advanceFishSchools = (world: World): void => {
  for (const school of initializeFishSchools(world)) {
    if (school.fish >= school.capacity) {
      school.fish = school.capacity;
      school.nextRegrowTick = undefined;
      continue;
    }

    school.nextRegrowTick ??= world.round + FISH_REGROW_INTERVAL_TICKS;
    while (
      school.fish < school.capacity &&
      school.nextRegrowTick !== undefined &&
      world.round >= school.nextRegrowTick
    ) {
      school.fish += 1;
      school.nextRegrowTick += FISH_REGROW_INTERVAL_TICKS;
    }
    if (school.fish >= school.capacity) school.nextRegrowTick = undefined;
  }
};

export const visibleFishCount = (fish: number): number => {
  if (fish <= 0) return 0;
  if (fish <= 3) return fish;
  return Math.min(8, 3 + Math.ceil((fish - 3) / 2));
};
