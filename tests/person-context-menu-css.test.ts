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
