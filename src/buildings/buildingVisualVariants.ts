import type { BuildingKind } from "../simulation/model";

export type BuildingVisualKind = Exclude<BuildingKind, "palisade">;

export type BuildingVisualVariant = {
  kind: BuildingVisualKind;
  level: number;
  label: string;
};

const BUILDING_VISUAL_VARIANTS_UNSORTED: BuildingVisualVariant[] = [
  { kind: "bakery", level: 1, label: "Bäckerei" },
  { kind: "well", level: 1, label: "Brunnen" },
  { kind: "field", level: 1, label: "Feld" },
  { kind: "farm", level: 1, label: "Farm" },
  { kind: "hq", level: 1, label: "Hauptquartier" },
  { kind: "warehouse", level: 1, label: "Lager" },
  { kind: "livestockBreeder", level: 1, label: "Viehzüchterei" },
  { kind: "mill", level: 1, label: "Mühle" },
  { kind: "tailor", level: 1, label: "Näherei" },
  { kind: "carpenter", level: 1, label: "Schreinerei" },
  { kind: "school", level: 1, label: "Schule" },
  { kind: "sawmill", level: 1, label: "Sägewerk" },
  { kind: "stonemason", level: 1, label: "Steinmetzhütte 1" },
  { kind: "stonemason2", level: 1, label: "Steinmetzhütte 2" },
  { kind: "pottery", level: 1, label: "Töpferei 1" },
  { kind: "pottery2", level: 1, label: "Töpferei 2" },
  { kind: "house", level: 1, label: "Wohnhaus 1" },
  { kind: "house", level: 2, label: "Wohnhaus 2" },
  { kind: "house", level: 3, label: "Wohnhaus 3" },
  { kind: "house", level: 4, label: "Wohnhaus 4" },
  { kind: "house", level: 5, label: "Wohnhaus 5" },
];

export const BUILDING_VISUAL_VARIANTS: readonly BuildingVisualVariant[] =
  BUILDING_VISUAL_VARIANTS_UNSORTED.sort((a, b) => a.label.localeCompare(b.label, "de"));

export const buildingVisualVariantKey = (
  variant: Pick<BuildingVisualVariant, "kind" | "level">,
): string => `${variant.kind}:${variant.level}`;

export const buildingVisualVariant = (
  kind: BuildingVisualKind,
  level: number,
): BuildingVisualVariant | undefined =>
  BUILDING_VISUAL_VARIANTS.find(
    (variant) => variant.kind === kind && variant.level === level,
  );

export const buildingVisualLevels = (kind: BuildingVisualKind): readonly number[] =>
  BUILDING_VISUAL_VARIANTS
    .filter((variant) => variant.kind === kind)
    .map((variant) => variant.level);
