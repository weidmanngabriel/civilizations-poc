import Phaser from "phaser";
import type { World } from "../simulation/model";
import { personWorldPosition } from "../simulation/movement";
import { pixel } from "./mapGeometry";
import { PERSON_MARKER_RADIUS } from "./personMarkerGeometry";

const TEXT_RESOLUTION = 3;
const BUBBLE_RADIUS = 2.5;
const INDICATOR_GAP = 1.5;
const ICON_Y_OFFSET = PERSON_MARKER_RADIUS + BUBBLE_RADIUS + INDICATOR_GAP;
const ICON_X_OFFSET = -(BUBBLE_RADIUS * 2 + 1);

type NavigationIndicator = {
  bubble: Phaser.GameObjects.Arc;
  icon: Phaser.GameObjects.Text;
};

export function installNavigationBlockedIndicators(scene: Phaser.Scene, world: World): void {
  const sceneWithCreate = scene as Phaser.Scene & { create?: () => void };
  const originalCreate = sceneWithCreate.create?.bind(scene);

  sceneWithCreate.create = () => {
    originalCreate?.();

    const container = scene.add.container(0, 0).setDepth(2002);
    const indicators = new Map<number, NavigationIndicator>();

    const render = () => {
      const activeIds = new Set(world.people.map((person) => person.id));
      for (const [id, indicator] of indicators) {
        if (activeIds.has(id)) continue;
        indicator.bubble.destroy();
        indicator.icon.destroy();
        indicators.delete(id);
      }

      for (const person of world.people) {
        let indicator = indicators.get(person.id);
        if (!person.navigationBlocked) {
          if (indicator) {
            indicator.bubble.setVisible(false);
            indicator.icon.setVisible(false);
          }
          continue;
        }

        const position = pixel(personWorldPosition(world, person));
        const x = position.x + ICON_X_OFFSET;
        const y = position.y - ICON_Y_OFFSET;
        if (!indicator) {
          const bubble = scene.add.circle(x, y, BUBBLE_RADIUS, 0xf2c94c, 0.96)
            .setStrokeStyle(0.75, 0x263c2d, 0.9);
          const icon = scene.add.text(x, y - 0.25, "!", {
            fontFamily: "system-ui",
            fontSize: "5px",
            fontStyle: "bold",
            color: "#263c2d",
          }).setResolution(TEXT_RESOLUTION).setOrigin(0.5);
          indicator = { bubble, icon };
          indicators.set(person.id, indicator);
          container.add([bubble, icon]);
        } else {
          indicator.bubble.setPosition(x, y).setVisible(true);
          indicator.icon.setPosition(x, y - 0.25).setVisible(true);
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
