import type { Hex, Person, Tile, Waypost, World } from "./model";
import { findPath, hexDistance, key, neighbors, pathTravelCost, same, tileIndex, walkable } from "./hex";
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
export const WAYPOST_BUILD_CLEARANCE = 1;

export const wayposts = (world: World): Waypost[] => world.wayposts ?? [];

type WaypostPlacementContext = {
  tiles: Map<string, Tile>;
  activeResourceCells: Set<string>;
  looseGoodCells: Set<string>;
  buildingClearanceCells: Set<string>;
};

const waypostPlacementContext = (world: World): WaypostPlacementContext => ({
  tiles: tileIndex(world.tiles),
  activeResourceCells: new Set(
    world.naturalResources
      .filter((resource) => !resource.depleted)
      .flatMap((resource) => naturalResourceFootprint(resource).map(key)),
  ),
  looseGoodCells: new Set((world.looseGoods ?? []).map((stack) => key(stack.position))),
  buildingClearanceCells: new Set(
    world.buildings
      .filter((building) => !building.retired)
      .flatMap((building) => building.footprint ?? [building.position])
      .flatMap((position) => [position, ...neighbors(position)])
      .map(key),
  ),
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
  if (context.buildingClearanceCells.has(key(position))) return false;
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

export function removeWaypost(world: World, id: string): boolean {
  const posts = world.wayposts;
  if (!posts) return false;
  const index = posts.findIndex((post) => post.id === id);
  if (index < 0) return false;
  posts.splice(index, 1);
  for (const post of posts)
    post.connections = (post.connections ?? []).filter((connectionId) => connectionId !== id);
  world.waypostRevision = (world.waypostRevision ?? 0) + 1;
  return true;
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

type WaypostChainEntry = {
  id: string;
  cost: number;
  previousId?: string;
};

const orientedWayposts = (posts: Waypost[], position: Hex): Waypost[] =>
  posts.filter(
    (post) => hexDistance(position, post.position) <= WAYPOST_ORIENTATION_RADIUS,
  );

const findWaypostChain = (
  posts: Waypost[],
  start: Hex,
  end: Hex,
): Waypost[] | null => {
  const startPosts = orientedWayposts(posts, start);
  const goalIds = new Set(orientedWayposts(posts, end).map((post) => post.id));
  if (!startPosts.length || !goalIds.size) return null;

  const byId = new Map(posts.map((post) => [post.id, post]));
  const best = new Map<string, WaypostChainEntry>();
  const queue: WaypostChainEntry[] = startPosts.map((post) => ({
    id: post.id,
    cost: hexDistance(start, post.position),
  }));
  let goal: WaypostChainEntry | undefined;

  while (queue.length) {
    queue.sort((a, b) => a.cost - b.cost || a.id.localeCompare(b.id));
    const current = queue.shift()!;
    if ((best.get(current.id)?.cost ?? Number.POSITIVE_INFINITY) <= current.cost) continue;
    best.set(current.id, current);

    const currentPost = byId.get(current.id);
    if (!currentPost) continue;

    if (goalIds.has(current.id)) {
      const withExit = {
        ...current,
        cost: current.cost + hexDistance(currentPost.position, end),
      };
      if (!goal || withExit.cost < goal.cost) goal = withExit;
    }

    if (goal && current.cost >= goal.cost) continue;

    for (const nextId of currentPost.connections ?? []) {
      const next = byId.get(nextId);
      if (!next) continue;
      const nextCost = current.cost + hexDistance(currentPost.position, next.position);
      if ((best.get(nextId)?.cost ?? Number.POSITIVE_INFINITY) <= nextCost) continue;
      queue.push({ id: nextId, cost: nextCost, previousId: current.id });
    }
  }

  if (!goal) return null;

  const chain: Waypost[] = [];
  let currentId: string | undefined = goal.id;
  while (currentId) {
    const post = byId.get(currentId);
    const entry = best.get(currentId);
    if (!post || !entry) return null;
    chain.unshift(post);
    currentId = entry.previousId;
  }
  return chain;
};

export function findPathViaWayposts(
  world: World,
  start: Hex,
  end: Hex,
  roadSpeedMultiplier = 1.3,
): Hex[] | null {
  if (same(start, end)) return [];

  const chain = findWaypostChain(wayposts(world), start, end);
  if (!chain) return null;

  // Same-area and directly neighboring waypost areas are deliberately treated as
  // local travel. The wayposts authorize the trip but are not physical checkpoints.
  if (chain.length <= 2)
    return findPath(world.tiles, start, end, roadSpeedMultiplier);

  // Longer journeys use the high-level graph to choose a narrow search corridor.
  // A* may cross anywhere inside the selected waypost areas; no signpost cell is a
  // mandatory waypoint.
  return findPath(
    world.tiles,
    start,
    end,
    roadSpeedMultiplier,
    (tile) =>
      chain.some(
        (post) =>
          hexDistance(tile, post.position) <= WAYPOST_ORIENTATION_RADIUS,
      ),
  );
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

