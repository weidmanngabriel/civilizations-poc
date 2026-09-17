import headquarterJson from "../assets/buildings/headquarter/building.json";
import type { Building, BuildingKind, Hex } from "../simulation/model";
import type { BuildingVisualDefinition } from "./buildingVisualDefinition";
import { validateBuildingVisualDefinition } from "./buildingVisualDefinition";

export type RegisteredBuildingDefinition = {
  kind: BuildingKind;
  visual: BuildingVisualDefinition;
  spriteUrl: string;
};

const SPRITE_URLS = import.meta.glob("../assets/buildings/**/*.{png,webp}", {
  eager: true,
  query: "?url",
  import: "default",
}) as Record<string, string>;

const validateRegisteredDefinition = (
  kind: BuildingKind,
  definition: BuildingVisualDefinition,
): BuildingVisualDefinition => {
  const errors = validateBuildingVisualDefinition(definition);
  if (errors.length)
    throw new Error(`Ungültige Building-Definition für ${kind}: ${errors.join(" ")}`);
  return definition;
};

const spriteUrlFor = (definition: BuildingVisualDefinition): string => {
  const assetPath = `../assets/buildings/${definition.id}/${definition.sprite}`;
  const spriteUrl = SPRITE_URLS[assetPath];
  if (!spriteUrl)
    throw new Error(
      `Sprite für Building-Definition ${definition.id} nicht gefunden: ${definition.sprite}`,
    );
  return spriteUrl;
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
      spriteUrl: spriteUrlFor(HEADQUARTER),
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

export const definitionForBuilding = (
  building: Building,
): RegisteredBuildingDefinition | undefined => {
  const definition = buildingDefinition(building.kind);
  return definition && building.visualDefinitionId === definition.visual.id
    ? definition
    : undefined;
};

export const bindBuildingDefinition = (building: Building): void => {
  const definition = buildingDefinition(building.kind);
  building.visualDefinitionId = definition?.visual.id;
};

const add = (a: Hex, b: Hex): Hex => ({ q: a.q + b.q, r: a.r + b.r });
const subtract = (a: Hex, b: Hex): Hex => ({ q: a.q - b.q, r: a.r - b.r });

/**
 * Placement/editor coordinates use the definition's visual anchor. Runtime
 * Building.position remains the gameplay interaction coordinate; for bound
 * editor-authored buildings that is the authored entrance cell.
 */
export const buildingInteractionAt = (kind: BuildingKind, visualAnchor: Hex): Hex => {
  const definition = buildingDefinition(kind);
  return definition ? add(visualAnchor, definition.visual.entrance) : { ...visualAnchor };
};

export const buildingVisualAnchor = (building: Building): Hex => {
  const definition = definitionForBuilding(building);
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

export const definitionFootprintForBuilding = (building: Building): Hex[] | undefined => {
  const definition = definitionForBuilding(building);
  const visualAnchor = buildingVisualAnchor(building);
  return definition?.visual.footprint.map((cell) => add(visualAnchor, cell));
};

export const definitionBlockedForBuilding = (building: Building): Hex[] | undefined => {
  const definition = definitionForBuilding(building);
  const visualAnchor = buildingVisualAnchor(building);
  return definition?.visual.blocked.map((cell) => add(visualAnchor, cell));
};
