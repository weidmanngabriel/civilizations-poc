import Phaser from "phaser";
import type { BuildingId, World } from "../simulation/model";
import { buildingNotifications } from "../ui/gameNotifications";
import { pixel } from "./mapGeometry";

const BUILDING_SELECTED_EVENT = "poc-building-selected";
const BUILDING_SELECTION_REQUESTED_EVENT = "poc-building-selection-requested";
const TEXT_RESOLUTION = 3;

type Indicator = {
  container: Phaser.GameObjects.Container;
  buildingId: BuildingId;
};

export function installBuildingAttentionIndicators(scene: Phaser.Scene, world: World): void {
  const sceneWithCreate = scene as Phaser.Scene & { create?: () => void };
  const originalCreate = sceneWithCreate.create?.bind(scene);

  sceneWithCreate.create = () => {
    originalCreate?.();

    const layer = scene.add.container(0, 0).setDepth(2100);
    const indicators = new Map<BuildingId, Indicator>();

    const focusBuilding = (buildingId: BuildingId, event?: Phaser.Types.Input.EventData): void => {
      event?.stopPropagation();
      const building = world.buildings.find((candidate) => candidate.id === buildingId);
      if (!building || building.retired) return;
      const position = pixel(building.position);
      scene.cameras.main.centerOn(position.x, position.y);
      window.dispatchEvent(new CustomEvent(BUILDING_SELECTION_REQUESTED_EVENT, {
        detail: { id: buildingId, focus: false },
      }));
      window.dispatchEvent(new CustomEvent(BUILDING_SELECTED_EVENT, {
        detail: { id: buildingId },
      }));
    };

    const render = () => {
      const active = new Set(
        buildingNotifications(world)
          .filter((notification) => notification.kind === "building")
          .map((notification) => notification.buildingId),
      );

      for (const [buildingId, indicator] of indicators) {
        if (active.has(buildingId)) continue;
        indicator.container.destroy(true);
        indicators.delete(buildingId);
      }

      for (const buildingId of active) {
        const building = world.buildings.find((candidate) => candidate.id === buildingId);
        if (!building) continue;
        const position = pixel(building.position);
        let indicator = indicators.get(buildingId);
        if (!indicator) {
          const hitArea = scene.add.circle(0, 0, 10, 0xffffff, 0.001)
            .setInteractive({ useHandCursor: true });
          const bubble = scene.add.circle(0, 0, 4.3, 0xf2c94c, 0.98)
            .setStrokeStyle(0.9, 0x263c2d, 0.95);
          const icon = scene.add.text(0, -0.3, "!", {
            fontFamily: "system-ui",
            fontSize: "6px",
            fontStyle: "bold",
            color: "#263c2d",
          }).setResolution(TEXT_RESOLUTION).setOrigin(0.5);
          const container = scene.add.container(position.x, position.y - 13, [hitArea, bubble, icon]);
          hitArea.on("pointerup", (_pointer: Phaser.Input.Pointer, _x: number, _y: number, event: Phaser.Types.Input.EventData) =>
            focusBuilding(buildingId, event),
          );
          layer.add(container);
          indicator = { container, buildingId };
          indicators.set(buildingId, indicator);
        }
        indicator.container.setPosition(position.x, position.y - 13).setVisible(true);
      }
    };

    render();
    scene.events.on(Phaser.Scenes.Events.POST_UPDATE, render);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      scene.events.off(Phaser.Scenes.Events.POST_UPDATE, render);
      layer.destroy(true);
      indicators.clear();
    });
  };
}
