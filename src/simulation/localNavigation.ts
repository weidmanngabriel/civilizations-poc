import type { Hex, Person, World } from "./model";
import { findPath } from "./hex";
import { clearNavigationBlocked, findRequiredNavigationPath } from "./wayposts";

export type LocalNavigationNode = {
  entry: Hex;
  contains: (position: Hex) => boolean;
};

export const isInsideLocalNavigationNode = (
  node: LocalNavigationNode,
  position: Hex,
): boolean => node.contains(position);

/**
 * Local work movement is allowed only after both the person and the target are
 * inside the same personal/workplace navigation node.
 */
export function findLocalNavigationPath(
  world: World,
  person: Person,
  node: LocalNavigationNode,
  target: Hex,
  roadSpeedMultiplier = 1.3,
): Hex[] | null {
  if (!node.contains(person.position) || !node.contains(target)) return null;
  clearNavigationBlocked(person);
  return findPath(world.tiles, person.position, target, roadSpeedMultiplier);
}

/**
 * Reaching a local work node from outside remains normal high-level travel and
 * therefore still requires the global waypost network.
 */
export function findPathIntoLocalNavigationNode(
  world: World,
  person: Person,
  node: LocalNavigationNode,
  roadSpeedMultiplier = 1.3,
): Hex[] | null {
  if (node.contains(person.position)) {
    clearNavigationBlocked(person);
    return [];
  }
  return findRequiredNavigationPath(world, person, node.entry, roadSpeedMultiplier, "work-area");
}
