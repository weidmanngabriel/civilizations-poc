import type { Person, Tile, World } from "./model";

export const SAVE_FORMAT = "civilizations-save";
export const SAVE_VERSION = 1;

export type SavedActivity =
  | "idle"
  | "moving"
  | "sleeping"
  | "seeking-food"
  | "picking-up-good"
  | "transporting-good"
  | "sowing"
  | "fertilizing"
  | "harvesting"
  | "extracting-resource"
  | "building"
  | "producing";

type SavedPerson = {
  id: string;
  activity: SavedActivity;
  state: Omit<Person, "id">;
};

type SavedTile = {
  id: string;
  state: Tile;
};

type SavedWorld = Omit<World, "people" | "tiles"> & {
  people: SavedPerson[];
  tiles: SavedTile[];
};

export type SaveGame = {
  format: typeof SAVE_FORMAT;
  version: typeof SAVE_VERSION;
  savedAt: string;
  world: SavedWorld;
};

const cloneJson = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

export const currentActivity = (person: Person): SavedActivity => {
  if (person.sleepState) return "sleeping";
  if (person.hungerState?.foodSource || person.hungerState?.foodBush) return "seeking-food";
  if (person.trip) return person.trip.picked ? "transporting-good" : "picking-up-good";
  if (person.farmTask?.kind === "sow") return "sowing";
  if (person.farmTask?.kind === "fertilize") return "fertilizing";
  if (person.farmTask?.kind === "harvest") return "harvesting";
  if ((person.woodcutter || person.extractor) && person.progress > 0) return "extracting-resource";
  if (person.builder && person.progress > 0) return "building";
  if (person.assignment?.role === "worker" && person.progress > 0) return "producing";
  if (person.path.length > 0) return "moving";
  return "idle";
};

export const createSaveGame = (world: World, savedAt = new Date()): SaveGame => {
  const snapshot = cloneJson(world);
  const { people, tiles, ...rest } = snapshot;
  return {
    format: SAVE_FORMAT,
    version: SAVE_VERSION,
    savedAt: savedAt.toISOString(),
    world: {
      ...rest,
      people: people.map(({ id, ...state }) => ({
        id: `person-${id}`,
        activity: currentActivity({ id, ...state }),
        state,
      })),
      tiles: tiles.map((state) => ({
        id: `tile-${state.q}-${state.r}`,
        state,
      })),
    },
  };
};

export const serializeSaveGame = (world: World, savedAt = new Date()): string =>
  JSON.stringify(createSaveGame(world, savedAt), null, 2);

const requireObject = (value: unknown, label: string): Record<string, unknown> => {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error(`${label} ist kein gültiges Objekt.`);
  return value as Record<string, unknown>;
};

const personRuntimeId = (value: unknown): number => {
  if (typeof value !== "string") throw new Error("Person-ID fehlt.");
  const match = /^person-(\d+)$/.exec(value);
  if (!match) throw new Error(`Ungültige Person-ID: ${value}`);
  return Number(match[1]);
};

export const deserializeSaveGame = (json: string): World => {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    throw new Error("Die ausgewählte Datei enthält kein gültiges JSON.");
  }

  const root = requireObject(parsed, "Spielstand");
  if (root.format !== SAVE_FORMAT) throw new Error("Die Datei ist kein Spielstand dieses Prototyps.");
  if (root.version !== SAVE_VERSION)
    throw new Error(`Spielstand-Version ${String(root.version)} wird nicht unterstützt.`);

  const savedWorld = requireObject(root.world, "Welt");
  if (!Array.isArray(savedWorld.people) || !Array.isArray(savedWorld.tiles))
    throw new Error("Der Spielstand enthält keine vollständige Welt.");

  const people = savedWorld.people.map((entry) => {
    const savedPerson = requireObject(entry, "Person");
    const state = requireObject(savedPerson.state, "Personzustand") as unknown as Omit<Person, "id">;
    return { id: personRuntimeId(savedPerson.id), ...state } as Person;
  });
  const tiles = savedWorld.tiles.map((entry) => {
    const savedTile = requireObject(entry, "Zelle");
    if (typeof savedTile.id !== "string" || !savedTile.id.startsWith("tile-"))
      throw new Error("Ungültige Zellen-ID im Spielstand.");
    return requireObject(savedTile.state, "Zellenzustand") as unknown as Tile;
  });

  const { people: _people, tiles: _tiles, ...rest } = savedWorld;
  const world = { ...rest, people, tiles } as unknown as World;
  if (!Array.isArray(world.buildings) || !Array.isArray(world.naturalResources))
    throw new Error("Der Spielstand enthält keine vollständigen Entitäten.");
  if (typeof world.round !== "number" || typeof world.rngState !== "number")
    throw new Error("Der Spielstand enthält keinen gültigen Simulationszustand.");
  return cloneJson(world);
};

export const replaceWorldState = (target: World, source: World): void => {
  for (const key of Object.keys(target)) delete (target as unknown as Record<string, unknown>)[key];
  Object.assign(target, cloneJson(source));
};
