export * from "./simulationCore";

import type {
  BuildingId,
  FarmTask,
  Good,
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
import { findPath, key, tileIndex } from "./hex";
import { GRID_REFINEMENT, hexDistance } from "./spatial";
import {
  naturalResourceBlocksMovement,
  naturalResourceFootprint,
  naturalResourceGood,
} from "./naturalResources";
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
const RESOURCE_DROP_RADIUS = GRID_REFINEMENT;
const RAW_RESOURCE_GOODS = new Set<Good>(["wood", "clay", "rubble"]);

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
  output: number;
};

const sameHex = (a: Hex, b: Hex): boolean => a.q === b.q && a.r === b.r;
const isGroundProxy = (resource: NaturalResource): boolean =>
  resource.depleted === true && resource.id.startsWith(GROUND_PROXY_PREFIX);
const isRealNaturalResource = (resource: NaturalResource): boolean => !isGroundProxy(resource);
const isRawResourceGood = (good: Good): boolean => RAW_RESOURCE_GOODS.has(good);

function syncResourceBlocking(world: World): void {
  for (const tile of world.tiles) tile.resourceBlocking = undefined;
  const tiles = tileIndex(world.tiles);
  for (const resource of world.naturalResources) {
    if (resource.depleted || isGroundProxy(resource) || !naturalResourceBlocksMovement(resource)) continue;
    for (const position of naturalResourceFootprint(resource)) {
      const tile = tiles.get(key(position));
      if (tile) tile.resourceBlocking = true;
    }
  }
}

const activeGroundTripIds = (world: World): Set<string> =>
  new Set(
    world.people
      .map((person) => person.trip?.source)
      .filter((source): source is string => Boolean(source?.startsWith(GROUND_PROXY_PREFIX))),
  );

const proxyKindForGood = (good: Good): NaturalResource["kind"] =>
  good === "clay" ? "clay" : good === "rubble" ? "stone" : "forest";

const groundProxy = (stack: LooseGoodStack): NaturalResource => ({
  id: stack.id,
  kind: proxyKindForGood(stack.good),
  position: { ...stack.position },
  remaining: 0,
  output: stack.amount,
  depleted: true,
});

function syncStacksFromGroundProxies(world: World): void {
  for (const proxy of world.naturalResources.filter(isGroundProxy)) {
    const good = naturalResourceGood(proxy);
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
    const direct = placeLooseGood(world, proxy.position, good, Math.min(3, nextAmount));
    if (direct) {
      direct.id = proxy.id;
      continue;
    }
    const fallback = findLooseGoodDropPosition(world, proxy.position, good, RESOURCE_DROP_RADIUS);
    if (!fallback) continue;
    const restored = placeLooseGood(world, fallback, good, Math.min(3, nextAmount));
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
    if (!isRawResourceGood(stack.good)) continue;
    const proxy = proxies.get(stack.id);
    if (proxy) {
      proxy.kind = proxyKindForGood(stack.good);
      proxy.position = { ...stack.position };
      proxy.output = stack.amount;
      proxy.remaining = 0;
      proxy.depleted = true;
    } else {
      world.naturalResources.push(groundProxy(stack));
    }
  }

  const liveStackIds = new Set(
    looseGoodStacks(world)
      .filter((stack) => isRawResourceGood(stack.good))
      .map((stack) => stack.id),
  );
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

function nearestAvailableGroundStack(
  world: World,
  origin: Hex,
  good: Good,
): LooseGoodStack | undefined {
  return looseGoodStacks(world)
    .filter(
      (stack) =>
        stack.good === good &&
        availableLooseGoodAmount(stack) > 0 &&
        hexDistance(origin, stack.position) <= RESOURCE_DROP_RADIUS,
    )
    .sort(
      (a, b) =>
        hexDistance(origin, a.position) - hexDistance(origin, b.position) ||
        a.position.q - b.position.q ||
        a.position.r - b.position.r ||
        a.id.localeCompare(b.id),
    )[0];
}

function retargetLegacyResourceTrips(world: World): void {
  syncGroundReservations(world);
  for (const person of world.people) {
    const trip = person.trip;
    if (!trip || trip.picked || trip.sourceKind !== "resource" || !isRawResourceGood(trip.good)) continue;
    if (trip.source.startsWith(GROUND_PROXY_PREFIX)) continue;
    const resource = world.naturalResources.find(
      (candidate) => candidate.id === trip.source && isRealNaturalResource(candidate),
    );
    if (!resource || naturalResourceGood(resource) !== trip.good) continue;
    const stack = nearestAvailableGroundStack(world, resource.position, trip.good);
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

function migrateNaturalResourceOutputToGround(world: World): void {
  for (const resource of world.naturalResources.filter(isRealNaturalResource)) {
    const good = naturalResourceGood(resource);
    let wholeUnits = Math.floor(resource.output + 1e-9);
    while (wholeUnits > 0) {
      const drop = findLooseGoodDropPosition(world, resource.position, good, RESOURCE_DROP_RADIUS);
      if (!drop) break;
      const stack = placeLooseGood(world, drop, good, 1);
      if (!stack) break;
      resource.output = Math.max(0, resource.output - 1);
      wholeUnits--;
    }
  }
  retargetLegacyResourceTrips(world);
}

function preparePhysicalResourceTick(world: World): void {
  syncResourceBlocking(world);
  syncStacksFromGroundProxies(world);
  cleanupIdleGroundProxies(world);
  migrateNaturalResourceOutputToGround(world);
  syncGroundReservations(world);
  ensureGroundProxies(world);
}

function finishPhysicalResourceTick(world: World): void {
  syncStacksFromGroundProxies(world);
  migrateNaturalResourceOutputToGround(world);
  syncGroundReservations(world);
  ensureGroundProxies(world);
  cleanupIdleGroundProxies(world);
  syncResourceBlocking(world);
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
        const extractedActions = Math.max(
          0,
          oldResource.remaining - currentResource.remaining,
        );
        const undroppedOutput = Math.max(0, currentResource.output - oldResource.output);
        const completedActions = Math.max(0, extractedActions - undroppedOutput);
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
  preparePhysicalResourceTick(world);

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
        { kind: resource.kind, remaining: resource.remaining, output: resource.output },
      ]),
  );
  const buildingIdsBefore = new Set(world.buildings.map((building) => building.id));

  coreTick(world);
  finishPhysicalResourceTick(world);

  awardCompletedActions(
    world,
    peopleBefore,
    buildingsBefore,
    resourcesBefore,
    buildingIdsBefore,
  );
  updateTechnologyUnlocks(world);
}
