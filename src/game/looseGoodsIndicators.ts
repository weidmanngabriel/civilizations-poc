import Phaser from "phaser";
import type { Good, LooseGoodStack, World } from "../simulation/model";
import { pixel } from "./mapGeometry";

const goodColors: Record<Good, number> = {
  wood: 0x6f4a2d,
  plank: 0xd4a763,
  woodenTool: 0xc8d8d0,
  wheat: 0xe3c766,
  flour: 0xf0e4c8,
  water: 0x77b9d4,
  bread: 0xb8793d,
  clay: 0x9b6a4d,
  rubble: 0x8b8f8c,
  brick: 0xb55d42,
  stoneBlock: 0xc8c8bd,
};

type StackVisual = {
  graphics: Phaser.GameObjects.Graphics;
  signature: string;
};

const signature = (stack: LooseGoodStack): string =>
  `${stack.good}:${stack.amount}:${stack.reserved}`;

const drawStack = (graphics: Phaser.GameObjects.Graphics, stack: LooseGoodStack): void => {
  graphics.clear();
  const offsets = stack.amount === 1
    ? [[0, 0]]
    : stack.amount === 2
      ? [[-1.8, 0.8], [1.8, -0.8]]
      : [[-2.2, 1.4], [2.2, 1.4], [0, -1.5]];

  for (const [x, y] of offsets) {
    graphics.fillStyle(goodColors[stack.good], 0.98);
    graphics.fillCircle(x!, y!, 1.7);
    graphics.lineStyle(0.5, 0x263328, 0.9);
    graphics.strokeCircle(x!, y!, 1.7);
  }
};

/** Presentation-only overlay for Phase-B physical ground stacks. */
export function installLooseGoodsIndicators(scene: Phaser.Scene, world: World): void {
  const sceneWithCreate = scene as Phaser.Scene & { create?: () => void };
  const originalCreate = sceneWithCreate.create?.bind(scene);

  sceneWithCreate.create = () => {
    originalCreate?.();

    const container = scene.add.container(0, 0).setDepth(21);
    const visuals = new Map<string, StackVisual>();

    const render = () => {
      const activeIds = new Set((world.looseGoods ?? []).map((stack) => stack.id));
      for (const [id, visual] of visuals) {
        if (activeIds.has(id)) continue;
        visual.graphics.destroy();
        visuals.delete(id);
      }

      for (const stack of world.looseGoods ?? []) {
        const state = signature(stack);
        let visual = visuals.get(stack.id);
        if (!visual) {
          const { x, y } = pixel(stack.position);
          const graphics = scene.add.graphics().setPosition(x, y);
          drawStack(graphics, stack);
          visual = { graphics, signature: state };
          visuals.set(stack.id, visual);
          container.add(graphics);
          continue;
        }

        const { x, y } = pixel(stack.position);
        visual.graphics.setPosition(x, y);
        if (visual.signature !== state) {
          drawStack(visual.graphics, stack);
          visual.signature = state;
        }
      }
    };

    render();
    scene.events.on(Phaser.Scenes.Events.POST_UPDATE, render);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      scene.events.off(Phaser.Scenes.Events.POST_UPDATE, render);
      container.destroy(true);
      visuals.clear();
    });
  };
}
