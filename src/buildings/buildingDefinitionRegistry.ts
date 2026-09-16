import headquarterJson from "../assets/buildings/headquarter/building.json";
import type { Building, BuildingKind, Hex } from "../simulation/model";
import type { BuildingVisualDefinition } from "./buildingVisualDefinition";
import { validateBuildingVisualDefinition } from "./buildingVisualDefinition";

export type RegisteredBuildingDefinition = {
  kind: BuildingKind;
  visual: BuildingVisualDefinition;
  spriteUrl: string;
};

const validateRegisteredDefinition = (
  kind: BuildingKind,
  definition: BuildingVisualDefinition,
): BuildingVisualDefinition => {
  const errors = validateBuildingVisualDefinition(definition);
  if (errors.length)
    throw new Error(`Ungültige Building-Definition für ${kind}: ${errors.join(" ")}`);
  return definition;
};

const HEADQUARTER = validateRegisteredDefinition(
  "hq",
  headquarterJson as BuildingVisualDefinition,
);

const DEFINITIONS = new Map<BuildingKind, RegisteredBuildingDefinition>([
  [
    "hq",
    {
      kind: "hq",
      visual: HEADQUARTER,
      spriteUrl: new URL(
        "../assets/buildings/headquarter/sprite.webp",
        import.meta.url,
      ).href,
    },
  ],
]);

export const registeredBuildingDefinitions = (): RegisteredBuildingDefinition[] =>
  [...DEFINITIONS.values()];

export const buildingDefinition = (
  kind: BuildingKind,
): RegisteredBuildingDefinition | undefined => DEFINITIONS.get(kind);

export const hasBuildingDefinition = (kind: BuildingKind): boolean =>
  DEFINITIONS.has(kind);

const add = (a: Hex, b: Hex): Hex => ({ q: a.q + b.q, r: a.r + b.r });
const subtract = (a: Hex, b: Hex): Hex => ({ q: a.q - b.q, r: a.r - b.r });

/**
 * Placement/editor coordinates use the definition's visual anchor. Runtime
 * Building.position remains the interaction coordinate; for editor-authored
 * buildings that is the authored entrance cell.
 */
export const buildingInteractionAt = (kind: BuildingKind, visualAnchor: Hex): Hex => {
  const definition = buildingDefinition(kind);
  return definition ? add(visualAnchor, definition.visual.entrance) : { ...visualAnchor };
};

export const buildingVisualAnchor = (building: Building): Hex => {
  const definition = buildingDefinition(building.kind);
  return definition
    ? subtract(building.position, definition.visual.entrance)
    : { ...building.position };
};

export const definitionFootprintAt = (
  kind: BuildingKind,
  visualAnchor: Hex,
): Hex[] | undefined => {
  const definition = buildingDefinition(kind);
  return definition?.visual.footprint.map((cell) => add(visualAnchor, cell));
};

export const definitionBlockedAt = (
  kind: BuildingKind,
  visualAnchor: Hex,
): Hex[] | undefined => {
  const definition = buildingDefinition(kind);
  return definition?.visual.blocked.map((cell) => add(visualAnchor, cell));
};

export const definitionFootprintForBuilding = (building: Building): Hex[] | undefined =>
  definitionFootprintAt(building.kind, buildingVisualAnchor(building));

export const definitionBlockedForBuilding = (building: Building): Hex[] | undefined =>
  definitionBlockedAt(building.kind, buildingVisualAnchor(building));
