import type { Building, Tile, World } from "./model";
export const CONFIG = {
  population: 8,
  duration: 5,
  carryCapacity: 1,
  inputCapacity: 10,
  outputCapacity: 3,
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
      position: at(1, 5),
      workers: 0,
      carriers: 0,
      input: 0,
      output: 0,
    },
    {
      id: "forest",
      name: "Wald",
      position: at(1, 1),
      workers: 2,
      carriers: 0,
      input: 0,
      output: 0,
      recipe: { amount: 0, output: "wood", duration: CONFIG.duration },
    },
    {
      id: "sawmill",
      name: "Sägewerk",
      position: at(4, 3),
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
      position: at(7, 3),
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
      position: at(7, 5),
      workers: 0,
      carriers: 2,
      input: 0,
      output: 0,
    },
  ];
  const roads = [
    [1, 2],
    [2, 2],
    [2, 3],
    [2, 4],
    [1, 4],
    [3, 3],
    [5, 3],
    [6, 3],
    [7, 4],
  ];
  const river = [
    [4, 0],
    [5, 0],
    [5, 1],
    [6, 1],
    [6, 2],
  ];
  const mountains = [
    [4, 5],
    [4, 6],
    [5, 5],
    [5, 6],
  ];
  const tiles: Tile[] = [];
  for (let row = 0; row < 7; row++)
    for (let col = 0; col < 9; col++) {
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
                : "grass",
      });
    }
  return {
    round: 0,
    nextId: population + 1,
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
