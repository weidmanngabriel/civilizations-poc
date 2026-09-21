import type { Building, Hex, World } from "./model";
import { CONFIG } from "./scenario";
import { hexDistance, key, movementCost, neighbors, tileIndex, walkable } from "./hex";

export const PALISADE_MAX_SEGMENTS = 50;

type SearchNode = { position: Hex; cost: number; depth: number; priority: number };

const exactSame = (a: Hex, b: Hex): boolean => a.q === b.q && a.r === b.r;

const reconstruct = (
  previous: Map<string, Hex | null>,
  start: Hex,
  end: Hex,
): Hex[] => {
  const path: Hex[] = [];
  let cursor = end;
  while (!exactSame(cursor, start)) {
    path.unshift(cursor);
    const prior = previous.get(key(cursor));
    if (!prior) break;
    cursor = prior;
  }
  return path;
};

export const palisadeTileAvailable = (world: World, position: Hex): boolean => {
  const tile = tileIndex(world.tiles).get(key(position));
  if (!tile || (tile.terrain !== "grass" && tile.terrain !== "road") || !walkable(tile)) return false;
  return !world.buildings.some(
    (building) =>
      !building.retired &&
      building.kind === "palisade" &&
      exactSame(building.position, position),
  );
};

/**
 * Bounded A*: uses normal movement costs, but never expands beyond the number
 * of steps needed for at most PALISADE_MAX_SEGMENTS including the start cell.
 * If the target is farther away, the best frontier path becomes the preview.
 */
export function planPalisadePath(
  world: World,
  start: Hex,
  target: Hex,
  maxSegments = PALISADE_MAX_SEGMENTS,
): Hex[] {
  if (maxSegments <= 0 || !palisadeTileAvailable(world, start)) return [];
  if (exactSame(start, target)) return [{ ...start }];

  const maxMoves = Math.max(0, maxSegments - 1);
  const index = tileIndex(world.tiles);
  const startKey = key(start);
  const open: SearchNode[] = [{
    position: { ...start },
    cost: 0,
    depth: 0,
    priority: hexDistance(start, target),
  }];
  const bestCost = new Map<string, number>([[startKey, 0]]);
  const bestDepth = new Map<string, number>([[startKey, 0]]);
  const previous = new Map<string, Hex | null>([[startKey, null]]);
  let bestPartial = { ...start };
  let bestPartialDistance = hexDistance(start, target);
  let bestPartialCost = 0;

  while (open.length) {
    open.sort((a, b) => a.priority - b.priority || a.cost - b.cost || a.depth - b.depth);
    const current = open.shift()!;
    const currentKey = key(current.position);
    if (
      current.cost > (bestCost.get(currentKey) ?? Number.POSITIVE_INFINITY) + 1e-9 ||
      current.depth !== bestDepth.get(currentKey)
    ) continue;

    const remaining = hexDistance(current.position, target);
    if (
      remaining < bestPartialDistance ||
      (remaining === bestPartialDistance && current.cost < bestPartialCost)
    ) {
      bestPartial = current.position;
      bestPartialDistance = remaining;
      bestPartialCost = current.cost;
    }

    if (exactSame(current.position, target))
      return [{ ...start }, ...reconstruct(previous, start, current.position)].slice(0, maxSegments);

    if (current.depth >= maxMoves) continue;

    for (const next of neighbors(current.position)) {
      const tile = index.get(key(next));
      if (!tile || !palisadeTileAvailable(world, next)) continue;
      const depth = current.depth + 1;
      const cost = current.cost + movementCost(tile, CONFIG.roadSpeedMultiplier);
      const nextKey = key(next);
      const knownDepth = bestDepth.get(nextKey);
      const knownCost = bestCost.get(nextKey);
      if (
        knownDepth !== undefined &&
        (knownDepth < depth || (knownDepth === depth && (knownCost ?? Infinity) <= cost + 1e-9))
      ) continue;
      bestDepth.set(nextKey, depth);
      bestCost.set(nextKey, cost);
      previous.set(nextKey, current.position);
      open.push({
        position: next,
        cost,
        depth,
        priority: cost + hexDistance(next, target) / CONFIG.roadSpeedMultiplier,
      });
    }
  }

  return [{ ...start }, ...reconstruct(previous, start, bestPartial)].slice(0, maxSegments);
}

export function createPalisadeSites(world: World, path: readonly Hex[]): Building[] {
  const created: Building[] = [];
  for (const position of path.slice(0, PALISADE_MAX_SEGMENTS)) {
    if (!palisadeTileAvailable(world, position)) continue;
    const tile = tileIndex(world.tiles).get(key(position));
    if (!tile) continue;
    const number = world.nextBuildingId++;
    const building: Building = {
      id: `palisade-${number}`,
      kind: "palisade",
      name: "Palisade",
      position: { ...position },
      footprint: [{ ...position }],
      workers: 0,
      carriers: 0,
      input: 0,
      output: 0,
      baseTerrain: tile.terrain === "road" ? "road" : "grass",
      construction: {
        required: { wood: 1 },
        delivered: {},
        duration: CONFIG.simulationHz,
        progress: 0,
        complete: false,
      },
    };
    world.buildings.push(building);
    created.push(building);
  }
  return created;
}

export const completedPalisadeAt = (world: World, position: Hex): Building | undefined =>
  world.buildings.find(
    (building) =>
      !building.retired &&
      building.kind === "palisade" &&
      building.construction?.complete &&
      exactSame(building.position, position),
  );
