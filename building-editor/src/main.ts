import "./style.css";
import {
  validateBuildingVisualDefinition,
  type BuildingVisualDefinition,
  type BuildingVisualLevel,
} from "../../src/buildings/buildingVisualDefinition";
import { HEX_X, HEX_Y, hexCornerOffsets } from "../../src/game/mapProjection";
import { BUILDING_WIKI_LABELS } from "../../src/ui/wikiLinks";
import type { BuildingKind, Hex } from "../../src/simulation/model";

type Tool = "move" | "footprint" | "blocked" | "entrance";
type PaintMode = "set" | "remove";
type PaintTool = Exclude<Tool, "move">;
type BuildingVisualKind = Exclude<BuildingKind, "palisade">;
type PlaceholderDefinition = {
  placeholder: true;
  id: string;
  sprite: string;
};
type ProjectBuildingEntry = {
  kind: BuildingVisualKind;
  label: string;
  raw: unknown;
  placeholder: boolean;
};
type LevelSnapshot = {
  level: number;
  spriteFile?: File;
  spriteDataUrl: string;
  spriteName: string;
  spriteWorldWidth: number;
  anchorX: number;
  anchorY: number;
  footprint: Hex[];
  blocked: Hex[];
  entrance?: Hex;
};

const GRID_RADIUS = 8;
const PREVIEW_SCALE = 10;
const CELL_X = HEX_X * PREVIEW_SCALE;
const CELL_Y = HEX_Y * PREVIEW_SCALE;
const SVG_NS = "http://www.w3.org/2000/svg";
const SUPPORTED_IMAGE_TYPES = new Set(["image/png", "image/webp"]);
const PROJECT_DEFINITION_MODULES = import.meta.glob(
  "../../src/assets/buildings/*/building.json",
  { eager: true, import: "default" },
) as Record<string, unknown>;
const PROJECT_SPRITE_MODULES = import.meta.glob(
  "../../src/assets/buildings/*/*.{png,webp}",
  { eager: true, query: "?url", import: "default" },
) as Record<string, string>;

const app = document.querySelector<HTMLDivElement>("#app");
if (!app) throw new Error("Editor root missing");

app.innerHTML = `
  <div class="editor-shell">
    <div class="mobile-note">Der Gebäudeeditor ist für Desktop ausgelegt. Auf kleinen Displays bleibt er erreichbar, kann aber horizontal scrollen.</div>
    <header class="editor-header">
      <div>
        <h1>Gebäudeeditor</h1>
        <p>Sprite, Grundriss, Kollision und Eingang · Spielprojektion 1:1</p>
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
          <div class="field">
            <label for="building-select">Vorhandenes Gebäude</label>
            <select id="building-select">
              <option value="">— Gebäude wählen —</option>
            </select>
          </div>
          <p class="help building-load-note" id="building-load-note" hidden></p>
          <div class="field"><label for="building-id">ID</label><input id="building-id" type="text" value="new-building" spellcheck="false" /></div>
          <div class="level-controls">
            <div class="field level-field">
              <label for="level-select">Gebäudestufe</label>
              <select id="level-select"></select>
            </div>
            <button class="secondary compact" id="add-level" type="button">+ Stufe</button>
            <button class="secondary compact" id="remove-level" type="button">Stufe löschen</button>
          </div>
          <p class="help">Jede Stufe besitzt einen eigenen Sprite, Grundriss, blockierte Zellen und Eingang.</p>
          <div class="dropzone" id="dropzone">PNG oder WebP hier hineinziehen<br />oder klicken</div>
          <input id="sprite-input" type="file" accept="image/png,image/webp" hidden />
          <button class="secondary" id="import-building">Gebäudedefinition öffnen</button>
          <input id="import-input" type="file" accept="application/json,image/png,image/webp,.json,.png,.webp" multiple hidden />
          <p class="help">building.json und das zugehörige Sprite gemeinsam auswählen oder zusammen hier hineinziehen.</p>
        </section>
        <section class="panel">
          <h2>Sprite</h2>
          <div class="field">
            <label for="sprite-scale">Sprite-Breite im Spiel <span id="scale-label">60 Welt-px</span></label>
            <input id="sprite-scale" type="range" min="1" max="200" step="0.1" value="60" />
          </div>
          <div class="field"><label for="scale-number">Exakter Wert (Welt-px)</label><input id="scale-number" type="number" min="0.1" max="1000" step="0.1" value="60" /></div>
          <p class="help">Die Originaldatei wird beim Export nicht verkleinert. Hier stellst du nur die spätere Breite in der Spielwelt ein; deshalb bleibt die Darstellung unabhängig von der Bildauflösung.</p>
        </section>
        <section class="panel">
          <h2>Werkzeug</h2>
          <div class="tool-row">
            <button class="tool" data-tool="move">Sprite verschieben</button>
            <button class="tool active" data-tool="footprint">Grundfläche</button>
            <button class="tool" data-tool="blocked">Blockierte Zellen</button>
            <button class="tool" data-tool="entrance">Eingang</button>
          </div>
          <div class="field overlay-field">
            <label for="overlay-strength">Overlay-Stärke <span id="overlay-label">100 %</span></label>
            <input id="overlay-strength" type="range" min="0" max="100" step="1" value="100" />
          </div>
          <p class="help">Ein Klick toggelt die Zelle. Klick halten und ziehen überträgt das Ergebnis der ersten Zelle auf alle weiteren überfahrenen Zellen. Shift + Klick oder Shift + Drag setzt Zellen zurück. Sprite verschieben erlaubt Drag am Bild.</p>
        </section>
        <section class="panel">
          <h2>Sprite-Ausrichtung</h2>
          <div class="field"><label for="anchor-x">Ankerpunkt X (%)</label><input id="anchor-x" type="number" value="50" step="0.1" /></div>
          <div class="field"><label for="anchor-y">Ankerpunkt Y (%)</label><input id="anchor-y" type="number" value="82" step="0.1" /></div>
          <p class="help">Der Ankerpunkt liegt auf q=0 / r=0. Er wird relativ zur Sprite-Größe gespeichert und bleibt deshalb bei einer anderen Quellauflösung an derselben Stelle.</p>
        </section>
        <section class="panel actions">
          <button class="${import.meta.env.DEV ? "secondary" : "primary"}" id="download">Dateien herunterladen</button>
          <button class="primary" id="save-project" ${import.meta.env.DEV ? "" : "hidden"}>Direkt ins Projekt speichern</button>
          <p class="help" ${import.meta.env.DEV ? "" : "hidden"}>Schreibt building.json und Sprite nach <code>src/assets/buildings/&lt;id&gt;/</code>.</p>
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
const buildingSelect = document.querySelector<HTMLSelectElement>("#building-select")!;
const buildingLoadNote = document.querySelector<HTMLParagraphElement>("#building-load-note")!;
const idInput = document.querySelector<HTMLInputElement>("#building-id")!;
const levelSelect = document.querySelector<HTMLSelectElement>("#level-select")!;
const addLevelButton = document.querySelector<HTMLButtonElement>("#add-level")!;
const removeLevelButton = document.querySelector<HTMLButtonElement>("#remove-level")!;
const anchorXInput = document.querySelector<HTMLInputElement>("#anchor-x")!;
const anchorYInput = document.querySelector<HTMLInputElement>("#anchor-y")!;
const scaleRange = document.querySelector<HTMLInputElement>("#sprite-scale")!;
const scaleNumber = document.querySelector<HTMLInputElement>("#scale-number")!;
const scaleLabel = document.querySelector<HTMLSpanElement>("#scale-label")!;
const overlayRange = document.querySelector<HTMLInputElement>("#overlay-strength")!;
const overlayLabel = document.querySelector<HTMLSpanElement>("#overlay-label")!;
const originMarker = document.querySelector<HTMLDivElement>("#origin-marker")!;
const status = document.querySelector<HTMLDivElement>("#status")!;
const downloadButton = document.querySelector<HTMLButtonElement>("#download")!;
const saveProjectButton = document.querySelector<HTMLButtonElement>("#save-project")!;

let currentTool: Tool = "footprint";
let spriteFile: File | undefined;
let spriteDataUrl = "";
let spriteName = "sprite-1.png";
let spriteWorldWidth = 60;
let activeLevel = 1;
const levelSnapshots = new Map<number, LevelSnapshot>();
let dragStart: { pointerX: number; pointerY: number; anchorX: number; anchorY: number } | undefined;
let paintDrag: { tool: PaintTool; mode: PaintMode; visited: Set<string> } | undefined;
const footprint = new Map<string, Hex>();
const blocked = new Map<string, Hex>();
const cellElements = new Map<string, SVGPolygonElement>();
let entrance: Hex | undefined;

const cellKey = (cell: Hex): string => `${cell.q},${cell.r}`;
const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);

function parseHex(value: unknown): Hex | undefined {
  if (!isRecord(value) || typeof value.q !== "number" || typeof value.r !== "number") return undefined;
  if (!Number.isFinite(value.q) || !Number.isFinite(value.r)) return undefined;
  return { q: value.q, r: value.r };
}

function parsePlaceholderDefinition(value: unknown): PlaceholderDefinition | undefined {
  if (
    !isRecord(value) ||
    value.placeholder !== true ||
    typeof value.id !== "string" ||
    typeof value.sprite !== "string"
  ) return undefined;
  return { placeholder: true, id: value.id, sprite: value.sprite };
}

function parseDefinition(value: unknown): BuildingVisualDefinition {
  if (!isRecord(value)) throw new Error("building.json enthält kein gültiges Objekt.");
  if (value.schema !== "civilizations-building-visual" || value.version !== 4)
    throw new Error("building.json hat ein unbekanntes Schema oder eine nicht unterstützte Version.");
  if (typeof value.id !== "string" || !Array.isArray(value.levels))
    throw new Error("building.json enthält keine gültige ID oder Gebäudestufen.");

  const levels: BuildingVisualLevel[] = value.levels.map((rawLevel, index) => {
    if (!isRecord(rawLevel))
      throw new Error(`Stufe ${index + 1} ist ungültig.`);
    if (
      typeof rawLevel.level !== "number" ||
      typeof rawLevel.sprite !== "string" ||
      !isRecord(rawLevel.spriteAnchor) ||
      typeof rawLevel.spriteAnchor.x !== "number" ||
      typeof rawLevel.spriteAnchor.y !== "number" ||
      typeof rawLevel.spriteWorldWidth !== "number" ||
      !Array.isArray(rawLevel.footprint) ||
      !Array.isArray(rawLevel.blocked)
    ) throw new Error(`Stufe ${index + 1} enthält ungültige Daten.`);

    const footprintCells = rawLevel.footprint.map(parseHex);
    const blockedCells = rawLevel.blocked.map(parseHex);
    const entranceCell = parseHex(rawLevel.entrance);
    if (footprintCells.some((cell) => !cell) || blockedCells.some((cell) => !cell) || !entranceCell)
      throw new Error(`Stufe ${rawLevel.level} enthält ungültige Rasterkoordinaten.`);

    return {
      level: rawLevel.level,
      sprite: rawLevel.sprite,
      spriteAnchor: { x: rawLevel.spriteAnchor.x, y: rawLevel.spriteAnchor.y },
      spriteWorldWidth: rawLevel.spriteWorldWidth,
      footprint: footprintCells as Hex[],
      blocked: blockedCells as Hex[],
      entrance: entranceCell,
    };
  });

  const parsed: BuildingVisualDefinition = {
    schema: "civilizations-building-visual",
    version: 4,
    id: value.id,
    levels,
  };
  const definitionErrors = validateBuildingVisualDefinition(parsed);
  if (definitionErrors.length) throw new Error(definitionErrors.join("\n"));
  return parsed;
}

const buildingEditorLabel = (kind: BuildingVisualKind): string =>
  kind === "field" ? "Feld" : BUILDING_WIKI_LABELS[kind];

const PROJECT_BUILDINGS: ProjectBuildingEntry[] = Object.entries(PROJECT_DEFINITION_MODULES)
  .map(([path, raw]): ProjectBuildingEntry | undefined => {
    const match = path.match(/\/buildings\/([^/]+)\/building\.json$/);
    if (!match) return undefined;
    const kind = match[1] as BuildingKind;
    if (kind === "palisade") return undefined;
    if (kind !== "field" && !(kind in BUILDING_WIKI_LABELS)) return undefined;

    const placeholder = parsePlaceholderDefinition(raw);
    if (!placeholder) parseDefinition(raw);
    return {
      kind: kind as BuildingVisualKind,
      label: buildingEditorLabel(kind as BuildingVisualKind),
      raw,
      placeholder: Boolean(placeholder),
    };
  })
  .filter((entry): entry is ProjectBuildingEntry => Boolean(entry))
  .sort((a, b) => a.label.localeCompare(b.label, "de"));

for (const entry of PROJECT_BUILDINGS) {
  const option = document.createElement("option");
  option.value = entry.kind;
  option.textContent = entry.label;
  buildingSelect.append(option);
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
  return hexCornerOffsets(PREVIEW_SCALE)
    .map((offset) => `${point.x + offset.x},${point.y + offset.y}`)
    .join(" ");
}

function syncGridCellClasses(): void {
  for (const [key, polygon] of cellElements) {
    polygon.classList.toggle("footprint", footprint.has(key));
    polygon.classList.toggle("blocked", blocked.has(key));
    polygon.classList.toggle("entrance", entrance ? cellKey(entrance) === key : false);
  }
}

function renderGrid(): void {
  grid.replaceChildren();
  cellElements.clear();
  grid.setAttribute("viewBox", `0 0 ${canvas.clientWidth} ${canvas.clientHeight}`);
  grid.classList.toggle("moving-sprite", currentTool === "move");
  spritePreview.classList.toggle("movable", currentTool === "move");
  for (let r = -GRID_RADIUS; r <= GRID_RADIUS; r += 1) {
    for (let q = -GRID_RADIUS; q <= GRID_RADIUS; q += 1) {
      const cell = { q, r };
      const key = cellKey(cell);
      const polygon = document.createElementNS(SVG_NS, "polygon");
      polygon.setAttribute("points", polygonPoints(cell));
      polygon.classList.add("grid-cell");
      if (q === 0 && r === 0) polygon.classList.add("origin");
      if (q === 0 || r === 0) polygon.classList.add("axis-cell");
      polygon.addEventListener("pointerdown", (event) => beginCellPaint(event, cell));
      polygon.addEventListener("pointerenter", () => continueCellPaint(cell));
      cellElements.set(key, polygon);
      grid.append(polygon);
    }
  }
  syncGridCellClasses();
  const origin = projected({ q: 0, r: 0 });
  originMarker.style.left = `${origin.x}px`;
  originMarker.style.top = `${origin.y}px`;
  renderSpritePosition();
}

function toolHasCell(tool: PaintTool, cell: Hex): boolean {
  const key = cellKey(cell);
  if (tool === "footprint") return footprint.has(key);
  if (tool === "blocked") return blocked.has(key);
  return entrance ? cellKey(entrance) === key : false;
}

function applyCellPaint(tool: PaintTool, cell: Hex, mode: PaintMode): void {
  const key = cellKey(cell);
  if (tool === "footprint") {
    if (mode === "set") footprint.set(key, cell);
    else {
      footprint.delete(key);
      blocked.delete(key);
      if (entrance && cellKey(entrance) === key) entrance = undefined;
    }
  } else if (tool === "blocked") {
    if (mode === "set") {
      footprint.set(key, cell);
      blocked.set(key, cell);
      if (entrance && cellKey(entrance) === key) entrance = undefined;
    } else {
      blocked.delete(key);
      footprint.delete(key);
    }
  } else if (mode === "set") {
    footprint.set(key, cell);
    blocked.delete(key);
    entrance = cell;
  } else if (entrance && cellKey(entrance) === key) entrance = undefined;

  syncGridCellClasses();
  refreshStatus();
}

function beginCellPaint(event: PointerEvent, cell: Hex): void {
  if (currentTool === "move" || event.button !== 0) return;
  event.preventDefault();
  const tool = currentTool as PaintTool;
  const mode: PaintMode = event.shiftKey ? "remove" : toolHasCell(tool, cell) ? "remove" : "set";
  paintDrag = { tool, mode, visited: new Set([cellKey(cell)]) };
  applyCellPaint(tool, cell, mode);
}

function continueCellPaint(cell: Hex): void {
  if (!paintDrag) return;
  const key = cellKey(cell);
  if (paintDrag.visited.has(key)) return;
  paintDrag.visited.add(key);
  applyCellPaint(paintDrag.tool, cell, paintDrag.mode);
}

function finishCellPaint(): void {
  paintDrag = undefined;
}

function roundedWorldWidth(): number {
  return Math.round(spriteWorldWidth * 10) / 10;
}

function renderSpritePosition(): void {
  if (!spriteDataUrl || !spritePreview.naturalWidth) return;
  const origin = projected({ q: 0, r: 0 });
  const anchorX = (Number(anchorXInput.value) || 0) / 100;
  const anchorY = (Number(anchorYInput.value) || 0) / 100;
  const previewWidth = spriteWorldWidth * PREVIEW_SCALE;
  const previewHeight = previewWidth * (spritePreview.naturalHeight / spritePreview.naturalWidth);
  spritePreview.style.width = `${previewWidth}px`;
  spritePreview.style.height = `${previewHeight}px`;
  spritePreview.style.left = `${origin.x - anchorX * previewWidth}px`;
  spritePreview.style.top = `${origin.y - anchorY * previewHeight}px`;
}

function setWorldWidth(nextWidth: number, refresh = true): void {
  spriteWorldWidth = Math.max(0.1, Math.min(1000, nextWidth));
  const width = roundedWorldWidth();
  scaleNumber.value = String(width);
  scaleRange.value = String(Math.max(Number(scaleRange.min), Math.min(Number(scaleRange.max), width)));
  scaleLabel.textContent = String(width) + " Welt-px";
  renderSpritePosition();
  if (refresh) refreshStatus();
}

function setOverlayStrength(percent: number): void {
  const clamped = Math.max(0, Math.min(100, percent));
  const strength = clamped / 100;
  overlayRange.value = String(clamped);
  overlayLabel.textContent = `${Math.round(clamped)} %`;
  grid.style.setProperty("--footprint-fill-alpha", String(0.05 + 0.39 * strength));
  grid.style.setProperty("--blocked-fill-alpha", String(0.06 + 0.5 * strength));
  grid.style.setProperty("--entrance-fill-alpha", String(0.08 + 0.64 * strength));
  grid.style.setProperty("--overlay-stroke-alpha", String(0.25 + 0.75 * strength));
  grid.style.setProperty("--overlay-glow-alpha", String(0.8 * strength));
}


function snapshotCurrentLevel(): LevelSnapshot {
  return {
    level: activeLevel,
    spriteFile,
    spriteDataUrl,
    spriteName,
    spriteWorldWidth,
    anchorX: (Number(anchorXInput.value) || 0) / 100,
    anchorY: (Number(anchorYInput.value) || 0) / 100,
    footprint: [...footprint.values()].map((cell) => ({ ...cell })),
    blocked: [...blocked.values()].map((cell) => ({ ...cell })),
    entrance: entrance ? { ...entrance } : undefined,
  };
}

function storeActiveLevel(): void {
  levelSnapshots.set(activeLevel, snapshotCurrentLevel());
}

function visualLevelFromSnapshot(snapshot: LevelSnapshot): BuildingVisualLevel {
  return {
    level: snapshot.level,
    sprite: snapshot.spriteName,
    spriteAnchor: { x: snapshot.anchorX, y: snapshot.anchorY },
    spriteWorldWidth: snapshot.spriteWorldWidth,
    footprint: snapshot.footprint.map((cell) => ({ ...cell })),
    blocked: snapshot.blocked.map((cell) => ({ ...cell })),
    entrance: snapshot.entrance ?? { q: Number.NaN, r: Number.NaN },
  };
}

function definition(): BuildingVisualDefinition {
  storeActiveLevel();
  return {
    schema: "civilizations-building-visual",
    version: 4,
    id: idInput.value.trim(),
    levels: [...levelSnapshots.values()]
      .sort((a, b) => a.level - b.level)
      .map(visualLevelFromSnapshot),
  };
}

function errors(): string[] {
  storeActiveLevel();
  const missingSprites = [...levelSnapshots.values()]
    .filter((snapshot) => !snapshot.spriteFile)
    .map((snapshot) => "Stufe " + snapshot.level + ": Ein Sprite fehlt.");
  if (missingSprites.length) return missingSprites;
  return validateBuildingVisualDefinition(definition());
}

function refreshStatus(message?: string): boolean {
  const currentErrors = errors();
  status.classList.toggle("error", currentErrors.length > 0);
  status.textContent = message ?? (currentErrors.length
    ? currentErrors.join("\n")
    : "Stufe " + activeLevel + " bereit · " + footprint.size + " Grundrisszellen, " + blocked.size + " blockiert · " + roundedWorldWidth() + " Welt-px Sprite-Breite.");
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

const spriteMimeForName = (name: string): "image/png" | "image/webp" =>
  name.toLowerCase().endsWith(".webp") ? "image/webp" : "image/png";

const defaultSpriteName = (level: number, type = "image/png"): string =>
  "sprite-" + level + "." + (type === "image/webp" ? "webp" : "png");

async function loadSprite(
  file: File,
  preserveTransform = false,
  exportName?: string,
): Promise<void> {
  if (!SUPPORTED_IMAGE_TYPES.has(file.type)) {
    setError("Nur PNG und WebP werden unterstützt.");
    return;
  }
  spriteFile = file;
  spriteName = exportName ?? defaultSpriteName(activeLevel, file.type);
  spriteDataUrl = await fileToDataUrl(file);
  spritePreview.onload = () => {
    if (!preserveTransform) {
      anchorXInput.value = "50";
      anchorYInput.value = "82";
      const aspect = spritePreview.naturalWidth / spritePreview.naturalHeight;
      const fitWidth = Math.min(
        spritePreview.naturalWidth,
        720 / PREVIEW_SCALE,
        (520 / PREVIEW_SCALE) * aspect,
      );
      setWorldWidth(fitWidth);
    } else renderSpritePosition();
  };
  spritePreview.src = spriteDataUrl;
  spritePreview.hidden = false;
  dropzone.textContent = spriteName + " · " + Math.round(file.size / 1024) + " KB";
  storeActiveLevel();
  refreshStatus();
}

function refreshLevelSelect(): void {
  const levels = [...levelSnapshots.keys()].sort((a, b) => a - b);
  levelSelect.replaceChildren();
  for (const level of levels) {
    const option = document.createElement("option");
    option.value = String(level);
    option.textContent = "Stufe " + level;
    levelSelect.append(option);
  }
  levelSelect.value = String(activeLevel);
  const highest = levels.at(-1) ?? 1;
  removeLevelButton.disabled = levels.length <= 1 || activeLevel !== highest;
}

function clearWorkingLevel(level: number): void {
  activeLevel = level;
  spriteFile = undefined;
  spriteDataUrl = "";
  spriteName = defaultSpriteName(level);
  spriteWorldWidth = 60;
  spritePreview.onload = null;
  spritePreview.hidden = true;
  spritePreview.removeAttribute("src");
  dropzone.innerHTML = "PNG oder WebP hier hineinziehen<br />oder klicken";
  anchorXInput.value = "50";
  anchorYInput.value = "82";
  footprint.clear();
  blocked.clear();
  entrance = undefined;
  setWorldWidth(60, false);
  renderGrid();
}

function loadLevelSnapshot(level: number): void {
  const snapshot = levelSnapshots.get(level);
  if (!snapshot) return;
  activeLevel = level;
  spriteFile = snapshot.spriteFile;
  spriteDataUrl = snapshot.spriteDataUrl;
  spriteName = snapshot.spriteName;
  anchorXInput.value = String(Math.round(snapshot.anchorX * 1000) / 10);
  anchorYInput.value = String(Math.round(snapshot.anchorY * 1000) / 10);
  footprint.clear();
  blocked.clear();
  for (const cell of snapshot.footprint) footprint.set(cellKey(cell), { ...cell });
  for (const cell of snapshot.blocked) blocked.set(cellKey(cell), { ...cell });
  entrance = snapshot.entrance ? { ...snapshot.entrance } : undefined;
  setWorldWidth(snapshot.spriteWorldWidth, false);

  if (snapshot.spriteDataUrl && snapshot.spriteFile) {
    spritePreview.onload = renderSpritePosition;
    spritePreview.src = snapshot.spriteDataUrl;
    spritePreview.hidden = false;
    dropzone.textContent = snapshot.spriteName + " · " + Math.round(snapshot.spriteFile.size / 1024) + " KB";
  } else {
    spritePreview.onload = null;
    spritePreview.hidden = true;
    spritePreview.removeAttribute("src");
    dropzone.innerHTML = "PNG oder WebP hier hineinziehen<br />oder klicken";
  }
  refreshLevelSelect();
  renderGrid();
  refreshStatus();
}

function resetDefinitionState(id: string): void {
  levelSnapshots.clear();
  idInput.value = id;
  clearWorkingLevel(1);
  storeActiveLevel();
  refreshLevelSelect();
}

function setBuildingLoadNote(message?: string): void {
  buildingLoadNote.hidden = !message;
  buildingLoadNote.textContent = message ?? "";
}

async function snapshotsForDefinition(
  visualDefinition: BuildingVisualDefinition,
  fileForSprite: (sprite: string) => Promise<File>,
): Promise<Map<number, LevelSnapshot>> {
  const snapshots = new Map<number, LevelSnapshot>();
  for (const level of visualDefinition.levels) {
    const file = await fileForSprite(level.sprite);
    snapshots.set(level.level, {
      level: level.level,
      spriteFile: file,
      spriteDataUrl: await fileToDataUrl(file),
      spriteName: level.sprite,
      spriteWorldWidth: level.spriteWorldWidth,
      anchorX: level.spriteAnchor.x,
      anchorY: level.spriteAnchor.y,
      footprint: level.footprint.map((cell) => ({ ...cell })),
      blocked: level.blocked.map((cell) => ({ ...cell })),
      entrance: { ...level.entrance },
    });
  }
  return snapshots;
}

async function loadProjectBuilding(kind: BuildingVisualKind): Promise<void> {
  const entry = PROJECT_BUILDINGS.find((candidate) => candidate.kind === kind);
  if (!entry) {
    setError("Gebäude konnte im Projekt nicht gefunden werden.");
    return;
  }

  const placeholder = parsePlaceholderDefinition(entry.raw);
  if (placeholder) {
    resetDefinitionState(placeholder.id);
    setBuildingLoadNote(entry.label + ": Für dieses Gebäude existiert noch keine Konfiguration. Die ID wurde übernommen.");
    status.classList.remove("error");
    status.textContent = "Stufe 1 kann jetzt konfiguriert werden.";
    return;
  }

  const parsed = parseDefinition(entry.raw);
  const snapshots = await snapshotsForDefinition(parsed, async (sprite) => {
    const spritePath = Object.keys(PROJECT_SPRITE_MODULES).find(
      (path) => path.endsWith("/buildings/" + kind + "/" + sprite),
    );
    const spriteUrl = spritePath ? PROJECT_SPRITE_MODULES[spritePath] : undefined;
    if (!spriteUrl) throw new Error("Zum Projektgebäude " + entry.label + " fehlt das Sprite " + sprite + ".");
    const response = await fetch(spriteUrl);
    if (!response.ok) throw new Error("Sprite " + sprite + " für " + entry.label + " konnte nicht geladen werden.");
    const blob = await response.blob();
    return new File([blob], sprite, { type: spriteMimeForName(sprite) });
  });

  levelSnapshots.clear();
  for (const [level, snapshot] of snapshots) levelSnapshots.set(level, snapshot);
  idInput.value = parsed.id;
  setBuildingLoadNote();
  loadLevelSnapshot(parsed.levels[0]!.level);
  refreshStatus("Geladen: " + entry.label + " · " + parsed.levels.length + " Stufe" + (parsed.levels.length === 1 ? "" : "n"));
}

function syncProjectBuildingSelection(id: string): void {
  const match = PROJECT_BUILDINGS.find((entry) => {
    const placeholder = parsePlaceholderDefinition(entry.raw);
    if (placeholder) return placeholder.id === id || entry.kind === id;
    return parseDefinition(entry.raw).id === id || entry.kind === id;
  });
  buildingSelect.value = match?.kind ?? "";
}

async function importFiles(files: File[]): Promise<void> {
  try {
    const jsonFile = files.find((file) => file.name.toLowerCase().endsWith(".json"));
    if (!jsonFile) throw new Error("Zum Import fehlt building.json.");
    const parsed = parseDefinition(JSON.parse(await jsonFile.text()) as unknown);
    const snapshots = await snapshotsForDefinition(parsed, async (sprite) => {
      const imageFile = files.find((file) => file.name === sprite);
      if (!imageFile) throw new Error("Zum Import fehlt das Sprite " + sprite + ".");
      if (!SUPPORTED_IMAGE_TYPES.has(imageFile.type))
        throw new Error("Das Sprite " + sprite + " muss PNG oder WebP sein.");
      return imageFile;
    });

    levelSnapshots.clear();
    for (const [level, snapshot] of snapshots) levelSnapshots.set(level, snapshot);
    idInput.value = parsed.id;
    syncProjectBuildingSelection(parsed.id);
    setBuildingLoadNote();
    loadLevelSnapshot(parsed.levels[0]!.level);
    refreshStatus("Importiert: " + parsed.id + " · " + parsed.levels.length + " Stufe" + (parsed.levels.length === 1 ? "" : "n"));
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
  for (const snapshot of [...levelSnapshots.values()].sort((a, b) => a.level - b.level))
    if (snapshot.spriteFile) downloadBlob(snapshot.spriteFile, snapshot.spriteName);
  refreshStatus("Dateien werden heruntergeladen: building.json + " + value.levels.length + " Sprite" + (value.levels.length === 1 ? "" : "s") + ".");
});

saveProjectButton.addEventListener("click", async () => {
  if (!refreshStatus()) return;
  storeActiveLevel();
  saveProjectButton.disabled = true;
  try {
    const response = await fetch(import.meta.env.BASE_URL + "__building-editor/save", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        definition: definition(),
        sprites: [...levelSnapshots.values()]
          .sort((a, b) => a.level - b.level)
          .map((snapshot) => ({
            name: snapshot.spriteName,
            dataUrl: snapshot.spriteDataUrl,
          })),
        targetId: buildingSelect.value || undefined,
      }),
    });
    const result = await response.json() as { ok?: boolean; path?: string; error?: string };
    if (!response.ok || !result.ok) throw new Error(result.error ?? "Speichern fehlgeschlagen");
    refreshStatus("Gespeichert: " + result.path);
  } catch (error) {
    setError(error instanceof Error ? error.message : "Speichern fehlgeschlagen.");
  } finally {
    saveProjectButton.disabled = false;
  }
});

levelSelect.addEventListener("change", () => {
  storeActiveLevel();
  loadLevelSnapshot(Number(levelSelect.value));
});

addLevelButton.addEventListener("click", () => {
  storeActiveLevel();
  const previous = levelSnapshots.get(activeLevel)!;
  const nextLevel = Math.max(...levelSnapshots.keys()) + 1;
  const next: LevelSnapshot = {
    level: nextLevel,
    spriteDataUrl: "",
    spriteName: defaultSpriteName(nextLevel),
    spriteWorldWidth: previous.spriteWorldWidth,
    anchorX: previous.anchorX,
    anchorY: previous.anchorY,
    footprint: previous.footprint.map((cell) => ({ ...cell })),
    blocked: previous.blocked.map((cell) => ({ ...cell })),
    entrance: previous.entrance ? { ...previous.entrance } : undefined,
  };
  levelSnapshots.set(nextLevel, next);
  loadLevelSnapshot(nextLevel);
  refreshStatus("Stufe " + nextLevel + " angelegt. Grundriss und Ausrichtung wurden von Stufe " + previous.level + " übernommen; Sprite fehlt noch.");
});

removeLevelButton.addEventListener("click", () => {
  storeActiveLevel();
  const levels = [...levelSnapshots.keys()].sort((a, b) => a - b);
  const highest = levels.at(-1);
  if (levels.length <= 1 || highest !== activeLevel) return;
  levelSnapshots.delete(activeLevel);
  loadLevelSnapshot(levels.at(-2)!);
});


function selectTool(tool: Tool): void {
  finishCellPaint();
  currentTool = tool;
  document.querySelectorAll<HTMLButtonElement>("[data-tool]").forEach((candidate) => {
    candidate.classList.toggle("active", candidate.dataset.tool === tool);
  });
  renderGrid();
}

document.querySelectorAll<HTMLButtonElement>("[data-tool]").forEach((button) => {
  button.addEventListener("click", () => selectTool(button.dataset.tool as Tool));
});

scaleRange.addEventListener("input", () => setWorldWidth(Number(scaleRange.value)));
scaleNumber.addEventListener("input", () => {
  const width = Number(scaleNumber.value);
  if (Number.isFinite(width) && width > 0) setWorldWidth(width);
});
overlayRange.addEventListener("input", () => setOverlayStrength(Number(overlayRange.value)));

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
  if (!dragStart || !spritePreview.naturalWidth) return;
  const dx = event.clientX - dragStart.pointerX;
  const dy = event.clientY - dragStart.pointerY;
  const previewWidth = spriteWorldWidth * PREVIEW_SCALE;
  const previewHeight = previewWidth * (spritePreview.naturalHeight / spritePreview.naturalWidth);
  anchorXInput.value = String(Math.round((dragStart.anchorX - (dx / previewWidth) * 100) * 10) / 10);
  anchorYInput.value = String(Math.round((dragStart.anchorY - (dy / previewHeight) * 100) * 10) / 10);
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
window.addEventListener("pointerup", finishCellPaint);
window.addEventListener("pointercancel", finishCellPaint);
window.addEventListener("blur", finishCellPaint);

buildingSelect.addEventListener("change", () => {
  const kind = buildingSelect.value as BuildingVisualKind;
  if (!kind) {
    setBuildingLoadNote();
    return;
  }
  void loadProjectBuilding(kind).catch((error) => {
    setError(error instanceof Error ? error.message : "Projektgebäude konnte nicht geladen werden.");
  });
});

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

setOverlayStrength(Number(overlayRange.value));
resetDefinitionState("new-building");
refreshStatus();