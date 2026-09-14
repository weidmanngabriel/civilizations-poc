import Phaser from "phaser";
import { performanceNow, performanceProfiler } from "./debug/performanceProfiler";
import { IncrementalMainScene } from "./game/IncrementalMainScene";
import { installBuildPlacementHighlights } from "./game/buildPlacementHighlights";
import { installBushIndicators } from "./game/bushIndicators";
import { installDesktopBuildPlacement } from "./game/desktopBuildPlacement";
import { installHungerIndicators } from "./game/hungerIndicators";
import { installLooseGoodsIndicators } from "./game/looseGoodsIndicators";
import { installPersonSelection } from "./game/personSelection";
import { installSleepIndicators } from "./game/sleepIndicators";
import {
  installMobileMapTouchControls,
  preventMobilePageZoom,
} from "./game/mobileTouch";
import { installPwaSupport } from "./pwa";
import { createDefaultGameWorld } from "./simulation/scenario";
import { installTileSelectionGuard, mountBuildMenu } from "./ui/buildMenu";
import { mountControls } from "./ui/controls";
import { mountHandbook } from "./ui/handbook";
import { installHqStoragePanel } from "./ui/hqStoragePanel";
import { mountPersonPanel } from "./ui/personPanel";
import { installPerformanceDebugPanel } from "./ui/performanceDebug";
import { mountTechnologyTree } from "./ui/technologyTree";
import { applyTechnologyTreeLayout } from "./ui/technologyTreeLayout";
import "./style.css";
import "./map-interaction.css";
import "./build-placement.css";
import "./build-menu.css";
import "./handbook.css";
import "./person-panel.css";
import "./performance-debug.css";
import "./technology-tree.css";

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
installPwaSupport();

const world = createDefaultGameWorld();
const scene = new IncrementalMainScene(world);
const rawRenderWorld = scene.renderWorld.bind(scene);
let renderFrame: number | undefined;
scene.renderWorld = () => {
  if (renderFrame !== undefined) return;
  renderFrame = window.requestAnimationFrame(() => {
    renderFrame = undefined;
    const started = performanceNow();
    try {
      rawRenderWorld();
    } finally {
      performanceProfiler.recordRender(performanceNow() - started);
    }
  });
};
installBushIndicators(scene, world);
installLooseGoodsIndicators(scene, world);
installBuildPlacementHighlights(scene, world);
installHungerIndicators(scene, world);
installSleepIndicators(scene, world);
installPersonSelection(scene, world);
installTileSelectionGuard();
mountControls(world, () => scene.renderWorld());
installPerformanceDebugPanel(world);
installHqStoragePanel(world);
mountBuildMenu(world);
mountHandbook();
mountPersonPanel(world);
mountTechnologyTree(world);
applyTechnologyTreeLayout();
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

// Keep touch and desktop input adapters separate so neither interaction model regresses the other.
installMobileMapTouchControls(game, scene);
