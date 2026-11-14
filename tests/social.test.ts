import test from "node:test";
import assert from "node:assert/strict";
import { createWorld } from "../src/simulation/scenario";
import {
  SOCIAL_RULES,
  advanceSocial,
  cancelSocial,
  commandSocialize,
  commandStopSocializing,
} from "../src/simulation/social";
import { orderPersonMove } from "../src/simulation/personCommands";
import { needDueBeforeNewTask } from "../src/simulation/workNeeds";

const advance = (world: ReturnType<typeof createWorld>, ticks: number): void => {
  for (let step = 0; step < ticks; step++) {
    world.round++;
    advanceSocial(world);
  }
};

test("working residents lose social points twice as fast as idle residents", () => {
  const world = createWorld(2);
  const [worker, idle] = world.people;
  worker!.social = 90;
  idle!.social = 90;
  worker!.progress = 1;
  advance(world, 20 * 60);
  assert.equal(worker!.social, 88);
  assert.equal(idle!.social, 89);
});

test("idle residents only invite other residents who are idle", () => {
  const world = createWorld(3);
  const [first, second, busy] = world.people;
  first!.social = 75;
  second!.social = 75;
  busy!.social = 5;
  busy!.progress = 10;
  advanceSocial(world);
  assert.equal(first!.socialTask?.partnerId, second!.id);
  assert.equal(second!.socialTask?.partnerId, first!.id);
  assert.equal(busy!.socialTask, undefined);
});

test("conversation recovery accrues continuously and the first avoidable interruption costs five points", () => {
  const world = createWorld(2);
  const [first, second] = world.people;
  first!.social = 20;
  second!.social = 20;
  advanceSocial(world);
  assert.equal(first!.socialTask?.partnerId, second!.id);
  advance(world, SOCIAL_RULES.conversationTicks / 2);
  const before = first!.social!;
  assert.ok(before > 20 && before < 32, "conversation must grant partial progress");
  const partnerBefore = second!.social!;
  cancelSocial(world, first!, true);
  assert.ok(Math.abs(first!.social! - (before - 5)) < 0.01);
  assert.equal(second!.social, partnerBefore, "the abandoned partner receives no penalty");
  assert.equal(first!.socialTask, undefined);
  assert.equal(second!.socialTask, undefined);
});

test("after completing one conversation, subsequent conversations in the same phase incur no penalty", () => {
  const world = createWorld(2);
  const [first, second] = world.people;
  first!.social = 0;
  second!.social = 0;
  advanceSocial(world);
  advance(world, SOCIAL_RULES.conversationTicks);
  assert.equal(first!.socialCompleted, true);
  assert.equal(second!.socialCompleted, true);
  assert.ok(first!.socialTask, "a consecutive talk should be scheduled when both still need contact");
  advance(world, SOCIAL_RULES.conversationTicks / 2);
  const before = first!.social!;
  cancelSocial(world, first!, true);
  assert.equal(first!.social, before, "the second interrupted talk has no penalty");
});

test("manual order pauses until an existing work action finishes and can be cancelled", () => {
  const world = createWorld(2);
  const [first, second] = world.people;
  first!.social = 20;
  second!.social = 20;
  first!.progress = 10;
  assert.equal(commandSocialize(world, first!.id), true);
  advanceSocial(world);
  assert.equal(first!.socialTask, undefined);
  first!.progress = 0;
  advance(world, 60);
  assert.equal(first!.socialTask?.partnerId, second!.id);
  assert.equal(commandStopSocializing(world, first!.id), true);
  assert.equal(first!.socialMode, undefined);
  assert.equal(first!.socialTask, undefined);
});

test("manual movement interrupts conversation immediately without losing accrued recovery", () => {
  const world = createWorld(2);
  const [first, second] = world.people;
  first!.social = 20;
  second!.social = 20;
  advanceSocial(world);
  advance(world, 60);
  const before = first!.social!;
  assert.equal(orderPersonMove(world, first!.id, { ...first!.position }), true);
  assert.ok(Math.abs(first!.social! - (before - 5)) < 0.01);
  assert.equal(first!.socialTask, undefined);
  assert.equal(second!.socialTask, undefined);
});

test("social value zero blocks work until the recovery threshold and state survives JSON saves", () => {
  const world = createWorld(2);
  const [first, second] = world.people;
  first!.social = 0;
  second!.social = 0;
  advanceSocial(world);
  assert.equal(first!.socialWorkBlocked, true);
  assert.equal(needDueBeforeNewTask(first!), true);
  const snapshot = JSON.parse(JSON.stringify(world)) as typeof world;
  assert.equal(snapshot.people[0]!.socialTask?.partnerId, second!.id);
  assert.equal(snapshot.people[0]!.socialWorkBlocked, true);
  advance(world, 4 * SOCIAL_RULES.conversationTicks + 3);
  assert.ok((first!.social ?? 0) >= 40);
  assert.equal(first!.socialWorkBlocked, undefined);
});
