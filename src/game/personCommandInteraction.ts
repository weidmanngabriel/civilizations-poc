import Phaser from "phaser";
import type { Building, World } from "../simulation/model";
import { buildingFootprint } from "../simulation/buildingPlacement";
import {
  orderPersonMove,
  setPersonHome,
  setPersonWorkplace,
  validHomes,
  validWorkplaces,
} from "../simulation/personCommands";
import { nearestTileAtWorldPoint, pixel } from "./mapGeometry";

export const PERSON_COMMAND_MODE_EVENT = "poc-person-command-mode";
export const PERSON_COMMAND_COMPLETED_EVENT = "poc-person-command-completed";

const BUILD_MODE_EVENT = "poc-build-mode";
const MERCHANT_TARGET_MODE_EVENT = "poc-merchant-target-mode";
const WORK_AREA_MODE_EVENT = "poc-work-area-mode";
const TARGET_HIT_RADIUS_PX = 34;

export type PersonCommandMode = "move" | "workplace" | "home";
type ModeDetail = { active: boolean; personId?: number; mode?: PersonCommandMode };
type SelectableScene = Phaser.Scene & {
  create?: () => void;
  selectAtScreenPoint?: (screenX: number, screenY: number) => void;
};

const completed = (building: Building): boolean =>
  !building.retired && (!building.construction || building.construction.complete);

function nearestBuilding(
  scene: Phaser.Scene,
  world: World,
  screenX: number,
  screenY: number,
): Building | undefined {
  const point = scene.cameras.main.getWorldPoint(screenX, screenY);
  const maxDistance = TARGET_HIT_RADIUS_PX / scene.cameras.main.zoom;
  return world.buildings
    .filter((building) => completed(building) && building.kind !== "field")
    .map((building) => ({
      building,
      distance: Math.min(
        ...buildingFootprint(building).map((position) => {
          const target = pixel(position);
          return Phaser.Math.Distance.Between(point.x, point.y, target.x, target.y);
        }),
      ),
    }))
    .filter(({ distance }) => distance <= maxDistance)
    .sort((a, b) => a.distance - b.distance)[0]?.building;
}

export function installPersonCommandInteraction(scene: Phaser.Scene, world: World): void {
  const selectable = scene as SelectableScene;
  const originalCreate = selectable.create?.bind(scene);
  const originalSelect = selectable.selectAtScreenPoint?.bind(scene);
  let active: { personId: number; mode: PersonCommandMode } | undefined;

  const finish = (success: boolean): void => {
    const previous = active;
    active = undefined;
    window.dispatchEvent(new CustomEvent(PERSON_COMMAND_MODE_EVENT, { detail: { active: false } }));
    if (previous)
      window.dispatchEvent(new CustomEvent(PERSON_COMMAND_COMPLETED_EVENT, {
        detail: { ...previous, success },
      }));
  };

  if (originalSelect) {
    selectable.selectAtScreenPoint = (screenX: number, screenY: number): void => {
      if (!active) {
        originalSelect(screenX, screenY);
        return;
      }

      if (active.mode === "move") {
        const point = scene.cameras.main.getWorldPoint(screenX, screenY);
        const tile = nearestTileAtWorldPoint(world.tiles, point.x, point.y);
        if (tile) finish(orderPersonMove(world, active.personId, { q: tile.q, r: tile.r }));
        return;
      }

      const building = nearestBuilding(scene, world, screenX, screenY);
      if (!building) return;
      if (active.mode === "workplace") {
        if (!validWorkplaces(world, active.personId).some((candidate) => candidate.id === building.id)) return;
        finish(setPersonWorkplace(world, active.personId, building.id));
        return;
      }
      if (!validHomes(world, active.personId).some((candidate) => candidate.id === building.id)) return;
      finish(setPersonHome(world, active.personId, building.id));
    };
  }

  selectable.create = () => {
    originalCreate?.();
    const highlights = scene.add.graphics().setDepth(1840);

    const render = (): void => {
      highlights.clear();
      if (!active || active.mode === "move") return;
      const targets = active.mode === "workplace"
        ? validWorkplaces(world, active.personId)
        : validHomes(world, active.personId);
      const zoom = scene.cameras.main.zoom;
      for (const building of targets) {
        for (const cell of buildingFootprint(building)) {
          const point = pixel(cell);
          highlights.fillStyle(0xf3d36a, 0.16);
          highlights.fillCircle(point.x, point.y, 5 / zoom);
          highlights.lineStyle(1.5 / zoom, 0xf3d36a, 0.95);
          highlights.strokeCircle(point.x, point.y, 6 / zoom);
        }
      }
    };

    const onMode = (event: Event): void => {
      const detail = (event as CustomEvent<ModeDetail>).detail;
      active = detail.active && detail.personId !== undefined && detail.mode
        ? { personId: detail.personId, mode: detail.mode }
        : undefined;
    };
    const cancel = (): void => {
      if (active) finish(false);
    };

    window.addEventListener(PERSON_COMMAND_MODE_EVENT, onMode);
    window.addEventListener(BUILD_MODE_EVENT, cancel);
    window.addEventListener(MERCHANT_TARGET_MODE_EVENT, cancel);
    window.addEventListener(WORK_AREA_MODE_EVENT, cancel);
    scene.events.on(Phaser.Scenes.Events.POST_UPDATE, render);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      window.removeEventListener(PERSON_COMMAND_MODE_EVENT, onMode);
      window.removeEventListener(BUILD_MODE_EVENT, cancel);
      window.removeEventListener(MERCHANT_TARGET_MODE_EVENT, cancel);
      window.removeEventListener(WORK_AREA_MODE_EVENT, cancel);
      scene.events.off(Phaser.Scenes.Events.POST_UPDATE, render);
      highlights.destroy();
    });
  };
}
