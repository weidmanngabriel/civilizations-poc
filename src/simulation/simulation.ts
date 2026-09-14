export * from "./simulationCore";

import type {
  BuildingId,
  FarmTask,
  Hex,
  LooseGoodStack,
  NaturalResource,
  NaturalResourceId,
  Person,
  Role,
  Trip,
  World,
} from "./model";
import { CONFIG } from "./scenario";
import { findPath } from "./hex";
import { GRID_REFINEMENT, hexDistance } from "./spatial";
import {
  availableLooseGoodAmount,
  findLooseGoodDropPosition,
  looseGoodStacks,
  placeLooseGood,
} from "./looseGoods";
import {
  awardProfessionExperience,
  workerProfession,
} from "./experience";
import { updateTechnologyUnlocks } from "./technology";
import { tick as coreTick } from "./simulationCore";

const GROUND_PROXY_PREFIX = "ground-";
const WOOD_DROP_RADIUS = GRID_REFINEMENT;

type PersonBeforeTick = {
  person: Person;
  assignmentBuilding?: BuildingId;
  assignmentRole?: Role;
  tripRef?: Trip;
  tripPicked: boolean;
  farmTaskRef?: FarmTask;
  farmTaskKind?: FarmTask["kind"];
  farmTaskTarget?: Hex;
  farmTaskFieldId?: BuildingId;
  progress: number;
  resourceTarget?: NaturalResourceId;
  active: boolean;
  pathLength: number;
  position: Hex;
};

type BuildingBeforeTick = {
  kind: World["buildings"][number]["kind"];
  position: Hex;
  farmId?: BuildingId;
  fieldStage?: World["buildings"][number]["fieldStage"];
  retired: boolean;
  recipeDuration?: number;
  constructionProgress?: number;
};

type ResourceBeforeTick = {
  kind: World["naturalResources"][number]["kind"];
  remaining: number;
};

const sameHex = (a: Hex, b: Hex): boolean => a.q === b.q && a.r === b.r;
const isGroundProxy = (resource: NaturalResource): boolean =>
  resource.depleted === true && resource.id.startsWith(GROUND_PROXY_PREFIX);
const isRealForest = (resource: NaturalResource): boolean =>
  resource.kind === "forest" && !isGroundProxy(resource);

const activeGroundTripIds = (world: World): Set<string> =>
  new Set(
    world.people
      .map((person) => person.trip?.source)
      .filter((source): source is string => Boolean(source?.startsWith(GROUND_PROXY_PREFIX))),
  );

const groundProxy = (stack: LooseGoodStack): NaturalResource => ({
  id: stack.id,
  kind: "forest",
  position: { ...stack.position },
  remaining: 0,
  output: stack.amount,
  depleted: true,
});

function syncStacksFromGroundProxies(world: World): void {
  for (const proxy of world.naturalResources.filter(isGroundProxy)) {
    const existing = looseGoodStacks(world).find((stack) => stack.id === proxy.id);
    const nextAmount = Math.max(0, Math.round(proxy.output));
    if (existing) {
      if (nextAmount <= 0) {
        world.looseGoods = looseGoodStacks(world).filter((stack) => stack.id !== proxy.id);
      } else {
        existing.amount = nextAmount;
      }
      continue;
    }
    if (nextAmount <= 0) continue;
    const direct = placeLooseGood(world, proxy.position, "wood", Math.min(3, nextAmount));
    if (direct) {
      direct.id = proxy.id;
      continue;
    }
    const fallback = findLooseGoodDropPosition(world, proxy.position, "wood", WOOD_DROP_RADIUS);
    if (!fallback) continue;
    const restored = placeLooseGood(world, fallback, "wood", Math.min(3, nextAmount));
    if (restored) restored.id = proxy.id;
  }
}

function syncGroundReservations(world: World): void {
  for (const stack of looseGoodStacks(world)) stack.reserved = 0;
  for (const person of world.people) {
    const trip = person.trip;
    if (!trip || trip.picked || !trip.source.startsWith(GROUND_PROXY_PREFIX)) continue;
    const stack = looseGoodStacks(world).find((candidate) => candidate.id === trip.source);
    if (stack && stack.reserved < stack.amount) stack.reserved += 1;
  }
}

function ensureGroundProxies(world: World): void {
  const activeTrips = activeGroundTripIds(world);
  const proxies = new Map(
    world.naturalResources.filter(isGroundProxy).map((resource) => [resource.id, resource]),
  );

  for (const stack of looseGoodStacks(world)) {
    const proxy = proxies.get(stack.id);
    if (proxy) {
      proxy.position = { ...stack.position };
      proxy.output = stack.amount;
      proxy.remaining = 0;
      proxy.depleted = true;
    } else {
      world.naturalResources.push(groundProxy(stack));
    }
  }

  const liveStackIds = new Set(looseGoodStacks(world).map((stack) => stack.id));
  world.naturalResources = world.naturalResources.filter(
    (resource) =>
      !isGroundProxy(resource) || liveStackIds.has(resource.id) || activeTrips.has(resource.id),
  );
}

function cleanupIdleGroundProxies(world: World): void {
  const activeTrips = activeGroundTripIds(world);
  world.naturalResources = world.naturalResources.filter(
    (resource) => !isGroundProxy(resource) || activeTrips.has(resource.id),
  );
}

function nearestAvailableWoodStack(world: World, origin: Hex): LooseGoodStack | undefined {
  return looseGoodStacks(world)
    .filter(
      (stack) =>
        stack.good === "wood" &&
        availableLooseGoodAmount(stack) > 0 &&
        hexDistance(origin, stack.position) <= WOOD_DROP_RADIUS,
    )
    .sort(
      (a, b) =>
        hexDistance(origin, a.position) - hexDistance(origin, b.position) ||
        a.position.q - b.position.q ||
        a.position.r - b.position.r ||
        a.id.localeCompare(b.id),
    )[0];
}

function retargetLegacyForestTrips(world: World): void {
  syncGroundReservations(world);
  for (const person of world.people) {
    const trip = person.trip;
    if (!trip || trip.picked || trip.sourceKind !== "resource" || trip.good !== "wood") continue;
    if (trip.source.startsWith(GROUND_PROXY_PREFIX)) continue;
    const forest = world.naturalResources.find(
      (resource) => resource.id === trip.source && isRealForest(resource),
    );
    if (!forest) continue;
    const stack = nearestAvailableWoodStack(world, forest.position);
    if (!stack) {
      person.trip = undefined;
      person.path = [];
      person.movement = 0;
      person.active = Boolean(person.assignment);
      continue;
    }
    trip.source = stack.id;
    trip.sourceKind = "resource";
    stack.reserved = Math.min(stack.amount, stack.reserved + 1);
    person.path = findPath(
      world.tiles,
      person.position,
      stack.position,
      CONFIG.roadSpeedMultiplier,
    ) ?? [];
    person.movement = 0;
  }
  syncGroundReservations(world);
}

function migrateForestOutputToGround(world: World): void {
  for (const forest of world.naturalResources.filter(isRealForest)) {
    let wholeUnits = Math.floor(forest.output + 1e-9);
    while (wholeUnits > 0) {
      const drop = findLooseGoodDropPosition(world, forest.position, "wood", WOOD_DROP_RADIUS);
      if (!drop) break;
      const stack = placeLooseGood(world, drop, "wood", 1);
      if (!stack) break;
      forest.output = Math.max(0, forest.output - 1);
      wholeUnits--;
    }
  }
  retargetLegacyForestTrips(world);
}

function preparePhysicalWoodTick(world: World): void {
  syncStacksFromGroundProxies(world);
  cleanupIdleGroundProxies(world);
  migrateForestOutputToGround(world);
  syncGroundReservations(world);
  ensureGroundProxies(world);
}

function finishPhysicalWoodTick(world: World): void {
  syncStacksFromGroundProxies(world);
  migrateForestOutputToGround(world);
  syncGroundReservations(world);
  ensureGroundProxies(world);
  cleanupIdleGroundProxies(world);
}

function advanceBuilderActionProgress(person: Person): void {
  const progress = (person.experienceActionProgress ??= {});
  const next = (progress.builder ?? 0) + 1;
  const completedActions = Math.floor(next / CONFIG.duration);
  progress.builder = next % CONFIG.duration;
  if (completedActions > 0)
    awardProfessionExperience(person, "builder", completedActions);
}

function awardCompletedActions(
  world: World,
  peopleBefore: PersonBeforeTick[],
  buildingsBefore: Map<BuildingId, BuildingBeforeTick>,
  resourcesBefore: Map<NaturalResourceId, ResourceBeforeTick>,
  buildingIdsBefore: Set<BuildingId>,
): void {
  for (const before of peopleBefore) {
    const person = before.person;

    if (
      (before.assignmentRole === "carrier" || before.assignmentRole === "merchant") &&
      before.tripRef &&
      before.tripPicked &&
      person.trip !== before.tripRef
    ) {
      awardProfessionExperience(person, before.assignmentRole);
    }

    if (before.resourceTarget) {
      const oldResource = resourcesBefore.get(before.resourceTarget);
      const currentResource = world.naturalResources.find(
        (resource) => resource.id === before.resourceTarget,
      );
      if (oldResource && currentResource) {
        const completedActions = Math.max(
          0,
          oldResource.remaining - currentResource.remaining,
        );
        if (completedActions > 0) {
          const profession =
            oldResource.kind === "forest"
              ? "woodcutter"
              : oldResource.kind === "clay"
                ? "clayDigger"
                : "stonecutter";
          awardProfessionExperience(person, profession, completedActions);
        }
      }
    }

    if (before.assignmentBuilding && before.assignmentRole === "worker") {
      const workplace = buildingsBefore.get(before.assignmentBuilding);
      if (
        workplace?.kind !== "farm" &&
        workplace?.recipeDuration !== undefined &&
        before.progress > 0 &&
        before.progress + 1 >= workplace.recipeDuration
      ) {
        const currentWorkplace = world.buildings.find(
          (building) => building.id === before.assignmentBuilding,
        );
        const profession = currentWorkplace
          ? workerProfession(currentWorkplace)
          : undefined;
        if (profession) awardProfessionExperience(person, profession);
      }
    }

    if (before.assignmentBuilding && before.assignmentRole === "builder") {
      const oldSite = buildingsBefore.get(before.assignmentBuilding);
      const currentSite = world.buildings.find(
        (building) => building.id === before.assignmentBuilding,
      );
      if (
        oldSite?.constructionProgress !== undefined &&
        currentSite?.construction &&
        currentSite.construction.progress > oldSite.constructionProgress &&
        before.active &&
        before.pathLength === 0 &&
        !before.tripRef &&
        sameHex(before.position, oldSite.position)
      ) {
        advanceBuilderActionProgress(person);
      }
    }

    if (!before.farmTaskRef || person.farmTask === before.farmTaskRef) continue;

    if (before.farmTaskKind === "sow" && before.farmTaskTarget && before.assignmentBuilding) {
      const createdField = world.buildings.some(
        (building) =>
          building.kind === "field" &&
          !buildingIdsBefore.has(building.id) &&
          building.farmId === before.assignmentBuilding &&
          sameHex(building.position, before.farmTaskTarget!),
      );
      if (createdField) awardProfessionExperience(person, "farmer");
      continue;
    }

    if (!before.farmTaskFieldId) continue;
    const oldField = buildingsBefore.get(before.farmTaskFieldId);
    const currentField = world.buildings.find(
      (building) => building.id === before.farmTaskFieldId,
    );

    if (
      before.farmTaskKind === "harvest" &&
      oldField &&
      !oldField.retired &&
      currentField?.retired
    ) {
      awardProfessionExperience(person, "farmer");
      continue;
    }

    if (
      before.farmTaskKind === "fertilize" &&
      oldField?.fieldStage !== undefined &&
      currentField?.fieldStage !== undefined &&
      currentField.fieldStage > oldField.fieldStage
    ) {
      awardProfessionExperience(person, "farmer");
    }
  }
}

/** One deterministic 1/60-second simulation step with action-based profession XP. */
export function tick(world: World): void {
  preparePhysicalWoodTick(world);

  const peopleBefore: PersonBeforeTick[] = world.people.map((person) => ({
    person,
    assignmentBuilding: person.assignment?.building,
    assignmentRole: person.assignment?.role,
    tripRef: person.trip,
    tripPicked: person.trip?.picked ?? false,
    farmTaskRef: person.farmTask,
    farmTaskKind: person.farmTask?.kind,
    farmTaskTarget: person.farmTask ? { ...person.farmTask.target } : undefined,
    farmTaskFieldId: person.farmTask?.fieldId,
    progress: person.progress,
    resourceTarget: person.resourceTarget,
    active: person.active,
    pathLength: person.path.length,
    position: { ...person.position },
  }));

  const buildingsBefore = new Map<BuildingId, BuildingBeforeTick>(
    world.buildings.map((building) => [
      building.id,
      {
        kind: building.kind,
        position: { ...building.position },
        farmId: building.farmId,
        fieldStage: building.fieldStage,
        retired: Boolean(building.retired),
        recipeDuration: building.recipe?.duration,
        constructionProgress: building.construction?.progress,
      },
    ]),
  );
  const resourcesBefore = new Map<NaturalResourceId, ResourceBeforeTick>(
    world.naturalResources
      .filter((resource) => !isGroundProxy(resource))
      .map((resource) => [
        resource.id,
        { kind: resource.kind, remaining: resource.remaining },
      ]),
  );
  const buildingIdsBefore = new Set(world.buildings.map((building) => building.id));

  coreTick(world);
  finishPhysicalWoodTick(world);

  awardCompletedActions(
    world,
    peopleBefore,
    buildingsBefore,
    resourcesBefore,
    buildingIdsBefore,
  );
  updateTechnologyUnlocks(world);
}
