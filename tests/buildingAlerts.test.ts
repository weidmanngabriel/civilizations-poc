import { test } from "node:test";
import assert from "node:assert/strict";
import type { Building } from "../src/simulation/model";
import { createWorld } from "../src/simulation/scenario";
import { buildingAlert, buildingAlertMap } from "../src/ui/buildingAlerts";

test("completed building with worker slots warns while no worker is assigned", () => {
  const world = createWorld(1);
  const building: Building = {
    id: "test-sawmill",
    kind: "sawmill",
    name: "Sägewerk",
    position: { q: 0, r: 0 },
    workers: 1,
    carriers: 1,
    input: 0,
    output: 0,
  };
  world.buildings.push(building);

  building.construction = {
    required: {},
    delivered: {},
    duration: 1,
    progress: 0,
    complete: false,
  };
  assert.equal(buildingAlert(world, building), undefined);

  building.construction.complete = true;
  building.construction.progress = 1;
  assert.deepEqual(buildingAlert(world, building), {
    severity: "warning",
    code: "worker-missing",
    label: "Kein Arbeiter zugewiesen",
  });
  assert.equal(buildingAlertMap(world).has(building.id), true);

  world.people[0]!.assignment = { building: building.id, role: "worker" };
  assert.equal(buildingAlert(world, building), undefined);
});

test("hq and buildings without worker slots do not create staffing alerts", () => {
  const world = createWorld(0);
  const hq = world.buildings.find((building) => building.kind === "hq");
  assert.ok(hq);
  assert.equal(buildingAlert(world, hq), undefined);
});


test("infrastructure never appears in normal building staffing alerts", () => {
  const world = createWorld(0);
  const palisade: Building = {
    id: "palisade-alert-test",
    kind: "palisade",
    name: "Palisade",
    position: { q: 1, r: 1 },
    workers: 1,
    carriers: 0,
    input: 0,
    output: 0,
    construction: {
      required: { wood: 1 },
      delivered: { wood: 1 },
      duration: 60,
      progress: 60,
      complete: true,
    },
  };
  world.buildings.push(palisade);

  assert.equal(buildingAlert(world, palisade), undefined);
  assert.equal(buildingAlertMap(world).has(palisade.id), false);
});
