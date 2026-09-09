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

const BASE_GAME_SPEED = 0.25;

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

const applyBaseGameSpeed = (): void => {
  const speedButtons = Array.from(
    document.querySelectorAll<HTMLButtonElement>("[data-sim-speed]"),
  );

  for (const button of speedButtons) {
    const relativeSpeed = Number(button.dataset.simSpeed);
    button.dataset.simSpeed = String(relativeSpeed * BASE_GAME_SPEED);
  }

  speedButtons.find((button) => button.textContent === "1×")?.click();
};

const showBuildVersion = (): void => {
  const versionLabel = document.querySelector<HTMLElement>("#build-version");
  if (!versionLabel) return;

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

  versionLabel.textContent = `POC 01 · ${version}`;
};

preventPageZoom();

const world = createWorld();
const scene = new MainScene(world);
mountControls(world, () => scene.renderWorld());
applyBaseGameSpeed();
showBuildVersion();

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: "game",
  backgroundColor: "#304d35",
  scene: [scene],
  input: { activePointers: 3 },
  scale: {
    mode: Phaser.Scale.RESIZE,
    width: window.innerWidth,
    height: window.innerHeight,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  render: { antialias: true },
});

installMobileMapTouchControls(game, scene);
