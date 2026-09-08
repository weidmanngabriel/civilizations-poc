import Phaser from "phaser";
import { MainScene } from "./game/MainScene";
import {
  installMobileMapTouchControls,
  preventMobilePageZoom,
} from "./game/mobileTouch";
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

  preventMobilePageZoom();
};

const showBuildVersion = (): void => {
  const eyebrow = document.querySelector<HTMLElement>(".eyebrow");
  if (!eyebrow) return;

  const buildDate = new Date(process.env.BUILD_TIME ?? "");
  if (Number.isNaN(buildDate.getTime())) return;

  const version = new Intl.DateTimeFormat("de-DE", {
    timeZone: "Europe/Berlin",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(buildDate);

  eyebrow.textContent = `${eyebrow.textContent} · VERSION ${version}`;
};

preventPageZoom();

const world = createWorld();
const scene = new MainScene(world);
mountControls(world, () => scene.renderWorld());
showBuildVersion();

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: "game",
  width: 1000,
  height: 570,
  backgroundColor: "#304d35",
  scene: [scene],
  input: { activePointers: 3 },
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
  render: { antialias: true },
});

installMobileMapTouchControls(game, scene);
