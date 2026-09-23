import test from "node:test";
import assert from "node:assert/strict";
import { createWorld } from "../src/simulation/scenario";
import { personInsideBuilding } from "../src/game/personVisibility";
import { buildAt } from "../src/simulation/simulation";
import { personActivityLabel } from "../src/personPresentation";

test("internal workplace activity hides assigned workers across the workplace footprint", () => {
  const world = createWorld(1);
  const person = world.people[0]!;
  const workplace = buildAt(world, { q: 5, r: 0 }, "sawmill")!;

  person.assignment = { building: workplace.id, role: "worker" };
  person.position = { ...workplace.position };
  person.path = [];
  person.progress = 1;
  assert.equal(
    personInsideBuilding(world, person),
    true,
    "normal internal production should hide the worker",
  );

  person.progress = 0;
  assert.equal(
    personInsideBuilding(world, person),
    false,
    "assigned but idle workers remain visible",
  );

  workplace.kind = "livestockBreeder";
  workplace.footprint = [
    { ...workplace.position },
    { q: workplace.position.q + 1, r: workplace.position.r },
  ];
  workplace.breeding = {
    kind: "sheep",
    parentIds: ["animal-1", "animal-2"],
    untilTick: world.round + 60,
  };
  person.position = { q: workplace.position.q + 1, r: workplace.position.r };
  assert.equal(
    personInsideBuilding(world, person),
    true,
    "building-owned internal work should hide the worker anywhere on its footprint",
  );

  person.position = { q: workplace.position.q + 2, r: workplace.position.r };
  assert.equal(
    personInsideBuilding(world, person),
    false,
    "internal work must not hide a worker who is actually outside the workplace",
  );
});

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


test("reached idle target is consistently shown as waiting", () => {
  const world = createWorld(1);
  const person = world.people[0]!;
  person.idleTarget = { ...person.position };
  person.path = [];
  person.active = true;

  assert.equal(personActivityLabel(person), "Wartet");

  person.path = [{ q: person.position.q + 1, r: person.position.r }];
  assert.equal(personActivityLabel(person), "Unterwegs");
});
