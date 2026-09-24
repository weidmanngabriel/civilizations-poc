import { test } from "node:test";
import assert from "node:assert/strict";
import { createWorld } from "../src/simulation/scenario";
import { changeFishers, fishers, tick } from "../src/simulation/simulation";
import {
  advanceFishSchools,
  FISH_REGROW_INTERVAL_TICKS,
  visibleFishCount,
} from "../src/simulation/fishSchools";

test("fish schools start finite and show the last three fish exactly", () => {
  const world = createWorld(1);
  assert.ok(world.fishSchools?.length);
  assert.ok(world.fishSchools!.every((school) => school.fish === school.capacity));
  assert.equal(visibleFishCount(3), 3);
  assert.equal(visibleFishCount(2), 2);
  assert.equal(visibleFishCount(1), 1);
  assert.equal(visibleFishCount(0), 0);
});

test("a successful fishing cycle consumes exactly one fish", () => {
  const world = createWorld(1);
  assert.equal(changeFishers(world, 1), true);
  const fisher = fishers(world)[0]!;
  assert.ok(fisher.fishingSpot);
  assert.ok(fisher.fishingWaterTarget === undefined);
  fisher.position = { ...fisher.fishingSpot! };
  fisher.path = [];
  fisher.movement = 0;
  fisher.active = false;
  fisher.experience = { fisher: 100 };
  world.rngState = 0;

  tick(world);
  assert.ok(fisher.fishingWaitUntilTick !== undefined);
  const waterTarget = fisher.fishingWaterTarget!;
  const school = world.fishSchools!.find((candidate) =>
    candidate.region.some((position) => position.q === waterTarget.q && position.r === waterTarget.r),
  );
  assert.ok(school);
  const before = school!.fish;

  while (world.round < fisher.fishingWaitUntilTick!) tick(world);

  assert.equal(school!.fish, before - 1);
  assert.equal(fisher.outdoorCarry, "fish");
});

test("an empty fish school recovers by one fish every thirty simulated seconds", () => {
  const world = createWorld(1);
  const school = world.fishSchools![0]!;
  school.fish = 0;
  school.nextRegrowTick = world.round + FISH_REGROW_INTERVAL_TICKS;

  world.round = school.nextRegrowTick - 1;
  advanceFishSchools(world);
  assert.equal(school.fish, 0);

  world.round += 1;
  advanceFishSchools(world);
  assert.equal(school.fish, 1);
  assert.equal(school.nextRegrowTick, world.round + FISH_REGROW_INTERVAL_TICKS);
});
