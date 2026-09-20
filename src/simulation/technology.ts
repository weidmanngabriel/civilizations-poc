import type { PlaceableBuildingKind, Profession, World } from "./model";
import { professionExperience } from "./experience";
import {
  BUILDING_CONSTRUCTION_REQUIREMENTS,
  requiredProductionBuildings,
} from "./constructionRules";

export const TECHNOLOGY_XP_THRESHOLD = 10;

export type TechnologyId = PlaceableBuildingKind;

export type TechnologyUnlockRule = {
  technology: TechnologyId;
  profession: Profession;
  threshold: number;
};

export const STARTING_TECHNOLOGIES: TechnologyId[] = ["house", "farm"];

export const TECHNOLOGY_UNLOCK_RULES: TechnologyUnlockRule[] = [
  { technology: "warehouse", profession: "carrier", threshold: TECHNOLOGY_XP_THRESHOLD },
  { technology: "sawmill", profession: "woodcutter", threshold: TECHNOLOGY_XP_THRESHOLD },
  { technology: "carpenter", profession: "sawmillWorker", threshold: TECHNOLOGY_XP_THRESHOLD },
  { technology: "mill", profession: "farmer", threshold: TECHNOLOGY_XP_THRESHOLD },
  { technology: "bakery", profession: "miller", threshold: TECHNOLOGY_XP_THRESHOLD },
  { technology: "pottery", profession: "clayDigger", threshold: TECHNOLOGY_XP_THRESHOLD },
  { technology: "stonemason", profession: "stonecutter", threshold: TECHNOLOGY_XP_THRESHOLD },
  { technology: "tailor", profession: "hunter", threshold: TECHNOLOGY_XP_THRESHOLD },
  { technology: "livestockBreeder", profession: "hunter", threshold: TECHNOLOGY_XP_THRESHOLD },
];

export const IMPLEMENTED_TECHNOLOGIES: TechnologyId[] = Object.keys(
  BUILDING_CONSTRUCTION_REQUIREMENTS,
) as TechnologyId[];

export function maxProfessionExperience(world: World, profession: Profession): number {
  return world.people.reduce(
    (maximum, person) => Math.max(maximum, professionExperience(person, profession)),
    0,
  );
}

export function technologyUnlockRule(
  technology: TechnologyId,
): TechnologyUnlockRule | undefined {
  return TECHNOLOGY_UNLOCK_RULES.find((rule) => rule.technology === technology);
}

function hasCompletedBuilding(world: World, kind: PlaceableBuildingKind): boolean {
  return world.buildings.some(
    (building) =>
      building.kind === kind &&
      !building.retired &&
      (building.construction === undefined || building.construction.complete),
  );
}

export function missingProductionBuildings(
  world: World,
  technology: TechnologyId,
): PlaceableBuildingKind[] {
  return requiredProductionBuildings(technology).filter(
    (requiredKind) => !hasCompletedBuilding(world, requiredKind),
  );
}

function unlockRequirementsMet(world: World, technology: TechnologyId): boolean {
  const professionRule = technologyUnlockRule(technology);
  if (
    professionRule &&
    maxProfessionExperience(world, professionRule.profession) < professionRule.threshold
  ) return false;

  return missingProductionBuildings(world, technology).length === 0;
}

/**
 * Worlds without explicit technology state are neutral/sandbox worlds and remain permissive.
 * The player-facing scenario supplies an explicit unlock list and therefore uses progression.
 */
export function isTechnologyUnlocked(world: World, technology: TechnologyId): boolean {
  if (!world.unlockedTechnologies) return true;
  return world.unlockedTechnologies.includes(technology);
}

export function isBuildingUnlocked(world: World, kind: PlaceableBuildingKind): boolean {
  return isTechnologyUnlocked(world, kind);
}

export function technologyProgress(
  world: World,
  technology: TechnologyId,
): {
  unlocked: boolean;
  profession?: Profession;
  current: number;
  required: number;
  requiredBuildings: PlaceableBuildingKind[];
  missingBuildings: PlaceableBuildingKind[];
} {
  const unlocked = isTechnologyUnlocked(world, technology);
  const rule = technologyUnlockRule(technology);
  const requiredBuildings = requiredProductionBuildings(technology);
  const missingBuildings = unlocked ? [] : missingProductionBuildings(world, technology);

  if (!rule)
    return {
      unlocked,
      current: unlocked ? 1 : 0,
      required: 1,
      requiredBuildings,
      missingBuildings,
    };

  return {
    unlocked,
    profession: rule.profession,
    current: Math.min(rule.threshold, maxProfessionExperience(world, rule.profession)),
    required: rule.threshold,
    requiredBuildings,
    missingBuildings,
  };
}

export function updateTechnologyUnlocks(world: World): TechnologyId[] {
  if (!world.unlockedTechnologies) return [];
  const newlyUnlocked: TechnologyId[] = [];

  for (const technology of IMPLEMENTED_TECHNOLOGIES) {
    if (world.unlockedTechnologies.includes(technology)) continue;
    if (!unlockRequirementsMet(world, technology)) continue;
    world.unlockedTechnologies.push(technology);
    newlyUnlocked.push(technology);
  }

  return newlyUnlocked;
}
