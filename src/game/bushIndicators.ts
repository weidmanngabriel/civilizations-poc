import Phaser from "phaser";
import type { World } from "../simulation/model";
import { performanceNow, performanceProfiler } from "../debug/performanceProfiler";
import { pixel } from "./mapGeometry";
import {
  bushVisualKey,
  bushVisualState,
  currentBushTiles,
  type BushVisualState,
} from "./bushVisualState";

type BushIndicator = {
  graphics: Phaser.GameObjects.Graphics;
  state: BushVisualState;
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
    const indicators = new Map<string, BushIndicator>();

    const render = () => {
      const started = performanceNow();
      let createdObjects = 0;
      const activeKeys = new Set<string>();

      for (const tile of currentBushTiles(world)) {
        const key = bushVisualKey(tile);
        const state = bushVisualState(tile);
        activeKeys.add(key);
        let indicator = indicators.get(key);

        if (!indicator) {
          if (state === "hidden") continue;
          const { x, y } = pixel(tile);
          const graphics = scene.add.graphics().setPosition(x, y);
          drawBush(graphics, state === "full");
          indicator = { graphics, state };
          indicators.set(key, indicator);
          container.add(graphics);
          createdObjects++;
          continue;
        }

        if (state === "hidden") {
          indicator.graphics.setVisible(false);
          indicator.state = state;
          continue;
        }

        const { x, y } = pixel(tile);
        indicator.graphics.setPosition(x, y).setVisible(true);
        if (indicator.state !== state) drawBush(indicator.graphics, state === "full");
        indicator.state = state;
      }

      for (const [key, indicator] of indicators) {
        if (activeKeys.has(key)) continue;
        indicator.graphics.setVisible(false);
        indicator.state = "hidden";
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
