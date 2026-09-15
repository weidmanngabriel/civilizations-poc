import type { World } from "../simulation/model";
import {
  supportsWorkArea,
  WORK_AREA_RADIUS_WORLD_TILES,
} from "../simulation/simulation";
import {
  WORK_AREA_CHANGED_EVENT,
  WORK_AREA_MODE_EVENT,
} from "../game/workAreaInteraction";

const PERSON_SELECTED_EVENT = "poc-person-selected";
const PERSON_CLEARED_EVENT = "poc-person-selection-cleared";

export function installWorkAreaControls(world: World): void {
  const inspector = document.querySelector<HTMLElement>("#person-inspector");
  if (!inspector) return;

  let selectedPersonId: number | undefined;
  let modePersonId: number | undefined;

  const dispatchMode = (active: boolean): void => {
    modePersonId = active ? selectedPersonId : undefined;
    window.dispatchEvent(new CustomEvent(WORK_AREA_MODE_EVENT, {
      detail: { active, personId: active ? selectedPersonId : undefined },
    }));
    syncControl();
  };

  const syncControl = (): void => {
    const existing = inspector.querySelector<HTMLButtonElement>("[data-work-area-control]");
    const person = selectedPersonId === undefined
      ? undefined
      : world.people.find((candidate) => candidate.id === selectedPersonId);
    if (!person || !supportsWorkArea(person) || inspector.hidden) {
      existing?.remove();
      if (modePersonId !== undefined) dispatchMode(false);
      return;
    }

    const button = existing ?? document.createElement("button");
    const isActive = modePersonId === person.id;
    const label = isActive
      ? "🚩 Karte antippen · Abbrechen"
      : `🚩 Arbeitsflagge versetzen · ${WORK_AREA_RADIUS_WORLD_TILES} Kacheln`;
    button.type = "button";
    button.className = "person-open-list";
    button.dataset.workAreaControl = "true";
    button.setAttribute("aria-pressed", String(isActive));
    if (button.textContent !== label) button.textContent = label;
    if (!existing) {
      button.addEventListener("click", () => {
        dispatchMode(modePersonId !== selectedPersonId);
      });
      const listButton = inspector.querySelector<HTMLElement>(".person-open-list");
      if (listButton) inspector.insertBefore(button, listButton);
      else inspector.append(button);
    }
  };

  window.addEventListener(PERSON_SELECTED_EVENT, (event) => {
    const next = (event as CustomEvent<{ id: number }>).detail.id;
    if (modePersonId !== undefined && modePersonId !== next) dispatchMode(false);
    selectedPersonId = next;
    queueMicrotask(syncControl);
  });
  window.addEventListener(PERSON_CLEARED_EVENT, () => {
    selectedPersonId = undefined;
    if (modePersonId !== undefined) dispatchMode(false);
    syncControl();
  });
  window.addEventListener(WORK_AREA_MODE_EVENT, (event) => {
    const detail = (event as CustomEvent<{ active: boolean; personId?: number }>).detail;
    modePersonId = detail.active ? detail.personId : undefined;
    queueMicrotask(syncControl);
  });
  window.addEventListener(WORK_AREA_CHANGED_EVENT, () => {
    modePersonId = undefined;
    queueMicrotask(syncControl);
  });

  new MutationObserver(() => queueMicrotask(syncControl)).observe(inspector, {
    childList: true,
    subtree: true,
  });
}
