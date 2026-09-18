import type { Person, World } from "./simulation/model";
import { currentProfession, PROFESSION_LABELS } from "./simulation/experience";
import { GOODS } from "./simulation/simulation";

export const personProfessionLabel = (world: World, person: Person): string => {
  const profession = currentProfession(world, person);
  return profession ? PROFESSION_LABELS[profession] : "Frei";
};

export const personActivityLabel = (person: Person): string => {
  if (person.hungerState) return person.path.length ? "Geht essen" : "Isst";
  if (person.sleepState) return person.path.length ? "Sucht Schlafplatz" : "Schläft";
  if (person.trip?.picked) return `Transportiert ${GOODS[person.trip.good]}`;
  if (person.trip) return `Holt ${GOODS[person.trip.good]}`;
  if (person.farmTask) {
    if (person.farmTask.kind === "harvest") return "Erntet";
    if (person.farmTask.kind === "fertilize") return "Düngt";
    return "Sät";
  }
  if (person.idleTarget) return person.path.length ? "Unterwegs" : "Wartet";
  if (person.active) return "Arbeitet";
  if (person.path.length) return "Unterwegs";
  return "Wartet";
};
