import Phaser from "phaser";
import type { World } from "../simulation/model";
import { personWorldPosition } from "../simulation/movement";
import { sleepStatus } from "../simulation/sleep";
import { pixel } from "./mapGeometry";
import { PERSON_MARKER_RADIUS } from "./personMarkerGeometry";

const TEXT_RESOLUTION = 3;
const BUBBLE_RADIUS = 2.5;
const INDICATOR_GAP = 1.5;
const ICON_FONT_SIZE = 4;
const ICON_Y_OFFSET = PERSON_MARKER_RADIUS + BUBBLE_RADIUS + INDICATOR_GAP;
const ICON_X_OFFSET = BUBBLE_RADIUS * 2 + 1;

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
          const bubble = scene.add.circle(position.x + ICON_X_OFFSET, position.y - ICON_Y_OFFSET, BUBBLE_RADIUS, fill, 0.96)
            .setStrokeStyle(0.75, 0x263c2d, 0.9);
          const icon = scene.add.text(position.x + ICON_X_OFFSET, position.y - ICON_Y_OFFSET - 0.25, "💤", {
            fontFamily: "system-ui",
            fontSize: `${ICON_FONT_SIZE}px`,
            color: "#ffffff",
          }).setResolution(TEXT_RESOLUTION).setOrigin(0.5);
          indicator = { bubble, icon, status };
          indicators.set(person.id, indicator);
          container.add([bubble, icon]);
        } else {
          if (indicator.status !== status) indicator.bubble.setFillStyle(fill, 0.96);
          indicator.status = status;
          indicator.bubble.setPosition(position.x + ICON_X_OFFSET, position.y - ICON_Y_OFFSET).setVisible(true);
          indicator.icon.setPosition(position.x + ICON_X_OFFSET, position.y - ICON_Y_OFFSET - 0.25).setVisible(true);
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
