import type { World } from "../simulation/model";
import { serializeSaveGame } from "../simulation/saveGame";
import {
  AUTOSAVE_INTERVAL_MS,
  CRASH_SAVE_ID,
  createBrowserSaveRecord,
  listBrowserSaves,
  nextAutosaveId,
  putBrowserSave,
} from "../ui/browserSaves";

const saveBrowserSnapshot = async (
  world: World,
  options: {
    id: string;
    kind: "autosave" | "crash";
    name: string;
    captureThumbnail?: () => Promise<string>;
  },
): Promise<void> => {
  const savedAt = new Date();
  const json = serializeSaveGame(world, savedAt);
  let thumbnail = "";
  if (options.captureThumbnail) {
    try {
      thumbnail = await options.captureThumbnail();
    } catch {
      thumbnail = "";
    }
  }
  await putBrowserSave(
    createBrowserSaveRecord(world, {
      id: options.id,
      kind: options.kind,
      name: options.name,
      savedAt,
      thumbnail,
      json,
    }),
  );
};

export const saveCrashSnapshot = async (world: World): Promise<void> => {
  await saveBrowserSnapshot(world, {
    id: CRASH_SAVE_ID,
    kind: "crash",
    name: "Crash-Sicherung",
  });
};

export const saveAutomaticSnapshot = async (
  world: World,
  captureThumbnail: () => Promise<string>,
): Promise<void> => {
  const saves = await listBrowserSaves();
  const id = nextAutosaveId(saves);
  const slot = Number(id.at(-1) ?? "1");
  await saveBrowserSnapshot(world, {
    id,
    kind: "autosave",
    name: `Autosave ${slot}`,
    captureThumbnail,
  });
};

export const installAutomaticSaves = (
  world: World,
  captureThumbnail: () => Promise<string>,
): (() => void) => {
  let saving = false;
  const interval = window.setInterval(() => {
    if (saving) return;
    saving = true;
    void saveAutomaticSnapshot(world, captureThumbnail)
      .catch((error) => {
        console.warn("Autosave fehlgeschlagen.", error);
      })
      .finally(() => {
        saving = false;
      });
  }, AUTOSAVE_INTERVAL_MS);

  return () => window.clearInterval(interval);
};
