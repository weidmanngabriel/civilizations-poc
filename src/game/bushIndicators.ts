import Phaser from "phaser";
import type { Hex, World } from "../simulation/model";

const HEX_X = 24;
const HEX_Y = 21;

const pixel = (h: Hex) => ({
  x: 34 + HEX_X * (h.q + h.r / 2),
  y: 34 + h.r * HEX_Y,
});

export function installBushIndicators(scene: Phaser.Scene, world: World): void {
  const sceneWithCreate = scene as Phaser.Scene & { create?: () => void };
  const originalCreate = sceneWithCreate.create?.bind(scene);

  sceneWithCreate.create = () => {
    originalCreate?.();

    const container = scene.add.container(0, 0).setDepth(20);

    const render = () => {
      container.removeAll(true);
      for (const tile of world.tiles) {
        if (!tile.bush || tile.terrain !== "grass") continue;
        const { x, y } = pixel(tile);
        const graphics = scene.add.graphics();
        graphics.fillStyle(tile.bushAvailable ? 0x355d35 : 0x52634b, 0.96);
        graphics.fillCircle(x - 3, y + 1, 4);
        graphics.fillCircle(x + 2, y - 1, 5);
        graphics.fillCircle(x + 5, y + 2, 3);
        if (tile.bushAvailable) {
          graphics.fillStyle(0x6f3d83, 1);
          graphics.fillCircle(x - 2, y - 1, 1.4);
          graphics.fillCircle(x + 2, y + 1, 1.4);
          graphics.fillCircle(x + 5, y - 1, 1.4);
        }
        container.add(graphics);
      }
    };

    render();
    scene.events.on(Phaser.Scenes.Events.POST_UPDATE, render);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      scene.events.off(Phaser.Scenes.Events.POST_UPDATE, render);
      container.destroy(true);
    });
  };
}
