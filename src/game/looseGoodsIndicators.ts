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
  fish: 0x6fa7b8,
  meat: 0xb85f55,
  leather: 0x8a5a3b,
  wool: 0xe8e3d7,
  shoes: 0x6f513b,
  clay: 0x9b6a4d,
  rubble: 0x8b8f8c,
  brick: 0xb55d42,
  stoneBlock: 0xc8c8bd,
  roofTile: 0xc56f4a,
  marble: 0xe7e2d8,
};

type StackVisual = {
  graphics: Phaser.GameObjects.Graphics;
  signature: string;
};

const signature = (stack: LooseGoodStack): string =>
  `${stack.good}:${stack.amount}:${stack.reserved}`;

const offsetsForAmount = (amount: number): readonly (readonly [number, number])[] =>
  amount === 1
    ? [[0, 0]]
    : amount === 2
      ? [[-2.2, 0.9], [2.2, -0.9]]
      : [[-2.6, 1.7], [2.6, 1.7], [0, -1.8]];

const drawPiece = (
  graphics: Phaser.GameObjects.Graphics,
  good: Good,
  x: number,
  y: number,
): void => {
  const color = goodColors[good];
  if (good === "wood") {
    graphics.fillStyle(color, 0.98);
    graphics.fillRect(x - 2.5, y - 1.1, 5, 2.2);
    graphics.lineStyle(0.55, 0x3c291d, 0.9);
    graphics.strokeRect(x - 2.5, y - 1.1, 5, 2.2);
    return;
  }
  if (good === "clay") {
    graphics.fillStyle(color, 0.98);
    graphics.fillCircle(x, y, 2.2);
    graphics.fillStyle(0xb88460, 0.85);
    graphics.fillCircle(x - 0.6, y - 0.6, 0.7);
    return;
  }
  if (good === "meat") {
    graphics.fillStyle(color, 0.98);
    graphics.fillEllipse(x, y, 4.7, 3.3);
    graphics.fillStyle(0xe7ddd0, 1);
    graphics.fillCircle(x + 2.2, y - 0.2, 1);
    graphics.fillCircle(x + 3.2, y - 0.2, 0.85);
    return;
  }
  if (good === "leather") {
    graphics.fillStyle(color, 0.98);
    graphics.fillEllipse(x, y, 5.2, 3.6);
    graphics.lineStyle(0.8, 0x5f3b27, 1);
    graphics.strokeEllipse(x, y, 5.2, 3.6);
    return;
  }
  if (good === "rubble") {
    graphics.fillStyle(color, 0.98);
    graphics.fillTriangle(x - 2.4, y + 1.9, x - 0.2, y - 2.3, x + 2.5, y + 1.9);
    graphics.lineStyle(0.5, 0x4f5551, 0.9);
    graphics.lineBetween(x - 2.1, y + 1.8, x + 2.1, y + 1.8);
    return;
  }

  graphics.fillStyle(color, 0.98);
  graphics.fillCircle(x, y, 1.9);
  graphics.lineStyle(0.5, 0x263328, 0.9);
  graphics.strokeCircle(x, y, 1.9);
};

const drawStack = (graphics: Phaser.GameObjects.Graphics, stack: LooseGoodStack): void => {
  graphics.clear();
  for (const [x, y] of offsetsForAmount(stack.amount)) drawPiece(graphics, stack.good, x, y);

  if (stack.reserved > 0) {
    graphics.lineStyle(0.65, 0xf2e4a8, 0.85);
    graphics.strokeCircle(0, 0, stack.amount === 1 ? 3 : 4.7);
  }
};

/** Presentation-only overlay for physical ground stacks. */
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