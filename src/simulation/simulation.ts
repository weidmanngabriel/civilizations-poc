import type { Building, BuildingId, Good, Hex, Person, Role, Tile, World } from "./model";
import { findPath, key, same } from "./hex";
import { CONFIG } from "./scenario";

export const building = (w: World, id: BuildingId): Building =>
  w.buildings.find((b) => b.id === id)!;
export const assigned = (w: World, id: BuildingId, role: Role): Person[] =>
  w.people.filter(
    (p) => p.assignment?.building === id && p.assignment.role === role,
  );
export const freePeople = (w: World): Person[] =>
  w.people.filter((p) => !p.assignment);
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
    (p) => !p.assignment && same(p.position, hq.position),
  );
  if (index < 0) return false;
  w.people.splice(index, 1);
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
        !s.retired &&
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

function randomIndex(w: World, length: number): number {
  w.rngState = (Math.imul(w.rngState, 1664525) + 1013904223) >>> 0;
  return w.rngState % length;
}

function forestCandidates(w: World, origin: Hex, targetCounts: Map<string, number>) {
  const candidates = w.tiles
    .filter((tile) => tile.terrain === "forest" && (targetCounts.get(key(tile)) ?? 0) < 2)
    .map((tile) => ({ tile, path: findPath(w.tiles, origin, tile) }))
    .filter(
      (candidate): candidate is { tile: Tile; path: Hex[] } =>
        candidate.path !== null,
    );
  const distance = Math.min(...candidates.map((candidate) => candidate.path.length));
  return candidates.filter((candidate) => candidate.path.length === distance);
}

function relocateDepletedForestWorkers(w: World): void {
  const depleted = w.buildings.filter(
    (b) => !b.retired && b.forestRemaining === 0,
  );
  if (!depleted.length) return;

  const targetCounts = new Map<string, number>();
  const plans: Array<{ person: Person; tile: Tile; path: Hex[] }> = [];
  for (const forest of depleted) {
    forest.workers = 0;
    for (const person of assigned(w, forest.id, "worker")) {
      if (person.progress > 0 || person.trip) continue;
      const candidates = forestCandidates(w, forest.position, targetCounts);
      if (!candidates.length) continue;
      const choice = candidates[randomIndex(w, candidates.length)]!;
      const targetKey = key(choice.tile);
      targetCounts.set(targetKey, (targetCounts.get(targetKey) ?? 0) + 1);
      plans.push({ person, tile: choice.tile, path: choice.path });
    }
  }

  const destinations = new Map<string, Building>();
  for (const plan of plans) {
    const targetKey = key(plan.tile);
    let forest = destinations.get(targetKey);
    if (!forest) {
      const id = `forest-${w.nextForestId++}` as BuildingId;
      forest = {
        id,
        name: `Wald ${w.nextForestId - 1}`,
        position: { q: plan.tile.q, r: plan.tile.r },
        workers: 2,
        carriers: 0,
        input: 0,
        output: 0,
        forestRemaining: CONFIG.forestYield,
        recipe: { amount: 0, output: "wood", duration: CONFIG.duration },
      };
      w.buildings.push(forest);
      plan.tile.terrain = "building";
      destinations.set(targetKey, forest);
    }
    plan.person.assignment = { building: forest.id, role: "worker" };
    plan.person.active = false;
    plan.person.path = plan.path;
  }
}

function retireEmptyForests(w: World): void {
  for (const forest of w.buildings) {
    if (
      forest.retired ||
      forest.forestRemaining !== 0 ||
      forest.output > 0 ||
      assigned(w, forest.id, "worker").length > 0
    )
      continue;
    forest.retired = true;
    tileAt(w, forest.position).terrain = "road";
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

  retireEmptyForests(w);

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

  relocateDepletedForestWorkers(w);

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
  if (b.forestRemaining === 0)
    return b.output > 0 ? "Erschöpft – Restholz verfügbar" : "Erschöpft";
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
