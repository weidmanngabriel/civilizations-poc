import type { Building, Hex, NaturalResource, Person, Tile, World } from "./model";
import {
  buildingDefinition,
  buildingInteractionAt,
  definitionBlockedForBuilding,
  definitionFootprintAt,
} from "../buildings/buildingDefinitionRegistry";
import { attachNeeds } from "./needs";
import { attachSleep } from "./sleep";
import { STARTING_TECHNOLOGIES } from "./technology";
import {
  BASE_MAP_COLUMNS,
  BASE_MAP_ROWS,
  GRID_REFINEMENT,
  MAP_COLUMNS,
  MAP_ROWS,
  hexDistance,
  refinedCellCluster,
  scaleHex,
} from "./spatial";
import { key, tileIndex } from "./hex";
import {
  naturalResourceBlocksMovement,
  naturalResourceFootprint,
} from "./naturalResources";

const BASE_MOVEMENT_TILES_PER_SECOND = 2.5 / 3;

export const CONFIG = {
  population: 12,
  simulationHz: 60,
  decisionIntervalTicks: 60,
  duration: 240,
  spatialScale: GRID_REFINEMENT,
  baseMovementTilesPerSecond: BASE_MOVEMENT_TILES_PER_SECOND,
  movementPerTick: (BASE_MOVEMENT_TILES_PER_SECOND * GRID_REFINEMENT) / 60,
  roadSpeedMultiplier: 1.3,
  trafficThreshold: 8,
  trafficWindowTicks: 32 * 60,
  carryCapacity: 1,
  transferDurationTicks: 3 * 60,
  inputCapacity: 10,
  outputCapacity: 10,
  forestOutputCapacity: 3,
  warehouseCapacityPerGood: 20,
  warehouseCollectionRadiusWorldTiles: 5,
  warehouseCollectionRadius: 5 * GRID_REFINEMENT,
  forestYield: 3,
  resourceYield: 10,
  resourceOutputCapacity: 3,
  farmMaxFields: 4,
  farmFieldRadiusWorldTiles: 3,
  farmFieldRadius: 3 * GRID_REFINEMENT,
  farmActionDurationTicks: 10 * 60,
  fieldStageDurationTicks: 30 * 60,
  bushFoodValue: 40,
  bushRegrowMinTicks: 120 * 60,
  bushRegrowMaxTicks: 180 * 60,
  baseMapColumns: BASE_MAP_COLUMNS,
  baseMapRows: BASE_MAP_ROWS,
  mapColumns: MAP_COLUMNS,
  mapRows: MAP_ROWS,
} as const;

/** Historical coarse-grid offset coordinate converted to axial coordinates. */
const coarseAt = (col: number, row: number): Hex => ({
  q: col - Math.floor(row / 2),
  r: row,
});

/** Fine-grid offset coordinate converted to axial coordinates. */
const at = (col: number, row: number): Hex => ({
  q: col - Math.floor(row / 2),
  r: row,
});

const scaledAt = (col: number, row: number): Hex => scaleHex(coarseAt(col, row));

const TREE_CLUSTER_PATTERNS: readonly (readonly Hex[])[] = [
  [
    { q: 0, r: 0 },
    { q: 2, r: 0 },
    { q: 0, r: 2 },
  ],
  [
    { q: 0, r: 0 },
    { q: -2, r: 1 },
    { q: 1, r: 2 },
  ],
  [
    { q: 0, r: 0 },
    { q: 2, r: -1 },
    { q: -1, r: 2 },
  ],
] as const;

const compactFootprint = (center: Hex): Hex[] => {
  const coarseCells: Hex[] = [
    { q: 0, r: 0 },
    { q: 1, r: 0 },
    { q: 0, r: 1 },
    { q: 1, r: 1 },
  ];
  return coarseCells.flatMap((coarseCell) =>
    refinedCellCluster(coarseCell).map((cell) => ({
      q: center.q + cell.q,
      r: center.r + cell.r,
    })),
  );
};

type ScenarioOptions = {
  population: number;
  suppliedStart: boolean;
};

type CoarseCell = {
  col: number;
  row: number;
  position: Hex;
  scaledPosition: Hex;
};

const coarseCells: CoarseCell[] = Array.from(
  { length: BASE_MAP_COLUMNS * BASE_MAP_ROWS },
  (_, index) => {
    const row = Math.floor(index / BASE_MAP_COLUMNS);
    const col = index % BASE_MAP_COLUMNS;
    const position = coarseAt(col, row);
    return { col, row, position, scaledPosition: scaleHex(position) };
  },
);

/**
 * A fine-grid offset rectangle does not line up with 5×5 coarse offset blocks,
 * because odd/even row staggering changes at the micro-cell level. Resolve the
 * parent terrain by nearest scaled coarse hex centre instead.
 */
const nearestCoarseCell = (position: Hex): CoarseCell => {
  const estimatedQ = Math.round(position.q / GRID_REFINEMENT);
  const estimatedR = Math.round(position.r / GRID_REFINEMENT);
  let best: CoarseCell | undefined;
  let bestDistance = Number.POSITIVE_INFINITY;

  for (let dq = -1; dq <= 1; dq += 1)
    for (let dr = -1; dr <= 1; dr += 1) {
      const coarsePosition = { q: estimatedQ + dq, r: estimatedR + dr };
      const row = Math.max(0, Math.min(BASE_MAP_ROWS - 1, coarsePosition.r));
      const col = Math.max(
        0,
        Math.min(BASE_MAP_COLUMNS - 1, coarsePosition.q + Math.floor(row / 2)),
      );
      const candidate = coarseCells[row * BASE_MAP_COLUMNS + col]!;
      const distance = hexDistance(position, candidate.scaledPosition);
      if (distance < bestDistance) {
        best = candidate;
        bestDistance = distance;
      }
    }

  return best!;
};

function createScenario({ population, suppliedStart }: ScenarioOptions): World {
  const hqVisualAnchor = scaledAt(6, 20);
  const hqDefinition = buildingDefinition("hq");
  const authoredHqFootprint = suppliedStart
    ? definitionFootprintAt("hq", hqVisualAnchor)
    : undefined;
  if (suppliedStart && (!hqDefinition || !authoredHqFootprint))
    throw new Error("Die räumliche HQ-Definition fehlt.");
  const hqPosition = suppliedStart
    ? buildingInteractionAt("hq", hqVisualAnchor)
    : hqVisualAnchor;
  const buildings: Building[] = [
    {
      id: "hq",
      kind: "hq",
      name: "Hauptquartier",
      position: hqPosition,
      ...(suppliedStart ? { visualDefinitionId: hqDefinition!.visual.id } : {}),
      footprint: authoredHqFootprint ?? compactFootprint(hqVisualAnchor),
      workers: 0,
      carriers: 2,
      merchants: 0,
      input: 0,
      output: 0,
      inventory: {
        wood: 0,
        plank: 0,
        woodenTool: 0,
        wheat: 0,
        flour: 0,
        water: 0,
        bread: suppliedStart ? 10 : 0,
        clay: 0,
        rubble: 0,
        brick: 0,
        stoneBlock: 0,
      },
      baseTerrain: "grass",
    },
  ];

  const forestTiles = [
    [2, 1], [3, 1], [4, 1], [2, 2], [3, 2], [4, 2], [5, 2],
    [11, 4], [12, 4], [13, 4], [11, 5], [12, 5], [13, 5], [14, 5],
    [5, 17], [6, 17], [7, 17], [5, 18], [6, 18], [7, 18],
    [25, 13], [26, 13], [27, 13], [25, 14], [26, 14], [27, 14],
    [34, 21], [35, 21], [36, 21], [37, 21], [35, 22], [36, 22],
    [32, 5], [33, 5], [34, 5], [33, 6], [34, 6], [35, 6],
  ];

  const bushTiles = [
    [8, 7], [15, 3], [28, 4], [31, 7], [17, 10], [14, 12], [21, 13],
    [9, 14], [38, 15], [24, 17], [15, 18], [9, 19], [12, 20], [30, 19],
    [5, 4], [8, 3], [16, 2], [23, 1], [30, 2], [38, 3],
    [7, 6], [18, 6], [23, 7], [37, 7],
    [10, 9], [16, 9], [24, 9], [31, 9],
    [7, 10], [13, 10], [20, 10], [39, 10],
    [10, 12], [18, 12], [24, 12], [32, 12],
    [8, 16], [14, 16], [27, 16], [36, 16],
    [11, 18], [30, 18],
  ];

  const river = [
    [18, 0], [19, 0], [20, 0], [20, 1], [21, 1], [21, 2], [22, 2], [22, 3],
    [23, 3], [23, 4], [24, 4], [24, 5], [25, 5], [25, 6], [26, 6], [26, 7],
    [27, 7], [27, 8], [28, 8], [28, 9], [29, 9], [29, 10], [30, 10], [30, 11],
    [2, 11], [3, 11], [4, 11], [4, 12], [5, 12], [5, 13], [6, 13], [6, 14],
  ];

  const mountains = [
    [18, 16], [19, 16], [20, 16], [19, 17], [20, 17], [21, 17], [20, 18], [21, 18], [22, 18],
    [33, 9], [34, 9], [35, 9], [34, 10], [35, 10], [36, 10], [35, 11], [36, 11], [37, 11],
  ];

  const coordinateSet = (list: number[][]) =>
    new Set(list.map(([col, row]) => `${col},${row}`));
  const riverSet = coordinateSet(river);
  const mountainSet = coordinateSet(mountains);
  const buildingCells = new Set(
    buildings
      .flatMap((building) => building.footprint ?? [building.position])
      .map((position) => key(position)),
  );
  const blockedBuildingCells = new Set(
    suppliedStart
      ? buildings.flatMap((building) => definitionBlockedForBuilding(building) ?? []).map(key)
      : [],
  );
  const bushPositions = new Set(bushTiles.map(([col, row]) => {
    const position = scaledAt(col!, row!);
    return `${position.q},${position.r}`;
  }));

  const tiles: Tile[] = [];
  for (let row = 0; row < CONFIG.mapRows; row += 1)
    for (let col = 0; col < CONFIG.mapColumns; col += 1) {
      const position = at(col, row);
      const parent = nearestCoarseCell(position);
      const parentKey = `${parent.col},${parent.row}`;
      const positionKey = `${position.q},${position.r}`;
      const terrain: Tile["terrain"] = buildingCells.has(positionKey)
        ? "building"
        : riverSet.has(parentKey)
          ? "river"
          : mountainSet.has(parentKey)
            ? "mountain"
            : "grass";
      const bush = suppliedStart && terrain === "grass" && bushPositions.has(positionKey);
      tiles.push({
        ...position,
        terrain,
        ...(blockedBuildingCells.has(positionKey) ? { buildingBlocking: true } : {}),
        ...(bush ? { bush: true, bushAvailable: true } : {}),
      });
    }

  const indexedTiles = tileIndex(tiles);
  const naturalResources: NaturalResource[] = [];
  const occupiedResourceCells = new Set<string>();
  let nextForestId = 1;

  forestTiles.forEach(([col, row], clusterIndex) => {
    const center = scaledAt(col!, row!);
    const pattern = TREE_CLUSTER_PATTERNS[clusterIndex % TREE_CLUSTER_PATTERNS.length]!;
    for (const offset of pattern) {
      const position = { q: center.q + offset.q, r: center.r + offset.r };
      const tile = indexedTiles.get(key(position));
      const positionKey = key(position);
      if (!tile || tile.terrain !== "grass" || tile.bush || occupiedResourceCells.has(positionKey)) continue;
      naturalResources.push({
        id: `forest-${nextForestId++}`,
        kind: "forest",
        position,
        remaining: CONFIG.forestYield,
        output: 0,
      });
      occupiedResourceCells.add(positionKey);
    }
  });

  if (suppliedStart) {
    const terrainKeys = (terrain: Tile["terrain"]) =>
      new Set(tiles.filter((tile) => tile.terrain === terrain).map((tile) => `${tile.q},${tile.r}`));
    const adjacentGrass = (terrain: Tile["terrain"]): Tile[] => {
      const occupied = terrainKeys(terrain);
      return tiles.filter((tile) =>
        tile.terrain === "grass" &&
        [
          { q: tile.q + 1, r: tile.r },
          { q: tile.q - 1, r: tile.r },
          { q: tile.q, r: tile.r + 1 },
          { q: tile.q, r: tile.r - 1 },
          { q: tile.q + 1, r: tile.r - 1 },
          { q: tile.q - 1, r: tile.r + 1 },
        ].some((neighbor) => occupied.has(`${neighbor.q},${neighbor.r}`)),
      );
    };

    const addResource = (tile: Tile, kind: "clay" | "stone", index: number): boolean => {
      const resource: NaturalResource = {
        id: `${kind}-${index + 1}`,
        kind,
        position: { q: tile.q, r: tile.r },
        remaining: CONFIG.resourceYield,
        output: 0,
      };
      const footprint = naturalResourceFootprint(resource);
      if (!footprint.every((position) => {
        const footprintTile = indexedTiles.get(key(position));
        return footprintTile?.terrain === "grass" && !occupiedResourceCells.has(key(position));
      })) return false;

      naturalResources.push(resource);
      for (const position of footprint) {
        occupiedResourceCells.add(key(position));
        const footprintTile = indexedTiles.get(key(position));
        if (!footprintTile) continue;
        footprintTile.bush = undefined;
        footprintTile.bushAvailable = undefined;
        footprintTile.bushRegrowTick = undefined;
      }
      return true;
    };

    const candidateScore = (tile: Tile, kind: "clay" | "stone"): number => {
      const salt = kind === "clay" ? 0x45d9f3b : 0x27d4eb2d;
      return (
        Math.imul(tile.q + 257, 73856093) ^
        Math.imul(tile.r + 263, 19349663) ^
        salt
      ) >>> 0;
    };

    const addResourcesNear = (terrain: Tile["terrain"], kind: "clay" | "stone", count: number) => {
      let added = 0;
      const candidates = [...adjacentGrass(terrain)].sort(
        (a, b) => candidateScore(a, kind) - candidateScore(b, kind) || a.q - b.q || a.r - b.r,
      );
      for (const tile of candidates) {
        if (!addResource(tile, kind, added)) continue;
        added += 1;
        if (added >= count) break;
      }
    };

    addResourcesNear("river", "clay", 4);
    addResourcesNear("mountain", "stone", 4);
  }

  for (const resource of naturalResources) {
    if (!naturalResourceBlocksMovement(resource)) continue;
    for (const position of naturalResourceFootprint(resource)) {
      const tile = indexedTiles.get(key(position));
      if (tile) tile.resourceBlocking = true;
    }
  }

  const people: Person[] = Array.from({ length: population }, (_, i) => ({
    id: i + 1,
    position: { ...buildings[0]!.position },
    hunger: 100,
    hungerAccumulator: 0,
    sleep: 100,
    sleepAccumulator: 0,
    sleepGraceTicks: 0,
    active: false,
    progress: 0,
    movement: 0,
    path: [],
  }));

  if (suppliedStart) {
    for (const person of people.slice(0, Math.min(2, people.length))) person.builder = true;
    for (const person of people.slice(2, Math.min(4, people.length))) person.woodcutter = true;
  }

  const world: World = {
    round: 0,
    nextId: population + 1,
    nextBuildingId: 1,
    nextFieldId: 1,
    rngState: 0x1a2b3c4d,
    ...(suppliedStart ? { unlockedTechnologies: [...STARTING_TECHNOLOGIES] } : {}),
    buildings,
    naturalResources,
    tiles,
    people,
  };

  return attachNeeds(attachSleep(world));
}

/** Neutral deterministic world used by simulation tests and low-level scenarios. */
export function createWorld(population: number = CONFIG.population): World {
  return createScenario({ population, suppliedStart: false });
}

/** Actual player-facing PoC start scenario. */
export function createDefaultGameWorld(): World {
  return createScenario({ population: CONFIG.population, suppliedStart: true });
}
