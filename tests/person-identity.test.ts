import assert from "node:assert/strict";
import test from "node:test";
import { personName } from "../src/simulation/personIdentity";

test("person display names are deterministic and unique for normal population growth", () => {
  const firstRun = Array.from({ length: 80 }, (_, index) => personName(index + 1));
  const secondRun = Array.from({ length: 80 }, (_, index) => personName(index + 1));

  assert.deepEqual(firstRun, secondRun);
  assert.equal(new Set(firstRun).size, firstRun.length);
  assert.equal(personName(1), "Erik");
});
