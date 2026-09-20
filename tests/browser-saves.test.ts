import test from "node:test";
import assert from "node:assert/strict";
import { createDefaultGameWorld } from "../src/simulation/scenario";
import { createBrowserSaveRecord, findCurrentBrowserSave } from "../src/ui/browserSaves";

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
