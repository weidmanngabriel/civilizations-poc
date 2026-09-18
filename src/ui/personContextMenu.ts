import type { Person, Profession, World } from "../simulation/model";
import { currentProfession, PROFESSION_LABELS } from "../simulation/experience";
import {
  canChangePersonProfession,
  commandEat,
  commandSleep,
  setPersonProfession,
  validHomes,
  validWorkplaces,
} from "../simulation/personCommands";
import { supportsWorkArea } from "../simulation/simulation";
import {
  PERSON_COMMAND_MODE_EVENT,
  PERSON_COMMAND_COMPLETED_EVENT,
  type PersonCommandMode,
} from "../game/personCommandInteraction";
import { WORK_AREA_MODE_EVENT } from "../game/workAreaInteraction";

const PERSON_SELECTED_EVENT = "poc-person-selected";
const PERSON_CLEARED_EVENT = "poc-person-selection-cleared";
const PERSON_SELECTION_REQUESTED_EVENT = "poc-person-selection-requested";
const BUILD_MODE_EVENT = "poc-build-mode";
const MERCHANT_TARGET_MODE_EVENT = "poc-merchant-target-mode";

type ActionId =
  | "profession"
  | "workplace"
  | "home"
  | "workarea"
  | "move"
  | "eat"
  | "sleep";

type Action = {
  id: ActionId;
  slot: number;
  icon: string;
  label: string;
};

const ACTIONS: Action[] = [
  { id: "profession", slot: 1, icon: "🧰", label: "Beruf" },
  { id: "workplace", slot: 2, icon: "🏭", label: "Arbeitsplatz" },
  { id: "home", slot: 3, icon: "🏠", label: "Wohnung" },
  { id: "workarea", slot: 4, icon: "🚩", label: "Arbeitsbereich" },
  { id: "move", slot: 5, icon: "👣", label: "Bewegen" },
  { id: "eat", slot: 6, icon: "🍞", label: "Essen" },
  { id: "sleep", slot: 7, icon: "💤", label: "Schlafen" },
];

const isEditableTarget = (target: EventTarget | null): boolean => {
  const element = target as HTMLElement | null;
  return Boolean(element?.closest("input, textarea, select, [contenteditable='true']"));
};

export function mountPersonContextMenu(world: World): void {
  const main = document.querySelector<HTMLElement>("main");
  const inspector = document.querySelector<HTMLElement>("#person-inspector");
  if (!main || !inspector) return;

  const menu = document.createElement("section");
  menu.id = "person-context-menu";
  menu.className = "person-context-menu";
  menu.hidden = true;
  menu.setAttribute("aria-label", "Aktionen für ausgewählte Person");
  menu.innerHTML = `
    <div class="person-context-frame" role="menu"></div>
    <div class="person-context-picker" hidden>
      <header><strong>Beruf wählen</strong><button type="button" data-context-close-picker aria-label="Berufsauswahl schließen">×</button></header>
      <div class="person-context-professions"></div>
    </div>`;
  main.append(menu);

  const modeOverlay = document.createElement("div");
  modeOverlay.className = "person-command-overlay";
  modeOverlay.hidden = true;
  modeOverlay.innerHTML = `
    <div><small>PERSONENBEFEHL</small><strong></strong><span></span></div>
    <button type="button" class="danger" data-person-command-cancel>Abbrechen</button>`;
  main.append(modeOverlay);

  const frame = menu.querySelector<HTMLElement>(".person-context-frame")!;
  const picker = menu.querySelector<HTMLElement>(".person-context-picker")!;
  const professionList = menu.querySelector<HTMLElement>(".person-context-professions")!;
  const overlayTitle = modeOverlay.querySelector<HTMLElement>("strong")!;
  const overlayHint = modeOverlay.querySelector<HTMLElement>("span")!;

  let selectedPersonId: number | undefined;
  let activeMode: PersonCommandMode | undefined;

  const selectedPerson = (): Person | undefined =>
    selectedPersonId === undefined
      ? undefined
      : world.people.find((person) => person.id === selectedPersonId);

  const actionVisible = (action: Action, person: Person): boolean => {
    if (action.id === "profession") return canChangePersonProfession(person);
    if (action.id === "workplace") return validWorkplaces(world, person.id).length > 0;
    if (action.id === "home") return validHomes(world).length > 0;
    if (action.id === "workarea") return supportsWorkArea(person);
    if (action.id === "eat") return (person.hunger ?? 100) < 100;
    if (action.id === "sleep") return (person.sleep ?? 100) < 100;
    return true;
  };

  const renderMenu = (): void => {
    const person = selectedPerson();
    if (!person || menu.hidden) return;
    frame.innerHTML = ACTIONS
      .filter((action) => actionVisible(action, person))
      .map((action) => `
        <button type="button" role="menuitem" class="person-context-action slot-${action.slot}" data-context-action="${action.id}">
          <span aria-hidden="true">${action.icon}</span><small>${action.label}</small>
        </button>`)
      .join("");
  };

  const renderProfessionPicker = (): void => {
    const person = selectedPerson();
    if (!person) return;
    const current = currentProfession(world, person);
    professionList.innerHTML = [
      `<button type="button" data-profession="" aria-pressed="${current === undefined}">👤 Frei</button>`,
      ...(Object.entries(PROFESSION_LABELS) as [Profession, string][]).map(([profession, label]) =>
        `<button type="button" data-profession="${profession}" aria-pressed="${current === profession}">${label}</button>`,
      ),
    ].join("");
  };

  const setMenuOpen = (open: boolean): void => {
    if (open && !selectedPerson()) return;
    menu.hidden = !open;
    picker.hidden = true;
    if (open) renderMenu();
  };

  const refreshInspectorButton = (): void => {
    const person = selectedPerson();
    let button = inspector.querySelector<HTMLButtonElement>("[data-person-context-toggle]");
    if (!person || inspector.hidden) {
      button?.remove();
      return;
    }
    if (!button) {
      button = document.createElement("button");
      button.type = "button";
      button.className = "person-context-toggle";
      button.dataset.personContextToggle = "true";
      button.innerHTML = '<span aria-hidden="true">▦</span><span>Aktionen</span>';
      button.addEventListener("click", () => setMenuOpen(menu.hidden));
      const listButton = inspector.querySelector<HTMLElement>("[data-person-action='open-browser']");
      if (listButton) inspector.insertBefore(button, listButton);
      else inspector.append(button);
    }
  };

  const beginMode = (mode: PersonCommandMode): void => {
    const person = selectedPerson();
    if (!person) return;
    activeMode = mode;
    setMenuOpen(false);
    const copy = mode === "move"
      ? ["Ziel wählen", "Tippe oder klicke auf die Stelle, zu der die Person gehen soll."]
      : mode === "workplace"
        ? ["Arbeitsplatz wählen", "Hervorgehobene Gebäude sind gültige Arbeitsplätze."]
        : ["Wohnung wählen", "Hervorgehobene Wohnhäuser sind gültige Wohnungen."];
    overlayTitle.textContent = copy[0];
    overlayHint.textContent = copy[1];
    modeOverlay.hidden = false;
    window.dispatchEvent(new CustomEvent(PERSON_COMMAND_MODE_EVENT, {
      detail: { active: true, personId: person.id, mode },
    }));
  };

  const cancelMode = (): void => {
    if (!activeMode) return;
    activeMode = undefined;
    modeOverlay.hidden = true;
    window.dispatchEvent(new CustomEvent(PERSON_COMMAND_MODE_EVENT, { detail: { active: false } }));
  };

  frame.addEventListener("click", (event) => {
    const button = (event.target as HTMLElement).closest<HTMLButtonElement>("[data-context-action]");
    const person = selectedPerson();
    if (!button || !person) return;
    const action = button.dataset.contextAction as ActionId;
    if (action === "profession") {
      renderProfessionPicker();
      picker.hidden = false;
      return;
    }
    if (action === "workplace") return beginMode("workplace");
    if (action === "home") return beginMode("home");
    if (action === "move") return beginMode("move");
    if (action === "workarea") {
      setMenuOpen(false);
      window.dispatchEvent(new CustomEvent(WORK_AREA_MODE_EVENT, {
        detail: { active: true, personId: person.id },
      }));
      return;
    }
    if (action === "eat") commandEat(world, person.id);
    if (action === "sleep") commandSleep(world, person.id);
    setMenuOpen(false);
    window.dispatchEvent(new CustomEvent(PERSON_SELECTION_REQUESTED_EVENT, {
      detail: { id: person.id, focus: false },
    }));
  });

  picker.addEventListener("click", (event) => {
    const close = (event.target as HTMLElement).closest("[data-context-close-picker]");
    if (close) {
      picker.hidden = true;
      return;
    }
    const button = (event.target as HTMLElement).closest<HTMLButtonElement>("[data-profession]");
    const person = selectedPerson();
    if (!button || !person) return;
    const profession = button.dataset.profession as Profession | "";
    if (!setPersonProfession(world, person.id, profession || undefined)) return;
    picker.hidden = true;
    renderMenu();
    window.dispatchEvent(new CustomEvent(PERSON_SELECTION_REQUESTED_EVENT, {
      detail: { id: person.id, focus: false },
    }));
  });

  modeOverlay.querySelector("[data-person-command-cancel]")?.addEventListener("click", cancelMode);

  window.addEventListener(PERSON_SELECTED_EVENT, (event) => {
    selectedPersonId = (event as CustomEvent<{ id: number }>).detail.id;
    refreshInspectorButton();
    if (!menu.hidden) renderMenu();
  });
  window.addEventListener(PERSON_CLEARED_EVENT, () => {
    selectedPersonId = undefined;
    setMenuOpen(false);
    cancelMode();
    refreshInspectorButton();
  });
  window.addEventListener(PERSON_COMMAND_MODE_EVENT, (event) => {
    const detail = (event as CustomEvent<{ active: boolean; mode?: PersonCommandMode }>).detail;
    if (!detail.active) {
      activeMode = undefined;
      modeOverlay.hidden = true;
    }
  });
  window.addEventListener(PERSON_COMMAND_COMPLETED_EVENT, () => {
    const person = selectedPerson();
    if (person)
      window.dispatchEvent(new CustomEvent(PERSON_SELECTION_REQUESTED_EVENT, {
        detail: { id: person.id, focus: false },
      }));
  });
  window.addEventListener(BUILD_MODE_EVENT, () => setMenuOpen(false));
  window.addEventListener(MERCHANT_TARGET_MODE_EVENT, () => setMenuOpen(false));
  window.addEventListener(WORK_AREA_MODE_EVENT, (event) => {
    if ((event as CustomEvent<{ active: boolean }>).detail.active) setMenuOpen(false);
  });

  document.addEventListener("keydown", (event) => {
    if (isEditableTarget(event.target)) return;
    if (event.code === "Space" && selectedPersonId !== undefined && !activeMode) {
      event.preventDefault();
      setMenuOpen(menu.hidden);
      return;
    }
    if (event.key === "Escape" && !menu.hidden) {
      event.preventDefault();
      setMenuOpen(false);
    }
  });

  new MutationObserver(() => queueMicrotask(refreshInspectorButton)).observe(inspector, {
    childList: true,
    subtree: true,
  });
}
