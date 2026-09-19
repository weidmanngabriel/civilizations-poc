import Phaser from "phaser";
import type { Animal, Projectile, World } from "../simulation/model";
import { pixel } from "./mapGeometry";

const HARE_TEXTURE = "wildlife-hare";
const HARE_WORLD_WIDTH = 10;
const HARE_WORLD_HEIGHT = 7;

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

const animalPosition = (animal: Animal): { x: number; y: number; moving: boolean; directionX: number } => {
  const start = pixel(animal.position);
  const nextHex = animal.path[0];
  if (!nextHex) return { ...start, moving: false, directionX: 0 };

  const target = pixel(nextHex);
  const t = clamp01(animal.movement);
  const hop = Math.sin(Math.PI * t) * 1.5;
  return {
    x: start.x + (target.x - start.x) * t,
    y: start.y + (target.y - start.y) * t - hop,
    moving: true,
    directionX: target.x - start.x,
  };
};

const ensureHareTexture = (scene: Phaser.Scene): void => {
  if (scene.textures.exists(HARE_TEXTURE)) return;

  const g = scene.add.graphics().setVisible(false);
  g.fillStyle(0xb9a58b, 1);
  g.fillEllipse(27, 24, 28, 18);
  g.fillEllipse(43, 18, 15, 14);
  g.fillEllipse(42, 7, 6, 17);
  g.fillEllipse(49, 8, 5, 16);
  g.fillCircle(12, 22, 6);
  g.fillEllipse(23, 32, 13, 5);
  g.fillEllipse(38, 31, 12, 4);

  g.fillStyle(0xf2e5d3, 1);
  g.fillEllipse(43, 8, 2.1, 10);
  g.fillEllipse(49, 9, 1.8, 9);
  g.fillCircle(12, 22, 3);

  g.fillStyle(0x241f1a, 1);
  g.fillCircle(47, 16, 1.5);

  g.fillStyle(0xe0c7b4, 1);
  g.fillCircle(51, 20, 1.4);

  g.generateTexture(HARE_TEXTURE, 60, 38);
  g.destroy();
};

export function installWildlifeIndicators(scene: Phaser.Scene, world: World): void {
  const sceneWithCreate = scene as Phaser.Scene & { create?: () => void };
  const originalCreate = sceneWithCreate.create?.bind(scene);

  sceneWithCreate.create = () => {
    originalCreate?.();
    ensureHareTexture(scene);

    const projectileGraphics = scene.add.graphics().setDepth(1760);
    const animalSprites = new Map<string, Phaser.GameObjects.Image>();

    const render = (): void => {
      projectileGraphics.clear();
      const liveAnimals = new Set<string>();

      for (const animal of world.animals ?? []) {
        liveAnimals.add(animal.id);
        let sprite = animalSprites.get(animal.id);
        if (!sprite) {
          sprite = scene.add
            .image(0, 0, HARE_TEXTURE)
            .setDisplaySize(HARE_WORLD_WIDTH, HARE_WORLD_HEIGHT)
            .setOrigin(0.5, 0.72)
            .setDepth(1750);
          animalSprites.set(animal.id, sprite);
        }

        const position = animalPosition(animal);
        sprite.setPosition(position.x, position.y);
        if (position.moving && Math.abs(position.directionX) > 0.01)
          sprite.setFlipX(position.directionX < 0);
        sprite.setTint((animal.fleeingUntilTick ?? -1) > world.round ? 0xffe1bf : 0xffffff);
      }

      for (const [id, sprite] of animalSprites) {
        if (liveAnimals.has(id)) continue;
        sprite.destroy();
        animalSprites.delete(id);
      }

      const zoom = scene.cameras.main.zoom;
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
        projectileGraphics.lineStyle(0.9 / zoom, 0x4c3827, 1);
        projectileGraphics.lineBetween(
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
      projectileGraphics.destroy();
      for (const sprite of animalSprites.values()) sprite.destroy();
      animalSprites.clear();
    });
  };
}
