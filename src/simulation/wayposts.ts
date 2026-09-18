import type { Hex, Person, Tile, Waypost, World } from "./model";
import { findPath, hexDistance, key, pathTravelCost, same, tileIndex, walkable } from "./hex";
import { GRID_REFINEMENT } from "./spatial";
import { naturalResourceFootprint } from "./naturalResources";

export const WAYPOST_ORIENTATION_RADIUS_WORLD_TILES = 3.5;
export const WAYPOST_MIN_DISTANCE_WORLD_TILES =
  WAYPOST_ORIENTATION_RADIUS_WORLD_TILES;
export const WAYPOST_MAX_CONNECTION_DISTANCE_WORLD_TILES =
  WAYPOST_ORIENTATION_RADIUS_WORLD_TILES * 2;

export const WAYPOST_ORIENTATION_RADIUS =
  WAYPOST_ORIENTATION_RADIUS_WORLD_TILES * GRID_REFINEMENT;
export const WAYPOST_MIN_DISTANCE =
  WAYPOST_MIN_DISTANCE_WORLD_TILES * GRID_REFINEMENT;
export const WAYPOST_MAX_CONNECTION_DISTANCE =
  WAYPOST_MAX_CONNECTION_DISTANCE_WORLD_TILES * GRID_REFINEMENT;

export const wayposts = (world: World): Waypost[] => world.wayposts ?? [];

type WaypostPlacementContext = {
  tiles: Map<string, Tile>;
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
  world.waypostRevision = (world.waypostRevision ?? 0) + 1;
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

type Segment = { path: Hex[]; cost: number };

const localSegment = (
  world: World,
  start: Hex,
  end: Hex,
  roadSpeedMultiplier: number,
): Segment | undefined => {
  if (same(start, end)) return { path: [], cost: 0 };
  const path = findPath(world.tiles, start, end, roadSpeedMultiplier);
  if (!path) return undefined;
  return {
    path,
    cost: pathTravelCost(world.tiles, path, roadSpeedMultiplier),
  };
};

export function findPathViaWayposts(
  world: World,
  start: Hex,
  end: Hex,
  roadSpeedMultiplier = 1.3,
): Hex[] | null {
  if (same(start, end)) return [];

  const posts = wayposts(world);
  const startPosts = posts.filter(
    (post) => hexDistance(start, post.position) <= WAYPOST_ORIENTATION_RADIUS,
  );
  const goalPosts = new Set(
    posts
      .filter((post) => hexDistance(end, post.position) <= WAYPOST_ORIENTATION_RADIUS)
      .map((post) => post.id),
  );
  if (!startPosts.length || !goalPosts.size) return null;

  const byId = new Map(posts.map((post) => [post.id, post]));
  const segmentCache = new Map<string, Segment | undefined>();
  const segmentBetween = (a: Waypost, b: Waypost): Segment | undefined => {
    const cacheKey = `${a.id}->${b.id}`;
    if (segmentCache.has(cacheKey)) return segmentCache.get(cacheKey);
    const segment = localSegment(world, a.position, b.position, roadSpeedMultiplier);
    segmentCache.set(cacheKey, segment);
    return segment;
  };

  type Entry = { id: string; cost: number; path: Hex[] };
  const queue: Entry[] = [];
  for (const post of startPosts) {
    const segment = localSegment(world, start, post.position, roadSpeedMultiplier);
    if (!segment) continue;
    queue.push({ id: post.id, cost: segment.cost, path: segment.path });
  }
  if (!queue.length) return null;

  const best = new Map<string, number>();
  let bestGoal: { cost: number; path: Hex[] } | undefined;

  while (queue.length) {
    queue.sort((a, b) => a.cost - b.cost || a.id.localeCompare(b.id));
    const current = queue.shift()!;
    if ((best.get(current.id) ?? Number.POSITIVE_INFINITY) <= current.cost) continue;
    best.set(current.id, current.cost);

    if (bestGoal && current.cost >= bestGoal.cost) continue;
    const currentPost = byId.get(current.id);
    if (!currentPost) continue;

    if (goalPosts.has(current.id)) {
      const finalSegment = localSegment(
        world,
        currentPost.position,
        end,
        roadSpeedMultiplier,
      );
      if (finalSegment) {
        const goalCost = current.cost + finalSegment.cost;
        if (!bestGoal || goalCost < bestGoal.cost) {
          bestGoal = {
            cost: goalCost,
            path: [...current.path, ...finalSegment.path],
          };
        }
      }
    }

    for (const nextId of currentPost.connections ?? []) {
      const next = byId.get(nextId);
      if (!next) continue;
      const segment = segmentBetween(currentPost, next);
      if (!segment) continue;
      const nextCost = current.cost + segment.cost;
      if ((best.get(nextId) ?? Number.POSITIVE_INFINITY) <= nextCost) continue;
      queue.push({
        id: nextId,
        cost: nextCost,
        path: [...current.path, ...segment.path],
      });
    }
  }

  return bestGoal?.path ?? null;
}

export function findNavigationPath(
  world: World,
  start: Hex,
  end: Hex,
  roadSpeedMultiplier = 1.3,
): Hex[] | null {
  // Neutral/sandbox fixtures without a waypost system keep low-level A* semantics.
  // Player-facing worlds always own a waypost array and therefore require the network.
  if (world.wayposts === undefined)
    return findPath(world.tiles, start, end, roadSpeedMultiplier);
  return findPathViaWayposts(world, start, end, roadSpeedMultiplier);
}

const navigationTargetKey = (target: Hex): string => key(target);

const resetNavigationFailures = (person: Person): void => {
  person.navigationFailureRevision = undefined;
  person.navigationFailedTargets = undefined;
};

export function findCandidateNavigationPath(
  world: World,
  person: Person,
  end: Hex,
  roadSpeedMultiplier = 1.3,
): Hex[] | null {
  if (same(person.position, end)) {
    person.navigationBlocked = undefined;
    return [];
  }

  const revision = world.waypostRevision ?? 0;
  if (person.navigationFailureRevision !== revision) {
    person.navigationFailureRevision = revision;
    person.navigationFailedTargets = [];
  }

  const targetKey = navigationTargetKey(end);
  if (person.navigationFailedTargets?.includes(targetKey)) {
    person.navigationBlocked = true;
    return null;
  }

  const path = findNavigationPath(world, person.position, end, roadSpeedMultiplier);
  if (path) {
    person.navigationBlocked = undefined;
    return path;
  }

  person.navigationBlocked = true;
  person.navigationFailedTargets ??= [];
  if (!person.navigationFailedTargets.includes(targetKey))
    person.navigationFailedTargets.push(targetKey);
  return null;
}

export function findRequiredNavigationPath(
  world: World,
  person: Person,
  end: Hex,
  roadSpeedMultiplier = 1.3,
): Hex[] | null {
  if (same(person.position, end)) {
    person.navigationBlocked = undefined;
    resetNavigationFailures(person);
    return [];
  }

  const revision = world.waypostRevision ?? 0;
  if (person.navigationFailureRevision !== revision) {
    person.navigationFailureRevision = revision;
    person.navigationFailedTargets = [];
  }

  const targetKey = navigationTargetKey(end);
  if (person.navigationFailedTargets?.includes(targetKey)) {
    person.navigationBlocked = true;
    return null;
  }

  const path = findNavigationPath(world, person.position, end, roadSpeedMultiplier);
  if (path) {
    person.navigationBlocked = undefined;
    resetNavigationFailures(person);
    return path;
  }

  person.navigationBlocked = true;
  person.navigationFailedTargets ??= [];
  if (!person.navigationFailedTargets.includes(targetKey))
    person.navigationFailedTargets.push(targetKey);
  return null;
}

export const clearNavigationBlocked = (person: Person): void => {
  person.navigationBlocked = undefined;
  resetNavigationFailures(person);
};

