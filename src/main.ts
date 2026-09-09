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

const stabilizeTileDialogPointerActions = (): void => {
  const selectionPanel = document.querySelector<HTMLElement>("#selection-panel");
  if (!selectionPanel) return;

  selectionPanel.addEventListener("pointerdown", (event) => {
    const button = (event.target as HTMLElement).closest<HTMLButtonElement>("button[data-action]");
    if (!button || button.disabled) return;
    if (!["close", "build", "road"].includes(button.dataset.action ?? "")) return;

    // Tile panels can be refreshed between pointerdown and the browser's click event
    // while the simulation is running. Execute these tile actions immediately so
    // replacing the panel DOM cannot swallow the interaction.
    event.preventDefault();
    button.click();
  });
};

preventPageZoom();

const world = createWorld();
const scene = new MainScene(world);
mountControls(world, () => scene.renderWorld());
stabilizeTileDialogPointerActions();
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
