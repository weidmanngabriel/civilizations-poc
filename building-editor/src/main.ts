import "./style.css";
import {
  validateBuildingVisualDefinition,
  type BuildingVisualDefinition,
} from "../../src/buildings/buildingVisualDefinition";
import { HEX_X, HEX_Y } from "../../src/game/mapProjection";
import type { Hex } from "../../src/simulation/model";

type Tool = "footprint" | "blocked" | "entrance";

const GRID_RADIUS = 8;
const PREVIEW_SCALE = 10;
const CELL_X = HEX_X * PREVIEW_SCALE;
const CELL_Y = HEX_Y * PREVIEW_SCALE;
const CELL_RADIUS_X = CELL_X * 0.58;
const CELL_RADIUS_Y = CELL_Y * 0.72;
const SVG_NS = "http://www.w3.org/2000/svg";

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
          <img class="sprite" id="sprite-preview" alt="Gebäudesprite" hidden />
          <svg class="grid-svg" id="grid" aria-label="Gebäuderaster"></svg>
        </div>
      </section>
      <aside class="sidebar">
        <section class="panel">
          <h2>Gebäude</h2>
          <div class="field"><label for="building-id">ID</label><input id="building-id" type="text" value="new-building" spellcheck="false" /></div>
          <div class="dropzone" id="dropzone">PNG oder WebP hier hineinziehen<br />oder klicken</div>
          <input id="sprite-input" type="file" accept="image/png,image/webp" hidden />
        </section>
        <section class="panel">
          <h2>Werkzeug</h2>
          <div class="tool-row">
            <button class="tool active" data-tool="footprint">Grundriss</button>
            <button class="tool" data-tool="blocked">Blockiert</button>
            <button class="tool" data-tool="entrance">Eingang</button>
          </div>
          <p class="help">Grundriss markiert Zellen des Gebäudes. Blockiert schaltet Kollision innerhalb des Grundrisses. Eingang setzt genau eine begehbare Zielzelle.</p>
        </section>
        <section class="panel">
          <h2>Sprite-Anchor</h2>
          <div class="field"><label for="anchor-x">X im Sprite (px)</label><input id="anchor-x" type="number" value="0" step="1" /></div>
          <div class="field"><label for="anchor-y">Y im Sprite (px)</label><input id="anchor-y" type="number" value="0" step="1" /></div>
          <p class="help">Der Anchor-Punkt des Bildes liegt auf der Rasterzelle q=0 / r=0.</p>
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
const dropzone = document.querySelector<HTMLDivElement>("#dropzone")!;
const idInput = document.querySelector<HTMLInputElement>("#building-id")!;
const anchorXInput = document.querySelector<HTMLInputElement>("#anchor-x")!;
const anchorYInput = document.querySelector<HTMLInputElement>("#anchor-y")!;
const status = document.querySelector<HTMLDivElement>("#status")!;
const downloadButton = document.querySelector<HTMLButtonElement>("#download")!;
const saveProjectButton = document.querySelector<HTMLButtonElement>("#save-project")!;

let currentTool: Tool = "footprint";
let spriteFile: File | undefined;
let spriteDataUrl = "";
const footprint = new Map<string, Hex>();
const blocked = new Map<string, Hex>();
let entrance: Hex | undefined;

const cellKey = (cell: Hex): string => `${cell.q},${cell.r}`;
const hasCell = (map: Map<string, Hex>, cell: Hex): boolean => map.has(cellKey(cell));

const center = (): { x: number; y: number } => ({
  x: canvas.clientWidth / 2,
  y: Math.max(300, canvas.clientHeight / 2 + 60),
});

function projected(cell: Hex): { x: number; y: number } {
  const origin = center();
  return {
    x: origin.x + CELL_X * (cell.q + cell.r / 2),
    y: origin.y + CELL_Y * cell.r,
  };
}

function polygonPoints(cell: Hex): string {
  const point = projected(cell);
  return [
    [point.x - CELL_RADIUS_X, point.y],
    [point.x - CELL_RADIUS_X / 2, point.y - CELL_RADIUS_Y],
    [point.x + CELL_RADIUS_X / 2, point.y - CELL_RADIUS_Y],
    [point.x + CELL_RADIUS_X, point.y],
    [point.x + CELL_RADIUS_X / 2, point.y + CELL_RADIUS_Y],
    [point.x - CELL_RADIUS_X / 2, point.y + CELL_RADIUS_Y],
  ].map(([x, y]) => `${x},${y}`).join(" ");
}

function renderGrid(): void {
  grid.replaceChildren();
  grid.setAttribute("viewBox", `0 0 ${canvas.clientWidth} ${canvas.clientHeight}`);

  for (let r = -GRID_RADIUS; r <= GRID_RADIUS; r += 1) {
    for (let q = -GRID_RADIUS; q <= GRID_RADIUS; q += 1) {
      const cell = { q, r };
      const polygon = document.createElementNS(SVG_NS, "polygon");
      polygon.setAttribute("points", polygonPoints(cell));
      polygon.classList.add("grid-cell");
      if (q === 0 && r === 0) polygon.classList.add("origin");
      if (hasCell(footprint, cell)) polygon.classList.add("footprint");
      if (hasCell(blocked, cell)) polygon.classList.add("blocked");
      if (entrance && cellKey(entrance) === cellKey(cell)) polygon.classList.add("entrance");
      polygon.addEventListener("pointerdown", () => editCell(cell));
      grid.append(polygon);
    }
  }
  renderSpritePosition();
}

function editCell(cell: Hex): void {
  const key = cellKey(cell);
  if (currentTool === "footprint") {
    if (footprint.has(key)) {
      footprint.delete(key);
      blocked.delete(key);
      if (entrance && cellKey(entrance) === key) entrance = undefined;
    } else {
      footprint.set(key, cell);
    }
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
  spritePreview.style.width = `${spritePreview.naturalWidth}px`;
  spritePreview.style.height = `${spritePreview.naturalHeight}px`;
  spritePreview.style.left = `${origin.x - anchorX}px`;
  spritePreview.style.top = `${origin.y - anchorY}px`;
}

function definition(): BuildingVisualDefinition {
  const extension = spriteFile?.type === "image/webp" ? "webp" : "png";
  return {
    schema: "civilizations-building-visual",
    version: 1,
    id: idInput.value.trim(),
    sprite: `sprite.${extension}`,
    spriteAnchor: {
      x: Number(anchorXInput.value) || 0,
      y: Number(anchorYInput.value) || 0,
    },
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
  status.textContent = message ?? (currentErrors.length ? currentErrors.join("\n") : `Bereit · ${footprint.size} Grundrisszellen, ${blocked.size} blockiert.`);
  return currentErrors.length === 0;
}

async function loadSprite(file: File): Promise<void> {
  if (!new Set(["image/png", "image/webp"]).has(file.type)) {
    status.classList.add("error");
    status.textContent = "Nur PNG und WebP werden unterstützt.";
    return;
  }
  spriteFile = file;
  spriteDataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
  spritePreview.onload = () => {
    if (Number(anchorXInput.value) === 0 && Number(anchorYInput.value) === 0) {
      anchorXInput.value = String(Math.round(spritePreview.naturalWidth / 2));
      anchorYInput.value = String(Math.round(spritePreview.naturalHeight * 0.82));
    }
    renderSpritePosition();
  };
  spritePreview.src = spriteDataUrl;
  spritePreview.hidden = false;
  dropzone.textContent = `${file.name} · ${Math.round(file.size / 1024)} KB`;
  refreshStatus();
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
    status.classList.add("error");
    status.textContent = error instanceof Error ? error.message : "Speichern fehlgeschlagen";
  } finally {
    saveProjectButton.disabled = false;
  }
});

document.querySelectorAll<HTMLButtonElement>("[data-tool]").forEach((button) => {
  button.addEventListener("click", () => {
    currentTool = button.dataset.tool as Tool;
    document.querySelectorAll("[data-tool]").forEach((candidate) => candidate.classList.remove("active"));
    button.classList.add("active");
  });
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
  const file = event.dataTransfer?.files[0];
  if (file) void loadSprite(file);
});

idInput.addEventListener("input", () => refreshStatus());
anchorXInput.addEventListener("input", renderSpritePosition);
anchorYInput.addEventListener("input", renderSpritePosition);
window.addEventListener("resize", renderGrid);

renderGrid();
refreshStatus();
