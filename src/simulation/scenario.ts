import type { Building, Tile, World } from "./model";

export const CONFIG = {
  population: 8,
  duration: 5,
  carryCapacity: 1,
  inputCapacity: 10,
  outputCapacity: 3,
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
      name: "Hauptquartier",
      position: at(3, 10),
      workers: 0,
      carriers: 0,
      input: 0,
      output: 0,
    },
    {
      id: "forest",
      name: "Wald 1",
      position: at(2, 1),
      workers: 2,
      carriers: 0,
      input: 0,
      output: 0,
      forestRemaining: CONFIG.forestYield,
      recipe: { amount: 0, output: "wood", duration: CONFIG.duration },
    },
    {
      id: "sawmill",
      name: "Sägewerk",
      position: at(9, 4),
      workers: 1,
      carriers: 2,
      input: 0,
      output: 0,
      recipe: {
        input: "wood",
        amount: 2,
        output: "plank",
        duration: CONFIG.duration,
      },
    },
    {
      id: "carpenter",
      name: "Schreinerei",
      position: at(16, 7),
      workers: 1,
      carriers: 2,
      input: 0,
      output: 0,
      recipe: {
        input: "plank",
        amount: 2,
        output: "woodenTool",
        duration: CONFIG.duration,
      },
    },
    {
      id: "warehouse",
      name: "Lager",
      position: at(19, 11),
      workers: 0,
      carriers: 2,
      input: 0,
      output: 0,
    },
  ];

  const roads = [
    [3, 1], [4, 1], [5, 1], [5, 2], [5, 3], [6, 4], [7, 4], [8, 4],
    [3, 9], [4, 9], [4, 8], [5, 8], [5, 7], [6, 7], [6, 6], [6, 5],
    [10, 4], [11, 4], [11, 5], [12, 5], [12, 6], [13, 6], [14, 6], [14, 7], [15, 7],
    [7, 7], [8, 7], [8, 6], [9, 6], [9, 5],
    [16, 8], [17, 8], [17, 9], [18, 9], [18, 10], [19, 10],
    [15, 8], [15, 9], [16, 9], [16, 10], [17, 10], [17, 11], [18, 11],
  ];

  const forestTiles = [
    [1, 0], [2, 0], [1, 1], [2, 2], [3, 2],
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
          : inList(roads)
            ? "road"
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
    nextForestId: 2,
    rngState: 0x1a2b3c4d,
    buildings,
    tiles,
    people: Array.from({ length: population }, (_, i) => ({
      id: i + 1,
      position: { ...buildings[0]!.position },
      active: false,
      progress: 0,
      path: [],
    })),
  };
}
