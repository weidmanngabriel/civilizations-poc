import Phaser from "phaser";
import { MainScene } from "./game/MainScene";
import { createWorld } from "./simulation/scenario";
import { mountControls } from "./ui/controls";
import "./style.css";
import "./map-interaction.css";

const preventPageZoom = (): void => {
  document.addEventListener(
    "wheel",
    (event) => {
      if (event.ctrlKey) event.preventDefault();
    },
    { passive: false },
  );

  document.addEventListener("keydown", (event) => {
    if (!(event.ctrlKey || event.metaKey)) return;
    if (["+", "=", "-", "0"].includes(event.key)) event.preventDefault();
  });
};

preventPageZoom();

const world = createWorld();
const scene = new MainScene(world);
mountControls(world, () => scene.renderWorld());

new Phaser.Game({
  type: Phaser.AUTO,
  parent: "game",
  width: 1000,
  height: 570,
  resolution: Math.min(window.devicePixelRatio || 1, 2),
  backgroundColor: "#304d35",
  scene: [scene],
  input: { activePointers: 3 },
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
  render: { antialias: true },
});
