export * from "./simulationCore";

import type {
  BuildingId,
  FarmTask,
  Hex,
  NaturalResourceId,
  Person,
  Role,
  Trip,
  World,
} from "./model";
import { CONFIG } from "./scenario";
import { key, tileIndex } from "./hex";
import { GRID_REFINEMENT } from "./spatial";
import {
  naturalResourceBlocksMovement,
  naturalResourceFootprint,
  naturalResourceGood,
} from "./naturalResources";
import {
  findLooseGoodDropPosition,
  placeLooseGood,
} from "./looseGoods";
import {
  awardProfessionExperience,
  workerProfession,
} from "./experience";
import { updateTechnologyUnlocks } from "./technology";
import { tick as coreTick } from "./simulationCore";
import { syncWorkAreas } from "./workAreas";
import {
  deferLocalResourceDepletion,
  finishDeferredResourceDepletion,
} from "./resourceDepletion";
import { resolveFoodArrivals } from "./needs";
import { syncManualMoveOrders } from "./personCommands";
import { syncScoutWaypostTasks } from "./scouting";
import { measureResourcePerformance } from "../debug/resourcePerformance";
import { performanceNow, performanceProfiler } from "../debug/performanceProfiler";
import { advanceWildlife, captureNearbyLivestock } from "./wildlife";
import { advanceLivestockBreeding } from "./livestockBreeding";
import { advanceHunting } from "./hunting";
import { resolveEquipmentPickups } from "./equipment";

const RESOURCE_DROP_RADIUS = GRID_REFINEMENT;

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

type ResourceBlockingCache = {
  tiles: World["tiles"];
  resources: World["naturalResources"];
  signature: string;
};

const resourceBlockingCache = new WeakMap<World, ResourceBlockingCache>();
const sameHex = (a: Hex, b: Hex): boolean => a.q === b.q && a.r === b.r;

function resourceBlockingSignature(world: World): string {
  let signature = `${world.naturalResources.length}:`;
  for (const resource of world.naturalResources) {
    if (resource.depleted || !naturalResourceBlocksMovement(resource)) continue;
    signature += `${resource.id}|`;
  }
  return signature;
}

function syncResourceBlocking(world: World): void {
  performanceProfiler.profileFeature("resourceBlockingSync", () => {
    measureResourcePerformance("resourceBlockingSync", () => {
      for (const tile of world.tiles) tile.resourceBlocking = undefined;
      const tiles = tileIndex(world.tiles);
      for (const resource of world.naturalResources) {
        if (resource.depleted || !naturalResourceBlocksMovement(resource)) continue;
        for (const position of naturalResourceFootprint(resource)) {
          const tile = tiles.get(key(position));
          if (tile) tile.resourceBlocking = true;
        }
      }
    });
  });
}

function ensureResourceBlockingCurrent(world: World): void {
  const signature = resourceBlockingSignature(world);
  const cached = resourceBlockingCache.get(world);
  if (
    cached?.tiles === world.tiles &&
    cached.resources === world.naturalResources &&
    cached.signature === signature
  ) return;

  syncResourceBlocking(world);
  resourceBlockingCache.set(world, {
    tiles: world.tiles,
    resources: world.naturalResources,
    signature,
  });
}

function migrateNaturalResourceOutputToGround(world: World): void {
  performanceProfiler.profileFeature("resourceOutputMigration", () => {
    for (const resource of world.naturalResources) {
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
  });
}

function preparePhysicalResourceTick(world: World): void {
  ensureResourceBlockingCurrent(world);
  migrateNaturalResourceOutputToGround(world);
}

function moveCompletedExtractorOutputIntoHands(
  world: World,
  peopleBefore: PersonBeforeTick[],
  resourcesBefore: Map<NaturalResourceId, ResourceBeforeTick>,
): void {
  for (const before of peopleBefore) {
    if (!before.resourceTarget || before.person.outdoorCarry) continue;
    const previous = resourcesBefore.get(before.resourceTarget);
    const resource = world.naturalResources.find(
      (candidate) => candidate.id === before.resourceTarget,
    );
    if (!previous || !resource) continue;
    const extracted = previous.remaining - resource.remaining;
    if (extracted <= 0 || resource.output <= previous.output) continue;

    resource.output = Math.max(previous.output, resource.output - 1);
    before.person.outdoorCarry = naturalResourceGood(resource);
  }
}

function finishPhysicalResourceTick(
  world: World,
  peopleBefore: PersonBeforeTick[],
  resourcesBefore: Map<NaturalResourceId, ResourceBeforeTick>,
): void {
  moveCompletedExtractorOutputIntoHands(world, peopleBefore, resourcesBefore);
  migrateNaturalResourceOutputToGround(world);
  ensureResourceBlockingCurrent(world);
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

  const {
    peopleBefore,
    buildingsBefore,
    resourcesBefore,
    buildingIdsBefore,
  } = performanceProfiler.profileFeature("tickSnapshots", () => ({
    peopleBefore: world.people.map((person): PersonBeforeTick => ({
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
    })),
    buildingsBefore: new Map<BuildingId, BuildingBeforeTick>(
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
    ),
    resourcesBefore: new Map<NaturalResourceId, ResourceBeforeTick>(
      world.naturalResources.map((resource) => [
        resource.id,
        { kind: resource.kind, remaining: resource.remaining, output: resource.output },
      ]),
    ),
    buildingIdsBefore: new Set(world.buildings.map((building) => building.id)),
  }));

  const deferredResourceDepletion = performanceProfiler.profileFeature(
    "resourceDepletion",
    () => deferLocalResourceDepletion(world),
  );
  syncManualMoveOrders(world);
  coreTick(world);
  performanceProfiler.profileFeature("production", () =>
    advanceLivestockBreeding(world),
  );
  const captureStarted = performanceNow();
  const captureStats = captureNearbyLivestock(world);
  performanceProfiler.recordFeature(
    "livestockCaptureProximity",
    performanceNow() - captureStarted,
    captureStats.proximityChecks,
  );
  performanceProfiler.profileFeature("wildlife", () => advanceWildlife(world));
  const huntingStarted = performanceNow();
  const huntingStats = advanceHunting(world);
  performanceProfiler.recordFeature(
    "hunting",
    performanceNow() - huntingStarted,
    huntingStats.animalTargetChecks,
  );
  syncScoutWaypostTasks(world);
  syncManualMoveOrders(world);
  resolveEquipmentPickups(world);
  performanceProfiler.profileFeature("foodArrivals", () => resolveFoodArrivals(world));
  performanceProfiler.profileFeature("resourceDepletion", () =>
    finishDeferredResourceDepletion(world, deferredResourceDepletion),
  );
  finishPhysicalResourceTick(world, peopleBefore, resourcesBefore);
  if (deferredResourceDepletion.length) {
    performanceProfiler.profileFeature("workAreaSync", () => syncWorkAreas(world));
  }

  performanceProfiler.profileFeature("xpResolution", () =>
    awardCompletedActions(
      world,
      peopleBefore,
      buildingsBefore,
      resourcesBefore,
      buildingIdsBefore,
    ),
  );
  performanceProfiler.profileFeature("technologyUnlocks", () => updateTechnologyUnlocks(world));
}
