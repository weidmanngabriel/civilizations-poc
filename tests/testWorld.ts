import { key, tileIndex } from "../src/simulation/hex";
import {
  naturalResourceBlocksMovement,
  naturalResourceFootprint,
} from "../src/simulation/naturalResources";
import type { Hex, NaturalResourceKind, Person, World } from "../src/simulation/model";
import { attachNeeds } from "../src/simulation/needs";
import { CONFIG } from "../src/simulation/scenario";
import { attachSleep } from "../src/simulation/sleep";

export type TestResourceSpec = {
  kind: NaturalResourceKind;
  offset: Hex;
  remaining?: number;
};

export type TestWorldOptions = {
  width?: number;
  height?: number;
  population?: number;
  resources?: readonly TestResourceSpec[];
};

export function createTestWorld({
  width = 32,
  height = 24,
  population = 1,
  resources = [],
}: TestWorldOptions = {}): World {
  if (!Number.isInteger(width) || width < 1 || !Number.isInteger(height) || height < 1)
    throw new Error("test world dimensions must be positive integers");

  const hqPosition = { q: 0, r: 0 };
  const qMin = hqPosition.q - Math.floor(width / 2);
  const rMin = hqPosition.r - Math.floor(height / 2);
  const qMax = qMin + width;
  const rMax = rMin + height;
  const hqCells = new Set([key(hqPosition)]);

  const tiles: World["tiles"] = [];
  for (let r = rMin; r < rMax; r += 1)
    for (let q = qMin; q < qMax; q += 1)
      tiles.push({
        q,
        r,
        terrain: hqCells.has(key({ q, r })) ? "building" : "grass",
      });

  const people: Person[] = Array.from({ length: population }, (_, index) => ({
    id: index + 1,
    position: { ...hqPosition },
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

  const world: World = {
    round: 0,
    simulationSpeed: 1,
    nextId: population + 1,
    nextBuildingId: 1,
    nextFieldId: 1,
    rngState: 0x1a2b3c4d,
    buildings: [{
      id: "hq",
      kind: "hq",
      name: "Hauptquartier",
      position: { ...hqPosition },
      footprint: [{ ...hqPosition }],
      workers: 0,
      carriers: 2,
      merchants: 0,
      input: 0,
      output: 0,
      inventory: {
        wood: 0,
        plank: 0,
        woodenTool: 0,
        shoes: 0,
        wheat: 0,
        flour: 0,
        water: 0,
        bread: 0,
        clay: 0,
        rubble: 0,
        brick: 0,
        stoneBlock: 0,
      },
      baseTerrain: "grass",
    }],
    naturalResources: [],
    looseGoods: [],
    tiles,
    people,
  };

  const indexedTiles = tileIndex(world.tiles);
  for (const positionKey of hqCells)
    if (!indexedTiles.has(positionKey))
      throw new Error(`test world ${width}x${height} is too small for the HQ footprint`);

  resources.forEach((spec, index) => {
    const resource = {
      id: `test-${spec.kind}-${index + 1}`,
      kind: spec.kind,
      position: {
        q: hqPosition.q + spec.offset.q,
        r: hqPosition.r + spec.offset.r,
      },
      remaining:
        spec.remaining ??
        (spec.kind === "forest" ? CONFIG.forestYield : CONFIG.resourceYield),
      output: 0,
    };
    const footprint = naturalResourceFootprint(resource);
    if (!footprint.every((position) => indexedTiles.get(key(position))?.terrain === "grass"))
      throw new Error(`test resource ${resource.id} does not fit on grass inside the test world`);

    world.naturalResources.push(resource);
    if (naturalResourceBlocksMovement(resource))
      for (const position of footprint) indexedTiles.get(key(position))!.resourceBlocking = true;
  });

  return attachNeeds(attachSleep(world));
}
