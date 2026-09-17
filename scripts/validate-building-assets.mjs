import { readdir, readFile, stat } from "node:fs/promises";
import { extname, join, resolve } from "node:path";

const ROOT = resolve(process.cwd(), "src", "assets", "buildings");
const SPRITE_NAME = /^[a-z0-9][a-z0-9._-]*\.(?:png|webp)$/i;

function fail(message) {
  throw new Error(message);
}

function validatePng(buffer, label) {
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  if (buffer.length < 33 || !buffer.subarray(0, 8).equals(signature))
    fail(`${label}: ungültiger PNG-Header.`);

  let offset = 8;
  let sawHeader = false;
  let sawImageData = false;
  let sawEnd = false;
  while (offset < buffer.length) {
    if (offset + 12 > buffer.length) fail(`${label}: abgeschnittener PNG-Chunk.`);
    const size = buffer.readUInt32BE(offset);
    const type = buffer.toString("ascii", offset + 4, offset + 8);
    const next = offset + 12 + size;
    if (next > buffer.length) fail(`${label}: PNG-Chunk ${type} ist abgeschnitten.`);
    if (!sawHeader && type !== "IHDR") fail(`${label}: PNG beginnt nicht mit IHDR.`);
    if (type === "IHDR") {
      if (sawHeader || size !== 13) fail(`${label}: ungültiger IHDR-Chunk.`);
      sawHeader = true;
    }
    if (type === "IDAT") sawImageData = true;
    if (type === "IEND") {
      if (size !== 0) fail(`${label}: ungültiger IEND-Chunk.`);
      sawEnd = true;
      if (next !== buffer.length) fail(`${label}: Daten hinter PNG-IEND gefunden.`);
      break;
    }
    offset = next;
  }
  if (!sawHeader || !sawImageData || !sawEnd)
    fail(`${label}: PNG ist unvollständig.`);
}

function validateWebp(buffer, label) {
  if (
    buffer.length < 20 ||
    buffer.toString("ascii", 0, 4) !== "RIFF" ||
    buffer.toString("ascii", 8, 12) !== "WEBP"
  ) fail(`${label}: ungültiger WebP-Header.`);

  const declaredLength = buffer.readUInt32LE(4) + 8;
  if (declaredLength !== buffer.length)
    fail(`${label}: WebP ist abgeschnitten (RIFF ${declaredLength} Bytes, Datei ${buffer.length} Bytes).`);

  let offset = 12;
  let sawImagePayload = false;
  while (offset < buffer.length) {
    if (offset + 8 > buffer.length) fail(`${label}: abgeschnittener WebP-Chunk.`);
    const type = buffer.toString("ascii", offset, offset + 4);
    const size = buffer.readUInt32LE(offset + 4);
    const paddedSize = size + (size % 2);
    const next = offset + 8 + paddedSize;
    if (next > buffer.length) fail(`${label}: WebP-Chunk ${type} ist abgeschnitten.`);
    if (type === "VP8 " || type === "VP8L" || type === "ANMF") sawImagePayload = true;
    offset = next;
  }
  if (offset !== buffer.length || !sawImagePayload)
    fail(`${label}: WebP enthält keine vollständigen Bilddaten.`);
}

async function validateDefinition(directory) {
  const definitionPath = join(ROOT, directory, "building.json");
  const definition = JSON.parse(await readFile(definitionPath, "utf8"));
  if (definition?.schema !== "civilizations-building-visual")
    fail(`${definitionPath}: unbekanntes Building-Schema.`);
  if (typeof definition.sprite !== "string" || !SPRITE_NAME.test(definition.sprite))
    fail(`${definitionPath}: ungültiger Sprite-Dateiname.`);

  const spritePath = join(ROOT, directory, definition.sprite);
  let info;
  try {
    info = await stat(spritePath);
  } catch {
    fail(`${definitionPath}: Sprite fehlt: ${definition.sprite}`);
  }
  if (!info.isFile()) fail(`${spritePath}: Sprite ist keine Datei.`);

  const buffer = await readFile(spritePath);
  const extension = extname(definition.sprite).toLowerCase();
  if (extension === ".png") validatePng(buffer, spritePath);
  else if (extension === ".webp") validateWebp(buffer, spritePath);
  else fail(`${spritePath}: nur PNG und WebP werden unterstützt.`);
  return spritePath;
}

const entries = await readdir(ROOT, { withFileTypes: true });
const directories = entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name).sort();
if (!directories.length) fail("Keine Gebäude-Assets gefunden.");

const validated = [];
for (const directory of directories) {
  try {
    validated.push(await validateDefinition(directory));
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  }
}

if (!process.exitCode)
  console.log(`Building assets validiert: ${validated.length} Sprite(s).`);
