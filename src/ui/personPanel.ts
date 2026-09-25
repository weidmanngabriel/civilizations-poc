import type { BuildingId, EquipmentSlot, Person, Profession, Role, World } from "../simulation/model";
import {
  canLearnProfession,
  currentProfession,
  PROFESSION_LABELS,
  professionExperience,
  workerProfession,
} from "../simulation/experience";
import { GOODS } from "../simulation/simulation";
import { personName } from "../simulation/personIdentity";
import { GOOD_ICONS } from "../icons";
import { personActivityLabel } from "../personPresentation";
import { personAlertMap, type PersonAlertSeverity } from "./personAlerts";
import { setPersonProfession, setPersonWorkplace } from "../simulation/personCommands";
import { EQUIPMENT_DEFINITIONS, equipmentForSlot, equipmentPendingForSlot, equipmentWearPercent, unequipSlot } from "../simulation/equipment";
import { PERSON_EQUIPMENT_PICKER_REQUESTED_EVENT } from "./personContextMenu";
import { confirmDialog, showDialog } from "./modalDialog";
import { homeForPerson } from "../simulation/housing";

const PERSON_SELECTED_EVENT = "poc-person-selected";
const PERSON_CLEARED_EVENT = "poc-person-selection-cleared";
const PERSON_SELECTION_REQUESTED_EVENT = "poc-person-selection-requested";
const PERSON_SELECTION_CLEAR_REQUESTED_EVENT = "poc-person-selection-clear-requested";
const BUILDING_SELECTED_EVENT = "poc-building-selected";
const TILE_SELECTED_EVENT = "poc-tile-selected";
const BUILD_MODE_EVENT = "poc-build-mode";
const MERCHANT_TARGET_MODE_EVENT = "poc-merchant-target-mode";
const PERSON_CONTEXT_TOGGLE_REQUESTED_EVENT = "poc-person-context-toggle-requested";
const PERSON_STAFF_PICKER_REQUESTED_EVENT = "poc-person-staff-picker-requested";
const UI_MENU_OPENED_EVENT = "poc-ui-menu-opened";
const BUILDING_SELECTION_REQUESTED_EVENT = "poc-building-selection-requested";

type PersonSelectedDetail = { id: number };
type StaffPickerDetail = { buildingId: BuildingId; role: Role };
type PersonFilter = "all" | "free" | Profession;
type PersonAlertFilter = "all" | PersonAlertSeverity;

const ALERT_META: Record<PersonAlertSeverity, { icon: string; label: string }> = {
  critical: { icon: "🔴", label: "Kritisch" },
  warning: { icon: "🟡", label: "Wichtig" },
  info: { icon: "🔵", label: "Info" },
};

const PROFESSION_ICONS: Record<Profession, string> = {
  woodcutter: "🪓",
  fisher: "🎣",
  hunter: "🏹",
  scout: "🧭",
  builder: "🔨",
  carrier: "📦",
  merchant: "🧭",
  farmer: "🌾",
  sawmillWorker: "🪵",
  carpenter: "🛠️",
  miller: "⚙️",
  baker: "🍞",
  clayDigger: "🟤",
  stonecutter: "⛏️",
  potter: "🧱",
  stonemason: "🪨",
  tailor: "🧵",
  stockfarmer: "🐄",
};

const escapeHtml = (value: string): string =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

const displayNeed = (value: number | undefined): number =>
  Math.max(0, Math.round(value ?? 100));

const professionOf = (world: World, person: Person): Profession | undefined =>
  currentProfession(world, person);

const professionLabel = (world: World, person: Person): string => {
  const profession = professionOf(world, person);
  return profession ? PROFESSION_LABELS[profession] : "Frei";
};

const professionIcon = (world: World, person: Person): string => {
  const profession = professionOf(world, person);
  return profession ? PROFESSION_ICONS[profession] : "👤";
};

const workplaceLabel = (world: World, person: Person): string => {
  if (person.assignment) {
    const workplace = world.buildings.find(
      (building) => building.id === person.assignment!.building && !building.retired,
    );
    return workplace?.name ?? "Unbekannter Arbeitsplatz";
  }
  if (person.woodcutter) return "Waldarbeit · automatisch";
  if (person.fisher) return "Angelgebiet · automatisch";
  if (person.extractor === "clay") return "Lehmvorkommen · automatisch";
  if (person.extractor === "stone") return "Steinvorkommen · automatisch";
  if (person.builder) return "Baustellenpool";
  return "—";
};

const homeBuilding = (world: World, person: Person) => homeForPerson(world, person);

const homeLabel = (world: World, person: Person): string =>
  homeBuilding(world, person)?.name ?? "—";

const cargoLabel = (person: Person): string =>
  person.trip?.picked
    ? `${GOOD_ICONS[person.trip.good]} ${GOODS[person.trip.good]}`
    : "—";

const buildingFactMarkup = (world: World, buildingId: BuildingId | undefined, fallback: string): string => {
  if (!buildingId) return escapeHtml(fallback);
  const building = world.buildings.find((candidate) => candidate.id === buildingId && !candidate.retired);
  if (!building) return escapeHtml(fallback);
  return `<button type="button" class="person-fact-link" data-person-building-id="${building.id}">${escapeHtml(building.name)} <span aria-hidden="true">⌖</span></button>`;
};

const personFactMarkup = (person: Person | undefined, fallback = "—"): string =>
  person
    ? `<button type="button" class="person-fact-link" data-person-related-id="${person.id}">${escapeHtml(personName(person.id))} <span aria-hidden="true">›</span></button>`
    : escapeHtml(fallback);

const cargoMarkup = (person: Person): string =>
  person.trip?.picked
    ? `<button type="button" class="person-fact-link wiki-link" data-wiki-good="${person.trip.good}"><span aria-hidden="true">${GOOD_ICONS[person.trip.good]}</span> ${GOODS[person.trip.good]}</button>`
    : "—";

export function mountPersonPanel(world: World): void {
  const main = document.querySelector<HTMLElement>("main");
  const leftMenu = document.querySelector<HTMLElement>(".left-menu");
  if (!main || !leftMenu) return;

  const toggle = document.createElement("button");
  toggle.id = "person-menu-toggle";
  toggle.className = "left-menu-button";
  toggle.type = "button";
  toggle.setAttribute("aria-expanded", "false");
  toggle.setAttribute("aria-controls", "person-browser-panel");
  toggle.innerHTML = `
    <span class="person-menu-icon" aria-hidden="true">👥</span>
    <span class="left-menu-button-label">Personen</span>
    <span class="person-alert-badge" aria-label="Aktuelle Personenhinweise"></span>`;
  const buildToggle = leftMenu.querySelector("#build-menu-toggle");
  leftMenu.insertBefore(toggle, buildToggle);

  const browser = document.createElement("section");
  browser.id = "person-browser-panel";
  browser.className = "person-browser-panel";
  browser.hidden = true;
  browser.setAttribute("aria-label", "Personenübersicht");
  browser.innerHTML = `
    <header class="person-panel-header">
      <div><small data-person-browser-kicker>BEWOHNER</small><strong data-person-browser-title>Personen finden</strong></div>
      <button type="button" data-person-action="close-browser" aria-label="Personenübersicht schließen">×</button>
    </header>
    <div class="person-alert-filters" role="group" aria-label="Nach Hinweisstufe filtern">
      <button type="button" data-person-alert-filter="critical" aria-pressed="false"><span aria-hidden="true">🔴</span><strong data-person-alert-count="critical">0</strong><small>Kritisch</small></button>
      <button type="button" data-person-alert-filter="warning" aria-pressed="false"><span aria-hidden="true">🟡</span><strong data-person-alert-count="warning">0</strong><small>Wichtig</small></button>
      <button type="button" data-person-alert-filter="info" aria-pressed="false"><span aria-hidden="true">🔵</span><strong data-person-alert-count="info">0</strong><small>Info</small></button>
    </div>
    <label class="person-search-label">
      <span>Suche</span>
      <input id="person-search" type="search" autocomplete="off" placeholder="Name suchen" />
    </label>
    <div class="person-filter-row" role="group" aria-label="Nach Beruf filtern">
      <button type="button" data-person-filter="all" aria-pressed="true">Alle</button>
      <button type="button" data-person-filter="free" aria-pressed="false">Frei</button>
      ${(Object.entries(PROFESSION_LABELS) as [Profession, string][])
        .sort((a, b) => a[1].localeCompare(b[1], "de"))
        .map(([profession, label]) => `<button type="button" data-person-filter="${profession}" aria-pressed="false">${label}</button>`)
        .join("")}
    </div>
    <div class="person-browser-summary"></div>
    <div class="person-browser-list"></div>`;
  main.append(browser);

  const inspector = document.createElement("aside");
  inspector.id = "person-inspector";
  inspector.className = "person-inspector";
  inspector.hidden = true;
  inspector.setAttribute("aria-live", "polite");
  main.append(inspector);

  const search = browser.querySelector<HTMLInputElement>("#person-search")!;
  const list = browser.querySelector<HTMLElement>(".person-browser-list")!;
  const summary = browser.querySelector<HTMLElement>(".person-browser-summary")!;
  const filterButtons = Array.from(
    browser.querySelectorAll<HTMLButtonElement>("[data-person-filter]"),
  );
  const alertFilterButtons = Array.from(
    browser.querySelectorAll<HTMLButtonElement>("[data-person-alert-filter]"),
  );
  const alertBadge = toggle.querySelector<HTMLElement>(".person-alert-badge")!;
  const browserKicker = browser.querySelector<HTMLElement>("[data-person-browser-kicker]")!;
  const browserTitle = browser.querySelector<HTMLElement>("[data-person-browser-title]")!;
  const alertFilters = browser.querySelector<HTMLElement>(".person-alert-filters")!;
  const professionFilters = browser.querySelector<HTMLElement>(".person-filter-row")!;

  let selectedPersonId: number | undefined;
  let activeFilter: PersonFilter = "all";
  let activeAlertFilter: PersonAlertFilter = "all";
  let alerts = personAlertMap(world);
  let searchQuery = "";
  let inspectorSignature = "";
  let browserProfessionSignature = "";
  let staffPicker: StaffPickerDetail | undefined;

  const staffPickerProfession = (): Profession | undefined => {
    if (!staffPicker) return undefined;
    const building = world.buildings.find((candidate) => candidate.id === staffPicker!.buildingId);
    if (!building || building.retired) return undefined;
    if (staffPicker.role === "worker") return workerProfession(building);
    if (staffPicker.role === "carrier") return "carrier";
    if (staffPicker.role === "merchant") return "merchant";
    return undefined;
  };

  const staffPickerPriority = (person: Person): number => {
    if (!staffPicker) return 0;
    const requiredProfession = staffPickerProfession();
    const profession = professionOf(world, person);
    if (requiredProfession && profession === requiredProfession && !person.assignment) return 0;
    if (!profession) return 1;
    return 2;
  };

  const matchingPeople = (): Person[] => {
    const query = searchQuery.trim().toLocaleLowerCase("de-DE");
    return world.people
      .filter((person) => {
        if (
          staffPicker &&
          person.assignment?.building === staffPicker.buildingId &&
          person.assignment.role === staffPicker.role
        ) return false;
        const profession = professionOf(world, person);
        const alert = alerts.get(person.id);
        const requiredProfession = staffPickerProfession();
        if (staffPicker && requiredProfession && !canLearnProfession(person, requiredProfession))
          return false;
        if (!staffPicker && activeAlertFilter !== "all" && alert?.severity !== activeAlertFilter)
          return false;
        if (activeFilter === "free" && profession) return false;
        if (activeFilter !== "all" && activeFilter !== "free" && profession !== activeFilter)
          return false;
        if (!query) return true;
        return (
          personName(person.id).toLocaleLowerCase("de-DE").includes(query) ||
          professionLabel(world, person).toLocaleLowerCase("de-DE").includes(query)
        );
      })
      .sort((a, b) => {
        if (staffPicker) {
          const priority = staffPickerPriority(a) - staffPickerPriority(b);
          if (priority) return priority;
        }
        return personName(a.id).localeCompare(personName(b.id), "de");
      });
  };

  const personListButton = (person: Person): string => `
    <button class="person-list-item" type="button" data-person-id="${person.id}">
      <span class="person-list-avatar" aria-hidden="true">${professionIcon(world, person)}</span>
      <span class="person-list-copy">
        <strong>${escapeHtml(personName(person.id))}</strong>
        <small>${escapeHtml(professionLabel(world, person))}</small>
        ${!staffPicker && alerts.has(person.id) ? `<em class="person-list-alert person-list-alert--${alerts.get(person.id)!.severity}">${escapeHtml(alerts.get(person.id)!.label)}</em>` : ""}
      </span>
      <span class="person-list-needs">
        <span title="Hunger">🍴 <b data-person-hunger="${person.id}">${displayNeed(person.hunger)}</b></span>
        <span title="Schlaf">💤 <b data-person-sleep="${person.id}">${displayNeed(person.sleep)}</b></span>
      </span>
    </button>`;

  const renderBrowserList = (): void => {
    const people = matchingPeople();
    if (staffPicker) {
      const matchingProfession = people.filter((person) => staffPickerPriority(person) === 0);
      const free = people.filter((person) => staffPickerPriority(person) === 1);
      const others = people.filter((person) => staffPickerPriority(person) === 2);
      summary.textContent = `${people.length} geeignete Personen`;
      list.innerHTML = people.length
        ? [
            matchingProfession.length ? `<div class="person-picker-group"><strong>Passender Beruf</strong><small>Noch ohne Arbeitsplatz</small></div>${matchingProfession.map(personListButton).join("")}` : "",
            free.length ? `<div class="person-picker-group"><strong>Frei</strong><small>Noch ohne Beruf</small></div>${free.map(personListButton).join("")}` : "",
            others.length ? `<div class="person-picker-group"><strong>Andere Personen</strong><small>Beruf oder Arbeitsplatz wird geändert</small></div>${others.map(personListButton).join("")}` : "",
          ].join("")
        : `<div class="person-empty-state">Keine geeignete Person gefunden.</div>`;
    } else {
      summary.textContent = `${people.length} von ${world.people.length} Personen`;
      list.innerHTML = people.length
        ? people.map(personListButton).join("")
        : `<div class="person-empty-state">Keine passende Person gefunden.</div>`;
    }

    for (const button of filterButtons)
      button.setAttribute("aria-pressed", String(button.dataset.personFilter === activeFilter));
    for (const button of alertFilterButtons)
      button.setAttribute("aria-pressed", String(button.dataset.personAlertFilter === activeAlertFilter));

    browserProfessionSignature = world.people
      .map((person) => `${person.id}:${professionOf(world, person) ?? "free"}`)
      .join("|");
  };

  const renderAlertCounts = (): void => {
    const counts: Record<PersonAlertSeverity, number> = { critical: 0, warning: 0, info: 0 };
    for (const alert of alerts.values()) counts[alert.severity] += 1;
    for (const severity of Object.keys(counts) as PersonAlertSeverity[]) {
      const counter = browser.querySelector<HTMLElement>(`[data-person-alert-count="${severity}"]`);
      if (counter) counter.textContent = String(counts[severity]);
    }
    const visible = (Object.keys(counts) as PersonAlertSeverity[]).filter((severity) => counts[severity] > 0);
    alertBadge.innerHTML = visible.map((severity) => `<span title="${ALERT_META[severity].label}">${ALERT_META[severity].icon}<b>${counts[severity]}</b></span>`).join("");
    alertBadge.hidden = visible.length === 0;
  };

  const refreshAlerts = (): void => {
    alerts = personAlertMap(world);
    renderAlertCounts();
    if (!browser.hidden) renderBrowserList();
  };

  const updateBrowserNeeds = (): void => {
    if (browser.hidden) return;
    const nextProfessionSignature = world.people
      .map((person) => `${person.id}:${professionOf(world, person) ?? "free"}`)
      .join("|");
    if (nextProfessionSignature !== browserProfessionSignature) {
      renderBrowserList();
      return;
    }
    for (const person of world.people) {
      const hunger = list.querySelector<HTMLElement>(`[data-person-hunger="${person.id}"]`);
      const sleep = list.querySelector<HTMLElement>(`[data-person-sleep="${person.id}"]`);
      if (hunger) hunger.textContent = String(displayNeed(person.hunger));
      if (sleep) sleep.textContent = String(displayNeed(person.sleep));
    }
  };
  const renderInspector = (): void => {
    if (selectedPersonId === undefined || !browser.hidden) {
      inspector.hidden = true;
      return;
    }
    const person = world.people.find((candidate) => candidate.id === selectedPersonId);
    if (!person) {
      selectedPersonId = undefined;
      inspector.hidden = true;
      return;
    }

    const profession = professionOf(world, person);
    const professionText = profession ? PROFESSION_LABELS[profession] : "Frei";
    const experience = profession ? Math.round(professionExperience(person, profession)) : undefined;
    const hunger = displayNeed(person.hunger);
    const sleep = displayNeed(person.sleep);
    const workplace = workplaceLabel(world, person);
    const activity = personActivityLabel(person);
    const home = homeLabel(world, person);
    const cargo = cargoLabel(person);
    const spouse = person.spouseId
      ? world.people.find((candidate) => candidate.id === person.spouseId)
      : undefined;
    const parents = (person.parentIds ?? [])
      .map((id) => world.people.find((candidate) => candidate.id === id))
      .filter((candidate): candidate is Person => Boolean(candidate));
    const children = (person.childIds ?? [])
      .map((id) => world.people.find((candidate) => candidate.id === id))
      .filter((candidate): candidate is Person => Boolean(candidate));
    const sexLabel = person.sex === "female" ? "Frau" : person.sex === "male" ? "Mann" : "—";
    const ageLabel = person.ageStage === "child" ? "Kind" : "Erwachsen";
    const tool = equipmentForSlot(person, "tool");
    const shoes = equipmentForSlot(person, "shoes");
    const equipmentSlot = (slot: EquipmentSlot): string => {
      const item = equipmentForSlot(person, slot);
      const good = slot === "tool" ? "woodenTool" : "shoes";
      const definition = EQUIPMENT_DEFINITIONS[good];
      if (!item) {
        const pending = equipmentPendingForSlot(person, slot);
        return `<button type="button" class="person-equipment-slot empty" data-equipment-slot="${slot}" ${pending ? "disabled" : ""}><span aria-hidden="true">${definition.icon}</span><span><strong>${slot === "tool" ? "Werkzeug" : "Schuhe"}</strong><small>${pending ? "Wird geholt" : "Zuweisen"}</small></span></button>`;
      }
      const wear = equipmentWearPercent(item);
      return `<button type="button" class="person-equipment-slot" data-equipment-slot="${slot}"><span aria-hidden="true">${definition.icon}</span><span><strong>${definition.label}</strong><small>Abnutzung ${wear} % · Ablegen</small></span></button>`;
    };
    const signature = [
      person.id,
      professionText,
      experience ?? "",
      hunger,
      sleep,
      workplace,
      activity,
      home,
      cargo,
      person.sex ?? "",
      person.ageStage ?? "adult",
      person.spouseId ?? "",
      (person.parentIds ?? []).join(","),
      (person.childIds ?? []).join(","),
      tool?.good ?? "",
      tool?.durability ?? "",
      tool?.workProgress ?? "",
      shoes?.good ?? "",
      shoes?.durability ?? "",
    ].join("|");
    if (signature === inspectorSignature && !inspector.hidden) return;
    inspectorSignature = signature;
    const detailsOpen = inspector.querySelector<HTMLDetailsElement>(".person-details")?.open ?? false;
    inspector.hidden = false;
    inspector.innerHTML = `
      <header class="person-panel-header person-inspector-header">
        <button class="person-context-toggle" type="button" data-person-action="open-context" ${person.ageStage === "child" ? "disabled" : ""}>
          <span class="person-context-toggle-icon" aria-hidden="true"></span><span>Aktionen</span>
        </button>
        <div class="person-inspector-identity">
          ${profession
            ? `<button type="button" class="person-profession-link wiki-link" data-wiki-profession="${profession}">${escapeHtml(professionText)}</button>`
            : `<small>${escapeHtml(professionText)}</small>`}
          <strong>${escapeHtml(personName(person.id))}</strong>
        </div>
        <button class="person-inspector-close" type="button" data-person-action="close-inspector" aria-label="Person schließen">×</button>
      </header>
      ${person.ageStage === "child" ? "" : `<div class="person-needs">
        <div class="person-need-row">
          <span>Hunger</span>
          <div class="person-meter"><i style="width:${hunger}%"></i></div>
          <strong>${hunger}</strong>
        </div>
        <div class="person-need-row sleep">
          <span>Schlaf</span>
          <div class="person-meter"><i style="width:${sleep}%"></i></div>
          <strong>${sleep}</strong>
        </div>
      </div>`}
      <dl class="person-facts person-facts-primary">
        <div><dt>Aktuell</dt><dd>${escapeHtml(activity)}</dd></div>
      </dl>
      <details class="person-details" ${detailsOpen ? "open" : ""}>
        <summary>Details</summary>
        <dl class="person-facts">
          <div><dt>Arbeitsplatz</dt><dd>${buildingFactMarkup(world, person.assignment?.building, workplace)}</dd></div>
          <div><dt>Wohnung</dt><dd>${buildingFactMarkup(world, homeBuilding(world, person)?.id, home)}</dd></div>
          <div><dt>Erfahrung</dt><dd>${experience === undefined ? "—" : `${experience} %`}</dd></div>
          <div><dt>Getragen</dt><dd>${cargoMarkup(person)}</dd></div>
        </dl>
        <section class="person-equipment">
          <small>AUSRÜSTUNG</small>
          <div class="person-equipment-grid">
            ${equipmentSlot("tool")}
            ${equipmentSlot("shoes")}
          </div>
        </section>
      </details>`;
  };

  const resetBrowserFilters = (): void => {
    activeFilter = "all";
    activeAlertFilter = "all";
    searchQuery = "";
    search.value = "";
    for (const button of filterButtons)
      button.setAttribute("aria-pressed", String(button.dataset.personFilter === "all"));
    for (const button of alertFilterButtons)
      button.setAttribute("aria-pressed", "false");
  };

  const closeConflictingMenus = (): void => {
    const buildPanel = document.querySelector<HTMLElement>("#build-menu-panel");
    if (buildPanel && !buildPanel.hidden)
      document.querySelector<HTMLButtonElement>("#build-menu-close")?.click();
    const handbook = document.querySelector<HTMLElement>("#handbook-overlay");
    if (handbook && !handbook.hidden)
      document.querySelector<HTMLButtonElement>("#handbook-close")?.click();
    const buildings = document.querySelector<HTMLElement>("#building-browser-panel");
    if (buildings && !buildings.hidden)
      document.querySelector<HTMLButtonElement>('[data-building-action="close"]')?.click();
  };

  const renderBrowserMode = (): void => {
    if (!staffPicker) {
      browserKicker.textContent = "BEWOHNER";
      browserTitle.textContent = "Personen finden";
      alertFilters.hidden = false;
      professionFilters.hidden = false;
      browser.classList.remove("person-staff-picker");
      return;
    }
    const building = world.buildings.find((candidate) => candidate.id === staffPicker!.buildingId);
    const profession = staffPickerProfession();
    browserKicker.textContent = "GEEIGNETE PERSONEN";
    browserTitle.textContent = profession
      ? `${PROFESSION_LABELS[profession]} · ${building?.name ?? "Gebäude"}`
      : (building?.name ?? "Gebäude");
    alertFilters.hidden = true;
    professionFilters.hidden = false;
    browser.classList.add("person-staff-picker");
  };

  const returnToStaffBuilding = (): void => {
    const buildingId = staffPicker?.buildingId;
    staffPicker = undefined;
    renderBrowserMode();
    setBrowserOpen(false);
    if (!buildingId) return;
    window.dispatchEvent(new CustomEvent(BUILDING_SELECTION_REQUESTED_EVENT, {
      detail: { id: buildingId, focus: false },
    }));
    window.dispatchEvent(new CustomEvent(BUILDING_SELECTED_EVENT, {
      detail: { id: buildingId },
    }));
  };

  const setBrowserOpen = (open: boolean): void => {
    browser.hidden = !open;
    main.classList.toggle("person-staff-picker-open", open && Boolean(staffPicker));
    toggle.setAttribute("aria-expanded", String(open));
    toggle.classList.toggle("active", open);
    if (open) {
      window.dispatchEvent(new CustomEvent(UI_MENU_OPENED_EVENT, { detail: { menu: "people" } }));
      closeConflictingMenus();
      renderBrowserMode();
      renderBrowserList();
      inspector.hidden = true;
      requestAnimationFrame(() => search.focus({ preventScroll: true }));
    } else {
      resetBrowserFilters();
      renderInspector();
    }
  };

  const requestPerson = (personId: number): void => {
    setBrowserOpen(false);
    window.dispatchEvent(new CustomEvent(PERSON_SELECTION_REQUESTED_EVENT, {
      detail: { id: personId, focus: true },
    }));
  };

  const clearPerson = (): void => {
    selectedPersonId = undefined;
    inspectorSignature = "";
    inspector.hidden = true;
  };

  const closeBuildingPanel = (): void => {
    const panel = document.querySelector<HTMLElement>("#selection-panel");
    if (panel && !panel.hidden)
      panel.querySelector<HTMLButtonElement>('button[data-action="close"]')?.click();
  };

  toggle.addEventListener("click", () => {
    if (!browser.hidden && staffPicker) returnToStaffBuilding();
    else setBrowserOpen(browser.hidden);
  });
  search.addEventListener("input", () => {
    searchQuery = search.value;
    renderBrowserList();
  });

  browser.addEventListener("click", async (event) => {
    const target = event.target as HTMLElement;
    const action = target.closest<HTMLButtonElement>("[data-person-action]")?.dataset.personAction;
    if (action === "close-browser") {
      if (staffPicker) returnToStaffBuilding();
      else setBrowserOpen(false);
      return;
    }
    const alertFilter = target.closest<HTMLButtonElement>("[data-person-alert-filter]")?.dataset.personAlertFilter;
    if (alertFilter) {
      activeAlertFilter = activeAlertFilter === alertFilter ? "all" : alertFilter as PersonAlertFilter;
      renderBrowserList();
      return;
    }
    const filter = target.closest<HTMLButtonElement>("[data-person-filter]")?.dataset.personFilter;
    if (filter) {
      activeFilter = filter as PersonFilter;
      renderBrowserList();
      return;
    }
    const personButton = target.closest<HTMLButtonElement>("[data-person-id]");
    if (!personButton?.dataset.personId) return;
    const personId = Number(personButton.dataset.personId);
    if (!staffPicker) {
      requestPerson(personId);
      return;
    }
    const person = world.people.find((candidate) => candidate.id === personId);
    const profession = staffPickerProfession();
    const buildingId = staffPicker.buildingId;
    if (!person || !profession) return;
    const existingProfession = professionOf(world, person);
    if (
      existingProfession &&
      !await confirmDialog(`${personName(person.id)} ist bereits ${PROFESSION_LABELS[existingProfession]}. Beruf und Arbeitsplatz wirklich ändern?`, { title: "Person neu zuweisen", confirmLabel: "Neu zuweisen" })
    ) return;
    if (!setPersonProfession(world, person.id, profession) || !setPersonWorkplace(world, person.id, buildingId)) {
      await showDialog("Diese Person kann gerade nicht neu zugewiesen werden.", { title: "Neuzuweisung nicht möglich" });
      return;
    }
    returnToStaffBuilding();
  });

  inspector.addEventListener("click", (event) => {
    const target = event.target as HTMLElement;
    const action = target.closest<HTMLButtonElement>("[data-person-action]")?.dataset.personAction;
    if (action === "close-inspector") {
      window.dispatchEvent(new CustomEvent(PERSON_SELECTION_CLEAR_REQUESTED_EVENT));
      return;
    }
    if (action === "open-context") {
      window.dispatchEvent(new CustomEvent(PERSON_CONTEXT_TOGGLE_REQUESTED_EVENT));
      return;
    }
    const buildingLink = target.closest<HTMLButtonElement>("[data-person-building-id]");
    if (buildingLink?.dataset.personBuildingId) {
      const buildingId = buildingLink.dataset.personBuildingId;
      setBrowserOpen(false);
      window.dispatchEvent(new CustomEvent(BUILDING_SELECTION_REQUESTED_EVENT, {
        detail: { id: buildingId, focus: true },
      }));
      window.dispatchEvent(new CustomEvent(BUILDING_SELECTED_EVENT, {
        detail: { id: buildingId },
      }));
      return;
    }
    const equipmentButton = target.closest<HTMLButtonElement>("[data-equipment-slot]");
    if (equipmentButton && selectedPersonId !== undefined) {
      const slot = equipmentButton.dataset.equipmentSlot as EquipmentSlot;
      const person = world.people.find((candidate) => candidate.id === selectedPersonId);
      if (!person) return;
      if (equipmentForSlot(person, slot)) {
        unequipSlot(world, person.id, slot);
        inspectorSignature = "";
        renderInspector();
      } else {
        window.dispatchEvent(new CustomEvent(PERSON_EQUIPMENT_PICKER_REQUESTED_EVENT, {
          detail: { personId: person.id, slot },
        }));
      }
      return;
    }
  });

  const onPersonSelected = (event: Event): void => {
    const personId = (event as CustomEvent<PersonSelectedDetail>).detail.id;
    closeBuildingPanel();
    selectedPersonId = personId;
    inspectorSignature = "";
    renderInspector();
  };
  const onPersonCleared = (): void => clearPerson();
  const onWorldSelection = (): void => {
    clearPerson();
    setBrowserOpen(false);
  };
  const onModalMode = (event: Event): void => {
    if (!(event as CustomEvent<{ active: boolean }>).detail.active) return;
    clearPerson();
    setBrowserOpen(false);
  };

  window.addEventListener(PERSON_STAFF_PICKER_REQUESTED_EVENT, (event) => {
    staffPicker = (event as CustomEvent<StaffPickerDetail>).detail;
    resetBrowserFilters();
    renderBrowserMode();
    setBrowserOpen(true);
  });
  window.addEventListener(PERSON_SELECTED_EVENT, onPersonSelected);
  window.addEventListener(PERSON_CLEARED_EVENT, onPersonCleared);
  window.addEventListener(BUILDING_SELECTED_EVENT, onWorldSelection);
  window.addEventListener(TILE_SELECTED_EVENT, onWorldSelection);
  window.addEventListener(BUILD_MODE_EVENT, onModalMode);
  window.addEventListener(MERCHANT_TARGET_MODE_EVENT, onModalMode);
  const closeForOtherMenu = (): void => {
    staffPicker = undefined;
    renderBrowserMode();
    setBrowserOpen(false);
  };
  document.querySelector<HTMLButtonElement>("#build-menu-toggle")?.addEventListener("click", closeForOtherMenu);
  document.querySelector<HTMLButtonElement>("#handbook-toggle")?.addEventListener("click", closeForOtherMenu);
  document.querySelector<HTMLButtonElement>("#building-menu-toggle")?.addEventListener("click", closeForOtherMenu);
  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    if (!browser.hidden) {
      if (staffPicker) returnToStaffBuilding();
      else setBrowserOpen(false);
    }
    else if (selectedPersonId !== undefined)
      window.dispatchEvent(new CustomEvent(PERSON_SELECTION_CLEAR_REQUESTED_EVENT));
  });

  window.setInterval(() => {
    refreshAlerts();
    updateBrowserNeeds();
    renderInspector();
  }, 1000);

  renderAlertCounts();
  renderBrowserList();
}