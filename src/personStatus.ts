import type { NavigationBlockReason, Person, World } from "./simulation/model";
import { currentProfession } from "./simulation/experience";
import { hungerStatus } from "./simulation/needs";
import { sleepStatus } from "./simulation/sleep";
import { hexDistance } from "./simulation/spatial";

export type PersonAlertSeverity = "critical" | "warning" | "info";

export type PersonAlertCode =
  | "critical-hunger"
  | "critical-sleep"
  | "hunger"
  | "sleep"
  | "no-route"
  | "no-extractable-resource"
  | "idle";

export interface PersonAlert {
  severity: PersonAlertSeverity;
  code: PersonAlertCode;
  label: string;
}

export const PERSON_ALERT_ICONS: Record<PersonAlertCode, string> = {
  "critical-hunger": "🍴",
  "critical-sleep": "💤",
  hunger: "🍴",
  sleep: "💤",
  "no-route": "!",
  "no-extractable-resource": "⛏",
  idle: "…",
};

const SEVERITY_RANK: Record<PersonAlertSeverity, number> = {
  critical: 3,
  warning: 2,
  info: 1,
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

const allPersonAlerts = (world: World, person: Person): PersonAlert[] => {
  const result: PersonAlert[] = [];
  const hunger = hungerStatus(person);
  const sleep = sleepStatus(person);

  if (hunger === "critical")
    result.push({ severity: "critical", code: "critical-hunger", label: "Sehr großer Hunger" });
  else if (hunger === "hungry")
    result.push({ severity: "warning", code: "hunger", label: "Hungrig" });

  if (sleep === "critical")
    result.push({ severity: "critical", code: "critical-sleep", label: "Totenmüde" });
  else if (sleep === "tired")
    result.push({ severity: "warning", code: "sleep", label: "Müde" });

  if (person.navigationBlocked) {
    result.push({
      severity: "warning",
      code: "no-route",
      label: NAVIGATION_BLOCK_LABELS[person.navigationBlockedReason ?? "destination"],
    });
  }

  if (hasNoExtractableResource(world, person))
    result.push({ severity: "warning", code: "no-extractable-resource", label: "Nichts mehr abzubauen" });

  if (isTrulyIdle(world, person))
    result.push({ severity: "info", code: "idle", label: "Keine Aufgabe" });

  return result;
};

export const personAlerts = (world: World, person: Person): PersonAlert[] => {
  const alerts = allPersonAlerts(world, person);
  if (alerts.length === 0) return [];
  const highest = Math.max(...alerts.map((alert) => SEVERITY_RANK[alert.severity]));
  return alerts.filter((alert) => SEVERITY_RANK[alert.severity] === highest);
};

export const personAlert = (world: World, person: Person): PersonAlert | undefined =>
  personAlerts(world, person)[0];

export const personAlertMap = (world: World): Map<number, PersonAlert> => {
  const result = new Map<number, PersonAlert>();
  for (const person of world.people) {
    const alert = personAlert(world, person);
    if (alert) result.set(person.id, alert);
  }
  return result;
};
