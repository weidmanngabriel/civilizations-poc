import Phaser from "phaser";
import type { Hex, Tile, World } from "../simulation/model";
import { performanceNow, performanceProfiler } from "../debug/performanceProfiler";

const HEX_X = 24;
const HEX_Y = 21;

const pixel = (h: Hex) => ({
  x: 34 + HEX_X * (h.q + h.r / 2),
  y: 34 + h.r * HEX_Y,
});

type BushVisualState = "full" | "empty" | "hidden";
type BushIndicator = {
  graphics: Phaser.GameObjects.Graphics;
  state: BushVisualState;
};

const visualState = (tile: Tile): BushVisualState => {
  if (!tile.bush || tile.terrain !== "grass") return "hidden";
  return tile.bushAvailable ? "full" : "empty";
};

const drawBush = (graphics: Phaser.GameObjects.Graphics, full: boolean): void => {
  graphics.clear();
  graphics.fillStyle(full ? 0x355d35 : 0x52634b, 0.96);
  graphics.fillCircle(-3, 1, 4);
  graphics.fillCircle(2, -1, 5);
  graphics.fillCircle(5, 2, 3);
  if (!full) return;
  graphics.fillStyle(0x6f3d83, 1);
  graphics.fillCircle(-2, -1, 1.4);
  graphics.fillCircle(2, 1, 1.4);
  graphics.fillCircle(5, -1, 1.4);
};

export function installBushIndicators(scene: Phaser.Scene, world: World): void {
  const sceneWithCreate = scene as Phaser.Scene & { create?: () => void };
  const originalCreate = sceneWithCreate.create?.bind(scene);

  sceneWithCreate.create = () => {
    originalCreate?.();

    const container = scene.add.container(0, 0).setDepth(20);
    const bushTiles = world.tiles.filter((tile) => tile.bush);
    const indicators = new Map<Tile, BushIndicator>();

    const render = () => {
      const started = performanceNow();
      let createdObjects = 0;

      for (const tile of bushTiles) {
        const state = visualState(tile);
        let indicator = indicators.get(tile);

        if (!indicator) {
          if (state === "hidden") continue;
          const { x, y } = pixel(tile);
          const graphics = scene.add.graphics().setPosition(x, y);
          drawBush(graphics, state === "full");
          indicator = { graphics, state };
          indicators.set(tile, indicator);
          container.add(graphics);
          createdObjects++;
          continue;
        }

        if (state === "hidden") {
          indicator.graphics.setVisible(false);
          indicator.state = state;
          continue;
        }

        indicator.graphics.setVisible(true);
        if (indicator.state !== state) drawBush(indicator.graphics, state === "full");
        indicator.state = state;
      }

      performanceProfiler.recordFeature(
        "overlayBush",
        performanceNow() - started,
        createdObjects,
      );
    };

    render();
    scene.events.on(Phaser.Scenes.Events.POST_UPDATE, render);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      scene.events.off(Phaser.Scenes.Events.POST_UPDATE, render);
      container.destroy(true);
      indicators.clear();
    });
  };
}
