import type { Good, Hex, NaturalResource, NaturalResourceKind } from "./model";

export type NaturalResourceDefinition = {
  footprintOffsets: readonly Hex[];
  movementBlocking: boolean;
  good: Good;
};

const SINGLE_CELL = [{ q: 0, r: 0 }] as const;
const COMPACT_FOUR_CELLS = [
  { q: 0, r: 0 },
  { q: 1, r: 0 },
  { q: 0, r: 1 },
  { q: 1, r: 1 },
] as const;

export const NATURAL_RESOURCE_DEFINITIONS: Record<NaturalResourceKind, NaturalResourceDefinition> = {
  forest: {
    footprintOffsets: SINGLE_CELL,
    movementBlocking: true,
    good: "wood",
  },
  clay: {
    footprintOffsets: COMPACT_FOUR_CELLS,
    movementBlocking: false,
    good: "clay",
  },
  stone: {
    footprintOffsets: COMPACT_FOUR_CELLS,
    movementBlocking: true,
    good: "rubble",
  },
};

export const naturalResourceDefinition = (
  kind: NaturalResourceKind,
): NaturalResourceDefinition => NATURAL_RESOURCE_DEFINITIONS[kind];

export const naturalResourceGood = (resource: NaturalResource): Good =>
  naturalResourceDefinition(resource.kind).good;

export const naturalResourceBlocksMovement = (resource: NaturalResource): boolean =>
  naturalResourceDefinition(resource.kind).movementBlocking;

export const naturalResourceFootprint = (
  resource: Pick<NaturalResource, "kind" | "position">,
): Hex[] =>
  naturalResourceDefinition(resource.kind).footprintOffsets.map((offset) => ({
    q: resource.position.q + offset.q,
    r: resource.position.r + offset.r,
  }));
