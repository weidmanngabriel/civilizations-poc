import type { Building, BuildingId, World } from "../simulation/model";
import { assigned } from "../simulation/simulation";
import { isManagedBuilding } from "../simulation/structureKinds";

export type BuildingAlertSeverity = "critical" | "warning" | "info";

export interface BuildingAlert {
  severity: BuildingAlertSeverity;
  code: "worker-missing";
  label: string;
}

const isCompleted = (building: Building): boolean =>
  !building.retired && (!building.construction || building.construction.complete);

export const buildingAlert = (world: World, building: Building): BuildingAlert | undefined => {
  if (
    isManagedBuilding(building) &&
    isCompleted(building) &&
    building.kind !== "hq" &&
    building.workers > 0 &&
    assigned(world, building.id, "worker").length === 0
  ) {
    return {
      severity: "warning",
      code: "worker-missing",
      label: "Kein Arbeiter zugewiesen",
    };
  }
  return undefined;
};

export const buildingAlertMap = (world: World): Map<BuildingId, BuildingAlert> => {
  const result = new Map<BuildingId, BuildingAlert>();
  for (const building of world.buildings) {
    const alert = buildingAlert(world, building);
    if (alert) result.set(building.id, alert);
  }
  return result;
};
