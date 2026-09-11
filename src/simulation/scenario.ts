import type { Building, Hex, Person, Tile, World } from "./model";
import { attachNeeds } from "./needs";

export const CONFIG = {
  population: 12,
  simulationHz: 60,
  decisionIntervalTicks: 60,
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
  farmMaxFields: 4,
  farmFieldRadius: 3,
  farmActionDurationTicks: 10 * 60,
  fieldStageDurationTicks: 30 * 60,
  bushFoodValue: 40,
  bushRegrowMinTicks: 120 * 60,
  bushRegrowMaxTicks: 180 * 60,
  mapColumns: 41,
  mapRows: 25,
} as const;

const NEUTRAL_WORLD_POPULATION = 8;

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

type ScenarioOptions = {
  population: number;
  suppliedStart: boolean;
};

function createScenario({ population, suppliedStart }: ScenarioOptions): World {
  const hqPosition = at(6, 20);
  const buildings: Building[] = [
    {
      id: "hq",
      kind: "hq",
      name: "Hauptquartier",
      position: hqPosition,
      footprint: compactFootprint(hqPosition),
      workers: 0,
      carriers: suppliedStart ? 1 : 0,
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
      const terrain: Tile["terrain"] = occupiedByBuilding
        ? "building"
        : inList(river)
          ? "river"
          : inList(mountains)
            ? "mountain"
            : inList(forestTiles)
              ? "forest"
              : "grass";
      const bush = suppliedStart && terrain === "grass" && inList(bushTiles);
      tiles.push({
        ...position,
        terrain,
        ...(bush ? { bush: true, bushAvailable: true } : {}),
      });
    }

  const people: Person[] = Array.from({ length: population }, (_, i) => ({
    id: i + 1,
    position: { ...buildings[0]!.position },
    hunger: 100,
    hungerAccumulator: 0,
    active: false,
    progress: 0,
    movement: 0,
    path: [],
  }));

  if (suppliedStart) {
    if (people[0]) {
      people[0].assignment = { building: "hq", role: "carrier" };
      people[0].active = true;
    }
    for (const person of people.slice(1, Math.min(3, people.length))) person.builder = true;
    for (const person of people.slice(3, Math.min(5, people.length))) person.woodcutter = true;
  }

  return attachNeeds({
    round: 0,
    nextId: population + 1,
    nextForestId: 1,
    nextBuildingId: 1,
    nextFieldId: 1,
    rngState: 0x1a2b3c4d,
    buildings,
    tiles,
    people,
  });
}

/** Neutral deterministic world used by simulation tests and low-level scenarios. */
export function createWorld(population: number = NEUTRAL_WORLD_POPULATION): World {
  return createScenario({ population, suppliedStart: false });
}

/** Actual player-facing PoC start scenario. */
export function createDefaultGameWorld(): World {
  return createScenario({ population: CONFIG.population, suppliedStart: true });
}
