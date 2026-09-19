import { test } from "node:test";
import assert from "node:assert/strict";
import { setPersonProfession } from "../src/simulation/personCommands";
import {
  orderScoutWaypost,
  SCOUT_WAYPOST_BUILD_DURATION_TICKS,
} from "../src/simulation/scouting";
import { createDefaultGameWorld } from "../src/simulation/scenario";
import { tick } from "../src/simulation/simulation";
import {
  validWaypostAnchors,
  wayposts,
} from "../src/simulation/wayposts";

test("a scout erects a resource-free waypost after one simulated second", () => {
  const world = createDefaultGameWorld();
  const scout = world.people.find(
    (person) => !person.profession && !person.builder && !person.woodcutter,
  );
  assert.ok(scout);
  assert.equal(setPersonProfession(world, scout.id, "scout"), true);

  const target = validWaypostAnchors(world)[0];
  assert.ok(target);
  scout.position = { ...target };
  scout.path = [];
  scout.idleTarget = undefined;

  const before = wayposts(world).length;
  assert.equal(orderScoutWaypost(world, scout.id, target), true);

  for (let step = 0; step < SCOUT_WAYPOST_BUILD_DURATION_TICKS - 1; step += 1)
    tick(world);
  assert.equal(wayposts(world).length, before);
  assert.ok(scout.scoutWaypostTask);

  tick(world);
  assert.equal(wayposts(world).length, before + 1);
  assert.equal(scout.scoutWaypostTask, undefined);
});

test("only scouts can receive a waypost construction order", () => {
  const world = createDefaultGameWorld();
  const person = world.people.find(
    (candidate) => !candidate.builder && !candidate.woodcutter,
  );
  const target = validWaypostAnchors(world)[0];
  assert.ok(person);
  assert.ok(target);
  assert.equal(orderScoutWaypost(world, person.id, target), false);
});
