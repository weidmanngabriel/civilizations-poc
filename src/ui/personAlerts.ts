import type { NavigationBlockReason, Person, World } from "../simulation/model";
import { currentProfession } from "../simulation/experience";
import { hungerStatus } from "../simulation/needs";
import { sleepStatus } from "../simulation/sleep";
import { hexDistance } from "../simulation/spatial";

export type PersonAlertSeverity = "critical" | "warning" | "info";

export interface PersonAlert {
  severity: PersonAlertSeverity;
  code: "critical-hunger" | "critical-sleep" | "hunger" | "sleep" | "no-route" | "no-extractable-resource" | "idle";
  label: string;
}

const hasNoExtractableResource = (world: World, person: Person): boolean => {
  const kind = person.woodcutter ? "forest" : person.extractor;
  const area = person.workArea;
  if (!kind || !area || person.resourceTarget || person.outdoorCarry) return false;
  return !world.naturalResources.some(
    (resource) =>
      resource.kind === kind &&
      !resource.depleted &&
      resource.remaining > 0 &&
      hexDistance(area.center, resource.position) <= area.radius,
  );
};

const NAVIGATION_BLOCK_LABELS: Record<NavigationBlockReason, string> = {
  workplace: "Kein Weg zur Arbeitsstätte",
  resource: "Kein Weg zur Ressource",
  food: "Kein Weg zu Nahrung",
  sleep: "Kein Weg zum Schlafplatz",
  storage: "Kein Weg zum Lager",
  construction: "Kein Weg zur Baustelle",
  school: "Kein Weg zur Schule",
  equipment: "Kein Weg zur Ausrüstung",
  "work-area": "Kein Weg zum Arbeitsgebiet",
  manual: "Kein Weg zum Ziel",
  destination: "Kein Weg zum Ziel",
};

const isTrulyIdle = (world: World, person: Person): boolean =>
  person.ageStage !== "child" &&
  !currentProfession(world, person) &&
  !person.assignment &&
  !person.familyTask &&
  !person.educationTask &&
  !person.equipmentTask &&
  !person.scoutWaypostTask &&
  !person.hungerState &&
  !person.sleepState &&
  !person.trip &&
  !person.farmTask &&
  !person.outdoorCarry &&
  !person.resourceTarget &&
  person.progress <= 0;

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
  if (person.navigationBlocked) {
    return {
      severity: "warning",
      code: "no-route",
      label: NAVIGATION_BLOCK_LABELS[person.navigationBlockedReason ?? "destination"],
    };
  }
  if (hasNoExtractableResource(world, person)) {
    return { severity: "warning", code: "no-extractable-resource", label: "Nichts mehr abzubauen" };
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
