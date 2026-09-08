import type { Building, BuildingId, Role, World } from "../simulation/model";
import {
  assigned,
  building,
  changeAssignment,
  changePopulation,
  changeWoodcutters,
  freePeople,
  GOODS,
  status,
  tick,
  woodcutters,
} from "../simulation/simulation";
import { CONFIG } from "../simulation/scenario";
import { same } from "../simulation/hex";

const MAX_PRESENTATION_FPS = 60;
const PRESENTATION_INTERVAL_MS = 1000 / MAX_PRESENTATION_FPS;
const BUILDING_SELECTED_EVENT = "poc-building-selected";

type BuildingSelectedDetail = { id: BuildingId };

export function mountControls(w: World, renderMap: () => void): void {
  const app = document.querySelector<HTMLDivElement>("#app")!;
  app.innerHTML = `<main><div id="game" role="img" aria-label="Fullscreen-Hex-Karte mit Hauptquartier, Waldflächen, Sägewerk, Schreinerei und Lager."></div><section class="overlay top-overlay"><div id="build-version" class="brand-chip">DAS ACHTE WELTWUNDER / POC 01</div><div id="metrics"></div></section><section class="overlay bottom-overlay"><aside id="selection-panel" class="selection-panel" hidden aria-live="polite"></aside><div class="bottom-bar"><div class="round-controls"><button id="next" class="primary">Runde +1</button><button id="autoplay" aria-pressed="false">Autolauf starten</button><label class="speed-control">FPS <input id="fps" type="range" min="1" max="10" step="1" value="1" aria-label="Autolauf in Runden pro Sekunde"><output id="fps-value">1 FPS</output></label><button id="max-fps" aria-pressed="false">Max FPS</button></div><button id="debug-toggle" aria-pressed="false">Debug</button></div></section><section id="debug-panel" class="debug-panel" hidden><div class="debug-header"><strong>Personen und Transportaufträge</strong><button id="debug-close" aria-label="Debug schließen">×</button></div><div id="people"></div></section></main>`;

  let autoplayTimer: number | undefined;
  let autoplayFrame: number | undefined;
  let presentationFrame: number | undefined;
  let lastPresentationFrame = 0;
  let presentationBudget = PRESENTATION_INTERVAL_MS;
  let presentationDirty = true;
  let selectedBuildingId: BuildingId | undefined;

  const selectionPanel = document.querySelector<HTMLElement>("#selection-panel")!;
  const debugPanel = document.querySelector<HTMLElement>("#debug-panel")!;
  const debugToggle = document.querySelector<HTMLButtonElement>("#debug-toggle")!;

  const canRemovePopulation = () =>
    freePeople(w).some((p) => same(p.position, building(w, "hq").position));

  const assignmentControl = (b: Building, role: Role, limit: number): string => {
    if (b.forestRemaining !== undefined || !limit) return "";
    const roleLabel = role === "worker" ? "Arbeiter" : "Träger";
    return `<div class="assignment"><div>${roleLabel}<small><span data-field="${role}-active"></span> aktiv</small></div><div class="stepper"><button data-action="assignment" data-building="${b.id}" data-role="${role}" data-delta="-1" aria-label="${b.name}: ${roleLabel} verringern">−</button><output data-field="${role}-count"></output><button data-action="assignment" data-building="${b.id}" data-role="${role}" data-delta="1" aria-label="${b.name}: ${roleLabel} erhöhen">+</button></div></div>`;
  };

  const setField = (name: string, value: string) => {
    const field = selectionPanel.querySelector<HTMLElement>(`[data-field="${name}"]`);
    if (field) field.textContent = value;
  };

  const updateSelectionLiveState = () => {
    if (!selectedBuildingId || selectionPanel.hidden) return;
    const b = w.buildings.find((candidate) => candidate.id === selectedBuildingId);
    if (!b || b.retired) {
      selectedBuildingId = undefined;
      renderSelectionPanel();
      return;
    }

    setField("status", status(w, b));

    if (b.id === "hq") {
      setField("population-count", String(w.people.length));
      setField("free-count", String(freePeople(w).length));
      setField("woodcutter-count", String(woodcutters(w).length));
      const populationMinus = selectionPanel.querySelector<HTMLButtonElement>('button[data-action="population"][data-delta="-1"]');
      const woodcutterMinus = selectionPanel.querySelector<HTMLButtonElement>('button[data-action="woodcutter"][data-delta="-1"]');
      const woodcutterPlus = selectionPanel.querySelector<HTMLButtonElement>('button[data-action="woodcutter"][data-delta="1"]');
      if (populationMinus) populationMinus.disabled = !canRemovePopulation();
      if (woodcutterMinus) woodcutterMinus.disabled = woodcutters(w).length === 0;
      if (woodcutterPlus) woodcutterPlus.disabled = freePeople(w).length === 0;
      return;
    }

    if (b.forestRemaining !== undefined) {
      setField("forest-remaining", String(b.forestRemaining));
      setField("output", `${b.output}/${CONFIG.outputCapacity}`);
      return;
    }

    if (b.recipe?.input) setField("input", `${b.input}/${CONFIG.inputCapacity}`);
    setField("output", `${b.output}/${b.recipe ? CONFIG.outputCapacity : "∞"}`);

    for (const role of ["worker", "carrier"] as const) {
      const limit = role === "worker" ? b.workers : b.carriers;
      if (!limit) continue;
      const people = assigned(w, b.id, role);
      setField(`${role}-active`, String(people.filter((p) => p.active).length));
      setField(`${role}-count`, `${people.length}/${limit}`);
      const minus = selectionPanel.querySelector<HTMLButtonElement>(`button[data-action="assignment"][data-role="${role}"][data-delta="-1"]`);
      const plus = selectionPanel.querySelector<HTMLButtonElement>(`button[data-action="assignment"][data-role="${role}"][data-delta="1"]`);
      if (minus) minus.disabled = people.length === 0;
      if (plus) plus.disabled = people.length >= limit || freePeople(w).length === 0;
    }
  };

  function renderSelectionPanel(): void {
    if (!selectedBuildingId) {
      selectionPanel.hidden = true;
      selectionPanel.innerHTML = "";
      return;
    }

    const b = w.buildings.find((candidate) => candidate.id === selectedBuildingId);
    if (!b || b.retired) {
      selectedBuildingId = undefined;
      selectionPanel.hidden = true;
      selectionPanel.innerHTML = "";
      return;
    }

    selectionPanel.hidden = false;

    if (b.id === "hq") {
      selectionPanel.innerHTML = `<div class="selection-title"><div><small>GLOBAL</small><h3>${b.name}</h3></div><button data-action="close" class="selection-close" aria-label="Auswahl schließen">×</button></div><p class="recipe">Sammelpunkt und globale Personalsteuerung</p><div class="assignment"><div>Bevölkerung<small><span data-field="free-count"></span> frei</small></div><div class="stepper"><button data-action="population" data-delta="-1" aria-label="Bevölkerung verringern">−</button><output data-field="population-count"></output><button data-action="population" data-delta="1" aria-label="Bevölkerung erhöhen">+</button></div></div><div class="assignment"><div>Holzfäller<small>Jeder sucht selbständig einen freien Wald</small></div><div class="stepper"><button data-action="woodcutter" data-delta="-1" aria-label="Holzfäller verringern">−</button><output data-field="woodcutter-count"></output><button data-action="woodcutter" data-delta="1" aria-label="Holzfäller erhöhen">+</button></div></div><p class="status" data-field="status"></p>`;
      updateSelectionLiveState();
      return;
    }

    const recipe = b.forestRemaining !== undefined
      ? `1 Holz / ${CONFIG.duration} Runden · Vorrat <span data-field="forest-remaining"></span>/${CONFIG.forestYield}`
      : b.recipe?.input
        ? `${b.recipe.amount} ${GOODS[b.recipe.input]} → 1 ${GOODS[b.recipe.output]}`
        : b.recipe
          ? "Produktion"
          : "Sammelt fertige Holzwerkzeuge";

    const inventory = b.forestRemaining !== undefined
      ? `<div><span>Holz · Output</span><strong data-field="output"></strong></div>`
      : `${b.recipe?.input ? `<div><span>${GOODS[b.recipe.input]} · Input</span><strong data-field="input"></strong></div>` : ""}<div><span>${b.recipe ? GOODS[b.recipe.output] : "Holzwerkzeuge"} · ${b.recipe ? "Output" : "Bestand"}</span><strong data-field="output"></strong></div>`;

    selectionPanel.innerHTML = `<div class="selection-title"><div><small>GEBÄUDE</small><h3>${b.name}</h3></div><button data-action="close" class="selection-close" aria-label="Auswahl schließen">×</button></div><p class="recipe">${recipe}</p>${assignmentControl(b, "worker", b.workers)}${assignmentControl(b, "carrier", b.carriers)}<div class="inventory">${inventory}</div><p class="status" data-field="status"></p>`;
    updateSelectionLiveState();
  }

  const refreshLiveState = () => {
    document.querySelector("#metrics")!.innerHTML = `<div><small>RUNDE</small><strong>${w.round}</strong></div><div><small>BEV.</small><strong>${w.people.length}</strong></div><div><small>FREI</small><strong>${freePeople(w).length}</strong></div><div><small>WERKZEUGE</small><strong>${building(w, "warehouse").output}</strong></div>`;
    updateSelectionLiveState();
    renderMap();
  };

  const refreshPanels = () => {
    renderSelectionPanel();
    document.querySelector("#people")!.innerHTML = `<table><thead><tr><th>Person</th><th>Zuweisung</th><th>Zustand / Fracht</th></tr></thead><tbody>${w.people.map((p) => `<tr><td>${p.id}</td><td>${p.woodcutter ? (p.assignment ? `Holzfäller · ${building(w, p.assignment.building).name}` : "Holzfäller · wartet auf Wald") : p.assignment ? `${building(w, p.assignment.building).name} · ${p.assignment.role === "worker" ? "Arbeiter" : "Träger"}` : "Frei"}</td><td>${p.trip ? `${p.trip.picked ? "Bringt" : "Holt"} ${GOODS[p.trip.good]} · ${building(w, p.trip.picked ? p.trip.target : p.trip.source).name}` : p.progress ? `${p.woodcutter ? "Fällt Holz" : "Produziert"} · ${p.progress}/5` : p.path.length ? (p.assignment ? "Auf dem Weg zur Arbeitsstätte" : p.woodcutter ? "Sucht / wartet auf Wald" : "Auf dem Rückweg zum HQ") : p.assignment ? "An der Arbeitsstätte" : p.woodcutter ? "Wartet auf Wald" : "Am HQ"}</td></tr>`).join("")}</tbody></table>`;
  };

  const refresh = () => {
    refreshLiveState();
    refreshPanels();
    presentationDirty = false;
  };

  const runRound = () => {
    tick(w);
    refresh();
  };

  const autoplayButton = document.querySelector("#autoplay") as HTMLButtonElement;
  const fpsInput = document.querySelector("#fps") as HTMLInputElement;
  const fpsValue = document.querySelector("#fps-value") as HTMLOutputElement;
  const maxFpsButton = document.querySelector("#max-fps") as HTMLButtonElement;
  const isRunning = () => autoplayTimer !== undefined || autoplayFrame !== undefined;
  const markPresentationDirty = () => { presentationDirty = true; };

  const stopPresentationLoop = () => {
    if (presentationFrame !== undefined) window.cancelAnimationFrame(presentationFrame);
    presentationFrame = undefined;
    lastPresentationFrame = 0;
    presentationBudget = PRESENTATION_INTERVAL_MS;
  };

  const startPresentationLoop = () => {
    stopPresentationLoop();
    presentationDirty = true;
    const frame = (timestamp: number) => {
      if (!isRunning()) {
        presentationFrame = undefined;
        return;
      }
      if (lastPresentationFrame) presentationBudget += Math.min(timestamp - lastPresentationFrame, PRESENTATION_INTERVAL_MS * 2);
      lastPresentationFrame = timestamp;
      if (presentationDirty && presentationBudget >= PRESENTATION_INTERVAL_MS) {
        refreshLiveState();
        presentationDirty = false;
        presentationBudget %= PRESENTATION_INTERVAL_MS;
      }
      presentationFrame = window.requestAnimationFrame(frame);
    };
    presentationFrame = window.requestAnimationFrame(frame);
  };

  const stopAutoplay = () => {
    if (autoplayTimer !== undefined) window.clearInterval(autoplayTimer);
    if (autoplayFrame !== undefined) window.cancelAnimationFrame(autoplayFrame);
    autoplayTimer = undefined;
    autoplayFrame = undefined;
    stopPresentationLoop();
    autoplayButton.textContent = "Autolauf starten";
    autoplayButton.setAttribute("aria-pressed", "false");
  };

  const startAutoplay = () => {
    stopAutoplay();
    if (maxFpsButton.getAttribute("aria-pressed") === "true") {
      const frame = () => {
        tick(w);
        markPresentationDirty();
        autoplayFrame = window.requestAnimationFrame(frame);
      };
      autoplayFrame = window.requestAnimationFrame(frame);
    } else {
      autoplayTimer = window.setInterval(() => {
        tick(w);
        markPresentationDirty();
      }, 1000 / Number(fpsInput.value));
    }
    autoplayButton.textContent = "Autolauf pausieren";
    autoplayButton.setAttribute("aria-pressed", "true");
    startPresentationLoop();
  };

  const updateFps = () => {
    if (maxFpsButton.getAttribute("aria-pressed") !== "true") fpsValue.value = `${fpsInput.value} FPS`;
    if (isRunning()) startAutoplay();
  };

  const setDebugOpen = (open: boolean) => {
    debugPanel.hidden = !open;
    debugToggle.setAttribute("aria-pressed", String(open));
  };

  document.querySelector("#next")!.addEventListener("click", runRound);
  autoplayButton.addEventListener("click", () => {
    if (!isRunning()) startAutoplay();
    else {
      stopAutoplay();
      refresh();
    }
  });
  fpsInput.addEventListener("input", updateFps);
  maxFpsButton.addEventListener("click", () => {
    const wasRunning = isRunning();
    const enabled = maxFpsButton.getAttribute("aria-pressed") !== "true";
    maxFpsButton.setAttribute("aria-pressed", String(enabled));
    fpsInput.disabled = enabled;
    fpsValue.value = enabled ? "MAX" : `${fpsInput.value} FPS`;
    if (wasRunning) startAutoplay();
  });
  debugToggle.addEventListener("click", () => setDebugOpen(debugPanel.hidden));
  document.querySelector("#debug-close")!.addEventListener("click", () => setDebugOpen(false));

  selectionPanel.addEventListener("click", (event) => {
    const button = (event.target as HTMLElement).closest<HTMLButtonElement>("button[data-action]");
    if (!button || button.disabled) return;
    const action = button.dataset.action;
    if (action === "close") {
      selectedBuildingId = undefined;
      renderSelectionPanel();
      window.dispatchEvent(new CustomEvent("poc-building-selection-cleared"));
      return;
    }
    const delta = Number(button.dataset.delta) as 1 | -1;
    if (action === "population") changePopulation(w, delta);
    if (action === "woodcutter") changeWoodcutters(w, delta);
    if (action === "assignment") changeAssignment(w, button.dataset.building as BuildingId, button.dataset.role as Role, delta);
    refresh();
  });

  window.addEventListener(BUILDING_SELECTED_EVENT, (event) => {
    const detail = (event as CustomEvent<BuildingSelectedDetail>).detail;
    selectedBuildingId = detail.id;
    renderSelectionPanel();
  });

  refresh();
}
