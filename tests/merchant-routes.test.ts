import { test } from "node:test";
import assert from "node:assert/strict";
import { createWorld } from "../src/simulation/scenario";
import { findPathBySteps } from "../src/simulation/hex";
import {
  assigned,
  buildAt,
  changeAssignment,
  removeBuilding,
  setMerchantRoute,
  tick,
} from "../src/simulation/simulation";
import type { Hex, World } from "../src/simulation/model";

function reachableBuildableTile(w: World, origin: Hex): Hex {
  const candidate = w.tiles
    .filter((tile) => tile.terrain === "grass" || tile.terrain === "road")
    .map((tile) => ({ tile, path: findPathBySteps(w.tiles, origin, tile) }))
    .filter((entry) => entry.path && entry.path.length >= 2)
    .sort((a, b) => a.path!.length - b.path!.length)[0];
  assert.ok(candidate);
  return { q: candidate.tile.q, r: candidate.tile.r };
}

function runUntil(w: World, predicate: () => boolean, limit = 1000): void {
  for (let i = 0; i < limit && !predicate(); i++) tick(w);
  assert.ok(predicate(), "condition was not reached within tick limit");
}

test("merchant moves one configured good between two warehouses and returns empty", () => {
  const w = createWorld();
  const source = buildAt(w, { q: 14, r: 11 }, "warehouse")!;
  const target = buildAt(w, reachableBuildableTile(w, source.position), "warehouse")!;
  source.inventory!.wood = 2;

  assert.equal(changeAssignment(w, source.id, "merchant", 1), true);
  const merchant = assigned(w, source.id, "merchant")[0]!;
  merchant.position = { ...source.position };
  merchant.path = [];
  merchant.movement = 0;
  merchant.active = true;
  assert.equal(setMerchantRoute(w, merchant.id, target.id, "wood"), true);

  tick(w);
  assert.deepEqual(merchant.trip, {
    source: source.id,
    target: target.id,
    good: "wood",
    picked: false,
  });

  tick(w);
  assert.equal(merchant.trip?.picked, true);
  assert.equal(source.inventory!.wood, 1);
  assert.equal(target.inventory!.wood, 0);

  runUntil(w, () => target.inventory!.wood === 1);
  assert.equal(merchant.trip, undefined);
  assert.ok(merchant.path.length > 0, "merchant should return empty to the source warehouse");

  runUntil(w, () => target.inventory!.wood === 2);
  assert.equal(source.inventory!.wood, 0);
});

test("merchant waits when destination is full and target demolition clears the route", () => {
  const w = createWorld();
  const source = buildAt(w, { q: 14, r: 11 }, "warehouse")!;
  const target = buildAt(w, reachableBuildableTile(w, source.position), "warehouse")!;
  source.inventory!.plank = 1;
  target.inventory!.plank = 20;

  changeAssignment(w, source.id, "merchant", 1);
  const merchant = assigned(w, source.id, "merchant")[0]!;
  merchant.position = { ...source.position };
  merchant.path = [];
  merchant.movement = 0;
  merchant.active = true;
  setMerchantRoute(w, merchant.id, target.id, "plank");

  tick(w);
  assert.equal(merchant.trip, undefined);
  assert.equal(source.inventory!.plank, 1);

  assert.equal(removeBuilding(w, target.id), true);
  assert.equal(merchant.merchantRoute?.target, undefined);
  assert.equal(merchant.assignment?.role, "merchant");
});
