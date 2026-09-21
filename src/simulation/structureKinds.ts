import type {
  Building,
  InfrastructureKind,
  ManagedBuildingKind,
  World,
} from "./model";

const INFRASTRUCTURE_KINDS = new Set<InfrastructureKind>(["palisade"]);

export const isInfrastructureKind = (
  kind: Building["kind"],
): kind is InfrastructureKind =>
  INFRASTRUCTURE_KINDS.has(kind as InfrastructureKind);

export const isInfrastructureBuilding = (
  building: Building,
): building is Building & { kind: InfrastructureKind } =>
  isInfrastructureKind(building.kind);

export const isManagedBuildingKind = (
  kind: Building["kind"],
): kind is ManagedBuildingKind =>
  kind !== "field" && !isInfrastructureKind(kind);

export const isManagedBuilding = (
  building: Building,
): building is Building & { kind: ManagedBuildingKind } =>
  !building.retired && isManagedBuildingKind(building.kind);


export const managedBuildings = (
  world: World,
): Array<Building & { kind: ManagedBuildingKind }> =>
  world.buildings.filter(isManagedBuilding);
