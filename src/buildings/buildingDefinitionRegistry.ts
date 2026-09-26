import bakeryJson from "../assets/buildings/bakery/building.json";
import carpenterJson from "../assets/buildings/carpenter/building.json";
import farmJson from "../assets/buildings/farm/building.json";
import fieldJson from "../assets/buildings/field/building.json";
import headquarterJson from "../assets/buildings/hq/building.json";
import houseJson from "../assets/buildings/house/building.json";
import millJson from "../assets/buildings/mill/building.json";
import potteryJson from "../assets/buildings/pottery/building.json";
import pottery2Json from "../assets/buildings/pottery2/building.json";
import sawmillJson from "../assets/buildings/sawmill/building.json";
import schoolJson from "../assets/buildings/school/building.json";
import stonemasonJson from "../assets/buildings/stonemason/building.json";
import stonemason2Json from "../assets/buildings/stonemason2/building.json";
import tailorJson from "../assets/buildings/tailor/building.json";
import livestockBreederJson from "../assets/buildings/livestockBreeder/building.json";
import warehouseJson from "../assets/buildings/warehouse/building.json";
import wellJson from "../assets/buildings/well/building.json";
import type { Building, BuildingKind, Hex, ManagedBuildingKind } from "../simulation/model";
import type {
  BuildingVisualDefinition,
  BuildingVisualLevel,
} from "./buildingVisualDefinition";
import { validateBuildingVisualDefinition } from "./buildingVisualDefinition";

type BuildingVisualKind = ManagedBuildingKind | "field";

export type RegisteredBuildingLevel = {
  kind: BuildingVisualKind;
  definitionId: string;
  visual: BuildingVisualLevel;
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
  kind: BuildingVisualKind,
  definition: BuildingVisualDefinition,
): BuildingVisualDefinition => {
  const errors = validateBuildingVisualDefinition(definition);
  if (errors.length)
    throw new Error(`Ungültige Building-Definition für ${kind}: ${errors.join(" ")}`);
  return definition;
};

const spriteUrlFor = (
  kind: BuildingVisualKind,
  level: BuildingVisualLevel,
): string =>
  new URL(
    `../assets/buildings/${kind}/${level.sprite}`,
    import.meta.url,
  ).href;

const DEFINITIONS = new Map<BuildingVisualKind, BuildingVisualDefinition>();

const register = (kind: BuildingVisualKind, raw: unknown): void => {
  if (isPlaceholderDefinition(raw)) return;
  const definition = validateRegisteredDefinition(
    kind,
    raw as BuildingVisualDefinition,
  );
  DEFINITIONS.set(kind, definition);
};

register("hq", headquarterJson);
register("field", fieldJson);
register("farm", farmJson);
register("sawmill", sawmillJson);
register("school", schoolJson);
register("carpenter", carpenterJson);
register("mill", millJson);
register("bakery", bakeryJson);
register("well", wellJson);
register("pottery", potteryJson);
register("pottery2", pottery2Json);
register("stonemason", stonemasonJson);
register("stonemason2", stonemason2Json);
register("tailor", tailorJson);
register("livestockBreeder", livestockBreederJson);
register("warehouse", warehouseJson);
register("house", houseJson);

export const buildingVisualDefinition = (
  kind: BuildingKind,
): BuildingVisualDefinition | undefined =>
  kind === "palisade" ? undefined : DEFINITIONS.get(kind);

export const buildingDefinition = (
  kind: BuildingKind,
  level = 1,
): RegisteredBuildingLevel | undefined => {
  if (kind === "palisade") return;
  const definition = DEFINITIONS.get(kind);
  const visual = definition?.levels.find((candidate) => candidate.level === level);
  if (!definition || !visual) return;
  return {
    kind,
    definitionId: definition.id,
    visual,
    spriteUrl: spriteUrlFor(kind, visual),
  };
};

export const registeredBuildingDefinitions = (): RegisteredBuildingLevel[] =>
  [...DEFINITIONS.entries()].flatMap(([kind, definition]) =>
    definition.levels.map((visual) => ({
      kind,
      definitionId: definition.id,
      visual,
      spriteUrl: spriteUrlFor(kind, visual),
    })),
  );

export const hasBuildingDefinition = (kind: BuildingKind, level = 1): boolean =>
  buildingDefinition(kind, level) !== undefined;

export const visualLevelForBuilding = (building: Building): number =>
  building.kind === "house"
    ? (building.houseUpgradeTarget ?? building.houseLevel ?? 1)
    : 1;

/** Registered definitions are authoritative for their building kind and visual level. */
export const definitionForBuilding = (
  building: Building,
): RegisteredBuildingLevel | undefined => {
  const requestedLevel = visualLevelForBuilding(building);
  const exact = buildingDefinition(building.kind, requestedLevel);
  if (exact) return exact;
  const definition = buildingVisualDefinition(building.kind);
  const fallback = definition?.levels
    .filter((level) => level.level <= requestedLevel)
    .sort((a, b) => b.level - a.level)[0];
  return fallback ? buildingDefinition(building.kind, fallback.level) : undefined;
};

export const bindBuildingDefinition = (building: Building): void => {
  const definition = buildingVisualDefinition(building.kind);
  building.visualDefinitionId = definition?.id;
};

const add = (a: Hex, b: Hex): Hex => ({ q: a.q + b.q, r: a.r + b.r });
const subtract = (a: Hex, b: Hex): Hex => ({ q: a.q - b.q, r: a.r - b.r });

/**
 * Placement/editor coordinates use the definition's visual anchor. Runtime
 * Building.position remains the gameplay interaction coordinate; for
 * editor-authored buildings that is the authored entrance cell.
 */
export const buildingInteractionAt = (
  kind: BuildingKind,
  visualAnchor: Hex,
  level = 1,
): Hex => {
  const definition = buildingDefinition(kind, level);
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
  level = 1,
): Hex[] | undefined => {
  const definition = buildingDefinition(kind, level);
  return definition?.visual.footprint.map((cell) => add(visualAnchor, cell));
};

export const definitionBlockedAt = (
  kind: BuildingKind,
  visualAnchor: Hex,
  level = 1,
): Hex[] | undefined => {
  const definition = buildingDefinition(kind, level);
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
