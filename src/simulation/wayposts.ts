import type { Hex, Waypost, World } from "./model";
import { findPath, hexDistance, key, tileIndex, walkable } from "./hex";
import { GRID_REFINEMENT } from "./spatial";
import { naturalResourceFootprint } from "./naturalResources";
import { CONFIG } from "./scenario";

export const WAYPOST_ORIENTATION_RADIUS_WORLD_TILES = 2.5;
export const WAYPOST_ORIENTATION_RADIUS =
  WAYPOST_ORIENTATION_RADIUS_WORLD_TILES * GRID_REFINEMENT;
export const WAYPOST_MIN_DISTANCE_WORLD_TILES = 2.5;
export const WAYPOST_MIN_DISTANCE =
  WAYPOST_MIN_DISTANCE_WORLD_TILES * GRID_REFINEMENT;
export const WAYPOST_MAX_CONNECTION_DISTANCE_WORLD_TILES = 5;
export const WAYPOST_MAX_CONNECTION_DISTANCE =
  WAYPOST_MAX_CONNECTION_DISTANCE_WORLD_TILES * GRID_REFINEMENT;

export const wayposts = (world: World): Waypost[] => world.wayposts ?? [];

type WaypostPlacementContext = {
  tiles: Map<string, ReturnType<typeof tileIndex> extends Map<string, infer T> ? T : never>;
  activeResourceCells: Set<string>;
  looseGoodCells: Set<string>;
};

const waypostPlacementContext = (world: World): WaypostPlacementContext => ({
  tiles: tileIndex(world.tiles),
  activeResourceCells: new Set(
    world.naturalResources
      .filter((resource) => !resource.depleted)
      .flatMap((resource) => naturalResourceFootprint(resource).map(key)),
  ),
  looseGoodCells: new Set((world.looseGoods ?? []).map((stack) => key(stack.position))),
});

const canPlaceWaypostWithContext = (
  world: World,
  position: Hex,
  context: WaypostPlacementContext,
): boolean => {
  const tile = context.tiles.get(key(position));
  if (!tile || (tile.terrain !== "grass" && tile.terrain !== "road") || !walkable(tile))
    return false;
  if (tile.bush || context.activeResourceCells.has(key(position))) return false;
  if (context.looseGoodCells.has(key(position))) return false;
  return wayposts(world).every(
    (waypost) => hexDistance(waypost.position, position) >= WAYPOST_MIN_DISTANCE,
  );
};

export function canPlaceWaypost(world: World, position: Hex): boolean {
  return canPlaceWaypostWithContext(world, position, waypostPlacementContext(world));
}

export function validWaypostAnchors(world: World): Hex[] {
  const context = waypostPlacementContext(world);
  return world.tiles.filter((tile) => canPlaceWaypostWithContext(world, tile, context));
}

const canConnect = (world: World, a: Waypost, b: Waypost): boolean => {
  const distance = hexDistance(a.position, b.position);
  if (distance < WAYPOST_MIN_DISTANCE || distance > WAYPOST_MAX_CONNECTION_DISTANCE)
    return false;
  return Boolean(findPath(world.tiles, a.position, b.position));
};

const connectNewWaypost = (world: World, created: Waypost): void => {
  for (const other of wayposts(world)) {
    if (other.id === created.id || !canConnect(world, created, other)) continue;
    created.connections ??= [];
    other.connections ??= [];
    if (!created.connections.includes(other.id)) created.connections.push(other.id);
    if (!other.connections.includes(created.id)) other.connections.push(created.id);
  }
};

export function placeWaypost(world: World, position: Hex): Waypost | undefined {
  if (!canPlaceWaypost(world, position)) return undefined;
  world.wayposts ??= [];
  world.nextWaypostId ??= 1;
  const created: Waypost = {
    id: `waypost-${world.nextWaypostId++}`,
    position: { ...position },
    connections: [],
  };
  world.wayposts.push(created);
  connectNewWaypost(world, created);
  return created;
}

const initialWaypostCandidate = (world: World): Hex | undefined => {
  const hq = world.buildings.find((building) => building.kind === "hq" && !building.retired);
  if (!hq) return undefined;
  const preferred = {
    q: hq.position.q,
    r: hq.position.r + GRID_REFINEMENT,
  };
  const candidates = world.tiles
    .filter((tile) => tile.terrain === "grass" || tile.terrain === "road")
    .map((tile) => ({
      tile,
      preferredDistance: hexDistance(tile, preferred),
      hqDistance: Math.abs(hexDistance(tile, hq.position) - GRID_REFINEMENT),
    }))
    .sort(
      (a, b) =>
        a.preferredDistance - b.preferredDistance ||
        a.hqDistance - b.hqDistance ||
        a.tile.r - b.tile.r ||
        a.tile.q - b.tile.q,
    );
  return candidates.find(({ tile }) => {
    const existing = world.wayposts;
    world.wayposts = [];
    const valid = canPlaceWaypost(world, tile);
    world.wayposts = existing;
    return valid;
  })?.tile;
};

export function ensureInitialWaypost(world: World): Waypost | undefined {
  world.wayposts ??= [];
  if (world.wayposts.length) return world.wayposts[0];
  const candidate = initialWaypostCandidate(world);
  return candidate ? placeWaypost(world, candidate) : undefined;
}

const waypointGraphRoute = (
  world: World,
  start: Hex,
  end: Hex,
): Waypost[] | undefined => {
  const posts = wayposts(world);
  if (posts.length < 2) return undefined;
  const starts = posts.filter(
    (post) => hexDistance(start, post.position) <= WAYPOST_ORIENTATION_RADIUS,
  );
  const goals = new Set(
    posts
      .filter((post) => hexDistance(end, post.position) <= WAYPOST_ORIENTATION_RADIUS)
      .map((post) => post.id),
  );
  if (!starts.length || !goals.size) return undefined;
  if (starts.some((post) => goals.has(post.id))) return undefined;

  const byId = new Map(posts.map((post) => [post.id, post]));
  type Entry = { id: string; distance: number; path: string[] };
  const queue: Entry[] = starts.map((post) => ({
    id: post.id,
    distance: hexDistance(start, post.position),
    path: [post.id],
  }));
  const best = new Map<string, number>();

  while (queue.length) {
    queue.sort((a, b) => a.distance - b.distance);
    const current = queue.shift()!;
    if ((best.get(current.id) ?? Number.POSITIVE_INFINITY) <= current.distance) continue;
    best.set(current.id, current.distance);
    if (goals.has(current.id)) {
      return current.path.map((id) => byId.get(id)!).filter(Boolean);
    }
    const currentPost = byId.get(current.id);
    if (!currentPost) continue;
    for (const nextId of currentPost.connections ?? []) {
      const next = byId.get(nextId);
      if (!next) continue;
      const nextDistance =
        current.distance + hexDistance(currentPost.position, next.position);
      if ((best.get(nextId) ?? Number.POSITIVE_INFINITY) <= nextDistance) continue;
      queue.push({
        id: nextId,
        distance: nextDistance,
        path: [...current.path, nextId],
      });
    }
  }
  return undefined;
};

export function findPathViaWayposts(
  world: World,
  start: Hex,
  end: Hex,
  roadSpeedMultiplier = 1.3,
): Hex[] | null {
  const graphRoute = waypointGraphRoute(world, start, end);
  if (!graphRoute) return null;

  const targets = [...graphRoute.map((post) => post.position), end];
  let cursor = start;
  const result: Hex[] = [];
  for (const target of targets) {
    const segment = findPath(
      world.tiles,
      cursor,
      target,
      roadSpeedMultiplier,
    );
    if (!segment) return null;
    result.push(...segment);
    cursor = segment.at(-1) ?? cursor;
  }
  return result;
}


/** Prefer the player-authored waypost network when both ends can orient to it. */
export function findNavigationPath(
  world: World,
  start: Hex,
  end: Hex,
  roadSpeedMultiplier = 1.3,
): Hex[] | null {
  return (
    findPathViaWayposts(world, start, end, roadSpeedMultiplier) ??
    findPath(world.tiles, start, end, roadSpeedMultiplier)
  );
}
