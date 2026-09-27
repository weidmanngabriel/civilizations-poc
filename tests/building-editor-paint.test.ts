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


test("origin tool rebases spatial data and sprite anchor without changing the export schema", () => {
  assert.match(source, /data-tool="origin">Ursprung setzen<\/button>/);
  assert.match(source, /rebaseCellMap\(footprint, cell\);\s*rebaseCellMap\(blocked, cell\);/);
  assert.match(source, /if \(entrance\) entrance = translateHex\(entrance, cell\);/);
  assert.match(source, /nextAnchorX[\s\S]*?deltaX \/ previewWidth/);
  assert.match(source, /gridOrigin = \{ x: gridOrigin\.x \+ deltaX, y: gridOrigin\.y \+ deltaY \};/);
});
