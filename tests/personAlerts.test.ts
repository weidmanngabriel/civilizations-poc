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
