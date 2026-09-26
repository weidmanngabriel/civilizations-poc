import assert from "node:assert/strict";
import test from "node:test";
import {
  personStatusBubbleWidth,
  personStatusIconCenters,
} from "../src/game/personStatusLayout";

test("person status icon centers stay symmetric around the bubble center", () => {
  assert.deepEqual(personStatusIconCenters(1), [0]);
  assert.deepEqual(personStatusIconCenters(2), [-1.35, 1.35]);
  assert.deepEqual(personStatusIconCenters(3), [-2.7, 0, 2.7]);
});

test("person status bubble width grows only with icon count", () => {
  assert.equal(personStatusBubbleWidth(1), 5.25);
  assert.equal(personStatusBubbleWidth(2), 8);
  assert.equal(personStatusBubbleWidth(3), 10.75);
});
