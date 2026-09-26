import type { World } from "../simulation/model";
import { SAVE_VERSION } from "../simulation/saveGame";

const DB_NAME = "civilizations-poc";
const DB_VERSION = 1;
const STORE_NAME = "saveGames";

export type BrowserSaveKind = "manual" | "autosave" | "crash";

export const AUTOSAVE_INTERVAL_MS = 5 * 60 * 1000;
export const AUTOSAVE_IDS = ["autosave-1", "autosave-2", "autosave-3"] as const;
export const CRASH_SAVE_ID = "crash-save";

export type BrowserSaveRecord = {
  id: string;
  kind?: BrowserSaveKind;
  name: string;
  savedAt: string;
  saveVersion: number;
  population: number;
  buildingCount: number;
  thumbnail: string;
  json: string;
};

const requestResult = <T>(request: IDBRequest<T>): Promise<T> =>
  new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Browser-Speicher konnte nicht gelesen werden."));
  });

const transactionDone = (transaction: IDBTransaction): Promise<void> =>
  new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error("Browser-Speicher konnte nicht aktualisiert werden."));
    transaction.onabort = () => reject(transaction.error ?? new Error("Browser-Speicher wurde abgebrochen."));
  });

let databasePromise: Promise<IDBDatabase> | undefined;

const openDatabase = (): Promise<IDBDatabase> => {
  if (databasePromise) return databasePromise;
  databasePromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME))
        db.createObjectStore(STORE_NAME, { keyPath: "id" });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Browser-Speicher konnte nicht geöffnet werden."));
  });
  return databasePromise;
};

export const browserSaveId = (): string =>
  globalThis.crypto?.randomUUID?.() ?? `save-${Date.now()}-${Math.random().toString(16).slice(2)}`;

export const createBrowserSaveRecord = (
  world: World,
  options: {
    id?: string;
    kind?: BrowserSaveKind;
    name: string;
    savedAt: Date;
    thumbnail: string;
    json: string;
  },
): BrowserSaveRecord => ({
  id: options.id ?? browserSaveId(),
  kind: options.kind ?? "manual",
  name: options.name.trim(),
  savedAt: options.savedAt.toISOString(),
  saveVersion: SAVE_VERSION,
  population: world.people.length,
  buildingCount: world.buildings.filter(
    (building) => !building.retired && building.kind !== "field",
  ).length,
  thumbnail: options.thumbnail,
  json: options.json,
});

export const browserSaveKind = (save: BrowserSaveRecord): BrowserSaveKind =>
  save.kind ?? "manual";

export const nextAutosaveId = (saves: BrowserSaveRecord[]): string => {
  const autosaves = saves.filter((save) => browserSaveKind(save) === "autosave");
  for (const id of AUTOSAVE_IDS)
    if (!autosaves.some((save) => save.id === id)) return id;
  return [...autosaves].sort((a, b) => a.savedAt.localeCompare(b.savedAt))[0]!.id;
};

export const findCurrentBrowserSave = (
  saves: BrowserSaveRecord[],
  currentSaveId: string | undefined,
): BrowserSaveRecord | undefined =>
  currentSaveId ? saves.find((save) => save.id === currentSaveId) : undefined;

export const listBrowserSaves = async (): Promise<BrowserSaveRecord[]> => {
  const db = await openDatabase();
  const transaction = db.transaction(STORE_NAME, "readonly");
  const records = await requestResult(
    transaction.objectStore(STORE_NAME).getAll() as IDBRequest<BrowserSaveRecord[]>,
  );
  await transactionDone(transaction);
  return records.sort((a, b) => b.savedAt.localeCompare(a.savedAt));
};

export const putBrowserSave = async (record: BrowserSaveRecord): Promise<void> => {
  const db = await openDatabase();
  const transaction = db.transaction(STORE_NAME, "readwrite");
  transaction.objectStore(STORE_NAME).put(record);
  await transactionDone(transaction);
};

export const deleteBrowserSave = async (id: string): Promise<void> => {
  const db = await openDatabase();
  const transaction = db.transaction(STORE_NAME, "readwrite");
  transaction.objectStore(STORE_NAME).delete(id);
  await transactionDone(transaction);
};
