import type { Building, BuildingId, Good, Hex, Person, Role, Tile, World } from "./model";
import { findPath, key, same } from "./hex";
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
const incoming = (w: World, id: BuildingId) =>
  w.people.filter((p) => p.trip?.target === id).length;
const heldOutput = (w: World, id: BuildingId) =>
  w.people.filter((p) => p.trip?.source === id && p.trip.picked).length;
const available = (w: World, b: Building) =>
  b.output -
  w.people.filter((p) => p.trip?.source === b.id && !p.trip.picked).length;
const producing = (w: World, id: BuildingId) =>
  w.people.filter((p) => p.assignment?.building === id && p.progress > 0)
    .length;
export const outputOccupied = (w: World, b: Building): number =>
  b.output + heldOutput(w, b.id) + producing(w, b.id);
const route = (w: World, p: Person, b: Building) => {
  p.path = findPath(w.tiles, p.position, b.position) ?? [];
};
const tileAt = (w: World, position: Hex): Tile =>
  w.tiles.find((tile) => same(tile, position))!;

function cancel(w: World, p: Person): void {
  if (p.trip?.picked) building(w, p.trip.source).output += CONFIG.carryCapacity;
  p.trip = undefined;
  p.progress = 0;
  p.path = [];
}

export function changeAssignment(
  w: World,
  id: BuildingId,
  role: Role,
  delta: 1 | -1,
): boolean {
  const b = building(w, id),
    people = assigned(w, id, role),
    limit = role === "worker" ? b.workers : b.carriers;
  if (b.forestRemaining !== undefined) return false;
  if (delta === 1) {
    const p = freePeople(w)[0];
    if (!p || b.retired || people.length >= limit) return false;
    p.assignment = { building: id, role };
    p.active = same(p.position, b.position);
    route(w, p, b);
    return true;
  }
  const p = people.at(-1);
  if (!p) return false;
  cancel(w, p);
  p.assignment = undefined;
  p.active = false;
  route(w, p, building(w, "hq"));
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
      path: findPath(w.tiles, origin, forest.position),
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
      path: findPath(w.tiles, origin, tile),
    }))
    .filter(
      (candidate): candidate is Extract<ForestCandidate, { kind: "passive" }> =>
        candidate.path !== null,
    );
  const candidates = [...active, ...passive];
  if (!candidates.length) return [];
  const distance = Math.min(...candidates.map((candidate) => candidate.path.length));
  return candidates.filter((candidate) => candidate.path.length === distance);
}

function activateForest(w: World, tile: Tile): Building {
  const number = w.nextForestId++;
  const forest: Building = {
    id: `forest-${number}`,
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
  return forest;
}

function assignWoodcutter(w: World, p: Person): boolean {
  const candidates = forestCandidates(w, p.position);
  if (!candidates.length) {
    p.assignment = undefined;
    p.active = false;
    const hq = building(w, "hq");
    if (!same(p.position, hq.position)) route(w, p, hq);
    return false;
  }
  const choice = candidates[randomIndex(w, candidates.length)]!;
  const forest =
    choice.kind === "active" ? choice.forest : activateForest(w, choice.tile);
  p.assignment = { building: forest.id, role: "worker" };
  p.active = same(p.position, forest.position);
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

function requestInput(w: World, p: Person, b: Building): void {
  const good: Good | undefined =
    b.id === "warehouse" ? "woodenTool" : b.recipe?.input;
  if (
    !good ||
    (b.id !== "warehouse" &&
      b.input + incoming(w, b.id) >= CONFIG.inputCapacity)
  )
    return;
  const sources = w.buildings
    .filter(
      (s) =>
        (!s.retired || (s.forestRemaining === 0 && s.output > 0)) &&
        s.recipe?.output === good &&
        available(w, s) > 0 &&
        (b.id !== "warehouse" || s.id === "carpenter"),
    )
    .map((source) => ({
      source,
      path: findPath(w.tiles, p.position, source.position),
    }))
    .filter(
      (s): s is { source: Building; path: NonNullable<typeof s.path> } =>
        s.path !== null,
    )
    .sort((a, b) => a.path.length - b.path.length);
  const source = sources[0];
  if (!source) return;
  p.trip = { source: source.source.id, target: b.id, good, picked: false };
  p.path = source.path;
}

function retireDepletedForests(w: World): void {
  for (const forest of w.buildings.filter(
    (b) => !b.retired && b.forestRemaining === 0,
  )) {
    forest.retired = true;
    tileAt(w, forest.position).terrain = "road";
    for (const person of assigned(w, forest.id, "worker")) {
      person.assignment = undefined;
      person.active = false;
      person.progress = 0;
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

/** One deterministic round: move everyone once, handle arrivals, work, then plan. */
export function tick(w: World): void {
  w.round++;
  for (const p of w.people) {
    const next = p.path.shift();
    if (next) p.position = { ...next };
  }

  for (const p of w.people) {
    if (p.path.length || !p.assignment) continue;
    const b = building(w, p.assignment.building);
    if (p.trip) {
      if (!p.trip.picked) {
        const source = building(w, p.trip.source);
        if (!same(p.position, source.position)) continue;
        source.output -= CONFIG.carryCapacity;
        p.trip.picked = true;
        route(w, p, b);
      } else if (same(p.position, b.position)) {
        if (b.id === "warehouse") b.output += CONFIG.carryCapacity;
        else b.input += CONFIG.carryCapacity;
        p.trip = undefined;
      }
    } else if (same(p.position, b.position)) p.active = true;
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
      }
    }
  }

  retireDepletedForests(w);
  assignWaitingWoodcutters(w);

  for (const p of w.people) {
    if (!p.assignment || !p.active || p.path.length || p.trip || p.progress > 0)
      continue;
    const b = building(w, p.assignment.building);
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
  if (b.id === "hq") return "Sammelpunkt für freie Personen";
  if (b.id === "warehouse")
    return assigned(w, b.id, "carrier").length
      ? "Träger sammeln Holzwerkzeuge"
      : "Keine Träger zugewiesen";
  if (b.forestRemaining !== undefined) {
    if (b.retired) return "Erschöpft";
    const progress = workers
      .filter((p) => p.progress > 0)
      .map((p) => `${p.progress}/${b.recipe!.duration}`);
    if (progress.length) return `Holzabbau: ${progress.join(" · ")}`;
    if (!workers.length) return "Kein Holzfäller am Wald";
    if (outputOccupied(w, b) >= CONFIG.outputCapacity)
      return "Holz liegt bereit – Abholung abwarten";
    if (workers.every((p) => !p.active)) return "Holzfäller auf dem Weg";
    return "Bereit zum Holzabbau";
  }
  const progress = workers
    .filter((p) => p.progress > 0)
    .map((p) => `${p.progress}/${b.recipe!.duration}`);
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
