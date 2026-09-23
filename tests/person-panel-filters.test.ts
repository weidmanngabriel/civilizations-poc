import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(new URL("../src/ui/personPanel.ts", import.meta.url), "utf8");

test("staff picker hides alert severity filters but keeps profession filters", () => {
  assert.match(
    source,
    /alertFilters\.hidden = true;\s*professionFilters\.hidden = false;/,
  );
});

test("alert severity filtering is limited to the normal people browser", () => {
  assert.match(
    source,
    /if \(!staffPicker && activeAlertFilter !== "all" && alert\?\.severity !== activeAlertFilter\)/,
  );
  assert.match(
    source,
    /if \(activeFilter === "free" && profession\) return false;/,
  );
});
