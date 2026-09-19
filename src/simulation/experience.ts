import type { Building, Person, Profession, World } from "./model";

export const professionExperience = (p: Person, profession: Profession): number =>
  p.experience?.[profession] ?? 0;

export const PROFESSION_XP_REQUIREMENTS: Partial<
  Record<Profession, { profession: Profession; experience: number }>
> = {
  sawmillWorker: { profession: "woodcutter", experience: 10 },
  carpenter: { profession: "sawmillWorker", experience: 10 },
  potter: { profession: "clayDigger", experience: 10 },
  stonemason: { profession: "stonecutter", experience: 10 },
  miller: { profession: "farmer", experience: 10 },
  baker: { profession: "miller", experience: 10 },
  tailor: { profession: "hunter", experience: 10 },
};

export function canLearnProfession(p: Person, profession: Profession): boolean {
  const requirement = PROFESSION_XP_REQUIREMENTS[profession];
  return !requirement ||
    professionExperience(p, requirement.profession) >= requirement.experience;
}

/**
 * Legacy compatibility hook for the old time-based simulation core.
 * XP is now awarded by the public simulation wrapper only when an action completes.
 */
export function gainProfessionExperience(
  _p: Person,
  _profession: Profession,
  _workTicks = 1,
): void {}

export function awardProfessionExperience(
  p: Person,
  profession: Profession,
  completedActions = 1,
): void {
  if (completedActions <= 0) return;
  const experience = (p.experience ??= {});
  experience[profession] = Math.min(
    100,
    (experience[profession] ?? 0) + completedActions,
  );
}

export const productionMultiplier = (p: Person, profession: Profession): number =>
  1 + professionExperience(p, profession) / 100;

export const woodcuttingSpeedMultiplier = (p: Person): number =>
  1 + 0.5 * professionExperience(p, "woodcutter") / 100;

export const extractionSpeedMultiplier = (
  p: Person,
  profession: "woodcutter" | "clayDigger" | "stonecutter",
): number => 1 + 0.5 * professionExperience(p, profession) / 100;

export const logisticsSpeedMultiplier = (p: Person, profession: "carrier" | "merchant"): number =>
  1 + 0.5 * professionExperience(p, profession) / 100;

export function workerProfession(building: Building): Profession | undefined {
  if (building.kind === "farm") return "farmer";
  if (building.kind === "sawmill") return "sawmillWorker";
  if (building.kind === "carpenter") return "carpenter";
  if (building.kind === "mill") return "miller";
  if (building.kind === "bakery") return "baker";
  if (building.kind === "pottery") return "potter";
  if (building.kind === "stonemason") return "stonemason";
  if (building.kind === "tailor") return "tailor";
  return undefined;
}

export function currentProfession(w: World, p: Person): Profession | undefined {
  if (p.profession) return p.profession;
  if (p.builder) return "builder";
  if (p.woodcutter) return "woodcutter";
  if (p.fisher) return "fisher";
  if (p.hunter) return "hunter";
  if (p.extractor === "clay") return "clayDigger";
  if (p.extractor === "stone") return "stonecutter";
  if (!p.assignment) return undefined;
  if (p.assignment.role === "carrier") return "carrier";
  if (p.assignment.role === "merchant") return "merchant";
  if (p.assignment.role !== "worker") return undefined;
  const workplace = w.buildings.find((b) => b.id === p.assignment!.building);
  return workplace ? workerProfession(workplace) : undefined;
}

export const PROFESSION_LABELS: Record<Profession, string> = {
  woodcutter: "Abbauer Holz",
  fisher: "Fischer",
  hunter: "Jäger",
  scout: "Kundschafter",
  builder: "Bauarbeiter",
  carrier: "Träger",
  merchant: "Händler",
  farmer: "Farmer",
  sawmillWorker: "Sägewerker",
  carpenter: "Schreiner",
  miller: "Müller",
  baker: "Bäcker",
  clayDigger: "Abbauer Lehm",
  stonecutter: "Abbauer Stein",
  potter: "Töpfer",
  stonemason: "Steinmetz",
  tailor: "Näher",
};
