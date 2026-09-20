import Phaser from "phaser";
import type { Animal, Projectile, World } from "../simulation/model";
import { performanceNow, performanceProfiler } from "../debug/performanceProfiler";
import { pixel } from "./mapGeometry";

const HARE_TEXTURE = "wildlife-hare";
const BOAR_TEXTURE = "wildlife-boar";
const COW_TEXTURE = "wildlife-cow";
const SHEEP_TEXTURE = "wildlife-sheep";
const HARE_WORLD_WIDTH = 5;
const HARE_WORLD_HEIGHT = 3.5;
const BOAR_WORLD_WIDTH = 14;
const BOAR_WORLD_HEIGHT = 9;
const COW_WORLD_WIDTH = 18;
const COW_WORLD_HEIGHT = 12;
const SHEEP_WORLD_WIDTH = 12;
const SHEEP_WORLD_HEIGHT = 8;

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

const ensureBoarTexture = (scene: Phaser.Scene): void => {
  if (scene.textures.exists(BOAR_TEXTURE)) return;

  const g = scene.add.graphics().setVisible(false);
  g.fillStyle(0x6d5140, 1);
  g.fillEllipse(30, 24, 34, 20);
  g.fillEllipse(48, 23, 18, 15);
  g.fillTriangle(44, 14, 47, 6, 51, 15);
  g.fillTriangle(52, 15, 56, 8, 58, 17);
  g.fillStyle(0x3f2d25, 1);
  g.fillCircle(54, 20, 1.6);
  g.fillCircle(58, 25, 2);
  g.lineStyle(2.2, 0x4b362b, 1);
  g.lineBetween(20, 32, 18, 38);
  g.lineBetween(37, 32, 39, 38);
  g.fillStyle(0xe8dcc8, 1);
  g.fillTriangle(54, 28, 59, 30, 56, 24);
  g.generateTexture(BOAR_TEXTURE, 66, 42);
  g.destroy();
};

const ensureCowTexture = (scene: Phaser.Scene): void => {
  if (scene.textures.exists(COW_TEXTURE)) return;
  const g = scene.add.graphics().setVisible(false);
  g.fillStyle(0xf3eee3, 1);
  g.fillEllipse(34, 25, 40, 22);
  g.fillEllipse(57, 22, 22, 18);
  g.fillStyle(0x5e4438, 1);
  g.fillEllipse(24, 22, 12, 10);
  g.fillEllipse(40, 29, 11, 9);
  g.fillCircle(62, 20, 3);
  g.lineStyle(4, 0x6a5142, 1);
  g.lineBetween(24, 34, 23, 45);
  g.lineBetween(43, 34, 44, 45);
  g.lineStyle(2, 0x8b7967, 1);
  g.lineBetween(63, 12, 68, 7);
  g.lineBetween(53, 12, 49, 7);
  g.fillStyle(0x2a211d, 1);
  g.fillCircle(61, 18, 1.5);
  g.generateTexture(COW_TEXTURE, 76, 50);
  g.destroy();
};

const ensureSheepTexture = (scene: Phaser.Scene): void => {
  if (scene.textures.exists(SHEEP_TEXTURE)) return;
  const g = scene.add.graphics().setVisible(false);
  g.fillStyle(0xf5f2e8, 1);
  g.fillCircle(25, 23, 13);
  g.fillCircle(36, 20, 13);
  g.fillCircle(45, 24, 12);
  g.fillCircle(33, 29, 13);
  g.fillStyle(0x5a514b, 1);
  g.fillEllipse(55, 24, 15, 13);
  g.lineStyle(3, 0x5a514b, 1);
  g.lineBetween(28, 34, 27, 43);
  g.lineBetween(43, 34, 44, 43);
  g.fillStyle(0x211d1a, 1);
  g.fillCircle(59, 22, 1.4);
  g.generateTexture(SHEEP_TEXTURE, 68, 48);
  g.destroy();
};

const visualForAnimal = (animal: Animal): { texture: string; width: number; height: number } => {
  switch (animal.kind) {
    case "boar":
      return { texture: BOAR_TEXTURE, width: BOAR_WORLD_WIDTH, height: BOAR_WORLD_HEIGHT };
    case "cow":
      return { texture: COW_TEXTURE, width: COW_WORLD_WIDTH, height: COW_WORLD_HEIGHT };
    case "sheep":
      return { texture: SHEEP_TEXTURE, width: SHEEP_WORLD_WIDTH, height: SHEEP_WORLD_HEIGHT };
    default:
      return { texture: HARE_TEXTURE, width: HARE_WORLD_WIDTH, height: HARE_WORLD_HEIGHT };
  }
};

export function installWildlifeIndicators(scene: Phaser.Scene, world: World): void {
  const sceneWithCreate = scene as Phaser.Scene & { create?: () => void };
  const originalCreate = sceneWithCreate.create?.bind(scene);

  sceneWithCreate.create = () => {
    originalCreate?.();
    ensureHareTexture(scene);
    ensureBoarTexture(scene);
    ensureCowTexture(scene);
    ensureSheepTexture(scene);

    const projectileGraphics = scene.add.graphics().setDepth(1760);
    const animalSprites = new Map<string, Phaser.GameObjects.Image>();
    const ownershipHearts = new Map<string, Phaser.GameObjects.Text>();

    const render = (): void => {
      const started = performanceNow();
      projectileGraphics.clear();
      const liveAnimals = new Set<string>();

      for (const animal of world.animals ?? []) {
        liveAnimals.add(animal.id);
        let sprite = animalSprites.get(animal.id);
        if (!sprite) {
          const visual = visualForAnimal(animal);
          sprite = scene.add
            .image(0, 0, visual.texture)
            .setDisplaySize(visual.width, visual.height)
            .setOrigin(0.5, 0.72)
            .setDepth(1750);
          animalSprites.set(animal.id, sprite);
        }

        const position = animalPosition(animal);
        sprite.setPosition(position.x, position.y);
        if (position.moving && Math.abs(position.directionX) > 0.01)
          sprite.setFlipX(position.directionX < 0);
        sprite.setTint((animal.fleeingUntilTick ?? -1) > world.round ? 0xffe1bf : 0xffffff);

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
          heart.setVisible(true).setPosition(position.x, position.y - (animal.kind === "cow" ? 10 : 8));
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
