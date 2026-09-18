import type { Person, World } from "../simulation/model";
import { currentProfession } from "../simulation/experience";

export type PersonAlertSeverity = "critical" | "warning" | "info";

export interface PersonAlert {
  severity: PersonAlertSeverity;
  code: "critical-hunger" | "critical-sleep" | "hunger" | "sleep" | "idle";
  label: string;
}

const needValue = (value: number | undefined): number => value ?? 100;

const isTrulyIdle = (world: World, person: Person): boolean =>
  !currentProfession(world, person) &&
  !person.assignment &&
  !person.builder &&
  !person.woodcutter &&
  !person.extractor &&
  !person.hungerState &&
  !person.sleepState &&
  !person.trip &&
  !person.farmTask &&
  !person.active &&
  person.path.length === 0;

export const personAlert = (world: World, person: Person): PersonAlert | undefined => {
  const hunger = needValue(person.hunger);
  const sleep = needValue(person.sleep);

  if (hunger <= 20) {
    return { severity: "critical", code: "critical-hunger", label: "Sehr großer Hunger" };
  }
  if (sleep <= 20) {
    return { severity: "critical", code: "critical-sleep", label: "Totenmüde" };
  }
  if (hunger <= 40) {
    return { severity: "warning", code: "hunger", label: "Hungrig" };
  }
  if (sleep <= 40) {
    return { severity: "warning", code: "sleep", label: "Müde" };
  }
  if (isTrulyIdle(world, person)) {
    return { severity: "info", code: "idle", label: "Keine Aufgabe" };
  }
  return undefined;
};

export const personAlertMap = (world: World): Map<number, PersonAlert> => {
  const result = new Map<number, PersonAlert>();
  for (const person of world.people) {
    const alert = personAlert(world, person);
    if (alert) result.set(person.id, alert);
  }
  return result;
};
