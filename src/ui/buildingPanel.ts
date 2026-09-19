import type { Building, BuildingId, BuildingKind, World } from "../simulation/model";
import { buildingIcon } from "../icons";
import { buildingAlertMap, type BuildingAlertSeverity } from "./buildingAlerts";

const BUILDING_SELECTED_EVENT = "poc-building-selected";
const BUILDING_SELECTION_REQUESTED_EVENT = "poc-building-selection-requested";
const BUILD_MODE_EVENT = "poc-build-mode";
const MERCHANT_TARGET_MODE_EVENT = "poc-merchant-target-mode";
const UI_MENU_OPENED_EVENT = "poc-ui-menu-opened";

type BuildingAlertFilter = "all" | BuildingAlertSeverity;

const ALERT_META: Record<BuildingAlertSeverity, { icon: string; label: string }> = {
  critical: { icon: "🔴", label: "Kritisch" },
  warning: { icon: "🟡", label: "Wichtig" },
  info: { icon: "🔵", label: "Info" },
};

const BUILDING_LABELS: Record<BuildingKind, string> = {
  hq: "Hauptquartier",
  field: "Acker",
  farm: "Farm",
  sawmill: "Sägewerk",
  carpenter: "Schreinerei",
  mill: "Mühle",
  bakery: "Bäckerei",
  well: "Brunnen",
  pottery: "Töpferei",
  stonemason: "Steinmetzhütte",
  warehouse: "Lager",
  house: "Wohnhaus",
};

const escapeHtml = (value: string): string =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

const isVisibleBuilding = (building: Building): boolean =>
  !building.retired && building.kind !== "field";

const buildingState = (building: Building): string => {
  if (building.construction && !building.construction.complete) {
    const duration = Math.max(1, building.construction.duration);
    return `Im Bau · ${Math.round((building.construction.progress / duration) * 100)} %`;
  }
  return "Fertig";
};

export function mountBuildingPanel(world: World): void {
  const main = document.querySelector<HTMLElement>("main");
  const leftMenu = document.querySelector<HTMLElement>(".left-menu");
  if (!main || !leftMenu) return;

  const toggle = document.createElement("button");
  toggle.id = "building-menu-toggle";
  toggle.className = "left-menu-button";
  toggle.type = "button";
  toggle.setAttribute("aria-expanded", "false");
  toggle.setAttribute("aria-controls", "building-browser-panel");
  toggle.innerHTML = `
    <span class="building-menu-icon" aria-hidden="true">🏘️</span>
    <span class="left-menu-button-label">Gebäude</span>
    <span class="building-alert-badge" aria-label="Aktuelle Gebäudehinweise"></span>`;

  const buildToggle = leftMenu.querySelector("#build-menu-toggle");
  leftMenu.insertBefore(toggle, buildToggle);

  const browser = document.createElement("section");
  browser.id = "building-browser-panel";
  browser.className = "building-browser-panel";
  browser.hidden = true;
  browser.setAttribute("aria-label", "Gebäudeübersicht");
  browser.innerHTML = `
    <header class="building-panel-header">
      <div><small>GEBÄUDE</small><strong>Gebäude verwalten</strong></div>
      <button type="button" data-building-action="close" aria-label="Gebäudeübersicht schließen">×</button>
    </header>
    <div class="building-alert-filters" role="group" aria-label="Nach Hinweisstufe filtern">
      <button type="button" data-building-alert-filter="critical" aria-pressed="false"><span aria-hidden="true">🔴</span><strong data-building-alert-count="critical">0</strong><small>Kritisch</small></button>
      <button type="button" data-building-alert-filter="warning" aria-pressed="false"><span aria-hidden="true">🟡</span><strong data-building-alert-count="warning">0</strong><small>Wichtig</small></button>
      <button type="button" data-building-alert-filter="info" aria-pressed="false"><span aria-hidden="true">🔵</span><strong data-building-alert-count="info">0</strong><small>Info</small></button>
    </div>
    <div class="building-browser-summary"></div>
    <div class="building-browser-list"></div>`;
  main.append(browser);

  const list = browser.querySelector<HTMLElement>(".building-browser-list")!;
  const summary = browser.querySelector<HTMLElement>(".building-browser-summary")!;
  const alertFilterButtons = Array.from(
    browser.querySelectorAll<HTMLButtonElement>("[data-building-alert-filter]"),
  );
  const alertBadge = toggle.querySelector<HTMLElement>(".building-alert-badge")!;

  let activeAlertFilter: BuildingAlertFilter = "all";
  let alerts = buildingAlertMap(world);

  const matchingBuildings = (): Building[] =>
    world.buildings
      .filter(isVisibleBuilding)
      .filter((building) => {
        if (activeAlertFilter === "all") return true;
        return alerts.get(building.id)?.severity === activeAlertFilter;
      })
      .sort((a, b) => {
        const aAlert = alerts.has(a.id) ? 0 : 1;
        const bAlert = alerts.has(b.id) ? 0 : 1;
        return aAlert - bAlert || a.name.localeCompare(b.name, "de");
      });

  const renderList = (): void => {
    const buildings = matchingBuildings();
    const total = world.buildings.filter(isVisibleBuilding).length;
    summary.textContent = `${buildings.length} von ${total} Gebäuden`;
    list.innerHTML = buildings.length
      ? buildings.map((building) => {
          const alert = alerts.get(building.id);
          return `
            <button class="building-list-item" type="button" data-building-id="${building.id}">
              <span class="building-list-icon" aria-hidden="true">${buildingIcon(building.kind)}</span>
              <span class="building-list-copy">
                <strong>${escapeHtml(building.name || BUILDING_LABELS[building.kind])}</strong>
                <small>${buildingState(building)}</small>
                ${alert ? `<em class="building-list-alert building-list-alert--${alert.severity}">${escapeHtml(alert.label)}</em>` : ""}
              </span>
              <span class="building-list-open" aria-hidden="true">›</span>
            </button>`;
        }).join("")
      : `<div class="building-empty-state">Keine passenden Gebäude gefunden.</div>`;

    for (const button of alertFilterButtons) {
      button.setAttribute(
        "aria-pressed",
        String(button.dataset.buildingAlertFilter === activeAlertFilter),
      );
    }
  };

  const renderAlertCounts = (): void => {
    const counts: Record<BuildingAlertSeverity, number> = { critical: 0, warning: 0, info: 0 };
    for (const alert of alerts.values()) counts[alert.severity] += 1;

    for (const severity of Object.keys(counts) as BuildingAlertSeverity[]) {
      const counter = browser.querySelector<HTMLElement>(
        `[data-building-alert-count="${severity}"]`,
      );
      if (counter) counter.textContent = String(counts[severity]);
    }

    const visible = (Object.keys(counts) as BuildingAlertSeverity[]).filter(
      (severity) => counts[severity] > 0,
    );
    alertBadge.innerHTML = visible
      .map(
        (severity) =>
          `<span title="${ALERT_META[severity].label}">${ALERT_META[severity].icon}<b>${counts[severity]}</b></span>`,
      )
      .join("");
    alertBadge.hidden = visible.length === 0;
  };

  const refresh = (): void => {
    alerts = buildingAlertMap(world);
    renderAlertCounts();
    if (!browser.hidden) renderList();
  };

  const resetBrowserFilters = (): void => {
    activeAlertFilter = "all";
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

    const people = document.querySelector<HTMLElement>("#person-browser-panel");
    if (people && !people.hidden)
      document.querySelector<HTMLButtonElement>('[data-person-action="close-browser"]')?.click();
  };

  const setOpen = (open: boolean): void => {
    browser.hidden = !open;
    toggle.setAttribute("aria-expanded", String(open));
    toggle.classList.toggle("active", open);
    if (open) {
      window.dispatchEvent(new CustomEvent(UI_MENU_OPENED_EVENT, { detail: { menu: "buildings" } }));
      closeConflictingMenus();
      renderList();
    } else {
      resetBrowserFilters();
    }
  };

  const requestBuilding = (buildingId: BuildingId): void => {
    setOpen(false);
    window.dispatchEvent(
      new CustomEvent(BUILDING_SELECTION_REQUESTED_EVENT, {
        detail: { id: buildingId, focus: true },
      }),
    );
    window.dispatchEvent(
      new CustomEvent(BUILDING_SELECTED_EVENT, {
        detail: { id: buildingId },
      }),
    );
  };

  toggle.addEventListener("click", () => {
    refresh();
    setOpen(browser.hidden);
  });

  browser.addEventListener("click", (event) => {
    const target = event.target as HTMLElement;
    if (target.closest('[data-building-action="close"]')) {
      setOpen(false);
      return;
    }

    const alertFilter = target.closest<HTMLButtonElement>(
      "[data-building-alert-filter]",
    )?.dataset.buildingAlertFilter;
    if (alertFilter) {
      activeAlertFilter =
        activeAlertFilter === alertFilter ? "all" : (alertFilter as BuildingAlertFilter);
      renderList();
      return;
    }

    const buildingButton = target.closest<HTMLButtonElement>("[data-building-id]");
    if (buildingButton?.dataset.buildingId) requestBuilding(buildingButton.dataset.buildingId);
  });

  document.querySelector<HTMLButtonElement>("#build-menu-toggle")?.addEventListener(
    "click",
    () => setOpen(false),
  );
  document.querySelector<HTMLButtonElement>("#handbook-toggle")?.addEventListener(
    "click",
    () => setOpen(false),
  );
  document.querySelector<HTMLButtonElement>("#person-menu-toggle")?.addEventListener(
    "click",
    () => setOpen(false),
  );

  const closeForModal = (event: Event): void => {
    if ((event as CustomEvent<{ active: boolean }>).detail.active) setOpen(false);
  };
  window.addEventListener(BUILD_MODE_EVENT, closeForModal);
  window.addEventListener(MERCHANT_TARGET_MODE_EVENT, closeForModal);

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !browser.hidden) setOpen(false);
  });

  window.setInterval(refresh, 1000);
  refresh();
  renderList();
}
