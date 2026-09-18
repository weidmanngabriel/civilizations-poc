import { test } from "node:test";
import assert from "node:assert/strict";
import { createWorld } from "../src/simulation/scenario";
import { buildingNotifications, buildingNeedsWorker, gameNotifications } from "../src/ui/gameNotifications";

test("completed staffed buildings only request attention while they have no worker", () => {
  const world = createWorld(1);
  const building = world.buildings.find((candidate) => candidate.kind === "sawmill");
  assert.ok(building);

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

  const building = world.buildings.find((candidate) => candidate.kind === "sawmill");
  assert.ok(building);
  building.construction = undefined;

  const notifications = gameNotifications(world);
  assert.equal(notifications.some((notification) => notification.kind === "person"), true);
  assert.equal(notifications.some((notification) =>
    notification.kind === "building" && notification.buildingId === building.id), true);
});
