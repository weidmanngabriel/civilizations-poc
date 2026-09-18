import type { Person, World } from "../simulation/model";
import { currentProfession } from "../simulation/experience";
import { hungerStatus } from "../simulation/needs";
import { sleepStatus } from "../simulation/sleep";

export type PersonAlertSeverity = "critical" | "warning" | "info";

export interface PersonAlert {
  severity: PersonAlertSeverity;
  code: "critical-hunger" | "critical-sleep" | "hunger" | "sleep" | "idle";
  label: string;
}

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
  const hunger = hungerStatus(person);
  const sleep = sleepStatus(person);

  if (hunger === "critical") {
    return { severity: "critical", code: "critical-hunger", label: "Sehr großer Hunger" };
  }
  if (sleep === "critical") {
    return { severity: "critical", code: "critical-sleep", label: "Totenmüde" };
  }
  if (hunger === "hungry") {
    return { severity: "warning", code: "hunger", label: "Hungrig" };
  }
  if (sleep === "tired") {
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
