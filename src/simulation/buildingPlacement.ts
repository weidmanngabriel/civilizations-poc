import type { BuildableBuildingKind, Building, Hex, World } from "./model";
import { key, neighbors, same } from "./hex";
import { buildAt, removeBuilding } from "./simulation";

const OFFSETS: Record<BuildableBuildingKind, Hex[]> = {
  warehouse: [
    { q: 0, r: 0 },
    { q: 1, r: 0 },
    { q: 0, r: 1 },
    { q: 1, r: 1 },
  ],
  sawmill: [
    { q: 0, r: 0 },
    { q: 1, r: 0 },
    { q: 2, r: 0 },
    { q: 0, r: 1 },
    { q: 1, r: 1 },
    { q: 2, r: 1 },
  ],
  carpenter: [
    { q: 0, r: 0 },
    { q: 1, r: 0 },
    { q: 0, r: 1 },
    { q: 1, r: 1 },
  ],
};

export const footprintAt = (kind: BuildableBuildingKind, origin: Hex): Hex[] =>
  OFFSETS[kind].map((offset) => ({ q: origin.q + offset.q, r: origin.r + offset.r }));

export const buildingFootprint = (building: Building): Hex[] =>
  building.footprint?.map((position) => ({ ...position })) ?? [{ ...building.position }];

export const footprintRing = (footprint: Hex[]): Hex[] => {
  const occupied = new Set(footprint.map(key));
  const ring = new Map<string, Hex>();
  for (const position of footprint)
    for (const neighbor of neighbors(position))
      if (!occupied.has(key(neighbor))) ring.set(key(neighbor), neighbor);
  return [...ring.values()];
};

export function canPlaceBuilding(
  world: World,
  origin: Hex,
  kind: BuildableBuildingKind,
): boolean {
  const footprint = footprintAt(kind, origin);
  const ring = footprintRing(footprint);
  const tileAt = (position: Hex) => world.tiles.find((tile) => same(tile, position));
  const isFree = (position: Hex) => {
    const tile = tileAt(position);
    return !!tile && (tile.terrain === "grass" || tile.terrain === "road");
  };

  if (!footprint.every(isFree) || !ring.every(isFree)) return false;
  if (world.people.some((person) => footprint.some((position) => same(person.position, position))))
    return false;
  return true;
}

export function buildWithFootprint(
  world: World,
  origin: Hex,
  kind: BuildableBuildingKind,
): Building | undefined {
  if (!canPlaceBuilding(world, origin, kind)) return;
  const footprint = footprintAt(kind, origin);
  const baseTerrains: Record<string, "grass" | "road"> = {};
  for (const position of footprint) {
    const tile = world.tiles.find((candidate) => same(candidate, position))!;
    baseTerrains[key(position)] = tile.terrain as "grass" | "road";
  }

  const created = buildAt(world, origin, kind);
  if (!created) return;
  created.footprint = footprint.map((position) => ({ ...position }));
  created.baseTerrains = baseTerrains;
  for (const position of footprint) {
    const tile = world.tiles.find((candidate) => same(candidate, position))!;
    tile.terrain = "building";
    tile.trafficTicks = undefined;
  }
  return created;
}

export function removeBuildingWithFootprint(world: World, id: string): boolean {
  const existing = world.buildings.find((building) => building.id === id);
  if (!existing || existing.kind === "hq" || existing.kind === "forest") return false;
  const footprint = buildingFootprint(existing);
  const baseTerrains = existing.baseTerrains;
  if (!removeBuilding(world, id)) return false;

  for (const position of footprint) {
    const tile = world.tiles.find((candidate) => same(candidate, position));
    if (!tile) continue;
    tile.terrain = baseTerrains?.[key(position)] ?? "grass";
    tile.trafficTicks = undefined;
  }
  return true;
}
