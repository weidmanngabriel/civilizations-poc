import type { EquipmentGood, EquipmentSlot, Person, Profession, World } from "../simulation/model";
import { canLearnProfession, currentProfession, PROFESSION_LABELS } from "../simulation/experience";
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
import { assignEquipment, EQUIPMENT_DEFINITIONS, equipmentForSlot, equipmentPendingForSlot, equipmentStock } from "../simulation/equipment";

const PERSON_SELECTED_EVENT = "poc-person-selected";
const PERSON_CLEARED_EVENT = "poc-person-selection-cleared";
const PERSON_SELECTION_REQUESTED_EVENT = "poc-person-selection-requested";
const BUILD_MODE_EVENT = "poc-build-mode";
const MERCHANT_TARGET_MODE_EVENT = "poc-merchant-target-mode";
const PERSON_CONTEXT_TOGGLE_REQUESTED_EVENT = "poc-person-context-toggle-requested";
const UI_MENU_OPENED_EVENT = "poc-ui-menu-opened";
const WAYPOST_PLACEMENT_REQUESTED_EVENT = "poc-waypost-placement-requested";
export const PERSON_EQUIPMENT_PICKER_REQUESTED_EVENT = "poc-person-equipment-picker-requested";

type ActionId =
  | "profession"
  | "workplace"
  | "home"
  | "workarea"
  | "move"
  | "eat"
  | "sleep"
  | "waypost"
  | "equipment";

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
  { id: "waypost", slot: 8, icon: "🪧", label: "Wegweiser" },
  { id: "equipment", slot: 9, icon: "🎒", label: "Ausrüstung" },
];

const isEditableTarget = (target: EventTarget | null): boolean => {
  const element = target as HTMLElement | null;
  return Boolean(element?.closest("input, textarea, select, [contenteditable='true']"));
};

export function mountPersonContextMenu(world: World): void {
  const main = document.querySelector<HTMLElement>("main");
  if (!main) return;

  const menu = document.createElement("section");
  menu.id = "person-context-menu";
  menu.className = "person-context-menu";
  menu.hidden = true;
  menu.setAttribute("aria-label", "Aktionen für ausgewählte Person");
  menu.innerHTML = `
    <div class="person-context-frame" role="menu"></div>`;
  main.append(menu);

  const pickerBackdrop = document.createElement("div");
  pickerBackdrop.className = "person-context-picker-backdrop";
  pickerBackdrop.hidden = true;
  pickerBackdrop.innerHTML = `
    <section class="person-context-picker" role="dialog" aria-modal="true" aria-label="Personenauswahl">
      <header><strong data-context-picker-title>Auswahl</strong><button type="button" data-context-close-picker aria-label="Auswahl schließen">×</button></header>
      <div class="person-context-professions"></div>
      <div class="person-context-equipment" hidden></div>
    </section>`;
  main.append(pickerBackdrop);

  const modeOverlay = document.createElement("div");
  modeOverlay.className = "person-command-overlay";
  modeOverlay.hidden = true;
  modeOverlay.innerHTML = `
    <div><small>PERSONENBEFEHL</small><strong></strong><span></span></div>
    <button type="button" class="danger" data-person-command-cancel>Abbrechen</button>`;
  main.append(modeOverlay);

  const frame = menu.querySelector<HTMLElement>(".person-context-frame")!;
  const picker = pickerBackdrop.querySelector<HTMLElement>(".person-context-picker")!;
  const professionList = picker.querySelector<HTMLElement>(".person-context-professions")!;
  const equipmentList = picker.querySelector<HTMLElement>(".person-context-equipment")!;
  const pickerTitle = picker.querySelector<HTMLElement>("[data-context-picker-title]")!;
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
    if (action.id === "waypost") return currentProfession(world, person) === "scout";
    return true;
  };

  const renderMenu = (): void => {
    const person = selectedPerson();
    if (!person || menu.hidden) return;
    const placeholders = Array.from({ length: 16 }, (_, index) =>
      `<span class="person-context-placeholder slot-${index + 1}" aria-hidden="true"></span>`,
    ).join("");
    const actions = ACTIONS
      .filter((action) => actionVisible(action, person))
      .map((action) => `
        <button type="button" role="menuitem" class="person-context-action slot-${action.slot}" data-context-action="${action.id}">
          <span aria-hidden="true">${action.icon}</span><small>${action.label}</small>
        </button>`)
      .join("");
    frame.innerHTML = placeholders + actions;
  };

  const renderProfessionPicker = (): void => {
    const person = selectedPerson();
    if (!person) return;
    pickerTitle.textContent = "Beruf wählen";
    professionList.hidden = false;
    equipmentList.hidden = true;
    const current = currentProfession(world, person);
    professionList.innerHTML = [
      `<button type="button" data-profession="" aria-pressed="${current === undefined}">👤 Frei</button>`,
      ...(Object.entries(PROFESSION_LABELS) as [Profession, string][])
        .filter(([profession]) => canLearnProfession(person, profession))
        .sort((a, b) => a[1].localeCompare(b[1], "de"))
        .map(([profession, label]) =>
          `<button type="button" data-profession="${profession}" aria-pressed="${current === profession}">${label}</button>`,
        ),
    ].join("");
  };

  const renderEquipmentPicker = (slot?: EquipmentSlot): void => {
    const person = selectedPerson();
    if (!person) return;
    professionList.hidden = true;
    equipmentList.hidden = false;

    if (!slot) {
      pickerTitle.textContent = "Ausrüstung";
      const people = [person];
      const toolDone = people.every((candidate) => Boolean(equipmentForSlot(candidate, "tool") || equipmentPendingForSlot(candidate, "tool")));
      const shoesDone = people.every((candidate) => Boolean(equipmentForSlot(candidate, "shoes") || equipmentPendingForSlot(candidate, "shoes")));
      equipmentList.innerHTML = `
        <button type="button" data-equipment-slot-choice="tool" ${toolDone ? "disabled" : ""}>
          <span aria-hidden="true">🪓</span>
          <strong>Werkzeug</strong>
          <small>${toolDone ? "Bereits ausgerüstet" : "Werkzeug auswählen"}</small>
        </button>
        <button type="button" data-equipment-slot-choice="shoes" ${shoesDone ? "disabled" : ""}>
          <span aria-hidden="true">${EQUIPMENT_DEFINITIONS.shoes.icon}</span>
          <strong>Schuhe</strong>
          <small>${shoesDone ? "Bereits ausgerüstet" : "Schuhe auswählen"}</small>
        </button>`;
      return;
    }

    pickerTitle.textContent = slot === "tool" ? "Werkzeug zuweisen" : "Schuhe zuweisen";
    const goods = (Object.keys(EQUIPMENT_DEFINITIONS) as EquipmentGood[])
      .filter((good) => EQUIPMENT_DEFINITIONS[good].slot === slot);
    equipmentList.innerHTML = goods.map((good) => {
      const definition = EQUIPMENT_DEFINITIONS[good];
      const equipped = equipmentForSlot(person, slot)?.good === good;
      const pending = person.equipmentTask?.good === good;
      const available = equipmentStock(world, good);
      return `<button type="button" data-equipment-good="${good}" aria-pressed="${equipped}" ${equipped || pending || available <= 0 ? "disabled" : ""}>
        <span aria-hidden="true">${definition.icon}</span>
        <strong>${definition.label}</strong>
        <small>${equipped ? "Zugewiesen" : pending ? "Wird geholt" : `${available} verfügbar`}</small>
      </button>`;
    }).join("");
  };

  const setMenuOpen = (open: boolean): void => {
    if (open && !selectedPerson()) return;
    menu.hidden = !open;
    pickerBackdrop.hidden = true;
    if (open) renderMenu();
  };

  const beginMode = (mode: PersonCommandMode): void => {
    const person = selectedPerson();
    if (!person) return;
    activeMode = mode;
    setMenuOpen(false);
    const copy: [string, string] = mode === "move"
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
      pickerBackdrop.hidden = false;
      return;
    }
    if (action === "equipment") {
      renderEquipmentPicker();
      pickerBackdrop.hidden = false;
      return;
    }
    if (action === "workplace") return beginMode("workplace");
    if (action === "home") return beginMode("home");
    if (action === "move") return beginMode("move");
    if (action === "waypost") {
      setMenuOpen(false);
      window.dispatchEvent(new CustomEvent(WAYPOST_PLACEMENT_REQUESTED_EVENT, {
        detail: { personId: person.id },
      }));
      return;
    }
    if (action === "workarea") {
      setMenuOpen(false);
      window.dispatchEvent(new CustomEvent(WORK_AREA_MODE_EVENT, {
        detail: { active: true, personId: person.id },
      }));
      return;
    }
    const success = action === "eat"
      ? commandEat(world, person.id)
      : action === "sleep"
        ? commandSleep(world, person.id)
        : false;
    if (!success) return;
    setMenuOpen(false);
    window.dispatchEvent(new CustomEvent(PERSON_SELECTION_REQUESTED_EVENT, {
      detail: { id: person.id, focus: false },
    }));
  });

  pickerBackdrop.addEventListener("pointerdown", (event) => {
    if (event.target === pickerBackdrop) pickerBackdrop.hidden = true;
  });

  picker.addEventListener("click", (event) => {
    const close = (event.target as HTMLElement).closest("[data-context-close-picker]");
    if (close) {
      pickerBackdrop.hidden = true;
      return;
    }
    const person = selectedPerson();
    if (!person) return;
    const equipmentSlotButton = (event.target as HTMLElement).closest<HTMLButtonElement>("[data-equipment-slot-choice]");
    if (equipmentSlotButton) {
      const slot = equipmentSlotButton.dataset.equipmentSlotChoice as EquipmentSlot;
      renderEquipmentPicker(slot);
      return;
    }
    const equipmentButton = (event.target as HTMLElement).closest<HTMLButtonElement>("[data-equipment-good]");
    if (equipmentButton) {
      const good = equipmentButton.dataset.equipmentGood as EquipmentGood;
      if (!assignEquipment(world, person.id, good)) return;
      setMenuOpen(false);
      window.dispatchEvent(new CustomEvent(PERSON_SELECTION_REQUESTED_EVENT, {
        detail: { id: person.id, focus: false },
      }));
      return;
    }
    const button = (event.target as HTMLElement).closest<HTMLButtonElement>("[data-profession]");
    if (!button) return;
    const profession = button.dataset.profession as Profession | "";
    if (!setPersonProfession(world, person.id, profession || undefined)) return;
    setMenuOpen(false);
    window.dispatchEvent(new CustomEvent(PERSON_SELECTION_REQUESTED_EVENT, {
      detail: { id: person.id, focus: false },
    }));
  });

  modeOverlay.querySelector("[data-person-command-cancel]")?.addEventListener("click", cancelMode);

  window.addEventListener(PERSON_SELECTED_EVENT, (event) => {
    selectedPersonId = (event as CustomEvent<{ id: number }>).detail.id;
    if (!menu.hidden) renderMenu();
  });
  window.addEventListener(PERSON_CLEARED_EVENT, () => {
    selectedPersonId = undefined;
    setMenuOpen(false);
    cancelMode();
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
  window.addEventListener(PERSON_CONTEXT_TOGGLE_REQUESTED_EVENT, () => setMenuOpen(menu.hidden));
  window.addEventListener(PERSON_EQUIPMENT_PICKER_REQUESTED_EVENT, (event) => {
    const detail = (event as CustomEvent<{ personId: number; slot?: EquipmentSlot }>).detail;
    selectedPersonId = detail.personId;
    setMenuOpen(true);
    renderEquipmentPicker(detail.slot);
    pickerBackdrop.hidden = false;
  });
  window.addEventListener(UI_MENU_OPENED_EVENT, () => setMenuOpen(false));
  window.addEventListener(BUILD_MODE_EVENT, () => setMenuOpen(false));
  window.addEventListener(MERCHANT_TARGET_MODE_EVENT, () => setMenuOpen(false));
  window.addEventListener(WORK_AREA_MODE_EVENT, (event) => {
    if ((event as CustomEvent<{ active: boolean }>).detail.active) setMenuOpen(false);
  });

  document.addEventListener("keydown", (event) => {
    if (isEditableTarget(event.target)) return;
    if (event.code === "Space" && selectedPersonId !== undefined && !activeMode) {
      event.preventDefault();
      event.stopImmediatePropagation();
      setMenuOpen(menu.hidden);
      return;
    }
    if (event.key === "Escape" && !pickerBackdrop.hidden) {
      event.preventDefault();
      event.stopImmediatePropagation();
      pickerBackdrop.hidden = true;
      return;
    }
    if (event.key === "Escape" && !menu.hidden) {
      event.preventDefault();
      event.stopImmediatePropagation();
      setMenuOpen(false);
    }
  }, true);

}
