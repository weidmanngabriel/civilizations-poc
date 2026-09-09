import type { Hex, Person, World } from "./model";
import { movementCost, same } from "./hex";
import { CONFIG } from "./scenario";

/**
 * Continuous simulation position between the last reached tile centre and the
 * next pathfinding waypoint. Pathfinding stays tile-based; Person.movement is
 * the deterministic partial distance already travelled along the current edge.
 */
export function personWorldPosition(w: World, p: Person): Hex {
  const next = p.path[0];
  if (!next || p.movement <= 0) return { ...p.position };

  const tile = w.tiles.find((candidate) => same(candidate, next));
  if (!tile) return { ...p.position };

  const edgeCost = movementCost(tile, CONFIG.roadSpeedMultiplier);
  const progress = Math.max(0, Math.min(1, p.movement / edgeCost));

  return {
    q: p.position.q + (next.q - p.position.q) * progress,
    r: p.position.r + (next.r - p.position.r) * progress,
  };
}
