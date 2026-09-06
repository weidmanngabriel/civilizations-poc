import Phaser from "phaser";
import { MainScene } from "./game/MainScene";
import { createWorld } from "./simulation/scenario";
import { mountControls } from "./ui/controls";
import "./style.css";

const world = createWorld();
const scene = new MainScene(world);
mountControls(world, () => scene.renderWorld());

new Phaser.Game({
  type: Phaser.AUTO,
  parent: "game",
  width: 1000,
  height: 570,
  backgroundColor: "#304d35",
  scene: [scene],
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
  render: { antialias: true },
});
