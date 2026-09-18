import test from "node:test";
import assert from "node:assert/strict";
import { createWorld } from "../src/simulation/scenario";
import { personInsideBuilding } from "../src/game/personVisibility";
import { buildAt } from "../src/simulation/simulation";

test("timed transfers hide residents only when the interaction happens at a building", () => {
  const world = createWorld(1);
  const person = world.people[0]!;
  const hq = world.buildings.find((building) => building.id === "hq")!;

  person.position = { ...hq.position };
  person.path = [];

  person.trip = {
    source: hq.id,
    target: hq.id,
    good: "wood",
    picked: false,
    transferUntilTick: 180,
  };
  assert.equal(personInsideBuilding(world, person), true, "building pickup should be hidden");

  person.trip = {
    source: "loose-good-1",
    sourceKind: "looseGood",
    sourcePosition: { ...person.position },
    target: hq.id,
    good: "wood",
    picked: false,
    transferUntilTick: 180,
  };
  assert.equal(personInsideBuilding(world, person), false, "ground pickup should remain visible");

  person.trip = {
    source: "resource-1",
    sourceKind: "resource",
    sourcePosition: { ...person.position },
    target: hq.id,
    good: "wood",
    picked: false,
    transferUntilTick: 180,
  };
  assert.equal(personInsideBuilding(world, person), false, "natural-resource pickup should remain visible");

  person.trip = {
    source: "loose-good-1",
    sourceKind: "looseGood",
    sourcePosition: { ...person.position },
    target: hq.id,
    good: "wood",
    picked: true,
    transferUntilTick: 360,
  };
  assert.equal(personInsideBuilding(world, person), true, "building dropoff should be hidden");

  const well = buildAt(world, { q: 4, r: 0 }, "well")!;
  person.position = { ...well.position };
  person.trip = {
    source: well.id,
    target: hq.id,
    good: "water",
    picked: false,
    transferUntilTick: 180,
  };
  assert.equal(personInsideBuilding(world, person), false, "well pickup should remain visible");
});
