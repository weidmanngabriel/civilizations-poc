import Phaser from "phaser";
import type { World } from "../simulation/model";
import { pixel } from "./mapGeometry";
import { wayposts } from "../simulation/wayposts";

const WAYPOST_DEPTH = 24;

const signature = (world: World): string =>
  wayposts(world)
    .map((post) =>
      `${post.id}:${post.position.q},${post.position.r}:[${(post.connections ?? []).join(",")}]`,
    )
    .join("|");

export function installWaypostIndicators(scene: Phaser.Scene, world: World): void {
  const sceneWithCreate = scene as Phaser.Scene & { create?: () => void };
  const originalCreate = sceneWithCreate.create?.bind(scene);

  sceneWithCreate.create = () => {
    originalCreate?.();
    const graphics = scene.add.graphics().setDepth(WAYPOST_DEPTH);
    let lastSignature = "";

    const draw = () => {
      const next = signature(world);
      if (next === lastSignature) return;
      lastSignature = next;
      graphics.clear();

      const byId = new Map(wayposts(world).map((post) => [post.id, post]));
      for (const post of wayposts(world)) {
        const origin = pixel(post.position);
        graphics.lineStyle(1.2, 0x5b442d, 1);
        graphics.lineBetween(origin.x, origin.y + 2.5, origin.x, origin.y - 12);

        (post.connections ?? []).forEach((id) => {
          const target = byId.get(id);
          if (!target) return;
          const projected = pixel(target.position);
          const dx = projected.x - origin.x;
          const dy = projected.y - origin.y;
          const length = Math.hypot(dx, dy);
          if (length <= 0) return;
          const ux = dx / length;
          const uy = dy / length;
          const px = -uy;
          const py = ux;
          const baseX = origin.x;
          const baseY = origin.y - 8;
          const shaft = 5;
          const halfWidth = 1.05;
          const tip = 1.7;
          const endX = baseX + ux * shaft;
          const endY = baseY + uy * shaft;
          const points = [
            new Phaser.Math.Vector2(baseX + px * halfWidth, baseY + py * halfWidth),
            new Phaser.Math.Vector2(endX + px * halfWidth, endY + py * halfWidth),
            new Phaser.Math.Vector2(endX + ux * tip, endY + uy * tip),
            new Phaser.Math.Vector2(endX - px * halfWidth, endY - py * halfWidth),
            new Phaser.Math.Vector2(baseX - px * halfWidth, baseY - py * halfWidth),
          ];
          graphics.fillStyle(0xc7964f, 1);
          graphics.fillPoints(points, true);
          graphics.lineStyle(0.5, 0x5b442d, 1);
          graphics.strokePoints(points, true);
        });
      }
    };

    draw();
    scene.events.on(Phaser.Scenes.Events.POST_UPDATE, draw);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      scene.events.off(Phaser.Scenes.Events.POST_UPDATE, draw);
      graphics.destroy();
    });
  };
}
