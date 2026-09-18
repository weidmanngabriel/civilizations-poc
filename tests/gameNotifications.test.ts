import { test } from "node:test";
import assert from "node:assert/strict";
import type { Building } from "../src/simulation/model";
import { createWorld } from "../src/simulation/scenario";
import { buildingNotifications, buildingNeedsWorker, gameNotifications } from "../src/ui/gameNotifications";

test("completed staffed buildings only request attention while they have no worker", () => {
  const world = createWorld(1);
  const building: Building = {
    id: "test-sawmill", kind: "sawmill" as const, name: "Sägewerk", position: { q: 0, r: 0 },
    workers: 1, carriers: 1, input: 0, output: 0,
  };
  world.buildings.push(building);

  building.construction = {
    required: {},
    delivered: {},
    duration: 1,
    progress: 0,
    complete: false,
  };
  assert.equal(buildingNeedsWorker(world, building), false);

  building.construction.complete = true;
  building.construction.progress = 1;
  assert.equal(buildingNeedsWorker(world, building), true);
  assert.equal(buildingNotifications(world).some((notification) =>
    notification.kind === "building" && notification.buildingId === building.id), true);

  const person = world.people[0]!;
  person.assignment = { building: building.id, role: "worker" };
  assert.equal(buildingNeedsWorker(world, building), false);
});

test("buildings without worker slots do not create staffing notifications", () => {
  const world = createWorld(0);
  const building = world.buildings.find((candidate) => candidate.kind === "hq");
  assert.ok(building);
  assert.equal(buildingNeedsWorker(world, building), false);
});

test("game notification feed combines person and building attention", () => {
  const world = createWorld(1);
  const person = world.people[0]!;
  person.hunger = 10;
  person.sleep = 100;

  const building: Building = {
    id: "test-sawmill", kind: "sawmill" as const, name: "Sägewerk", position: { q: 0, r: 0 },
    workers: 1, carriers: 1, input: 0, output: 0,
  };
  world.buildings.push(building);

  const notifications = gameNotifications(world);
  assert.equal(notifications.some((notification) => notification.kind === "person"), true);
  assert.equal(notifications.some((notification) =>
    notification.kind === "building" && notification.buildingId === building.id), true);
});
