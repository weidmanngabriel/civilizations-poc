import type {
  BuildableBuildingKind,
  Building,
  BuildingId,
  Good,
  Hex,
  Person,
  Role,
  Tile,
  World,
} from "./model";
import {
  findPath,
  findPathBySteps,
  movementCost,
  pathTravelCost,
  same,
} from "./hex";
import { CONFIG } from "./scenario";

export const building = (w: World, id: BuildingId): Building =>
  w.buildings.find((b) => b.id === id)!;
export const assigned = (w: World, id: BuildingId, role: Role): Person[] =>
  w.people.filter(
    (p) => p.assignment?.building === id && p.assignment.role === role,
  );
export const woodcutters = (w: World): Person[] =>
  w.people.filter((p) => p.woodcutter);
export const freePeople = (w: World): Person[] =>
  w.people.filter((p) => !p.assignment && !p.woodcutter);
const incoming = (w: World, id: BuildingId, good?: Good) =>
  w.people.filter(
    (p) => p.trip?.target === id && (!good || p.trip.good === good),
  ).length;
const heldOutput = (w: World, id: BuildingId) =>
  w.people.filter((p) => p.trip?.source === id && p.trip.picked).length;
const reservedAtSource = (w: World, id: BuildingId, good: Good) =>
  w.people.filter(
    (p) => p.trip?.source === id && p.trip.good === good && !p.trip.picked,
  ).length;
const producing = (w: World, id: BuildingId) =>
  w.people.filter((p) => p.assignment?.building === id && p.progress > 0)
    .length;
export const outputOccupied = (w: World, b: Building): number =>
  b.output + heldOutput(w, b.id) + producing(w, b.id);
const route = (w: World, p: Person, b: Building) => {
  p.path = findPath(
    w.tiles,
    p.position,
    b.position,
    CONFIG.roadSpeedMultiplier,
  ) ?? [];
};
const tileAt = (w: World, position: Hex): Tile =>
  w.tiles.find((tile) => same(tile, position))!;

export const warehouseStock = (b: Building, good: Good): number =>
  b.kind === "warehouse" ? (b.inventory?.[good] ?? 0) : 0;
export const totalWarehouseStock = (w: World, good: Good): number =>
  w.buildings
    .filter((b) => !b.retired && b.kind === "warehouse")
    .reduce((sum, b) => sum + warehouseStock(b, good), 0);

const sourceStock = (b: Building, good: Good): number => {
  if (b.kind === "warehouse") return warehouseStock(b, good);
  return b.recipe?.output === good ? b.output : 0;
};
const available = (w: World, b: Building, good: Good) =>
  sourceStock(b, good) - reservedAtSource(w, b.id, good);
const warehouseHasSpace = (w: World, b: Building, good: Good) =>
  warehouseStock(b, good) + incoming(w, b.id, good) <
  CONFIG.warehouseCapacityPerGood;

function returnCargoToSource(w: World, p: Person): void {
  if (!p.trip?.picked) return;
  const source = w.buildings.find((b) => b.id === p.trip!.source);
  if (!source) return;
  if (source.kind === "warehouse") {
    source.inventory ??= { wood: 0, plank: 0, woodenTool: 0 };
    source.inventory[p.trip.good] += CONFIG.carryCapacity;
  } else {
    source.output += CONFIG.carryCapacity;
  }
}

function cancel(w: World, p: Person): void {
  returnCargoToSource(w, p);
  p.trip = undefined;
  p.progress = 0;
  p.movement = 0;
  p.path = [];
}

function rerouteCurrentTask(w: World, p: Person): void {
  if (p.trip) {
    const target = w.buildings.find(
      (b) => b.id === (p.trip!.picked ? p.trip!.target : p.trip!.source),
    );
    if (target) route(w, p, target);
    else p.path = [];
    return;
  }
  if (p.assignment) {
    const target = w.buildings.find((b) => b.id === p.assignment!.building);
    if (target) route(w, p, target);
    else p.path = [];
    return;
  }
  const hq = w.buildings.find((b) => b.id === "hq");
  if (hq && !same(p.position, hq.position)) route(w, p, hq);
}

const roleLimit = (b: Building, role: Role): number => {
  if (role === "worker") return b.workers;
  if (role === "carrier") return b.carriers;
  return b.kind === "warehouse" ? (b.merchants ?? 0) : 0;
};

export function changeAssignment(
  w: World,
  id: BuildingId,
  role: Role,
  delta: 1 | -1,
): boolean {
  const b = building(w, id),
    people = assigned(w, id, role),
    limit = roleLimit(b, role);
  if (b.forestRemaining !== undefined || !limit) return false;
  if (delta === 1) {
    const p = freePeople(w)[0];
    if (!p || b.retired || people.length >= limit) return false;
    p.assignment = { building: id, role };
    if (role === "merchant") p.merchantRoute = { good: "wood" };
    p.active = same(p.position, b.position);
    p.movement = 0;
    route(w, p, b);
    return true;
  }
  const p = people.at(-1);
  if (!p) return false;
  cancel(w, p);
  p.assignment = undefined;
  p.merchantRoute = undefined;
  p.active = false;
  route(w, p, building(w, "hq"));
  return true;
}

export function setMerchantRoute(
  w: World,
  personId: number,
  target: BuildingId | undefined,
  good?: Good,
): boolean {
  const p = w.people.find((person) => person.id === personId);
  if (!p?.assignment || p.assignment.role !== "merchant") return false;
  const source = w.buildings.find((b) => b.id === p.assignment!.building);
  if (!source || source.kind !== "warehouse") return false;
  if (target) {
    const destination = w.buildings.find((b) => b.id === target && !b.retired);
    if (!destination || destination.kind !== "warehouse" || destination.id === source.id)
      return false;
  }
  if (p.trip) cancel(w, p);
  p.merchantRoute = { good: good ?? p.merchantRoute?.good ?? "wood", target };
  p.active = same(p.position, source.position);
  p.movement = 0;
  if (!p.active) route(w, p, source);
  return true;
}

export function changePopulation(w: World, delta: 1 | -1): boolean {
  const hq = building(w, "hq");
  if (delta === 1) {
    w.people.push({
      id: w.nextId++,
      position: { ...hq.position },
      active: false,
      progress: 0,
      movement: 0,
      path: [],
    });
    return true;
  }
  const index = w.people.findIndex(
    (p) => !p.assignment && !p.woodcutter && same(p.position, hq.position),
  );
  if (index < 0) return false;
  w.people.splice(index, 1);
  return true;
}

function randomIndex(w: World, length: number): number {
  w.rngState = (Math.imul(w.rngState, 1664525) + 1013904223) >>> 0;
  return w.rngState % length;
}

type ForestCandidate =
  | { kind: "active"; forest: Building; path: Hex[] }
  | { kind: "passive"; tile: Tile; path: Hex[] };

function forestCandidates(w: World, origin: Hex): ForestCandidate[] {
  const active: ForestCandidate[] = w.buildings
    .filter(
      (b) =>
        !b.retired &&
        b.forestRemaining !== undefined &&
        b.forestRemaining > 0 &&
        assigned(w, b.id, "worker").length === 0,
    )
    .map((forest) => ({
      kind: "active" as const,
      forest,
      path: findPath(
        w.tiles,
        origin,
        forest.position,
        CONFIG.roadSpeedMultiplier,
      ),
    }))
    .filter(
      (candidate): candidate is Extract<ForestCandidate, { kind: "active" }> =>
        candidate.path !== null,
    );
  const passive: ForestCandidate[] = w.tiles
    .filter((tile) => tile.terrain === "forest")
    .map((tile) => ({
      kind: "passive" as const,
      tile,
      path: findPath(w.tiles, origin, tile, CONFIG.roadSpeedMultiplier),
    }))
    .filter(
      (candidate): candidate is Extract<ForestCandidate, { kind: "passive" }> =>
        candidate.path !== null,
    );
  const candidates = [...active, ...passive];
  if (!candidates.length) return [];
  const costs = candidates.map((candidate) =>
    pathTravelCost(w.tiles, candidate.path, CONFIG.roadSpeedMultiplier),
  );
  const best = Math.min(...costs);
  return candidates.filter(
    (candidate) =>
      Math.abs(
        pathTravelCost(w.tiles, candidate.path, CONFIG.roadSpeedMultiplier) - best,
      ) < 1e-9,
  );
}

function activateForest(w: World, tile: Tile): Building {
  const number = w.nextForestId++;
  const forest: Building = {
    id: `forest-${number}`,
    kind: "forest",
    name: `Wald ${number}`,
    position: { q: tile.q, r: tile.r },
    workers: 1,
    carriers: 0,
    input: 0,
    output: 0,
    forestRemaining: CONFIG.forestYield,
    recipe: { amount: 0, output: "wood", duration: CONFIG.duration },
  };
  w.buildings.push(forest);
  tile.terrain = "building";
  tile.trafficTicks = undefined;
  return forest;
}

function assignWoodcutter(w: World, p: Person): boolean {
  const candidates = forestCandidates(w, p.position);
  if (!candidates.length) {
    p.assignment = undefined;
    p.active = false;
    p.movement = 0;
    const hq = building(w, "hq");
    if (!same(p.position, hq.position)) route(w, p, hq);
    return false;
  }
  const choice = candidates[randomIndex(w, candidates.length)]!;
  const forest =
    choice.kind === "active" ? choice.forest : activateForest(w, choice.tile);
  p.assignment = { building: forest.id, role: "worker" };
  p.active = same(p.position, forest.position);
  p.movement = 0;
  p.path = choice.path;
  return true;
}

export function changeWoodcutters(w: World, delta: 1 | -1): boolean {
  if (delta === 1) {
    const p = freePeople(w)[0];
    if (!p) return false;
    p.woodcutter = true;
    assignWoodcutter(w, p);
    return true;
  }
  const p = woodcutters(w).at(-1);
  if (!p) return false;
  cancel(w, p);
  p.assignment = undefined;
  p.woodcutter = undefined;
  p.active = false;
  route(w, p, building(w, "hq"));
  return true;
}

type SourceCandidate = { source: Building; good: Good; path: Hex[] };

function requestInput(w: World, p: Person, b: Building): void {
  const goods: Good[] = b.kind === "warehouse"
    ? ["wood", "plank", "woodenTool"]
    : b.recipe?.input
      ? [b.recipe.input]
      : [];
  if (!goods.length) return;
  if (
    b.kind !== "warehouse" &&
    b.input + incoming(w, b.id) >= CONFIG.inputCapacity
  )
    return;

  const sources: SourceCandidate[] = [];
  for (const good of goods) {
    if (b.kind === "warehouse" && !warehouseHasSpace(w, b, good)) continue;
    for (const source of w.buildings) {
      if (
        source.id === b.id ||
        source.retired && !(source.forestRemaining === 0 && source.output > 0) ||
        available(w, source, good) <= 0 ||
        (b.kind === "warehouse" && source.kind === "warehouse")
      )
        continue;
      if (b.kind === "warehouse") {
        const collectionPath = findPathBySteps(w.tiles, b.position, source.position);
        if (!collectionPath || collectionPath.length > CONFIG.warehouseCollectionRadius)
          continue;
      }
      const path = findPath(
        w.tiles,
        p.position,
        source.position,
        CONFIG.roadSpeedMultiplier,
      );
      if (path) sources.push({ source, good, path });
    }
  }
  sources.sort(
    (a, b) =>
      pathTravelCost(w.tiles, a.path, CONFIG.roadSpeedMultiplier) -
      pathTravelCost(w.tiles, b.path, CONFIG.roadSpeedMultiplier),
  );
  const source = sources[0];
  if (!source) return;
  p.trip = {
    source: source.source.id,
    target: b.id,
    good: source.good,
    picked: false,
  };
  p.path = source.path;
  p.movement = 0;
}

function requestMerchantTransfer(w: World, p: Person, source: Building): void {
  const routeConfig = p.merchantRoute;
  if (!routeConfig?.target || source.kind !== "warehouse") return;
  const target = w.buildings.find(
    (b) => b.id === routeConfig.target && b.kind === "warehouse" && !b.retired,
  );
  if (!target) {
    routeConfig.target = undefined;
    return;
  }
  if (!same(p.position, source.position)) {
    route(w, p, source);
    return;
  }
  if (
    available(w, source, routeConfig.good) <= 0 ||
    !warehouseHasSpace(w, target, routeConfig.good) ||
    !findPath(w.tiles, source.position, target.position, CONFIG.roadSpeedMultiplier)
  )
    return;
  p.trip = {
    source: source.id,
    target: target.id,
    good: routeConfig.good,
    picked: false,
  };
}

function retireDepletedForests(w: World): void {
  for (const forest of w.buildings.filter(
    (b) => !b.retired && b.forestRemaining === 0,
  )) {
    forest.retired = true;
    const tile = tileAt(w, forest.position);
    tile.terrain = "grass";
    tile.trafficTicks = undefined;
    for (const person of assigned(w, forest.id, "worker")) {
      person.assignment = undefined;
      person.active = false;
      person.progress = 0;
      person.movement = 0;
      person.path = [];
      if (person.woodcutter) assignWoodcutter(w, person);
    }
  }
}

function assignWaitingWoodcutters(w: World): void {
  for (const person of woodcutters(w)) {
    if (!person.assignment) assignWoodcutter(w, person);
  }
}

const buildingDefinition = (kind: BuildableBuildingKind): Omit<Building, "id" | "position" | "baseTerrain"> => {
  if (kind === "sawmill")
    return {
      kind,
      name: "Sägewerk",
      workers: 1,
      carriers: 2,
      input: 0,
      output: 0,
      recipe: { input: "wood", amount: 2, output: "plank", duration: CONFIG.duration },
    };
  if (kind === "carpenter")
    return {
      kind,
      name: "Schreinerei",
      workers: 1,
      carriers: 2,
      input: 0,
      output: 0,
      recipe: { input: "plank", amount: 2, output: "woodenTool", duration: CONFIG.duration },
    };
  return {
    kind,
    name: "Lager",
    workers: 0,
    carriers: 2,
    merchants: 2,
    input: 0,
    output: 0,
    inventory: { wood: 0, plank: 0, woodenTool: 0 },
  };
};

export function buildAt(
  w: World,
  position: Hex,
  kind: BuildableBuildingKind,
): Building | undefined {
  const tile = w.tiles.find((candidate) => same(candidate, position));
  if (!tile || (tile.terrain !== "grass" && tile.terrain !== "road")) return;
  const baseTerrain = tile.terrain;
  const number = w.nextBuildingId++;
  const b: Building = {
    ...buildingDefinition(kind),
    id: `${kind}-${number}`,
    position: { q: tile.q, r: tile.r },
    baseTerrain,
  };
  w.buildings.push(b);
  tile.terrain = "building";
  tile.trafficTicks = undefined;
  for (const p of w.people) rerouteCurrentTask(w, p);
  return b;
}

export function removeBuilding(w: World, id: BuildingId): boolean {
  const index = w.buildings.findIndex((b) => b.id === id);
  if (index < 0) return false;
  const removed = w.buildings[index]!;
  if (removed.kind === "hq" || removed.kind === "forest") return false;

  for (const p of w.people) {
    const affectedTrip = p.trip?.source === id || p.trip?.target === id;
    if (affectedTrip) cancel(w, p);
    if (p.merchantRoute?.target === id) p.merchantRoute.target = undefined;
    if (p.assignment?.building === id) {
      p.assignment = undefined;
      p.merchantRoute = undefined;
      p.active = false;
      p.progress = 0;
      p.movement = 0;
      route(w, p, building(w, "hq"));
    } else if (affectedTrip) {
      rerouteCurrentTask(w, p);
    }
  }

  w.buildings.splice(index, 1);
  const restored = tileAt(w, removed.position);
  restored.terrain = removed.baseTerrain ?? "grass";
  restored.trafficTicks = undefined;
  for (const p of w.people) {
    if (same(p.position, removed.position)) continue;
    if (p.path.some((step) => same(step, removed.position))) rerouteCurrentTask(w, p);
  }
  return true;
}

export function setRoad(w: World, position: Hex, enabled: boolean): boolean {
  const tile = w.tiles.find((candidate) => same(candidate, position));
  if (!tile) return false;
  if (enabled) {
    if (tile.terrain !== "grass") return false;
    tile.terrain = "road";
  } else {
    if (tile.terrain !== "road" || w.people.some((p) => same(p.position, tile)))
      return false;
    tile.terrain = "grass";
  }
  tile.trafficTicks = undefined;
  for (const p of w.people) rerouteCurrentTask(w, p);
  return true;
}

function recordTraffic(w: World, tile: Tile): boolean {
  if (tile.terrain !== "grass") return false;
  const cutoff = w.round - CONFIG.trafficWindowTicks + 1;
  const traffic = (tile.trafficTicks ?? []).filter((tick) => tick >= cutoff);
  traffic.push(w.round);
  if (traffic.length < CONFIG.trafficThreshold) {
    tile.trafficTicks = traffic;
    return false;
  }
  tile.terrain = "road";
  tile.trafficTicks = undefined;
  return true;
}

function movePeople(w: World): boolean {
  let roadCreated = false;
  for (const p of w.people) {
    if (!p.path.length) {
      p.movement = 0;
      continue;
    }
    p.movement += CONFIG.movementPerTick;
    let moves = 0;
    while (p.path.length && moves < 4) {
      const next = p.path[0]!;
      const tile = tileAt(w, next);
      const cost = movementCost(tile, CONFIG.roadSpeedMultiplier);
      if (p.movement + 1e-9 < cost) break;
      p.movement = Math.max(0, p.movement - cost);
      p.path.shift();
      p.position = { ...next };
      if (recordTraffic(w, tile)) roadCreated = true;
      moves++;
    }
  }
  return roadCreated;
}

/** One deterministic 1/60-second simulation step. */
export function tick(w: World): void {
  w.round++;
  const regularDecisionTick =
    (w.round - 1) % CONFIG.decisionIntervalTicks === 0;
  const immediateDecisionPeople = new Set<number>();

  if (movePeople(w)) {
    for (const p of w.people) rerouteCurrentTask(w, p);
  }

  for (const p of w.people) {
    if (p.path.length || !p.assignment) continue;
    const home = building(w, p.assignment.building);
    if (p.trip) {
      if (!p.trip.picked) {
        const source = building(w, p.trip.source);
        if (!same(p.position, source.position)) continue;
        if (source.kind === "warehouse") {
          source.inventory![p.trip.good] -= CONFIG.carryCapacity;
        } else {
          source.output -= CONFIG.carryCapacity;
        }
        p.trip.picked = true;
        p.movement = 0;
        route(w, p, building(w, p.trip.target));
      } else {
        const target = building(w, p.trip.target);
        if (!same(p.position, target.position)) continue;
        if (target.kind === "warehouse") {
          target.inventory![p.trip.good] += CONFIG.carryCapacity;
        } else {
          target.input += CONFIG.carryCapacity;
        }
        p.trip = undefined;
        p.movement = 0;
        immediateDecisionPeople.add(p.id);
      }
    } else if (same(p.position, home.position) && !p.active) {
      p.active = true;
      immediateDecisionPeople.add(p.id);
    }
  }

  for (const p of w.people) {
    if (!p.assignment || !p.active || p.trip || p.path.length) continue;
    const b = building(w, p.assignment.building);
    if (!same(p.position, b.position)) continue;
    const recipe = b.recipe;
    if (p.assignment.role === "worker" && recipe) {
      const forestHasYield =
        b.forestRemaining === undefined || b.forestRemaining > producing(w, b.id);
      if (
        p.progress === 0 &&
        forestHasYield &&
        b.input >= recipe.amount &&
        outputOccupied(w, b) < CONFIG.outputCapacity
      )
        p.progress = 1;
      else if (p.progress > 0) p.progress++;
      if (p.progress === recipe.duration) {
        b.input -= recipe.amount;
        b.output++;
        if (b.forestRemaining !== undefined) b.forestRemaining--;
        p.progress = 0;
        immediateDecisionPeople.add(p.id);
      }
    }
  }

  retireDepletedForests(w);
  if (regularDecisionTick) assignWaitingWoodcutters(w);

  if (!regularDecisionTick && immediateDecisionPeople.size === 0) return;

  for (const p of w.people) {
    if (!regularDecisionTick && !immediateDecisionPeople.has(p.id)) continue;
    if (!p.assignment || !p.active || p.path.length || p.trip || p.progress > 0)
      continue;
    const b = building(w, p.assignment.building);
    if (p.assignment.role === "merchant") {
      requestMerchantTransfer(w, p, b);
      continue;
    }
    const recipe = b.recipe;
    const workerNeedsResupply =
      p.assignment.role === "worker" &&
      recipe?.input &&
      b.input + incoming(w, b.id) < CONFIG.inputCapacity &&
      (b.input < recipe.amount || outputOccupied(w, b) >= CONFIG.outputCapacity);
    if (p.assignment.role === "carrier" || workerNeedsResupply)
      requestInput(w, p, b);
  }
}

export const GOODS: Record<Good, string> = {
  wood: "Holz",
  plank: "Bretter",
  woodenTool: "Holzwerkzeuge",
};

export function status(w: World, b: Building): string {
  const workers = assigned(w, b.id, "worker");
  if (b.kind === "hq") return "Sammelpunkt für freie Personen";
  if (b.kind === "warehouse") {
    const carriers = assigned(w, b.id, "carrier").length;
    const merchants = assigned(w, b.id, "merchant").length;
    if (merchants) return `${merchants} Händler · ${carriers} Lager-Träger`;
    return carriers
      ? `Träger sammeln Waren im Umkreis von ${CONFIG.warehouseCollectionRadius} Schritten`
      : "Keine Träger oder Händler zugewiesen";
  }
  if (b.forestRemaining !== undefined) {
    if (b.retired) return "Erschöpft";
    const progress = workers
      .filter((p) => p.progress > 0)
      .map((p) => `${Math.round((p.progress / b.recipe!.duration) * 100)} %`);
    if (progress.length) return `Holzabbau: ${progress.join(" · ")}`;
    if (!workers.length) return "Kein Holzfäller am Wald";
    if (outputOccupied(w, b) >= CONFIG.outputCapacity)
      return "Holz liegt bereit – Abholung abwarten";
    if (workers.every((p) => !p.active)) return "Holzfäller auf dem Weg";
    return "Bereit zum Holzabbau";
  }
  const progress = workers
    .filter((p) => p.progress > 0)
    .map((p) => `${Math.round((p.progress / b.recipe!.duration) * 100)} %`);
  if (progress.length) return `Produktion: ${progress.join(" · ")}`;
  if (!workers.length) return "Kein Arbeiter zugewiesen";
  if (outputOccupied(w, b) >= CONFIG.outputCapacity)
    return "Output belegt – Abholung abwarten";
  if (workers.some((p) => p.trip)) return "Arbeiter beschafft Rohstoffe";
  if (workers.every((p) => !p.active)) return "Arbeiter auf dem Weg";
  if (b.recipe?.input && b.input < b.recipe.amount)
    return `Wartet auf ${GOODS[b.recipe.input]}`;
  return "Bereit zur Produktion";
}
