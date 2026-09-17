import Phaser from "phaser";
import type { World } from "../simulation/model";
import { personWorldPosition } from "../simulation/movement";
import { hungerStatus } from "../simulation/needs";
import { performanceNow, performanceProfiler } from "../debug/performanceProfiler";
import { pixel } from "./mapGeometry";
import { PERSON_MARKER_RADIUS } from "./personMarkerGeometry";

const TEXT_RESOLUTION = 3;
const BUBBLE_RADIUS = 6;
const INDICATOR_GAP = 4;
const ICON_Y_OFFSET = PERSON_MARKER_RADIUS + BUBBLE_RADIUS + INDICATOR_GAP;

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
      let statusMs = 0;
      let positionMs = 0;
      let visualMs = 0;
      let positionedPeople = 0;
      let visualObjects = 0;

      for (const person of world.people) {
        const statusStarted = performanceNow();
        const status = hungerStatus(person);
        statusMs += performanceNow() - statusStarted;
        let indicator = indicators.get(person.id);

        if (status === "normal") {
          if (indicator) {
            const visualStarted = performanceNow();
            indicator.bubble.setVisible(false);
            indicator.icon.setVisible(false);
            indicator.status = status;
            visualMs += performanceNow() - visualStarted;
            visualObjects += 2;
          }
          continue;
        }

        const positionStarted = performanceNow();
        const position = pixel(personWorldPosition(world, person));
        positionMs += performanceNow() - positionStarted;
        positionedPeople += 1;
        const fill = status === "critical" ? 0xd9483b : 0xf2c94c;
        const visualStarted = performanceNow();

        if (!indicator) {
          const bubble = scene.add.circle(position.x, position.y - ICON_Y_OFFSET, BUBBLE_RADIUS, fill, 0.96)
            .setStrokeStyle(1, 0x263c2d, 0.9);
          const icon = scene.add.text(position.x, position.y - ICON_Y_OFFSET - 0.5, "🍴", {
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
          indicator.bubble.setPosition(position.x, position.y - ICON_Y_OFFSET).setVisible(true);
          indicator.icon.setPosition(position.x, position.y - ICON_Y_OFFSET - 0.5).setVisible(true);
        }
        visualMs += performanceNow() - visualStarted;
        visualObjects += 2;
      }

      const finished = performanceNow();
      performanceProfiler.recordFeature("overlayHungerStatus", statusMs, world.people.length, finished);
      performanceProfiler.recordFeature("overlayHungerPosition", positionMs, positionedPeople, finished);
      performanceProfiler.recordFeature("overlayHungerVisual", visualMs, visualObjects, finished);
      performanceProfiler.recordFeature(
        "overlayHunger",
        finished - started,
        createdObjects,
        finished,
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
