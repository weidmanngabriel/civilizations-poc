import { describe, expect, it } from "vitest";
import { createDefaultGameWorld } from "../src/simulation/scenario";
import {
  WAYPOST_MAX_CONNECTION_DISTANCE_WORLD_TILES,
  WAYPOST_MIN_DISTANCE_WORLD_TILES,
  WAYPOST_ORIENTATION_RADIUS_WORLD_TILES,
  canPlaceWaypost,
  findPathViaWayposts,
  placeWaypost,
  wayposts,
} from "../src/simulation/wayposts";
import { hexDistance } from "../src/simulation/hex";
import { GRID_REFINEMENT } from "../src/simulation/spatial";

describe("wayposts", () => {
  it("starts with one waypost near the HQ and keeps independent balance constants", () => {
    const world = createDefaultGameWorld();
    expect(WAYPOST_ORIENTATION_RADIUS_WORLD_TILES).toBe(2.5);
    expect(WAYPOST_MIN_DISTANCE_WORLD_TILES).toBe(2.5);
    expect(WAYPOST_MAX_CONNECTION_DISTANCE_WORLD_TILES).toBe(5);
    expect(wayposts(world)).toHaveLength(1);
    const hq = world.buildings.find((building) => building.kind === "hq")!;
    expect(hexDistance(hq.position, wayposts(world)[0]!.position)).toBeLessThanOrEqual(
      2 * GRID_REFINEMENT + 2,
    );
  });

  it("rejects a second waypost inside the minimum distance", () => {
    const world = createDefaultGameWorld();
    const first = wayposts(world)[0]!;
    expect(canPlaceWaypost(world, {
      q: first.position.q + GRID_REFINEMENT,
      r: first.position.r,
    })).toBe(false);
  });

  it("connects reachable wayposts up to five world tiles apart and routes through them", () => {
    const world = createDefaultGameWorld();
    const first = wayposts(world)[0]!;
    const candidates = world.tiles
      .filter((tile) => tile.terrain === "grass")
      .filter((tile) => {
        const distance = hexDistance(first.position, tile);
        return distance >= 3 * GRID_REFINEMENT && distance <= 4 * GRID_REFINEMENT;
      });
    const secondTile = candidates.find((tile) => canPlaceWaypost(world, tile));
    expect(secondTile).toBeTruthy();
    const second = placeWaypost(world, secondTile!);
    expect(second).toBeTruthy();
    expect(first.connections).toContain(second!.id);
    expect(second!.connections).toContain(first.id);

    const path = findPathViaWayposts(world, first.position, second!.position);
    expect(path).not.toBeNull();
  });
});
