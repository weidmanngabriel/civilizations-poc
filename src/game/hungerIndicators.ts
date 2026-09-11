import Phaser from "phaser";
import type { Hex, World } from "../simulation/model";
import { personWorldPosition } from "../simulation/movement";
import { hungerStatus } from "../simulation/needs";
import { performanceNow, performanceProfiler } from "../debug/performanceProfiler";

const HEX_X = 24;
const HEX_Y = 21;
const TEXT_RESOLUTION = 3;

const pixel = (h: Hex) => ({
  x: 34 + HEX_X * (h.q + h.r / 2),
  y: 34 + h.r * HEX_Y,
});

type HungerIndicator = {
  bubble: Phaser.GameObjects.Arc;
  icon: Phaser.GameObjects.Text;
  status: ReturnType<typeof hungerStatus>;
};

export function installHungerIndicators(scene: Phaser.Scene, world: World): void {
  const sceneWithCreate = scene as Phaser.Scene & { create?: () => void };
  const originalCreate = sceneWithCreate.create?.bind(scene);

  sceneWithCreate.create = () => {
    originalCreate?.();

    const container = scene.add.container(0, 0).setDepth(2000);
    const indicators = new Map<number, HungerIndicator>();

    const render = () => {
      const started = performanceNow();
      let createdObjects = 0;

      for (const person of world.people) {
        const status = hungerStatus(person);
        let indicator = indicators.get(person.id);

        if (status === "normal") {
          if (indicator) {
            indicator.bubble.setVisible(false);
            indicator.icon.setVisible(false);
            indicator.status = status;
          }
          continue;
        }

        const position = pixel(personWorldPosition(world, person));
        const fill = status === "critical" ? 0xd9483b : 0xf2c94c;

        if (!indicator) {
          const bubble = scene.add.circle(position.x, position.y - 13, 6, fill, 0.96)
            .setStrokeStyle(1, 0x263c2d, 0.9);
          const icon = scene.add.text(position.x, position.y - 13.5, "🍴", {
            fontFamily: "system-ui",
            fontSize: "7px",
            color: "#ffffff",
          }).setResolution(TEXT_RESOLUTION).setOrigin(0.5);
          indicator = { bubble, icon, status };
          indicators.set(person.id, indicator);
          container.add([bubble, icon]);
          createdObjects += 2;
        } else {
          if (indicator.status !== status) indicator.bubble.setFillStyle(fill, 0.96);
          indicator.status = status;
          indicator.bubble.setPosition(position.x, position.y - 13).setVisible(true);
          indicator.icon.setPosition(position.x, position.y - 13.5).setVisible(true);
        }
      }

      performanceProfiler.recordFeature(
        "overlayHunger",
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
