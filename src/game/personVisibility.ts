import type { Person, World } from "../simulation/model";
import { same } from "../simulation/hex";
import { buildingFootprint } from "../simulation/buildingPlacement";

const isCompletedBuilding = (building: World["buildings"][number]): boolean =>
  !building.construction || building.construction.complete;

const workerHasInternalActivity = (
  building: World["buildings"][number],
  person: Person,
): boolean =>
  person.progress > 0 ||
  (building.kind === "livestockBreeder" && Boolean(building.breeding));

const personOnBuildingFootprint = (
  building: World["buildings"][number],
  person: Person,
): boolean =>
  buildingFootprint(building).some((position) => same(position, person.position));

export function personInsideBuilding(world: World, person: Person): boolean {
  if (person.path.length) return false;

  if (person.trip?.transferUntilTick !== undefined) {
    if (!person.trip.picked && person.trip.sourceKind !== "resource" && person.trip.sourceKind !== "looseGood") {
      const source = world.buildings.find((building) =>
        building.id === person.trip!.source && !building.retired);
      if (
        source &&
        isCompletedBuilding(source) &&
        source.kind !== "well" &&
        same(person.position, source.position)
      ) return true;
    }
    if (person.trip.picked) {
      const target = world.buildings.find((building) =>
        building.id === person.trip!.target && !building.retired);
      if (
        target &&
        isCompletedBuilding(target) &&
        target.kind !== "well" &&
        same(person.position, target.position)
      ) return true;
    }
  }

  if (person.hungerState?.foodSource && person.hungerState.eatingUntilTick !== undefined) {
    const source = world.buildings.find((building) =>
      building.id === person.hungerState!.foodSource && !building.retired);
    if (source && same(person.position, source.position)) return true;
  }

  if (person.educationTask) {
    const school = world.buildings.find((building) =>
      building.id === person.educationTask!.schoolId &&
      building.kind === "school" &&
      !building.retired &&
      isCompletedBuilding(building)
    );
    if (school && same(person.position, school.position)) return true;
  }

  if (person.sleepState?.kind === "house" && person.sleepState.progress > 0) {
    const house = world.buildings.find((building) =>
      building.kind === "house" && !building.retired && same(building.position, person.sleepState!.target));
    if (house && same(person.position, house.position)) return true;
  }

  if (person.assignment?.role === "worker" && !person.farmTask) {
    const workplace = world.buildings.find((building) =>
      building.id === person.assignment!.building &&
      !building.retired &&
      isCompletedBuilding(building));
    if (
      workplace &&
      workplace.kind !== "farm" &&
      workplace.kind !== "well" &&
      workerHasInternalActivity(workplace, person) &&
      personOnBuildingFootprint(workplace, person)
    ) return true;
  }

  return false;
}
