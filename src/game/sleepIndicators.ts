import Phaser from "phaser";
import type { Hex, World } from "../simulation/model";
import { personWorldPosition } from "../simulation/movement";
import { sleepStatus } from "../simulation/sleep";

const HEX_X = 24;
const HEX_Y = 21;
const TEXT_RESOLUTION = 3;
const ICON_X_OFFSET = 14;

const pixel = (h: Hex) => ({
  x: 34 + HEX_X * (h.q + h.r / 2),
  y: 34 + h.r * HEX_Y,
});

type SleepIndicator = {
  bubble: Phaser.GameObjects.Arc;
  icon: Phaser.GameObjects.Text;
  status: ReturnType<typeof sleepStatus>;
};

export function installSleepIndicators(scene: Phaser.Scene, world: World): void {
  const sceneWithCreate = scene as Phaser.Scene & { create?: () => void };
  const originalCreate = sceneWithCreate.create?.bind(scene);

  sceneWithCreate.create = () => {
    originalCreate?.();

    const container = scene.add.container(0, 0).setDepth(2001);
    const indicators = new Map<number, SleepIndicator>();

    const render = () => {
      for (const person of world.people) {
        const status = sleepStatus(person);
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
          const bubble = scene.add.circle(position.x + ICON_X_OFFSET, position.y - 13, 6, fill, 0.96)
            .setStrokeStyle(1, 0x263c2d, 0.9);
          const icon = scene.add.text(position.x + ICON_X_OFFSET, position.y - 13.5, "💤", {
            fontFamily: "system-ui",
            fontSize: "7px",
            color: "#ffffff",
          }).setResolution(TEXT_RESOLUTION).setOrigin(0.5);
          indicator = { bubble, icon, status };
          indicators.set(person.id, indicator);
          container.add([bubble, icon]);
        } else {
          if (indicator.status !== status) indicator.bubble.setFillStyle(fill, 0.96);
          indicator.status = status;
          indicator.bubble.setPosition(position.x + ICON_X_OFFSET, position.y - 13).setVisible(true);
          indicator.icon.setPosition(position.x + ICON_X_OFFSET, position.y - 13.5).setVisible(true);
        }
      }
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
