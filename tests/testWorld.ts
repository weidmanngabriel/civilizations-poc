import { key, tileIndex } from "../src/simulation/hex";
import {
  naturalResourceBlocksMovement,
  naturalResourceFootprint,
} from "../src/simulation/naturalResources";
import type { Hex, NaturalResourceKind, World } from "../src/simulation/model";
import { CONFIG, createWorld } from "../src/simulation/scenario";

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

  const world = createWorld(population);
  const hq = world.buildings.find((building) => building.kind === "hq")!;
  const qMin = hq.position.q - Math.floor(width / 2);
  const rMin = hq.position.r - Math.floor(height / 2);
  const qMax = qMin + width;
  const rMax = rMin + height;
  const hqCells = new Set((hq.footprint ?? [hq.position]).map(key));

  world.tiles = world.tiles
    .filter((tile) => tile.q >= qMin && tile.q < qMax && tile.r >= rMin && tile.r < rMax)
    .map((tile) => ({
      q: tile.q,
      r: tile.r,
      terrain: hqCells.has(key(tile)) ? "building" : "grass",
    }));
  world.naturalResources = [];
  world.looseGoods = [];

  const tiles = tileIndex(world.tiles);
  for (const positionKey of hqCells)
    if (!tiles.has(positionKey))
      throw new Error(`test world ${width}x${height} is too small for the HQ footprint`);

  resources.forEach((spec, index) => {
    const resource = {
      id: `test-${spec.kind}-${index + 1}`,
      kind: spec.kind,
      position: {
        q: hq.position.q + spec.offset.q,
        r: hq.position.r + spec.offset.r,
      },
      remaining:
        spec.remaining ??
        (spec.kind === "forest" ? CONFIG.forestYield : CONFIG.resourceYield),
      output: 0,
    };
    const footprint = naturalResourceFootprint(resource);
    if (!footprint.every((position) => tiles.get(key(position))?.terrain === "grass"))
      throw new Error(`test resource ${resource.id} does not fit on grass inside the test world`);

    world.naturalResources.push(resource);
    if (naturalResourceBlocksMovement(resource))
      for (const position of footprint) tiles.get(key(position))!.resourceBlocking = true;
  });

  return world;
}
