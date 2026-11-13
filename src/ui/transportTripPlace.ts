import type { Trip, World } from "../simulation/model";

/** Resolve transport destinations for display without assuming every source is a building. */
export function transportTripPlace(world: World, trip: Trip): string {
  if (trip.picked)
    return world.buildings.find((entry) => entry.id === trip.target)?.name ?? "Ziel nicht mehr vorhanden";

  if (trip.sourceKind === "looseGood")
    return "Bodenstapel";

  if (trip.sourceKind === "resource") {
    const resource = world.naturalResources.find((entry) => entry.id === trip.source);
    if (!resource) return "Vorkommen nicht mehr vorhanden";
    return resource.kind === "forest" ? "Wald" : "Vorkommen";
  }

  return world.buildings.find((entry) => entry.id === trip.source)?.name ?? "Quelle nicht mehr vorhanden";
}
