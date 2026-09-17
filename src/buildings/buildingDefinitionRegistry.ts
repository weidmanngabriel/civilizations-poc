import bakeryJson from "../assets/buildings/bakery/building.json";
import farmJson from "../assets/buildings/farm/building.json";
import headquarterJson from "../assets/buildings/headquarter/building.json";
import wellJson from "../assets/buildings/well/building.json";
import windmillJson from "../assets/buildings/windmill/building.json";
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

const spriteUrlFor = (definition: BuildingVisualDefinition): string =>
  new URL(
    `../assets/buildings/${definition.id}/${definition.sprite}`,
    import.meta.url,
  ).href;

const HEADQUARTER = validateRegisteredDefinition(
  "hq",
  headquarterJson as BuildingVisualDefinition,
);
const BAKERY = validateRegisteredDefinition(
  "bakery",
  bakeryJson as BuildingVisualDefinition,
);
const FARM = validateRegisteredDefinition(
  "farm",
  farmJson as BuildingVisualDefinition,
);
const WELL = validateRegisteredDefinition(
  "well",
  wellJson as BuildingVisualDefinition,
);
const WINDMILL = validateRegisteredDefinition(
  "mill",
  windmillJson as BuildingVisualDefinition,
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
  [
    "bakery",
    {
      kind: "bakery",
      visual: BAKERY,
      spriteUrl: spriteUrlFor(BAKERY),
    },
  ],
  [
    "farm",
    {
      kind: "farm",
      visual: FARM,
      spriteUrl: spriteUrlFor(FARM),
    },
  ],
  [
    "well",
    {
      kind: "well",
      visual: WELL,
      spriteUrl: spriteUrlFor(WELL),
    },
  ],
  [
    "mill",
    {
      kind: "mill",
      visual: WINDMILL,
      spriteUrl: spriteUrlFor(WINDMILL),
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
