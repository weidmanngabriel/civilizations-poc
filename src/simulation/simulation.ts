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
import {
  awardProfessionExperience,
  workerProfession,
} from "./experience";
import { tick as coreTick } from "./simulationCore";

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
    world.naturalResources.map((resource) => [
      resource.id,
      { kind: resource.kind, remaining: resource.remaining },
    ]),
  );
  const buildingIdsBefore = new Set(world.buildings.map((building) => building.id));

  coreTick(world);

  awardCompletedActions(
    world,
    peopleBefore,
    buildingsBefore,
    resourcesBefore,
    buildingIdsBefore,
  );
}
