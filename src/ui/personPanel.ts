import type { Person, Profession, World } from "../simulation/model";
import {
  currentProfession,
  PROFESSION_LABELS,
  professionExperience,
} from "../simulation/experience";
import { GOODS } from "../simulation/simulation";
import { personName } from "../simulation/personIdentity";
import { GOOD_ICONS } from "../icons";
import { personActivityLabel } from "../personPresentation";
import { personAlertMap, type PersonAlertSeverity } from "./personAlerts";

const PERSON_SELECTED_EVENT = "poc-person-selected";
const PERSON_CLEARED_EVENT = "poc-person-selection-cleared";
const PERSON_SELECTION_REQUESTED_EVENT = "poc-person-selection-requested";
const PERSON_SELECTION_CLEAR_REQUESTED_EVENT = "poc-person-selection-clear-requested";
const BUILDING_SELECTED_EVENT = "poc-building-selected";
const TILE_SELECTED_EVENT = "poc-tile-selected";
const BUILD_MODE_EVENT = "poc-build-mode";
const MERCHANT_TARGET_MODE_EVENT = "poc-merchant-target-mode";

type PersonSelectedDetail = { id: number };
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

const cargoLabel = (person: Person): string =>
  person.trip?.picked
    ? `${GOOD_ICONS[person.trip.good]} ${GOODS[person.trip.good]}`
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
      <div><small>BEWOHNER</small><strong>Personen finden</strong></div>
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

  let selectedPersonId: number | undefined;
  let activeFilter: PersonFilter = "all";
  let activeAlertFilter: PersonAlertFilter = "all";
  let alerts = personAlertMap(world);
  let searchQuery = "";
  let navigationIds = world.people.map((person) => person.id);
  let inspectorSignature = "";
  let browserProfessionSignature = "";

  const matchingPeople = (): Person[] => {
    const query = searchQuery.trim().toLocaleLowerCase("de-DE");
    return world.people
      .filter((person) => {
        const profession = professionOf(world, person);
        const alert = alerts.get(person.id);
        if (activeAlertFilter !== "all" && alert?.severity !== activeAlertFilter) return false;
        if (activeFilter === "free" && profession) return false;
        if (activeFilter !== "all" && activeFilter !== "free" && profession !== activeFilter)
          return false;
        if (!query) return true;
        return (
          personName(person.id).toLocaleLowerCase("de-DE").includes(query) ||
          professionLabel(world, person).toLocaleLowerCase("de-DE").includes(query)
        );
      })
      .sort((a, b) => personName(a.id).localeCompare(personName(b.id), "de"));
  };

  const renderBrowserList = (): void => {
    const people = matchingPeople();
    navigationIds = people.map((person) => person.id);
    summary.textContent = `${people.length} von ${world.people.length} Personen`;
    list.innerHTML = people.length
      ? people.map((person) => `
          <button class="person-list-item" type="button" data-person-id="${person.id}">
            <span class="person-list-avatar" aria-hidden="true">${professionIcon(world, person)}</span>
            <span class="person-list-copy">
              <strong>${escapeHtml(personName(person.id))}</strong>
              <small>${escapeHtml(professionLabel(world, person))}</small>
              ${alerts.has(person.id) ? `<em class="person-list-alert person-list-alert--${alerts.get(person.id)!.severity}">${escapeHtml(alerts.get(person.id)!.label)}</em>` : ""}
            </span>
            <span class="person-list-needs">
              <span title="Hunger">🍴 <b data-person-hunger="${person.id}">${displayNeed(person.hunger)}</b></span>
              <span title="Schlaf">💤 <b data-person-sleep="${person.id}">${displayNeed(person.sleep)}</b></span>
            </span>
          </button>`).join("")
      : `<div class="person-empty-state">Keine passende Person gefunden.</div>`;

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
  const currentNavigation = (): number[] => {
    if (
      selectedPersonId !== undefined &&
      navigationIds.includes(selectedPersonId) &&
      navigationIds.length
    ) return navigationIds;
    return world.people.map((person) => person.id);
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
    const cargo = cargoLabel(person);
    const ids = currentNavigation();
    const index = Math.max(0, ids.indexOf(person.id));
    const signature = [
      person.id,
      professionText,
      experience ?? "",
      hunger,
      sleep,
      workplace,
      activity,
      cargo,
      ids.join(","),
    ].join("|");
    if (signature === inspectorSignature && !inspector.hidden) return;
    inspectorSignature = signature;
    inspector.hidden = false;
    inspector.innerHTML = `
      <header class="person-panel-header person-inspector-header">
        <div>
          <small>${escapeHtml(professionText)}</small>
          <strong>${escapeHtml(personName(person.id))}</strong>
        </div>
        <button type="button" data-person-action="close-inspector" aria-label="Person schließen">×</button>
      </header>
      <div class="person-inspector-nav">
        <button type="button" data-person-nav="prev" aria-label="Vorherige Person">←</button>
        <span>${index + 1} / ${ids.length}</span>
        <button type="button" data-person-nav="next" aria-label="Nächste Person">→</button>
      </div>
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
      <dl class="person-facts">
        <div><dt>Aktuell</dt><dd>${escapeHtml(activity)}</dd></div>
        <div><dt>Arbeitsplatz</dt><dd>${escapeHtml(workplace)}</dd></div>
        <div><dt>Erfahrung</dt><dd>${experience === undefined ? "—" : `${experience} %`}</dd></div>
        <div><dt>Getragen</dt><dd>${cargo}</dd></div>
      </dl>
      <button class="person-open-list" type="button" data-person-action="open-browser">Personenliste öffnen</button>`;
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

  const setBrowserOpen = (open: boolean): void => {
    browser.hidden = !open;
    toggle.setAttribute("aria-expanded", String(open));
    toggle.classList.toggle("active", open);
    if (open) {
      closeConflictingMenus();
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

  toggle.addEventListener("click", () => setBrowserOpen(browser.hidden));
  search.addEventListener("input", () => {
    searchQuery = search.value;
    renderBrowserList();
  });

  browser.addEventListener("click", (event) => {
    const target = event.target as HTMLElement;
    const action = target.closest<HTMLButtonElement>("[data-person-action]")?.dataset.personAction;
    if (action === "close-browser") {
      setBrowserOpen(false);
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
    if (personButton?.dataset.personId) requestPerson(Number(personButton.dataset.personId));
  });

  inspector.addEventListener("click", (event) => {
    const target = event.target as HTMLElement;
    const action = target.closest<HTMLButtonElement>("[data-person-action]")?.dataset.personAction;
    if (action === "close-inspector") {
      window.dispatchEvent(new CustomEvent(PERSON_SELECTION_CLEAR_REQUESTED_EVENT));
      return;
    }
    if (action === "open-browser") {
      setBrowserOpen(true);
      return;
    }
    const direction = target.closest<HTMLButtonElement>("[data-person-nav]")?.dataset.personNav;
    if (!direction || selectedPersonId === undefined) return;
    const ids = currentNavigation();
    if (!ids.length) return;
    const currentIndex = Math.max(0, ids.indexOf(selectedPersonId));
    const delta = direction === "prev" ? -1 : 1;
    requestPerson(ids[(currentIndex + delta + ids.length) % ids.length]!);
  });

  const onPersonSelected = (event: Event): void => {
    const personId = (event as CustomEvent<PersonSelectedDetail>).detail.id;
    closeBuildingPanel();
    selectedPersonId = personId;
    if (!navigationIds.includes(personId)) navigationIds = world.people.map((person) => person.id);
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

  window.addEventListener(PERSON_SELECTED_EVENT, onPersonSelected);
  window.addEventListener(PERSON_CLEARED_EVENT, onPersonCleared);
  window.addEventListener(BUILDING_SELECTED_EVENT, onWorldSelection);
  window.addEventListener(TILE_SELECTED_EVENT, onWorldSelection);
  window.addEventListener(BUILD_MODE_EVENT, onModalMode);
  window.addEventListener(MERCHANT_TARGET_MODE_EVENT, onModalMode);
  document.querySelector<HTMLButtonElement>("#build-menu-toggle")?.addEventListener("click", () => setBrowserOpen(false));
  document.querySelector<HTMLButtonElement>("#handbook-toggle")?.addEventListener("click", () => setBrowserOpen(false));
  document.querySelector<HTMLButtonElement>("#building-menu-toggle")?.addEventListener("click", () => setBrowserOpen(false));
  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    if (!browser.hidden) setBrowserOpen(false);
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