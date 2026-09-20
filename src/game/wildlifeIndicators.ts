import Phaser from "phaser";
import type { Animal, Projectile, World } from "../simulation/model";
import { performanceNow, performanceProfiler } from "../debug/performanceProfiler";
import { pixel } from "./mapGeometry";
import { LIVESTOCK_BABY_START_SCALE, LIVESTOCK_GROWTH_TICKS } from "../simulation/livestockBreeding";

const ANIMAL_EMOJI: Record<Animal["kind"], string> = {
  hare: "🐇",
  boar: "🐗",
  cow: "🐄",
  sheep: "🐑",
};

const ANIMAL_EMOJI_WORLD_SIZE: Record<Animal["kind"], { width: number; height: number }> = {
  hare: { width: 5, height: 3.5 },
  boar: { width: 14, height: 9 },
  cow: { width: 18, height: 12 },
  sheep: { width: 12, height: 8 },
};

const ANIMAL_EMOJI_RENDER_SIZE = "128px";

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
  const hopHeight = animal.kind === "hare" ? 1.5 : animal.kind === "boar" ? 0.45 : 0.15;
  const hop = Math.sin(Math.PI * t) * hopHeight;
  return {
    x: start.x + (target.x - start.x) * t,
    y: start.y + (target.y - start.y) * t - hop,
    moving: true,
    directionX: target.x - start.x,
  };
};

export function installWildlifeIndicators(scene: Phaser.Scene, world: World): void {
  const sceneWithCreate = scene as Phaser.Scene & { create?: () => void };
  const originalCreate = sceneWithCreate.create?.bind(scene);

  sceneWithCreate.create = () => {
    originalCreate?.();
    const projectileGraphics = scene.add.graphics().setDepth(1760);
    const animalSprites = new Map<string, Phaser.GameObjects.Text>();
    const ownershipHearts = new Map<string, Phaser.GameObjects.Text>();

    const render = (): void => {
      const started = performanceNow();
      projectileGraphics.clear();
      const liveAnimals = new Set<string>();

      for (const animal of world.animals ?? []) {
        liveAnimals.add(animal.id);
        let sprite = animalSprites.get(animal.id);
        if (!sprite) {
          sprite = scene.add
            .text(0, 0, ANIMAL_EMOJI[animal.kind], {
              fontFamily: "Apple Color Emoji, Segoe UI Emoji, Noto Color Emoji, sans-serif",
              fontSize: ANIMAL_EMOJI_RENDER_SIZE,
            })
            .setOrigin(0.5, 0.72)
            .setDepth(1750);
          animalSprites.set(animal.id, sprite);
        }

        if (animal.breedingAt) {
          sprite.setVisible(false);
          ownershipHearts.get(animal.id)?.setVisible(false);
          continue;
        }

        const size = ANIMAL_EMOJI_WORLD_SIZE[animal.kind];
        const growthProgress = animal.matureAtTick === undefined
          ? 1
          : clamp01(1 - (animal.matureAtTick - world.round) / LIVESTOCK_GROWTH_TICKS);
        const growthScale =
          LIVESTOCK_BABY_START_SCALE +
          (1 - LIVESTOCK_BABY_START_SCALE) * growthProgress;
        sprite
          .setVisible(true)
          .setDisplaySize(size.width * growthScale, size.height * growthScale);

        const position = animalPosition(animal);
        sprite.setPosition(position.x, position.y);
        if (position.moving && Math.abs(position.directionX) > 0.01)
          sprite.setFlipX(position.directionX < 0);
        sprite.setAlpha((animal.fleeingUntilTick ?? -1) > world.round ? 0.78 : 1);

        let heart = ownershipHearts.get(animal.id);
        if (animal.owner === "player") {
          if (!heart) {
            heart = scene.add
              .text(0, 0, "♥", {
                fontFamily: "Arial, sans-serif",
                fontSize: "9px",
                color: "#e53935",
                stroke: "#ffffff",
                strokeThickness: 1.5,
              })
              .setOrigin(0.5, 1)
              .setDepth(1760);
            ownershipHearts.set(animal.id, heart);
          }
          heart
            .setVisible(true)
            .setPosition(
              position.x,
              position.y - (animal.kind === "cow" ? 10 : 8) * growthScale,
            );
        } else if (heart) {
          heart.setVisible(false);
        }
      }

      for (const [id, sprite] of animalSprites) {
        if (liveAnimals.has(id)) continue;
        sprite.destroy();
        animalSprites.delete(id);
        ownershipHearts.get(id)?.destroy();
        ownershipHearts.delete(id);
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
        const impacted = projectile.resolvedAtTick !== undefined;
        const half = impacted ? 1.7 : 1.5;
        projectileGraphics.lineStyle(0.525, 0x4c3827, 1);
        projectileGraphics.lineBetween(
          point.x - ux * half,
          point.y - uy * half,
          point.x + ux * half,
          point.y + uy * half,
        );
        const tipX = point.x + ux * half;
        const tipY = point.y + uy * half;
        const px = -uy;
        const py = ux;
        projectileGraphics.fillStyle(0x66513c, 1);
        projectileGraphics.fillTriangle(
          tipX + ux * 0.85,
          tipY + uy * 0.85,
          tipX - ux * 0.25 + px * 0.575,
          tipY - uy * 0.25 + py * 0.575,
          tipX - ux * 0.25 - px * 0.575,
          tipY - uy * 0.25 - py * 0.575,
        );
      }
      performanceProfiler.recordFeature(
        "overlayWildlife",
        performanceNow() - started,
        (world.animals?.length ?? 0) + (world.projectiles?.length ?? 0),
      );
    };

    scene.events.on(Phaser.Scenes.Events.POST_UPDATE, render);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      scene.events.off(Phaser.Scenes.Events.POST_UPDATE, render);
      projectileGraphics.destroy();
      for (const sprite of animalSprites.values()) sprite.destroy();
      animalSprites.clear();
      for (const heart of ownershipHearts.values()) heart.destroy();
      ownershipHearts.clear();
    });
  };
}
