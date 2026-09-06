import type { Building, BuildingId, Good, Person, Role, World } from "./model";
import { findPath, same } from "./hex";
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
    if (!p || people.length >= limit) return false;
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
      if (
        p.progress === 0 &&
        b.input >= recipe.amount &&
        outputOccupied(w, b) < CONFIG.outputCapacity
      )
        p.progress = 1;
      else if (p.progress > 0) p.progress++;
      if (p.progress === recipe.duration) {
        b.input -= recipe.amount;
        b.output++;
        p.progress = 0;
      }
    }
  }
  for (const p of w.people) {
    if (!p.assignment || !p.active || p.path.length || p.trip || p.progress > 0)
      continue;
    const b = building(w, p.assignment.building);
    if (
      p.assignment.role === "carrier" ||
      (p.assignment.role === "worker" &&
        b.recipe?.input &&
        b.input + incoming(w, b.id) < CONFIG.inputCapacity)
    )
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
