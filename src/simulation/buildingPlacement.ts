import type {
  BuildableBuildingKind,
  Building,
  GoodAmounts,
  Hex,
  World,
} from "./model";
import { key, neighbors, same } from "./hex";
import { CONFIG } from "./scenario";
import { buildAt, removeBuilding } from "./simulation";

export type BuildingPlacementShape = {
  cells: Hex[];
  anchor: Hex;
};

export type ConstructionPlan = {
  required: GoodAmounts;
  duration: number;
};

export const CONSTRUCTION_PLANS: Record<BuildableBuildingKind, ConstructionPlan> = {
  warehouse: { required: { wood: 4 }, duration: CONFIG.duration },
  sawmill: { required: { wood: 6 }, duration: CONFIG.duration },
  carpenter: { required: { plank: 4 }, duration: CONFIG.duration },
};

const SHAPES: Record<BuildableBuildingKind, BuildingPlacementShape> = {
  warehouse: {
    cells: [
      { q: 0, r: 0 },
      { q: 1, r: 0 },
      { q: 0, r: 1 },
      { q: 1, r: 1 },
    ],
    anchor: { q: 0, r: 0 },
  },
  sawmill: {
    cells: [
      { q: 0, r: 0 },
      { q: 1, r: 0 },
      { q: 2, r: 0 },
      { q: 0, r: 1 },
      { q: 1, r: 1 },
      { q: 2, r: 1 },
    ],
    anchor: { q: 0, r: 0 },
  },
  carpenter: {
    cells: [
      { q: 0, r: 0 },
      { q: 1, r: 0 },
      { q: 0, r: 1 },
      { q: 1, r: 1 },
    ],
    anchor: { q: 0, r: 0 },
  },
};

export const footprintFromShape = (shape: BuildingPlacementShape, anchorPosition: Hex): Hex[] =>
  shape.cells.map((cell) => ({
    q: anchorPosition.q + cell.q - shape.anchor.q,
    r: anchorPosition.r + cell.r - shape.anchor.r,
  }));

export const footprintAt = (kind: BuildableBuildingKind, anchorPosition: Hex): Hex[] =>
  footprintFromShape(SHAPES[kind], anchorPosition);

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

type PlacementLookup = {
  freeTiles: Set<string>;
  people: Set<string>;
};

const createPlacementLookup = (world: World): PlacementLookup => ({
  freeTiles: new Set(
    world.tiles
      .filter((tile) => tile.terrain === "grass" || tile.terrain === "road")
      .map(key),
  ),
  people: new Set(world.people.map((person) => key(person.position))),
});

const canPlaceWithLookup = (
  lookup: PlacementLookup,
  anchorPosition: Hex,
  kind: BuildableBuildingKind,
): boolean => {
  const footprint = footprintAt(kind, anchorPosition);
  const ring = footprintRing(footprint);
  if (!footprint.every((position) => lookup.freeTiles.has(key(position)))) return false;
  if (!ring.every((position) => lookup.freeTiles.has(key(position)))) return false;
  return !footprint.some((position) => lookup.people.has(key(position)));
};

export function canPlaceBuilding(
  world: World,
  anchorPosition: Hex,
  kind: BuildableBuildingKind,
): boolean {
  return canPlaceWithLookup(createPlacementLookup(world), anchorPosition, kind);
}

export function validBuildingAnchors(
  world: World,
  kind: BuildableBuildingKind,
): Hex[] {
  const lookup = createPlacementLookup(world);
  return world.tiles
    .filter((tile) => canPlaceWithLookup(lookup, tile, kind))
    .map((tile) => ({ q: tile.q, r: tile.r }));
}

export function buildWithFootprint(
  world: World,
  anchorPosition: Hex,
  kind: BuildableBuildingKind,
): Building | undefined {
  if (!canPlaceBuilding(world, anchorPosition, kind)) return;
  const footprint = footprintAt(kind, anchorPosition);
  const baseTerrains: Record<string, "grass" | "road"> = {};
  for (const position of footprint) {
    const tile = world.tiles.find((candidate) => same(candidate, position))!;
    baseTerrains[key(position)] = tile.terrain as "grass" | "road";
  }

  const created = buildAt(world, anchorPosition, kind);
  if (!created) return;
  const plan = CONSTRUCTION_PLANS[kind];
  created.construction = {
    required: { ...plan.required },
    delivered: {},
    duration: plan.duration,
    progress: 0,
    complete: false,
  };
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
