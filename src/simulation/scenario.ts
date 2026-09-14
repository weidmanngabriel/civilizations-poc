import type { Building, Hex, NaturalResource, Person, Tile, World } from "./model";
import { attachNeeds } from "./needs";
import { attachSleep } from "./sleep";
import { STARTING_TECHNOLOGIES } from "./technology";
import {
  BASE_MAP_COLUMNS,
  BASE_MAP_ROWS,
  GRID_REFINEMENT,
  MAP_COLUMNS,
  MAP_ROWS,
  refinedCellCluster,
  scaleHex,
} from "./spatial";

export const CONFIG = {
  population: 12,
  simulationHz: 60,
  decisionIntervalTicks: 60,
  duration: 240,
  spatialScale: GRID_REFINEMENT,
  baseMovementTilesPerSecond: 2.5,
  movementPerTick: (2.5 * GRID_REFINEMENT) / 60,
  roadSpeedMultiplier: 1.3,
  trafficThreshold: 8,
  trafficWindowTicks: 32 * 60,
  carryCapacity: 1,
  inputCapacity: 10,
  outputCapacity: 10,
  forestOutputCapacity: 3,
  warehouseCapacityPerGood: 20,
  warehouseCollectionRadiusWorldTiles: 10,
  warehouseCollectionRadius: 10 * GRID_REFINEMENT,
  forestYield: 10,
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

function createScenario({ population, suppliedStart }: ScenarioOptions): World {
  const hqPosition = scaledAt(6, 20);
  const buildings: Building[] = [
    {
      id: "hq",
      kind: "hq",
      name: "Hauptquartier",
      position: hqPosition,
      footprint: compactFootprint(hqPosition),
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

  const inList = (list: number[][], col: number, row: number) =>
    list.some(([c, r]) => c === col && r === row);
  const buildingCells = new Set(
    buildings.flatMap((building) => building.footprint ?? [building.position]).map((position) => `${position.q},${position.r}`),
  );
  const bushPositions = new Set(bushTiles.map(([col, row]) => {
    const position = scaledAt(col!, row!);
    return `${position.q},${position.r}`;
  }));

  const tiles: Tile[] = [];
  for (let row = 0; row < CONFIG.mapRows; row += 1)
    for (let col = 0; col < CONFIG.mapColumns; col += 1) {
      const position = at(col, row);
      const coarseCol = Math.min(BASE_MAP_COLUMNS - 1, Math.floor(col / GRID_REFINEMENT));
      const coarseRow = Math.min(BASE_MAP_ROWS - 1, Math.floor(row / GRID_REFINEMENT));
      const positionKey = `${position.q},${position.r}`;
      const terrain: Tile["terrain"] = buildingCells.has(positionKey)
        ? "building"
        : inList(river, coarseCol, coarseRow)
          ? "river"
          : inList(mountains, coarseCol, coarseRow)
            ? "mountain"
            : inList(forestTiles, coarseCol, coarseRow)
              ? "forest"
              : "grass";
      const bush = suppliedStart && terrain === "grass" && bushPositions.has(positionKey);
      tiles.push({
        ...position,
        terrain,
        ...(bush ? { bush: true, bushAvailable: true } : {}),
      });
    }

  const naturalResources: NaturalResource[] = forestTiles.map(([col, row], index) => ({
    id: `forest-${index + 1}`,
    kind: "forest",
    position: scaledAt(col!, row!),
    remaining: CONFIG.forestYield,
    output: 0,
  }));

  if (suppliedStart) {
    const adjacentGrass = (terrain: Tile["terrain"]): Tile[] => {
      const terrainKeys = new Set(tiles.filter((tile) => tile.terrain === terrain).map((tile) => `${tile.q},${tile.r}`));
      return tiles.filter((tile) =>
        tile.terrain === "grass" &&
        [
          { q: tile.q + 1, r: tile.r },
          { q: tile.q - 1, r: tile.r },
          { q: tile.q, r: tile.r + 1 },
          { q: tile.q, r: tile.r - 1 },
          { q: tile.q + 1, r: tile.r - 1 },
          { q: tile.q - 1, r: tile.r + 1 },
        ].some((neighbor) => terrainKeys.has(`${neighbor.q},${neighbor.r}`)),
      );
    };
    const spread = (candidates: Tile[], count: number): Tile[] => {
      if (candidates.length <= count) return candidates;
      return Array.from({ length: count }, (_, index) =>
        candidates[Math.floor((index * (candidates.length - 1)) / Math.max(1, count - 1))]!,
      );
    };
    const addResource = (tile: Tile, kind: "clay" | "stone", index: number) => {
      naturalResources.push({
        id: `${kind}-${index + 1}`,
        kind,
        position: { q: tile.q, r: tile.r },
        remaining: CONFIG.resourceYield,
        output: 0,
      });
      tile.bush = undefined;
      tile.bushAvailable = undefined;
      tile.bushRegrowTick = undefined;
    };
    spread(adjacentGrass("river"), 4).forEach((tile, index) => addResource(tile, "clay", index));
    spread(adjacentGrass("mountain"), 4).forEach((tile, index) => addResource(tile, "stone", index));
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

  // Hunger has priority. Sleep runs directly after the hunger step on the same fixed tick.
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
