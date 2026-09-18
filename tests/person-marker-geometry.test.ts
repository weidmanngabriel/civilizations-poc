import test from "node:test";
import assert from "node:assert/strict";
import { createWorld } from "../src/simulation/scenario";
import { personWorldPosition } from "../src/simulation/movement";
import { pixel } from "../src/game/mapGeometry";
import { personMarkerPositions } from "../src/game/personMarkerGeometry";

test("person markers stay exactly on their simulation position without visual spreading", () => {
  const world = createWorld(2);
  const first = world.people[0]!;
  const second = world.people[1]!;

  second.position = { ...first.position };
  first.path = [];
  second.path = [];

  const markers = personMarkerPositions(world);
  const firstMarker = markers.find((marker) => marker.person.id === first.id)!;
  const secondMarker = markers.find((marker) => marker.person.id === second.id)!;
  const expected = pixel(first.position);

  assert.equal(firstMarker.x, expected.x);
  assert.equal(firstMarker.groundY, expected.y);
  assert.equal(secondMarker.x, expected.x);
  assert.equal(secondMarker.groundY, expected.y);
});

test("moving person markers follow only continuous simulation interpolation", () => {
  const world = createWorld(1);
  const person = world.people[0]!;
  const next = world.tiles.find(
    (tile) =>
      tile.terrain !== "river" &&
      tile.q === person.position.q + 1 &&
      tile.r === person.position.r,
  );
  assert.ok(next);

  person.path = [{ q: next.q, r: next.r }];
  person.movement = 0.25;

  const marker = personMarkerPositions(world).find(
    (candidate) => candidate.person.id === person.id,
  )!;
  const expected = pixel(personWorldPosition(world, person));

  assert.equal(marker.x, expected.x);
  assert.equal(marker.groundY, expected.y);
});
