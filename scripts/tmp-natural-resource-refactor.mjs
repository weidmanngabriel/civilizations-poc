import fs from "node:fs";

const read = (path) => fs.readFileSync(path, "utf8");
const write = (path, content) => fs.writeFileSync(path, content);
const replace = (text, from, to, label = from.slice(0, 80)) => {
  if (!text.includes(from)) throw new Error(`Pattern not found: ${label}`);
  return text.replace(from, to);
};
const replaceAll = (text, from, to) => text.split(from).join(to);

// model.ts
{
  const path = "src/simulation/model.ts";
  let s = read(path);
  s = replace(s,
`export type BuildingKind = "hq" | "forest" | "clayDeposit" | "stoneDeposit" | "field" | "farm" | "sawmill" | "carpenter" | "mill" | "bakery" | "well" | "pottery" | "stonemason" | "warehouse" | "house";
export type BuildableBuildingKind = Exclude<BuildingKind, "hq" | "forest" | "clayDeposit" | "stoneDeposit" | "field" | "house">;`,
`export type BuildingKind = "hq" | "field" | "farm" | "sawmill" | "carpenter" | "mill" | "bakery" | "well" | "pottery" | "stonemason" | "warehouse" | "house";
export type BuildableBuildingKind = Exclude<BuildingKind, "hq" | "field" | "house">;
export type NaturalResourceId = string;
export type NaturalResourceKind = "forest" | "clay" | "stone";`);
  s = replace(s,
`  forestRemaining?: number;
  resourceRemaining?: number;
`, "");
  s = replace(s,
`export interface Trip {
  source: BuildingId;`,
`export interface NaturalResource {
  id: NaturalResourceId;
  kind: NaturalResourceKind;
  position: Hex;
  remaining: number;
  output: number;
  depleted?: boolean;
}
export interface Trip {
  source: BuildingId | NaturalResourceId;
  sourceKind?: "resource";`);
  s = replace(s,
`  resumeExtractor?: "clay" | "stone";
}`,
`  resumeExtractor?: "clay" | "stone";
  resumeResourceTarget?: NaturalResourceId;
}`);
  s = replace(s,
`  extractor?: "clay" | "stone";
  builder?: boolean;`,
`  extractor?: "clay" | "stone";
  resourceTarget?: NaturalResourceId;
  builder?: boolean;`);
  s = replace(s,
`  nextForestId: number;
  nextBuildingId: number;`,
`  nextBuildingId: number;`);
  s = replace(s,
`  people: Person[];
  buildings: Building[];
  tiles: Tile[];`,
`  people: Person[];
  buildings: Building[];
  naturalResources: NaturalResource[];
  tiles: Tile[];`);
  write(path, s);
}

// scenario.ts
{
  const path = "src/simulation/scenario.ts";
  let s = read(path);
  s = replace(s,
`import type { Building, Hex, Person, Tile, World } from "./model";`,
`import type { Building, Hex, NaturalResource, Person, Tile, World } from "./model";`);
  s = replace(s,
`  if (suppliedStart) {
    const adjacentGrass`,
`  const naturalResources: NaturalResource[] = forestTiles.map(([col, row], index) => ({
    id: \`forest-\${index + 1}\`,
    kind: "forest",
    position: at(col!, row!),
    remaining: CONFIG.forestYield,
    output: 0,
  }));

  if (suppliedStart) {
    const adjacentGrass`);
  s = replace(s,
`    const addDeposit = (tile: Tile, kind: "clayDeposit" | "stoneDeposit", index: number) => {
      const clay = kind === "clayDeposit";
      buildings.push({
        id: \`\${kind}-\${index + 1}\`,
        kind,
        name: clay ? \`Lehmvorkommen \${index + 1}\` : \`Steinvorkommen \${index + 1}\`,
        position: { q: tile.q, r: tile.r },
        workers: 1,
        carriers: 0,
        input: 0,
        output: 0,
        resourceRemaining: CONFIG.resourceYield,
        recipe: { amount: 0, output: clay ? "clay" : "rubble", duration: CONFIG.duration },
      });
      tile.bush = undefined;
      tile.bushAvailable = undefined;
      tile.bushRegrowTick = undefined;
      tile.terrain = "building";
    };
    spread(adjacentGrass("river"), 4).forEach((tile, index) => addDeposit(tile, "clayDeposit", index));
    spread(adjacentGrass("mountain"), 4).forEach((tile, index) => addDeposit(tile, "stoneDeposit", index));`,
`    const addResource = (tile: Tile, kind: "clay" | "stone", index: number) => {
      naturalResources.push({
        id: \`\${kind}-\${index + 1}\`,
        kind,
        position: { q: tile.q, r: tile.r },
        remaining: CONFIG.resourceYield,
        output: 0,
      });
      tile.bush = undefined;
      tile.bushAvailable = undefined;
      tile.bushRegrowTick = undefined;
    };
    spread(adjacentGrass("river"), 4).forEach((tile, index) => addResource(tile, "clay", index));
    spread(adjacentGrass("mountain"), 4).forEach((tile, index) => addResource(tile, "stone", index));`);
  s = replace(s, `    nextForestId: 1,\n`, "");
  s = replace(s,
`    buildings,
    tiles,
    people,`,
`    buildings,
    naturalResources,
    tiles,
    people,`);
  write(path, s);
}

// experience.ts
{
  const path = "src/simulation/experience.ts";
  let s = read(path);
  s = replace(s, `  if (building.kind === "forest") return "woodcutter";\n`, "");
  s = replace(s, `  if (building.kind === "clayDeposit") return "clayDigger";\n  if (building.kind === "stoneDeposit") return "stonecutter";\n`, "");
  s = replace(s,
`  if (p.woodcutter) return "woodcutter";
  if (!p.assignment) return undefined;`,
`  if (p.woodcutter) return "woodcutter";
  if (p.extractor === "clay") return "clayDigger";
  if (p.extractor === "stone") return "stonecutter";
  if (!p.assignment) return undefined;`);
  write(path, s);
}

// buildingPlacement.ts
{
  const path = "src/simulation/buildingPlacement.ts";
  let s = read(path);
  s = replace(s,
`const createPlacementLookup = (world: World): PlacementLookup => ({
  freeTiles: new Set(
    world.tiles
      .filter((tile) => tile.terrain === "grass" || tile.terrain === "road")
      .map(key),
  ),`,
`const createPlacementLookup = (world: World): PlacementLookup => {
  const occupiedResources = new Set(
    world.naturalResources.filter((resource) => !resource.depleted).map((resource) => key(resource.position)),
  );
  return {
  freeTiles: new Set(
    world.tiles
      .filter((tile) =>
        (tile.terrain === "grass" || tile.terrain === "road") &&
        !occupiedResources.has(key(tile)),
      )
      .map(key),
  ),`);
  s = replace(s,
`  people: new Set(world.people.map((person) => key(person.position))),
});`,
`  people: new Set(world.people.map((person) => key(person.position))),
  };
};`);
  s = replace(s,
`  if (!existing || existing.kind === "hq" || existing.kind === "forest" || existing.kind === "clayDeposit" || existing.kind === "stoneDeposit" || existing.kind === "field") return false;`,
`  if (!existing || existing.kind === "hq" || existing.kind === "field") return false;`);
  write(path, s);
}

// simulation.ts
{
  const path = "src/simulation/simulation.ts";
  let s = read(path);
  s = replace(s,
`  Hex,
  Person,
  Role,`,
`  Hex,
  NaturalResource,
  NaturalResourceId,
  NaturalResourceKind,
  Person,
  Role,`);
  s = replace(s,
`export const building = (w: World, id: BuildingId): Building =>
  w.buildings.find((b) => b.id === id)!;`,
`export const building = (w: World, id: BuildingId): Building =>
  w.buildings.find((b) => b.id === id)!;
export const naturalResource = (w: World, id: NaturalResourceId): NaturalResource =>
  w.naturalResources.find((resource) => resource.id === id)!;
export const resourceWorkers = (w: World, id: NaturalResourceId): Person[] =>
  w.people.filter((person) => person.resourceTarget === id);`);
  s = replace(s,
`const reservedAtSource = (w: World, id: BuildingId, good: Good) =>
  w.people.filter(
    (p) => p.trip?.source === id && p.trip.good === good && !p.trip.picked,
  ).length;`,
`const reservedAtSource = (
  w: World,
  id: BuildingId | NaturalResourceId,
  good: Good,
  sourceKind?: "resource",
) =>
  w.people.filter(
    (p) =>
      p.trip?.source === id &&
      p.trip.good === good &&
      p.trip.sourceKind === sourceKind &&
      !p.trip.picked,
  ).length;`);
  s = replace(s,
`const outputCapacityFor = (b: Building): number =>
  b.forestRemaining !== undefined
    ? CONFIG.forestOutputCapacity
    : b.resourceRemaining !== undefined
      ? CONFIG.resourceOutputCapacity
      : CONFIG.outputCapacity;`,
`const outputCapacityFor = (_b: Building): number => CONFIG.outputCapacity;
const naturalOutputCapacity = (_resource: NaturalResource): number => CONFIG.resourceOutputCapacity;
const naturalResourceGood = (resource: NaturalResource): Good =>
  resource.kind === "forest" ? "wood" : resource.kind === "clay" ? "clay" : "rubble";
const naturalResourceProfession = (resource: NaturalResource): "woodcutter" | "clayDigger" | "stonecutter" =>
  resource.kind === "forest" ? "woodcutter" : resource.kind === "clay" ? "clayDigger" : "stonecutter";`);
  s = replace(s,
`const route = (
  w: World,
  p: Person,
  b: Building,
  reason: PathReason = routeReason(p),
) => {
  p.path = performanceProfiler.withPathReason(reason, () =>
    findPath(
      w.tiles,
      p.position,
      b.position,
      CONFIG.roadSpeedMultiplier,
    ),
  ) ?? [];
};`,
`const routeToPosition = (
  w: World,
  p: Person,
  position: Hex,
  reason: PathReason = routeReason(p),
) => {
  p.path = performanceProfiler.withPathReason(reason, () =>
    findPath(w.tiles, p.position, position, CONFIG.roadSpeedMultiplier),
  ) ?? [];
};
const route = (
  w: World,
  p: Person,
  b: Building,
  reason: PathReason = routeReason(p),
) => routeToPosition(w, p, b.position, reason);`);
  s = replace(s,
`function returnCargoToSource(w: World, p: Person): void {
  if (!p.trip?.picked) return;
  const source = w.buildings.find((b) => b.id === p.trip!.source);
  if (!source || (source.kind === "well" && p.trip.good === "water")) {
    p.pendingFarmBonus = undefined;
    return;
  }
  const amount = CONFIG.carryCapacity + (p.pendingFarmBonus ?? 0);
  if (source.kind === "warehouse" && !isUnderConstruction(source)) {
    source.inventory ??= {};
    source.inventory[p.trip.good] = (source.inventory[p.trip.good] ?? 0) + amount;
  } else {
    source.output += amount;
  }
  p.pendingFarmBonus = undefined;
}`,
`function returnCargoToSource(w: World, p: Person): void {
  if (!p.trip?.picked) return;
  const amount = CONFIG.carryCapacity + (p.pendingFarmBonus ?? 0);
  if (p.trip.sourceKind === "resource") {
    const source = w.naturalResources.find((resource) => resource.id === p.trip!.source);
    if (source) source.output += amount;
    p.pendingFarmBonus = undefined;
    return;
  }
  const source = w.buildings.find((b) => b.id === p.trip!.source);
  if (!source || (source.kind === "well" && p.trip.good === "water")) {
    p.pendingFarmBonus = undefined;
    return;
  }
  if (source.kind === "warehouse" && !isUnderConstruction(source)) {
    source.inventory ??= {};
    source.inventory[p.trip.good] = (source.inventory[p.trip.good] ?? 0) + amount;
  } else {
    source.output += amount;
  }
  p.pendingFarmBonus = undefined;
}`);
  s = replace(s,
`  if (p.trip) {
    const target = w.buildings.find(
      (b) => b.id === (p.trip!.picked ? p.trip!.target : p.trip!.source),
    );
    if (target) route(w, p, target, "reroute");
    else p.path = [];
    return;
  }
  if (p.assignment) {`,
`  if (p.trip) {
    if (!p.trip.picked && p.trip.sourceKind === "resource") {
      const source = w.naturalResources.find((resource) => resource.id === p.trip!.source);
      if (source) routeToPosition(w, p, source.position, "reroute");
      else p.path = [];
      return;
    }
    const target = w.buildings.find(
      (b) => b.id === (p.trip!.picked ? p.trip!.target : p.trip!.source),
    );
    if (target) route(w, p, target, "reroute");
    else p.path = [];
    return;
  }
  if (p.resourceTarget) {
    const target = w.naturalResources.find((resource) => resource.id === p.resourceTarget);
    if (target && !target.depleted) routeToPosition(w, p, target.position, "reroute");
    else p.path = [];
    return;
  }
  if (p.assignment) {`);
  s = replace(s,
`  if (b.forestRemaining !== undefined || b.resourceRemaining !== undefined || b.kind === "field" || !limit) return false;`,
`  if (b.kind === "field" || !limit) return false;`);

  const woodStart = `type ForestCandidate =`;
  const woodEnd = `export function changeWoodcutters(w: World, delta: 1 | -1): boolean {`;
  const a = s.indexOf(woodStart);
  const b = s.indexOf(woodEnd);
  if (a < 0 || b < 0 || b <= a) throw new Error("natural worker block markers not found");
  const newWorkers = `type NaturalResourceCandidate = { resource: NaturalResource; path: Hex[]; cost: number };

type ExtractorKind = "clay" | "stone";

function naturalResourceCandidates(
  w: World,
  origin: Hex,
  kind: NaturalResourceKind,
): NaturalResourceCandidate[] {
  const reason: PathReason = kind === "forest" ? "woodcutter" : "other";
  return performanceProfiler.withPathReason(reason, () => {
    const candidates = w.naturalResources
      .filter(
        (resource) =>
          resource.kind === kind &&
          !resource.depleted &&
          resource.remaining > 0 &&
          resourceWorkers(w, resource.id).length === 0,
      )
      .map((resource) => {
        const path = findPath(w.tiles, origin, resource.position, CONFIG.roadSpeedMultiplier);
        return path ? {
          resource,
          path,
          cost: pathTravelCost(w.tiles, path, CONFIG.roadSpeedMultiplier),
        } : undefined;
      })
      .filter((candidate): candidate is NaturalResourceCandidate => Boolean(candidate));
    if (!candidates.length) return [];
    const best = Math.min(...candidates.map((candidate) => candidate.cost));
    return candidates.filter((candidate) => Math.abs(candidate.cost - best) < 1e-9);
  });
}

function assignNaturalWorker(w: World, p: Person, kind: NaturalResourceKind): boolean {
  if (needDueBeforeNewTask(p)) return false;
  const candidates = naturalResourceCandidates(w, p.position, kind);
  if (!candidates.length) {
    p.resourceTarget = undefined;
    p.assignment = undefined;
    p.active = false;
    p.movement = 0;
    const hq = building(w, "hq");
    if (!same(p.position, hq.position)) route(w, p, hq, kind === "forest" ? "woodcutter" : "other");
    return false;
  }
  const choice = candidates[randomIndex(w, candidates.length)]!;
  p.assignment = undefined;
  p.resourceTarget = choice.resource.id;
  p.active = same(p.position, choice.resource.position);
  p.movement = 0;
  p.path = choice.path;
  return true;
}

export function changeExtractors(
  w: World,
  kind: ExtractorKind,
  delta: 1 | -1,
): boolean {
  if (delta === 1) {
    const p = freePeople(w)[0];
    if (!p) return false;
    p.extractor = kind;
    assignNaturalWorker(w, p, kind);
    return true;
  }
  const pool = w.people.filter((p) => p.extractor === kind);
  const p = pool.find((person) => !person.resourceTarget) ?? pool.at(-1);
  if (!p) return false;
  cancel(w, p);
  p.assignment = undefined;
  p.resourceTarget = undefined;
  p.extractor = undefined;
  p.active = false;
  route(w, p, building(w, "hq"), "other");
  return true;
}

`;
  s = s.slice(0, a) + newWorkers + s.slice(b);
  s = replace(s,
`export function changeWoodcutters(w: World, delta: 1 | -1): boolean {
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
  route(w, p, building(w, "hq"), "woodcutter");
  return true;
}`,
`export function changeWoodcutters(w: World, delta: 1 | -1): boolean {
  if (delta === 1) {
    const p = freePeople(w)[0];
    if (!p) return false;
    p.woodcutter = true;
    assignNaturalWorker(w, p, "forest");
    return true;
  }
  const pool = woodcutters(w);
  const p = pool.find((person) => !person.resourceTarget) ?? pool.at(-1);
  if (!p) return false;
  cancel(w, p);
  p.assignment = undefined;
  p.resourceTarget = undefined;
  p.woodcutter = undefined;
  p.active = false;
  route(w, p, building(w, "hq"), "woodcutter");
  return true;
}`);
  s = replace(s,
`type SourceCandidate = { source: Building; good: Good; path: Hex[] };`,
`type SourceCandidate =
  | { sourceKind: "building"; source: Building; good: Good; path: Hex[] }
  | { sourceKind: "resource"; source: NaturalResource; good: Good; path: Hex[] };`);
  s = replace(s,
`        if (path) sources.push({ source, good, path });
      }
    }
    sources.sort(`,
`        if (path) sources.push({ sourceKind: "building", source, good, path });
      }
      for (const source of w.naturalResources) {
        if (
          naturalResourceGood(source) !== good ||
          source.output - reservedAtSource(w, source.id, good, "resource") + 1e-9 < CONFIG.carryCapacity
        ) continue;
        if (isWarehouseCollection) {
          const collectionPath = performanceProfiler.withPathReason(pathReason, () =>
            findPathBySteps(w.tiles, b.position, source.position),
          );
          if (!collectionPath || collectionPath.length > CONFIG.warehouseCollectionRadius) continue;
        }
        const path = performanceProfiler.withPathReason(pathReason, () =>
          findPath(w.tiles, p.position, source.position, CONFIG.roadSpeedMultiplier),
        );
        if (path) sources.push({ sourceKind: "resource", source, good, path });
      }
    }
    sources.sort(`);
  s = replace(s,
`  p.trip = {
    source: source.source.id,
    target: b.id,
    good: source.good,
    picked: false,
  };`,
`  p.trip = {
    source: source.source.id,
    ...(source.sourceKind === "resource" ? { sourceKind: "resource" as const } : {}),
    target: b.id,
    good: source.good,
    picked: false,
  };`);
  s = replace(s,
`function retireDepletedResources(w: World): void {
  for (const source of w.buildings.filter(
    (b) => !b.retired && (b.forestRemaining === 0 || b.resourceRemaining === 0),
  )) {
    source.retired = true;
    const tile = tileAt(w, source.position);
    tile.terrain = "grass";
    tile.trafficTicks = undefined;
    for (const person of assigned(w, source.id, "worker")) {
      person.assignment = undefined;
      person.active = false;
      person.progress = 0;
      person.movement = 0;
      person.path = [];
      if (person.woodcutter) assignWoodcutter(w, person);
      else if (person.extractor) assignExtractor(w, person, person.extractor);
      else route(w, person, building(w, "hq"), "reroute");
    }
  }
}

function assignWaitingWoodcutters(w: World): void {
  for (const person of woodcutters(w)) {
    if (!person.assignment) assignWoodcutter(w, person);
  }
}

function assignWaitingExtractors(w: World): void {
  for (const person of w.people) {
    if (person.extractor && !person.assignment) assignExtractor(w, person, person.extractor);
  }
}`,
`function retireDepletedResources(w: World): void {
  for (const resource of w.naturalResources.filter(
    (candidate) => !candidate.depleted && candidate.remaining === 0,
  )) {
    resource.depleted = true;
    const tile = tileAt(w, resource.position);
    if (resource.kind === "forest") tile.terrain = "grass";
    tile.trafficTicks = undefined;
    for (const person of resourceWorkers(w, resource.id)) {
      person.resourceTarget = undefined;
      person.active = false;
      person.progress = 0;
      person.movement = 0;
      person.path = [];
      if (person.woodcutter) assignNaturalWorker(w, person, "forest");
      else if (person.extractor) assignNaturalWorker(w, person, person.extractor);
      else route(w, person, building(w, "hq"), "reroute");
    }
  }
}

function assignWaitingWoodcutters(w: World): void {
  for (const person of woodcutters(w)) {
    if (!person.resourceTarget) assignNaturalWorker(w, person, "forest");
  }
}

function assignWaitingExtractors(w: World): void {
  for (const person of w.people) {
    if (person.extractor && !person.resourceTarget) assignNaturalWorker(w, person, person.extractor);
  }
}`);
  s = replace(s,
`  if (removed.kind === "hq" || removed.kind === "forest" || removed.kind === "clayDeposit" || removed.kind === "stoneDeposit" || removed.kind === "field") return false;`,
`  if (removed.kind === "hq" || removed.kind === "field") return false;`);
  s = replace(s,
`  if (enabled) {
    if (tile.terrain !== "grass") return false;`,
`  if (enabled) {
    if (
      tile.terrain !== "grass" ||
      w.naturalResources.some((resource) => !resource.depleted && same(resource.position, tile))
    ) return false;`);
  s = replace(s,
`function recordTraffic(w: World, tile: Tile): boolean {
  if (tile.terrain !== "grass") return false;`,
`function recordTraffic(w: World, tile: Tile): boolean {
  if (
    tile.terrain !== "grass" ||
    w.naturalResources.some((resource) => !resource.depleted && same(resource.position, tile))
  ) return false;`);
  s = replace(s,
`function advanceConstruction(w: World): void {`,
`function advanceNaturalResourceExtraction(w: World, immediateDecisionPeople: Set<number>): void {
  for (const p of w.people) {
    if (!p.resourceTarget || !p.active || p.trip || p.path.length || p.farmTask || p.hungerState || p.sleepState)
      continue;
    const resource = w.naturalResources.find((candidate) => candidate.id === p.resourceTarget);
    if (!resource || resource.depleted || !same(p.position, resource.position)) continue;
    const profession = naturalResourceProfession(resource);
    const speed = extractionSpeedMultiplier(p, profession);
    if (
      p.progress === 0 &&
      !needDueBeforeNewTask(p) &&
      resource.remaining > 0 &&
      resource.output < naturalOutputCapacity(resource)
    ) p.progress = speed;
    else if (p.progress > 0) p.progress += speed;
    if (p.progress > 0) gainProfessionExperience(p, profession);
    if (p.progress >= CONFIG.duration) {
      resource.output += 1;
      resource.remaining--;
      p.progress = 0;
      immediateDecisionPeople.add(p.id);
    }
  }
}

function advanceConstruction(w: World): void {`);
  s = replace(s,
`  measureFeature("production", () => {
    for (const p of w.people) {`,
`  measureFeature("production", () => {
    advanceNaturalResourceExtraction(w, immediateDecisionPeople);
    for (const p of w.people) {`);
  s = replace(s,
`        const profession = workerProfession(b);
        const forestHasYield =
          b.forestRemaining === undefined || b.forestRemaining > producing(w, b.id);
        const resourceHasYield =
          b.resourceRemaining === undefined || b.resourceRemaining > producing(w, b.id);
        const outputHasSpace = outputOccupied(w, b) < outputCapacityFor(b);
        const naturalExtraction = b.kind === "forest" || b.resourceRemaining !== undefined;
        const workSpeed =
          naturalExtraction &&
          (profession === "woodcutter" || profession === "clayDigger" || profession === "stonecutter")
            ? extractionSpeedMultiplier(p, profession)
            : 1;`,
`        const profession = workerProfession(b);
        const outputHasSpace = outputOccupied(w, b) < outputCapacityFor(b);
        const workSpeed = 1;`);
  s = replace(s,
`          forestHasYield &&
          resourceHasYield &&
          hasRecipeInputs(b) &&`,
`          hasRecipeInputs(b) &&`);
  s = replace(s,
`          const multiplier =
            naturalExtraction
              ? 1
              : profession
                ? productionMultiplier(p, profession)
                : 1;
          b.output += recipeOutputAmount(b) * multiplier;
          if (b.forestRemaining !== undefined) b.forestRemaining--;
          if (b.resourceRemaining !== undefined) b.resourceRemaining--;`,
`          const multiplier = profession ? productionMultiplier(p, profession) : 1;
          b.output += recipeOutputAmount(b) * multiplier;`);
  s = replace(s,
`          const source = building(w, p.trip.source);
          if (!same(p.position, source.position)) continue;
          if (source.kind === "warehouse" && !isUnderConstruction(source)) {
            source.inventory![p.trip.good] =
              (source.inventory![p.trip.good] ?? 0) - CONFIG.carryCapacity;
          } else if (!(source.kind === "well" && p.trip.good === "water")) {
            source.output -= CONFIG.carryCapacity;
          }`,
`          if (p.trip.sourceKind === "resource") {
            const source = naturalResource(w, p.trip.source);
            if (!same(p.position, source.position)) continue;
            source.output -= CONFIG.carryCapacity;
          } else {
            const source = building(w, p.trip.source);
            if (!same(p.position, source.position)) continue;
            if (source.kind === "warehouse" && !isUnderConstruction(source)) {
              source.inventory![p.trip.good] =
                (source.inventory![p.trip.good] ?? 0) - CONFIG.carryCapacity;
            } else if (!(source.kind === "well" && p.trip.good === "water")) {
              source.output -= CONFIG.carryCapacity;
            }
          }`);
  // resource workers become active after arriving, independently of building assignments
  s = replace(s,
`  measureFeature("construction", () => advanceConstruction(w));`,
`  for (const p of w.people) {
    if (!p.resourceTarget || p.path.length) continue;
    const target = w.naturalResources.find((resource) => resource.id === p.resourceTarget);
    if (target && !target.depleted && same(p.position, target.position)) p.active = true;
  }

  measureFeature("construction", () => advanceConstruction(w));`);
  // strip building-specific natural resource status branches
  const resourceStatusStart = `  if (b.resourceRemaining !== undefined) {`;
  const forestStatusStart = `  if (b.forestRemaining !== undefined) {`;
  let rs = s.indexOf(resourceStatusStart);
  let fs = s.indexOf(forestStatusStart, rs);
  if (rs >= 0 && fs > rs) s = s.slice(0, rs) + s.slice(fs);
  fs = s.indexOf(forestStatusStart);
  if (fs >= 0) {
    const next = s.indexOf(`  const progress = workers`, fs);
    if (next < 0) throw new Error("status natural block end not found");
    s = s.slice(0, fs) + s.slice(next);
  }
  write(path, s);
}

// needs.ts
{
  const path = "src/simulation/needs.ts";
  let s = read(path);
  s = replace(s,
`import type { Building, BuildingId, Good, Hex, HungerState, Person, Tile, World } from "./model";`,
`import type { Building, BuildingId, Good, Hex, HungerState, NaturalResource, NaturalResourceId, Person, Tile, World } from "./model";`);
  s = replace(s,
`const ALL_GOODS: Good[] = ["wood", "plank", "woodenTool", "wheat", "flour", "water", "bread"];`,
`const ALL_GOODS: Good[] = ["wood", "plank", "woodenTool", "wheat", "flour", "water", "bread", "clay", "rubble", "brick", "stoneBlock"];`);
  s = replace(s,
`type CollectionCandidate = {
  source: Building;
  good: Good;
  path: Hex[];
  cost: number;
};`,
`type CollectionCandidate =
  | { sourceKind: "building"; source: Building; good: Good; path: Hex[]; cost: number }
  | { sourceKind: "resource"; source: NaturalResource; good: Good; path: Hex[]; cost: number };`);
  s = replace(s,
`  if (person.trip) {
    const buildingId = person.trip.picked ? person.trip.target : person.trip.source;
    return world.buildings.find((building) => building.id === buildingId)?.position;
  }
  if (person.assignment)`,
`  if (person.trip) {
    if (!person.trip.picked && person.trip.sourceKind === "resource")
      return world.naturalResources.find((resource) => resource.id === person.trip!.source)?.position;
    const buildingId = person.trip.picked ? person.trip.target : person.trip.source;
    return world.buildings.find((building) => building.id === buildingId)?.position;
  }
  if (person.resourceTarget)
    return world.naturalResources.find((resource) => resource.id === person.resourceTarget)?.position;
  if (person.assignment)`);
  s = replace(s,
`    person.active = hungerState.resumeActive || Boolean(person.assignment);`,
`    person.active = hungerState.resumeActive || Boolean(person.assignment) || Boolean(person.resourceTarget);`);
  s = replace(s,
`const reservedAtSource = (world: World, id: BuildingId, good: Good): number =>
  world.people.filter(
    (person) => person.trip?.source === id && person.trip.good === good && !person.trip.picked,
  ).length;`,
`const naturalResourceGood = (resource: NaturalResource): Good =>
  resource.kind === "forest" ? "wood" : resource.kind === "clay" ? "clay" : "rubble";

const reservedAtSource = (
  world: World,
  id: BuildingId | NaturalResourceId,
  good: Good,
  sourceKind?: "resource",
): number =>
  world.people.filter(
    (person) =>
      person.trip?.source === id &&
      person.trip.good === good &&
      person.trip.sourceKind === sourceKind &&
      !person.trip.picked,
  ).length;`);
  s = replace(s,
`      candidates.push({
        source,
        good,
        path,
        cost: pathTravelCost(world.tiles, path, ROAD_SPEED_MULTIPLIER),
      });
    }
  }
  candidates.sort`,
`      candidates.push({
        sourceKind: "building",
        source,
        good,
        path,
        cost: pathTravelCost(world.tiles, path, ROAD_SPEED_MULTIPLIER),
      });
    }
    for (const source of world.naturalResources) {
      if (
        naturalResourceGood(source) !== good ||
        source.output - reservedAtSource(world, source.id, good, "resource") < CONFIG.carryCapacity
      ) continue;
      const rangePath = performanceProfiler.withPathReason("logistics", () =>
        findPathBySteps(world.tiles, hq.position, source.position),
      );
      if (!rangePath || rangePath.length > CONFIG.warehouseCollectionRadius) continue;
      const path = routeTo(world, person, source.position, "logistics");
      if (!path) continue;
      candidates.push({
        sourceKind: "resource",
        source,
        good,
        path,
        cost: pathTravelCost(world.tiles, path, ROAD_SPEED_MULTIPLIER),
      });
    }
  }
  candidates.sort`);
  s = replace(s,
`  person.trip = {
    source: candidate.source.id,
    target: proxy.id,
    good: candidate.good,
    picked: false,
  };`,
`  person.trip = {
    source: candidate.source.id,
    ...(candidate.sourceKind === "resource" ? { sourceKind: "resource" as const } : {}),
    target: proxy.id,
    good: candidate.good,
    picked: false,
  };`);
  write(path, s);
}

// sleep.ts
{
  const path = "src/simulation/sleep.ts";
  let s = read(path);
  s = replace(s,
`  if (person.trip) {
    const buildingId = person.trip.picked ? person.trip.target : person.trip.source;
    return world.buildings.find((building) => building.id === buildingId)?.position;
  }
  if (person.assignment)`,
`  if (person.trip) {
    if (!person.trip.picked && person.trip.sourceKind === "resource")
      return world.naturalResources.find((resource) => resource.id === person.trip!.source)?.position;
    const buildingId = person.trip.picked ? person.trip.target : person.trip.source;
    return world.buildings.find((building) => building.id === buildingId)?.position;
  }
  if (person.resourceTarget)
    return world.naturalResources.find((resource) => resource.id === person.resourceTarget)?.position;
  if (person.assignment)`);
  s = replace(s,
`  person.extractor = state.resumeExtractor;
  person.active = false;`,
`  person.extractor = state.resumeExtractor;
  const resourceStillAvailable = state.resumeResourceTarget
    ? world.naturalResources.some(
        (resource) =>
          resource.id === state.resumeResourceTarget &&
          !resource.depleted &&
          !world.people.some(
            (other) => other.id !== person.id && other.resourceTarget === state.resumeResourceTarget,
          ),
      )
    : false;
  person.resourceTarget = resourceStillAvailable ? state.resumeResourceTarget : undefined;
  if (state.resumeResourceTarget && !resourceStillAvailable) person.progress = 0;
  person.active = false;`);
  s = replace(s,
`    resumeExtractor: person.extractor,
  };`,
`    resumeExtractor: person.extractor,
    resumeResourceTarget: person.resourceTarget,
  };`);
  s = replace(s,
`  person.extractor = undefined;
  person.active = false;`,
`  person.extractor = undefined;
  person.resourceTarget = undefined;
  person.active = false;`);
  write(path, s);
}

// MainScene.ts
{
  const path = "src/game/MainScene.ts";
  let s = read(path);
  s = replace(s, `    if (b.kind === "forest") return "WALD";\n`, "");
  s = replace(s, `      if (workplace?.kind === "clayDeposit") return "🟤";\n      if (workplace?.kind === "stoneDeposit") return "⛏️";\n`, "");
  s = replace(s,
`      if (tile.terrain === "forest") {
        this.drawTree(g, x - 3, y + 1);
        this.drawTree(g, x + 3, y - 1);
      }
      if (tile.terrain === "field") this.drawField(g, tile, x, y);`,
`      if (tile.terrain === "forest") {
        const forest = this.world.naturalResources.find(
          (resource) => resource.kind === "forest" && !resource.depleted && same(resource.position, tile),
        );
        const alpha = forest
          ? Math.max(MIN_FOREST_ALPHA, forest.remaining / CONFIG.forestYield)
          : 1;
        this.drawTree(g, x - 3, y + 1, alpha);
        this.drawTree(g, x + 3, y - 1, alpha);
      }
      const resource = this.world.naturalResources.find(
        (candidate) => !candidate.depleted && candidate.kind !== "forest" && same(candidate.position, tile),
      );
      if (resource?.kind === "clay") {
        g.fillStyle(0x9b6a4d, 0.95);
        g.fillCircle(x - 3, y + 1, 4);
        g.fillCircle(x + 3, y + 2, 3);
      } else if (resource?.kind === "stone") {
        g.fillStyle(0xaeb3af, 0.95);
        g.fillTriangle(x - 6, y + 5, x - 1, y - 4, x + 3, y + 5);
        g.fillTriangle(x, y + 5, x + 5, y - 2, x + 7, y + 5);
      }
      if (tile.terrain === "field") this.drawField(g, tile, x, y);`);
  s = replace(s,
`      if (b.resourceRemaining !== undefined) {
        if (b.kind === "clayDeposit") {
          g.fillStyle(0x9b6a4d, 0.95);
          g.fillCircle(x - 3, y - 11, 4);
          g.fillCircle(x + 3, y - 10, 3);
        } else {
          g.fillStyle(0xaeb3af, 0.95);
          g.fillTriangle(x - 6, y - 8, x - 1, y - 17, x + 3, y - 8);
          g.fillTriangle(x, y - 8, x + 5, y - 15, x + 7, y - 8);
        }
      } else if (b.forestRemaining !== undefined) {
        this.drawTree(
          g,
          x,
          y - 11,
          Math.max(MIN_FOREST_ALPHA, b.forestRemaining / CONFIG.forestYield),
        );
      } else if (underConstruction(b)) {`,
`      if (underConstruction(b)) {`);
  s = replace(s,
`    const groups = new Map<string, number>();`,
`    for (const resource of this.world.naturalResources.filter((candidate) => candidate.output > 0)) {
      const { x, y } = pixel(resource.position);
      const good: Good = resource.kind === "forest" ? "wood" : resource.kind === "clay" ? "clay" : "rubble";
      this.drawSlots(slots, x + 5, y - 1, resource.output, CONFIG.resourceOutputCapacity, good, 3);
      this.markers.add(this.add.text(x + 5, y + 3, "OUT", {
        fontFamily: "system-ui",
        fontSize: "5px",
        color: "#21372a",
      }).setResolution(TEXT_RESOLUTION));
    }

    const groups = new Map<string, number>();`);
  write(path, s);
}

// IncrementalMainScene.ts
{
  const path = "src/game/IncrementalMainScene.ts";
  let s = read(path);
  s = replace(s,
`        building.forestRemaining ?? "",
        building.resourceRemaining ?? "",
        building.fieldStage ?? "",`,
`        building.fieldStage ?? "",`);
  s = replace(s,
`    const internals = this.internals();

    return [
      terrainHash,
      buildings,`,
`    const resources = this.worldRef.naturalResources
      .map((resource) => [resource.id, resource.kind, resource.position.q, resource.position.r, resource.remaining, resource.depleted ? 1 : 0].join(":"))
      .join("|");
    const internals = this.internals();

    return [
      terrainHash,
      buildings,
      resources,`);
  s = replace(s,
`  private inventorySignature(): string {
    return this.worldRef.buildings
      .filter(`,
`  private inventorySignature(): string {
    const buildings = this.worldRef.buildings
      .filter(`);
  s = replace(s,
`      .map((building) =>
        \`\${building.id}:\${building.input}:\${building.output}:\${building.recipe?.input ?? ""}\`,
      )
      .join("|");
  }`,
`      .map((building) =>
        \`\${building.id}:\${building.input}:\${building.output}:\${building.recipe?.input ?? ""}\`,
      )
      .join("|");
    const resources = this.worldRef.naturalResources
      .map((resource) => \`\${resource.id}:\${resource.output}\`)
      .join("|");
    return \`\${buildings}#\${resources}\`;
  }`);
  s = replace(s,
`    }
  }

  private createPersonMarker`,
`    }

    for (const resource of this.worldRef.naturalResources.filter((candidate) => candidate.output > 0)) {
      const { x, y } = pixel(resource.position);
      const good: Good = resource.kind === "forest" ? "wood" : resource.kind === "clay" ? "clay" : "rubble";
      internals.drawSlots(slots, x + 5, y - 1, resource.output, CONFIG.resourceOutputCapacity, good, 3);
      this.inventoryLabels.add(this.add.text(x + 5, y + 3, "OUT", {
        fontFamily: "system-ui",
        fontSize: "5px",
        color: "#21372a",
      }).setResolution(TEXT_RESOLUTION));
    }
  }

  private createPersonMarker`);
  write(path, s);
}

// controls.ts
{
  const path = "src/ui/controls.ts";
  let s = read(path);
  s = replace(s,
`        : b.kind === "bakery" ? "Bäcker"
          : b.kind === "clayDeposit" ? "Lehmgräber"
            : b.kind === "stoneDeposit" ? "Steinbrecher"
              : b.kind === "pottery" ? "Töpfer"
                : b.kind === "stonemason" ? "Steinmetz"
                  : "Arbeiter";`,
`        : b.kind === "bakery" ? "Bäcker"
          : b.kind === "pottery" ? "Töpfer"
            : b.kind === "stonemason" ? "Steinmetz"
              : "Arbeiter";`);
  s = replace(s, `      if (workplace?.kind === "clayDeposit") return "🟤";\n      if (workplace?.kind === "stoneDeposit") return "⛏️";\n`, "");
  s = replace(s,
`    if (b.forestRemaining !== undefined || b.kind === "field" || !limit) return "";`,
`    if (b.kind === "field" || !limit) return "";`);
  s = replace(s,
`    if (b.forestRemaining !== undefined) {
      setField("forest-remaining", String(b.forestRemaining));
      setField("output", \`\${formatOutputAmount(b.output)}/\${CONFIG.forestOutputCapacity}\`);
      return;
    }
    if (b.resourceRemaining !== undefined) {
      setField("resource-remaining", String(b.resourceRemaining));
      setField("output", \`\${formatOutputAmount(b.output)}/\${CONFIG.resourceOutputCapacity}\`);
    }

`, "");
  s = replace(s,
`      const buildable = tile.terrain === "grass" || tile.terrain === "road";
      const roadAction = tile.terrain === "grass"`,
`      const naturalResource = w.naturalResources.find(
        (resource) => !resource.depleted && same(resource.position, tile),
      );
      const buildable = !naturalResource && (tile.terrain === "grass" || tile.terrain === "road");
      const roadAction = naturalResource
        ? ""
        : tile.terrain === "grass"`);
  s = replace(s,
`      const tileName = tile.terrain === "grass"
        ? "Wiese"`,
`      const tileName = naturalResource?.kind === "clay"
        ? "Lehmvorkommen"
        : naturalResource?.kind === "stone"
          ? "Steinvorkommen"
          : naturalResource?.kind === "forest"
            ? "Wald"
            : tile.terrain === "grass"
        ? "Wiese"`);
  s = replace(s,
`    const demolish = b.kind === "forest" || b.kind === "clayDeposit" || b.kind === "stoneDeposit" || b.kind === "field"
      ? ""
      : \`<button data-action="demolish" class="danger">Abreißen</button>\`;`,
`    const demolish = b.kind === "field"
      ? ""
      : \`<button data-action="demolish" class="danger">Abreißen</button>\`;`);
  s = replace(s,
`    const recipe = b.forestRemaining !== undefined
      ? \`\${GOOD_ICONS.wood} 1 Holz / \${b.recipe!.duration / CONFIG.simulationHz} s bei 1× · Vorrat <span data-field="forest-remaining"></span>/\${CONFIG.forestYield}\`
      : b.resourceRemaining !== undefined
        ? \`\${GOOD_ICONS[b.recipe!.output]} 1 \${GOODS[b.recipe!.output]} / \${b.recipe!.duration / CONFIG.simulationHz} s bei 1× · Vorrat <span data-field="resource-remaining"></span>/\${CONFIG.resourceYield}\`
      : b.kind === "warehouse"`,
`    const recipe = b.kind === "warehouse"`);
  s = replace(s,
`    const inventory = b.forestRemaining !== undefined
      ? \`<div><span>\${goodLabel("wood")} · Output</span><strong data-field="output"></strong></div>\`
      : b.resourceRemaining !== undefined
        ? \`<div><span>\${goodLabel(b.recipe!.output)} · Output</span><strong data-field="output"></strong></div>\`
      : b.kind === "warehouse"`,
`    const inventory = b.kind === "warehouse"`);
  s = replace(s,
`      const assignment = p.woodcutter
        ? (p.assignment ? \`Holzfäller · \${building(w, p.assignment.building).name}\` : "Holzfäller · wartet auf Wald")
        : p.extractor === "clay"
          ? (p.assignment ? \`Lehmgräber · \${building(w, p.assignment.building).name}\` : "Lehmgräber · wartet auf Vorkommen")
          : p.extractor === "stone"
            ? (p.assignment ? \`Steinbrecher · \${building(w, p.assignment.building).name}\` : "Steinbrecher · wartet auf Vorkommen")`,
`      const targetResource = p.resourceTarget
        ? w.naturalResources.find((resource) => resource.id === p.resourceTarget)
        : undefined;
      const resourceLabel = targetResource
        ? targetResource.kind === "forest" ? "Wald" : targetResource.kind === "clay" ? "Lehmvorkommen" : "Steinvorkommen"
        : undefined;
      const assignment = p.woodcutter
        ? (resourceLabel ? \`Holzfäller · \${resourceLabel}\` : "Holzfäller · wartet auf Wald")
        : p.extractor === "clay"
          ? (resourceLabel ? \`Lehmgräber · \${resourceLabel}\` : "Lehmgräber · wartet auf Vorkommen")
          : p.extractor === "stone"
            ? (resourceLabel ? \`Steinbrecher · \${resourceLabel}\` : "Steinbrecher · wartet auf Vorkommen")`);
  s = replace(s,
`      const state = p.trip
        ? \`\${p.trip.picked ? "Bringt" : "Holt"} \${GOOD_ICONS[p.trip.good]} \${GOODS[p.trip.good]} · \${building(w, p.trip.picked ? p.trip.target : p.trip.source).name}\``,
`      const tripPlace = p.trip
        ? p.trip.picked
          ? building(w, p.trip.target).name
          : p.trip.sourceKind === "resource"
            ? (w.naturalResources.find((resource) => resource.id === p.trip!.source)?.kind === "forest" ? "Wald" : "Vorkommen")
            : building(w, p.trip.source).name
        : undefined;
      const state = p.trip
        ? \`\${p.trip.picked ? "Bringt" : "Holt"} \${GOOD_ICONS[p.trip.good]} \${GOODS[p.trip.good]} · \${tripPlace}\``);
  s = replace(s,
`              ? \`\${p.woodcutter ? "Fällt Holz" : p.builder ? "Baut" : "Produziert"} · \${Math.round((p.progress / (p.assignment && isUnderConstruction(building(w, p.assignment.building)) ? building(w, p.assignment.building).construction!.duration : CONFIG.duration)) * 100)} %\``,
`              ? \`\${p.woodcutter ? "Fällt Holz" : p.extractor === "clay" ? "Gräbt Lehm" : p.extractor === "stone" ? "Bricht Stein" : p.builder ? "Baut" : "Produziert"} · \${Math.round((p.progress / (p.assignment && isUnderConstruction(building(w, p.assignment.building)) ? building(w, p.assignment.building).construction!.duration : CONFIG.duration)) * 100)} %\``);
  s = replace(s,
`                ? (p.assignment ? "Auf dem Weg zur Arbeitsstätte" : p.woodcutter ? "Sucht / wartet auf Wald" : p.builder ? "Sucht / wartet auf Baustelle" : "Auf dem Rückweg zum HQ")`,
`                ? (p.assignment ? "Auf dem Weg zur Arbeitsstätte" : p.resourceTarget ? "Auf dem Weg zur Rohstoffquelle" : p.woodcutter ? "Sucht / wartet auf Wald" : p.extractor ? "Sucht / wartet auf Vorkommen" : p.builder ? "Sucht / wartet auf Baustelle" : "Auf dem Rückweg zum HQ")`);
  s = replace(s,
`                  : p.woodcutter
                    ? "Wartet auf Wald"
                    : p.builder`,
`                  : p.resourceTarget
                    ? "An der Rohstoffquelle"
                    : p.woodcutter
                      ? "Wartet auf Wald"
                      : p.extractor
                        ? "Wartet auf Vorkommen"
                        : p.builder`);
  write(path, s);
}

// docs
{
  const path = "architecture.md";
  let s = read(path);
  s = replace(s,
`Current goods are wood, plank, woodenTool, wheat, flour, water, bread, clay, rubble, brick and stoneBlock. Clay and rubble come from finite natural resource nodes next to rivers and mountains; each node contains 10 units and retires after the last extraction while already produced local output remains collectible. Clay diggers and stonecutters are global HQ-managed pools analogous to woodcutters: each worker claims the nearest reachable free matching node, at most one works per node, and depletion automatically triggers reassignment.`,
`Current goods are wood, plank, woodenTool, wheat, flour, water, bread, clay, rubble, brick and stoneBlock. Forests, clay deposits and stone deposits are first-class \`NaturalResource\` objects in \`World.naturalResources\`, not buildings. A resource stores position, remaining yield and local output; its underlying tile stays authoritative terrain. Forest tiles use forest terrain, while clay and stone are lightweight overlays on walkable grass next to rivers and mountains. Each resource contains 10 units and disappears after the last extraction while already produced local output remains collectible. Woodcutters, clay diggers and stonecutters are global HQ-managed pools: each worker holds a \`resourceTarget\` rather than a building assignment, claims the nearest reachable free matching resource, at most one works per resource, and depletion automatically triggers reassignment. Transport trips can use either a building source or a natural-resource source, so local raw-material output remains physical without pretending the source is a building.`);
  write(path, s);
}
{
  const path = "concept.md";
  let s = read(path);
  s = replace(s,
`Zusätzlich zu Wald gibt es endliche Rohstoffvorkommen. Lehmvorkommen liegen auf begehbaren Kacheln direkt in Flussnähe, Steinvorkommen entsprechend in Bergnähe. Jedes Vorkommen enthält genau 10 Einheiten. Lehmgräber und Steinbrecher werden global am HQ verwaltet. Jeder sucht selbständig das nächste erreichbare freie Vorkommen seines Typs; pro Vorkommen arbeitet höchstens eine Person. Nach der zehnten Einheit verschwindet das Vorkommen sofort, der Abbauer sucht automatisch das nächste passende Vorkommen und bereits lokal abgelegte Ware bleibt liegen und kann weiter transportiert werden.`,
`Wald, Lehm und Stein sind natürliche Ressourcen und ausdrücklich **keine Gebäude**. Lehmvorkommen liegen als natürliche Kartenobjekte auf begehbaren Kacheln direkt in Flussnähe, Steinvorkommen entsprechend in Bergnähe. Jedes Vorkommen enthält genau 10 Einheiten. Holzfäller, Lehmgräber und Steinbrecher werden ausschließlich global am HQ verwaltet; an der Ressource selbst gibt es keine Arbeiterzuweisung. Jeder sucht selbständig die nächste erreichbare freie Ressource seines Typs; pro Ressource arbeitet höchstens eine Person. Nach der zehnten Einheit verschwindet die Ressource sofort, der Abbauer sucht automatisch die nächste passende Ressource und bereits lokal abgelegte Ware bleibt liegen und kann weiter transportiert werden.`);
  write(path, s);
}
{
  const path = "src/handbook/logistik.md";
  let s = read(path);
  s = replace(s,
`Lehmgräber und Steinbrecher werden am HQ zugewiesen, suchen selbständig freie Vorkommen und wechseln nach deren Erschöpfung automatisch weiter. Pro Vorkommen arbeitet höchstens eine Person.`,
`Wald, Lehm und Stein sind natürliche Ressourcen, keine Gebäude. Holzfäller, Lehmgräber und Steinbrecher werden ausschließlich am HQ zugewiesen, suchen selbständig freie Rohstoffstellen und wechseln nach deren Erschöpfung automatisch weiter. Direkt an einer Rohstoffstelle gibt es keine Arbeiterzuweisung. Pro Rohstoffstelle arbeitet höchstens eine Person.`);
  write(path, s);
}

// tests: resource materials
{
  const path = "tests/resourceMaterials.test.ts";
  let s = read(path);
  s = replace(s, `import type { BuildingKind } from "../src/simulation/model";\n`, "");
  s = replace(s,
`  for (const [kind, terrain] of [["clayDeposit", "river"], ["stoneDeposit", "mountain"]] as const) {
    const nodes = world.buildings.filter((building) => building.kind === kind);
    assert.ok(nodes.length > 0);
    for (const node of nodes) {
      assert.equal(node.resourceRemaining, 10);`,
`  for (const [kind, terrain] of [["clay", "river"], ["stone", "mountain"]] as const) {
    const nodes = world.naturalResources.filter((resource) => resource.kind === kind);
    assert.ok(nodes.length > 0);
    for (const node of nodes) {
      assert.equal(node.remaining, 10);`);
  s = replace(s,
`  const deposit = world.buildings.find((building) => building.id === assignedPerson.assignment?.building)!;
  assert.equal(deposit.kind, "clayDeposit");`,
`  const deposit = world.naturalResources.find((resource) => resource.id === assignedPerson.resourceTarget)!;
  assert.equal(deposit.kind, "clay");`);
  s = replaceAll(s, `deposit.retired`, `deposit.depleted`);
  s = replaceAll(s, `deposit.resourceRemaining`, `deposit.remaining`);
  s = replace(s,
`  assert.notEqual(clayDiggers(world)[0]!.assignment?.building, clayDiggers(world)[1]!.assignment?.building);`,
`  assert.notEqual(clayDiggers(world)[0]!.resourceTarget, clayDiggers(world)[1]!.resourceTarget);`);
  s = replace(s,
`  const firstId = worker.assignment!.building;
  const first = world.buildings.find((building) => building.id === firstId)!;
  first.resourceRemaining = 1;`,
`  const firstId = worker.resourceTarget!;
  const first = world.naturalResources.find((resource) => resource.id === firstId)!;
  first.remaining = 1;`);
  s = replaceAll(s, `first.retired`, `first.depleted`);
  s = replace(s,
`  assert.notEqual(worker.assignment?.building, firstId);
  if (worker.assignment)
    assert.equal(world.buildings.find((building) => building.id === worker.assignment!.building)?.kind, "clayDeposit");`,
`  assert.notEqual(worker.resourceTarget, firstId);
  if (worker.resourceTarget)
    assert.equal(world.naturalResources.find((resource) => resource.id === worker.resourceTarget)?.kind, "clay");`);
  s += `\n\ntest("natural resources are not buildings and have no direct building assignment", () => {\n  const world = createDefaultGameWorld();\n  assert.equal(world.buildings.some((building) => ["forest", "clayDeposit", "stoneDeposit"].includes(building.kind as string)), false);\n  assert.ok(world.naturalResources.some((resource) => resource.kind === "forest"));\n  assert.ok(world.naturalResources.some((resource) => resource.kind === "clay"));\n  assert.ok(world.naturalResources.some((resource) => resource.kind === "stone"));\n  assert.equal(changeExtractors(world, "clay", 1), true);\n  const worker = clayDiggers(world)[0]!;\n  assert.equal(worker.assignment, undefined);\n  assert.ok(worker.resourceTarget);\n});\n`;
  write(path, s);
}

// tests: forests
{
  const path = "tests/forest-relocation.test.ts";
  let s = read(path);
  s = replace(s,
`  assigned,
  buildAt,
  building,`,
`  assigned,
  buildAt,
  building,
  naturalResource,`);
  s = replace(s,
`  const forest = building(world, worker.assignment!.building);`,
`  const forest = naturalResource(world, worker.resourceTarget!);`);
  s = replace(s,
`test("world starts without an active forest and passive forest tiles are walkable", () => {
  const world = createWorld();
  assert.equal(world.buildings.some((b) => b.forestRemaining !== undefined), false);`,
`test("forests are natural resources and forest tiles are walkable", () => {
  const world = createWorld();
  assert.equal(world.buildings.some((b) => b.kind === ("forest" as never)), false);
  assert.ok(world.naturalResources.some((resource) => resource.kind === "forest"));`);
  s = replace(s,
`  const forestIds = workers.map((p) => p.assignment?.building);`,
`  const forestIds = workers.map((p) => p.resourceTarget);`);
  s = replace(s,
`    const forest = building(world, id!);
    assert.equal(forest.workers, 1);
    assert.equal(assigned(world, forest.id, "worker").length, 1);
    assert.equal(forest.forestRemaining, CONFIG.forestYield);`,
`    const forest = naturalResource(world, id!);
    assert.equal(world.people.filter((person) => person.resourceTarget === forest.id).length, 1);
    assert.equal(forest.remaining, CONFIG.forestYield);`);
  s = replaceAll(s, `forest.forestRemaining`, `forest.remaining`);
  s = replaceAll(s, `forest.retired`, `forest.depleted`);
  s = replace(s,
`  assert.equal(assigned(world, forest.id, "worker").length, 0);
  assert.notEqual(worker.assignment?.building, forest.id);
  const nextForest = building(world, worker.assignment!.building);
  assert.equal(nextForest.forestRemaining, CONFIG.forestYield);`,
`  assert.equal(world.people.filter((person) => person.resourceTarget === forest.id).length, 0);
  assert.notEqual(worker.resourceTarget, forest.id);
  const nextForest = naturalResource(world, worker.resourceTarget!);
  assert.equal(nextForest.remaining, CONFIG.forestYield);`);
  s = replace(s,
`  assert.equal(carrier.trip?.source, forest.id);
  assert.equal(carrier.trip?.good, "wood");`,
`  assert.equal(carrier.trip?.source, forest.id);
  assert.equal(carrier.trip?.sourceKind, "resource");
  assert.equal(carrier.trip?.good, "wood");`);
  s = replace(s,
`  assert.equal(worker.assignment, undefined);
  assert.ok(worker.path.length > 0);`,
`  assert.equal(worker.assignment, undefined);
  assert.equal(worker.resourceTarget, undefined);
  assert.ok(worker.path.length > 0);`);
  write(path, s);
}

console.log("Natural resource refactor applied");
