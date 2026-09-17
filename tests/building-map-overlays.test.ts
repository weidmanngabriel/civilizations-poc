import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = await readFile(
  new URL("../src/game/IncrementalMainScene.ts", import.meta.url),
  "utf8",
);

test("persistent building labels are hidden on the map", () => {
  assert.match(source, /mapLabels\?\.setVisible\(false\)/);
});

test("inventory overlay only tracks natural resources, not buildings", () => {
  const inventorySignature = source.match(
    /private inventorySignature\(\): string \{([\s\S]*?)\n  \}/,
  )?.[1] ?? "";
  const inventoryDraw = source.match(
    /private drawInventoryMarkers\(\): void \{([\s\S]*?)\n  \}\n\n  private createPersonMarker/,
  )?.[1] ?? "";

  assert.doesNotMatch(inventorySignature, /worldRef\.buildings/);
  assert.doesNotMatch(inventoryDraw, /worldRef\.buildings/);
  assert.match(inventoryDraw, /worldRef\.naturalResources/);
});
