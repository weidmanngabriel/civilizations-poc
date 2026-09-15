import Phaser from "phaser";
import type { NaturalResource, World } from "../simulation/model";
import { naturalResourceFootprint } from "../simulation/naturalResources";
import { CONFIG } from "../simulation/scenario";
import { pixel } from "./mapGeometry";

const signature = (world: World): string =>
  world.naturalResources
    .filter((resource) => !resource.depleted && resource.kind !== "forest")
    .map((resource) =>
      `${resource.id}:${resource.kind}:${resource.position.q}:${resource.position.r}:${resource.remaining}`,
    )
    .join("|");

const hash = (value: string): number => {
  let result = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    result ^= value.charCodeAt(index);
    result = Math.imul(result, 16777619) >>> 0;
  }
  return result;
};

const jitter = (resource: NaturalResource, index: number): { x: number; y: number } => {
  const value = hash(`${resource.id}:${index}`);
  return {
    x: ((value & 3) - 1.5) * 0.55,
    y: (((value >>> 2) & 3) - 1.5) * 0.45,
  };
};

const drawClayPiece = (
  graphics: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  alpha: number,
): void => {
  graphics.fillStyle(0x9b6a4d, alpha);
  graphics.fillCircle(x, y, 2.45);
  graphics.fillStyle(0xb88460, alpha * 0.9);
  graphics.fillCircle(x - 0.7, y - 0.7, 0.85);
};

const drawStonePiece = (
  graphics: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  alpha: number,
): void => {
  graphics.fillStyle(0xaeb3af, alpha);
  graphics.fillTriangle(x - 2.8, y + 2.2, x - 0.4, y - 2.7, x + 2.7, y + 2.2);
  graphics.fillStyle(0x858c88, alpha * 0.85);
  graphics.fillTriangle(x - 0.4, y + 1.8, x + 1.0, y - 1.0, x + 2.3, y + 1.8);
};

/**
 * Adds readable multi-cell visuals for clay and stone without owning simulation state.
 * MainScene already draws the anchor piece; this layer adds the remaining footprint cells.
 */
export function installNaturalResourceIndicators(scene: Phaser.Scene, world: World): void {
  const sceneWithCreate = scene as Phaser.Scene & { create?: () => void };
  const originalCreate = sceneWithCreate.create?.bind(scene);

  sceneWithCreate.create = () => {
    originalCreate?.();

    const graphics = scene.add.graphics().setDepth(8);
    let lastSignature = "";

    const render = () => {
      const nextSignature = signature(world);
      if (nextSignature === lastSignature) return;
      lastSignature = nextSignature;
      graphics.clear();

      for (const resource of world.naturalResources) {
        if (resource.depleted || resource.kind === "forest") continue;
        const alpha = Math.max(0.48, resource.remaining / CONFIG.resourceYield);
        const footprint = naturalResourceFootprint(resource);
        for (let index = 1; index < footprint.length; index += 1) {
          const position = footprint[index]!;
          const point = pixel(position);
          const offset = jitter(resource, index);
          const x = point.x + offset.x;
          const y = point.y + offset.y;
          if (resource.kind === "clay") drawClayPiece(graphics, x, y, alpha);
          else drawStonePiece(graphics, x, y, alpha);
        }
      }
    };

    render();
    scene.events.on(Phaser.Scenes.Events.POST_UPDATE, render);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      scene.events.off(Phaser.Scenes.Events.POST_UPDATE, render);
      graphics.destroy();
    });
  };
}
