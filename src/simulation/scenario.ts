import type { Building, Tile, World } from "./model";

export const CONFIG = {
  population: 8,
  simulationHz: 60,
  duration: 60,
  baseMovementTilesPerSecond: 5,
  movementPerTick: 5 / 60,
  roadSpeedMultiplier: 1.3,
  trafficThreshold: 8,
  trafficWindowTicks: 8 * 60,
  carryCapacity: 1,
  inputCapacity: 10,
  outputCapacity: 3,
  warehouseCapacityPerGood: 20,
  warehouseCollectionRadius: 5,
  forestYield: 10,
  mapColumns: 21,
  mapRows: 13,
} as const;

const at = (col: number, row: number) => ({
  q: col - Math.floor(row / 2),
  r: row,
});

export function createWorld(population: number = CONFIG.population): World {
  const buildings: Building[] = [
    {
      id: "hq",
      kind: "hq",
      name: "Hauptquartier",
      position: at(3, 10),
      workers: 0,
      carriers: 0,
      input: 0,
      output: 0,
      baseTerrain: "grass",
    },
  ];

  const forestTiles = [
    [1, 0], [2, 0], [1, 1], [2, 1], [2, 2], [3, 2],
    [6, 2], [7, 2], [8, 2], [7, 3], [8, 3],
    [4, 10], [5, 10], [5, 11], [6, 11],
    [13, 7], [13, 8], [14, 8], [14, 9],
    [18, 12], [19, 12], [20, 12], [20, 11],
  ];

  const river = [
    [9, 0], [10, 0], [11, 0], [11, 1], [12, 1], [12, 2], [13, 2], [13, 3], [14, 3], [14, 4], [15, 4], [15, 5],
    [1, 6], [2, 6], [2, 7], [3, 7], [3, 8],
  ];

  const mountains = [
    [9, 8], [10, 8], [10, 9], [11, 9], [11, 10], [12, 10], [12, 11],
    [17, 2], [18, 2], [18, 3], [19, 3], [19, 4], [20, 4],
  ];

  const tiles: Tile[] = [];
  for (let row = 0; row < CONFIG.mapRows; row += 1)
    for (let col = 0; col < CONFIG.mapColumns; col += 1) {
      const position = at(col, row);
      const inList = (list: number[][]) =>
        list.some(([c, r]) => c === col && r === row);
      tiles.push({
        ...position,
        terrain: buildings.some(
          (b) => b.position.q === position.q && b.position.r === position.r,
        )
          ? "building"
          : inList(river)
            ? "river"
            : inList(mountains)
              ? "mountain"
              : inList(forestTiles)
                ? "forest"
                : "grass",
      });
    }

  return {
    round: 0,
    nextId: population + 1,
    nextForestId: 1,
    nextBuildingId: 1,
    rngState: 0x1a2b3c4d,
    buildings,
    tiles,
    people: Array.from({ length: population }, (_, i) => ({
      id: i + 1,
      position: { ...buildings[0]!.position },
      active: false,
      progress: 0,
      movement: 0,
      path: [],
    })),
  };
}
