import test from "node:test";
import assert from "node:assert/strict";
import { CONFIG, createWorld } from "../src/simulation/scenario";
import { resolveFoodArrivals } from "../src/simulation/needs";
import { tick } from "../src/simulation/simulation";
import type { Building } from "../src/simulation/model";

test("organic road creation does not pull a person out of a bakery while eating", () => {
  const world = createWorld(2);
  const eater = world.people[0]!;
  const walker = world.people[1]!;
  const hq = world.buildings.find((building) => building.id === "hq")!;

  const bakery: Building = {
    id: "food-bakery",
    kind: "bakery",
    name: "Bäckerei",
    position: { q: hq.position.q + 2, r: hq.position.r },
    workers: 1,
    carriers: 0,
    input: 0,
    inputInventory: { flour: 0, water: 0 },
    output: 10,
    recipe: {
      inputs: { flour: 2, water: 1 },
      amount: 1,
      output: "bread",
      outputAmount: 2,
      duration: CONFIG.duration,
    },
  };
  const workplace: Building = {
    id: "eater-workplace",
    kind: "sawmill",
    name: "Arbeitsstätte",
    position: { q: hq.position.q + 6, r: hq.position.r },
    workers: 1,
    carriers: 0,
    input: 0,
    output: 0,
    recipe: { input: "wood", amount: 2, output: "plank", duration: CONFIG.duration },
  };
  world.buildings.push(bakery, workplace);

  eater.assignment = { building: workplace.id, role: "worker" };
  eater.position = { ...bakery.position };
  eater.path = [];
  eater.active = false;
  eater.hunger = 20;
  eater.hungerState = { resumeActive: true, foodSource: bakery.id };
  resolveFoodArrivals(world);
  const eatingUntilTick = eater.hungerState?.eatingUntilTick;
  assert.ok(eatingUntilTick !== undefined);

  const trafficTile = world.tiles.find(
    (tile) => tile.terrain === "grass" && (tile.q !== bakery.position.q || tile.r !== bakery.position.r),
  )!;
  trafficTile.trafficTicks = Array.from(
    { length: CONFIG.trafficThreshold - 1 },
    () => world.round,
  );
  walker.position = { q: trafficTile.q - 1, r: trafficTile.r };
  walker.path = [{ q: trafficTile.q, r: trafficTile.r }];
  walker.movement = 1;
  walker.hunger = 100;

  tick(world);

  assert.deepEqual(eater.position, bakery.position);
  assert.equal(eater.path.length, 0, "road rerouting must not replace the active eating task");
  assert.equal(eater.hungerState?.eatingUntilTick, eatingUntilTick);

  while (world.round <= eatingUntilTick! && eater.hungerState) tick(world);
  assert.equal(eater.hungerState, undefined);
  assert.equal(bakery.output, 9);
  assert.equal(eater.hunger, 99);
});
