import type {
  BuildableBuildingKind,
  Building,
  BuildingId,
  Good,
  Hex,
  Role,
  World,
} from "../simulation/model";
import {
  assigned,
  building,
  builders,
  changeAssignment,
  changeBuilders,
  changePopulation,
  changeWoodcutters,
  freePeople,
  GOODS,
  isUnderConstruction,
  setMerchantRoute,
  setRoad,
  status,
  tick,
  totalWarehouseStock,
  warehouseStock,
  woodcutters,
} from "../simulation/simulation";
import {
  buildWithFootprint,
  canPlaceBuilding,
  removeBuildingWithFootprint,
} from "../simulation/buildingPlacement";
import { CONFIG } from "../simulation/scenario";
import { same } from "../simulation/hex";

const SIMULATION_STEP_MS = 1000 / CONFIG.simulationHz;
const MAX_FRAME_DELTA_MS = 100;
const BUILDING_SELECTED_EVENT = "poc-building-selected";
const TILE_SELECTED_EVENT = "poc-tile-selected";
const BUILDING_SELECTION_REQUESTED_EVENT = "poc-building-selection-requested";
const SELECTION_CLEARED_EVENT = "poc-building-selection-cleared";
const MERCHANT_TARGET_MODE_EVENT = "poc-merchant-target-mode";
const BUILD_MODE_EVENT = "poc-build-mode";
const BUILD_POSITION_SELECTED_EVENT = "poc-build-position-selected";

type BuildingSelectedDetail = { id: BuildingId };
type TileSelectedDetail = { position: Hex };
type BuildPositionSelectedDetail = { position: Hex };
type SimulationSpeed = 0.5 | 1 | 2 | 3;

const BUILDING_NAMES: Record<BuildableBuildingKind, string> = {
  warehouse: "Lager",
  sawmill: "Sägewerk",
  carpenter: "Schreinerei",
};

export function mountControls(w: World, renderMap: () => void): void {
  const app = document.querySelector<HTMLDivElement>("#app")!;
  app.innerHTML = `<main><div id="game" role="img" aria-label="Fullscreen-Hex-Karte mit Hauptquartier, Waldflächen, Produktionsgebäuden und Lagern."></div><section class="overlay top-overlay"><div id="build-version" class="brand-chip">DAS ACHTE WELTWUNDER / POC 01</div><div id="metrics"></div></section><section class="overlay bottom-overlay"><aside id="selection-panel" class="selection-panel" hidden aria-live="polite"></aside><div id="merchant-target-overlay" class="merchant-target-overlay" hidden><div><small>HANDELSROUTE</small><strong>Ziellager wählen</strong><span>Helle Lager sind gültige Ziele. Verschieben und Zoomen ist weiterhin möglich.</span></div><button id="merchant-target-cancel" class="danger">Abbrechen</button></div><div id="build-placement-overlay" class="merchant-target-overlay" hidden><div><small>BAUMODUS</small><strong id="build-placement-title">Gebäude platzieren</strong><span><b>Tippen, um eine Position zu wählen.</b> Ziehen verschiebt die Karte. Grün ist gültig, rot blockiert.</span></div><div class="stepper"><button id="build-placement-confirm">Bauen</button><button id="build-placement-cancel" class="danger">Abbrechen</button></div></div><div class="bottom-bar"><div class="round-controls"><button id="autoplay" aria-pressed="true">Pausieren</button><div class="speed-control" role="group" aria-label="Simulationsgeschwindigkeit"><span>Tempo</span><div class="speed-buttons"><button type="button" data-sim-speed="0.5" aria-pressed="false">0,5×</button><button type="button" data-sim-speed="1" aria-pressed="true">1×</button><button type="button" data-sim-speed="2" aria-pressed="false">2×</button><button type="button" data-sim-speed="3" aria-pressed="false">3×</button></div></div></div><button id="debug-toggle" aria-pressed="false">Debug</button></div></section><section id="debug-panel" class="debug-panel" hidden><div class="debug-header"><strong>Personen und Transportaufträge</strong><button id="debug-close" aria-label="Debug schließen">×</button></div><div id="people"></div></section></main>`;

  let autoplayFrame: number | undefined;
  let lastAutoplayFrame = 0;
  let simulationBudget = 0;
  let simulationSpeed: SimulationSpeed = 1;
  let selectedBuildingId: BuildingId | undefined;
  let selectedTile: Hex | undefined;
  let merchantTargetSelection: number | undefined;
  let merchantSelectionWasRunning = false;
  let buildPlacementKind: BuildableBuildingKind | undefined;
  let buildPlacementPosition: Hex | undefined;

  const main = app.querySelector<HTMLElement>("main")!;
  const selectionPanel = document.querySelector<HTMLElement>("#selection-panel")!;
  const merchantTargetOverlay = document.querySelector<HTMLElement>("#merchant-target-overlay")!;
  const merchantTargetCancel = document.querySelector<HTMLButtonElement>("#merchant-target-cancel")!;
  const buildPlacementOverlay = document.querySelector<HTMLElement>("#build-placement-overlay")!;
  const buildPlacementConfirm = document.querySelector<HTMLButtonElement>("#build-placement-confirm")!;
  const buildPlacementCancel = document.querySelector<HTMLButtonElement>("#build-placement-cancel")!;
  const buildPlacementTitle = document.querySelector<HTMLElement>("#build-placement-title")!;
  const debugPanel = document.querySelector<HTMLElement>("#debug-panel")!;
  const debugToggle = document.querySelector<HTMLButtonElement>("#debug-toggle")!;

  const canRemovePopulation = () =>
    freePeople(w).some((p) => same(p.position, building(w, "hq").position));
  const roleLabel = (role: Role) =>
    role === "worker"
      ? "Arbeiter"
      : role === "carrier"
        ? "Träger"
        : role === "merchant"
          ? "Händler"
          : "Bauarbeiter";
  const roleLimit = (b: Building, role: Role): number => {
    if (isUnderConstruction(b)) return 0;
    if (role === "builder") return 0;
    if (role === "worker") return b.workers;
    if (role === "carrier") return b.carriers;
    return b.kind === "warehouse" ? (b.merchants ?? 0) : 0;
  };

  function updateBuildPlacementConfirm(): void {
    buildPlacementConfirm.disabled = !(
      buildPlacementKind &&
      buildPlacementPosition &&
      canPlaceBuilding(w, buildPlacementPosition, buildPlacementKind)
    );
  }

  const assignmentControl = (b: Building, role: Role, limit: number): string => {
    if (b.forestRemaining !== undefined || !limit) return "";
    const label = roleLabel(role);
    const detail = role === "merchant"
      ? "Handelsroute je Händler"
      : `<span data-field="${role}-active"></span> aktiv`;
    return `<div class="assignment"><div>${label}<small>${detail}</small></div><div class="stepper"><button data-action="assignment" data-building="${b.id}" data-role="${role}" data-delta="-1" aria-label="${b.name}: ${label} verringern">−</button><output data-field="${role}-count"></output><button data-action="assignment" data-building="${b.id}" data-role="${role}" data-delta="1" aria-label="${b.name}: ${label} erhöhen">+</button></div></div>`;
  };

  const merchantControls = (b: Building): string => {
    if (b.kind !== "warehouse" || isUnderConstruction(b)) return "";
    const merchants = assigned(w, b.id, "merchant");
    if (!merchants.length) return "";
    return `<div class="inventory">${merchants.map((p) => {
      const goodOptions = (Object.keys(GOODS) as Good[]).map((good) => `<option value="${good}" ${p.merchantRoute?.good === good ? "selected" : ""}>${GOODS[good]}</option>`).join("");
      const routeStatus = p.merchantRoute?.target ? "Ziel eingestellt" : "Kein Ziel eingestellt";
      return `<div><span>Händler ${p.id}</span><strong>${p.trip ? (p.trip.picked ? "unterwegs zum Ziel" : "holt Ware") : p.path.length ? "auf Rückweg" : routeStatus}</strong></div><label class="recipe">Ware <select data-route-good="${p.id}">${goodOptions}</select></label><div class="merchant-route-status"><span>Ziel</span><strong>${routeStatus}</strong></div><div class="stepper"><button data-action="merchant-map-target" data-person="${p.id}">Ziellager wählen</button></div>`;
    }).join("")}</div>`;
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

    const constructionPanelOpen = Boolean(
      selectionPanel.querySelector('[data-field="construction-progress"]'),
    );
    if (constructionPanelOpen && !isUnderConstruction(b)) {
      renderSelectionPanel();
      return;
    }

    setField("status", status(w, b));
    if (b.kind === "hq") {
      setField("population-count", String(w.people.length));
      setField("free-count", String(freePeople(w).length));
      setField("woodcutter-count", String(woodcutters(w).length));
      setField("builder-pool-count", String(builders(w).length));
      const populationMinus = selectionPanel.querySelector<HTMLButtonElement>('button[data-action="population"][data-delta="-1"]');
      const woodcutterMinus = selectionPanel.querySelector<HTMLButtonElement>('button[data-action="woodcutter"][data-delta="-1"]');
      const woodcutterPlus = selectionPanel.querySelector<HTMLButtonElement>('button[data-action="woodcutter"][data-delta="1"]');
      const builderMinus = selectionPanel.querySelector<HTMLButtonElement>('button[data-action="builder-pool"][data-delta="-1"]');
      const builderPlus = selectionPanel.querySelector<HTMLButtonElement>('button[data-action="builder-pool"][data-delta="1"]');
      if (populationMinus) populationMinus.disabled = !canRemovePopulation();
      if (woodcutterMinus) woodcutterMinus.disabled = woodcutters(w).length === 0;
      if (woodcutterPlus) woodcutterPlus.disabled = freePeople(w).length === 0;
      if (builderMinus) builderMinus.disabled = builders(w).length === 0;
      if (builderPlus) builderPlus.disabled = freePeople(w).length === 0;
      return;
    }

    if (b.forestRemaining !== undefined) {
      setField("forest-remaining", String(b.forestRemaining));
      setField("output", `${b.output}/${CONFIG.outputCapacity}`);
      return;
    }

    if (isUnderConstruction(b)) {
      for (const good of Object.keys(b.construction!.required) as Good[]) {
        setField(
          `construction-${good}`,
          `${b.construction!.delivered[good] ?? 0}/${b.construction!.required[good] ?? 0}`,
        );
      }
      setField("builder-count", `${assigned(w, b.id, "builder").length}/2`);
      setField(
        "construction-progress",
        `${Math.round((b.construction!.progress / b.construction!.duration) * 100)} %`,
      );
    } else if (b.kind === "warehouse") {
      setField("warehouse-wood", `${warehouseStock(b, "wood")}/${CONFIG.warehouseCapacityPerGood}`);
      setField("warehouse-plank", `${warehouseStock(b, "plank")}/${CONFIG.warehouseCapacityPerGood}`);
      setField("warehouse-tool", `${warehouseStock(b, "woodenTool")}/${CONFIG.warehouseCapacityPerGood}`);
    } else {
      if (b.recipe?.input) setField("input", `${b.input}/${CONFIG.inputCapacity}`);
      setField("output", `${b.output}/${CONFIG.outputCapacity}`);
    }

    for (const role of ["worker", "carrier", "merchant"] as const) {
      const limit = roleLimit(b, role);
      if (!limit) continue;
      const people = assigned(w, b.id, role);
      if (role !== "merchant")
        setField(`${role}-active`, String(people.filter((p) => p.active).length));
      setField(`${role}-count`, `${people.length}/${limit}`);
      const minus = selectionPanel.querySelector<HTMLButtonElement>(`button[data-action="assignment"][data-role="${role}"][data-delta="-1"]`);
      const plus = selectionPanel.querySelector<HTMLButtonElement>(`button[data-action="assignment"][data-role="${role}"][data-delta="1"]`);
      if (minus) minus.disabled = people.length === 0;
      if (plus) plus.disabled = people.length >= limit || freePeople(w).length === 0;
    }
  };

  function renderSelectionPanel(): void {
    if (buildPlacementKind || merchantTargetSelection !== undefined) {
      selectionPanel.hidden = true;
      return;
    }

    if (selectedTile) {
      const tile = w.tiles.find((candidate) => same(candidate, selectedTile!));
      if (!tile) {
        selectedTile = undefined;
        selectionPanel.hidden = true;
        return;
      }
      const buildable = tile.terrain === "grass" || tile.terrain === "road";
      const roadAction = tile.terrain === "grass"
        ? `<button data-action="road" data-enabled="true">Weg bauen</button>`
        : tile.terrain === "road"
          ? `<button data-action="road" data-enabled="false" ${w.people.some((p) => same(p.position, tile)) ? "disabled" : ""}>Weg entfernen</button>`
          : "";
      selectionPanel.hidden = false;
      selectionPanel.innerHTML = `<div class="selection-title"><div><small>KACHEL</small><h3>${tile.terrain === "grass" ? "Wiese" : tile.terrain === "road" ? "Weg" : tile.terrain === "forest" ? "Wald" : tile.terrain === "mountain" ? "Berg" : tile.terrain === "river" ? "Fluss" : "Belegt"}</h3></div><button data-action="close" class="selection-close" aria-label="Auswahl schließen">×</button></div>${buildable ? `<p class="recipe">Gebäude wählen. Danach Position auf der Karte wählen und bestätigen.</p><div class="stepper"><button data-action="build" data-kind="warehouse">Lager</button><button data-action="build" data-kind="sawmill">Sägewerk</button><button data-action="build" data-kind="carpenter">Schreinerei</button></div>` : `<p class="recipe">Auf dieser Kachel kann aktuell nicht gebaut werden.</p>`}${roadAction ? `<div class="stepper">${roadAction}</div>` : ""}`;
      return;
    }

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
    if (b.kind === "hq") {
      selectionPanel.innerHTML = `<div class="selection-title"><div><small>GLOBAL</small><h3>${b.name}</h3></div><button data-action="close" class="selection-close" aria-label="Auswahl schließen">×</button></div><p class="recipe">Sammelpunkt und globale Personalsteuerung</p><div class="assignment"><div>Bevölkerung<small><span data-field="free-count"></span> frei</small></div><div class="stepper"><button data-action="population" data-delta="-1">−</button><output data-field="population-count"></output><button data-action="population" data-delta="1">+</button></div></div><div class="assignment"><div>Holzfäller<small>Jeder sucht selbständig einen freien Wald</small></div><div class="stepper"><button data-action="woodcutter" data-delta="-1">−</button><output data-field="woodcutter-count"></output><button data-action="woodcutter" data-delta="1">+</button></div></div><div class="assignment"><div>Bauarbeiter<small>Werden automatisch auf Baustellen verteilt</small></div><div class="stepper"><button data-action="builder-pool" data-delta="-1">−</button><output data-field="builder-pool-count"></output><button data-action="builder-pool" data-delta="1">+</button></div></div><p class="status" data-field="status"></p>`;
      updateSelectionLiveState();
      return;
    }

    const demolish = b.kind === "forest"
      ? ""
      : `<button data-action="demolish" class="danger">Abreißen</button>`;

    if (isUnderConstruction(b)) {
      const materials = (Object.keys(b.construction!.required) as Good[])
        .map((good) => `<div><span>${GOODS[good]}</span><strong data-field="construction-${good}"></strong></div>`)
        .join("");
      selectionPanel.innerHTML = `<div class="selection-title"><div><small>BAUSTELLE</small><h3>${b.name}</h3></div><button data-action="close" class="selection-close" aria-label="Auswahl schließen">×</button></div><p class="recipe">Bauarbeiter werden automatisch aus dem globalen Pool zugewiesen. Zwei Bauarbeiter bauen doppelt so schnell.</p><div class="inventory"><div><span>Bauarbeiter</span><strong data-field="builder-count"></strong></div>${materials}<div><span>Baufortschritt</span><strong data-field="construction-progress"></strong></div></div><p class="status" data-field="status"></p>${demolish}`;
      updateSelectionLiveState();
      return;
    }

    const recipe = b.forestRemaining !== undefined
      ? `1 Holz / ${b.recipe!.duration / CONFIG.simulationHz} s bei 1× · Vorrat <span data-field="forest-remaining"></span>/${CONFIG.forestYield}`
      : b.kind === "warehouse"
        ? "Lagert bis zu 20 Einheiten je Warentyp"
        : b.recipe?.input
          ? `${b.recipe.amount} ${GOODS[b.recipe.input]} → 1 ${GOODS[b.recipe.output]}`
          : "Produktion";
    const inventory = b.forestRemaining !== undefined
      ? `<div><span>Holz · Output</span><strong data-field="output"></strong></div>`
      : b.kind === "warehouse"
        ? `<div><span>Holz</span><strong data-field="warehouse-wood"></strong></div><div><span>Bretter</span><strong data-field="warehouse-plank"></strong></div><div><span>Holzwerkzeuge</span><strong data-field="warehouse-tool"></strong></div>`
        : `${b.recipe?.input ? `<div><span>${GOODS[b.recipe.input]} · Input</span><strong data-field="input"></strong></div>` : ""}<div><span>${b.recipe ? GOODS[b.recipe.output] : "Output"} · Output</span><strong data-field="output"></strong></div>`;
    const merchantAssignment = b.kind === "warehouse"
      ? assignmentControl(b, "merchant", b.merchants ?? 0)
      : "";

    selectionPanel.innerHTML = `<div class="selection-title"><div><small>GEBÄUDE</small><h3>${b.name}</h3></div><button data-action="close" class="selection-close" aria-label="Auswahl schließen">×</button></div><p class="recipe">${recipe}</p>${assignmentControl(b, "worker", b.workers)}${assignmentControl(b, "carrier", b.carriers)}${merchantAssignment}<div class="inventory">${inventory}</div>${merchantControls(b)}<p class="status" data-field="status"></p>${demolish}`;
    updateSelectionLiveState();
  }

  const refreshLiveState = () => {
    document.querySelector("#metrics")!.innerHTML = `<div><small>BEV.</small><strong>${w.people.length}</strong></div><div><small>FREI</small><strong>${freePeople(w).length}</strong></div><div><small>WERKZEUGE</small><strong>${totalWarehouseStock(w, "woodenTool")}</strong></div>`;
    if (!selectedTile) updateSelectionLiveState();
    updateBuildPlacementConfirm();
    renderMap();
  };

  const refreshPanels = () => {
    renderSelectionPanel();
    document.querySelector("#people")!.innerHTML = `<table><thead><tr><th>Person</th><th>Zuweisung</th><th>Zustand / Fracht</th></tr></thead><tbody>${w.people.map((p) => `<tr><td>${p.id}</td><td>${p.woodcutter ? (p.assignment ? `Holzfäller · ${building(w, p.assignment.building).name}` : "Holzfäller · wartet auf Wald") : p.builder ? (p.assignment ? `Bauarbeiter · ${building(w, p.assignment.building).name}` : "Bauarbeiter · wartet auf Baustelle") : p.assignment ? `${building(w, p.assignment.building).name} · ${roleLabel(p.assignment.role)}` : "Frei"}</td><td>${p.trip ? `${p.trip.picked ? "Bringt" : "Holt"} ${GOODS[p.trip.good]} · ${building(w, p.trip.picked ? p.trip.target : p.trip.source).name}` : p.assignment?.role === "merchant" && p.merchantRoute?.target ? `${GOODS[p.merchantRoute.good]} → Ziellager${p.path.length ? " · Rückweg" : ""}` : p.progress ? `${p.woodcutter ? "Fällt Holz" : p.builder ? "Baut" : "Produziert"} · ${Math.round((p.progress / (p.assignment && isUnderConstruction(building(w, p.assignment.building)) ? building(w, p.assignment.building).construction!.duration : CONFIG.duration)) * 100)} %` : p.path.length ? (p.assignment ? "Auf dem Weg zur Arbeitsstätte" : p.woodcutter ? "Sucht / wartet auf Wald" : p.builder ? "Sucht / wartet auf Baustelle" : "Auf dem Rückweg zum HQ") : p.assignment ? "An der Arbeitsstätte" : p.woodcutter ? "Wartet auf Wald" : p.builder ? "Wartet auf Baustelle" : "Am HQ"}</td></tr>`).join("")}</tbody></table>`;
  };

  const refresh = () => {
    refreshLiveState();
    refreshPanels();
  };

  const autoplayButton = document.querySelector("#autoplay") as HTMLButtonElement;
  const speedButtons = Array.from(document.querySelectorAll<HTMLButtonElement>("[data-sim-speed]"));
  const isRunning = () => autoplayFrame !== undefined;

  const setSimulationSpeed = (speed: SimulationSpeed) => {
    simulationSpeed = speed;
    for (const button of speedButtons)
      button.setAttribute("aria-pressed", String(Number(button.dataset.simSpeed) === speed));
  };

  const stopAutoplay = () => {
    if (autoplayFrame !== undefined) window.cancelAnimationFrame(autoplayFrame);
    autoplayFrame = undefined;
    lastAutoplayFrame = 0;
    simulationBudget = 0;
    autoplayButton.textContent = "Fortsetzen";
    autoplayButton.setAttribute("aria-pressed", "false");
  };

  const startAutoplay = () => {
    if (autoplayFrame !== undefined) window.cancelAnimationFrame(autoplayFrame);
    lastAutoplayFrame = 0;
    simulationBudget = 0;
    const frame = (timestamp: number) => {
      if (!lastAutoplayFrame) lastAutoplayFrame = timestamp;
      const delta = Math.min(timestamp - lastAutoplayFrame, MAX_FRAME_DELTA_MS);
      lastAutoplayFrame = timestamp;
      simulationBudget += delta * simulationSpeed;
      let changed = false;
      let steps = 0;
      while (
        simulationBudget + 1e-9 >= SIMULATION_STEP_MS &&
        steps < CONFIG.simulationHz
      ) {
        tick(w);
        simulationBudget -= SIMULATION_STEP_MS;
        changed = true;
        steps++;
      }
      if (changed) refreshLiveState();
      autoplayFrame = window.requestAnimationFrame(frame);
    };
    autoplayButton.textContent = "Pausieren";
    autoplayButton.setAttribute("aria-pressed", "true");
    autoplayFrame = window.requestAnimationFrame(frame);
  };

  const setDebugOpen = (open: boolean) => {
    debugPanel.hidden = !open;
    debugToggle.setAttribute("aria-pressed", String(open));
  };

  const leaveBuildPlacementMode = () => {
    if (!buildPlacementKind) return;
    buildPlacementKind = undefined;
    buildPlacementPosition = undefined;
    main.classList.remove("merchant-target-mode");
    buildPlacementOverlay.hidden = true;
    buildPlacementConfirm.disabled = true;
    window.dispatchEvent(new CustomEvent(BUILD_MODE_EVENT, { detail: { active: false } }));
    renderSelectionPanel();
  };

  const enterBuildPlacementMode = (kind: BuildableBuildingKind) => {
    buildPlacementKind = kind;
    buildPlacementPosition = undefined;
    selectedTile = undefined;
    selectedBuildingId = undefined;
    setDebugOpen(false);
    main.classList.add("merchant-target-mode");
    buildPlacementTitle.textContent = `${BUILDING_NAMES[kind]} platzieren`;
    buildPlacementOverlay.hidden = false;
    updateBuildPlacementConfirm();
    window.dispatchEvent(new CustomEvent(BUILD_MODE_EVENT, {
      detail: { active: true, kind },
    }));
    renderSelectionPanel();
  };

  const confirmBuildPlacement = () => {
    if (!buildPlacementKind || !buildPlacementPosition) return;
    const created = buildWithFootprint(w, buildPlacementPosition, buildPlacementKind);
    if (!created) {
      updateBuildPlacementConfirm();
      renderMap();
      return;
    }
    leaveBuildPlacementMode();
    selectedTile = undefined;
    selectedBuildingId = created.id;
    window.dispatchEvent(new CustomEvent(BUILDING_SELECTION_REQUESTED_EVENT, {
      detail: { id: created.id },
    }));
    refresh();
  };

  const leaveMerchantTargetMode = () => {
    if (merchantTargetSelection === undefined) return;
    merchantTargetSelection = undefined;
    main.classList.remove("merchant-target-mode");
    merchantTargetOverlay.hidden = true;
    window.dispatchEvent(new CustomEvent(MERCHANT_TARGET_MODE_EVENT, {
      detail: { active: false },
    }));
    renderSelectionPanel();
    if (merchantSelectionWasRunning) startAutoplay();
    merchantSelectionWasRunning = false;
  };

  const enterMerchantTargetMode = (personId: number) => {
    const merchant = w.people.find((p) => p.id === personId);
    const sourceId = merchant?.assignment?.role === "merchant"
      ? merchant.assignment.building
      : undefined;
    if (!merchant || !sourceId) return;
    merchantSelectionWasRunning = isRunning();
    if (merchantSelectionWasRunning) stopAutoplay();
    merchantTargetSelection = personId;
    setDebugOpen(false);
    main.classList.add("merchant-target-mode");
    merchantTargetOverlay.hidden = false;
    window.dispatchEvent(new CustomEvent(MERCHANT_TARGET_MODE_EVENT, {
      detail: { active: true, sourceId },
    }));
    renderSelectionPanel();
  };

  autoplayButton.addEventListener("click", () => {
    if (!isRunning()) startAutoplay();
    else {
      stopAutoplay();
      refresh();
    }
  });
  for (const button of speedButtons) {
    button.addEventListener("click", () => {
      setSimulationSpeed(Number(button.dataset.simSpeed) as SimulationSpeed);
    });
  }
  debugToggle.addEventListener("click", () => setDebugOpen(debugPanel.hidden));
  document.querySelector("#debug-close")!.addEventListener("click", () => setDebugOpen(false));
  merchantTargetCancel.addEventListener("click", leaveMerchantTargetMode);
  buildPlacementConfirm.addEventListener("click", confirmBuildPlacement);
  buildPlacementCancel.addEventListener("click", leaveBuildPlacementMode);

  selectionPanel.addEventListener("change", (event) => {
    const select = event.target as HTMLSelectElement;
    if (select.dataset.routeGood) {
      const personId = Number(select.dataset.routeGood);
      const p = w.people.find((person) => person.id === personId);
      setMerchantRoute(w, personId, p?.merchantRoute?.target, select.value as Good);
      refresh();
    }
  });

  selectionPanel.addEventListener("click", (event) => {
    const button = (event.target as HTMLElement).closest<HTMLButtonElement>("button[data-action]");
    if (!button || button.disabled) return;
    const action = button.dataset.action;
    if (action === "close") {
      selectedBuildingId = undefined;
      selectedTile = undefined;
      renderSelectionPanel();
      window.dispatchEvent(new CustomEvent(SELECTION_CLEARED_EVENT));
      return;
    }
    if (action === "merchant-map-target") {
      enterMerchantTargetMode(Number(button.dataset.person));
      return;
    }
    if (action === "build") {
      enterBuildPlacementMode(button.dataset.kind as BuildableBuildingKind);
      return;
    }
    if (action === "road" && selectedTile) {
      setRoad(w, selectedTile, button.dataset.enabled === "true");
      refresh();
      return;
    }
    if (action === "demolish" && selectedBuildingId) {
      const selected = w.buildings.find((b) => b.id === selectedBuildingId);
      if (
        selected &&
        window.confirm(`${selected.name} wirklich abreißen? Gelagerte Waren gehen verloren.`)
      ) {
        removeBuildingWithFootprint(w, selectedBuildingId);
        selectedBuildingId = undefined;
        window.dispatchEvent(new CustomEvent(SELECTION_CLEARED_EVENT));
        refresh();
      }
      return;
    }
    const delta = Number(button.dataset.delta) as 1 | -1;
    if (action === "population") changePopulation(w, delta);
    if (action === "woodcutter") changeWoodcutters(w, delta);
    if (action === "builder-pool") changeBuilders(w, delta);
    if (action === "assignment")
      changeAssignment(
        w,
        button.dataset.building as BuildingId,
        button.dataset.role as Role,
        delta,
      );
    refresh();
  });

  window.addEventListener(BUILD_POSITION_SELECTED_EVENT, (event) => {
    if (!buildPlacementKind) return;
    buildPlacementPosition = { ...(event as CustomEvent<BuildPositionSelectedDetail>).detail.position };
    updateBuildPlacementConfirm();
    renderMap();
  });

  window.addEventListener(BUILDING_SELECTED_EVENT, (event) => {
    if (buildPlacementKind) return;
    const id = (event as CustomEvent<BuildingSelectedDetail>).detail.id;
    if (merchantTargetSelection !== undefined) {
      const merchant = w.people.find((p) => p.id === merchantTargetSelection);
      const sourceId = merchant?.assignment?.building;
      const target = w.buildings.find((b) => b.id === id);
      if (
        merchant &&
        sourceId &&
        target?.kind === "warehouse" &&
        !isUnderConstruction(target) &&
        id !== sourceId
      ) {
        setMerchantRoute(w, merchant.id, id, merchant.merchantRoute?.good);
        leaveMerchantTargetMode();
        selectedTile = undefined;
        selectedBuildingId = sourceId;
        window.dispatchEvent(new CustomEvent(BUILDING_SELECTION_REQUESTED_EVENT, {
          detail: { id: sourceId },
        }));
        refresh();
      }
      return;
    }
    selectedTile = undefined;
    selectedBuildingId = id;
    renderSelectionPanel();
  });

  window.addEventListener(TILE_SELECTED_EVENT, (event) => {
    if (merchantTargetSelection !== undefined || buildPlacementKind) return;
    selectedBuildingId = undefined;
    selectedTile = (event as CustomEvent<TileSelectedDetail>).detail.position;
    renderSelectionPanel();
  });

  refresh();
  startAutoplay();
}
