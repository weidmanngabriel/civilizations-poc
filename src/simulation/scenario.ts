import type { Building, Hex, Tile, World } from "./model";

export const CONFIG = {
  population: 8,
  simulationHz: 60,
  duration: 240,
  baseMovementTilesPerSecond: 2.5,
  movementPerTick: 2.5 / 60,
  roadSpeedMultiplier: 1.3,
  trafficThreshold: 8,
  trafficWindowTicks: 32 * 60,
  carryCapacity: 1,
  inputCapacity: 10,
  outputCapacity: 3,
  warehouseCapacityPerGood: 20,
  warehouseCollectionRadius: 10,
  forestYield: 10,
  mapColumns: 41,
  mapRows: 25,
} as const;

const at = (col: number, row: number): Hex => ({
  q: col - Math.floor(row / 2),
  r: row,
});

const compactFootprint = (center: Hex): Hex[] => [
  { ...center },
  { q: center.q + 1, r: center.r },
  { q: center.q, r: center.r + 1 },
  { q: center.q + 1, r: center.r + 1 },
];

export function createWorld(population: number = CONFIG.population): World {
  const hqPosition = at(6, 20);
  const buildings: Building[] = [
    {
      id: "hq",
      kind: "hq",
      name: "Hauptquartier",
      position: hqPosition,
      footprint: compactFootprint(hqPosition),
      workers: 0,
      carriers: 0,
      input: 0,
      output: 0,
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

  const tiles: Tile[] = [];
  for (let row = 0; row < CONFIG.mapRows; row += 1)
    for (let col = 0; col < CONFIG.mapColumns; col += 1) {
      const position = at(col, row);
      const inList = (list: number[][]) => list.some(([c, r]) => c === col && r === row);
      const occupiedByBuilding = buildings.some((building) =>
        (building.footprint ?? [building.position]).some(
          (occupied) => occupied.q === position.q && occupied.r === position.r,
        ),
      );
      tiles.push({
        ...position,
        terrain: occupiedByBuilding
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
