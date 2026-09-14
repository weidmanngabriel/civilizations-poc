import type { PlaceableBuildingKind, Profession, World } from "./model";
import { professionExperience } from "./experience";

export const TECHNOLOGY_XP_THRESHOLD = 10;

export type TechnologyId = PlaceableBuildingKind;

export type TechnologyUnlockRule = {
  technology: TechnologyId;
  profession: Profession;
  threshold: number;
};

export const STARTING_TECHNOLOGIES: TechnologyId[] = ["house", "farm", "well"];

export const TECHNOLOGY_UNLOCK_RULES: TechnologyUnlockRule[] = [
  { technology: "warehouse", profession: "carrier", threshold: TECHNOLOGY_XP_THRESHOLD },
  { technology: "sawmill", profession: "woodcutter", threshold: TECHNOLOGY_XP_THRESHOLD },
  { technology: "carpenter", profession: "sawmillWorker", threshold: TECHNOLOGY_XP_THRESHOLD },
  { technology: "mill", profession: "farmer", threshold: TECHNOLOGY_XP_THRESHOLD },
  { technology: "bakery", profession: "miller", threshold: TECHNOLOGY_XP_THRESHOLD },
  { technology: "pottery", profession: "clayDigger", threshold: TECHNOLOGY_XP_THRESHOLD },
  { technology: "stonemason", profession: "stonecutter", threshold: TECHNOLOGY_XP_THRESHOLD },
];

export const IMPLEMENTED_TECHNOLOGIES: TechnologyId[] = [
  ...STARTING_TECHNOLOGIES,
  ...TECHNOLOGY_UNLOCK_RULES.map((rule) => rule.technology),
];

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
): { unlocked: boolean; profession?: Profession; current: number; required: number } {
  const unlocked = isTechnologyUnlocked(world, technology);
  const rule = technologyUnlockRule(technology);
  if (!rule) return { unlocked, current: unlocked ? 1 : 0, required: 1 };
  return {
    unlocked,
    profession: rule.profession,
    current: Math.min(rule.threshold, maxProfessionExperience(world, rule.profession)),
    required: rule.threshold,
  };
}

export function updateTechnologyUnlocks(world: World): TechnologyId[] {
  if (!world.unlockedTechnologies) return [];
  const newlyUnlocked: TechnologyId[] = [];
  for (const rule of TECHNOLOGY_UNLOCK_RULES) {
    if (world.unlockedTechnologies.includes(rule.technology)) continue;
    if (maxProfessionExperience(world, rule.profession) < rule.threshold) continue;
    world.unlockedTechnologies.push(rule.technology);
    newlyUnlocked.push(rule.technology);
  }
  return newlyUnlocked;
}
