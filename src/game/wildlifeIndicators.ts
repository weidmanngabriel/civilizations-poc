import Phaser from "phaser";
import type { Projectile, World } from "../simulation/model";
import { pixel } from "./mapGeometry";

const clamp01 = (value: number): number => Math.max(0, Math.min(1, value));

const projectilePosition = (world: World, projectile: Projectile): { x: number; y: number } => {
  const start = pixel(projectile.start);
  const target = pixel(projectile.targetPosition);
  const duration = Math.max(1, projectile.impactAtTick - projectile.startedAtTick);
  const t = clamp01((world.round - projectile.startedAtTick) / duration);
  return {
    x: start.x + (target.x - start.x) * t,
    y: start.y + (target.y - start.y) * t,
  };
};

export function installWildlifeIndicators(scene: Phaser.Scene, world: World): void {
  const sceneWithCreate = scene as Phaser.Scene & { create?: () => void };
  const originalCreate = sceneWithCreate.create?.bind(scene);

  sceneWithCreate.create = () => {
    originalCreate?.();
    const graphics = scene.add.graphics().setDepth(1760);

    const render = (): void => {
      graphics.clear();
      const zoom = scene.cameras.main.zoom;

      for (const animal of world.animals ?? []) {
        const { x, y } = pixel(animal.position);
        const fleeing = (animal.fleeingUntilTick ?? -1) > world.round;
        const bodyWidth = 3.2 / zoom;
        const bodyHeight = 2 / zoom;
        graphics.fillStyle(fleeing ? 0xe8d8c0 : 0xd8c7aa, 1);
        graphics.fillEllipse(x, y, bodyWidth, bodyHeight);
        graphics.fillCircle(x + 1.5 / zoom, y - 0.7 / zoom, 0.9 / zoom);
        graphics.lineStyle(0.7 / zoom, 0xd8c7aa, 1);
        graphics.lineBetween(x + 1.4 / zoom, y - 1.2 / zoom, x + 1.1 / zoom, y - 3 / zoom);
        graphics.lineBetween(x + 1.8 / zoom, y - 1.2 / zoom, x + 2.1 / zoom, y - 3 / zoom);
      }

      for (const projectile of world.projectiles ?? []) {
        if (projectile.kind !== "arrow") continue;
        const point = projectilePosition(world, projectile);
        const start = pixel(projectile.start);
        const target = pixel(projectile.targetPosition);
        const dx = target.x - start.x;
        const dy = target.y - start.y;
        const length = Math.hypot(dx, dy) || 1;
        const ux = dx / length;
        const uy = dy / length;
        const half = 2.2 / zoom;
        graphics.lineStyle(0.9 / zoom, 0x4c3827, 1);
        graphics.lineBetween(
          point.x - ux * half,
          point.y - uy * half,
          point.x + ux * half,
          point.y + uy * half,
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
