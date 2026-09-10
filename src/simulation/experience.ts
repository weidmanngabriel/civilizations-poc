import type { Building, Person, Profession, World } from "./model";
import { CONFIG } from "./scenario";

const EXPERIENCE_BANDS = [
  { from: 0, to: 50, durationTicks: 10 * 60 * CONFIG.simulationHz },
  { from: 50, to: 80, durationTicks: 20 * 60 * CONFIG.simulationHz },
  { from: 80, to: 95, durationTicks: 30 * 60 * CONFIG.simulationHz },
  { from: 95, to: 100, durationTicks: 30 * 60 * CONFIG.simulationHz },
] as const;

export const professionExperience = (p: Person, profession: Profession): number =>
  p.experience?.[profession] ?? 0;

export function gainProfessionExperience(
  p: Person,
  profession: Profession,
  workTicks = 1,
): void {
  if (workTicks <= 0) return;
  p.experience ??= {};
  let xp = professionExperience(p, profession);
  let remainingTicks = workTicks;

  for (const band of EXPERIENCE_BANDS) {
    if (xp >= band.to || remainingTicks <= 0) continue;
    const gainPerTick = (band.to - band.from) / band.durationTicks;
    const ticksToBandEnd = (band.to - xp) / gainPerTick;
    const spentTicks = Math.min(remainingTicks, ticksToBandEnd);
    xp += spentTicks * gainPerTick;
    remainingTicks -= spentTicks;
  }

  p.experience[profession] = Math.min(100, xp);
}

export const productionMultiplier = (p: Person, profession: Profession): number =>
  1 + professionExperience(p, profession) / 100;

export const logisticsSpeedMultiplier = (p: Person, profession: "carrier" | "merchant"): number =>
  1 + 0.5 * professionExperience(p, profession) / 100;

export function workerProfession(building: Building): Profession | undefined {
  if (building.kind === "forest") return "woodcutter";
  if (building.kind === "farm") return "farmer";
  if (building.kind === "sawmill") return "sawmillWorker";
  if (building.kind === "carpenter") return "carpenter";
  if (building.kind === "mill") return "miller";
  if (building.kind === "bakery") return "baker";
  return undefined;
}

export function currentProfession(w: World, p: Person): Profession | undefined {
  if (p.builder) return "builder";
  if (p.woodcutter) return "woodcutter";
  if (!p.assignment) return undefined;
  if (p.assignment.role === "carrier") return "carrier";
  if (p.assignment.role === "merchant") return "merchant";
  if (p.assignment.role !== "worker") return undefined;
  const workplace = w.buildings.find((b) => b.id === p.assignment!.building);
  return workplace ? workerProfession(workplace) : undefined;
}

export const PROFESSION_LABELS: Record<Profession, string> = {
  woodcutter: "Holzfäller",
  builder: "Bauarbeiter",
  carrier: "Träger",
  merchant: "Händler",
  farmer: "Farmer",
  sawmillWorker: "Sägewerker",
  carpenter: "Schreiner",
  miller: "Müller",
  baker: "Bäcker",
};
