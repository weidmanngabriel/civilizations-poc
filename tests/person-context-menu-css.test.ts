import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const css = readFileSync(new URL("../src/person-context-menu.css", import.meta.url), "utf8");

test("hidden person context picker lists are not displayed", () => {
  assert.match(
    css,
    /\.person-context-professions\[hidden\],\s*\.person-context-equipment\[hidden\]\s*\{\s*display:\s*none;\s*\}/,
  );
});

test("person context menu keeps all sixteen orientation slots visible as placeholders", () => {
  const source = readFileSync(new URL("../src/ui/personContextMenu.ts", import.meta.url), "utf8");
  assert.match(source, /Array\.from\(\{ length: 16 \}/);
  assert.match(css, /\.person-context-placeholder\s*\{[\s\S]*border:/);
  assert.match(css, /\.person-context-placeholder\.slot-1\s*\{\s*grid-column:\s*2;\s*grid-row:\s*1;/);
  assert.match(css, /\.person-context-placeholder\.slot-16\s*\{\s*grid-column:\s*1;\s*grid-row:\s*2;/);
});
