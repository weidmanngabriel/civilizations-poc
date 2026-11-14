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
import { hexDistance } from "../src/simulation/hex";
import { needDueBeforeNewTask } from "../src/simulation/workNeeds";

const advance = (world: ReturnType<typeof createWorld>, ticks: number): void => {
  for (let step = 0; step < ticks; step++) {
    // Isolated social-state tests start after arrival at each participant's
    // reachable meeting target; path movement belongs to the core tick.
    for (const person of world.people) {
      if (!person.socialTask || !person.path.length) continue;
      person.position = { ...person.socialTask.target };
      person.path = [];
      person.movement = 0;
    }
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

test("a woodcutter with no active resource task counts as idle for social invitations", () => {
  const world = createWorld(2);
  const [woodcutter, neighbor] = world.people;
  woodcutter!.woodcutter = true;
  woodcutter!.social = 80;
  neighbor!.social = 80;
  advanceSocial(world);
  assert.equal(woodcutter!.socialTask?.partnerId, neighbor!.id);
  assert.equal(neighbor!.socialTask?.partnerId, woodcutter!.id);
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
  const activeConversation = world.people.find((person) => person.id === first!.id)?.socialTask;
  assert.equal(activeConversation?.partnerId, second!.id);
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

test("a completed idle social phase ends if no other idle partner remains", () => {
  const world = createWorld(2);
  const [first, second] = world.people;
  first!.social = 60;
  first!.socialMode = "idle";
  first!.socialCompleted = true;
  second!.hunger = 10;
  advanceSocial(world);
  assert.equal(first!.socialMode, undefined, "an idle resident cannot keep a phase open with no partner");
  assert.equal(needDueBeforeNewTask(first!), false, "an old completed conversation must not block work");
});

test("zero social value can suspend unfinished production and preserve its progress", () => {
  const world = createWorld(2);
  const [worker, partner] = world.people;
  worker!.social = 0;
  worker!.progress = 10;
  partner!.social = 0;
  advanceSocial(world);
  assert.equal(worker!.socialWorkBlocked, true);
  assert.equal(worker!.socialTask?.partnerId, partner!.id);
  assert.equal(worker!.progress, 10, "ongoing work progress must be retained across a conversation");
  advance(world, SOCIAL_RULES.conversationTicks);
  assert.equal(worker!.progress, 10);
});


test("a nearly full resident remains in the first half of a conversation", () => {
  const world = createWorld(2);
  const [first, second] = world.people;
  first!.social = 99;
  second!.social = 99;
  advanceSocial(world);
  assert.ok(first!.socialTask);
  advance(world, SOCIAL_RULES.minimumConversationTicks - 1);
  assert.equal(first!.social, 100);
  assert.ok(first!.socialTask, "reaching 100 must not end the talk before its minimum duration");
});

test("a resident recovering from work need can leave after the half-conversation", () => {
  const world = createWorld(2);
  const [worker, idle] = world.people;
  worker!.social = 99;
  idle!.social = 99;
  worker!.socialMode = "need";
  advanceSocial(world);
  advance(world, SOCIAL_RULES.minimumConversationTicks - 1);
  assert.ok(worker!.socialTask, "the minimum conversation is still in progress");
  advance(world, 1);
  assert.equal(worker!.socialTask, undefined);
  assert.equal(idle!.socialTask, undefined);
  assert.equal(worker!.socialCompleted, undefined, "half a conversation is not a fully completed talk");
});

test("two idle residents continue chatting without a pause, even when both social meters are full", () => {
  const world = createWorld(2);
  const [first, second] = world.people;
  first!.social = 99;
  second!.social = 99;
  advanceSocial(world);
  advance(world, SOCIAL_RULES.conversationTicks);
  assert.equal(first!.social, 100);
  assert.equal(second!.social, 100);
  assert.equal(first!.socialCompleted, true);
  assert.equal(second!.socialCompleted, true);
  assert.equal(first!.socialTask?.progressTicks, 0);
  assert.equal(second!.socialTask?.progressTicks, 0);
  advance(world, SOCIAL_RULES.conversationTicks / 2);
  assert.ok(first!.socialTask && second!.socialTask, "full social meters must not stop idle conversation");
  const before = first!.social!;
  cancelSocial(world, first!, true);
  assert.equal(first!.social, before, "completed first talk protects later conversation from penalties");
});

test("paired residents receive distinct adjacent and reachable meeting positions", () => {
  const world = createWorld(2);
  const [first, second] = world.people;
  first!.social = 70;
  second!.social = 70;
  advanceSocial(world);
  const targetA = first!.socialTask?.target;
  const targetB = second!.socialTask?.target;
  assert.ok(targetA && targetB);
  assert.notDeepEqual(targetA, targetB, "residents must not stand on top of each other");
  assert.equal(hexDistance(targetA, targetB), 1, "residents should meet on neighboring hexes");
  assert.ok(first!.path.length > 0 || hexDistance(first!.position, targetA) === 0);
  assert.ok(second!.path.length > 0 || hexDistance(second!.position, targetB) === 0);
});
