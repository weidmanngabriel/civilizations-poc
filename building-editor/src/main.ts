import "./style.css";
import {
  validateBuildingVisualDefinition,
  type BuildingVisualDefinition,
} from "../../src/buildings/buildingVisualDefinition";
import { HEX_X, HEX_Y } from "../../src/game/mapProjection";
import type { Hex } from "../../src/simulation/model";

type Tool = "move" | "footprint" | "blocked" | "entrance";

const GRID_RADIUS = 8;
const PREVIEW_SCALE = 10;
const CELL_X = HEX_X * PREVIEW_SCALE;
const CELL_Y = HEX_Y * PREVIEW_SCALE;
const CELL_HALF_X = CELL_X / 2;
const CELL_TOP_Y = CELL_Y / 2 + (CELL_X * CELL_X) / (8 * CELL_Y);
const CELL_SIDE_Y = CELL_Y / 2 - (CELL_X * CELL_X) / (8 * CELL_Y);
const SVG_NS = "http://www.w3.org/2000/svg";
const SUPPORTED_IMAGE_TYPES = new Set(["image/png", "image/webp"]);

const app = document.querySelector<HTMLDivElement>("#app");
if (!app) throw new Error("Editor root missing");

app.innerHTML = `
  <div class="editor-shell">
    <div class="mobile-note">Der Gebäudeeditor ist für Desktop ausgelegt. Auf kleinen Displays bleibt er erreichbar, kann aber horizontal scrollen.</div>
    <header class="editor-header">
      <div>
        <h1>Gebäudeeditor</h1>
        <p>Sprite, Grundriss, Kollision und Eingang · feines Spielraster</p>
      </div>
      <a href="${import.meta.env.BASE_URL}">Zum Spiel</a>
    </header>
    <main class="editor-layout">
      <section class="workspace">
        <div class="canvas" id="canvas">
          <div class="axis-label axis-q">q →</div>
          <div class="axis-label axis-r">r ↘</div>
          <img class="sprite" id="sprite-preview" alt="Gebäudesprite" hidden />
          <svg class="grid-svg" id="grid" aria-label="Gebäuderaster"></svg>
          <div class="origin-marker" id="origin-marker" aria-hidden="true"></div>
        </div>
      </section>
      <aside class="sidebar">
        <section class="panel">
          <h2>Gebäude</h2>
          <div class="field"><label for="building-id">ID</label><input id="building-id" type="text" value="new-building" spellcheck="false" /></div>
          <div class="dropzone" id="dropzone">PNG oder WebP hier hineinziehen<br />oder klicken</div>
          <input id="sprite-input" type="file" accept="image/png,image/webp" hidden />
          <button class="secondary" id="import-building">Export importieren</button>
          <input id="import-input" type="file" accept="application/json,image/png,image/webp,.json,.png,.webp" multiple hidden />
          <p class="help">Zum Import building.json und das zugehörige Sprite gemeinsam auswählen oder zusammen hier hineinziehen.</p>
        </section>
        <section class="panel">
          <h2>Sprite</h2>
          <div class="field">
            <label for="sprite-scale">Skalierung <span id="scale-label">100 %</span></label>
            <input id="sprite-scale" type="range" min="5" max="200" step="1" value="100" />
          </div>
          <div class="field"><label for="scale-number">Skalierung (%)</label><input id="scale-number" type="number" min="1" max="1000" step="1" value="100" /></div>
          <p class="help">Die Skalierung verändert nur die Darstellung, nicht die Originaldatei.</p>
        </section>
        <section class="panel">
          <h2>Werkzeug</h2>
          <div class="tool-row">
            <button class="tool" data-tool="move">Sprite verschieben</button>
            <button class="tool active" data-tool="footprint">Grundriss</button>
            <button class="tool" data-tool="blocked">Blockiert</button>
            <button class="tool" data-tool="entrance">Eingang</button>
          </div>
          <p class="help">Sprite verschieben erlaubt Drag am Bild. Die anderen Werkzeuge bearbeiten das Raster, ohne dass das Sprite Mausereignisse abfängt.</p>
        </section>
        <section class="panel">
          <h2>Sprite-Anchor</h2>
          <div class="field"><label for="anchor-x">X im Original-Sprite (px)</label><input id="anchor-x" type="number" value="0" step="1" /></div>
          <div class="field"><label for="anchor-y">Y im Original-Sprite (px)</label><input id="anchor-y" type="number" value="0" step="1" /></div>
          <p class="help">Der Anchor-Punkt liegt auf q=0 / r=0. Ziehen des Sprites aktualisiert diese Werte automatisch.</p>
        </section>
        <section class="panel actions">
          <button class="primary" id="download">Export herunterladen</button>
          <button class="secondary" id="save-project" ${import.meta.env.DEV ? "" : "hidden"}>Ins Projekt speichern</button>
          <div class="status" id="status">Sprite laden und Grundriss markieren.</div>
        </section>
      </aside>
    </main>
  </div>
`;

const grid = document.querySelector<SVGSVGElement>("#grid")!;
const canvas = document.querySelector<HTMLDivElement>("#canvas")!;
const spritePreview = document.querySelector<HTMLImageElement>("#sprite-preview")!;
const spriteInput = document.querySelector<HTMLInputElement>("#sprite-input")!;
const importInput = document.querySelector<HTMLInputElement>("#import-input")!;
const importButton = document.querySelector<HTMLButtonElement>("#import-building")!;
const dropzone = document.querySelector<HTMLDivElement>("#dropzone")!;
const idInput = document.querySelector<HTMLInputElement>("#building-id")!;
const anchorXInput = document.querySelector<HTMLInputElement>("#anchor-x")!;
const anchorYInput = document.querySelector<HTMLInputElement>("#anchor-y")!;
const scaleRange = document.querySelector<HTMLInputElement>("#sprite-scale")!;
const scaleNumber = document.querySelector<HTMLInputElement>("#scale-number")!;
const scaleLabel = document.querySelector<HTMLSpanElement>("#scale-label")!;
const originMarker = document.querySelector<HTMLDivElement>("#origin-marker")!;
const status = document.querySelector<HTMLDivElement>("#status")!;
const downloadButton = document.querySelector<HTMLButtonElement>("#download")!;
const saveProjectButton = document.querySelector<HTMLButtonElement>("#save-project")!;

let currentTool: Tool = "footprint";
let spriteFile: File | undefined;
let spriteDataUrl = "";
let spriteScale = 1;
let dragStart: { pointerX: number; pointerY: number; anchorX: number; anchorY: number } | undefined;
const footprint = new Map<string, Hex>();
const blocked = new Map<string, Hex>();
let entrance: Hex | undefined;

const cellKey = (cell: Hex): string => `${cell.q},${cell.r}`;
const hasCell = (map: Map<string, Hex>, cell: Hex): boolean => map.has(cellKey(cell));
const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);

function parseHex(value: unknown): Hex | undefined {
  if (!isRecord(value) || typeof value.q !== "number" || typeof value.r !== "number") return undefined;
  if (!Number.isFinite(value.q) || !Number.isFinite(value.r)) return undefined;
  return { q: value.q, r: value.r };
}

function parseDefinition(value: unknown): BuildingVisualDefinition {
  if (!isRecord(value)) throw new Error("building.json enthält kein gültiges Objekt.");
  if (value.schema !== "civilizations-building-visual" || value.version !== 1)
    throw new Error("building.json hat ein unbekanntes Schema oder eine nicht unterstützte Version.");
  if (typeof value.id !== "string" || typeof value.sprite !== "string")
    throw new Error("building.json enthält keine gültige ID oder Sprite-Datei.");
  if (!isRecord(value.spriteAnchor) || typeof value.spriteAnchor.x !== "number" || typeof value.spriteAnchor.y !== "number")
    throw new Error("building.json enthält keinen gültigen Sprite-Anchor.");
  if (!Array.isArray(value.footprint) || !Array.isArray(value.blocked))
    throw new Error("building.json enthält keinen gültigen Grundriss.");

  const footprintCells = value.footprint.map(parseHex);
  const blockedCells = value.blocked.map(parseHex);
  const entranceCell = parseHex(value.entrance);
  if (footprintCells.some((cell) => !cell) || blockedCells.some((cell) => !cell) || !entranceCell)
    throw new Error("building.json enthält ungültige Rasterkoordinaten.");

  const scale = value.spriteScale === undefined ? 1 : value.spriteScale;
  if (typeof scale !== "number" || !Number.isFinite(scale) || scale <= 0)
    throw new Error("building.json enthält keine gültige Sprite-Skalierung.");

  const parsed: BuildingVisualDefinition = {
    schema: "civilizations-building-visual",
    version: 1,
    id: value.id,
    sprite: value.sprite,
    spriteAnchor: { x: value.spriteAnchor.x, y: value.spriteAnchor.y },
    spriteScale: scale,
    footprint: footprintCells as Hex[],
    blocked: blockedCells as Hex[],
    entrance: entranceCell,
  };
  const definitionErrors = validateBuildingVisualDefinition(parsed);
  if (definitionErrors.length) throw new Error(definitionErrors.join("\n"));
  return parsed;
}

const center = (): { x: number; y: number } => ({
  x: canvas.clientWidth / 2,
  y: Math.max(300, canvas.clientHeight / 2 + 60),
});

function projected(cell: Hex): { x: number; y: number } {
  const origin = center();
  return { x: origin.x + CELL_X * (cell.q + cell.r / 2), y: origin.y + CELL_Y * cell.r };
}

function polygonPoints(cell: Hex): string {
  const point = projected(cell);
  return [
    [point.x - CELL_HALF_X, point.y - CELL_SIDE_Y],
    [point.x, point.y - CELL_TOP_Y],
    [point.x + CELL_HALF_X, point.y - CELL_SIDE_Y],
    [point.x + CELL_HALF_X, point.y + CELL_SIDE_Y],
    [point.x, point.y + CELL_TOP_Y],
    [point.x - CELL_HALF_X, point.y + CELL_SIDE_Y],
  ].map(([x, y]) => `${x},${y}`).join(" ");
}

function renderGrid(): void {
  grid.replaceChildren();
  grid.setAttribute("viewBox", `0 0 ${canvas.clientWidth} ${canvas.clientHeight}`);
  grid.classList.toggle("moving-sprite", currentTool === "move");
  spritePreview.classList.toggle("movable", currentTool === "move");
  for (let r = -GRID_RADIUS; r <= GRID_RADIUS; r += 1) {
    for (let q = -GRID_RADIUS; q <= GRID_RADIUS; q += 1) {
      const cell = { q, r };
      const polygon = document.createElementNS(SVG_NS, "polygon");
      polygon.setAttribute("points", polygonPoints(cell));
      polygon.classList.add("grid-cell");
      if (q === 0 && r === 0) polygon.classList.add("origin");
      if (q === 0 || r === 0) polygon.classList.add("axis-cell");
      if (hasCell(footprint, cell)) polygon.classList.add("footprint");
      if (hasCell(blocked, cell)) polygon.classList.add("blocked");
      if (entrance && cellKey(entrance) === cellKey(cell)) polygon.classList.add("entrance");
      polygon.addEventListener("pointerdown", () => editCell(cell));
      grid.append(polygon);
    }
  }
  const origin = projected({ q: 0, r: 0 });
  originMarker.style.left = `${origin.x}px`;
  originMarker.style.top = `${origin.y}px`;
  renderSpritePosition();
}

function editCell(cell: Hex): void {
  if (currentTool === "move") return;
  const key = cellKey(cell);
  if (currentTool === "footprint") {
    if (footprint.has(key)) {
      footprint.delete(key);
      blocked.delete(key);
      if (entrance && cellKey(entrance) === key) entrance = undefined;
    } else footprint.set(key, cell);
  } else if (currentTool === "blocked") {
    if (!footprint.has(key)) footprint.set(key, cell);
    if (blocked.has(key)) blocked.delete(key);
    else {
      blocked.set(key, cell);
      if (entrance && cellKey(entrance) === key) entrance = undefined;
    }
  } else {
    if (!footprint.has(key)) footprint.set(key, cell);
    blocked.delete(key);
    entrance = cell;
  }
  renderGrid();
  refreshStatus();
}

function renderSpritePosition(): void {
  if (!spriteDataUrl || !spritePreview.naturalWidth) return;
  const origin = projected({ q: 0, r: 0 });
  const anchorX = Number(anchorXInput.value) || 0;
  const anchorY = Number(anchorYInput.value) || 0;
  spritePreview.style.width = `${spritePreview.naturalWidth * spriteScale}px`;
  spritePreview.style.height = `${spritePreview.naturalHeight * spriteScale}px`;
  spritePreview.style.left = `${origin.x - anchorX * spriteScale}px`;
  spritePreview.style.top = `${origin.y - anchorY * spriteScale}px`;
}

function setScale(nextScale: number): void {
  spriteScale = Math.max(0.01, Math.min(10, nextScale));
  const percent = Math.round(spriteScale * 100);
  scaleNumber.value = String(percent);
  scaleRange.value = String(Math.max(Number(scaleRange.min), Math.min(Number(scaleRange.max), percent)));
  scaleLabel.textContent = `${percent} %`;
  renderSpritePosition();
  refreshStatus();
}

function definition(): BuildingVisualDefinition {
  const extension = spriteFile?.type === "image/webp" ? "webp" : "png";
  return {
    schema: "civilizations-building-visual",
    version: 1,
    id: idInput.value.trim(),
    sprite: `sprite.${extension}`,
    spriteAnchor: { x: Number(anchorXInput.value) || 0, y: Number(anchorYInput.value) || 0 },
    spriteScale,
    footprint: [...footprint.values()],
    blocked: [...blocked.values()],
    entrance: entrance ?? { q: Number.NaN, r: Number.NaN },
  };
}

function errors(): string[] {
  if (!spriteFile) return ["Ein Sprite fehlt."];
  if (!entrance) return ["Ein Eingang fehlt."];
  return validateBuildingVisualDefinition(definition());
}

function refreshStatus(message?: string): boolean {
  const currentErrors = errors();
  status.classList.toggle("error", currentErrors.length > 0);
  status.textContent = message ?? (currentErrors.length ? currentErrors.join("\n") : `Bereit · ${footprint.size} Grundrisszellen, ${blocked.size} blockiert · ${Math.round(spriteScale * 100)} % Sprite.`);
  return currentErrors.length === 0;
}

function setError(message: string): void {
  status.classList.add("error");
  status.textContent = message;
}

async function fileToDataUrl(file: File): Promise<string> {
  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

async function loadSprite(file: File, preserveTransform = false): Promise<void> {
  if (!SUPPORTED_IMAGE_TYPES.has(file.type)) {
    setError("Nur PNG und WebP werden unterstützt.");
    return;
  }
  spriteFile = file;
  spriteDataUrl = await fileToDataUrl(file);
  spritePreview.onload = () => {
    if (!preserveTransform) {
      anchorXInput.value = String(Math.round(spritePreview.naturalWidth / 2));
      anchorYInput.value = String(Math.round(spritePreview.naturalHeight * 0.82));
      const fitScale = Math.min(1, 720 / spritePreview.naturalWidth, 520 / spritePreview.naturalHeight);
      setScale(fitScale);
    } else renderSpritePosition();
  };
  spritePreview.src = spriteDataUrl;
  spritePreview.hidden = false;
  dropzone.textContent = `${file.name} · ${Math.round(file.size / 1024)} KB`;
  refreshStatus();
}

async function importFiles(files: File[]): Promise<void> {
  try {
    const jsonFile = files.find((file) => file.name.toLowerCase().endsWith(".json"));
    if (!jsonFile) throw new Error("Zum Import fehlt building.json.");
    const parsed = parseDefinition(JSON.parse(await jsonFile.text()) as unknown);
    const imageFile = files.find((file) => file.name === parsed.sprite);
    if (!imageFile) throw new Error(`Zum Import fehlt das Sprite ${parsed.sprite}.`);
    if (!SUPPORTED_IMAGE_TYPES.has(imageFile.type)) throw new Error("Das Sprite muss PNG oder WebP sein.");

    idInput.value = parsed.id;
    anchorXInput.value = String(parsed.spriteAnchor.x);
    anchorYInput.value = String(parsed.spriteAnchor.y);
    setScale(parsed.spriteScale ?? 1);
    footprint.clear();
    blocked.clear();
    for (const cell of parsed.footprint) footprint.set(cellKey(cell), cell);
    for (const cell of parsed.blocked) blocked.set(cellKey(cell), cell);
    entrance = parsed.entrance;
    await loadSprite(imageFile, true);
    renderGrid();
    refreshStatus(`Importiert: ${parsed.id}`);
  } catch (error) {
    setError(error instanceof Error ? error.message : "Import fehlgeschlagen.");
  } finally {
    importInput.value = "";
  }
}

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

downloadButton.addEventListener("click", () => {
  if (!refreshStatus()) return;
  const value = definition();
  downloadBlob(new Blob([JSON.stringify(value, null, 2)], { type: "application/json" }), "building.json");
  if (spriteFile) downloadBlob(spriteFile, value.sprite);
  refreshStatus("Export gestartet: building.json + Sprite.");
});

saveProjectButton.addEventListener("click", async () => {
  if (!refreshStatus() || !spriteDataUrl) return;
  saveProjectButton.disabled = true;
  try {
    const response = await fetch(`${import.meta.env.BASE_URL}__building-editor/save`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ definition: definition(), spriteDataUrl }),
    });
    const result = await response.json() as { ok?: boolean; path?: string; error?: string };
    if (!response.ok || !result.ok) throw new Error(result.error ?? "Speichern fehlgeschlagen");
    refreshStatus(`Gespeichert: ${result.path}`);
  } catch (error) {
    setError(error instanceof Error ? error.message : "Speichern fehlgeschlagen");
  } finally {
    saveProjectButton.disabled = false;
  }
});

function selectTool(tool: Tool): void {
  currentTool = tool;
  document.querySelectorAll<HTMLButtonElement>("[data-tool]").forEach((candidate) => {
    candidate.classList.toggle("active", candidate.dataset.tool === tool);
  });
  renderGrid();
}

document.querySelectorAll<HTMLButtonElement>("[data-tool]").forEach((button) => {
  button.addEventListener("click", () => selectTool(button.dataset.tool as Tool));
});

scaleRange.addEventListener("input", () => setScale(Number(scaleRange.value) / 100));
scaleNumber.addEventListener("input", () => {
  const percent = Number(scaleNumber.value);
  if (Number.isFinite(percent) && percent > 0) setScale(percent / 100);
});

spritePreview.addEventListener("pointerdown", (event) => {
  if (!spriteFile || currentTool !== "move") return;
  event.preventDefault();
  spritePreview.setPointerCapture(event.pointerId);
  dragStart = {
    pointerX: event.clientX,
    pointerY: event.clientY,
    anchorX: Number(anchorXInput.value) || 0,
    anchorY: Number(anchorYInput.value) || 0,
  };
  spritePreview.classList.add("dragging");
});
spritePreview.addEventListener("pointermove", (event) => {
  if (!dragStart) return;
  const dx = event.clientX - dragStart.pointerX;
  const dy = event.clientY - dragStart.pointerY;
  anchorXInput.value = String(Math.round((dragStart.anchorX - dx / spriteScale) * 10) / 10);
  anchorYInput.value = String(Math.round((dragStart.anchorY - dy / spriteScale) * 10) / 10);
  renderSpritePosition();
});
const finishSpriteDrag = () => {
  if (!dragStart) return;
  dragStart = undefined;
  spritePreview.classList.remove("dragging");
  refreshStatus();
};
spritePreview.addEventListener("pointerup", finishSpriteDrag);
spritePreview.addEventListener("pointercancel", finishSpriteDrag);

importButton.addEventListener("click", () => importInput.click());
importInput.addEventListener("change", () => {
  if (importInput.files?.length) void importFiles(Array.from(importInput.files));
});
dropzone.addEventListener("click", () => spriteInput.click());
spriteInput.addEventListener("change", () => {
  const file = spriteInput.files?.[0];
  if (file) void loadSprite(file);
});
for (const eventName of ["dragenter", "dragover"]) {
  dropzone.addEventListener(eventName, (event) => {
    event.preventDefault();
    dropzone.classList.add("dragging");
  });
}
for (const eventName of ["dragleave", "drop"]) {
  dropzone.addEventListener(eventName, (event) => {
    event.preventDefault();
    dropzone.classList.remove("dragging");
  });
}
dropzone.addEventListener("drop", (event) => {
  const files = Array.from(event.dataTransfer?.files ?? []);
  if (!files.length) return;
  if (files.some((file) => file.name.toLowerCase().endsWith(".json"))) void importFiles(files);
  else void loadSprite(files[0]!);
});

idInput.addEventListener("input", () => refreshStatus());
anchorXInput.addEventListener("input", renderSpritePosition);
anchorYInput.addEventListener("input", renderSpritePosition);
window.addEventListener("resize", renderGrid);

renderGrid();
refreshStatus();