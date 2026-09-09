import test from "node:test";
import assert from "node:assert/strict";
import { createWorld, CONFIG } from "../src/simulation/scenario";
import { personWorldPosition } from "../src/simulation/movement";

const almostEqual = (actual: number, expected: number) =>
  assert.ok(Math.abs(actual - expected) < 1e-9, `${actual} != ${expected}`);

test("person world position advances continuously between tile centres", () => {
  const world = createWorld(1);
  const person = world.people[0]!;
  const next = { q: person.position.q + 1, r: person.position.r };

  person.path = [next];
  person.movement = 0.25;

  const position = personWorldPosition(world, person);
  almostEqual(position.q, person.position.q + 0.25);
  almostEqual(position.r, person.position.r);
});

test("continuous progress respects faster road movement cost", () => {
  const world = createWorld(1);
  const person = world.people[0]!;
  const next = { q: person.position.q + 1, r: person.position.r };
  const tile = world.tiles.find((candidate) => candidate.q === next.q && candidate.r === next.r)!;
  tile.terrain = "road";

  person.path = [next];
  person.movement = (1 / CONFIG.roadSpeedMultiplier) / 2;

  const position = personWorldPosition(world, person);
  almostEqual(position.q, person.position.q + 0.5);
  almostEqual(position.r, person.position.r);
});
