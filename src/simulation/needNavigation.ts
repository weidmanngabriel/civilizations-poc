import type { Hex, Person, World } from "./model";
import { findPath, hexDistance } from "./hex";
import {
  WAYPOST_ORIENTATION_RADIUS,
  wayposts,
} from "./wayposts";

export const NEED_LOCAL_NAVIGATION_RADIUS = WAYPOST_ORIENTATION_RADIUS;

export const usesUnrestrictedGlobalPathfinding = (person: Person): boolean => {
  const profession = person.profession as string | undefined;
  return profession === "scout" || profession === "soldier";
};

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
