import test from "node:test";
import assert from "node:assert/strict";
import {
  buildingDefinition,
  buildingVisualAnchor,
  definitionBlockedForBuilding,
  definitionForBuilding,
  definitionFootprintForBuilding,
} from "../src/buildings/buildingDefinitionRegistry";
import { key, walkable } from "../src/simulation/hex";
import { createDefaultGameWorld } from "../src/simulation/scenario";

const setOf = (positions: Array<{ q: number; r: number }>): Set<string> =>
  new Set(positions.map(key));

test("registered HQ uses its authored entrance as runtime interaction position", () => {
  const world = createDefaultGameWorld();
  const hq = world.buildings.find((building) => building.kind === "hq")!;
  const registered = buildingDefinition("hq")!;
  const visualAnchor = buildingVisualAnchor(hq);

  assert.deepEqual(hq.position, {
    q: visualAnchor.q + registered.visual.entrance.q,
    r: visualAnchor.r + registered.visual.entrance.r,
  });
  assert.deepEqual(
    setOf(hq.footprint ?? []),
    setOf(definitionFootprintForBuilding(hq) ?? []),
  );
  assert.ok(world.people.every((person) => key(person.position) === key(hq.position)));
});

test("registered blocked cells block movement while the authored entrance stays walkable", () => {
  const world = createDefaultGameWorld();
  const hq = world.buildings.find((building) => building.kind === "hq")!;
  const blocked = definitionBlockedForBuilding(hq)!;
  const tileByKey = new Map(world.tiles.map((tile) => [key(tile), tile]));

  assert.ok(blocked.length > 0);
  for (const position of blocked) {
    const tile = tileByKey.get(key(position));
    assert.equal(tile?.terrain, "building");
    assert.equal(tile?.buildingBlocking, true);
    assert.equal(tile ? walkable(tile) : true, false);
  }

  const entranceTile = tileByKey.get(key(hq.position));
  assert.equal(entranceTile?.terrain, "building");
  assert.equal(entranceTile?.buildingBlocking, undefined);
  assert.equal(entranceTile ? walkable(entranceTile) : false, true);
});

test("bakery, farm, well and mill use their editor-authored definitions", () => {
  const expected = [
    ["bakery", "bakery"],
    ["farm", "farm"],
    ["well", "well"],
    ["mill", "windmill"],
  ] as const;

  for (const [kind, id] of expected) {
    const registered = buildingDefinition(kind);
    assert.ok(registered);
    assert.equal(registered.visual.id, id);
    assert.ok(registered.visual.footprint.length > 0);
    assert.ok(registered.visual.footprint.some((cell) =>
      cell.q === registered.visual.entrance.q && cell.r === registered.visual.entrance.r
    ));
    assert.ok(!registered.visual.blocked.some((cell) =>
      cell.q === registered.visual.entrance.q && cell.r === registered.visual.entrance.r
    ));
  }
});

test("registered building kinds always use the current registry definition", () => {
  const bakery = {
    id: "bakery-test",
    kind: "bakery" as const,
    name: "Bäckerei",
    position: { q: 10, r: 10 },
    visualDefinitionId: "obsolete-definition",
    workers: 0,
    carriers: 0,
    input: 0,
    output: 0,
  };

  assert.equal(definitionForBuilding(bakery)?.visual.id, "bakery");
});

test("building kinds without an editor definition use the current hard-coded placement fallback", () => {
  assert.equal(buildingDefinition("house"), undefined);
  assert.equal(buildingDefinition("warehouse"), undefined);
});
