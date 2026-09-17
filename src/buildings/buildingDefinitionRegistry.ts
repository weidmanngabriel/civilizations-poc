import bakeryJson from "../assets/buildings/bakery/building.json";
import carpenterJson from "../assets/buildings/carpenter/building.json";
import farmJson from "../assets/buildings/farm/building.json";
import fieldJson from "../assets/buildings/field/building.json";
import headquarterJson from "../assets/buildings/hq/building.json";
import houseJson from "../assets/buildings/house/building.json";
import millJson from "../assets/buildings/mill/building.json";
import potteryJson from "../assets/buildings/pottery/building.json";
import sawmillJson from "../assets/buildings/sawmill/building.json";
import stonemasonJson from "../assets/buildings/stonemason/building.json";
import warehouseJson from "../assets/buildings/warehouse/building.json";
import wellJson from "../assets/buildings/well/building.json";
import type { Building, BuildingKind, Hex } from "../simulation/model";
import type { BuildingVisualDefinition } from "./buildingVisualDefinition";
import { validateBuildingVisualDefinition } from "./buildingVisualDefinition";

export type RegisteredBuildingDefinition = {
  kind: BuildingKind;
  visual: BuildingVisualDefinition;
  spriteUrl: string;
};

type PlaceholderDefinition = {
  placeholder: true;
  id: string;
  sprite: string;
};

const isPlaceholderDefinition = (value: unknown): value is PlaceholderDefinition =>
  Boolean(
    value &&
    typeof value === "object" &&
    (value as { placeholder?: unknown }).placeholder === true,
  );

const validateRegisteredDefinition = (
  kind: BuildingKind,
  definition: BuildingVisualDefinition,
): BuildingVisualDefinition => {
  const errors = validateBuildingVisualDefinition(definition);
  if (errors.length)
    throw new Error(`Ungültige Building-Definition für ${kind}: ${errors.join(" ")}`);
  return definition;
};

const spriteUrlFor = (
  kind: BuildingKind,
  definition: BuildingVisualDefinition,
): string =>
  new URL(
    `../assets/buildings/${kind}/${definition.sprite}`,
    import.meta.url,
  ).href;

const DEFINITIONS = new Map<BuildingKind, RegisteredBuildingDefinition>();

const register = (kind: BuildingKind, raw: unknown): void => {
  if (isPlaceholderDefinition(raw)) return;
  const visual = validateRegisteredDefinition(
    kind,
    raw as BuildingVisualDefinition,
  );
  DEFINITIONS.set(kind, {
    kind,
    visual,
    spriteUrl: spriteUrlFor(kind, visual),
  });
};

register("hq", headquarterJson);
register("field", fieldJson);
register("farm", farmJson);
register("sawmill", sawmillJson);
register("carpenter", carpenterJson);
register("mill", millJson);
register("bakery", bakeryJson);
register("well", wellJson);
register("pottery", potteryJson);
register("stonemason", stonemasonJson);
register("warehouse", warehouseJson);
register("house", houseJson);

export const registeredBuildingDefinitions = (): RegisteredBuildingDefinition[] =>
  [...DEFINITIONS.values()];

export const buildingDefinition = (
  kind: BuildingKind,
): RegisteredBuildingDefinition | undefined => DEFINITIONS.get(kind);

export const hasBuildingDefinition = (kind: BuildingKind): boolean =>
  DEFINITIONS.has(kind);

/** Registered definitions are authoritative for their building kind. */
export const definitionForBuilding = (
  building: Building,
): RegisteredBuildingDefinition | undefined => buildingDefinition(building.kind);

export const bindBuildingDefinition = (building: Building): void => {
  const definition = buildingDefinition(building.kind);
  building.visualDefinitionId = definition?.visual.id;
};

const add = (a: Hex, b: Hex): Hex => ({ q: a.q + b.q, r: a.r + b.r });
const subtract = (a: Hex, b: Hex): Hex => ({ q: a.q - b.q, r: a.r - b.r });

/**
 * Placement/editor coordinates use the definition's visual anchor. Runtime
 * Building.position remains the gameplay interaction coordinate; for
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
