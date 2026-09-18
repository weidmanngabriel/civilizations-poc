import Phaser from "phaser";
import type { World } from "../simulation/model";
import { CONFIG } from "../simulation/scenario";
import { pixel } from "./mapGeometry";
import { personMarkerPositions } from "./personMarkerGeometry";

const CAST_TICKS = Math.round(0.5 * CONFIG.simulationHz);
const REEL_TICKS = Math.round(0.5 * CONFIG.simulationHz);

const clamp01 = (value: number): number => Math.max(0, Math.min(1, value));
const smooth = (value: number): number => {
  const t = clamp01(value);
  return t * t * (3 - 2 * t);
};

const lineExtension = (world: World, person: World["people"][number]): number => {
  const start = person.fishingStartedAtTick;
  const end = person.fishingWaitUntilTick;
  if (start === undefined || end === undefined) return 0;
  const elapsed = world.round - start;
  const remaining = end - world.round;
  if (elapsed < CAST_TICKS) return smooth(elapsed / CAST_TICKS);
  if (remaining <= REEL_TICKS) return smooth(remaining / REEL_TICKS);
  return 1;
};

/** Presentation-only fishing line: 0.5 s cast, 4 s hold, 0.5 s reel. */
export function installFishingIndicators(scene: Phaser.Scene, world: World): void {
  const sceneWithCreate = scene as Phaser.Scene & { create?: () => void };
  const originalCreate = sceneWithCreate.create?.bind(scene);

  sceneWithCreate.create = () => {
    originalCreate?.();
    const graphics = scene.add.graphics().setDepth(1780);

    const render = (): void => {
      graphics.clear();
      const markers = new Map(
        personMarkerPositions(world).map((marker) => [marker.person.id, marker]),
      );
      const zoom = scene.cameras.main.zoom;

      for (const person of world.people) {
        if (
          !person.fisher ||
          person.hungerState ||
          person.sleepState ||
          person.path.length ||
          !person.fishingWaterTarget ||
          person.fishingStartedAtTick === undefined ||
          person.fishingWaitUntilTick === undefined
        ) continue;

        const marker = markers.get(person.id);
        if (!marker) continue;
        const target = pixel(person.fishingWaterTarget);
        const extension = lineExtension(world, person);
        if (extension <= 0) continue;

        const startX = marker.x;
        const startY = marker.y - 1.5 / zoom;
        const endX = startX + (target.x - startX) * extension;
        const endY = startY + (target.y - startY) * extension;

        graphics.lineStyle(0.8 / zoom, 0xf5f5ef, 0.95);
        graphics.lineBetween(startX, startY, endX, endY);

        const size = 1.8 / zoom;
        graphics.fillStyle(0xf5f5ef, 0.98);
        graphics.fillCircle(endX, endY, size * 0.72);
        graphics.lineStyle(0.75 / zoom, 0xf5f5ef, 0.95);
        graphics.lineBetween(endX, endY + size * 0.6, endX, endY + size * 2.1);
        graphics.lineBetween(
          endX,
          endY + size * 2.1,
          endX + size * 0.9,
          endY + size * 1.55,
        );
      }
    };

    scene.events.on(Phaser.Scenes.Events.POST_UPDATE, render);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      scene.events.off(Phaser.Scenes.Events.POST_UPDATE, render);
      graphics.destroy();
    });
  };
}
