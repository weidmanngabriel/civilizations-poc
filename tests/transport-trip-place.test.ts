import { test } from "node:test";
import assert from "node:assert/strict";
import type { Trip } from "../src/simulation/model";
import { transportTripPlace } from "../src/ui/transportTripPlace";
import { createTestWorld } from "./testWorld";

const trip = (source: string, sourceKind?: Trip["sourceKind"]): Trip => ({
  source,
  sourceKind,
  target: "hq",
  good: "wood",
  picked: false,
});

test("transport status resolves building sources", () => {
  const world = createTestWorld();
  assert.equal(transportTripPlace(world, trip("hq")), "Hauptquartier");
});

test("transport status resolves physical ground stacks without treating them as buildings", () => {
  const world = createTestWorld();
  world.looseGoods = [{ id: "ground-3", good: "wood", quantity: 1, reserved: 0, position: { q: 1, r: 1 } }];
  assert.equal(transportTripPlace(world, trip("ground-3", "looseGood")), "Bodenstapel");
  assert.equal(transportTripPlace(world, trip("ground-38", "looseGood")), "Bodenstapel");
});

test("transport status resolves natural resources", () => {
  const world = createTestWorld({ resources: [{ kind: "forest", offset: { q: 2, r: 2 } }] });
  const resource = world.naturalResources[0]!;
  assert.equal(transportTripPlace(world, trip(resource.id, "resource")), "Wald");
  assert.equal(transportTripPlace(world, trip("missing", "resource")), "Vorkommen nicht mehr vorhanden");
});

test("transport status handles disappeared buildings and picked-up cargo", () => {
  const world = createTestWorld();
  assert.equal(transportTripPlace(world, trip("missing")), "Quelle nicht mehr vorhanden");
  const picked = { ...trip("ground-3", "looseGood"), picked: true };
  assert.equal(transportTripPlace(world, picked), "Hauptquartier");
  picked.target = "missing";
  assert.equal(transportTripPlace(world, picked), "Ziel nicht mehr vorhanden");
});
