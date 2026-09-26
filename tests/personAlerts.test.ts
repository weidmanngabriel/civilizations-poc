import { test } from "node:test";
import assert from "node:assert/strict";
import { createWorld } from "../src/simulation/scenario";
import { personAlert, personAlertMap } from "../src/ui/personAlerts";

test("person alerts keep only the highest severity per person", () => {
  const world = createWorld(4);
  const [a, b, c, d] = world.people;

  a!.hunger = 10;
  a!.sleep = 10;
  b!.hunger = 30;
  b!.sleep = 10;
  c!.hunger = 30;
  c!.sleep = 100;
  d!.hunger = 100;
  d!.sleep = 100;
  d!.active = false;
  d!.path = [];
  d!.builder = false;
  d!.woodcutter = false;
  d!.extractor = undefined;
  d!.assignment = undefined;

  assert.deepEqual(personAlert(world, a!), {
    severity: "critical",
    code: "critical-hunger",
    label: "Sehr großer Hunger",
  });
  assert.equal(personAlert(world, b!)?.code, "critical-sleep");
  assert.equal(personAlert(world, c!)?.severity, "warning");
  assert.equal(personAlert(world, d!)?.severity, "info");

  const alerts = personAlertMap(world);
  assert.equal(alerts.size, 4);
  assert.equal([...alerts.values()].filter((alert) => alert.severity === "critical").length, 2);
  assert.equal([...alerts.values()].filter((alert) => alert.severity === "warning").length, 1);
  assert.equal([...alerts.values()].filter((alert) => alert.severity === "info").length, 1);
});

test("assigned or otherwise occupied people are not reported as idle", () => {
  const world = createWorld(1);
  const person = world.people[0]!;
  person.hunger = 100;
  person.sleep = 100;
  person.builder = true;

  assert.equal(personAlert(world, person), undefined);
});


test("free people stay reported as idle while moving or marked active", () => {
  const world = createWorld(1);
  const person = world.people[0]!;
  person.hunger = 100;
  person.sleep = 100;
  person.active = true;
  person.path = [{ q: person.position.q + 1, r: person.position.r }];

  assert.deepEqual(personAlert(world, person), {
    severity: "info",
    code: "idle",
    label: "Keine Aufgabe",
  });
});

test("temporary real tasks suppress the free-person idle hint", () => {
  const world = createWorld(1);
  const person = world.people[0]!;
  person.hunger = 100;
  person.sleep = 100;
  person.familyTask = { kind: "partner-search", partnerId: 2 };

  assert.equal(personAlert(world, person), undefined);
});


test("need alerts stay hidden between search and warning thresholds", () => {
  const world = createWorld(2);
  const [hungry, tired] = world.people;

  hungry!.hunger = 35;
  hungry!.hungerState = { resumeActive: false };
  hungry!.sleep = 100;

  tired!.hunger = 100;
  tired!.sleep = 35;
  tired!.sleepState = {
    kind: "ground",
    target: { ...tired!.position },
    progress: 0,
    completedPhases: 0,
    recoveryPerPhase: 10,
    resumeActive: false,
    resumeBuilder: false,
    resumeWoodcutter: false,
  };

  assert.equal(personAlert(world, hungry!), undefined);
  assert.equal(personAlert(world, tired!), undefined);

  hungry!.hunger = 30;
  tired!.sleep = 30;

  assert.equal(personAlert(world, hungry!)?.code, "hunger");
  assert.equal(personAlert(world, tired!)?.code, "sleep");

  hungry!.hunger = 20;
  tired!.sleep = 20;

  assert.equal(personAlert(world, hungry!)?.code, "critical-hunger");
  assert.equal(personAlert(world, tired!)?.code, "critical-sleep");
});

test("extractors with an exhausted work area get an important alert", () => {
  const world = createWorld(1);
  const person = world.people[0]!;
  person.hunger = 100;
  person.sleep = 100;
  person.woodcutter = true;
  person.workArea = { center: { ...person.position }, radius: 12.5 };
  person.resourceTarget = undefined;
  person.outdoorCarry = undefined;

  for (const resource of world.naturalResources) {
    if (resource.kind === "forest") {
      resource.remaining = 0;
      resource.depleted = true;
    }
  }

  assert.deepEqual(personAlert(world, person), {
    severity: "warning",
    code: "no-extractable-resource",
    label: "Nichts mehr abzubauen",
  });

  const tree = world.naturalResources.find((resource) => resource.kind === "forest")!;
  tree.position = { ...person.workArea.center };
  tree.remaining = 1;
  tree.depleted = false;

  assert.equal(personAlert(world, person), undefined);
});



test("blocked required navigation is an important person alert", () => {
  const world = createWorld(1);
  const person = world.people[0]!;
  person.hunger = 100;
  person.sleep = 100;
  person.navigationBlocked = true;
  person.navigationBlockedReason = "workplace";

  assert.deepEqual(personAlert(world, person), {
    severity: "warning",
    code: "no-route",
    label: "Kein Weg zur Arbeitsstätte",
  });

  person.navigationBlockedReason = "resource";
  assert.equal(personAlert(world, person)?.label, "Kein Weg zur Ressource");

  person.navigationBlockedReason = "food";
  assert.equal(personAlert(world, person)?.label, "Kein Weg zu Nahrung");

  person.navigationBlockedReason = undefined;
  assert.equal(personAlert(world, person)?.label, "Kein Weg zum Ziel");
});
