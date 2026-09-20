import type { BuildingKind, GoodAmounts, PlaceableBuildingKind, Profession } from "./model";

export type UpgradeableBuildingKind = "pottery" | "stonemason";
export type TierTwoBuildingKind = "pottery2" | "stonemason2";

export type BuildingUpgradeRule = {
  from: UpgradeableBuildingKind;
  to: TierTwoBuildingKind;
  required: GoodAmounts;
  profession: Profession;
  threshold: number;
};

export const BUILDING_UPGRADE_RULES: Record<UpgradeableBuildingKind, BuildingUpgradeRule> = {
  pottery: {
    from: "pottery",
    to: "pottery2",
    required: { wood: 2, rubble: 2, brick: 2 },
    profession: "potter",
    threshold: 10,
  },
  stonemason: {
    from: "stonemason",
    to: "stonemason2",
    required: { wood: 2, rubble: 2, stoneBlock: 2 },
    profession: "stonemason",
    threshold: 10,
  },
};

export const buildingUpgradeRule = (kind: BuildingKind): BuildingUpgradeRule | undefined =>
  kind === "pottery" || kind === "stonemason" ? BUILDING_UPGRADE_RULES[kind] : undefined;

export const isTierTwoBuilding = (kind: PlaceableBuildingKind): kind is TierTwoBuildingKind =>
  kind === "pottery2" || kind === "stonemason2";
