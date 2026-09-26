import type {
  BuildableBuildingKind,
  Building,
  GoodAmounts,
  Hex,
  HouseLevel,
  PlaceableBuildingKind,
  World,
} from "./model";
import {
  bindBuildingDefinition,
  buildingInteractionAt,
  buildingVisualAnchor,
  definitionBlockedAt,
  definitionFootprintAt,
  definitionFootprintForBuilding,
} from "../buildings/buildingDefinitionRegistry";
import { hexDistance, key, neighbors, tileIndex } from "./hex";
import { CONFIG } from "./scenario";
import { applyBuildingKindDefinition, buildAt, notifyConstructionSiteAdded, removeBuilding } from "./simulation";
import { isBuildingUnlocked, isHouseLevelUnlocked } from "./technology";
import { isMaterialCheatEnabled } from "./debugCheats";
import { refinedCellCluster } from "./spatial";
import { naturalResourceFootprint } from "./naturalResources";
import { looseGoodStacks } from "./looseGoods";
import { BUILDING_CONSTRUCTION_REQUIREMENTS } from "./constructionRules";
import { isWithinWaypostOrientation, WAYPOST_BUILD_CLEARANCE } from "./wayposts";
import { buildingUpgradeRule } from "./buildingUpgradeRules";
import { markBushChanged, markTerrainChanged } from "./worldRevisions";
import {
  HOUSE_LEVEL_DEFINITIONS,
  houseDirectCost,
  nextHouseLevel,
  releaseHouseholdsForHouse,
} from "./housing";

export type BuildingPlacementShape = {
  cells: Hex[];
  anchor: Hex;
};

export type ConstructionPlan = {
  required: GoodAmounts;
  duration: number;
};

const constructionDuration = (required: GoodAmounts): number =>
  (3 + Object.values(required).reduce((sum, amount) => sum + (amount ?? 0), 0) * 2) *
  CONFIG.simulationHz;

const constructionPlan = (required: GoodAmounts): ConstructionPlan => ({
  required,
  duration: constructionDuration(required),
});

export const CONSTRUCTION_PLANS: Record<PlaceableBuildingKind, ConstructionPlan> = Object.fromEntries(
  (Object.entries(BUILDING_CONSTRUCTION_REQUIREMENTS) as [PlaceableBuildingKind, GoodAmounts][]).map(
    ([kind, required]) => [kind, constructionPlan(required)],
  ),
) as Record<PlaceableBuildingKind, ConstructionPlan>;

const refineCoarseShape = (coarseCells: Hex[]): Hex[] => {
  const cells = new Map<string, Hex>();
  for (const coarseCell of coarseCells)
    for (const refined of refinedCellCluster(coarseCell)) cells.set(key(refined), refined);
  return [...cells.values()];
};

const COMPACT_SHAPE: BuildingPlacementShape = {
  cells: refineCoarseShape([
    { q: 0, r: 0 },
    { q: 1, r: 0 },
    { q: 0, r: 1 },
    { q: 1, r: 1 },
  ]),
  anchor: { q: 0, r: 0 },
};

const SHAPES: Record<PlaceableBuildingKind, BuildingPlacementShape> = {
  warehouse: COMPACT_SHAPE,
  house: COMPACT_SHAPE,
  farm: COMPACT_SHAPE,
  sawmill: {
    cells: refineCoarseShape([
      { q: 0, r: 0 },
      { q: 1, r: 0 },
      { q: 2, r: 0 },
      { q: 0, r: 1 },
      { q: 1, r: 1 },
      { q: 2, r: 1 },
    ]),
    anchor: { q: 0, r: 0 },
  },
  carpenter: COMPACT_SHAPE,
  mill: COMPACT_SHAPE,
  bakery: COMPACT_SHAPE,
  well: COMPACT_SHAPE,
  pottery: COMPACT_SHAPE,
  pottery2: COMPACT_SHAPE,
  stonemason: COMPACT_SHAPE,
  stonemason2: COMPACT_SHAPE,
  tailor: COMPACT_SHAPE,
  livestockBreeder: COMPACT_SHAPE,
  school: COMPACT_SHAPE,
};

export const footprintFromShape = (shape: BuildingPlacementShape, anchorPosition: Hex): Hex[] =>
  shape.cells.map((cell) => ({
    q: anchorPosition.q + cell.q - shape.anchor.q,
    r: anchorPosition.r + cell.r - shape.anchor.r,
  }));

export const footprintAt = (
  kind: PlaceableBuildingKind,
  anchorPosition: Hex,
  level = 1,
): Hex[] =>
  definitionFootprintAt(kind, anchorPosition, level) ??
  footprintFromShape(SHAPES[kind], anchorPosition);

export const buildingFootprint = (building: Building): Hex[] =>
  definitionFootprintForBuilding(building) ??
  building.footprint?.map((position) => ({ ...position })) ??
  [{ ...building.position }];

const ringAround = (footprint: Hex[]): Hex[] => {
  const occupied = new Set(footprint.map(key));
  const visited = new Map<string, Hex>();
  let frontier = footprint.map((position) => ({ ...position }));

  for (let distance = 0; distance < 2; distance += 1) {
    const next = new Map<string, Hex>();
    for (const position of frontier)
      for (const neighbor of neighbors(position)) {
        const neighborKey = key(neighbor);
        if (occupied.has(neighborKey) || visited.has(neighborKey)) continue;
        visited.set(neighborKey, neighbor);
        next.set(neighborKey, neighbor);
      }
    frontier = [...next.values()];
  }
  return [...visited.values()];
};

/** Buildings keep a compact two-micro-cell clearance around their authored footprint. */
export const footprintRing = (footprint: Hex[]): Hex[] => ringAround(footprint);

const clearanceCache = new Map<string, Hex[]>();

const relativeClearance = (kind: PlaceableBuildingKind, level: number): Hex[] => {
  const cacheKey = `${kind}:${level}`;
  const cached = clearanceCache.get(cacheKey);
  if (cached) return cached;
  const ring = ringAround(footprintAt(kind, { q: 0, r: 0 }, level));
  clearanceCache.set(cacheKey, ring);
  return ring;
};

const clearanceAt = (
  kind: PlaceableBuildingKind,
  anchorPosition: Hex,
  level = 1,
): Hex[] =>
  relativeClearance(kind, level).map((cell) => ({
    q: anchorPosition.q + cell.q,
    r: anchorPosition.r + cell.r,
  }));

type PlacementLookup = {
  tiles: ReturnType<typeof tileIndex>;
  occupiedResources: Set<string>;
  looseGoods: Set<string>;
  people: Set<string>;
  wayposts?: Hex[];
};

const createPlacementLookup = (world: World): PlacementLookup => ({
  tiles: tileIndex(world.tiles),
  occupiedResources: new Set(
    world.naturalResources
      .filter((resource) => !resource.depleted)
      .flatMap((resource) => naturalResourceFootprint(resource).map(key)),
  ),
  looseGoods: new Set(looseGoodStacks(world).map((stack) => key(stack.position))),
  people: new Set(world.people.map((person) => key(person.position))),
  wayposts: world.wayposts?.map((waypost) => waypost.position),
});

const freePlacementTile = (
  lookup: PlacementLookup,
  position: Hex,
  requireEmptyGround: boolean,
): boolean => {
  const positionKey = key(position);
  const tile = lookup.tiles.get(positionKey);
  return Boolean(
    tile &&
    (tile.terrain === "grass" || tile.terrain === "road") &&
    !lookup.occupiedResources.has(positionKey) &&
    (!requireEmptyGround || !lookup.looseGoods.has(positionKey)),
  );
};

const canPlaceWithLookup = (
  lookup: PlacementLookup,
  anchorPosition: Hex,
  kind: PlaceableBuildingKind,
  level = 1,
): boolean => {
  const entrance = buildingInteractionAt(kind, anchorPosition, level);
  if (!isWithinWaypostOrientation(lookup.wayposts, entrance)) return false;

  const footprint = footprintAt(kind, anchorPosition, level);
  if (
    lookup.wayposts?.some((waypostPosition) =>
      footprint.some(
        (position) => hexDistance(waypostPosition, position) <= WAYPOST_BUILD_CLEARANCE,
      ),
    )
  ) return false;
  if (!footprint.every((position) => freePlacementTile(lookup, position, true))) return false;
  if (!clearanceAt(kind, anchorPosition, level).every((position) => freePlacementTile(lookup, position, false))) return false;
  return !footprint.some((position) => lookup.people.has(key(position)));
};

const hasExistingLivestockBreeder = (world: World): boolean =>
  world.buildings.some(
    (building) => building.kind === "livestockBreeder" && !building.retired,
  );

export function canPlaceBuilding(
  world: World,
  anchorPosition: Hex,
  kind: PlaceableBuildingKind,
  options?: { houseLevel?: HouseLevel },
): boolean {
  if (!isBuildingUnlocked(world, kind)) return false;
  if (kind === "livestockBreeder" && hasExistingLivestockBreeder(world)) return false;
  const level = kind === "house" ? (options?.houseLevel ?? 1) : 1;
  if (kind === "house" && !isHouseLevelUnlocked(world, level as HouseLevel)) return false;
  return canPlaceWithLookup(createPlacementLookup(world), anchorPosition, kind, level);
}

export type UpgradePlacementBlockerKind =
  | "building"
  | "resource"
  | "terrain"
  | "looseGood"
  | "person"
  | "waypost"
  | "orientation";

export type UpgradePlacementBlocker = {
  kind: UpgradePlacementBlockerKind;
  position: Hex;
  id?: string | number;
  detail?: string;
};

const samePosition = (a: Hex, b: Hex): boolean => a.q === b.q && a.r === b.r;

const pushUpgradeBlocker = (
  blockers: UpgradePlacementBlocker[],
  blocker: UpgradePlacementBlocker,
): void => {
  const blockerKey = `${blocker.kind}:${blocker.id ?? ""}:${key(blocker.position)}:${blocker.detail ?? ""}`;
  if (blockers.some((candidate) =>
    `${candidate.kind}:${candidate.id ?? ""}:${key(candidate.position)}:${candidate.detail ?? ""}` === blockerKey
  )) return;
  blockers.push(blocker);
};

const otherBuildingAt = (
  world: World,
  position: Hex,
  ignoredBuildingId: string,
): Building | undefined =>
  world.buildings.find(
    (candidate) =>
      candidate.id !== ignoredBuildingId &&
      !candidate.retired &&
      buildingFootprint(candidate).some((cell) => samePosition(cell, position)),
  );

export function upgradePlacementBlockers(
  world: World,
  building: Building,
): UpgradePlacementBlocker[] {
  const houseTarget = building.kind === "house" ? nextHouseLevel(building) : undefined;
  const rule = buildingUpgradeRule(building.kind);
  if (!houseTarget && !rule) return [];

  const targetKind: PlaceableBuildingKind = houseTarget ? "house" : rule!.to;
  const targetLevel = houseTarget ?? 1;
  const anchor = buildingVisualAnchor(building);
  const targetFootprint = footprintAt(targetKind, anchor, targetLevel);
  const targetClearance = clearanceAt(targetKind, anchor, targetLevel);
  const currentFootprint = new Set(buildingFootprint(building).map(key));
  const tiles = tileIndex(world.tiles);
  const activeResources = world.naturalResources.filter((resource) => !resource.depleted);
  const looseGoodsByPosition = new Map(looseGoodStacks(world).map((stack) => [key(stack.position), stack]));
  const blockers: UpgradePlacementBlocker[] = [];

  const entrance = buildingInteractionAt(targetKind, anchor, targetLevel);
  if (!isWithinWaypostOrientation(world.wayposts?.map((waypost) => waypost.position), entrance)) {
    pushUpgradeBlocker(blockers, { kind: "orientation", position: entrance });
  }

  for (const waypost of world.wayposts ?? []) {
    const blockedCell = targetFootprint.find(
      (position) => hexDistance(waypost.position, position) <= WAYPOST_BUILD_CLEARANCE,
    );
    if (blockedCell)
      pushUpgradeBlocker(blockers, {
        kind: "waypost",
        id: waypost.id,
        position: { ...waypost.position },
      });
  }

  const inspectCell = (position: Hex, requireEmptyGround: boolean): void => {
    if (currentFootprint.has(key(position))) return;

    const tile = tiles.get(key(position));
    const otherBuilding = otherBuildingAt(world, position, building.id);
    if (otherBuilding) {
      pushUpgradeBlocker(blockers, {
        kind: "building",
        id: otherBuilding.id,
        position: { ...position },
        detail: otherBuilding.kind,
      });
    } else if (!tile || (tile.terrain !== "grass" && tile.terrain !== "road")) {
      pushUpgradeBlocker(blockers, {
        kind: "terrain",
        position: { ...position },
        detail: tile?.terrain ?? "outside",
      });
    }

    for (const resource of activeResources) {
      if (!naturalResourceFootprint(resource).some((cell) => samePosition(cell, position))) continue;
      pushUpgradeBlocker(blockers, {
        kind: "resource",
        id: resource.id,
        position: { ...position },
        detail: resource.kind,
      });
    }

    if (requireEmptyGround) {
      const stack = looseGoodsByPosition.get(key(position));
      if (stack)
        pushUpgradeBlocker(blockers, {
          kind: "looseGood",
          id: stack.id,
          position: { ...position },
          detail: stack.good,
        });

      for (const person of world.people.filter((candidate) => samePosition(candidate.position, position)))
        pushUpgradeBlocker(blockers, {
          kind: "person",
          id: person.id,
          position: { ...position },
        });
    }
  };

  for (const position of targetFootprint) inspectCell(position, true);
  for (const position of targetClearance) inspectCell(position, false);
  return blockers;
}

export function canUpgradeBuilding(world: World, building: Building): boolean {
  if (building.retired || (building.construction && !building.construction.complete))
    return false;
  if (building.kind === "house") {
    const target = nextHouseLevel(building);
    return target !== undefined &&
      isHouseLevelUnlocked(world, target) &&
      upgradePlacementBlockers(world, building).length === 0;
  }

  const rule = buildingUpgradeRule(building.kind);
  if (!rule) return false;
  if (!isBuildingUnlocked(world, rule.to)) return false;
  return upgradePlacementBlockers(world, building).length === 0;
}

export function startBuildingUpgrade(world: World, building: Building): boolean {
  if (building.kind === "house") {
    const target = nextHouseLevel(building);
    if (!target || !canUpgradeBuilding(world, building)) return false;

    const anchor = buildingVisualAnchor(building);
    const oldFootprint = buildingFootprint(building);
    const oldFootprintKeys = new Set(oldFootprint.map(key));
    const targetFootprint = footprintAt("house", anchor, target);
    const targetFootprintKeys = new Set(targetFootprint.map(key));
    const targetBlocked = new Set(
      (definitionBlockedAt("house", anchor, target) ?? []).map(key),
    );
    const tiles = tileIndex(world.tiles);
    const oldBaseTerrains = building.baseTerrains;

    for (const position of oldFootprint) {
      if (targetFootprintKeys.has(key(position))) continue;
      const tile = tiles.get(key(position));
      if (!tile) continue;
      tile.terrain = oldBaseTerrains?.[key(position)] ?? "grass";
      tile.buildingBlocking = undefined;
      tile.trafficTicks = undefined;
    }

    building.houseUpgradeTarget = target;
    building.position = buildingInteractionAt("house", anchor, target);
    building.footprint = targetFootprint.map((position) => ({ ...position }));
    building.baseTerrains = Object.fromEntries(
      targetFootprint.map((position) => [
        key(position),
        oldFootprintKeys.has(key(position))
          ? oldBaseTerrains?.[key(position)] ?? "grass"
          : "grass",
      ]),
    );

    for (const position of targetFootprint) {
      const tile = tiles.get(key(position));
      if (!tile) continue;
      tile.bush = undefined;
      tile.bushAvailable = undefined;
      tile.bushRegrowTick = undefined;
      tile.terrain = "building";
      tile.buildingBlocking = targetBlocked.has(key(position)) || undefined;
      tile.trafficTicks = undefined;
    }

    const plan = constructionPlan(HOUSE_LEVEL_DEFINITIONS[target].upgradeCost);
    building.construction = {
      required: { ...plan.required },
      delivered: isMaterialCheatEnabled(world) ? { ...plan.required } : {},
      duration: plan.duration,
      progress: 0,
      complete: false,
    };
    markTerrainChanged(world);
    markBushChanged(world);
    notifyConstructionSiteAdded(world);
    return true;
  }

  const rule = buildingUpgradeRule(building.kind);
  if (!rule || !canUpgradeBuilding(world, building)) return false;

  const anchor = buildingVisualAnchor(building);
  const oldFootprint = buildingFootprint(building);
  const oldFootprintKeys = new Set(oldFootprint.map(key));
  const targetFootprint = footprintAt(rule.to, anchor);
  const targetFootprintKeys = new Set(targetFootprint.map(key));
  const targetBlocked = new Set((definitionBlockedAt(rule.to, anchor) ?? []).map(key));
  const tiles = tileIndex(world.tiles);
  const oldBaseTerrains = building.baseTerrains;

  for (const position of oldFootprint) {
    if (targetFootprintKeys.has(key(position))) continue;
    const tile = tiles.get(key(position));
    if (!tile) continue;
    tile.terrain = oldBaseTerrains?.[key(position)] ?? "grass";
    tile.buildingBlocking = undefined;
    tile.trafficTicks = undefined;
  }

  const previousInput = building.input;
  const previousInputInventory = { ...(building.inputInventory ?? {}) };
  const previousOutput = building.output;
  applyBuildingKindDefinition(building, rule.to);
  building.input = previousInput;
  building.inputInventory = Object.keys(previousInputInventory).length
    ? { ...(building.inputInventory ?? {}), ...previousInputInventory }
    : building.inputInventory;
  building.output = previousOutput;
  building.position = buildingInteractionAt(rule.to, anchor);
  bindBuildingDefinition(building);
  building.footprint = targetFootprint.map((position) => ({ ...position }));
  building.baseTerrains = Object.fromEntries(
    targetFootprint.map((position) => [
      key(position),
      oldFootprintKeys.has(key(position))
        ? oldBaseTerrains?.[key(position)] ?? "grass"
        : "grass",
    ]),
  );

  for (const position of targetFootprint) {
    const tile = tiles.get(key(position));
    if (!tile) continue;
    tile.bush = undefined;
    tile.bushAvailable = undefined;
    tile.bushRegrowTick = undefined;
    tile.terrain = "building";
    tile.buildingBlocking = targetBlocked.has(key(position)) || undefined;
    tile.trafficTicks = undefined;
  }

  const plan = constructionPlan(rule.required);
  building.construction = {
    required: { ...plan.required },
    delivered: isMaterialCheatEnabled(world) ? { ...plan.required } : {},
    duration: plan.duration,
    progress: 0,
    complete: false,
  };
  markTerrainChanged(world);
  markBushChanged(world);
  notifyConstructionSiteAdded(world);
  return true;
}

export function validBuildingAnchors(
  world: World,
  kind: PlaceableBuildingKind,
  options?: { houseLevel?: HouseLevel },
): Hex[] {
  if (!isBuildingUnlocked(world, kind)) return [];
  if (kind === "livestockBreeder" && hasExistingLivestockBreeder(world)) return [];
  const level = kind === "house" ? (options?.houseLevel ?? 1) : 1;
  if (kind === "house" && !isHouseLevelUnlocked(world, level as HouseLevel)) return [];
  const lookup = createPlacementLookup(world);
  return world.tiles
    .filter((tile) => canPlaceWithLookup(lookup, tile, kind, level))
    .map((tile) => ({ q: tile.q, r: tile.r }));
}

export function buildWithFootprint(
  world: World,
  anchorPosition: Hex,
  kind: PlaceableBuildingKind,
  options?: { houseLevel?: HouseLevel },
): Building | undefined {
  if (
    kind === "house" &&
    options?.houseLevel &&
    !isHouseLevelUnlocked(world, options.houseLevel)
  ) return;
  const houseLevel = kind === "house" ? (options?.houseLevel ?? 1) : undefined;
  if (!canPlaceBuilding(world, anchorPosition, kind, houseLevel ? { houseLevel } : undefined)) return;
  const visualLevel = houseLevel ?? 1;
  const footprint = footprintAt(kind, anchorPosition, visualLevel);
  const blocked = new Set(
    (definitionBlockedAt(kind, anchorPosition, visualLevel) ?? []).map(key),
  );
  const baseTerrains: Record<string, "grass" | "road"> = {};
  for (const position of footprint) {
    // Roads never survive construction. After demolition every footprint tile becomes grass.
    baseTerrains[key(position)] = "grass";
  }

  const created = buildAt(
    world,
    buildingInteractionAt(kind, anchorPosition, visualLevel),
    kind as BuildableBuildingKind,
  );
  if (!created) return;
  bindBuildingDefinition(created);
  if (kind === "house") {
    created.kind = "house";
    created.name = "Wohnhaus";
    created.houseLevel = options?.houseLevel ?? 1;
    created.workers = 0;
    created.carriers = 0;
    created.merchants = 0;
    created.recipe = undefined;
    created.input = 0;
    created.output = 0;
    created.inputInventory = undefined;
    created.inventory = undefined;
  }
  const plan =
    kind === "house"
      ? constructionPlan(houseDirectCost(created.houseLevel ?? 1))
      : CONSTRUCTION_PLANS[kind];
  created.construction = {
    required: { ...plan.required },
    delivered: isMaterialCheatEnabled(world) ? { ...plan.required } : {},
    duration: plan.duration,
    progress: 0,
    complete: false,
  };
  created.footprint = footprint.map((position) => ({ ...position }));
  created.baseTerrains = baseTerrains;
  const tiles = tileIndex(world.tiles);
  for (const position of footprint) {
    const tile = tiles.get(key(position))!;
    tile.bush = undefined;
    tile.bushAvailable = undefined;
    tile.bushRegrowTick = undefined;
    tile.terrain = "building";
    tile.buildingBlocking = blocked.has(key(position)) || undefined;
    tile.trafficTicks = undefined;
  }
  markTerrainChanged(world);
  markBushChanged(world);
  notifyConstructionSiteAdded(world);
  return created;
}

export function removeBuildingWithFootprint(world: World, id: string): boolean {
  const existing = world.buildings.find((building) => building.id === id);
  if (!existing || existing.kind === "hq" || existing.kind === "field") return false;
  const footprint = buildingFootprint(existing);
  const baseTerrains = existing.baseTerrains;
  const palisade = existing.kind === "palisade";
  if (existing.kind === "house") releaseHouseholdsForHouse(world, existing.id);
  if (!removeBuilding(world, id)) return false;

  const tiles = tileIndex(world.tiles);
  for (const position of footprint) {
    const tile = tiles.get(key(position));
    if (!tile) continue;
    if (!palisade) {
      tile.terrain = baseTerrains?.[key(position)] ?? "grass";
      tile.trafficTicks = undefined;
    }
    tile.buildingBlocking = undefined;
  }
  markTerrainChanged(world);
  return true;
}
