import test from "node:test";
import assert from "node:assert/strict";
import { createDefaultGameWorld } from "../src/simulation/scenario";
import {
  bushVisualKey,
  bushVisualState,
  currentBushTiles,
} from "../src/game/bushVisualState";

test("bush visuals follow full empty full state across tile object replacement", () => {
  const world = createDefaultGameWorld();
  const original = world.tiles.find((tile) => tile.bush && tile.bushAvailable)!;
  const key = bushVisualKey(original);

  assert.equal(bushVisualState(original), "full");

  world.tiles = world.tiles.map((tile) =>
    bushVisualKey(tile) === key
      ? { ...tile, bush: true, bushAvailable: false }
      : tile,
  );

  const harvested = currentBushTiles(world).find((tile) => bushVisualKey(tile) === key)!;
  assert.notStrictEqual(harvested, original);
  assert.equal(bushVisualState(harvested), "empty");

  harvested.bushAvailable = true;
  assert.equal(bushVisualState(harvested), "full");
});
