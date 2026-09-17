import { readdir, readFile, stat } from "node:fs/promises";
import { extname, join, resolve } from "node:path";

const root = resolve(process.cwd(), "src", "assets", "buildings");

function fail(message) {
  throw new Error(message);
}

function validatePng(buffer, label) {
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  if (buffer.length < 33 || !buffer.subarray(0, 8).equals(signature))
    fail(`${label}: ungültiger PNG-Header.`);

  let offset = 8;
  let sawImageData = false;
  let sawEnd = false;
  while (offset < buffer.length) {
    if (offset + 12 > buffer.length) fail(`${label}: abgeschnittener PNG-Chunk.`);
    const size = buffer.readUInt32BE(offset);
    const type = buffer.toString("ascii", offset + 4, offset + 8);
    const next = offset + 12 + size;
    if (next > buffer.length) fail(`${label}: PNG-Chunk ${type} ist abgeschnitten.`);
    if (type === "IDAT") sawImageData = true;
    if (type === "IEND") {
      if (size !== 0 || next !== buffer.length) fail(`${label}: ungültiges PNG-Ende.`);
      sawEnd = true;
      break;
    }
    offset = next;
  }
  if (!sawImageData || !sawEnd) fail(`${label}: PNG ist unvollständig.`);
}

function validateWebp(buffer, label) {
  if (
    buffer.length < 20 ||
    buffer.toString("ascii", 0, 4) !== "RIFF" ||
    buffer.toString("ascii", 8, 12) !== "WEBP"
  ) fail(`${label}: ungültiger WebP-Header.`);

  const declaredLength = buffer.readUInt32LE(4) + 8;
  if (declaredLength !== buffer.length)
    fail(`${label}: WebP ist abgeschnitten (erwartet ${declaredLength}, vorhanden ${buffer.length} Bytes).`);

  let offset = 12;
  let sawImagePayload = false;
  while (offset < buffer.length) {
    if (offset + 8 > buffer.length) fail(`${label}: abgeschnittener WebP-Chunk.`);
    const type = buffer.toString("ascii", offset, offset + 4);
    const size = buffer.readUInt32LE(offset + 4);
    const next = offset + 8 + size + (size % 2);
    if (next > buffer.length) fail(`${label}: WebP-Chunk ${type} ist abgeschnitten.`);
    if (type === "VP8 " || type === "VP8L" || type === "ANMF") sawImagePayload = true;
    offset = next;
  }
  if (offset !== buffer.length || !sawImagePayload)
    fail(`${label}: WebP enthält keine vollständigen Bilddaten.`);
}

async function validateBuilding(directory) {
  const definitionPath = join(root, directory, "building.json");
  const definition = JSON.parse(await readFile(definitionPath, "utf8"));
  if (typeof definition.sprite !== "string" || !/^[a-z0-9][a-z0-9._-]*\.(?:png|webp)$/i.test(definition.sprite))
    fail(`${definitionPath}: ungültiger Sprite-Dateiname.`);

  const spritePath = join(root, directory, definition.sprite);
  const info = await stat(spritePath).catch(() => undefined);
  if (!info?.isFile()) fail(`${definitionPath}: Sprite fehlt: ${definition.sprite}`);

  const buffer = await readFile(spritePath);
  const extension = extname(definition.sprite).toLowerCase();
  if (extension === ".png") validatePng(buffer, spritePath);
  else validateWebp(buffer, spritePath);
}

const directories = (await readdir(root, { withFileTypes: true }))
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .sort();

for (const directory of directories) await validateBuilding(directory);
console.log(`Building assets validiert: ${directories.length} Sprite(s).`);
