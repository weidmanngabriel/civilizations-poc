import type {
  BuildableBuildingKind,
  Building,
  BuildingId,
  Good,
  Hex,
  HouseLevel,
  PlaceableBuildingKind,
  Role,
  WaypostId,
  World,
} from "../simulation/model";
import {
  assigned,
  building,
  changePopulation,
  freePeople,
  GOODS,
  isUnderConstruction,
  setBuildingRecipe,
  setMerchantRoute,
  setRoad,
  status,
  tick,
  notifyConstructionSiteAdded,
  totalWarehouseStock,
  warehouseStock,
} from "../simulation/simulation";
import {
  currentProfession,
  PROFESSION_LABELS,
  professionExperience,
} from "../simulation/experience";
import { personName } from "../simulation/personIdentity";
import { personActivityLabel } from "../personPresentation";
import {
  buildWithFootprint,
  canPlaceBuilding,
  canUpgradeBuilding,
  removeBuildingWithFootprint,
  startBuildingUpgrade,
  upgradePlacementBlockers,
} from "../simulation/buildingPlacement";
import { CONFIG } from "../simulation/scenario";
import { EDUCATION_DURATION_TICKS } from "../simulation/education";
import { normalizeSimulationSpeed } from "../simulation/timing";
import { same } from "../simulation/hex";
import { canPlaceWaypost, removeWaypost, wayposts } from "../simulation/wayposts";
import { orderScoutWaypost } from "../simulation/scouting";
import { performanceNow, performanceProfiler } from "../debug/performanceProfiler";
import { RUNTIME_CRASH_EVENT } from "../runtime/crashReporter";
import { BUILDING_SVG, GOOD_ICONS, buildingIcon } from "../icons";
import { confirmDialog } from "./modalDialog";
import { buildingUpgradeRule } from "../simulation/buildingUpgradeRules";
import { isBuildingUnlocked, maxProfessionExperience } from "../simulation/technology";
import {
  isMaterialCheatEnabled,
  isTechnologyCheatEnabled,
  setMaterialCheatEnabled,
  setTechnologyCheatEnabled,
} from "../simulation/debugCheats";
import {
  createPalisadeSites,
  palisadeNewSegmentCount,
  palisadePlanningTileAvailable,
  planPalisadePath,
} from "../simulation/palisades";
import {
  houseApartmentCount,
  houseLevel,
  houseUpgradeCost,
  householdsForHouse,
  nextHouseLevel,
} from "../simulation/housing";
import { BIRTH_POLICY_RULES, setBirthPolicy } from "../simulation/family";

const SIMULATION_STEP_MS = 1000 / CONFIG.simulationHz;
const MAX_FRAME_DELTA_MS = 100;
const BUILDING_SELECTED_EVENT = "poc-building-selected";
const TILE_SELECTED_EVENT = "poc-tile-selected";
const BUILDING_SELECTION_REQUESTED_EVENT = "poc-building-selection-requested";
const SELECTION_CLEARED_EVENT = "poc-building-selection-cleared";
const MERCHANT_TARGET_MODE_EVENT = "poc-merchant-target-mode";
const BUILD_MODE_EVENT = "poc-build-mode";
const BUILD_POSITION_SELECTED_EVENT = "poc-build-position-selected";
const WAYPOST_PLACEMENT_REQUESTED_EVENT = "poc-waypost-placement-requested";
const WAYPOST_SELECTED_EVENT = "poc-waypost-selected";
const PERSON_SELECTION_REQUESTED_EVENT = "poc-person-selection-requested";
const PERSON_STAFF_PICKER_REQUESTED_EVENT = "poc-person-staff-picker-requested";
const WORLD_REPLACED_EVENT = "poc-world-replaced";
const UPGRADE_PREVIEW_EVENT = "poc-upgrade-preview";
const HANDBOOK_VISIBILITY_EVENT = "poc-handbook-visibility";

type BuildingSelectedDetail = { id: BuildingId };
type WaypostSelectedDetail = { id: WaypostId };
type TileSelectedDetail = { position: Hex };
type BuildPositionSelectedDetail = { position: Hex; chosen?: boolean };
type SimulationSpeed = number;

const BUILDING_NAMES: Record<BuildableBuildingKind, string> = {
  warehouse: "Lager",
  farm: "Farm",
  sawmill: "Sägewerk",
  carpenter: "Schreinerei",
  mill: "Mühle",
  bakery: "Bäckerei",
  well: "Brunnen",
  pottery: "Töpferei",
  pottery2: "Töpferei 2",
  stonemason: "Steinmetzhütte",
  stonemason2: "Steinmetzhütte 2",
  tailor: "Näherei",
  livestockBreeder: "Viehzüchterei",
  school: "Schule",
};

const SORTED_BUILDING_KINDS = (Object.keys(BUILDING_NAMES) as BuildableBuildingKind[])
  .sort((a, b) => BUILDING_NAMES[a].localeCompare(BUILDING_NAMES[b], "de"));

const formatOutputAmount = (value: number): string => value.toFixed(1).replace(".", ",");
const formatWholeAmount = (value: number): string => String(Math.round(value));
const escapeHtml = (value: string): string =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

export function mountControls(w: World, renderMap: () => void): void {
  const app = document.querySelector<HTMLDivElement>("#app")!;
  app.innerHTML = `<main><div id="game" role="img" aria-label="Fullscreen-Hex-Karte mit Hauptquartier, Waldflächen, Farmen, Produktionsgebäuden und Lagern."></div><section class="overlay top-overlay"><div id="build-version" class="brand-chip">DAS ACHTE WELTWUNDER / POC 01</div><div id="metrics"></div></section><section class="overlay bottom-overlay"><aside id="selection-panel" class="selection-panel" hidden aria-live="polite"></aside><div id="merchant-target-overlay" class="merchant-target-overlay" hidden><div><small>HANDELSROUTE</small><strong>Ziellager wählen</strong><span>Helle Lager sind gültige Ziele. Verschieben und Zoomen ist weiterhin möglich.</span></div><button id="merchant-target-cancel" class="danger">Abbrechen</button></div><div id="build-placement-overlay" class="merchant-target-overlay" hidden><div><small>BAUMODUS</small><strong id="build-placement-title">Gebäude platzieren</strong><span id="build-placement-copy"><b>Tippen, um eine Position zu wählen.</b> Ziehen verschiebt die Karte. Grün ist gültig, rot blockiert.</span></div><div class="stepper"><button id="build-placement-confirm">Bauen</button><button id="build-placement-cancel" class="danger">Abbrechen</button></div></div><div id="upgrade-preview-overlay" class="merchant-target-overlay" hidden><div><small>AUSBAUPRÜFUNG</small><strong>Blockaden für den Ausbau</strong><span id="upgrade-preview-summary"></span></div><button id="upgrade-preview-close">Zurück</button></div><div class="bottom-bar"><div class="round-controls"><button id="autoplay" aria-pressed="true">Pausieren</button><div class="speed-control" role="group" aria-label="Simulationsgeschwindigkeit"><span>Tempo</span><div class="speed-buttons"><button type="button" data-sim-speed="0.5" aria-pressed="false">0,5×</button><button type="button" data-sim-speed="1" aria-pressed="true">1×</button><button type="button" data-sim-speed="2" aria-pressed="false">2×</button><button type="button" data-sim-speed="3" aria-pressed="false">3×</button></div><label class="custom-speed"><span>Frei</span><input id="custom-sim-speed" type="number" min="1" max="9" step="1" inputmode="numeric" value="1" placeholder="1–9" aria-label="Benutzerdefiniertes Simulationstempo von 1 bis 9"></label></div></div><button id="debug-toggle" aria-pressed="false">Debug</button></div></section><section id="debug-panel" class="debug-panel" hidden><div class="debug-header"><strong>Personen und Transportaufträge</strong><button id="debug-close" aria-label="Debug schließen">×</button></div><div class="debug-cheat-controls"><strong>Cheats</strong><div class="debug-cheat-buttons"><button type="button" data-debug-cheat="technologies" aria-pressed="false">Technologien: AUS</button><button type="button" data-debug-cheat="materials" aria-pressed="false">Materialien: AUS</button></div><small>Nur für die aktuelle Sitzung; bestehende Baustellen bleiben unverändert.</small></div><div id="people"></div></section></main>`;

  let autoplayFrame: number | undefined;
  let lastAutoplayFrame = 0;
  let simulationBudget = 0;
  let simulationSpeed: SimulationSpeed = normalizeSimulationSpeed(w.simulationSpeed ?? 1);
  w.simulationSpeed = simulationSpeed;
  let selectedBuildingId: BuildingId | undefined;
  let selectedWaypostId: WaypostId | undefined;
  let selectedTile: Hex | undefined;
  let merchantTargetSelection: number | undefined;
  let merchantSelectionWasRunning = false;
  let handbookWasRunning = false;
  let buildPlacementKind: PlaceableBuildingKind | "waypost" | "palisade" | undefined;
  let buildPlacementHouseLevel: HouseLevel | undefined;
  let buildPlacementPosition: Hex | undefined;
  let palisadeStart: Hex | undefined;
  let palisadePreview: Hex[] = [];
  let waypostScoutId: number | undefined;
  let upgradePreviewBuildingId: BuildingId | undefined;

  const main = app.querySelector<HTMLElement>("main")!;
  const selectionPanel = document.querySelector<HTMLElement>("#selection-panel")!;
  const merchantTargetOverlay = document.querySelector<HTMLElement>("#merchant-target-overlay")!;
  const merchantTargetCancel = document.querySelector<HTMLButtonElement>("#merchant-target-cancel")!;
  const buildPlacementOverlay = document.querySelector<HTMLElement>("#build-placement-overlay")!;
  const buildPlacementConfirm = document.querySelector<HTMLButtonElement>("#build-placement-confirm")!;
  const upgradePreviewOverlay = document.querySelector<HTMLElement>("#upgrade-preview-overlay")!;
  const upgradePreviewSummary = document.querySelector<HTMLElement>("#upgrade-preview-summary")!;
  const upgradePreviewClose = document.querySelector<HTMLButtonElement>("#upgrade-preview-close")!;
  const buildPlacementCancel = document.querySelector<HTMLButtonElement>("#build-placement-cancel")!;
  const buildPlacementTitle = document.querySelector<HTMLElement>("#build-placement-title")!;
  const debugPanel = document.querySelector<HTMLElement>("#debug-panel")!;
  const debugToggle = document.querySelector<HTMLButtonElement>("#debug-toggle")!;
  const technologyCheatButton = debugPanel.querySelector<HTMLButtonElement>('[data-debug-cheat="technologies"]')!;
  const materialCheatButton = debugPanel.querySelector<HTMLButtonElement>('[data-debug-cheat="materials"]')!;

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
  const workerLabel = (b: Building) =>
    b.kind === "farm" ? "Farmer"
      : b.kind === "sawmill" ? "Sägewerker"
        : b.kind === "carpenter" ? "Schreiner"
          : b.kind === "mill" ? "Müller"
            : b.kind === "bakery" ? "Bäcker"
              : b.kind === "pottery" ? "Töpfer"
                : b.kind === "stonemason" ? "Steinmetz"
                  : b.kind === "livestockBreeder" ? "Viehzüchter"
                    : "Arbeiter";
  const buildingHeading = (b: Building) => `${buildingIcon(b.kind)}<span>${b.name}</span>`;
  const buildingWikiButton = (b: Building) => b.kind === "field"
    ? ""
    : `<button type="button" class="selection-wiki-link wiki-link" data-wiki-building="${b.kind}" aria-label="Wiki: ${b.name}">?</button>`;
  const goodLabel = (good: Good) => `<button type="button" class="good-label wiki-link" data-wiki-good="${good}"><span aria-hidden="true">${GOOD_ICONS[good]}</span><span>${GOODS[good]}</span></button>`;
  const personIcon = (personId: number) => {
    const p = w.people.find((candidate) => candidate.id === personId);
    if (!p) return "👤";
    if (p.woodcutter) return "🪓";
    if (p.fisher) return "🎣";
    if (currentProfession(w, p) === "scout") return "🧭";
    if (p.extractor === "clay") return "🟤";
    if (p.extractor === "stone") return "⛏️";
    if (p.builder) return "🔨";
    if (p.assignment?.role === "merchant") return "🧭";
    if (p.assignment?.role === "carrier") return "📦";
    if (p.assignment?.role === "worker") {
      const workplace = w.buildings.find((candidate) => candidate.id === p.assignment!.building);
      if (workplace?.kind === "farm") return "🌾";
      if (workplace?.kind === "mill") return "⚙️";
      if (workplace?.kind === "bakery") return "🍞";
      if (workplace?.kind === "sawmill") return "🪵";
      if (workplace?.kind === "carpenter") return "🛠️";
      if (workplace?.kind === "pottery") return "🧱";
      if (workplace?.kind === "stonemason") return "🪨";
      if (workplace?.kind === "livestockBreeder") return "🐄";
    }
    return "👤";
  };

  const schoolLesson = (school: Building) => {
    const student = w.people.find(
      (person) =>
        person.educationTask?.role === "student" &&
        person.educationTask.schoolId === school.id,
    );
    if (!student?.educationTask) return undefined;

    const task = student.educationTask;
    const teacher = w.people.find((person) => person.id === task.partnerId);
    const progress = Math.max(
      0,
      Math.min(100, Math.round((task.progressTicks / EDUCATION_DURATION_TICKS) * 100)),
    );

    let state = "Unterricht pausiert";
    if (!teacher) state = "Unterricht wird beendet";
    else if (student.hungerState) state = "Pausiert – Schüler isst";
    else if (student.sleepState) state = "Pausiert – Schüler schläft";
    else if (teacher.hungerState) state = "Pausiert – Lehrer isst";
    else if (teacher.sleepState) state = "Pausiert – Lehrer schläft";
    else {
      const studentHere = same(student.position, school.position);
      const teacherHere = same(teacher.position, school.position);
      if (!studentHere && !teacherHere) state = "Wartet auf Lehrer und Schüler";
      else if (!studentHere) state = "Wartet auf Schüler";
      else if (!teacherHere) state = "Wartet auf Lehrer";
      else if (task.active) state = "Unterricht läuft";
    }

    return { student, teacher, task, progress, state };
  };

  function updateBuildPlacementConfirm(): void {
    const newPalisadeSegments = palisadeNewSegmentCount(w, palisadePreview);
    buildPlacementConfirm.disabled = !(
      buildPlacementKind &&
      buildPlacementPosition &&
      (buildPlacementKind === "palisade"
        ? newPalisadeSegments > 0
        : buildPlacementKind === "waypost"
          ? Boolean(
              waypostScoutId !== undefined &&
              w.people.some((person) =>
                person.id === waypostScoutId && currentProfession(w, person) === "scout"
              ) &&
              canPlaceWaypost(w, buildPlacementPosition)
            )
          : canPlaceBuilding(
              w,
              buildPlacementPosition,
              buildPlacementKind,
              buildPlacementKind === "house"
                ? { houseLevel: buildPlacementHouseLevel ?? 1 }
                : undefined,
            ))
    );
    if (buildPlacementKind === "palisade") {
      const copy = document.querySelector<HTMLElement>("#build-placement-copy");
      if (copy) {
        copy.innerHTML = palisadeStart
          ? `<b>Ziel wählen oder verschieben.</b> ${palisadePreview.length} Schritte · ${newPalisadeSegments} neue Palisaden · ${newPalisadeSegments} Holz · maximal 50 Schritte.`
          : "<b>Startpunkt wählen.</b> Grün markiert den gültigen Wegweiserbereich; bestehende Palisaden sind als Startpunkt erlaubt.";
      }
    }
  }

  const staffSection = (b: Building, role: Role, limit: number): string => {
    if (b.kind === "field" || !limit) return "";
    const label = role === "worker" ? workerLabel(b) : roleLabel(role);
    const people = assigned(w, b.id, role);
    const occupied = people.map((person) => `
      <button class="staff-person" type="button" data-action="staff-person" data-person="${person.id}">
        <span class="staff-person-icon" aria-hidden="true">${personIcon(person.id)}</span>
        <span class="staff-person-copy">
          <strong>${escapeHtml(personName(person.id))}</strong>
          <small data-field="staff-activity-${person.id}">${escapeHtml(personActivityLabel(person))}</small>
        </span>
        <span class="staff-person-open" aria-hidden="true">›</span>
      </button>`).join("");
    const openSlots = Math.max(0, limit - people.length);
    const empty = Array.from({ length: openSlots }, () => `
      <button class="staff-person staff-person--empty" type="button" data-action="staff-candidates" data-building="${b.id}" data-role="${role}">
        <span class="staff-person-icon staff-person-icon--empty" aria-hidden="true">+</span>
        <span class="staff-person-copy">
          <strong>Geeignete Personen</strong>
          <small>Platz frei · Person direkt zuweisen</small>
        </span>
        <span class="staff-person-open" aria-hidden="true">›</span>
      </button>`).join("");
    return `<section class="staff-group">
      <div class="staff-group-title"><strong>${label}</strong><span>${people.length}/${limit}</span></div>
      <div class="staff-list">${occupied}${empty}</div>
    </section>`;
  };

  const upgradeBlockerLabel = (blocker: ReturnType<typeof upgradePlacementBlockers>[number]): string => {
    if (blocker.kind === "building") {
      const other = w.buildings.find((candidate) => candidate.id === blocker.id);
      return other?.name ?? "Gebäude";
    }
    if (blocker.kind === "resource")
      return blocker.detail === "forest" ? "Baum/Wald" : blocker.detail === "clay" ? "Lehmvorkommen" : "Steinvorkommen";
    if (blocker.kind === "terrain")
      return blocker.detail === "river" ? "Fluss" : blocker.detail === "mountain" ? "Berg" : "ungeeignetes Gelände";
    if (blocker.kind === "looseGood")
      return blocker.detail && blocker.detail in GOODS ? `lose Ware: ${GOODS[blocker.detail as Good]}` : "lose Ware";
    if (blocker.kind === "person") return `Bewohner ${blocker.id}`;
    if (blocker.kind === "waypost") return "Wegweiser";
    return "außerhalb des Wegweiserradius";
  };

  const upgradeControls = (b: Building): string => {
    if (isUnderConstruction(b)) return "";
    if (b.kind === "house") {
      const target = nextHouseLevel(b);
      const required = houseUpgradeCost(b);
      if (!target || !required) return "";
      const costs = (Object.entries(required) as [Good, number][])
        .map(([good, amount]) => `${GOOD_ICONS[good]} ${amount} ${GOODS[good]}`)
        .join(" + ");
      return `<section class="upgrade-card"><strong>Ausbau zu Wohnhaus ${target}</strong><p class="recipe">${costs}</p><button data-action="upgrade" ${canUpgradeBuilding(w, b) ? "" : "disabled"}>Ausbauen</button></section>`;
    }

    const rule = buildingUpgradeRule(b.kind);
    if (!rule) return "";
    const unlocked = isBuildingUnlocked(w, rule.to);
    const xp = maxProfessionExperience(w, rule.profession);
    const costs = (Object.entries(rule.required) as [Good, number][])
      .map(([good, amount]) => `${GOOD_ICONS[good]} ${amount} ${GOODS[good]}`)
      .join(" + ");
    if (!unlocked)
      return `<section class="upgrade-card"><strong>Ausbau zu ${BUILDING_NAMES[rule.to]}</strong><p class="recipe">${PROFESSION_LABELS[rule.profession]}: ${Math.min(rule.threshold, xp)}/${rule.threshold} XP erforderlich</p></section>`;

    const blockers = upgradePlacementBlockers(w, b);
    if (blockers.length)
      return `<section class="upgrade-card"><strong>Ausbau zu ${BUILDING_NAMES[rule.to]}</strong><p class="recipe">${costs}</p><button data-action="upgrade-blockers">Ausbau blockiert · ${blockers.length} Hindernis${blockers.length === 1 ? "" : "se"} anzeigen</button></section>`;

    return `<section class="upgrade-card"><strong>Ausbau zu ${BUILDING_NAMES[rule.to]}</strong><p class="recipe">${costs}</p><button data-action="upgrade" ${canUpgradeBuilding(w, b) ? "" : "disabled"}>Ausbauen</button></section>`;
  };

  const recipeControls = (b: Building): string => {
    if (!b.availableRecipes?.length) return "";
    const switchBlocked = b.output > 1e-9 || assigned(w, b.id, "worker").some((person) => person.progress > 1e-9);
    const options = b.availableRecipes
      .filter((recipe) => recipe.output)
      .map((recipe) => `<option value="${recipe.output}" ${b.recipe?.output === recipe.output ? "selected" : ""}>${GOOD_ICONS[recipe.output!]} ${GOODS[recipe.output!]}</option>`)
      .join("");
    return `<label class="recipe">Produktion <select data-building-recipe="${b.id}" ${switchBlocked ? "disabled" : ""}>${options}</select></label>${switchBlocked ? '<p class="recipe">Rezeptwechsel ist möglich, sobald die laufende Produktion und der aktuelle Output abgeschlossen sind.</p>' : ""}`;
  };

  const renderUpgradePreview = (): void => {
    if (!upgradePreviewBuildingId) return;
    const source = w.buildings.find((candidate) => candidate.id === upgradePreviewBuildingId && !candidate.retired);
    if (!source) {
      upgradePreviewBuildingId = undefined;
      upgradePreviewOverlay.hidden = true;
      window.dispatchEvent(new CustomEvent(UPGRADE_PREVIEW_EVENT, { detail: { active: false } }));
      return;
    }
    const blockers = upgradePlacementBlockers(w, source);
    const labels = [...new Set(blockers.map(upgradeBlockerLabel))];
    upgradePreviewSummary.textContent = blockers.length
      ? `${blockers.length} Hindernis${blockers.length === 1 ? "" : "se"}: ${labels.join(", ")}. Blockierende Gebäude kannst du direkt auf der Karte anklicken.`
      : "Der Platz ist jetzt frei. Kehre zum Gebäude zurück und starte den Ausbau.";
  };

  const merchantControls = (b: Building): string => {
    if (b.kind !== "warehouse" || isUnderConstruction(b)) return "";
    const merchants = assigned(w, b.id, "merchant");
    if (!merchants.length) return "";
    return `<div class="inventory">${merchants.map((p) => {
      const goodOptions = (Object.keys(GOODS) as Good[]).map((good) => `<option value="${good}" ${p.merchantRoute?.good === good ? "selected" : ""}>${GOOD_ICONS[good]} ${GOODS[good]}</option>`).join("");
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
    if (b.kind === "school" && !isUnderConstruction(b)) {
      const lesson = schoolLesson(b);
      setField("school-progress", lesson ? `${lesson.progress} %` : "—");
      setField(
        "school-profession",
        lesson ? PROFESSION_LABELS[lesson.task.profession] : "—",
      );
      setField(
        "school-teacher",
        lesson?.teacher ? personName(lesson.teacher.id) : "—",
      );
      setField("school-student", lesson ? personName(lesson.student.id) : "—");
      setField("school-state", lesson?.state ?? "Kein Unterricht");
      return;
    }
    if (b.kind === "hq") {
      setField("population-count", String(w.people.length));
      setField("free-count", String(freePeople(w).length));
      const populationMinus = selectionPanel.querySelector<HTMLButtonElement>('button[data-action="population"][data-delta="-1"]');
      if (populationMinus) populationMinus.disabled = !canRemovePopulation();
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
      for (const good of Object.keys(GOODS) as Good[])
        setField(`warehouse-${good}`, `${formatWholeAmount(warehouseStock(b, good))}/${CONFIG.warehouseCapacityPerGood}`);
    } else {
    const recipeInputs = b.recipe?.inputs
        ? (Object.keys(b.recipe.inputs) as Good[])
        : b.recipe?.input
          ? [b.recipe.input]
          : [];
      for (const good of recipeInputs) {
        const amount = b.recipe?.inputs ? (b.inputInventory?.[good] ?? 0) : b.input;
        setField(`input-${good}`, `${formatWholeAmount(amount)}/${CONFIG.inputCapacity}`);
      }
      setField("output", `${formatOutputAmount(b.output)}/${CONFIG.outputCapacity}`);
    }

    for (const role of ["worker", "carrier", "merchant"] as const) {
      for (const person of assigned(w, b.id, role))
        setField(`staff-activity-${person.id}`, personActivityLabel(person));
    }
  };

  function renderSelectionPanel(): void {
    if (buildPlacementKind || merchantTargetSelection !== undefined) {
      selectionPanel.hidden = true;
      return;
    }

    if (selectedWaypostId) {
      const selectedWaypost = wayposts(w).find((post) => post.id === selectedWaypostId);
      if (!selectedWaypost) {
        selectedWaypostId = undefined;
        selectionPanel.hidden = true;
        selectionPanel.innerHTML = "";
        return;
      }
      selectionPanel.hidden = false;
      selectionPanel.innerHTML = `<div class="selection-title"><div><small>WEGWEISER</small><h3>🪧 Wegweiser</h3></div><button data-action="close" class="selection-close" aria-label="Auswahl schließen">×</button></div><p class="recipe">Lokaler Zugang zum übergeordneten Wegenetz · ${selectedWaypost.connections?.length ?? 0} direkte Verbindungen</p><button data-action="demolish-waypost" class="danger">Abreißen</button>`;
      return;
    }

    if (selectedTile) {
      const tile = w.tiles.find((candidate) => same(candidate, selectedTile!));
      if (!tile) {
        selectedTile = undefined;
        selectionPanel.hidden = true;
        return;
      }
      const naturalResource = w.naturalResources.find(
        (resource) => !resource.depleted && same(resource.position, tile),
      );
      const buildable = !naturalResource && (tile.terrain === "grass" || tile.terrain === "road");
      const roadAction = naturalResource
        ? ""
        : tile.terrain === "grass"
        ? `<button data-action="road" data-enabled="true">Weg bauen</button>`
        : tile.terrain === "road"
          ? `<button data-action="road" data-enabled="false" ${w.people.some((p) => same(p.position, tile)) ? "disabled" : ""}>Weg entfernen</button>`
          : "";
      const tileName = naturalResource?.kind === "clay"
        ? "Lehmvorkommen"
        : naturalResource?.kind === "stone"
          ? "Steinvorkommen"
          : naturalResource?.kind === "forest"
            ? "Wald"
            : tile.terrain === "grass"
        ? "Wiese"
        : tile.terrain === "road"
          ? "Weg"
          : tile.terrain === "forest"
            ? "Wald"
            : tile.terrain === "field"
              ? "Acker"
              : tile.terrain === "mountain"
                ? "Berg"
                : tile.terrain === "river"
                  ? "Fluss"
                  : "Belegt";
      selectionPanel.hidden = false;
      selectionPanel.innerHTML = `<div class="selection-title"><div><small>KACHEL</small><h3>${tileName}</h3></div><button data-action="close" class="selection-close" aria-label="Auswahl schließen">×</button></div>${buildable ? `<p class="recipe">Gebäude wählen. Danach Position auf der Karte wählen und bestätigen.</p><div class="stepper build-choice-grid">${SORTED_BUILDING_KINDS.map((kind) => `<button class="icon-button" data-action="build" data-kind="${kind}">${buildingIcon(kind)}<span>${BUILDING_NAMES[kind]}</span></button>`).join("")}</div>` : `<p class="recipe">Auf dieser Kachel kann aktuell nicht gebaut werden.</p>`}${roadAction ? `<div class="stepper">${roadAction}</div>` : ""}`;
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
      const birthPolicy = w.birthPolicy ?? "medium";
      const birthPolicyButtons = (["low", "medium", "high"] as const)
        .map((policy) => `<button data-action="birth-policy" data-policy="${policy}" ${birthPolicy === policy ? "disabled" : ""}>${BIRTH_POLICY_RULES[policy].label}</button>`)
        .join("");
      selectionPanel.innerHTML = `<div class="selection-title"><div><small>GLOBAL</small><h3 class="building-heading">${buildingHeading(b)}</h3></div><div class="selection-title-actions">${buildingWikiButton(b)}<button data-action="close" class="selection-close" aria-label="Auswahl schließen">×</button></div></div><p class="recipe">Sammelpunkt. Berufe und Arbeitsplätze werden direkt an einzelnen Bewohnern zugewiesen.</p><div class="assignment"><div>Bevölkerung<small><span data-field="free-count"></span> ohne Beruf</small></div><div class="stepper"><button data-action="population" data-delta="-1">−</button><output data-field="population-count"></output><button data-action="population" data-delta="1">+</button></div></div><section class="upgrade-card"><strong>Nachwuchs</strong><p class="recipe">Steuert, wie häufig verheiratete Paare mit gemeinsamer Wohnung selbständig Nachwuchs bekommen.</p><div class="stepper">${birthPolicyButtons}</div></section><div class="building-staff">${staffSection(b, "carrier", b.carriers)}</div><p class="status" data-field="status"></p>`;
      updateSelectionLiveState();
      return;
    }

    const demolish = b.kind === "field"
      ? ""
      : `<button data-action="demolish" class="danger">Abreißen</button>`;

    if (isUnderConstruction(b)) {
      const materials = (Object.keys(b.construction!.required) as Good[])
        .map((good) => `<div><span>${goodLabel(good)}</span><strong data-field="construction-${good}"></strong></div>`)
        .join("");
      selectionPanel.innerHTML = `<div class="selection-title"><div><small>BAUSTELLE</small><h3 class="building-heading">${buildingHeading(b)}</h3></div><div class="selection-title-actions">${buildingWikiButton(b)}<button data-action="close" class="selection-close" aria-label="Auswahl schließen">×</button></div></div><p class="recipe">Bauarbeiter werden automatisch aus dem globalen Pool zugewiesen. Erfahrung erhöht den persönlichen Baufortschritt bis auf das Doppelte.</p><div class="inventory"><div><span>Bauarbeiter</span><strong data-field="builder-count"></strong></div>${materials}<div><span>Baufortschritt</span><strong data-field="construction-progress"></strong></div></div><p class="status" data-field="status"></p>${demolish}`;
      updateSelectionLiveState();
      return;
    }

    if (b.kind === "house") {
      const level = houseLevel(b);
      const capacity = houseApartmentCount(b);
      const householdByApartment = new Map(
        householdsForHouse(w, b.id).map((household) => [household.apartmentIndex, household]),
      );
      const apartments = Array.from({ length: capacity }, (_, apartmentIndex) => {
        const household = householdByApartment.get(apartmentIndex);
        if (!household)
          return `<div class="staff-person staff-person--empty"><span class="staff-person-icon staff-person-icon--empty" aria-hidden="true">🏠</span><span class="staff-person-copy"><strong>Wohnung ${apartmentIndex + 1}</strong><small>Frei</small></span></div>`;
        const members = household.memberIds
          .map((personId) => w.people.find((person) => person.id === personId))
          .filter((person): person is NonNullable<typeof person> => Boolean(person));
        const memberButtons = members.length
          ? members.map((person) => `<button type="button" class="staff-person" data-action="household-person" data-person="${person.id}"><span class="staff-person-icon" aria-hidden="true">👤</span><span class="staff-person-copy"><strong>${escapeHtml(personName(person.id))}</strong><small>Bewohner · anklicken</small></span><span class="staff-person-open" aria-hidden="true">›</span></button>`).join("")
          : `<div class="staff-person"><span class="staff-person-copy"><strong>Haushalt</strong><small>Keine Bewohner</small></span></div>`;
        return `<section class="staff-group"><div class="staff-group-title"><strong>Wohnung ${apartmentIndex + 1}</strong><span>${members.length} Bewohner</span></div><div class="staff-list">${memberButtons}</div></section>`;
      }).join("");
      const occupied = householdByApartment.size;
      selectionPanel.innerHTML = `<div class="selection-title"><div><small>WOHNHAUS · STUFE ${level}</small><h3 class="building-heading">${buildingHeading(b)}</h3></div><div class="selection-title-actions">${buildingWikiButton(b)}<button data-action="close" class="selection-close" aria-label="Auswahl schließen">×</button></div></div><p class="recipe">${occupied} von ${capacity} Wohnungen belegt. Eine Wohnung gehört genau einem Haushalt; Kinder benötigen keine zusätzliche Wohnung.</p><div class="building-staff">${apartments}</div>${upgradeControls(b)}<p class="status" data-field="status"></p>${demolish}`;
      updateSelectionLiveState();
      return;
    }

    const recipeInputs = b.recipe?.inputs
      ? (Object.entries(b.recipe.inputs) as [Good, number][])
      : b.recipe?.input
        ? [[b.recipe.input, b.recipe.amount] as [Good, number]]
        : [];
    const recipe = b.kind === "school"
        ? "Berufsausbildung · 1 Lehrer + 1 Schüler · 60 s Unterricht"
        : b.kind === "warehouse"
        ? "Lagert bis zu 20 Einheiten je Warentyp"
        : b.kind === "farm"
          ? `Ein Farmer bewirtschaftet bis zu ${CONFIG.farmMaxFields} zufällige Acker im Radius ${CONFIG.farmFieldRadius}. Säen und Ernten dauern je 10 s; nach der Ernte trägt der Farmer den Weizen zurück zur Farm.`
          : b.kind === "well"
            ? `${goodLabel("water")} · Unerschöpfliche Wasserquelle ohne zugewiesenen Arbeiter`
            : b.kind === "livestockBreeder"
              ? `4 × ${goodLabel("wheat")} + 4 × ${goodLabel("water")} + zwei ausgewachsene Tiere → Jungtier`
              : b.recipe?.output
                ? `${recipeInputs.map(([good, amount]) => `${amount} × ${goodLabel(good)}`).join(" + ")} → ${b.recipe.outputAmount ?? 1} × ${goodLabel(b.recipe.output)}`
                : "Produktion";
    const inventory = b.kind === "school"
        ? `<div><span>Unterricht</span><strong data-field="school-progress"></strong></div><div><span>Zielberuf</span><strong data-field="school-profession"></strong></div><div><span>Lehrer</span><strong data-field="school-teacher"></strong></div><div><span>Schüler</span><strong data-field="school-student"></strong></div><div><span>Zustand</span><strong data-field="school-state"></strong></div>`
        : b.kind === "warehouse"
        ? `${(Object.keys(GOODS) as Good[]).map((good) => `<div><span>${goodLabel(good)}</span><strong data-field="warehouse-${good}"></strong></div>`).join("")}`
        : b.kind === "farm"
          ? `<div><span>${goodLabel("wheat")} · Output</span><strong data-field="output"></strong></div>`
          : b.kind === "well"
            ? `<div><span>${goodLabel("water")}</span><strong>∞</strong></div>`
            : `${recipeInputs.map(([good]) => `<div><span>${goodLabel(good)} · Input</span><strong data-field="input-${good}"></strong></div>`).join("")}${b.recipe?.output ? `<div><span>${goodLabel(b.recipe.output)} · Output</span><strong data-field="output"></strong></div>` : ""}`;
    const merchantStaff = b.kind === "warehouse"
      ? staffSection(b, "merchant", b.merchants ?? 0)
      : "";
    selectionPanel.innerHTML = `<div class="selection-title"><div><small>GEBÄUDE</small><h3 class="building-heading">${buildingHeading(b)}</h3></div><div class="selection-title-actions">${buildingWikiButton(b)}<button data-action="close" class="selection-close" aria-label="Auswahl schließen">×</button></div></div><p class="recipe">${recipe}</p>${recipeControls(b)}<div class="building-staff">${staffSection(b, "worker", b.workers)}${staffSection(b, "carrier", b.carriers)}${merchantStaff}</div><div class="inventory">${inventory}</div>${merchantControls(b)}${upgradeControls(b)}<p class="status" data-field="status"></p>${demolish}`;
    updateSelectionLiveState();
  }

  const refreshLiveState = () => {
    document.querySelector("#metrics")!.innerHTML = `<div><small>👥 BEV.</small><strong>${w.people.length}</strong></div><div><small>👤 FREI</small><strong>${freePeople(w).length}</strong></div><div><small>${GOOD_ICONS.wheat} WEIZEN</small><strong>${formatWholeAmount(totalWarehouseStock(w, "wheat"))}</strong></div><div><small>${GOOD_ICONS.bread} BROT</small><strong>${formatWholeAmount(totalWarehouseStock(w, "bread"))}</strong></div>`;
    if (!selectedTile) updateSelectionLiveState();
    renderUpgradePreview();
    updateBuildPlacementConfirm();
    renderMap();
  };

  const refreshPanels = () => {
    renderSelectionPanel();
    document.querySelector("#people")!.innerHTML = `<table><thead><tr><th>Person</th><th>Zuweisung</th><th>Erfahrung</th><th>Zustand / Fracht</th></tr></thead><tbody>${w.people.map((p) => {
      const farmAction = p.farmTask?.kind === "sow"
        ? "Sät"
        : p.farmTask?.kind === "fertilize"
          ? "Düngt"
          : p.farmTask?.kind === "harvest"
            ? "Erntet"
            : undefined;
      const targetResource = p.resourceTarget
        ? w.naturalResources.find((resource) => resource.id === p.resourceTarget)
        : undefined;
      const resourceLabel = targetResource
        ? targetResource.kind === "forest" ? "Wald" : targetResource.kind === "clay" ? "Lehmvorkommen" : "Steinvorkommen"
        : undefined;
      const assignment = currentProfession(w, p) === "scout"
        ? "Kundschafter"
        : p.woodcutter
        ? (resourceLabel ? `Holzfäller · ${resourceLabel}` : "Holzfäller · wartet auf Wald")
        : p.fisher
          ? "Fischer · Angelgebiet"
        : p.extractor === "clay"
          ? (resourceLabel ? `Lehmgräber · ${resourceLabel}` : "Lehmgräber · wartet auf Vorkommen")
          : p.extractor === "stone"
            ? (resourceLabel ? `Steinbrecher · ${resourceLabel}` : "Steinbrecher · wartet auf Vorkommen")
        : p.builder
          ? (p.assignment ? `Bauarbeiter · ${building(w, p.assignment.building).name}` : "Bauarbeiter · wartet auf Baustelle")
          : p.assignment
            ? `${building(w, p.assignment.building).name} · ${p.assignment.role === "worker" ? workerLabel(building(w, p.assignment.building)) : roleLabel(p.assignment.role)}`
            : "Frei";
      const profession = currentProfession(w, p);
      const experience = profession
        ? `${PROFESSION_LABELS[profession]} · ${Math.round(professionExperience(p, profession))} %`
        : "–";
      const tripPlace = p.trip
        ? p.trip.picked
          ? building(w, p.trip.target).name
          : p.trip.sourceKind === "resource"
            ? (w.naturalResources.find((resource) => resource.id === p.trip!.source)?.kind === "forest" ? "Wald" : "Vorkommen")
            : building(w, p.trip.source).name
        : undefined;
      const state = p.scoutWaypostTask
        ? personActivityLabel(p)
        : p.trip
        ? `${p.trip.picked ? "Bringt" : "Holt"} ${GOOD_ICONS[p.trip.good]} ${GOODS[p.trip.good]} · ${tripPlace}`
        : p.outdoorCarry
          ? `Trägt ${GOOD_ICONS[p.outdoorCarry]} ${GOODS[p.outdoorCarry]} zur Arbeitsflagge`
        : farmAction
          ? `${farmAction}${p.path.length ? " · auf dem Weg" : ""}`
          : p.assignment?.role === "merchant" && p.merchantRoute?.target
            ? `${GOODS[p.merchantRoute.good]} → Ziellager${p.path.length ? " · Rückweg" : ""}`
            : p.progress
              ? `${p.woodcutter ? "Fällt Holz" : p.fisher ? "Angelt" : p.extractor === "clay" ? "Gräbt Lehm" : p.extractor === "stone" ? "Bricht Stein" : p.builder ? "Baut" : "Produziert"} · ${Math.round((p.progress / (p.assignment && isUnderConstruction(building(w, p.assignment.building)) ? building(w, p.assignment.building).construction!.duration : CONFIG.duration)) * 100)} %`
              : p.path.length
                ? (p.assignment ? "Auf dem Weg zur Arbeitsstätte" : p.resourceTarget ? "Auf dem Weg zur Rohstoffquelle" : p.fisher ? "Auf dem Weg zum Angelplatz" : p.woodcutter ? "Sucht / wartet auf Wald" : p.extractor ? "Sucht / wartet auf Vorkommen" : p.builder ? "Sucht / wartet auf Baustelle" : "Auf dem Rückweg zum HQ")
                : p.assignment
                  ? "An der Arbeitsstätte"
                  : p.resourceTarget
                    ? "An der Rohstoffquelle"
                    : p.fisher
                      ? (p.fishingWaitUntilTick !== undefined ? "Angelt" : "Sucht Angelplatz")
                      : p.woodcutter
                      ? "Wartet auf Wald"
                      : p.extractor
                        ? "Wartet auf Vorkommen"
                        : p.builder
                      ? "Wartet auf Baustelle"
                      : "Am HQ";
      return `<tr><td><span class="person-id"><span aria-hidden="true">${personIcon(p.id)}</span><span>${p.id}</span></span></td><td>${assignment}</td><td>${experience}</td><td>${state}</td></tr>`;
    }).join("")}</tbody></table>`;
  };

  const refresh = () => {
    refreshLiveState();
    refreshPanels();
  };

  const autoplayButton = document.querySelector("#autoplay") as HTMLButtonElement;
  const speedButtons = Array.from(document.querySelectorAll<HTMLButtonElement>("[data-sim-speed]"));
  const customSpeedInput = document.querySelector<HTMLInputElement>("#custom-sim-speed")!;
  const isRunning = () => autoplayFrame !== undefined;

  const setSimulationSpeed = (speed: SimulationSpeed) => {
    simulationSpeed = normalizeSimulationSpeed(speed);
    w.simulationSpeed = simulationSpeed;
    customSpeedInput.value =
      Number.isInteger(simulationSpeed) && simulationSpeed >= 1 && simulationSpeed <= 9
        ? String(simulationSpeed)
        : "";
    performanceProfiler.setSimulationState(isRunning(), simulationSpeed, simulationBudget);
    for (const button of speedButtons)
      button.setAttribute(
        "aria-pressed",
        String(Math.abs(Number(button.dataset.simSpeed) - simulationSpeed) < 1e-9),
      );
  };

  const stopAutoplay = () => {
    if (autoplayFrame !== undefined) window.cancelAnimationFrame(autoplayFrame);
    autoplayFrame = undefined;
    lastAutoplayFrame = 0;
    simulationBudget = 0;
    performanceProfiler.setSimulationState(false, simulationSpeed, 0);
    autoplayButton.textContent = "Fortsetzen";
    autoplayButton.setAttribute("aria-pressed", "false");
  };

  window.addEventListener(RUNTIME_CRASH_EVENT, stopAutoplay, { once: true });

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
        const tickStarted = performanceNow();
        tick(w);
        performanceProfiler.recordTick(performanceNow() - tickStarted);
        simulationBudget -= SIMULATION_STEP_MS;
        changed = true;
        steps++;
      }
      performanceProfiler.setSimulationState(true, simulationSpeed, simulationBudget);
      if (changed) refreshLiveState();
      autoplayFrame = window.requestAnimationFrame(frame);
    };
    autoplayButton.textContent = "Pausieren";
    autoplayButton.setAttribute("aria-pressed", "true");
    performanceProfiler.setSimulationState(true, simulationSpeed, 0);
    autoplayFrame = window.requestAnimationFrame(frame);
  };

  const refreshCheatButtons = (): void => {
    const technologyEnabled = isTechnologyCheatEnabled(w);
    technologyCheatButton.setAttribute("aria-pressed", String(technologyEnabled));
    technologyCheatButton.textContent = `Technologien: ${technologyEnabled ? "AN" : "AUS"}`;

    const materialsEnabled = isMaterialCheatEnabled(w);
    materialCheatButton.setAttribute("aria-pressed", String(materialsEnabled));
    materialCheatButton.textContent = `Materialien: ${materialsEnabled ? "AN" : "AUS"}`;
  };

  const setDebugOpen = (open: boolean) => {
    debugPanel.hidden = !open;
    debugToggle.setAttribute("aria-pressed", String(open));
    if (open) {
      refreshCheatButtons();
      refreshPanels();
    }
  };

  const leaveBuildPlacementMode = () => {
    if (!buildPlacementKind) return;
    buildPlacementKind = undefined;
    buildPlacementHouseLevel = undefined;
    buildPlacementPosition = undefined;
    palisadeStart = undefined;
    palisadePreview = [];
    waypostScoutId = undefined;
    main.classList.remove("merchant-target-mode");
    buildPlacementOverlay.hidden = true;
    buildPlacementConfirm.disabled = true;
    window.dispatchEvent(new CustomEvent(BUILD_MODE_EVENT, { detail: { active: false } }));
    renderSelectionPanel();
  };

  const enterBuildPlacementMode = (
    kind: PlaceableBuildingKind | "waypost" | "palisade",
    scoutId?: number,
    houseLevel?: HouseLevel,
  ) => {
    if (kind === "waypost") {
      const scout = w.people.find((person) => person.id === scoutId);
      if (!scout || currentProfession(w, scout) !== "scout") return;
    }
    buildPlacementKind = kind;
    buildPlacementHouseLevel = kind === "house" ? (houseLevel ?? 1) : undefined;
    waypostScoutId = kind === "waypost" ? scoutId : undefined;
    buildPlacementPosition = undefined;
    selectedTile = undefined;
    selectedBuildingId = undefined;
    selectedWaypostId = undefined;
    setDebugOpen(false);
    main.classList.add("merchant-target-mode");
    buildPlacementTitle.textContent =
      kind === "waypost" ? "Wegweiser platzieren"
        : kind === "palisade" ? "Palisade errichten"
          : kind === "house"
            ? `Wohnhaus ${buildPlacementHouseLevel ?? 1} platzieren`
            : `${BUILDING_NAMES[kind as BuildableBuildingKind]} platzieren`;
    buildPlacementConfirm.textContent = kind === "waypost" ? "Auftrag erteilen" : "Bauen";
    buildPlacementOverlay.hidden = false;
    updateBuildPlacementConfirm();
    window.dispatchEvent(new CustomEvent(BUILD_MODE_EVENT, {
      detail: { active: true, kind },
    }));
    renderSelectionPanel();
  };

  const confirmBuildPlacement = () => {
    if (!buildPlacementKind || !buildPlacementPosition) return;
    if (buildPlacementKind === "palisade") {
      const created = createPalisadeSites(w, palisadePreview);
      if (!created.length) {
        updateBuildPlacementConfirm();
        renderMap();
        return;
      }
      notifyConstructionSiteAdded(w);
      leaveBuildPlacementMode();
      selectedTile = undefined;
      selectedBuildingId = created[0]?.id;
      if (selectedBuildingId)
        window.dispatchEvent(new CustomEvent(BUILDING_SELECTION_REQUESTED_EVENT, {
          detail: { id: selectedBuildingId },
        }));
      refresh();
      return;
    }
    if (buildPlacementKind === "waypost") {
      const scoutId = waypostScoutId;
      if (scoutId === undefined || !orderScoutWaypost(w, scoutId, buildPlacementPosition)) {
        updateBuildPlacementConfirm();
        renderMap();
        return;
      }
      leaveBuildPlacementMode();
      selectedTile = undefined;
      selectedBuildingId = undefined;
      window.dispatchEvent(new CustomEvent(PERSON_SELECTION_REQUESTED_EVENT, {
        detail: { id: scoutId, focus: false },
      }));
      refresh();
      return;
    }

    const created = buildWithFootprint(
      w,
      buildPlacementPosition,
      buildPlacementKind,
      buildPlacementKind === "house"
        ? { houseLevel: buildPlacementHouseLevel ?? 1 }
        : undefined,
    );
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

  window.addEventListener(HANDBOOK_VISIBILITY_EVENT, (event) => {
    const open = Boolean((event as CustomEvent<{ open?: boolean }>).detail?.open);
    if (open) {
      handbookWasRunning = isRunning();
      if (handbookWasRunning) stopAutoplay();
      return;
    }
    if (
      handbookWasRunning &&
      !isRunning() &&
      merchantTargetSelection === undefined &&
      !buildPlacementKind
    ) startAutoplay();
    handbookWasRunning = false;
  });

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
  const restoreCustomSpeedInput = () => {
    customSpeedInput.value =
      Number.isInteger(simulationSpeed) && simulationSpeed >= 1 && simulationSpeed <= 9
        ? String(simulationSpeed)
        : "";
  };
  customSpeedInput.addEventListener("input", () => {
    if (customSpeedInput.value === "") return;
    if (!/^[1-9]$/.test(customSpeedInput.value)) customSpeedInput.value = "";
  });
  customSpeedInput.addEventListener("change", () => {
    const parsed = Number(customSpeedInput.value);
    if (Number.isInteger(parsed) && parsed >= 1 && parsed <= 9) setSimulationSpeed(parsed);
    else restoreCustomSpeedInput();
  });
  customSpeedInput.addEventListener("keydown", (event) => {
    if ([".", ",", "e", "E", "+", "-"].includes(event.key)) event.preventDefault();
    if (event.key === "Enter") customSpeedInput.blur();
  });
  debugToggle.addEventListener("click", () => setDebugOpen(debugPanel.hidden));
  technologyCheatButton.addEventListener("click", () => {
    setTechnologyCheatEnabled(w, !isTechnologyCheatEnabled(w));
    refreshCheatButtons();
    renderSelectionPanel();
    renderMap();
  });
  materialCheatButton.addEventListener("click", () => {
    setMaterialCheatEnabled(w, !isMaterialCheatEnabled(w));
    refreshCheatButtons();
  });
  document.querySelector("#debug-close")!.addEventListener("click", () => setDebugOpen(false));
  merchantTargetCancel.addEventListener("click", leaveMerchantTargetMode);
  buildPlacementConfirm.addEventListener("click", confirmBuildPlacement);
  buildPlacementCancel.addEventListener("click", leaveBuildPlacementMode);
  upgradePreviewClose.addEventListener("click", () => {
    const sourceId = upgradePreviewBuildingId;
    upgradePreviewBuildingId = undefined;
    upgradePreviewOverlay.hidden = true;
    main.classList.remove("merchant-target-mode");
    window.dispatchEvent(new CustomEvent(UPGRADE_PREVIEW_EVENT, { detail: { active: false } }));
    if (sourceId) {
      selectedBuildingId = sourceId;
      selectedTile = undefined;
      selectedWaypostId = undefined;
      window.dispatchEvent(new CustomEvent(BUILDING_SELECTION_REQUESTED_EVENT, {
        detail: { id: sourceId, focus: false },
      }));
    }
    renderSelectionPanel();
    renderMap();
  });

  selectionPanel.addEventListener("change", (event) => {
    const select = event.target as HTMLSelectElement;
    if (select.dataset.buildingRecipe) {
      setBuildingRecipe(w, select.dataset.buildingRecipe, select.value as Good);
      refresh();
      return;
    }
    if (select.dataset.routeGood) {
      const personId = Number(select.dataset.routeGood);
      const p = w.people.find((person) => person.id === personId);
      setMerchantRoute(w, personId, p?.merchantRoute?.target, select.value as Good);
      refresh();
    }
  });

  selectionPanel.addEventListener("click", async (event) => {
    const button = (event.target as HTMLElement).closest<HTMLButtonElement>("button[data-action]");
    if (!button || button.disabled) return;
    const action = button.dataset.action;
    if (action === "close") {
      selectedBuildingId = undefined;
      selectedWaypostId = undefined;
      selectedTile = undefined;
      renderSelectionPanel();
      window.dispatchEvent(new CustomEvent(SELECTION_CLEARED_EVENT));
      return;
    }
    if (action === "demolish-waypost" && selectedWaypostId) {
      if (await confirmDialog("Wegweiser wirklich abreißen? Verbindungen im Wegenetz werden entfernt.", { title: "Wegweiser abreißen", confirmLabel: "Abreißen", danger: true })) {
        removeWaypost(w, selectedWaypostId);
        selectedWaypostId = undefined;
        window.dispatchEvent(new CustomEvent(SELECTION_CLEARED_EVENT));
        refresh();
      }
      return;
    }
    if (action === "birth-policy") {
      const policy = button.dataset.policy;
      if (policy === "low" || policy === "medium" || policy === "high") {
        setBirthPolicy(w, policy);
        refresh();
      }
      return;
    }
    if (action === "merchant-map-target") {
      enterMerchantTargetMode(Number(button.dataset.person));
      return;
    }
    if (action === "staff-person" || action === "household-person") {
      const personId = Number(button.dataset.person);
      selectedBuildingId = undefined;
      selectedTile = undefined;
      selectionPanel.hidden = true;
      window.dispatchEvent(new CustomEvent(PERSON_SELECTION_REQUESTED_EVENT, {
        detail: { id: personId, focus: true },
      }));
      return;
    }
    if (action === "staff-candidates") {
      const buildingId = button.dataset.building as BuildingId;
      const role = button.dataset.role as Role;
      selectionPanel.hidden = true;
      window.dispatchEvent(new CustomEvent(PERSON_STAFF_PICKER_REQUESTED_EVENT, {
        detail: { buildingId, role },
      }));
      return;
    }
    if (action === "build") {
      const kind = button.dataset.kind as PlaceableBuildingKind | "palisade";
      const level = kind === "house" && button.dataset.houseLevel
        ? Number(button.dataset.houseLevel) as HouseLevel
        : undefined;
      enterBuildPlacementMode(kind, undefined, level);
      return;
    }
    if (action === "upgrade-blockers" && selectedBuildingId) {
      const source = w.buildings.find((candidate) => candidate.id === selectedBuildingId && !candidate.retired);
      const rule = source ? buildingUpgradeRule(source.kind) : undefined;
      if (!source || !rule) return;
      upgradePreviewBuildingId = source.id;
      upgradePreviewOverlay.hidden = false;
      main.classList.add("merchant-target-mode");
      renderUpgradePreview();
      window.dispatchEvent(new CustomEvent(UPGRADE_PREVIEW_EVENT, {
        detail: { active: true, buildingId: source.id, targetKind: rule.to },
      }));
      renderMap();
      return;
    }
    if (action === "upgrade" && selectedBuildingId) {
      const source = w.buildings.find((candidate) => candidate.id === selectedBuildingId && !candidate.retired);
      if (source && startBuildingUpgrade(w, source)) refresh();
      else renderSelectionPanel();
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
        await confirmDialog(`${selected.name} wirklich abreißen? Gelagerte Waren gehen verloren.`, { title: "Gebäude abreißen", confirmLabel: "Abreißen", danger: true })
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
    refresh();
  });

  window.addEventListener(WAYPOST_PLACEMENT_REQUESTED_EVENT, (event) => {
    const personId = (event as CustomEvent<{ personId: number }>).detail.personId;
    enterBuildPlacementMode("waypost", personId);
  });

  window.addEventListener(BUILD_POSITION_SELECTED_EVENT, (event) => {
    if (!buildPlacementKind) return;
    const detail = (event as CustomEvent<BuildPositionSelectedDetail>).detail;
    if (buildPlacementKind === "palisade") {
      if (!detail.chosen) return;
      buildPlacementPosition = { ...detail.position };
      if (!palisadeStart) {
        if (!palisadePlanningTileAvailable(w, buildPlacementPosition)) {
          palisadePreview = [];
          updateBuildPlacementConfirm();
          renderMap();
          return;
        }
        palisadeStart = { ...buildPlacementPosition };
      }
      palisadePreview = planPalisadePath(w, palisadeStart, buildPlacementPosition);
      updateBuildPlacementConfirm();
      renderMap();
      return;
    }
    buildPlacementPosition = { ...detail.position };
    updateBuildPlacementConfirm();
    renderMap();
  });

  window.addEventListener(BUILDING_SELECTED_EVENT, (event) => {
    if (buildPlacementKind) return;
    const id = (event as CustomEvent<BuildingSelectedDetail>).detail.id;
    if (upgradePreviewBuildingId && id !== upgradePreviewBuildingId) {
      upgradePreviewBuildingId = undefined;
      upgradePreviewOverlay.hidden = true;
      main.classList.remove("merchant-target-mode");
      window.dispatchEvent(new CustomEvent(UPGRADE_PREVIEW_EVENT, { detail: { active: false } }));
    }
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
    selectedWaypostId = undefined;
    selectedBuildingId = id;
    renderSelectionPanel();
  });

  window.addEventListener(WAYPOST_SELECTED_EVENT, (event) => {
    if (merchantTargetSelection !== undefined || buildPlacementKind) return;
    selectedBuildingId = undefined;
    selectedTile = undefined;
    selectedWaypostId = (event as CustomEvent<WaypostSelectedDetail>).detail.id;
    renderSelectionPanel();
  });

  window.addEventListener(TILE_SELECTED_EVENT, (event) => {
    if (merchantTargetSelection !== undefined || buildPlacementKind) return;
    selectedBuildingId = undefined;
    selectedWaypostId = undefined;
    selectedTile = (event as CustomEvent<TileSelectedDetail>).detail.position;
    renderSelectionPanel();
  });

  window.addEventListener(WORLD_REPLACED_EVENT, () => {
    setSimulationSpeed(w.simulationSpeed ?? 1);
  });

  setSimulationSpeed(simulationSpeed);
  refresh();
  startAutoplay();
}
