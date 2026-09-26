import Phaser from "phaser";
import type { World } from "../simulation/model";
import {
  PERSON_ALERT_ICONS,
  personAlerts,
  type PersonAlertSeverity,
} from "../personStatus";
import {
  PERSON_MARKER_RADIUS,
  personMarkerPositions,
} from "./personMarkerGeometry";

const TEXT_RESOLUTION = 8;
const BUBBLE_HEIGHT = 4.5;
const BUBBLE_GAP = 0.75;
const ICON_FONT_SIZE = 3.2;
const BUBBLE_Y_OFFSET = PERSON_MARKER_RADIUS + BUBBLE_HEIGHT / 2 + BUBBLE_GAP;

const SEVERITY_COLORS: Record<PersonAlertSeverity, { fill: number; text: string }> = {
  critical: { fill: 0xd9483b, text: "#ffffff" },
  warning: { fill: 0xf2c94c, text: "#263c2d" },
  info: { fill: 0x4f9ed6, text: "#ffffff" },
};

type StatusIndicator = {
  root: Phaser.GameObjects.Container;
  shape: Phaser.GameObjects.Graphics;
  text: Phaser.GameObjects.Text;
  signature: string;
};

const drawThoughtBubble = (
  graphics: Phaser.GameObjects.Graphics,
  width: number,
  fill: number,
): void => {
  graphics.clear();
  graphics.fillStyle(fill, 0.97);
  graphics.lineStyle(0.75, 0x263c2d, 0.9);
  graphics.fillRoundedRect(-width / 2, -BUBBLE_HEIGHT / 2, width, BUBBLE_HEIGHT, 1.5);
  graphics.strokeRoundedRect(-width / 2, -BUBBLE_HEIGHT / 2, width, BUBBLE_HEIGHT, 1.5);
  graphics.fillCircle(-width * 0.2, BUBBLE_HEIGHT / 2 + 0.9, 0.7);
  graphics.fillCircle(-width * 0.28, BUBBLE_HEIGHT / 2 + 1.8, 0.4);
};

export function installPersonStatusIndicators(scene: Phaser.Scene, world: World): void {
  const sceneWithCreate = scene as Phaser.Scene & { create?: () => void };
  const originalCreate = sceneWithCreate.create?.bind(scene);

  sceneWithCreate.create = () => {
    originalCreate?.();

    const layer = scene.add.container(0, 0).setDepth(2002);
    const indicators = new Map<number, StatusIndicator>();

    const render = () => {
      const visiblePositions = new Map(
        personMarkerPositions(world).map((position) => [position.person.id, position]),
      );

      for (const [id, indicator] of indicators) {
        if (world.people.some((person) => person.id === id)) continue;
        indicator.root.destroy(true);
        indicators.delete(id);
      }

      for (const person of world.people) {
        const position = visiblePositions.get(person.id);
        const alerts = personAlerts(world, person);
        let indicator = indicators.get(person.id);

        if (!position || alerts.length === 0) {
          indicator?.root.setVisible(false);
          continue;
        }

        const severity = alerts[0]!.severity;
        const icons = alerts.map((alert) => PERSON_ALERT_ICONS[alert.code]).join(" ");
        const signature = `${severity}:${icons}`;
        const iconCount = alerts.length;
        const width = iconCount === 1
          ? 5.25
          : iconCount === 2
            ? 8
            : 10.75;
        const colors = SEVERITY_COLORS[severity];

        if (!indicator) {
          const root = scene.add.container(position.x, position.y - BUBBLE_Y_OFFSET);
          const shape = scene.add.graphics();
          const text = scene.add.text(0, -0.25, icons, {
            fontFamily: "system-ui",
            fontSize: `${ICON_FONT_SIZE}px`,
            color: colors.text,
          }).setResolution(TEXT_RESOLUTION).setOrigin(0.5);
          root.add([shape, text]);
          layer.add(root);
          indicator = { root, shape, text, signature: "" };
          indicators.set(person.id, indicator);
        }

        if (indicator.signature !== signature) {
          drawThoughtBubble(indicator.shape, width, colors.fill);
          indicator.text.setText(icons).setColor(colors.text);
          indicator.signature = signature;
        }

        indicator.root
          .setPosition(position.x, position.y - BUBBLE_Y_OFFSET)
          .setVisible(true);
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
