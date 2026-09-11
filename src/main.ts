import Phaser from "phaser";
import { MainScene } from "./game/MainScene";
import { installBushIndicators } from "./game/bushIndicators";
import { installHungerIndicators } from "./game/hungerIndicators";
import {
  installMobileMapTouchControls,
  preventMobilePageZoom,
} from "./game/mobileTouch";
import { createDefaultGameWorld } from "./simulation/scenario";
import { installTileSelectionGuard, mountBuildMenu } from "./ui/buildMenu";
import { mountControls } from "./ui/controls";
import "./style.css";
import "./map-interaction.css";
import "./build-placement.css";
import "./build-menu.css";

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

const world = createDefaultGameWorld();
const scene = new MainScene(world);
installBushIndicators(scene, world);
installHungerIndicators(scene, world);
installTileSelectionGuard();
mountControls(world, () => scene.renderWorld());
mountBuildMenu(world);
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
