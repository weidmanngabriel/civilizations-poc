import { describe, expect, it } from "vitest";
import { CONFIG } from "../src/simulation/scenario";
import {
  PALISADE_MAX_SEGMENTS,
  createPalisadeSites,
  planPalisadePath,
} from "../src/simulation/palisades";
import { createTestWorld } from "./testWorld";

describe("palisades", () => {
  it("cuts a long A* preview off at 50 palisades instead of failing", () => {
    const world = createTestWorld({ width: 140, height: 12, population: 0 });
    const path = planPalisadePath(world, { q: -60, r: 2 }, { q: 60, r: 2 });

    expect(path).toHaveLength(PALISADE_MAX_SEGMENTS);
    expect(path[0]).toEqual({ q: -60, r: 2 });
  });

  it("creates one-wood, one-second independent construction sites", () => {
    const world = createTestWorld({ width: 20, height: 12, population: 0 });
    const sites = createPalisadeSites(world, [
      { q: 2, r: 2 },
      { q: 3, r: 2 },
      { q: 4, r: 2 },
    ]);

    expect(sites).toHaveLength(3);
    for (const site of sites) {
      expect(site.kind).toBe("palisade");
      expect(site.footprint).toEqual([site.position]);
      expect(site.construction?.required).toEqual({ wood: 1 });
      expect(site.construction?.duration).toBe(CONFIG.simulationHz);
      expect(site.construction?.complete).toBe(false);
    }
  });
});
