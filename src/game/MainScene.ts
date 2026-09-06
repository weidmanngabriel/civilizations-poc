import Phaser from "phaser";
import type { Good, Hex, World } from "../simulation/model";
import { key } from "../simulation/hex";
import { CONFIG } from "../simulation/scenario";

const pixel = (h: Hex) => ({ x: 78 + 82 * (h.q + h.r / 2), y: 68 + h.r * 71 });
const colors = {
  grass: 0x526b42,
  road: 0xc0a375,
  mountain: 0x727b72,
  river: 0x43879a,
  building: 0xe6ce94,
};
const goodColors: Record<Good, number> = {
  wood: 0x6f4a2d,
  plank: 0xd4a763,
  woodenTool: 0xc8d8d0,
};

export class MainScene extends Phaser.Scene {
  private markers?: Phaser.GameObjects.Container;

  constructor(private world: World) {
    super("main");
  }

  create(): void {
    const g = this.add.graphics();
    for (const tile of this.world.tiles) {
      const { x, y } = pixel(tile);
      const points = Array.from(
        { length: 6 },
        (_, i) =>
          new Phaser.Math.Vector2(
            x + 46 * Math.cos(((60 * i - 30) * Math.PI) / 180),
            y + 46 * Math.sin(((60 * i - 30) * Math.PI) / 180),
          ),
      );
      g.fillStyle(colors[tile.terrain]);
      g.fillPoints(points, true);
      g.lineStyle(1, 0x20392c, 0.5);
      g.strokePoints(points, true);
      if (tile.terrain === "mountain") {
        g.fillStyle(0xb4bab0);
        g.fillTriangle(x - 17, y + 13, x, y - 17, x + 17, y + 13);
      }
      if (tile.terrain === "river") {
        g.lineStyle(2, 0xafd3d3, 0.6);
        g.lineBetween(x - 16, y + 2, x + 16, y - 2);
      }
      if (tile.terrain === "grass") {
        g.lineStyle(1, 0x93a76e, 0.4);
        g.lineBetween(x - 3, y + 3, x - 6, y - 4);
        g.lineBetween(x - 3, y + 3, x + 2, y - 5);
      }
    }
    for (const b of this.world.buildings) {
      const { x, y } = pixel(b.position);
      const labels = {
        hq: "HQ",
        forest: "WALD",
        sawmill: "SÄGEWERK",
        carpenter: "SCHREINEREI",
        warehouse: "LAGER",
      };
      this.add
        .text(x, y - 17, labels[b.id], {
          fontFamily: "system-ui",
          fontSize: "10px",
          fontStyle: "bold",
          color: "#203226",
        })
        .setOrigin(0.5);
      if (b.id === "forest") {
        g.fillStyle(0x315537);
        g.fillTriangle(x - 10, y - 25, x, y - 42, x + 10, y - 25);
      } else {
        g.fillStyle(0x785d3e);
        g.fillRect(x - 9, y - 38, 18, 11);
        g.fillTriangle(x - 13, y - 38, x, y - 47, x + 13, y - 38);
      }
    }
    this.markers = this.add.container(0, 0);
    this.renderWorld();
  }

  private drawSlots(
    g: Phaser.GameObjects.Graphics,
    x: number,
    y: number,
    count: number,
    capacity: number,
    good: Good,
    columns: number,
  ): void {
    const size = 5;
    const gap = 2;
    for (let i = 0; i < capacity; i += 1) {
      const sx = x + (i % columns) * (size + gap);
      const sy = y + Math.floor(i / columns) * (size + gap);
      if (i < count) {
        g.fillStyle(goodColors[good], 1);
        g.fillRect(sx, sy, size, size);
      }
      g.lineStyle(1, 0x21372a, 0.8);
      g.strokeRect(sx, sy, size, size);
    }
  }

  renderWorld(): void {
    if (!this.markers) return;
    this.markers.removeAll(true);

    const slots = this.add.graphics();
    this.markers.add(slots);
    for (const b of this.world.buildings) {
      if (!b.recipe) continue;
      const { x, y } = pixel(b.position);
      if (b.recipe.input) {
        this.drawSlots(
          slots,
          x + 13,
          y - 9,
          b.input,
          CONFIG.inputCapacity,
          b.recipe.input,
          5,
        );
        this.markers.add(
          this.add.text(x + 13, y - 16, "IN", {
            fontFamily: "system-ui",
            fontSize: "6px",
            color: "#21372a",
          }),
        );
      }
      this.drawSlots(
        slots,
        x + 13,
        b.recipe.input ? y + 8 : y - 2,
        b.output,
        CONFIG.outputCapacity,
        b.recipe.output,
        3,
      );
      this.markers.add(
        this.add.text(x + 13, b.recipe.input ? y + 15 : y + 5, "OUT", {
          fontFamily: "system-ui",
          fontSize: "6px",
          color: "#21372a",
        }),
      );
    }

    const groups = new Map<string, number>();
    for (const p of this.world.people) {
      const k = key(p.position),
        i = groups.get(k) ?? 0;
      groups.set(k, i + 1);
      const pos = pixel(p.position),
        x = pos.x + ((i % 4) - 1.5) * 16,
        y = pos.y + 2 + Math.floor(i / 4) * 16;
      const color = !p.assignment
        ? 0xdde5db
        : p.assignment.role === "worker"
          ? 0x234636
          : 0x8b512e;
      const dot = this.add.circle(x, y, 7, color).setStrokeStyle(1, 0xffffff);
      const label = this.add
        .text(x, y, String(p.id), {
          fontFamily: "system-ui",
          fontSize: "8px",
          color: "#ffffff",
        })
        .setOrigin(0.5);
      if (!p.assignment) label.setColor("#24362b");
      this.markers.add([dot, label]);
      if (p.trip?.picked)
        this.markers.add(
          this.add.text(
            x + 5,
            y - 9,
            { wood: "H", plank: "B", woodenTool: "W" }[p.trip.good],
            { fontSize: "9px", color: "#fff2a3", backgroundColor: "#263c2d" },
          ),
        );
    }
  }
}
