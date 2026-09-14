import type {
  BuildableBuildingKind,
  Building,
  BuildingId,
  Good,
  GoodAmounts,
  Hex,
  NaturalResource,
  NaturalResourceId,
  NaturalResourceKind,
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
import {
  activeFarmFieldCount,
  advanceFarmSystem,
  clearFarmTask,
  planFarmWorker,
  removeActiveFarmFields,
  rerouteFarmTask,
} from "./farm";
import {
  gainProfessionExperience,
  extractionSpeedMultiplier,
  logisticsSpeedMultiplier,
  productionMultiplier,
  workerProfession,
} from "./experience";
import {
  performanceNow,
  performanceProfiler,
  type PathReason,
  type PerformanceFeature,
} from "../debug/performanceProfiler";

export const building = (w: World, id: BuildingId): Building =>
  w.buildings.find((b) => b.id === id)!;
export const naturalResource = (w: World, id: NaturalResourceId): NaturalResource =>
  w.naturalResources.find((resource) => resource.id === id)!;
export const resourceWorkers = (w: World, id: NaturalResourceId): Person[] =>
  w.people.filter((person) => person.resourceTarget === id);
export const assigned = (w: World, id: BuildingId, role: Role): Person[] =>
  w.people.filter(
    (p) => p.assignment?.building === id && p.assignment.role === role,
  );
export const woodcutters = (w: World): Person[] =>
  w.people.filter((p) => p.woodcutter);
export const clayDiggers = (w: World): Person[] =>
  w.people.filter((p) => p.extractor === "clay");
export const stonecutters = (w: World): Person[] =>
  w.people.filter((p) => p.extractor === "stone");
export const builders = (w: World): Person[] =>
  w.people.filter((p) => p.builder);
export const freePeople = (w: World): Person[] =>
  w.people.filter((p) => !p.assignment && !p.woodcutter && !p.extractor && !p.builder);
export const isUnderConstruction = (b: Building): boolean =>
  Boolean(b.construction && !b.construction.complete);
const incoming = (w: World, id: BuildingId, good?: Good) =>
  w.people.filter(
    (p) => p.trip?.target === id && (!good || p.trip.good === good),
  ).length;
const heldOutput = (w: World, id: BuildingId) =>
  w.people.filter((p) => p.trip?.source === id && p.trip.picked).length;
const reservedAtSource = (
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
  ).length;
const producing = (w: World, id: BuildingId) =>
  w.people.filter((p) => p.assignment?.building === id && p.progress > 0 && !p.farmTask)
    .length;
const recipeOutputAmount = (b: Building): number => b.recipe?.outputAmount ?? 1;
export const outputOccupied = (w: World, b: Building): number =>
  b.output + heldOutput(w, b.id) + producing(w, b.id) * recipeOutputAmount(b);
const outputCapacityFor = (_b: Building): number => CONFIG.outputCapacity;
const naturalOutputCapacity = (resource: NaturalResource): number =>
  resource.kind === "forest" ? CONFIG.forestOutputCapacity : CONFIG.resourceOutputCapacity;
const naturalResourceGood = (resource: NaturalResource): Good =>
  resource.kind === "forest" ? "wood" : resource.kind === "clay" ? "clay" : "rubble";
const naturalResourceProfession = (resource: NaturalResource): "woodcutter" | "clayDigger" | "stonecutter" =>
  resource.kind === "forest" ? "woodcutter" : resource.kind === "clay" ? "clayDigger" : "stonecutter";
const foodDueBeforeNewTask = (p: Person): boolean =>
  Boolean(p.hungerState) || (p.hunger ?? 100) <= 40;
const sleepDueBeforeNewTask = (p: Person): boolean =>
  Boolean(p.sleepState) || (p.sleep ?? 100) <= 40;
const needDueBeforeNewTask = (p: Person): boolean =>
  foodDueBeforeNewTask(p) || sleepDueBeforeNewTask(p);

const routeReason = (p: Person): PathReason => {
  if (p.hungerState) return "hunger";
  if (p.farmTask) return "farm";
  if (p.woodcutter) return "woodcutter";
  if (p.builder || p.assignment?.role === "builder") return "builder";
  if (p.assignment?.role === "merchant") return "merchant";
  if (p.assignment?.role === "carrier") return "logistics";
  return "other";
};

const routeToPosition = (
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
) => routeToPosition(w, p, b.position, reason);
const tileAt = (w: World, position: Hex): Tile =>
  w.tiles.find((tile) => same(tile, position))!;

const measureFeature = <T>(key: PerformanceFeature, run: () => T): T =>
  performanceProfiler.profileFeature(key, run);

export const warehouseStock = (b: Building, good: Good): number =>
  b.kind === "warehouse" && !isUnderConstruction(b)
    ? (b.inventory?.[good] ?? 0)
    : 0;
export const totalWarehouseStock = (w: World, good: Good): number =>
  w.buildings
    .filter((b) => !b.retired && b.kind === "warehouse" && !isUnderConstruction(b))
    .reduce((sum, b) => sum + warehouseStock(b, good), 0);

export const ALL_GOODS: Good[] = [
  "wood",
  "plank",
  "woodenTool",
  "wheat",
  "flour",
  "water",
  "bread",
  "clay",
  "rubble",
  "brick",
  "stoneBlock",
];

const recipeRequirements = (b: Building): GoodAmounts => {
  if (!b.recipe) return {};
  if (b.recipe.inputs) return b.recipe.inputs;
  if (b.recipe.input) return { [b.recipe.input]: b.recipe.amount };
  return {};
};

const inputStock = (b: Building, good: Good): number => {
  if (b.recipe?.inputs) return b.inputInventory?.[good] ?? 0;
  return b.recipe?.input === good ? b.input : 0;
};

const inputHasSpace = (w: World, b: Building, good: Good): boolean =>
  inputStock(b, good) + incoming(w, b.id, good) + CONFIG.carryCapacity <=
  CONFIG.inputCapacity + 1e-9;

const hasRecipeInputs = (b: Building): boolean =>
  (Object.entries(recipeRequirements(b)) as [Good, number][]).every(
    ([good, amount]) => inputStock(b, good) + 1e-9 >= amount,
  );

const consumeRecipeInputs = (b: Building): void => {
  for (const [good, amount] of Object.entries(recipeRequirements(b)) as [Good, number][]) {
    if (b.recipe?.inputs) {
      b.inputInventory ??= {};
      b.inputInventory[good] = (b.inputInventory[good] ?? 0) - amount;
    } else if (b.recipe?.input === good) {
      b.input -= amount;
    }
  }
};

const addProductionInput = (b: Building, good: Good): void => {
  if (b.recipe?.inputs) {
    b.inputInventory ??= {};
    b.inputInventory[good] = (b.inputInventory[good] ?? 0) + CONFIG.carryCapacity;
  } else {
    b.input += CONFIG.carryCapacity;
  }
};

const sourceStock = (b: Building, good: Good): number => {
  if (isUnderConstruction(b)) return 0;
  if (b.kind === "warehouse") return warehouseStock(b, good);
  if (b.kind === "well" && good === "water") return Number.MAX_SAFE_INTEGER;
  if (b.kind === "farm" && good === "wheat") return b.output;
  return b.recipe?.output === good ? b.output : 0;
};
const available = (w: World, b: Building, good: Good) =>
  sourceStock(b, good) - reservedAtSource(w, b.id, good);
const warehouseHasSpace = (w: World, b: Building, good: Good) =>
  !isUnderConstruction(b) &&
  warehouseStock(b, good) + incoming(w, b.id, good) + CONFIG.carryCapacity <=
    CONFIG.warehouseCapacityPerGood + 1e-9;
const constructionMaterialsComplete = (b: Building): boolean => {
  const construction = b.construction;
  if (!construction || construction.complete) return true;
  return (Object.keys(construction.required) as Good[]).every(
    (good) =>
      (construction.delivered[good] ?? 0) >= (construction.required[good] ?? 0),
  );
};

function returnCargoToSource(w: World, p: Person): void {
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
}

function cancel(w: World, p: Person): void {
  returnCargoToSource(w, p);
  p.trip = undefined;
  p.pendingFarmBonus = undefined;
  clearFarmTask(p);
  p.progress = 0;
  p.movement = 0;
  p.path = [];
}

function rerouteCurrentTask(w: World, p: Person): void {
  if (performanceProfiler.withPathReason("reroute", () => rerouteFarmTask(w, p))) return;
  if (p.trip) {
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
  if (p.assignment) {
    const target = w.buildings.find((b) => b.id === p.assignment!.building);
    if (target) route(w, p, target, "reroute");
    else p.path = [];
    return;
  }
  const hq = w.buildings.find((b) => b.id === "hq");
  if (hq && !same(p.position, hq.position)) route(w, p, hq, "reroute");
}

const roleLimit = (b: Building, role: Role): number => {
  if (isUnderConstruction(b)) return role === "builder" ? 2 : 0;
  if (role === "builder") return 0;
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
  if (role === "builder") return false;
  const b = building(w, id),
    people = assigned(w, id, role),
    limit = roleLimit(b, role);
  if (b.kind === "field" || !limit) return false;
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
  if (!source || source.kind !== "warehouse" || isUnderConstruction(source)) return false;
  if (target) {
    const destination = w.buildings.find((b) => b.id === target && !b.retired);
    if (
      !destination ||
      destination.kind !== "warehouse" ||
      isUnderConstruction(destination) ||
      destination.id === source.id
    )
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
    (p) =>
      !p.assignment &&
      !p.woodcutter &&
      !p.extractor &&
      !p.builder &&
      same(p.position, hq.position),
  );
  if (index < 0) return false;
  w.people.splice(index, 1);
  return true;
}

function randomIndex(w: World, length: number): number {
  w.rngState = (Math.imul(w.rngState, 1664525) + 1013904223) >>> 0;
  return w.rngState % length;
}

type NaturalResourceCandidate = { resource: NaturalResource; path: Hex[]; cost: number };

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

export function changeWoodcutters(w: World, delta: 1 | -1): boolean {
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
}

type BuilderCandidate = { site: Building; path: Hex[]; cost: number };

function builderCandidates(w: World, origin: Hex): BuilderCandidate[] {
  return performanceProfiler.withPathReason("builder", () => {
    const candidates = w.buildings
      .filter(
        (b) =>
          !b.retired &&
          isUnderConstruction(b) &&
          assigned(w, b.id, "builder").length < 2,
      )
      .map((site) => {
        const path = findPath(
          w.tiles,
          origin,
          site.position,
          CONFIG.roadSpeedMultiplier,
        );
        return path
          ? {
              site,
              path,
              cost: pathTravelCost(w.tiles, path, CONFIG.roadSpeedMultiplier),
            }
          : undefined;
      })
      .filter((candidate): candidate is BuilderCandidate => Boolean(candidate));
    if (!candidates.length) return [];
    const best = Math.min(...candidates.map((candidate) => candidate.cost));
    return candidates.filter((candidate) => Math.abs(candidate.cost - best) < 1e-9);
  });
}

function assignBuilder(w: World, p: Person): boolean {
  if (needDueBeforeNewTask(p)) return false;
  const candidates = builderCandidates(w, p.position);
  if (!candidates.length) {
    p.assignment = undefined;
    p.active = false;
    p.progress = 0;
    p.movement = 0;
    const hq = building(w, "hq");
    if (!same(p.position, hq.position)) route(w, p, hq, "builder");
    return false;
  }
  const choice = candidates[randomIndex(w, candidates.length)]!;
  p.assignment = { building: choice.site.id, role: "builder" };
  p.active = false;
  p.progress = 0;
  p.movement = 0;
  p.path = [];
  requestInput(w, p, choice.site);
  if (!p.trip) {
    p.path = choice.path;
    p.active = same(p.position, choice.site.position);
  }
  return true;
}

function assignWaitingBuilders(w: World): void {
  for (const person of builders(w)) {
    if (!person.assignment) assignBuilder(w, person);
  }
}

export function changeBuilders(w: World, delta: 1 | -1): boolean {
  if (delta === 1) {
    const p = freePeople(w)[0];
    if (!p) return false;
    p.builder = true;
    assignBuilder(w, p);
    return true;
  }
  const pool = builders(w);
  const p = pool.find((person) => !person.assignment) ?? pool.at(-1);
  if (!p) return false;
  cancel(w, p);
  p.assignment = undefined;
  p.builder = undefined;
  p.active = false;
  route(w, p, building(w, "hq"), "builder");
  return true;
}

type SourceCandidate =
  | { sourceKind: "building"; source: Building; good: Good; path: Hex[] }
  | { sourceKind: "resource"; source: NaturalResource; good: Good; path: Hex[] };

function requestInput(w: World, p: Person, b: Building): void {
  const construction = isUnderConstruction(b) ? b.construction! : undefined;
  const pathReason: PathReason = construction ? "builder" : "logistics";
  const isWarehouseCollection = b.kind === "warehouse" && !construction;
  const recipeGoods = (Object.keys(recipeRequirements(b)) as Good[]).filter((good) =>
    inputHasSpace(w, b, good),
  );
  const missingForNextBatch = recipeGoods.filter((good) =>
    inputStock(b, good) + incoming(w, b.id, good) < (recipeRequirements(b)[good] ?? 0),
  );
  const goods: Good[] = construction
    ? (Object.keys(construction.required) as Good[]).filter(
        (good) =>
          (construction.delivered[good] ?? 0) + incoming(w, b.id, good) <
          (construction.required[good] ?? 0),
      )
    : isWarehouseCollection
      ? ALL_GOODS
      : missingForNextBatch.length
        ? missingForNextBatch
        : recipeGoods;
  if (!goods.length) return;

  const collectSources = (candidateGoods: Good[]): SourceCandidate[] => {
    const sources: SourceCandidate[] = [];
    for (const good of candidateGoods) {
      if (isWarehouseCollection && !warehouseHasSpace(w, b, good)) continue;
      for (const source of w.buildings) {
        if (
          source.id === b.id ||
          (source.retired && source.output < CONFIG.carryCapacity) ||
          available(w, source, good) + 1e-9 < CONFIG.carryCapacity ||
          (isWarehouseCollection && source.kind === "warehouse")
        )
          continue;
        if (isWarehouseCollection) {
          const collectionPath = performanceProfiler.withPathReason(pathReason, () =>
            findPathBySteps(w.tiles, b.position, source.position),
          );
          if (!collectionPath || collectionPath.length > CONFIG.warehouseCollectionRadius)
            continue;
        }
        const path = performanceProfiler.withPathReason(pathReason, () =>
          findPath(
            w.tiles,
            p.position,
            source.position,
            CONFIG.roadSpeedMultiplier,
          ),
        );
        if (path) sources.push({ sourceKind: "building", source, good, path });
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
    sources.sort(
      (a, b) =>
        pathTravelCost(w.tiles, a.path, CONFIG.roadSpeedMultiplier) -
        pathTravelCost(w.tiles, b.path, CONFIG.roadSpeedMultiplier),
    );
    return sources;
  };
  let sources = collectSources(goods);
  if (!sources.length && !construction && !isWarehouseCollection && missingForNextBatch.length)
    sources = collectSources(recipeGoods);
  const source = sources[0];
  if (!source) return;
  p.trip = {
    source: source.source.id,
    ...(source.sourceKind === "resource" ? { sourceKind: "resource" as const } : {}),
    target: b.id,
    good: source.good,
    picked: false,
  };
  p.path = source.path;
  p.movement = 0;
}

function requestMerchantTransfer(w: World, p: Person, source: Building): void {
  const routeConfig = p.merchantRoute;
  if (
    !routeConfig?.target ||
    source.kind !== "warehouse" ||
    isUnderConstruction(source)
  )
    return;
  const target = w.buildings.find(
    (b) =>
      b.id === routeConfig.target &&
      b.kind === "warehouse" &&
      !b.retired &&
      !isUnderConstruction(b),
  );
  if (!target) {
    routeConfig.target = undefined;
    return;
  }
  if (!same(p.position, source.position)) {
    route(w, p, source, "merchant");
    return;
  }
  if (
    available(w, source, routeConfig.good) + 1e-9 < CONFIG.carryCapacity ||
    !warehouseHasSpace(w, target, routeConfig.good) ||
    !performanceProfiler.withPathReason("merchant", () =>
      findPath(w.tiles, source.position, target.position, CONFIG.roadSpeedMultiplier),
    )
  )
    return;
  p.trip = {
    source: source.id,
    target: target.id,
    good: routeConfig.good,
    picked: false,
  };
}

function retireDepletedResources(w: World): void {
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
  if (kind === "mill")
    return {
      kind,
      name: "Mühle",
      workers: 1,
      carriers: 2,
      input: 0,
      output: 0,
      recipe: { input: "wheat", amount: 1, output: "flour", duration: CONFIG.duration },
    };
  if (kind === "bakery")
    return {
      kind,
      name: "Bäckerei",
      workers: 1,
      carriers: 2,
      input: 0,
      inputInventory: { flour: 0, water: 0 },
      output: 0,
      recipe: { inputs: { flour: 2, water: 1 }, amount: 1, output: "bread", outputAmount: 2, duration: CONFIG.duration },
    };
  if (kind === "pottery")
    return {
      kind,
      name: "Töpferei",
      workers: 1,
      carriers: 2,
      input: 0,
      inputInventory: { clay: 0, wood: 0 },
      output: 0,
      recipe: { inputs: { clay: 1, wood: 1 }, amount: 1, output: "brick", duration: CONFIG.duration },
    };
  if (kind === "stonemason")
    return {
      kind,
      name: "Steinmetzhütte",
      workers: 1,
      carriers: 2,
      input: 0,
      output: 0,
      recipe: { input: "rubble", amount: 2, output: "stoneBlock", duration: CONFIG.duration },
    };
  if (kind === "well")
    return {
      kind,
      name: "Brunnen",
      workers: 0,
      carriers: 0,
      input: 0,
      output: 0,
    };
  if (kind === "farm")
    return {
      kind,
      name: "Farm",
      workers: 1,
      carriers: 0,
      input: 0,
      output: 0,
    };
  return {
    kind,
    name: "Lager",
    workers: 0,
    carriers: 2,
    merchants: 2,
    input: 0,
    output: 0,
    inventory: {
      wood: 0,
      plank: 0,
      woodenTool: 0,
      wheat: 0,
      flour: 0,
      water: 0,
      bread: 0,
      clay: 0,
      rubble: 0,
      brick: 0,
      stoneBlock: 0,
    },
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
  if (removed.kind === "hq" || removed.kind === "field") return false;

  if (removed.kind === "farm") removeActiveFarmFields(w, removed.id);

  for (const p of w.people) {
    const affectedTrip = p.trip?.source === id || p.trip?.target === id;
    if (affectedTrip) cancel(w, p);
    if (p.merchantRoute?.target === id) p.merchantRoute.target = undefined;
    if (p.assignment?.building === id) {
      p.assignment = undefined;
      p.merchantRoute = undefined;
      clearFarmTask(p);
      p.active = false;
      p.progress = 0;
      p.movement = 0;
      route(w, p, building(w, "hq"), "reroute");
    } else if (affectedTrip) {
      rerouteCurrentTask(w, p);
    }
  }

  const currentIndex = w.buildings.findIndex((b) => b.id === id);
  if (currentIndex >= 0) w.buildings.splice(currentIndex, 1);
  const restored = tileAt(w, removed.position);
  restored.terrain = removed.baseTerrain ?? "grass";
  restored.trafficTicks = undefined;
  for (const p of w.people) {
    if (same(p.position, removed.position)) continue;
    if (p.path.some((step) => same(step, removed.position))) rerouteCurrentTask(w, p);
  }
  assignWaitingBuilders(w);
  return true;
}

export function setRoad(w: World, position: Hex, enabled: boolean): boolean {
  const tile = w.tiles.find((candidate) => same(candidate, position));
  if (!tile) return false;
  if (enabled) {
    if (
      tile.terrain !== "grass" ||
      w.naturalResources.some((resource) => !resource.depleted && same(resource.position, tile))
    ) return false;
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
  if (
    tile.terrain !== "grass" ||
    w.naturalResources.some((resource) => !resource.depleted && same(resource.position, tile))
  ) return false;
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
    const logisticsProfession =
      p.assignment?.role === "carrier" && p.trip
        ? "carrier"
        : p.assignment?.role === "merchant" && p.merchantRoute?.target
          ? "merchant"
          : undefined;
    if (logisticsProfession) gainProfessionExperience(p, logisticsProfession);
    p.movement +=
      CONFIG.movementPerTick *
      (logisticsProfession ? logisticsSpeedMultiplier(p, logisticsProfession) : 1);
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

function advanceNaturalResourceExtraction(w: World, immediateDecisionPeople: Set<number>): void {
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

function advanceConstruction(w: World): void {
  for (const site of w.buildings.filter(isUnderConstruction)) {
    const siteBuilders = assigned(w, site.id, "builder");
    if (!constructionMaterialsComplete(site)) {
      for (const p of siteBuilders) p.progress = 0;
      continue;
    }
    const activeBuilders = siteBuilders.filter(
      (p) => p.active && !p.trip && !p.path.length && same(p.position, site.position),
    );
    if (!activeBuilders.length) continue;
    const construction = site.construction!;
    let progressThisTick = 0;
    for (const p of activeBuilders) {
      progressThisTick += productionMultiplier(p, "builder");
      gainProfessionExperience(p, "builder");
    }
    construction.progress += progressThisTick;
    for (const p of activeBuilders) p.progress = construction.progress;
    if (construction.progress < construction.duration) continue;

    construction.progress = construction.duration;
    construction.complete = true;
    for (const p of siteBuilders) {
      cancel(w, p);
      p.assignment = undefined;
      p.active = false;
    }
    for (const p of siteBuilders) assignBuilder(w, p);
  }
}

/** One deterministic 1/60-second simulation step. */
export function tick(w: World): void {
  w.round++;
  const regularDecisionTick =
    (w.round - 1) % CONFIG.decisionIntervalTicks === 0;
  const immediateDecisionPeople = new Set<number>();
  const movingAtTickStart = new Set(
    w.people.filter((p) => p.path.length > 0).map((p) => p.id),
  );

  measureFeature("movement", () => {
    if (movePeople(w)) {
      for (const p of w.people) rerouteCurrentTask(w, p);
    }
    for (const p of w.people) {
      if (movingAtTickStart.has(p.id) && p.path.length === 0)
        immediateDecisionPeople.add(p.id);
    }
  });

  measureFeature("transport", () => {
    for (const p of w.people) {
      if (p.path.length || !p.assignment) continue;
      const home = building(w, p.assignment.building);
      if (p.trip) {
        if (!p.trip.picked) {
          if (p.trip.sourceKind === "resource") {
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
          }
          p.trip.picked = true;
          p.movement = 0;
          route(w, p, building(w, p.trip.target));
        } else {
          const target = building(w, p.trip.target);
          if (!same(p.position, target.position)) continue;
          if (isUnderConstruction(target)) {
            const delivered = target.construction!.delivered;
            delivered[p.trip.good] = (delivered[p.trip.good] ?? 0) + CONFIG.carryCapacity;
          } else if (target.kind === "warehouse") {
            target.inventory![p.trip.good] =
              (target.inventory![p.trip.good] ?? 0) + CONFIG.carryCapacity;
          } else if (target.kind === "farm" && p.trip.good === "wheat") {
            target.output += CONFIG.carryCapacity + (p.pendingFarmBonus ?? 0);
          } else {
            addProductionInput(target, p.trip.good);
          }
          p.trip = undefined;
          p.pendingFarmBonus = undefined;
          p.movement = 0;
          immediateDecisionPeople.add(p.id);
        }
      } else if (same(p.position, home.position)) {
        p.active = true;
      }
    }
  });

  for (const p of w.people) {
    if (!p.resourceTarget || p.path.length) continue;
    const target = w.naturalResources.find((resource) => resource.id === p.resourceTarget);
    if (target && !target.depleted && same(p.position, target.position)) p.active = true;
  }

  measureFeature("construction", () => advanceConstruction(w));
  const farmImmediate = measureFeature("farm", () =>
    performanceProfiler.withPathReason("farm", () => advanceFarmSystem(w)),
  );
  for (const id of farmImmediate) immediateDecisionPeople.add(id);

  measureFeature("production", () => {
    advanceNaturalResourceExtraction(w, immediateDecisionPeople);
    for (const p of w.people) {
      if (!p.assignment || !p.active || p.trip || p.path.length || p.farmTask) continue;
      const b = building(w, p.assignment.building);
      if (!same(p.position, b.position)) continue;
      if (p.assignment.role === "builder" || isUnderConstruction(b) || b.kind === "farm") continue;
      const recipe = b.recipe;
      if (p.assignment.role === "worker" && recipe) {
        const profession = workerProfession(b);
        const outputHasSpace = outputOccupied(w, b) < outputCapacityFor(b);
        const workSpeed = 1;
        if (
          p.progress === 0 &&
          !needDueBeforeNewTask(p) &&
          hasRecipeInputs(b) &&
          outputHasSpace
        )
          p.progress = workSpeed;
        else if (p.progress > 0) p.progress += workSpeed;
        if (p.progress > 0 && profession) gainProfessionExperience(p, profession);
        if (p.progress >= recipe.duration) {
          consumeRecipeInputs(b);
          const multiplier = profession ? productionMultiplier(p, profession) : 1;
          b.output += recipeOutputAmount(b) * multiplier;
          p.progress = 0;
          immediateDecisionPeople.add(p.id);
        }
      }
    }
  });

  measureFeature("planning", () => {
    retireDepletedResources(w);
    if (regularDecisionTick) {
      assignWaitingWoodcutters(w);
      assignWaitingExtractors(w);
      assignWaitingBuilders(w);
    }
  });

  if (!regularDecisionTick && immediateDecisionPeople.size === 0) return;

  const decisionStarted = performanceNow();
  let decisionTransportMs = 0;
  let decisionFarmMs = 0;
  for (const p of w.people) {
    if (!regularDecisionTick && !immediateDecisionPeople.has(p.id)) continue;
    if (needDueBeforeNewTask(p)) continue;
    if (!p.assignment || !p.active || p.path.length || p.trip || p.progress > 0 || p.farmTask)
      continue;
    const b = building(w, p.assignment.building);
    if (p.assignment.role === "builder" && isUnderConstruction(b)) {
      if (!constructionMaterialsComplete(b)) {
        const started = performanceNow();
        requestInput(w, p, b);
        decisionTransportMs += performanceNow() - started;
      }
      continue;
    }
    if (isUnderConstruction(b)) continue;
    if (p.assignment.role === "merchant") {
      const started = performanceNow();
      requestMerchantTransfer(w, p, b);
      decisionTransportMs += performanceNow() - started;
      continue;
    }
    if (b.kind === "farm" && p.assignment.role === "worker") {
      const started = performanceNow();
      performanceProfiler.withPathReason("farm", () => planFarmWorker(w, p, b));
      decisionFarmMs += performanceNow() - started;
      continue;
    }
    const recipe = b.recipe;
    const requirements = recipeRequirements(b);
    const recipeGoods = Object.keys(requirements) as Good[];
    const workerCanTopUp = recipeGoods.some((good) => inputHasSpace(w, b, good));
    const workerMissingInput = recipeGoods.some(
      (good) => inputStock(b, good) < (requirements[good] ?? 0),
    );
    const workerNeedsResupply =
      p.assignment.role === "worker" &&
      Boolean(recipe) &&
      workerCanTopUp &&
      (workerMissingInput || outputOccupied(w, b) >= outputCapacityFor(b));
    if (p.assignment.role === "carrier" || workerNeedsResupply) {
      const started = performanceNow();
      requestInput(w, p, b);
      decisionTransportMs += performanceNow() - started;
    }
  }
  const decisionTotalMs = performanceNow() - decisionStarted;
  if (decisionTransportMs > 0)
    performanceProfiler.recordFeature("transport", decisionTransportMs);
  if (decisionFarmMs > 0)
    performanceProfiler.recordFeature("farm", decisionFarmMs);
  performanceProfiler.recordFeature(
    "planning",
    Math.max(0, decisionTotalMs - decisionTransportMs - decisionFarmMs),
  );
}

export const GOODS: Record<Good, string> = {
  wood: "Holz",
  plank: "Bretter",
  woodenTool: "Holzwerkzeuge",
  wheat: "Weizen",
  flour: "Mehl",
  water: "Wasser",
  bread: "Brot",
  clay: "Lehm",
  rubble: "Bruchstein",
  brick: "Backstein",
  stoneBlock: "Steinquader",
};

export function status(w: World, b: Building): string {
  const workers = assigned(w, b.id, "worker");
  if (b.kind === "hq") return "Sammelpunkt für freie Personen";
  if (b.kind === "field") {
    if (b.retired) return "Abgeerntet";
    if (b.fieldStage === 4) return "Erntereif";
    return `Wachstumsstufe ${b.fieldStage ?? 1}/4`;
  }
  if (isUnderConstruction(b)) {
    const siteBuilders = assigned(w, b.id, "builder");
    const construction = b.construction!;
    if (!siteBuilders.length) return "Baustelle wartet auf Bauarbeiter";
    if (siteBuilders.some((p) => p.trip))
      return `${siteBuilders.length} Bauarbeiter · Baumaterial wird beschafft`;
    if (!constructionMaterialsComplete(b))
      return `${siteBuilders.length} Bauarbeiter · wartet auf Baumaterial`;
    if (construction.progress > 0)
      return `${siteBuilders.length} Bauarbeiter · Baufortschritt: ${Math.round((construction.progress / construction.duration) * 100)} %`;
    if (siteBuilders.every((p) => !p.active))
      return `${siteBuilders.length} Bauarbeiter auf dem Weg`;
    return `${siteBuilders.length} Bauarbeiter · baubereit`;
  }
  if (b.kind === "well") return "Unerschöpfliche Wasserquelle";
  if (b.kind === "warehouse") {
    const carriers = assigned(w, b.id, "carrier").length;
    const merchants = assigned(w, b.id, "merchant").length;
    if (merchants) return `${merchants} Händler · ${carriers} Lager-Träger`;
    return carriers
      ? `Träger sammeln Waren im Umkreis von ${CONFIG.warehouseCollectionRadius} Schritten`
      : "Keine Träger oder Händler zugewiesen";
  }
  if (b.kind === "farm") {
    if (!workers.length) return "Kein Farmer zugewiesen";
    const worker = workers[0]!;
    const count = activeFarmFieldCount(w, b.id);
    if (worker.trip?.picked && worker.trip.good === "wheat" && worker.trip.target === b.id)
      return `Farmer bringt Weizen zur Farm · ${count}/${CONFIG.farmMaxFields} Felder`;
    if (worker.farmTask?.kind === "sow") return `Farmer sät · ${count}/${CONFIG.farmMaxFields} Felder`;
    if (worker.farmTask?.kind === "fertilize") return `Farmer düngt · ${count}/${CONFIG.farmMaxFields} Felder`;
    if (worker.farmTask?.kind === "harvest") return `Farmer erntet · ${count}/${CONFIG.farmMaxFields} Felder`;
    if (worker.path.length) return `Farmer unterwegs · ${count}/${CONFIG.farmMaxFields} Felder`;
    if (b.output >= CONFIG.outputCapacity) return `Farm-Output voll · ${count}/${CONFIG.farmMaxFields} Felder`;
    return `${count}/${CONFIG.farmMaxFields} Felder aktiv`;
  }
  const progress = workers
    .filter((p) => p.progress > 0)
    .map((p) => `${Math.round((p.progress / b.recipe!.duration) * 100)} %`);
  if (progress.length) return `Produktion: ${progress.join(" · ")}`;
  if (!workers.length) return "Kein Arbeiter zugewiesen";
  if (outputOccupied(w, b) >= outputCapacityFor(b))
    return "Output belegt – Abholung abwarten";
  if (workers.some((p) => p.trip)) return "Arbeiter beschafft Rohstoffe";
  if (workers.every((p) => !p.active)) return "Arbeiter auf dem Weg";
  const missing = (Object.entries(recipeRequirements(b)) as [Good, number][])
    .filter(([good, amount]) => inputStock(b, good) < amount)
    .map(([good]) => GOODS[good]);
  if (missing.length) return `Wartet auf ${missing.join(" + ")}`;
  return "Bereit zur Produktion";
}
