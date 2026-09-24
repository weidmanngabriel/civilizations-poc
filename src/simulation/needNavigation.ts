import type { Hex, Person, World } from "./model";
import { findPath, hexDistance } from "./hex";
import {
  WAYPOST_ORIENTATION_RADIUS,
  usesUnrestrictedGlobalPathfinding,
  wayposts,
} from "./wayposts";

export const NEED_LOCAL_NAVIGATION_RADIUS = WAYPOST_ORIENTATION_RADIUS;

export const isInsideWaypostCoverage = (world: World, position: Hex): boolean =>
  world.wayposts !== undefined &&
  wayposts(world).some(
    (waypost) =>
      hexDistance(position, waypost.position) <= WAYPOST_ORIENTATION_RADIUS,
  );

export function findLocalNeedPath(
  world: World,
  person: Person,
  origin: Hex,
  target: Hex,
  roadSpeedMultiplier = 1.3,
): Hex[] | null {
  if (usesUnrestrictedGlobalPathfinding(person))
    return findPath(world.tiles, person.position, target, roadSpeedMultiplier);
  if (hexDistance(origin, target) > NEED_LOCAL_NAVIGATION_RADIUS) return null;
  return findPath(
    world.tiles,
    person.position,
    target,
    roadSpeedMultiplier,
    (tile) => hexDistance(origin, tile) <= NEED_LOCAL_NAVIGATION_RADIUS,
  );
}

export const localNeedPathLeavesWaypostCoverage = (
  world: World,
  origin: Hex,
  path: Hex[],
): boolean =>
  world.wayposts !== undefined &&
  isInsideWaypostCoverage(world, origin) &&
  path.some((position) => !isInsideWaypostCoverage(world, position));

export function findNeedReturnPath(
  world: World,
  person: Person,
  origin: Hex,
  roadSpeedMultiplier = 1.3,
): Hex[] | null {
  if (usesUnrestrictedGlobalPathfinding(person))
    return findPath(world.tiles, person.position, origin, roadSpeedMultiplier);
  return findPath(
    world.tiles,
    person.position,
    origin,
    roadSpeedMultiplier,
    (tile) => hexDistance(origin, tile) <= NEED_LOCAL_NAVIGATION_RADIUS,
  );
}

const localNeedAnchors = (world: World, person: Person): Hex[] => {
  const anchors: Hex[] = [];
  if (person.workArea?.center) anchors.push(person.workArea.center);
  if (person.assignment) {
    const workplace = world.buildings.find(
      (building) => building.id === person.assignment!.building && !building.retired,
    );
    if (workplace) anchors.push(workplace.position);
  }
  return anchors.filter(
    (anchor, index) =>
      anchors.findIndex((candidate) =>
        candidate.q === anchor.q && candidate.r === anchor.r,
      ) === index,
  );
};

export function findLocalNeedAnchorReturn(
  world: World,
  person: Person,
  roadSpeedMultiplier = 1.3,
): { anchor: Hex; path: Hex[] } | undefined {
  if (
    usesUnrestrictedGlobalPathfinding(person) ||
    isInsideWaypostCoverage(world, person.position)
  )
    return undefined;

  const origin = { ...person.position };
  const candidates = localNeedAnchors(world, person)
    .filter(
      (anchor) =>
        isInsideWaypostCoverage(world, anchor) &&
        hexDistance(origin, anchor) <= NEED_LOCAL_NAVIGATION_RADIUS,
    )
    .sort((a, b) => hexDistance(origin, a) - hexDistance(origin, b));

  for (const anchor of candidates) {
    const path = findLocalNeedPath(
      world,
      person,
      origin,
      anchor,
      roadSpeedMultiplier,
    );
    if (path) return { anchor: { ...anchor }, path };
  }
  return undefined;
}
