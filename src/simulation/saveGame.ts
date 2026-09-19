import type {
  Building,
  Hex,
  LooseGoodStack,
  NaturalResource,
  Person,
  PlaceableBuildingKind,
  Tile,
  World,
} from "./model";
import {
  definitionBlockedForBuilding,
  definitionFootprintForBuilding,
} from "../buildings/buildingDefinitionRegistry";
import { footprintAt } from "./buildingPlacement";
import { key, tileIndex } from "./hex";
import {
  naturalResourceBlocksMovement,
  naturalResourceFootprint,
} from "./naturalResources";
import { createDefaultGameWorld } from "./scenario";
import { refinedCellCluster } from "./spatial";

export const SAVE_FORMAT = "civilizations-save";
export const SAVE_VERSION = 4;

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
  | "producing"
  | "fishing";

type SavedPerson = {
  id: string;
  activity: SavedActivity;
  state: Omit<Person, "id">;
};

type SavedBuilding = Omit<Building, "footprint" | "baseTerrain" | "baseTerrains">;

type SavedMapState = {
  roads: Hex[];
  traffic: Array<{ position: Hex; ticks: number[] }>;
  bushes: Array<{ position: Hex; available?: boolean; regrowTick?: number }>;
};

type SavedWorld = Omit<
  World,
  "people" | "buildings" | "naturalResources" | "looseGoods" | "tiles"
> & {
  people: SavedPerson[];
  buildings: SavedBuilding[];
  naturalResources: NaturalResource[];
  looseGoods?: LooseGoodStack[];
  map: SavedMapState;
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
  if (person.outdoorCarry) return "transporting-good";
  if (person.scoutWaypostTask) return person.path.length ? "moving" : "building";
  if (person.farmTask?.kind === "sow") return "sowing";
  if (person.farmTask?.kind === "fertilize") return "fertilizing";
  if (person.farmTask?.kind === "harvest") return "harvesting";
  if (person.fisher && person.fishingWaitUntilTick !== undefined) return "fishing";
  if ((person.woodcutter || person.extractor) && person.progress > 0) return "extracting-resource";
  if (person.builder && person.progress > 0) return "building";
  if (person.assignment?.role === "worker" && person.progress > 0) return "producing";
  if (person.path.length > 0) return "moving";
  return "idle";
};

const saveBuilding = (building: Building): SavedBuilding => {
  const saved = cloneJson(building);
  delete saved.footprint;
  delete saved.baseTerrain;
  delete saved.baseTerrains;
  return saved;
};

export const createSaveGame = (world: World, savedAt = new Date()): SaveGame => {
  const snapshot = cloneJson(world);
  const {
    people,
    buildings,
    naturalResources,
    looseGoods,
    tiles,
    ...rest
  } = snapshot;

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
      buildings: buildings.map(saveBuilding),
      naturalResources,
      ...(looseGoods ? { looseGoods } : {}),
      map: {
        roads: tiles
          .filter((tile) => tile.terrain === "road")
          .map(({ q, r }) => ({ q, r })),
        traffic: tiles
          .filter((tile) => tile.trafficTicks !== undefined)
          .map((tile) => ({
            position: { q: tile.q, r: tile.r },
            ticks: [...(tile.trafficTicks ?? [])],
          })),
        bushes: tiles
          .filter((tile) => tile.bush)
          .map((tile) => ({
            position: { q: tile.q, r: tile.r },
            ...(tile.bushAvailable !== undefined ? { available: tile.bushAvailable } : {}),
            ...(tile.bushRegrowTick !== undefined ? { regrowTick: tile.bushRegrowTick } : {}),
          })),
      },
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

const requireHex = (value: unknown, label: string): Hex => {
  const position = requireObject(value, label);
  if (typeof position.q !== "number" || typeof position.r !== "number")
    throw new Error(`${label} enthält keine gültige Position.`);
  return { q: position.q, r: position.r };
};

const personRuntimeId = (value: unknown): number => {
  if (typeof value !== "string") throw new Error("Person-ID fehlt.");
  const match = /^person-(\d+)$/.exec(value);
  if (!match) throw new Error(`Ungültige Person-ID: ${value}`);
  return Number(match[1]);
};

const buildingFootprintFromPosition = (building: SavedBuilding): Hex[] => {
  const registered = definitionFootprintForBuilding(building as Building);
  if (registered) return registered;
  if (building.kind === "field")
    return refinedCellCluster({ q: 0, r: 0 }).map((offset) => ({
      q: building.position.q + offset.q,
      r: building.position.r + offset.r,
    }));
  if (building.kind === "hq") return footprintAt("house", building.position);
  return footprintAt(building.kind as PlaceableBuildingKind, building.position);
};

const restoreBuilding = (saved: SavedBuilding): Building => {
  const building = cloneJson(saved) as Building;
  const footprint = buildingFootprintFromPosition(saved);
  building.footprint = footprint;
  if (building.kind === "hq") building.baseTerrain = "grass";
  else if (building.kind !== "field")
    building.baseTerrains = Object.fromEntries(
      footprint.map((position) => [key(position), "grass"]),
    );
  return building;
};

const baseTiles = (): Tile[] =>
  createDefaultGameWorld().tiles.map((tile) => ({
    q: tile.q,
    r: tile.r,
    terrain:
      tile.terrain === "river" || tile.terrain === "mountain"
        ? tile.terrain
        : "grass",
  }));

const parseMapState = (value: unknown): SavedMapState => {
  const map = requireObject(value, "Kartenzustand");
  if (!Array.isArray(map.roads) || !Array.isArray(map.traffic) || !Array.isArray(map.bushes))
    throw new Error("Der Spielstand enthält keinen gültigen Kartenzustand.");

  return {
    roads: map.roads.map((entry) => requireHex(entry, "Straße")),
    traffic: map.traffic.map((entry) => {
      const saved = requireObject(entry, "Verkehr");
      if (!Array.isArray(saved.ticks) || !saved.ticks.every((tick) => typeof tick === "number"))
        throw new Error("Ungültige Verkehrshistorie im Spielstand.");
      return {
        position: requireHex(saved.position, "Verkehrsposition"),
        ticks: [...saved.ticks] as number[],
      };
    }),
    bushes: map.bushes.map((entry) => {
      const saved = requireObject(entry, "Busch");
      if (saved.available !== undefined && typeof saved.available !== "boolean")
        throw new Error("Ungültiger Buschzustand im Spielstand.");
      if (saved.regrowTick !== undefined && typeof saved.regrowTick !== "number")
        throw new Error("Ungültiger Busch-Timer im Spielstand.");
      return {
        position: requireHex(saved.position, "Buschposition"),
        ...(saved.available !== undefined ? { available: saved.available } : {}),
        ...(saved.regrowTick !== undefined ? { regrowTick: saved.regrowTick } : {}),
      };
    }),
  };
};

const reconstructTiles = (
  map: SavedMapState,
  buildings: Building[],
  naturalResources: NaturalResource[],
): Tile[] => {
  const tiles = baseTiles();
  const indexed = tileIndex(tiles);

  for (const position of map.roads) {
    const tile = indexed.get(key(position));
    if (!tile) throw new Error("Straße liegt außerhalb der Welt.");
    tile.terrain = "road";
  }

  for (const savedTraffic of map.traffic) {
    const tile = indexed.get(key(savedTraffic.position));
    if (!tile) throw new Error("Verkehrshistorie liegt außerhalb der Welt.");
    tile.trafficTicks = [...savedTraffic.ticks];
  }

  for (const bush of map.bushes) {
    const tile = indexed.get(key(bush.position));
    if (!tile) throw new Error("Busch liegt außerhalb der Welt.");
    tile.bush = true;
    if (bush.available !== undefined) tile.bushAvailable = bush.available;
    if (bush.regrowTick !== undefined) tile.bushRegrowTick = bush.regrowTick;
  }

  for (const building of buildings) {
    if (building.retired) continue;
    const blocked = new Set((definitionBlockedForBuilding(building) ?? []).map(key));
    for (const position of building.footprint ?? [building.position]) {
      const tile = indexed.get(key(position));
      if (!tile) throw new Error(`Gebäude ${building.id} liegt außerhalb der Welt.`);
      tile.terrain = building.kind === "field" ? "field" : "building";
      tile.buildingBlocking = blocked.has(key(position)) || undefined;
      tile.trafficTicks = undefined;
      tile.bush = undefined;
      tile.bushAvailable = undefined;
      tile.bushRegrowTick = undefined;
    }
  }

  for (const resource of naturalResources) {
    if (resource.depleted || !naturalResourceBlocksMovement(resource)) continue;
    for (const position of naturalResourceFootprint(resource)) {
      const tile = indexed.get(key(position));
      if (!tile) throw new Error(`Ressource ${resource.id} liegt außerhalb der Welt.`);
      tile.resourceBlocking = true;
    }
  }

  return tiles;
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
  if (
    !Array.isArray(savedWorld.people) ||
    !Array.isArray(savedWorld.buildings) ||
    !Array.isArray(savedWorld.naturalResources)
  )
    throw new Error("Der Spielstand enthält keine vollständigen Entitäten.");

  const people = savedWorld.people.map((entry) => {
    const savedPerson = requireObject(entry, "Person");
    const state = requireObject(savedPerson.state, "Personzustand") as unknown as Omit<Person, "id">;
    return { id: personRuntimeId(savedPerson.id), ...state } as Person;
  });

  const buildings = savedWorld.buildings.map((entry) => {
    const saved = requireObject(entry, "Gebäude") as unknown as SavedBuilding;
    if (typeof saved.id !== "string" || typeof saved.kind !== "string")
      throw new Error("Ungültiges Gebäude im Spielstand.");
    requireHex(saved.position, `Position von Gebäude ${saved.id}`);
    return restoreBuilding(saved);
  });

  const naturalResources = savedWorld.naturalResources.map((entry) => {
    const resource = requireObject(entry, "Ressource") as unknown as NaturalResource;
    if (typeof resource.id !== "string" || typeof resource.kind !== "string")
      throw new Error("Ungültige Ressource im Spielstand.");
    requireHex(resource.position, `Position von Ressource ${resource.id}`);
    return cloneJson(resource);
  });

  let looseGoods: LooseGoodStack[] | undefined;
  if (savedWorld.looseGoods !== undefined) {
    if (!Array.isArray(savedWorld.looseGoods))
      throw new Error("Ungültige lose Waren im Spielstand.");
    looseGoods = savedWorld.looseGoods.map((entry) => {
      const stack = requireObject(entry, "Lose Ware") as unknown as LooseGoodStack;
      if (typeof stack.id !== "string") throw new Error("Ungültige Waren-ID im Spielstand.");
      requireHex(stack.position, `Position von ${stack.id}`);
      return cloneJson(stack);
    });
  }

  const map = parseMapState(savedWorld.map);
  const {
    people: _people,
    buildings: _buildings,
    naturalResources: _naturalResources,
    looseGoods: _looseGoods,
    map: _map,
    ...rest
  } = savedWorld;

  const world = {
    ...rest,
    people,
    buildings,
    naturalResources,
    ...(looseGoods ? { looseGoods } : {}),
    tiles: reconstructTiles(map, buildings, naturalResources),
  } as unknown as World;

  if (typeof world.round !== "number" || typeof world.rngState !== "number")
    throw new Error("Der Spielstand enthält keinen gültigen Simulationszustand.");
  return cloneJson(world);
};

export const replaceWorldState = (target: World, source: World): void => {
  for (const key of Object.keys(target)) delete (target as unknown as Record<string, unknown>)[key];
  Object.assign(target, cloneJson(source));
};
