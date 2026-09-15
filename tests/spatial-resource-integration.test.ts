import test from "node:test";
import assert from "node:assert/strict";
import { key, neighbors, same } from "../src/simulation/hex";
import { naturalResourceFootprint } from "../src/simulation/naturalResources";
import { CONFIG, createDefaultGameWorld } from "../src/simulation/scenario";
import { setRoad, tick } from "../src/simulation/simulation";

test("manual roads cannot cover any active natural-resource footprint cell", () => {
  const world = createDefaultGameWorld();
  const resource = world.naturalResources.find(
    (candidate) => candidate.kind === "clay" && naturalResourceFootprint(candidate).length > 1,
  );
  assert.ok(resource);
  const footprint = naturalResourceFootprint(resource!);
  const nonAnchor = footprint.find((position) => !same(position, resource!.position));
  assert.ok(nonAnchor);
  const tile = world.tiles.find((candidate) => same(candidate, nonAnchor!));
  assert.ok(tile);
  assert.equal(tile!.terrain, "grass");

  assert.equal(setRoad(world, nonAnchor!, true), false);
  assert.equal(tile!.terrain, "grass");
});

test("traffic never turns a walkable resource footprint into a road", () => {
  const world = createDefaultGameWorld();
  const resource = world.naturalResources.find(
    (candidate) => candidate.kind === "clay" && naturalResourceFootprint(candidate).length > 1,
  );
  assert.ok(resource);
  const resourceCells = new Set(naturalResourceFootprint(resource!).map(key));
  const target = world.tiles.find(
    (candidate) =>
      resourceCells.has(key(candidate)) &&
      candidate.terrain === "grass" &&
      neighbors(candidate).some((position) => {
        const start = world.tiles.find((tile) => same(tile, position));
        return Boolean(start && start.terrain === "grass" && !resourceCells.has(key(start)));
      }),
  );
  assert.ok(target);
  const start = neighbors(target!).find((position) => {
    const tile = world.tiles.find((candidate) => same(candidate, position));
    return Boolean(tile && tile.terrain === "grass" && !resourceCells.has(key(tile)));
  });
  assert.ok(start);

  const person = world.people[0]!;
  for (let i = 0; i < CONFIG.trafficThreshold + 2; i += 1) {
    person.position = { ...start! };
    person.path = [{ q: target!.q, r: target!.r }];
    person.movement = 1;
    tick(world);
  }

  assert.equal(target!.terrain, "grass");
  assert.equal(target!.trafficTicks, undefined);
});
