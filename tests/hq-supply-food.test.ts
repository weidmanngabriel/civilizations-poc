import { test } from "node:test";
import assert from "node:assert/strict";
import { attachNeeds, advanceHungerTick } from "../src/simulation/needs";
import { createWorld } from "../src/simulation/scenario";
import {
  assigned,
  buildAt,
  changeAssignment,
  tick,
} from "../src/simulation/simulation";
import type { BuildingKind, Good } from "../src/simulation/model";

const activateWorker = (
  world: ReturnType<typeof createWorld>,
  buildingId: string,
) => {
  const worker = assigned(world, buildingId, "worker")[0]!;
  const workplace = world.buildings.find((building) => building.id === buildingId)!;
  worker.position = { ...workplace.position };
  worker.path = [];
  worker.movement = 0;
  worker.active = true;
  return worker;
};

const supplyCases: Array<{
  kind: Extract<BuildingKind, "sawmill" | "carpenter" | "mill" | "bakery">;
  good: Good;
}> = [
  { kind: "sawmill", good: "wood" },
  { kind: "carpenter", good: "plank" },
  { kind: "mill", good: "wheat" },
  { kind: "bakery", good: "flour" },
];

for (const { kind, good } of supplyCases) {
  test(`${kind} can fetch ${good} from HQ inventory`, () => {
    const base = createWorld(2);
    const hq = base.buildings.find((building) => building.id === "hq")!;
    hq.inventory ??= {};
    hq.inventory[good] = 4;
    const world = attachNeeds(base);
    const workplace = buildAt(world, { q: 0, r: 0 }, kind)!;

    assert.equal(changeAssignment(world, workplace.id, "worker", 1), true);
    activateWorker(world, workplace.id);

    for (let i = 0; i < 1800; i++) {
      tick(world);
      const localStock = workplace.recipe?.inputs
        ? (workplace.inputInventory?.[good] ?? 0)
        : workplace.input;
      if (localStock >= 1) break;
    }

    const localStock = workplace.recipe?.inputs
      ? (workplace.inputInventory?.[good] ?? 0)
      : workplace.input;
    assert.ok(localStock >= 1, `${kind} should receive ${good} from HQ`);
    assert.ok((hq.inventory[good] ?? 0) < 4, "HQ inventory must be decremented");
  });
}

test("hungry person can eat bread directly from a completed bakery", () => {
  const world = createWorld(1);
  const hq = world.buildings.find((building) => building.id === "hq")!;
  hq.inventory ??= {};
  hq.inventory.bread = 0;
  const bakery = buildAt(world, { q: 0, r: 0 }, "bakery")!;
  bakery.output = 2;

  const person = world.people[0]!;
  person.position = { ...bakery.position };
  person.path = [];
  person.hunger = 20;

  advanceHungerTick(world);

  assert.equal(person.hunger, 100);
  assert.equal(bakery.output, 1);
  assert.equal(person.hungerState, undefined);
});

test("one bakery bread portion cannot be reserved by two hungry people", () => {
  const world = createWorld(2);
  const hq = world.buildings.find((building) => building.id === "hq")!;
  hq.inventory ??= {};
  hq.inventory.bread = 0;
  const bakery = buildAt(world, { q: 0, r: 0 }, "bakery")!;
  bakery.output = 1;

  const [first, second] = world.people;
  first!.position = { q: 3, r: 0 };
  second!.position = { q: 3, r: 0 };
  first!.path = [];
  second!.path = [];
  first!.hunger = 20;
  second!.hunger = 20;

  advanceHungerTick(world);

  const reserved = [first, second].filter(
    (person) => person!.hungerState?.foodSource === bakery.id,
  );
  assert.equal(reserved.length, 1);
});
