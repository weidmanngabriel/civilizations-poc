import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = await readFile(new URL("../building-editor/src/main.ts", import.meta.url), "utf8");

test("removing a blocked cell resets both blocked state and footprint", () => {
  assert.match(
    source,
    /else if \(tool === "blocked"\)[\s\S]*?else \{\s*blocked\.delete\(key\);\s*footprint\.delete\(key\);\s*\}/,
  );
});
