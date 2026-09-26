import type { World } from "../simulation/model";
import { createDefaultGameWorld } from "../simulation/scenario";
import { deserializeSaveGame, replaceWorldState, serializeSaveGame } from "../simulation/saveGame";
import {
  browserSaveKind,
  createBrowserSaveRecord,
  deleteBrowserSave,
  findCurrentBrowserSave,
  listBrowserSaves,
  putBrowserSave,
  type BrowserSaveRecord,
} from "./browserSaves";
import { confirmDialog, showDialog } from "./modalDialog";

const WORLD_REPLACED_EVENT = "poc-world-replaced";
const SELECTION_CLEARED_EVENT = "poc-building-selection-cleared";
const BUILD_MODE_EVENT = "poc-build-mode";
const MERCHANT_TARGET_MODE_EVENT = "poc-merchant-target-mode";
const UI_MENU_OPENED_EVENT = "poc-ui-menu-opened";

const timestampForFilename = (date: Date): string =>
  date.toISOString().replace(/[:.]/g, "-");

const safeFilename = (name: string): string =>
  name.trim().replace(/[^a-z0-9äöüß_-]+/gi, "-").replace(/^-+|-+$/g, "") || "spielstand";

const downloadSave = (json: string, name: string, savedAt: Date): void => {
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${safeFilename(name)}-${timestampForFilename(savedAt)}.json`;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
};

const formatSavedAt = (value: string): string => {
  const date = new Date(value);
  return new Intl.DateTimeFormat("de-DE", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
};

const createModal = (
  title: string,
  subtitle: string,
): {
  backdrop: HTMLElement;
  dialog: HTMLElement;
  body: HTMLElement;
  close: () => void;
} => {
  const backdrop = document.createElement("div");
  backdrop.className = "save-manager-backdrop";
  const dialog = document.createElement("section");
  dialog.className = "save-manager-dialog";
  dialog.setAttribute("role", "dialog");
  dialog.setAttribute("aria-modal", "true");
  dialog.innerHTML = `
    <header class="save-manager-header">
      <div>
        <strong></strong>
        <span></span>
      </div>
      <button type="button" class="save-manager-close" aria-label="Dialog schließen">×</button>
    </header>
    <div class="save-manager-body"></div>`;
  dialog.querySelector("strong")!.textContent = title;
  dialog.querySelector("span")!.textContent = subtitle;
  backdrop.append(dialog);
  document.body.append(backdrop);

  let closed = false;
  const escape = (event: KeyboardEvent) => {
    if (event.key === "Escape") close();
  };
  const close = () => {
    if (closed) return;
    closed = true;
    document.removeEventListener("keydown", escape);
    backdrop.remove();
  };
  dialog.querySelector<HTMLButtonElement>(".save-manager-close")!.addEventListener("click", close);
  backdrop.addEventListener("pointerdown", (event) => {
    if (event.target === backdrop) close();
  });
  document.addEventListener("keydown", escape);

  return {
    backdrop,
    dialog,
    body: dialog.querySelector<HTMLElement>(".save-manager-body")!,
    close,
  };
};

const uniqueImportedName = (fileName: string, saves: BrowserSaveRecord[]): string => {
  const base = fileName.replace(/\.json$/i, "").trim() || "Importierter Spielstand";
  const names = new Set(saves.map((save) => save.name.toLocaleLowerCase("de-DE")));
  if (!names.has(base.toLocaleLowerCase("de-DE"))) return base;
  let suffix = 2;
  while (names.has(`${base} (${suffix})`.toLocaleLowerCase("de-DE"))) suffix += 1;
  return `${base} (${suffix})`;
};

export function mountGameMenu(
  world: World,
  renderMap: () => void,
  captureThumbnail: () => Promise<string>,
): void {
  const main = document.querySelector<HTMLElement>("main");
  const shell = document.querySelector<HTMLElement>(".build-menu-shell");
  const leftMenu = document.querySelector<HTMLElement>(".left-menu");
  if (!main || !shell || !leftMenu) return;

  let currentSaveId: string | undefined;
  let currentSaveName = "Meine Siedlung";

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
    <div class="game-menu-runtime"></div>
    <div class="build-menu-list">
      <button class="build-menu-item" type="button" data-game-action="new">
        <span class="build-menu-building-icon" aria-hidden="true">↻</span>
        <span class="build-menu-building-copy"><strong>Neues Spiel</strong><span>Welt auf den Anfangszustand zurücksetzen</span></span>
      </button>
      <button class="build-menu-item" type="button" data-game-action="save">
        <span class="build-menu-building-icon" aria-hidden="true">▣</span>
        <span class="build-menu-building-copy"><strong>Spiel speichern</strong><span>Im Browser speichern</span></span>
      </button>
      <button class="build-menu-item" type="button" data-game-action="load">
        <span class="build-menu-building-icon" aria-hidden="true">▰</span>
        <span class="build-menu-building-copy"><strong>Spiel laden</strong><span>Gespeicherte Spiele</span></span>
      </button>
    </div>`;
  shell.append(panel);

  const fileInput = document.createElement("input");
  fileInput.type = "file";
  fileInput.accept = ".json,application/json";
  fileInput.hidden = true;
  main.append(fileInput);

  const close = panel.querySelector<HTMLButtonElement>("#game-menu-close")!;
  const runtime = panel.querySelector<HTMLElement>(".game-menu-runtime")!;
  const autoplay = document.querySelector<HTMLButtonElement>("#autoplay");
  const speedControl = document.querySelector<HTMLElement>(".speed-control");
  const debugToggle = document.querySelector<HTMLButtonElement>("#debug-toggle");
  if (autoplay) runtime.append(autoplay);
  if (speedControl) runtime.append(speedControl);
  if (debugToggle) runtime.append(debugToggle);
  document.querySelector<HTMLElement>(".round-controls")?.remove();
  document.querySelector<HTMLElement>(".bottom-bar")?.remove();

  const setOpen = (open: boolean): void => {
    if (open) {
      window.dispatchEvent(new CustomEvent(UI_MENU_OPENED_EVENT, { detail: { menu: "game" } }));
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

  const saveCurrentGame = async (): Promise<boolean> => {
    if (!currentSaveId) return false;

    let saves: BrowserSaveRecord[];
    try {
      saves = await listBrowserSaves();
    } catch (error) {
      await showDialog(
        error instanceof Error ? error.message : "Browser-Spielstände konnten nicht gelesen werden.",
        { title: "Speichern nicht verfügbar" },
      );
      return true;
    }

    const existing = findCurrentBrowserSave(saves, currentSaveId);
    if (!existing) {
      currentSaveId = undefined;
      return false;
    }

    setOpen(false);
    try {
      const savedAt = new Date();
      const json = serializeSaveGame(world, savedAt);
      const thumbnail = await captureThumbnail();
      const record = createBrowserSaveRecord(world, {
        id: existing.id,
        name: existing.name,
        savedAt,
        thumbnail,
        json,
      });
      await putBrowserSave(record);
      currentSaveName = record.name;
    } catch (error) {
      await showDialog(
        error instanceof Error ? error.message : "Der Spielstand konnte nicht gespeichert werden.",
        { title: "Speichern fehlgeschlagen" },
      );
    }
    return true;
  };

  const openSaveDialog = async (): Promise<void> => {
    let saves: BrowserSaveRecord[];
    try {
      saves = await listBrowserSaves();
    } catch (error) {
      await showDialog(
        error instanceof Error ? error.message : "Browser-Spielstände konnten nicht gelesen werden.",
        { title: "Speichern nicht verfügbar" },
      );
      return;
    }

    saves = saves.filter((save) => browserSaveKind(save) === "manual");
    setOpen(false);
    const modal = createModal("Spiel speichern", "Im Browser speichern");
    modal.body.innerHTML = `
      <label class="save-manager-field">
        <span>Name</span>
        <input type="text" maxlength="80" autocomplete="off">
      </label>
      <section class="save-manager-section">
        <h3>Vorhandene Spielstände</h3>
        <div class="save-manager-list"></div>
      </section>
      <label class="save-manager-download">
        <input type="checkbox">
        <span>Spielstand zusätzlich herunterladen</span>
      </label>
      <div class="save-manager-actions">
        <button type="button" data-action="cancel">Abbrechen</button>
        <button type="button" class="primary" data-action="save">Speichern</button>
      </div>`;

    const input = modal.body.querySelector<HTMLInputElement>("input[type=text]")!;
    const download = modal.body.querySelector<HTMLInputElement>("input[type=checkbox]")!;
    const list = modal.body.querySelector<HTMLElement>(".save-manager-list")!;
    const saveButton = modal.body.querySelector<HTMLButtonElement>('[data-action="save"]')!;
    input.value = currentSaveName;

    const renderExisting = () => {
      list.replaceChildren();
      if (saves.length === 0) {
        const empty = document.createElement("p");
        empty.className = "save-manager-empty";
        empty.textContent = "Noch keine Spielstände im Browser.";
        list.append(empty);
        return;
      }
      for (const save of saves) {
        const row = document.createElement("div");
        row.className = "save-manager-existing";
        const copy = document.createElement("div");
        const strong = document.createElement("strong");
        strong.textContent = save.name;
        const small = document.createElement("small");
        small.textContent = formatSavedAt(save.savedAt);
        copy.append(strong, small);
        const replace = document.createElement("button");
        replace.type = "button";
        replace.textContent = "Ersetzen";
        replace.addEventListener("click", () => {
          currentSaveId = save.id;
          currentSaveName = save.name;
          input.value = save.name;
          input.focus();
          input.select();
        });
        row.append(copy, replace);
        list.append(row);
      }
    };
    renderExisting();

    modal.body.querySelector<HTMLButtonElement>('[data-action="cancel"]')!
      .addEventListener("click", modal.close);

    const performSave = async () => {
      const name = input.value.trim();
      if (!name) {
        input.focus();
        return;
      }
      const sameName = saves.find(
        (save) => save.name.toLocaleLowerCase("de-DE") === name.toLocaleLowerCase("de-DE"),
      );
      const existing = saves.find((save) => save.id === currentSaveId) ?? sameName;
      if (
        existing &&
        existing.id !== currentSaveId &&
        !await confirmDialog(`Spielstand „${existing.name}“ überschreiben?`, {
          title: "Spielstand ersetzen",
          confirmLabel: "Ersetzen",
        })
      ) return;

      saveButton.disabled = true;
      saveButton.textContent = "Speichert …";
      try {
        const savedAt = new Date();
        const json = serializeSaveGame(world, savedAt);
        const thumbnail = await captureThumbnail();
        const record = createBrowserSaveRecord(world, {
          id: existing?.id,
          name,
          savedAt,
          thumbnail,
          json,
        });
        await putBrowserSave(record);
        currentSaveId = record.id;
        currentSaveName = record.name;
        if (download.checked) downloadSave(json, record.name, savedAt);
        modal.close();
      } catch (error) {
        saveButton.disabled = false;
        saveButton.textContent = "Speichern";
        await showDialog(
          error instanceof Error ? error.message : "Der Spielstand konnte nicht gespeichert werden.",
          { title: "Speichern fehlgeschlagen" },
        );
      }
    };

    saveButton.addEventListener("click", performSave);
    input.addEventListener("keydown", (event) => {
      if (event.key === "Enter") void performSave();
    });
    input.focus();
    input.select();
  };

  const importSaveFile = async (file: File): Promise<void> => {
    try {
      const json = await file.text();
      const loaded = deserializeSaveGame(json);
      replaceWorldState(world, loaded);
      worldReplaced("load");

      const existing = await listBrowserSaves();
      const name = uniqueImportedName(file.name, existing);
      const savedAt = new Date();
      const normalizedJson = serializeSaveGame(world, savedAt);
      const thumbnail = await captureThumbnail();
      const record = createBrowserSaveRecord(world, {
        name,
        savedAt,
        thumbnail,
        json: normalizedJson,
      });
      await putBrowserSave(record);
      currentSaveId = record.id;
      currentSaveName = record.name;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Der Spielstand konnte nicht importiert werden.";
      await showDialog(message, { title: "Spielstand konnte nicht importiert werden" });
    } finally {
      fileInput.value = "";
    }
  };

  const openLoadDialog = async (): Promise<void> => {
    let saves: BrowserSaveRecord[];
    try {
      saves = await listBrowserSaves();
    } catch (error) {
      await showDialog(
        error instanceof Error ? error.message : "Browser-Spielstände konnten nicht gelesen werden.",
        { title: "Laden nicht verfügbar" },
      );
      return;
    }

    setOpen(false);
    const modal = createModal("Spiel laden", "Wähle einen Spielstand, um deine Siedlung fortzusetzen.");
    modal.body.innerHTML = `
      <div class="save-manager-load-list"></div>
      <button type="button" class="save-manager-import" data-action="import">
        Spielstand-Datei importieren
      </button>`;
    const list = modal.body.querySelector<HTMLElement>(".save-manager-load-list")!;

    const renderList = () => {
      list.replaceChildren();
      if (saves.length === 0) {
        const empty = document.createElement("p");
        empty.className = "save-manager-empty";
        empty.textContent = "Noch keine Spielstände im Browser.";
        list.append(empty);
        return;
      }

      for (const save of saves) {
        const card = document.createElement("article");
        card.className = "save-manager-card";
        const image = document.createElement("img");
        image.src = save.thumbnail;
        image.alt = `Vorschau von ${save.name}`;
        image.hidden = !save.thumbnail;
        const copy = document.createElement("div");
        copy.className = "save-manager-card-copy";
        const title = document.createElement("strong");
        title.textContent = save.name;
        const date = document.createElement("span");
        date.textContent = formatSavedAt(save.savedAt);
        const meta = document.createElement("small");
        const kindLabel =
          browserSaveKind(save) === "autosave"
            ? "AUTOSAVE"
            : browserSaveKind(save) === "crash"
              ? "CRASH-SICHERUNG"
              : "MANUELL";
        meta.textContent = `${kindLabel} · ${save.population} Bewohner · ${save.buildingCount} Gebäude`;
        copy.append(title, date, meta);

        const actions = document.createElement("div");
        actions.className = "save-manager-card-actions";
        const load = document.createElement("button");
        load.type = "button";
        load.className = "primary";
        load.textContent = "Laden";
        load.addEventListener("click", async () => {
          if (!await confirmDialog("Spielstand laden? Der aktuelle Spielstand wird ersetzt.", {
            title: "Spielstand laden",
            confirmLabel: "Laden",
          })) return;
          try {
            const loaded = deserializeSaveGame(save.json);
            replaceWorldState(world, loaded);
            if (browserSaveKind(save) === "manual") {
              currentSaveId = save.id;
              currentSaveName = save.name;
            } else {
              currentSaveId = undefined;
              currentSaveName = "Meine Siedlung";
            }
            modal.close();
            worldReplaced("load");
          } catch (error) {
            await showDialog(
              error instanceof Error ? error.message : "Der Spielstand konnte nicht geladen werden.",
              { title: "Spielstand konnte nicht geladen werden" },
            );
          }
        });
        const remove = document.createElement("button");
        remove.type = "button";
        remove.className = "save-manager-delete";
        remove.setAttribute("aria-label", `${save.name} löschen`);
        remove.textContent = "×";
        remove.addEventListener("click", async () => {
          if (!await confirmDialog(`Spielstand „${save.name}“ löschen?`, {
            title: "Spielstand löschen",
            confirmLabel: "Löschen",
            danger: true,
          })) return;
          await deleteBrowserSave(save.id);
          saves = saves.filter((candidate) => candidate.id !== save.id);
          if (currentSaveId === save.id) currentSaveId = undefined;
          renderList();
        });
        actions.append(load, remove);
        card.append(image, copy, actions);
        list.append(card);
      }
    };
    renderList();

    modal.body.querySelector<HTMLButtonElement>('[data-action="import"]')!
      .addEventListener("click", () => {
        modal.close();
        fileInput.value = "";
        fileInput.click();
      });
  };

  toggle.addEventListener("click", () => setOpen(panel.hidden));
  close.addEventListener("click", () => setOpen(false));

  panel.addEventListener("click", async (event) => {
    const target = event.target as HTMLElement;
    if (target.closest("#autoplay") || target.closest("#debug-toggle")) {
      setOpen(false);
      return;
    }
    const button = target.closest<HTMLButtonElement>("[data-game-action]");
    const action = button?.dataset.gameAction;
    if (!action) return;

    if (action === "save") {
      if (!await saveCurrentGame()) await openSaveDialog();
      return;
    }
    if (action === "load") {
      await openLoadDialog();
      return;
    }
    if (action === "new") {
      if (!await confirmDialog("Neues Spiel starten? Der aktuelle ungespeicherte Spielstand geht verloren.", {
        title: "Neues Spiel",
        confirmLabel: "Neu starten",
        danger: true,
      })) return;
      currentSaveId = undefined;
      currentSaveName = "Meine Siedlung";
      replaceWorldState(world, createDefaultGameWorld());
      worldReplaced("new");
    }
  });

  fileInput.addEventListener("change", async () => {
    const file = fileInput.files?.[0];
    if (file) await importSaveFile(file);
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
