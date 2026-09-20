import type { World } from "../simulation/model";
import { SAVE_VERSION } from "../simulation/saveGame";

const DB_NAME = "civilizations-poc";
const DB_VERSION = 1;
const STORE_NAME = "saveGames";

export type BrowserSaveRecord = {
  id: string;
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
    name: string;
    savedAt: Date;
    thumbnail: string;
    json: string;
  },
): BrowserSaveRecord => ({
  id: options.id ?? browserSaveId(),
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
