import type { Building, BuildingId, World } from "../simulation/model";
import { assigned } from "../simulation/simulation";
import { personName } from "../simulation/personIdentity";
import { personAlertMap, type PersonAlertSeverity } from "./personAlerts";

export type GameNotificationSeverity = PersonAlertSeverity;
export type GameNotification =
  | {
      id: string;
      kind: "person";
      severity: GameNotificationSeverity;
      title: string;
      label: string;
      personId: number;
    }
  | {
      id: string;
      kind: "building";
      severity: GameNotificationSeverity;
      title: string;
      label: string;
      buildingId: BuildingId;
    };

const isCompleted = (building: Building): boolean =>
  !building.retired && (!building.construction || building.construction.complete);

export const buildingNeedsWorker = (world: World, building: Building): boolean =>
  isCompleted(building) &&
  building.kind !== "field" &&
  building.kind !== "hq" &&
  building.workers > 0 &&
  assigned(world, building.id, "worker").length === 0;

export const buildingNotifications = (world: World): GameNotification[] =>
  world.buildings
    .filter((building) => buildingNeedsWorker(world, building))
    .map((building) => ({
      id: `building:${building.id}:worker-needed`,
      kind: "building" as const,
      severity: "warning" as const,
      title: building.name,
      label: "Fertig · kein Arbeiter zugewiesen",
      buildingId: building.id,
    }));

export const gameNotifications = (world: World): GameNotification[] => {
  const people: GameNotification[] = [...personAlertMap(world)].map(([personId, alert]) => ({
    id: `person:${personId}:${alert.code}`,
    kind: "person",
    severity: alert.severity,
    title: personName(personId),
    label: alert.label,
    personId,
  }));

  return [...buildingNotifications(world), ...people].sort((a, b) => {
    const rank: Record<GameNotificationSeverity, number> = { critical: 0, warning: 1, info: 2 };
    return rank[a.severity] - rank[b.severity] || a.title.localeCompare(b.title, "de");
  });
};

const BUILDING_SELECTED_EVENT = "poc-building-selected";
const BUILDING_SELECTION_REQUESTED_EVENT = "poc-building-selection-requested";
const PERSON_SELECTION_REQUESTED_EVENT = "poc-person-selection-requested";

const iconFor = (notification: GameNotification): string =>
  notification.kind === "building" ? "🏠" : "👤";

export function mountGameNotifications(world: World): void {
  const main = document.querySelector<HTMLElement>("main");
  const leftMenu = document.querySelector<HTMLElement>(".left-menu");
  if (!main || !leftMenu) return;

  const toggle = document.createElement("button");
  toggle.id = "notification-menu-toggle";
  toggle.className = "left-menu-button notification-menu-toggle";
  toggle.type = "button";
  toggle.setAttribute("aria-expanded", "false");
  toggle.setAttribute("aria-controls", "notification-panel");
  toggle.innerHTML = `
    <span class="notification-menu-icon" aria-hidden="true">🔔</span>
    <span class="left-menu-button-label">Hinweise</span>
    <span class="notification-count" hidden></span>`;

  const buildToggle = leftMenu.querySelector("#build-menu-toggle");
  leftMenu.insertBefore(toggle, buildToggle);

  const panel = document.createElement("section");
  panel.id = "notification-panel";
  panel.className = "notification-panel";
  panel.hidden = true;
  panel.innerHTML = `
    <header class="notification-panel-header">
      <div><small>HINWEISE</small><strong>Was braucht Aufmerksamkeit?</strong></div>
      <button type="button" data-notification-action="close" aria-label="Hinweise schließen">×</button>
    </header>
    <div class="notification-list"></div>`;
  main.append(panel);

  const list = panel.querySelector<HTMLElement>(".notification-list")!;
  const count = toggle.querySelector<HTMLElement>(".notification-count")!;
  let signature = "";

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
    panel.hidden = !open;
    toggle.classList.toggle("active", open);
    toggle.setAttribute("aria-expanded", String(open));
    if (open) closeConflictingMenus();
  };

  const render = (): void => {
    const notifications = gameNotifications(world);
    const nextSignature = notifications
      .map((notification) => `${notification.id}:${notification.severity}:${notification.label}`)
      .join("|");
    if (nextSignature === signature) return;
    signature = nextSignature;

    count.textContent = String(notifications.length);
    count.hidden = notifications.length === 0;

    list.innerHTML = notifications.length
      ? notifications.map((notification) => `
          <button type="button" class="notification-item notification-item--${notification.severity}"
            data-notification-kind="${notification.kind}"
            data-notification-id="${notification.kind === "building" ? notification.buildingId : notification.personId}">
            <span class="notification-item-icon" aria-hidden="true">${iconFor(notification)}</span>
            <span class="notification-item-copy">
              <strong>${notification.title}</strong>
              <small>${notification.label}</small>
            </span>
            <span class="notification-item-severity" aria-hidden="true">${notification.severity === "critical" ? "🔴" : notification.severity === "warning" ? "🟡" : "🔵"}</span>
          </button>`).join("")
      : `<div class="notification-empty">Aktuell gibt es keine Hinweise.</div>`;
  };

  toggle.addEventListener("click", () => {
    render();
    setOpen(panel.hidden);
  });

  panel.addEventListener("click", (event) => {
    const target = event.target as HTMLElement;
    if (target.closest('[data-notification-action="close"]')) {
      setOpen(false);
      return;
    }
    const button = target.closest<HTMLButtonElement>("[data-notification-kind]");
    if (!button) return;
    setOpen(false);
    if (button.dataset.notificationKind === "building") {
      const id = button.dataset.notificationId as BuildingId;
      window.dispatchEvent(new CustomEvent(BUILDING_SELECTION_REQUESTED_EVENT, {
        detail: { id, focus: true },
      }));
      window.dispatchEvent(new CustomEvent(BUILDING_SELECTED_EVENT, { detail: { id } }));
      return;
    }
    const id = Number(button.dataset.notificationId);
    window.dispatchEvent(new CustomEvent(PERSON_SELECTION_REQUESTED_EVENT, {
      detail: { id, focus: true },
    }));
  });

  document.querySelector<HTMLButtonElement>("#build-menu-toggle")?.addEventListener("click", () => setOpen(false));
  document.querySelector<HTMLButtonElement>("#handbook-toggle")?.addEventListener("click", () => setOpen(false));
  document.querySelector<HTMLButtonElement>("#person-menu-toggle")?.addEventListener("click", () => setOpen(false));
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !panel.hidden) setOpen(false);
  });

  window.setInterval(render, 1000);
  render();
}
