import Phaser from "phaser";
import type { Hex, Person, World } from "../simulation/model";
import {
  setWorkAreaCenter,
  supportsWorkArea,
} from "../simulation/simulation";
import { nearestTileAtWorldPoint, pixel } from "./mapGeometry";

export const WORK_AREA_MODE_EVENT = "poc-work-area-mode";
export const WORK_AREA_CHANGED_EVENT = "poc-work-area-changed";

const BUILD_MODE_EVENT = "poc-build-mode";
const MERCHANT_TARGET_MODE_EVENT = "poc-merchant-target-mode";

type WorkAreaModeDetail = { active: boolean; personId?: number };
type SelectableScene = Phaser.Scene & {
  create?: () => void;
  selectAtScreenPoint?: (screenX: number, screenY: number) => void;
  renderWorld?: () => void;
};

const AXIAL_DIRECTIONS: readonly Hex[] = [
  { q: 1, r: 0 },
  { q: 1, r: -1 },
  { q: 0, r: -1 },
  { q: -1, r: 0 },
  { q: -1, r: 1 },
  { q: 0, r: 1 },
];

const flagColor = (person: Person): number => {
  if (person.woodcutter || person.extractor) return 0xc83b32;
  return 0xd6b24a;
};

export function installWorkAreaInteraction(scene: Phaser.Scene, world: World): void {
  const selectableScene = scene as SelectableScene;
  const originalCreate = selectableScene.create?.bind(scene);
  const originalSelectAtScreenPoint = selectableScene.selectAtScreenPoint?.bind(scene);
  let activePersonId: number | undefined;

  if (originalSelectAtScreenPoint) {
    selectableScene.selectAtScreenPoint = (screenX: number, screenY: number): void => {
      if (activePersonId === undefined) {
        originalSelectAtScreenPoint(screenX, screenY);
        return;
      }
      const worldPoint = scene.cameras.main.getWorldPoint(screenX, screenY);
      const tile = nearestTileAtWorldPoint(world.tiles, worldPoint.x, worldPoint.y);
      if (!tile) return;
      const personId = activePersonId;
      if (!setWorkAreaCenter(world, personId, tile)) return;
      activePersonId = undefined;
      window.dispatchEvent(new CustomEvent(WORK_AREA_CHANGED_EVENT, {
        detail: { personId, position: { q: tile.q, r: tile.r } },
      }));
      window.dispatchEvent(new CustomEvent(WORK_AREA_MODE_EVENT, {
        detail: { active: false },
      }));
      selectableScene.renderWorld?.();
    };
  }

  selectableScene.create = () => {
    originalCreate?.();
    const graphics = scene.add.graphics().setDepth(1850);

    const render = (): void => {
      graphics.clear();
      const zoom = scene.cameras.main.zoom;
      for (const person of world.people) {
        if (!person.workArea || !supportsWorkArea(person)) continue;
        const point = pixel(person.workArea.center);
        const size = 10 / zoom;
        const offset = ((person.id % 3) - 1) * (3 / zoom);
        graphics.lineStyle(1.5 / zoom, 0x342b1d, 0.95);
        graphics.lineBetween(point.x + offset, point.y + size * 0.45, point.x + offset, point.y - size * 0.75);
        graphics.fillStyle(flagColor(person), 0.98);
        graphics.fillTriangle(
          point.x + offset,
          point.y - size * 0.7,
          point.x + offset + size * 0.7,
          point.y - size * 0.45,
          point.x + offset,
          point.y - size * 0.2,
        );
      }

      if (activePersonId === undefined) return;
      const person = world.people.find((candidate) => candidate.id === activePersonId);
      if (!person?.workArea) return;
      const points = AXIAL_DIRECTIONS.map((direction) =>
        pixel({
          q: person.workArea!.center.q + direction.q * person.workArea!.radius,
          r: person.workArea!.center.r + direction.r * person.workArea!.radius,
        }),
      ).map((point) => new Phaser.Math.Vector2(point.x, point.y));
      graphics.fillStyle(flagColor(person), 0.08);
      graphics.fillPoints(points, true);
      graphics.lineStyle(2 / zoom, flagColor(person), 0.9);
      graphics.strokePoints(points, true);
    };

    const onMode = (event: Event): void => {
      const detail = (event as CustomEvent<WorkAreaModeDetail>).detail;
      if (!detail.active || detail.personId === undefined) {
        activePersonId = undefined;
        return;
      }
      const person = world.people.find((candidate) => candidate.id === detail.personId);
      activePersonId = person && supportsWorkArea(person) ? person.id : undefined;
    };
    const cancelMode = (): void => {
      if (activePersonId === undefined) return;
      activePersonId = undefined;
      window.dispatchEvent(new CustomEvent(WORK_AREA_MODE_EVENT, {
        detail: { active: false },
      }));
    };

    window.addEventListener(WORK_AREA_MODE_EVENT, onMode);
    window.addEventListener(BUILD_MODE_EVENT, cancelMode);
    window.addEventListener(MERCHANT_TARGET_MODE_EVENT, cancelMode);
    scene.events.on(Phaser.Scenes.Events.POST_UPDATE, render);

    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      window.removeEventListener(WORK_AREA_MODE_EVENT, onMode);
      window.removeEventListener(BUILD_MODE_EVENT, cancelMode);
      window.removeEventListener(MERCHANT_TARGET_MODE_EVENT, cancelMode);
      scene.events.off(Phaser.Scenes.Events.POST_UPDATE, render);
      graphics.destroy();
    });
  };
}
