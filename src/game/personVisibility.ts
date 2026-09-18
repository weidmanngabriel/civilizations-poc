import type { Person, World } from "../simulation/model";
import { same } from "../simulation/hex";

export function personInsideBuilding(world: World, person: Person): boolean {
  if (person.path.length) return false;

  if (person.trip?.transferUntilTick !== undefined) {
    if (!person.trip.picked && person.trip.sourceKind !== "resource" && person.trip.sourceKind !== "looseGood") {
      const source = world.buildings.find((building) =>
        building.id === person.trip!.source && !building.retired);
      if (source && source.kind !== "well" && same(person.position, source.position)) return true;
    }
    if (person.trip.picked) {
      const target = world.buildings.find((building) =>
        building.id === person.trip!.target && !building.retired);
      if (target && target.kind !== "well" && same(person.position, target.position)) return true;
    }
  }

  if (person.hungerState?.foodSource && person.hungerState.eatingUntilTick !== undefined) {
    const source = world.buildings.find((building) =>
      building.id === person.hungerState!.foodSource && !building.retired);
    if (source && same(person.position, source.position)) return true;
  }

  if (person.sleepState?.kind === "house" && person.sleepState.progress > 0) {
    const house = world.buildings.find((building) =>
      building.kind === "house" && !building.retired && same(building.position, person.sleepState!.target));
    if (house && same(person.position, house.position)) return true;
  }

  if (person.assignment?.role === "worker" && person.progress > 0 && !person.farmTask) {
    const workplace = world.buildings.find((building) =>
      building.id === person.assignment!.building && !building.retired);
    if (workplace && workplace.kind !== "farm" && same(person.position, workplace.position)) return true;
  }

  return false;
}
