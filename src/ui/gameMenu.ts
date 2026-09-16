import type { World } from "../simulation/model";
import { createDefaultGameWorld } from "../simulation/scenario";
import { deserializeSaveGame, replaceWorldState, serializeSaveGame } from "../simulation/saveGame";

const WORLD_REPLACED_EVENT = "poc-world-replaced";
const SELECTION_CLEARED_EVENT = "poc-building-selection-cleared";
const BUILD_MODE_EVENT = "poc-build-mode";
const MERCHANT_TARGET_MODE_EVENT = "poc-merchant-target-mode";

const timestampForFilename = (date: Date): string =>
  date.toISOString().replace(/[:.]/g, "-");

const downloadSave = (world: World): void => {
  const now = new Date();
  const blob = new Blob([serializeSaveGame(world, now)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `civilizations-save-${timestampForFilename(now)}.json`;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
};

export function mountGameMenu(world: World, renderMap: () => void): void {
  const main = document.querySelector<HTMLElement>("main");
  const shell = document.querySelector<HTMLElement>(".build-menu-shell");
  const leftMenu = document.querySelector<HTMLElement>(".left-menu");
  if (!main || !shell || !leftMenu) return;

  const toggle = document.createElement("button");
  toggle.id = "game-menu-toggle";
  toggle.className = "left-menu-button";
  toggle.type = "button";
  toggle.setAttribute("aria-expanded", "false");
  toggle.setAttribute("aria-controls", "game-menu-panel");
  toggle.innerHTML = `
    <span class="left-menu-button-icon" aria-hidden="true">☰</span>
    <span class="left-menu-button-label">Spiel</span>`;
  leftMenu.prepend(toggle);

  const panel = document.createElement("section");
  panel.id = "game-menu-panel";
  panel.className = "build-menu-panel";
  panel.hidden = true;
  panel.innerHTML = `
    <div class="build-menu-header">
      <div><small>SPIEL</small><strong>Spielstand</strong></div>
      <button id="game-menu-close" type="button" aria-label="Spielmenü schließen">×</button>
    </div>
    <div class="build-menu-list">
      <button class="build-menu-item" type="button" data-game-action="new">
        <span class="build-menu-building-icon" aria-hidden="true">↻</span>
        <span class="build-menu-building-copy"><strong>Neues Spiel</strong><span>Welt auf den Anfangszustand zurücksetzen</span></span>
      </button>
      <button class="build-menu-item" type="button" data-game-action="save">
        <span class="build-menu-building-icon" aria-hidden="true">↓</span>
        <span class="build-menu-building-copy"><strong>Spiel speichern</strong><span>Aktuellen Snapshot als JSON herunterladen</span></span>
      </button>
      <button class="build-menu-item" type="button" data-game-action="load">
        <span class="build-menu-building-icon" aria-hidden="true">↑</span>
        <span class="build-menu-building-copy"><strong>Spiel laden</strong><span>JSON-Datei vom Gerät auswählen</span></span>
      </button>
    </div>`;
  shell.append(panel);

  const fileInput = document.createElement("input");
  fileInput.type = "file";
  fileInput.accept = ".json,application/json";
  fileInput.hidden = true;
  main.append(fileInput);

  const close = panel.querySelector<HTMLButtonElement>("#game-menu-close")!;

  const setOpen = (open: boolean): void => {
    if (open) {
      document.querySelector<HTMLButtonElement>("#build-menu-close")?.click();
      document.querySelector<HTMLButtonElement>("#handbook-close")?.click();
    }
    panel.hidden = !open;
    toggle.setAttribute("aria-expanded", String(open));
    toggle.classList.toggle("active", open);
  };

  const worldReplaced = (reason: "new" | "load"): void => {
    document
      .querySelector<HTMLButtonElement>('#selection-panel button[data-action="close"]')
      ?.click();
    window.dispatchEvent(new CustomEvent(SELECTION_CLEARED_EVENT));
    window.dispatchEvent(new CustomEvent(WORLD_REPLACED_EVENT, { detail: { reason } }));
    renderMap();
    setOpen(false);
  };

  toggle.addEventListener("click", () => setOpen(panel.hidden));
  close.addEventListener("click", () => setOpen(false));

  panel.addEventListener("click", (event) => {
    const button = (event.target as HTMLElement).closest<HTMLButtonElement>("[data-game-action]");
    const action = button?.dataset.gameAction;
    if (!action) return;

    if (action === "save") {
      downloadSave(world);
      setOpen(false);
      return;
    }
    if (action === "load") {
      fileInput.value = "";
      fileInput.click();
      return;
    }
    if (action === "new") {
      if (!window.confirm("Neues Spiel starten? Der aktuelle ungespeicherte Spielstand geht verloren.")) return;
      replaceWorldState(world, createDefaultGameWorld());
      worldReplaced("new");
    }
  });

  fileInput.addEventListener("change", async () => {
    const file = fileInput.files?.[0];
    if (!file) return;
    try {
      const loaded = deserializeSaveGame(await file.text());
      replaceWorldState(world, loaded);
      worldReplaced("load");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Der Spielstand konnte nicht geladen werden.";
      window.alert(message);
    } finally {
      fileInput.value = "";
    }
  });

  document.querySelector<HTMLButtonElement>("#build-menu-toggle")?.addEventListener("click", () => {
    if (!panel.hidden) setOpen(false);
  });
  document.querySelector<HTMLButtonElement>("#handbook-toggle")?.addEventListener("click", () => {
    if (!panel.hidden) setOpen(false);
  });
  window.addEventListener(BUILD_MODE_EVENT, () => setOpen(false));
  window.addEventListener(MERCHANT_TARGET_MODE_EVENT, () => setOpen(false));
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !panel.hidden) setOpen(false);
  });
}
