import test from "node:test";
import assert from "node:assert/strict";
import { createDefaultGameWorld } from "../src/simulation/scenario";
import {
  AUTOSAVE_INTERVAL_MS,
  AUTOSAVE_IDS,
  CRASH_SAVE_ID,
  browserSaveKind,
  createBrowserSaveRecord,
  findCurrentBrowserSave,
  nextAutosaveId,
} from "../src/ui/browserSaves";

test("browser save metadata counts residents and non-field buildings", () => {
  const world = createDefaultGameWorld();
  const savedAt = new Date("2026-09-20T12:00:00.000Z");
  const record = createBrowserSaveRecord(world, {
    id: "save-test",
    name: "  Meine Siedlung  ",
    savedAt,
    thumbnail: "data:image/webp;base64,test",
    json: "{\"format\":\"civilizations-save\"}",
  });

  assert.equal(record.id, "save-test");
  assert.equal(browserSaveKind(record), "manual");
  assert.equal(record.name, "Meine Siedlung");
  assert.equal(record.savedAt, savedAt.toISOString());
  assert.equal(record.population, world.people.length);
  assert.equal(
    record.buildingCount,
    world.buildings.filter((building) => !building.retired && building.kind !== "field").length,
  );
  assert.equal(record.thumbnail, "data:image/webp;base64,test");
});


test("active browser save lookup only returns the exact current slot", () => {
  const world = createDefaultGameWorld();
  const savedAt = new Date("2026-09-20T12:00:00.000Z");
  const first = createBrowserSaveRecord(world, {
    id: "save-first",
    name: "Erster Spielstand",
    savedAt,
    thumbnail: "data:image/webp;base64,first",
    json: "{}",
  });
  const second = createBrowserSaveRecord(world, {
    id: "save-second",
    name: "Zweiter Spielstand",
    savedAt,
    thumbnail: "data:image/webp;base64,second",
    json: "{}",
  });

  assert.equal(findCurrentBrowserSave([first, second], "save-second"), second);
  assert.equal(findCurrentBrowserSave([first, second], "missing"), undefined);
  assert.equal(findCurrentBrowserSave([first, second], undefined), undefined);
});


test("automatic saves use five real minutes and rotate through exactly three fixed slots", () => {
  assert.equal(AUTOSAVE_INTERVAL_MS, 300_000);
  assert.deepEqual(AUTOSAVE_IDS, ["autosave-1", "autosave-2", "autosave-3"]);
  assert.equal(CRASH_SAVE_ID, "crash-save");

  const world = createDefaultGameWorld();
  const autosave = (id: string, savedAt: string) =>
    createBrowserSaveRecord(world, {
      id,
      kind: "autosave",
      name: id,
      savedAt: new Date(savedAt),
      thumbnail: "",
      json: "{}",
    });

  const first = autosave("autosave-1", "2026-09-20T12:00:00.000Z");
  const second = autosave("autosave-2", "2026-09-20T12:05:00.000Z");
  assert.equal(nextAutosaveId([first, second]), "autosave-3");

  const third = autosave("autosave-3", "2026-09-20T12:10:00.000Z");
  assert.equal(nextAutosaveId([third, second, first]), "autosave-1");
});
